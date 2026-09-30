"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { db } from "../db";
import { DomainError, type ActionResult } from "../errors";
import { run } from "./run";
import { rateLimit } from "../rate-limit";
import { clientIp } from "../request";
import { getCurrentUser } from "../auth/customer";
import { saveImage } from "../media/upload";
import { notifyNewReview } from "../notifications";
import { invalidateTags, CacheTags } from "../cache";

const reviewSchema = z.object({
  productId: z.string().optional().nullable(),
  name: z.string().trim().min(2).max(60),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(3000),
  website: z.string().max(0).optional(),
});

/** Отзыв покупателя: публикуется после модерации */
export async function submitReviewAction(formData: FormData): Promise<ActionResult<undefined>> {
  return run(async () => {
    const data = reviewSchema.parse({
      productId: formData.get("productId") || null,
      name: formData.get("name"),
      rating: formData.get("rating"),
      text: formData.get("text"),
      website: formData.get("website") ?? "",
    });
    const ip = (await clientIp()) ?? "unknown";
    if (!(await rateLimit(`review:${ip}`, 5, 3600))) throw new DomainError("RATE_LIMITED", "Слишком много отзывов");

    if (data.productId) {
      const product = await db.product.findFirst({ where: { id: data.productId, status: "PUBLISHED" }, select: { id: true } });
      if (!product) throw new DomainError("NOT_FOUND", "Товар не найден");
    }

    const user = await getCurrentUser();
    let orderId: string | null = null;
    if (user && data.productId) {
      const order = await db.order.findFirst({
        where: { userId: user.id, status: { in: ["DELIVERED", "COMPLETED"] }, items: { some: { productId: data.productId } } },
        select: { id: true },
      });
      orderId = order?.id ?? null;
    }

    const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
    const photos = [];
    for (const file of files) photos.push(await saveImage(file, { maxWidth: 1280 }));

    const review = await db.review.create({
      data: {
        productId: data.productId || null,
        userId: user?.id ?? null,
        orderId,
        authorName: data.name,
        rating: data.rating,
        text: data.text,
        status: "PENDING",
        source: "SITE",
        isVerified: Boolean(orderId),
        locale: (await getLocale()) === "kk" ? "kk" : "ru",
        photos: { create: photos.map((p, i) => ({ mediaId: p.id, sortOrder: i })) },
      },
    });
    invalidateTags(CacheTags.reviews);
    await notifyNewReview(review.id).catch((e) => console.error(e));
    return undefined;
  });
}
