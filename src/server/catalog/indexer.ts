/**
 * Денормализованные поля товара: цены для сортировки/фильтров, наличие, строка поиска, фасеты фильтров.
 * Вызывается после любого изменения товара, остатков, акций и по расписанию (начало/конец акций).
 */
import { db, type DbClient } from "../db";
import { getCategoryIndex, withAncestors } from "./categories";
import { getPromotionRules, toPricingProduct } from "../pricing/context";
import { summarizeProductPrice } from "../pricing/engine";
import { buildSearchText } from "@/lib/search";

const productForIndex = {
  id: true,
  nameRu: true,
  nameKk: true,
  subtitleRu: true,
  subtitleKk: true,
  price: true,
  salePrice: true,
  saleStartsAt: true,
  saleEndsAt: true,
  brandId: true,
  priceMin: true,
  priceMax: true,
  regularMin: true,
  discountPercent: true,
  inStock: true,
  totalStock: true,
  searchText: true,
  brand: { select: { name: true } },
  categories: { select: { categoryId: true } },
  attributeValues: { select: { attributeValueId: true, attributeValue: { select: { valueRu: true, valueKk: true } } } },
  variants: {
    select: {
      sku: true,
      barcode: true,
      price: true,
      salePrice: true,
      stock: true,
      isActive: true,
      optionValues: { select: { attributeValueId: true, attributeValue: { select: { valueRu: true, valueKk: true } } } },
    },
  },
} as const;

export async function refreshProductIndex(productIds: readonly string[], client: DbClient = db, now = new Date()) {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return;
  const [rules, index] = await Promise.all([getPromotionRules(), getCategoryIndex()]);
  const products = await client.product.findMany({ where: { id: { in: ids } }, select: productForIndex });

  for (const product of products) {
    const pricing = summarizeProductPrice(toPricingProduct(product, index), product.variants, rules, now);
    const active = product.variants.filter((v) => v.isActive);
    const totalStock = active.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
    const inStock = active.some((v) => v.stock > 0);

    const facetIds = new Set<string>(product.attributeValues.map((a) => a.attributeValueId));
    for (const v of active) for (const o of v.optionValues) facetIds.add(o.attributeValueId);

    const categoryNames = withAncestors(
      index,
      product.categories.map((c) => c.categoryId),
    ).flatMap((id) => {
      const c = index.byId.get(id);
      return c ? [c.nameRu, c.nameKk] : [];
    });
    const searchText = buildSearchText([
      product.nameRu,
      product.nameKk,
      product.subtitleRu,
      product.subtitleKk,
      product.brand?.name,
      ...categoryNames,
      ...product.attributeValues.flatMap((a) => [a.attributeValue.valueRu, a.attributeValue.valueKk]),
      ...product.variants.flatMap((v) => [v.sku, v.barcode, ...v.optionValues.flatMap((o) => [o.attributeValue.valueRu, o.attributeValue.valueKk])]),
    ]);

    await client.product.update({
      where: { id: product.id },
      data: { ...pricing, totalStock, inStock, searchText },
    });
    await client.productFacet.deleteMany({ where: { productId: product.id } });
    if (facetIds.size) {
      await client.productFacet.createMany({
        data: [...facetIds].map((attributeValueId) => ({ productId: product.id, attributeValueId })),
        skipDuplicates: true,
      });
    }
  }
}

/**
 * Пересчёт цен всех товаров (начало/окончание акций, изменение скидок).
 * Обновляет только те товары, у которых что-то изменилось.
 */
export async function repriceAllProducts(now = new Date()): Promise<number> {
  const [rules, index] = await Promise.all([getPromotionRules(), getCategoryIndex()]);
  let changed = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.product.findMany({
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: productForIndex,
    });
    if (!batch.length) break;
    for (const product of batch) {
      const pricing = summarizeProductPrice(toPricingProduct(product, index), product.variants, rules, now);
      if (
        pricing.priceMin !== product.priceMin ||
        pricing.priceMax !== product.priceMax ||
        pricing.regularMin !== product.regularMin ||
        pricing.discountPercent !== product.discountPercent
      ) {
        await db.product.update({ where: { id: product.id }, data: pricing });
        changed++;
      }
    }
    cursor = batch[batch.length - 1].id;
  }
  return changed;
}

/** Полная переиндексация (после импорта, изменения категорий) */
export async function reindexAllProducts() {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.product.findMany({
      take: 100,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!batch.length) break;
    await refreshProductIndex(batch.map((p) => p.id));
    cursor = batch[batch.length - 1].id;
  }
}

/** Пересчёт рейтинга товара по одобренным отзывам */
export async function refreshProductRating(productId: string, client: DbClient = db) {
  const agg = await client.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await client.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all },
  });
}
