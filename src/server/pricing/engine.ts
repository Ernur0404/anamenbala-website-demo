/**
 * Ценообразование — чистые функции без обращения к БД (покрыты тестами).
 *
 * Итоговая цена варианта = минимум из:
 *   • обычной цены,
 *   • акционной цены товара/варианта (если сейчас действует период акции),
 *   • цены после автоматической скидки на категорию / бренд / товар.
 * Автоскидки не суммируются. «Старая цена» на витрине = обычная цена.
 * Промокод применяется к корзине сверху (evaluatePromo).
 */
import { clamp, percentOff } from "@/lib/utils";

export type DiscountType = "PERCENT" | "FIXED";

export type PromotionRule = {
  id: string;
  type: DiscountType;
  value: number;
  scope: "CATEGORY" | "BRAND" | "PRODUCT";
  categoryIds: readonly string[];
  brandIds: readonly string[];
  productIds: readonly string[];
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export type PricingProduct = {
  id: string;
  price: number;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  brandId: string | null;
  /** Категории товара вместе со всеми родительскими */
  categoryIds: readonly string[];
};

export type PricingVariant = {
  price: number | null;
  salePrice: number | null;
};

export type PriceSource = "regular" | "sale" | "promotion";

export type PriceResult = {
  regular: number;
  final: number;
  discountPercent: number;
  source: PriceSource;
  promotionId: string | null;
};

export function isActiveWindow(startsAt: Date | null | undefined, endsAt: Date | null | undefined, now: Date): boolean {
  if (startsAt && now.getTime() < startsAt.getTime()) return false;
  if (endsAt && now.getTime() > endsAt.getTime()) return false;
  return true;
}

/** Процентная скидка округляется вниз до 10 ₸ (цена «красивая» и в пользу покупателя) */
export function applyDiscount(amount: number, type: DiscountType, value: number): number {
  if (type === "PERCENT") {
    const exact = (amount * (100 - clamp(value, 0, 100))) / 100;
    return Math.max(0, Math.floor(exact / 10) * 10);
  }
  return Math.max(0, amount - Math.max(0, value));
}

export function promotionMatches(rule: PromotionRule, product: PricingProduct): boolean {
  switch (rule.scope) {
    case "PRODUCT":
      return rule.productIds.includes(product.id);
    case "BRAND":
      return product.brandId !== null && rule.brandIds.includes(product.brandId);
    case "CATEGORY":
      return product.categoryIds.some((id) => rule.categoryIds.includes(id));
  }
}

export function isPromotionLive(rule: PromotionRule, now: Date): boolean {
  return rule.isActive && rule.value > 0 && isActiveWindow(rule.startsAt, rule.endsAt, now);
}

export function resolvePrice(
  product: PricingProduct,
  variant: PricingVariant,
  promotions: readonly PromotionRule[],
  now: Date,
): PriceResult {
  const regular = variant.price ?? product.price;
  let final = regular;
  let source: PriceSource = "regular";
  let promotionId: string | null = null;

  // Акционная цена товара применяется к вариантам без собственной цены; у варианта может быть своя
  const salePrice = variant.salePrice ?? (variant.price === null ? product.salePrice : null);
  if (salePrice !== null && salePrice > 0 && salePrice < final && isActiveWindow(product.saleStartsAt, product.saleEndsAt, now)) {
    final = salePrice;
    source = "sale";
  }

  for (const rule of promotions) {
    if (!isPromotionLive(rule, now) || !promotionMatches(rule, product)) continue;
    const candidate = applyDiscount(regular, rule.type, rule.value);
    if (candidate < final) {
      final = candidate;
      source = "promotion";
      promotionId = rule.id;
    }
  }

  return { regular, final, discountPercent: percentOff(regular, final), source, promotionId };
}

export type ProductPriceSummary = {
  priceMin: number;
  priceMax: number;
  /** Обычная цена варианта с минимальной итоговой — показывается зачёркнутой */
  regularMin: number;
  discountPercent: number;
};

export function summarizeProductPrice(
  product: PricingProduct,
  variants: ReadonlyArray<PricingVariant & { isActive: boolean }>,
  promotions: readonly PromotionRule[],
  now: Date,
): ProductPriceSummary {
  const active = variants.filter((v) => v.isActive);
  const results = (active.length ? active : [{ price: null, salePrice: null, isActive: true }]).map((v) =>
    resolvePrice(product, v, promotions, now),
  );
  let min = results[0];
  let max = results[0].final;
  for (const r of results) {
    if (r.final < min.final || (r.final === min.final && r.regular > min.regular)) min = r;
    if (r.final > max) max = r.final;
  }
  return {
    priceMin: min.final,
    priceMax: max,
    regularMin: min.regular,
    discountPercent: percentOff(min.regular, min.final),
  };
}

// ───────────────────────────── Промокоды ─────────────────────────────

export type PromoRule = {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  scope: "ALL" | "CATEGORIES" | "PRODUCTS";
  categoryIds: readonly string[];
  productIds: readonly string[];
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomer: number | null;
  excludeDiscounted: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export type PricedLine = {
  productId: string;
  /** Категории товара с родителями */
  categoryIds: readonly string[];
  regularUnit: number;
  finalUnit: number;
  quantity: number;
};

export type PromoFailure = "PROMO_EXPIRED" | "PROMO_MIN_AMOUNT" | "PROMO_LIMIT" | "PROMO_NOT_APPLICABLE";

export type PromoEvaluation =
  | { ok: true; discount: number; eligibleSubtotal: number }
  | { ok: false; code: PromoFailure; minOrderAmount?: number };

export function evaluatePromo(
  rule: PromoRule,
  lines: readonly PricedLine[],
  context: { now: Date; customerUses?: number | null },
): PromoEvaluation {
  if (!rule.isActive || !isActiveWindow(rule.startsAt, rule.endsAt, context.now)) return { ok: false, code: "PROMO_EXPIRED" };
  if (rule.maxUses !== null && rule.usedCount >= rule.maxUses) return { ok: false, code: "PROMO_LIMIT" };
  if (rule.maxUsesPerCustomer !== null && context.customerUses != null && context.customerUses >= rule.maxUsesPerCustomer) {
    return { ok: false, code: "PROMO_LIMIT" };
  }

  const itemsTotal = lines.reduce((sum, l) => sum + l.finalUnit * l.quantity, 0);
  if (rule.minOrderAmount !== null && itemsTotal < rule.minOrderAmount) {
    return { ok: false, code: "PROMO_MIN_AMOUNT", minOrderAmount: rule.minOrderAmount };
  }

  const eligible = lines.filter((line) => {
    if (rule.excludeDiscounted && line.finalUnit < line.regularUnit) return false;
    if (rule.scope === "CATEGORIES") return line.categoryIds.some((id) => rule.categoryIds.includes(id));
    if (rule.scope === "PRODUCTS") return rule.productIds.includes(line.productId);
    return true;
  });
  const eligibleSubtotal = eligible.reduce((sum, l) => sum + l.finalUnit * l.quantity, 0);
  if (eligibleSubtotal <= 0) return { ok: false, code: "PROMO_NOT_APPLICABLE" };

  const discount =
    rule.type === "PERCENT"
      ? Math.round((eligibleSubtotal * clamp(rule.value, 0, 100)) / 100)
      : Math.min(Math.max(0, rule.value), eligibleSubtotal);
  return { ok: true, discount, eligibleSubtotal };
}

// ───────────────────────────── Итоги корзины / заказа ─────────────────────────────

export type DeliveryPricing = { price: number; freeFrom: number | null };

export type Totals = {
  itemsCount: number;
  /** Сумма по обычным ценам */
  itemsRegular: number;
  /** Сумма по итоговым ценам (после акций) */
  itemsTotal: number;
  itemsDiscount: number;
  promoDiscount: number;
  deliveryPrice: number;
  deliveryFree: boolean;
  /** Сколько осталось до бесплатной доставки (null — порога нет) */
  freeDeliveryRemaining: number | null;
  total: number;
};

export function computeTotals(input: {
  lines: ReadonlyArray<Pick<PricedLine, "regularUnit" | "finalUnit" | "quantity">>;
  promoDiscount?: number;
  delivery?: DeliveryPricing | null;
}): Totals {
  let itemsCount = 0;
  let itemsRegular = 0;
  let itemsTotal = 0;
  for (const line of input.lines) {
    itemsCount += line.quantity;
    itemsRegular += line.regularUnit * line.quantity;
    itemsTotal += line.finalUnit * line.quantity;
  }
  const promoDiscount = Math.min(Math.max(0, input.promoDiscount ?? 0), itemsTotal);
  const delivery = input.delivery ?? null;
  // Порог бесплатной доставки считается от суммы товаров после акций (до промокода)
  const deliveryFree = delivery !== null && delivery.freeFrom !== null && itemsTotal >= delivery.freeFrom;
  const deliveryPrice = delivery === null || deliveryFree ? 0 : delivery.price;
  const freeDeliveryRemaining = delivery?.freeFrom != null ? Math.max(0, delivery.freeFrom - itemsTotal) : null;
  return {
    itemsCount,
    itemsRegular,
    itemsTotal,
    itemsDiscount: itemsRegular - itemsTotal,
    promoDiscount,
    deliveryPrice,
    deliveryFree: deliveryFree || (delivery !== null && delivery.price === 0),
    freeDeliveryRemaining,
    total: itemsTotal - promoDiscount + deliveryPrice,
  };
}
