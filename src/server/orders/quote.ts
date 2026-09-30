/**
 * Расчёт корзины / заказа на сервере: цены с учётом акций, промокод, доставка, наличие.
 * Используется корзиной, оформлением, ручными заказами, кассой и редактированием заказа.
 */
import type { DbClient } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import type { DeliveryMethod, PromoCode } from "@/generated/prisma/client";
import { mediaSelect, type MediaRef } from "../media/refs";
import { getPricingContext, toPricingProduct } from "../pricing/context";
import { computeTotals, evaluatePromo, resolvePrice, type PromoFailure, type PromoRule, type Totals } from "../pricing/engine";
import { mediaUrl } from "@/lib/media-url";

export const variantForQuote = {
  id: true,
  sku: true,
  price: true,
  salePrice: true,
  costPrice: true,
  stock: true,
  isActive: true,
  optionValues: {
    select: {
      attributeId: true,
      attributeValueId: true,
      attribute: { select: { nameRu: true, nameKk: true } },
      attributeValue: { select: { valueRu: true, valueKk: true, colorHex: true } },
    },
  },
  product: {
    select: {
      id: true,
      slug: true,
      status: true,
      nameRu: true,
      nameKk: true,
      price: true,
      salePrice: true,
      saleStartsAt: true,
      saleEndsAt: true,
      costPrice: true,
      brandId: true,
      allowBackorder: true,
      backorderNoteRu: true,
      backorderNoteKk: true,
      categories: { select: { categoryId: true } },
      options: { select: { attributeId: true, sortOrder: true } },
      media: { orderBy: { sortOrder: "asc" }, select: { colorValueId: true, media: { select: mediaSelect } } },
    },
  },
} satisfies Prisma.ProductVariantSelect;

type QuoteVariant = Prisma.ProductVariantGetPayload<{ select: typeof variantForQuote }>;

export type QuoteItemInput = { variantId: string; quantity: number; unitPrice?: number | null };

export type LineProblem = "OUT_OF_STOCK" | "VARIANT_UNAVAILABLE";

export type QuoteLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  productStatus: string;
  sku: string;
  nameRu: string;
  nameKk: string | null;
  variantLabelRu: string | null;
  variantLabelKk: string | null;
  options: { attributeId: string; nameRu: string; nameKk: string | null; valueRu: string; valueKk: string | null; colorHex: string | null }[];
  image: MediaRef | null;
  imageUrl: string | null;
  quantity: number;
  regularUnit: number;
  finalUnit: number;
  costUnit: number | null;
  lineRegular: number;
  lineTotal: number;
  discountPercent: number;
  stock: number;
  allowBackorder: boolean;
  backorderNoteRu: string | null;
  backorderNoteKk: string | null;
  categoryIds: string[];
  problem: LineProblem | null;
};

export type Quote = {
  lines: QuoteLine[];
  problems: { variantId: string; code: LineProblem; available: number }[];
  promo: { id: string; code: string; discount: number } | null;
  promoError: { code: PromoFailure | "PROMO_NOT_FOUND"; minOrderAmount?: number } | null;
  delivery: DeliveryMethod | null;
  totals: Totals;
  now: Date;
};

export type QuoteOptions = {
  /** Сотрудник может добавить скрытый/неопубликованный товар в ручной заказ */
  allowUnpublished?: boolean;
  /** Не проверять лимиты промокода (он уже учтён в заказе) */
  ignorePromoLimits?: boolean;
  /** Исключить заказ из подсчёта использований промокода клиентом */
  excludeOrderId?: string;
  allowInactiveDelivery?: boolean;
};

export function promoRuleFrom(
  code: PromoCode & { categories: { categoryId: string }[]; products: { productId: string }[] },
): PromoRule {
  return {
    id: code.id,
    code: code.code,
    type: code.type,
    value: code.value,
    scope: code.scope,
    categoryIds: code.categories.map((c) => c.categoryId),
    productIds: code.products.map((p) => p.productId),
    minOrderAmount: code.minOrderAmount,
    maxUses: code.maxUses,
    usedCount: code.usedCount,
    maxUsesPerCustomer: code.maxUsesPerCustomer,
    excludeDiscounted: code.excludeDiscounted,
    startsAt: code.startsAt,
    endsAt: code.endsAt,
    isActive: code.isActive,
  };
}

export function normalizePromoCode(code: string | null | undefined): string | null {
  const value = code?.trim().toUpperCase().replace(/\s+/g, "");
  return value ? value : null;
}

function variantLabel(variant: QuoteVariant, locale: "ru" | "kk"): string | null {
  const order = new Map(variant.product.options.map((o) => [o.attributeId, o.sortOrder]));
  const parts = [...variant.optionValues]
    .sort((a, b) => (order.get(a.attributeId) ?? 0) - (order.get(b.attributeId) ?? 0))
    .map((o) => {
      const name = locale === "kk" ? o.attribute.nameKk || o.attribute.nameRu : o.attribute.nameRu;
      const value = locale === "kk" ? o.attributeValue.valueKk || o.attributeValue.valueRu : o.attributeValue.valueRu;
      return `${name}: ${value}`;
    });
  return parts.length ? parts.join(", ") : null;
}

function pickImage(variant: QuoteVariant): MediaRef | null {
  const valueIds = new Set(variant.optionValues.map((o) => o.attributeValueId));
  const byColor = variant.product.media.find((m) => m.colorValueId && valueIds.has(m.colorValueId));
  return (byColor ?? variant.product.media[0])?.media ?? null;
}

export async function buildQuote(
  client: DbClient,
  input: {
    items: readonly QuoteItemInput[];
    deliveryMethodId?: string | null;
    deliveryPriceOverride?: number | null;
    promoCode?: string | null;
    customerPhone?: string | null;
    now?: Date;
  },
  options: QuoteOptions = {},
): Promise<Quote> {
  const ctx = await getPricingContext();
  const now = input.now ?? ctx.now;

  const merged = new Map<string, QuoteItemInput>();
  for (const item of input.items) {
    const quantity = Math.floor(item.quantity);
    if (quantity <= 0) continue;
    const prev = merged.get(item.variantId);
    merged.set(item.variantId, {
      variantId: item.variantId,
      quantity: (prev?.quantity ?? 0) + quantity,
      unitPrice: item.unitPrice ?? prev?.unitPrice ?? null,
    });
  }

  const variants = merged.size
    ? await client.productVariant.findMany({ where: { id: { in: [...merged.keys()] } }, select: variantForQuote })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: QuoteLine[] = [];
  const problems: Quote["problems"] = [];

  for (const item of merged.values()) {
    const v = byId.get(item.variantId);
    if (!v) {
      problems.push({ variantId: item.variantId, code: "VARIANT_UNAVAILABLE", available: 0 });
      continue;
    }
    const pricingProduct = toPricingProduct(v.product, ctx.categoryIndex);
    const price = resolvePrice(pricingProduct, v, ctx.promotions, now);
    const override = item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice >= 0 ? Math.round(item.unitPrice) : null;
    const finalUnit = override ?? price.final;
    const regularUnit = override !== null ? Math.max(price.regular, override) : price.regular;

    let problem: LineProblem | null = null;
    if (!v.isActive || (!options.allowUnpublished && v.product.status !== "PUBLISHED")) problem = "VARIANT_UNAVAILABLE";
    else if (v.stock < item.quantity && !v.product.allowBackorder) problem = "OUT_OF_STOCK";
    if (problem) problems.push({ variantId: v.id, code: problem, available: problem === "OUT_OF_STOCK" ? Math.max(0, v.stock) : 0 });

    const image = pickImage(v);
    lines.push({
      variantId: v.id,
      productId: v.product.id,
      productSlug: v.product.slug,
      productStatus: v.product.status,
      sku: v.sku,
      nameRu: v.product.nameRu,
      nameKk: v.product.nameKk,
      variantLabelRu: variantLabel(v, "ru"),
      variantLabelKk: variantLabel(v, "kk"),
      options: v.optionValues.map((o) => ({
        attributeId: o.attributeId,
        nameRu: o.attribute.nameRu,
        nameKk: o.attribute.nameKk,
        valueRu: o.attributeValue.valueRu,
        valueKk: o.attributeValue.valueKk,
        colorHex: o.attributeValue.colorHex,
      })),
      image,
      imageUrl: mediaUrl(image, 320),
      quantity: item.quantity,
      regularUnit,
      finalUnit,
      costUnit: v.costPrice ?? v.product.costPrice ?? null,
      lineRegular: regularUnit * item.quantity,
      lineTotal: finalUnit * item.quantity,
      discountPercent: regularUnit > finalUnit ? Math.round(((regularUnit - finalUnit) / regularUnit) * 100) : 0,
      stock: v.stock,
      allowBackorder: v.product.allowBackorder,
      backorderNoteRu: v.product.backorderNoteRu,
      backorderNoteKk: v.product.backorderNoteKk,
      categoryIds: pricingProduct.categoryIds as string[],
      problem,
    });
  }

  // строки с недоступным товаром в сумму не входят
  const payable = lines.filter((l) => l.problem !== "VARIANT_UNAVAILABLE");

  let promo: Quote["promo"] = null;
  let promoError: Quote["promoError"] = null;
  const code = normalizePromoCode(input.promoCode);
  if (code) {
    const promoCode = await client.promoCode.findUnique({
      where: { code },
      include: { categories: { select: { categoryId: true } }, products: { select: { productId: true } } },
    });
    if (!promoCode) {
      promoError = { code: "PROMO_NOT_FOUND" };
    } else {
      let rule = promoRuleFrom(promoCode);
      if (options.ignorePromoLimits) rule = { ...rule, maxUses: null, maxUsesPerCustomer: null };
      const customerUses =
        input.customerPhone && rule.maxUsesPerCustomer !== null
          ? await client.promoRedemption.count({
              where: {
                promoCodeId: promoCode.id,
                customerPhone: input.customerPhone,
                ...(options.excludeOrderId ? { orderId: { not: options.excludeOrderId } } : {}),
              },
            })
          : null;
      const evaluation = evaluatePromo(rule, payable, { now, customerUses });
      if (evaluation.ok) promo = { id: promoCode.id, code: promoCode.code, discount: evaluation.discount };
      else promoError = { code: evaluation.code, minOrderAmount: evaluation.minOrderAmount };
    }
  }

  const delivery = input.deliveryMethodId
    ? await client.deliveryMethod.findFirst({
        where: { id: input.deliveryMethodId, ...(options.allowInactiveDelivery ? {} : { isActive: true }) },
      })
    : null;

  let totals = computeTotals({
    lines: payable,
    promoDiscount: promo?.discount ?? 0,
    delivery: delivery ? { price: delivery.price, freeFrom: delivery.freeFrom } : null,
  });
  if (input.deliveryPriceOverride !== null && input.deliveryPriceOverride !== undefined && input.deliveryPriceOverride >= 0) {
    const deliveryPrice = Math.round(input.deliveryPriceOverride);
    totals = { ...totals, deliveryPrice, deliveryFree: deliveryPrice === 0, total: totals.itemsTotal - totals.promoDiscount + deliveryPrice };
  }

  return { lines, problems, promo, promoError, delivery, totals, now };
}
