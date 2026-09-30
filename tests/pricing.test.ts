import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  computeTotals,
  evaluatePromo,
  resolvePrice,
  summarizeProductPrice,
  type PricingProduct,
  type PromoRule,
  type PromotionRule,
} from "@/server/pricing/engine";

const now = new Date("2026-10-01T10:00:00Z");
const day = 86_400_000;

const product = (over: Partial<PricingProduct> = {}): PricingProduct => ({
  id: "p1",
  price: 10_000,
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
  brandId: "b1",
  categoryIds: ["kids", "kids-clothes"],
  ...over,
});

const promo = (over: Partial<PromotionRule> = {}): PromotionRule => ({
  id: "promo1",
  type: "PERCENT",
  value: 20,
  scope: "CATEGORY",
  categoryIds: ["kids"],
  brandIds: [],
  productIds: [],
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...over,
});

describe("resolvePrice", () => {
  it("обычная цена без акций", () => {
    const r = resolvePrice(product(), { price: null, salePrice: null }, [], now);
    expect(r).toMatchObject({ regular: 10_000, final: 10_000, discountPercent: 0, source: "regular" });
  });

  it("акционная цена действует только в свой период", () => {
    const p = product({ salePrice: 7_000, saleStartsAt: new Date(now.getTime() - day), saleEndsAt: new Date(now.getTime() + day) });
    expect(resolvePrice(p, { price: null, salePrice: null }, [], now)).toMatchObject({ final: 7_000, discountPercent: 30, source: "sale" });
    const expired = product({ salePrice: 7_000, saleEndsAt: new Date(now.getTime() - 1) });
    expect(resolvePrice(expired, { price: null, salePrice: null }, [], now).final).toBe(10_000);
    const future = product({ salePrice: 7_000, saleStartsAt: new Date(now.getTime() + 1) });
    expect(resolvePrice(future, { price: null, salePrice: null }, [], now).final).toBe(10_000);
  });

  it("акционная цена товара не применяется к варианту со своей ценой", () => {
    const p = product({ salePrice: 7_000 });
    expect(resolvePrice(p, { price: 12_000, salePrice: null }, [], now).final).toBe(12_000);
    expect(resolvePrice(p, { price: 12_000, salePrice: 9_000 }, [], now).final).toBe(9_000);
  });

  it("акционная цена выше обычной игнорируется", () => {
    expect(resolvePrice(product({ salePrice: 12_000 }), { price: null, salePrice: null }, [], now).final).toBe(10_000);
  });

  it("скидка на родительскую категорию действует на товары подкатегории", () => {
    const r = resolvePrice(product(), { price: null, salePrice: null }, [promo()], now);
    expect(r).toMatchObject({ final: 8_000, source: "promotion", promotionId: "promo1", discountPercent: 20 });
  });

  it("скидки не суммируются — берётся лучшая", () => {
    const p = product({ salePrice: 7_500 });
    const r = resolvePrice(p, { price: null, salePrice: null }, [promo({ value: 20 }), promo({ id: "brand", scope: "BRAND", brandIds: ["b1"], value: 15 })], now);
    expect(r.final).toBe(7_500);
    expect(r.source).toBe("sale");
    const r2 = resolvePrice(p, { price: null, salePrice: null }, [promo({ value: 30 })], now);
    expect(r2.final).toBe(7_000);
  });

  it("неактивные и чужие скидки не применяются", () => {
    const rules = [
      promo({ isActive: false }),
      promo({ id: "other-cat", categoryIds: ["home"] }),
      promo({ id: "other-brand", scope: "BRAND", brandIds: ["b2"] }),
      promo({ id: "ended", endsAt: new Date(now.getTime() - 1) }),
    ];
    expect(resolvePrice(product(), { price: null, salePrice: null }, rules, now).final).toBe(10_000);
  });

  it("фиксированная скидка не уводит цену в минус", () => {
    expect(applyDiscount(1_000, "FIXED", 5_000)).toBe(0);
    expect(applyDiscount(9_990, "PERCENT", 15)).toBe(8_492);
  });
});

describe("summarizeProductPrice", () => {
  it("минимальная цена и «старая цена» того же варианта", () => {
    const p = product({ salePrice: 8_000 });
    const s = summarizeProductPrice(
      p,
      [
        { price: null, salePrice: null, isActive: true },
        { price: 12_000, salePrice: null, isActive: true },
        { price: 5_000, salePrice: null, isActive: false },
      ],
      [],
      now,
    );
    expect(s).toEqual({ priceMin: 8_000, priceMax: 12_000, regularMin: 10_000, discountPercent: 20 });
  });
});

const promoCode = (over: Partial<PromoRule> = {}): PromoRule => ({
  id: "pc1",
  code: "MAMA10",
  type: "PERCENT",
  value: 10,
  scope: "ALL",
  categoryIds: [],
  productIds: [],
  minOrderAmount: null,
  maxUses: null,
  usedCount: 0,
  maxUsesPerCustomer: null,
  excludeDiscounted: false,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...over,
});

const lines = [
  { productId: "p1", categoryIds: ["kids"], regularUnit: 10_000, finalUnit: 10_000, quantity: 2 },
  { productId: "p2", categoryIds: ["home"], regularUnit: 6_000, finalUnit: 4_000, quantity: 1 },
];

describe("evaluatePromo", () => {
  it("процент от всей корзины", () => {
    expect(evaluatePromo(promoCode(), lines, { now })).toEqual({ ok: true, discount: 2_400, eligibleSubtotal: 24_000 });
  });

  it("фиксированная сумма не больше подходящих товаров", () => {
    const r = evaluatePromo(promoCode({ type: "FIXED", value: 50_000 }), lines, { now });
    expect(r).toEqual({ ok: true, discount: 24_000, eligibleSubtotal: 24_000 });
  });

  it("только категории и без товаров со скидкой", () => {
    expect(evaluatePromo(promoCode({ scope: "CATEGORIES", categoryIds: ["home"] }), lines, { now })).toMatchObject({ ok: true, discount: 400 });
    expect(evaluatePromo(promoCode({ scope: "CATEGORIES", categoryIds: ["home"], excludeDiscounted: true }), lines, { now })).toEqual({
      ok: false,
      code: "PROMO_NOT_APPLICABLE",
    });
    expect(evaluatePromo(promoCode({ excludeDiscounted: true }), lines, { now })).toMatchObject({ ok: true, eligibleSubtotal: 20_000, discount: 2_000 });
  });

  it("лимиты, сроки и минимальная сумма", () => {
    expect(evaluatePromo(promoCode({ maxUses: 5, usedCount: 5 }), lines, { now })).toEqual({ ok: false, code: "PROMO_LIMIT" });
    expect(evaluatePromo(promoCode({ maxUsesPerCustomer: 1 }), lines, { now, customerUses: 1 })).toEqual({ ok: false, code: "PROMO_LIMIT" });
    expect(evaluatePromo(promoCode({ endsAt: new Date(now.getTime() - 1) }), lines, { now })).toEqual({ ok: false, code: "PROMO_EXPIRED" });
    expect(evaluatePromo(promoCode({ isActive: false }), lines, { now })).toEqual({ ok: false, code: "PROMO_EXPIRED" });
    expect(evaluatePromo(promoCode({ minOrderAmount: 30_000 }), lines, { now })).toEqual({ ok: false, code: "PROMO_MIN_AMOUNT", minOrderAmount: 30_000 });
  });
});

describe("computeTotals", () => {
  const priced = lines.map(({ regularUnit, finalUnit, quantity }) => ({ regularUnit, finalUnit, quantity }));

  it("сумма, скидки и доставка", () => {
    const t = computeTotals({ lines: priced, promoDiscount: 1_000, delivery: { price: 1_500, freeFrom: 30_000 } });
    expect(t).toEqual({
      itemsCount: 3,
      itemsRegular: 26_000,
      itemsTotal: 24_000,
      itemsDiscount: 2_000,
      promoDiscount: 1_000,
      deliveryPrice: 1_500,
      deliveryFree: false,
      freeDeliveryRemaining: 6_000,
      total: 24_500,
    });
  });

  it("бесплатная доставка от суммы товаров после акций", () => {
    const t = computeTotals({ lines: priced, delivery: { price: 1_500, freeFrom: 24_000 } });
    expect(t.deliveryPrice).toBe(0);
    expect(t.deliveryFree).toBe(true);
    expect(t.total).toBe(24_000);
  });

  it("без способа доставки доставка не считается", () => {
    expect(computeTotals({ lines: priced }).deliveryPrice).toBe(0);
  });
});
