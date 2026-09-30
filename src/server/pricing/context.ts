import { db } from "../db";
import { cached, CacheTags } from "../cache";
import { getCategoryIndex, withAncestors, type CategoryIndex } from "../catalog/categories";
import type { PricingProduct, PromotionRule } from "./engine";

/** Активные автоматические скидки (период проверяется в момент расчёта) */
export function getPromotionRules(): Promise<PromotionRule[]> {
  return cached("promotions:rules", [CacheTags.promotions], 10 * 60_000, async () => {
    const rows = await db.promotion.findMany({
      where: { isActive: true },
      select: {
        id: true,
        type: true,
        value: true,
        scope: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
        categories: { select: { categoryId: true } },
        brands: { select: { brandId: true } },
        products: { select: { productId: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      value: r.value,
      scope: r.scope,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      isActive: r.isActive,
      categoryIds: r.categories.map((c) => c.categoryId),
      brandIds: r.brands.map((b) => b.brandId),
      productIds: r.products.map((p) => p.productId),
    }));
  });
}

export type PricingSource = {
  id: string;
  price: number;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  brandId: string | null;
  categories: { categoryId: string }[];
};

export function toPricingProduct(product: PricingSource, index: CategoryIndex): PricingProduct {
  return {
    id: product.id,
    price: product.price,
    salePrice: product.salePrice,
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
    brandId: product.brandId,
    categoryIds: withAncestors(
      index,
      product.categories.map((c) => c.categoryId),
    ),
  };
}

export async function getPricingContext() {
  const [promotions, categoryIndex] = await Promise.all([getPromotionRules(), getCategoryIndex()]);
  return { promotions, categoryIndex, now: new Date() };
}

export type PricingContext = Awaited<ReturnType<typeof getPricingContext>>;
