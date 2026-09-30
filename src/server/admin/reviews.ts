/** Отзывы: модерация, ответ магазина, «на главной», добавление вручную */
import { z } from "zod";
import { db, transaction } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { CacheTags, invalidateTags } from "../cache";
import { refreshProductRating } from "../catalog/indexer";
import { mediaSelect } from "../media/refs";
import { storeDayStart } from "@/lib/dates";
import type { AdminActor } from "./action";

export const REVIEW_PAGE_SIZE = 20;

export async function listReviews(f: { status?: "PENDING" | "APPROVED" | "REJECTED"; q?: string; rating?: number }, page: number) {
  const and: Prisma.ReviewWhereInput[] = [];
  if (f.status) and.push({ status: f.status });
  if (f.rating) and.push({ rating: f.rating });
  const q = f.q?.trim();
  if (q) and.push({ OR: [{ authorName: { contains: q, mode: "insensitive" } }, { text: { contains: q, mode: "insensitive" } }, { product: { nameRu: { contains: q, mode: "insensitive" } } }] });
  const where: Prisma.ReviewWhereInput = and.length ? { AND: and } : {};
  const [rows, total, counts] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REVIEW_PAGE_SIZE,
      take: REVIEW_PAGE_SIZE,
      include: {
        product: { select: { id: true, nameRu: true, slug: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } } } },
        photos: { orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } },
        moderatedBy: { select: { name: true } },
      },
    }),
    db.review.count({ where }),
    db.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return { rows, total, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number> };
}

async function afterChange(productId: string | null) {
  if (productId) await refreshProductRating(productId);
  invalidateTags(CacheTags.reviews);
}

export async function moderateReview(id: string, status: "APPROVED" | "REJECTED" | "PENDING", actor: AdminActor) {
  const review = await db.review.update({ where: { id }, data: { status, moderatedAt: new Date(), moderatedById: actor.id } }).catch(() => null);
  if (!review) throw new DomainError("NOT_FOUND");
  await audit({ staffUserId: actor.id, action: "review.moderate", entityType: "review", entityId: id, summary: `Отзыв ${review.authorName}: ${status}`, ip: actor.ip });
  await afterChange(review.productId);
}

export async function setReviewFeatured(id: string, isFeatured: boolean, actor: AdminActor) {
  const review = await db.review.update({ where: { id }, data: { isFeatured } });
  await audit({ staffUserId: actor.id, action: "review.feature", entityType: "review", entityId: id, summary: `Отзыв ${review.authorName}: на главной = ${isFeatured}`, ip: actor.ip });
  invalidateTags(CacheTags.reviews);
}

export async function replyToReview(id: string, replyText: string | null, actor: AdminActor) {
  const text = replyText?.trim() || null;
  const review = await db.review.update({ where: { id }, data: { replyText: text, repliedAt: text ? new Date() : null } });
  await audit({ staffUserId: actor.id, action: "review.reply", entityType: "review", entityId: id, summary: `Ответ на отзыв ${review.authorName}`, ip: actor.ip });
  invalidateTags(CacheTags.reviews);
}

export async function deleteReview(id: string, actor: AdminActor) {
  const review = await db.review.delete({ where: { id } }).catch(() => null);
  if (!review) throw new DomainError("NOT_FOUND");
  await audit({ staffUserId: actor.id, action: "review.delete", entityType: "review", entityId: id, summary: `Удалён отзыв ${review.authorName}`, ip: actor.ip });
  await afterChange(review.productId);
}

export const adminReviewSchema = z.object({
  authorName: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(3000),
  productId: z.string().optional().nullable(),
  date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().nullable(),
  photoIds: z.array(z.string()).max(3).default([]),
  isFeatured: z.boolean().default(false),
});

/** Отзыв, добавленный владельцем (например, из Instagram) — сразу опубликован */
export async function createAdminReview(raw: z.input<typeof adminReviewSchema>, actor: AdminActor) {
  const input = adminReviewSchema.parse(raw);
  const review = await transaction(async (tx) => {
    if (input.productId && !(await tx.product.findUnique({ where: { id: input.productId }, select: { id: true } }))) throw new DomainError("NOT_FOUND");
    const created = await tx.review.create({
      data: {
        authorName: input.authorName,
        rating: input.rating,
        text: input.text,
        productId: input.productId || null,
        status: "APPROVED",
        source: "ADMIN",
        isFeatured: input.isFeatured,
        moderatedAt: new Date(),
        moderatedById: actor.id,
        createdAt: input.date ? new Date(storeDayStart(input.date).getTime() + 12 * 3_600_000) : undefined,
      },
    });
    if (input.photoIds.length) {
      const known = await tx.media.findMany({ where: { id: { in: input.photoIds }, kind: "IMAGE" }, select: { id: true } });
      await tx.reviewPhoto.createMany({ data: known.map((m, i) => ({ reviewId: created.id, mediaId: m.id, sortOrder: i })) });
    }
    await audit({ staffUserId: actor.id, action: "review.create", entityType: "review", entityId: created.id, summary: `Добавлен отзыв ${created.authorName}`, ip: actor.ip }, tx);
    return created;
  });
  await afterChange(review.productId);
  return { id: review.id };
}
