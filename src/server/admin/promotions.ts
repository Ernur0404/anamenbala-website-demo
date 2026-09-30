/** Акции: автоматические скидки (пересчёт цен витрины) и промокоды */
import { z } from "zod";
import { db, transaction } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { CacheTags, invalidateTags } from "../cache";
import { repriceAllProducts } from "../catalog/indexer";
import { addDays, storeDayStart } from "@/lib/dates";
import type { AdminActor } from "./action";

const dateKey = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().nullable();
const ids = z.array(z.string().min(1)).max(500).default([]);

function period(startsAt?: string | null, endsAt?: string | null) {
  const from = startsAt ? storeDayStart(startsAt) : null;
  const to = endsAt ? addDays(storeDayStart(endsAt), 1) : null;
  if (from && to && to <= from) throw new DomainError("VALIDATION", "Окончание раньше начала", { fieldErrors: { endsAt: "invalid" } });
  return { startsAt: from, endsAt: to };
}

export type PromoState = "active" | "scheduled" | "ended" | "off";
export function promoState(p: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now = new Date()): PromoState {
  if (!p.isActive) return "off";
  if (p.startsAt && p.startsAt > now) return "scheduled";
  if (p.endsAt && p.endsAt <= now) return "ended";
  return "active";
}

// ───────────── скидки ─────────────

export const promotionSchema = z
  .object({
    id: z.string().optional().nullable(),
    nameRu: z.string().trim().min(1).max(120),
    nameKk: z.string().trim().max(120).optional().nullable(),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().min(1).max(10_000_000),
    scope: z.enum(["CATEGORY", "BRAND", "PRODUCT"]),
    categoryIds: ids,
    brandIds: ids,
    productIds: ids,
    startsAt: dateKey,
    endsAt: dateKey,
    isActive: z.boolean(),
  })
  .refine((p) => p.type !== "PERCENT" || p.value <= 100, { path: ["value"], message: "invalid" });

export async function savePromotion(raw: z.infer<typeof promotionSchema>, actor: AdminActor) {
  const input = promotionSchema.parse(raw);
  const targets = input.scope === "CATEGORY" ? input.categoryIds : input.scope === "BRAND" ? input.brandIds : input.productIds;
  if (!targets.length) throw new DomainError("VALIDATION", "Нет целей", { fieldErrors: { targets: "needTargets" } });
  const dates = period(input.startsAt, input.endsAt);
  const data = { nameRu: input.nameRu, nameKk: input.nameKk || null, type: input.type, value: input.value, scope: input.scope, isActive: input.isActive, ...dates };

  const promotion = await transaction(async (tx) => {
    const saved = input.id ? await tx.promotion.update({ where: { id: input.id }, data }) : await tx.promotion.create({ data });
    await Promise.all([
      tx.promotionCategory.deleteMany({ where: { promotionId: saved.id } }),
      tx.promotionBrand.deleteMany({ where: { promotionId: saved.id } }),
      tx.promotionProduct.deleteMany({ where: { promotionId: saved.id } }),
    ]);
    if (input.scope === "CATEGORY") await tx.promotionCategory.createMany({ data: input.categoryIds.map((categoryId) => ({ promotionId: saved.id, categoryId })), skipDuplicates: true });
    if (input.scope === "BRAND") await tx.promotionBrand.createMany({ data: input.brandIds.map((brandId) => ({ promotionId: saved.id, brandId })), skipDuplicates: true });
    if (input.scope === "PRODUCT") await tx.promotionProduct.createMany({ data: input.productIds.map((productId) => ({ promotionId: saved.id, productId })), skipDuplicates: true });
    await audit(
      {
        staffUserId: actor.id,
        action: input.id ? "promotion.update" : "promotion.create",
        entityType: "promotion",
        entityId: saved.id,
        summary: `Скидка «${saved.nameRu}»: ${saved.value}${saved.type === "PERCENT" ? "%" : " ₸"}`,
        ip: actor.ip,
      },
      tx,
    );
    return saved;
  });
  invalidateTags(CacheTags.promotions, CacheTags.catalog);
  await repriceAllProducts();
  return { id: promotion.id };
}

export async function togglePromotion(promotionId: string, isActive: boolean, actor: AdminActor) {
  const p = await db.promotion.update({ where: { id: promotionId }, data: { isActive } });
  await audit({ staffUserId: actor.id, action: "promotion.toggle", entityType: "promotion", entityId: promotionId, summary: `Скидка «${p.nameRu}» ${isActive ? "включена" : "выключена"}`, ip: actor.ip });
  invalidateTags(CacheTags.promotions, CacheTags.catalog);
  await repriceAllProducts();
}

export async function deletePromotion(promotionId: string, actor: AdminActor) {
  const p = await db.promotion.delete({ where: { id: promotionId } }).catch(() => null);
  if (!p) throw new DomainError("NOT_FOUND");
  await audit({ staffUserId: actor.id, action: "promotion.delete", entityType: "promotion", entityId: promotionId, summary: `Удалена скидка «${p.nameRu}»`, ip: actor.ip });
  invalidateTags(CacheTags.promotions, CacheTags.catalog);
  await repriceAllProducts();
}

// ───────────── промокоды ─────────────

export const promoCodeSchema = z
  .object({
    id: z.string().optional().nullable(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform((c) => c.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_-]+$/)),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().min(1).max(10_000_000),
    scope: z.enum(["ALL", "CATEGORIES", "PRODUCTS"]),
    categoryIds: ids,
    productIds: ids,
    minOrderAmount: z.number().int().min(0).max(100_000_000).nullable().optional(),
    maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
    maxUsesPerCustomer: z.number().int().min(1).max(1000).nullable().optional(),
    excludeDiscounted: z.boolean(),
    startsAt: dateKey,
    endsAt: dateKey,
    isActive: z.boolean(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine((p) => p.type !== "PERCENT" || p.value <= 100, { path: ["value"], message: "invalid" });

export async function savePromoCode(raw: z.input<typeof promoCodeSchema>, actor: AdminActor) {
  const input = promoCodeSchema.parse(raw);
  if (input.scope === "CATEGORIES" && !input.categoryIds.length) throw new DomainError("VALIDATION", "Нет категорий", { fieldErrors: { targets: "needTargets" } });
  if (input.scope === "PRODUCTS" && !input.productIds.length) throw new DomainError("VALIDATION", "Нет товаров", { fieldErrors: { targets: "needTargets" } });
  const clash = await db.promoCode.findUnique({ where: { code: input.code }, select: { id: true } });
  if (clash && clash.id !== input.id) throw new DomainError("CONFLICT", "Код занят", { fieldErrors: { code: "codeTaken" } });
  const data = {
    code: input.code,
    type: input.type,
    value: input.value,
    scope: input.scope,
    minOrderAmount: input.minOrderAmount ?? null,
    maxUses: input.maxUses ?? null,
    maxUsesPerCustomer: input.maxUsesPerCustomer ?? null,
    excludeDiscounted: input.excludeDiscounted,
    isActive: input.isActive,
    note: input.note || null,
    ...period(input.startsAt, input.endsAt),
  };
  const code = await transaction(async (tx) => {
    const saved = input.id ? await tx.promoCode.update({ where: { id: input.id }, data }) : await tx.promoCode.create({ data });
    await tx.promoCodeCategory.deleteMany({ where: { promoCodeId: saved.id } });
    await tx.promoCodeProduct.deleteMany({ where: { promoCodeId: saved.id } });
    if (input.scope === "CATEGORIES") await tx.promoCodeCategory.createMany({ data: input.categoryIds.map((categoryId) => ({ promoCodeId: saved.id, categoryId })), skipDuplicates: true });
    if (input.scope === "PRODUCTS") await tx.promoCodeProduct.createMany({ data: input.productIds.map((productId) => ({ promoCodeId: saved.id, productId })), skipDuplicates: true });
    await audit({ staffUserId: actor.id, action: input.id ? "promo_code.update" : "promo_code.create", entityType: "promo_code", entityId: saved.id, summary: `Промокод ${saved.code}`, ip: actor.ip }, tx);
    return saved;
  });
  return { id: code.id };
}

export async function togglePromoCode(codeId: string, isActive: boolean, actor: AdminActor) {
  const c = await db.promoCode.update({ where: { id: codeId }, data: { isActive } });
  await audit({ staffUserId: actor.id, action: "promo_code.toggle", entityType: "promo_code", entityId: codeId, summary: `Промокод ${c.code} ${isActive ? "включён" : "выключен"}`, ip: actor.ip });
}

export async function deletePromoCode(codeId: string, actor: AdminActor) {
  const c = await db.promoCode.delete({ where: { id: codeId } }).catch(() => null);
  if (!c) throw new DomainError("NOT_FOUND");
  await audit({ staffUserId: actor.id, action: "promo_code.delete", entityType: "promo_code", entityId: codeId, summary: `Удалён промокод ${c.code}`, ip: actor.ip });
}
