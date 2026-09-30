import type { ProductForEdit } from "@/server/admin/products";
import { mediaUrl } from "@/lib/media-url";
import { defaultSkuBase, newKey, saleDateKeys, type ProductFormState } from "./state";

/** Товар из базы → состояние формы (на сервере) */
export function productToFormState(p: ProductForEdit, finance: boolean): ProductFormState {
  const sale = saleDateKeys(p.saleStartsAt, p.saleEndsAt);
  const optionAttributeIds = p.options.map((o) => o.attributeId);
  const axisValues: Record<string, string[]> = {};
  for (const attributeId of optionAttributeIds) {
    const ids = new Set<string>();
    for (const v of p.variants) for (const ov of v.optionValues) if (ov.attributeId === attributeId) ids.add(ov.attributeValueId);
    axisValues[attributeId] = [...ids];
  }
  const firstSku = p.variants[0]?.sku ?? "";
  return {
    id: p.id,
    status: p.status,
    nameRu: p.nameRu,
    nameKk: p.nameKk ?? "",
    subtitleRu: p.subtitleRu ?? "",
    subtitleKk: p.subtitleKk ?? "",
    slug: p.slug,
    brandId: p.brandId ?? "",
    descriptionRu: p.descriptionRu ?? "",
    descriptionKk: p.descriptionKk ?? "",
    price: String(p.price),
    salePrice: p.salePrice != null ? String(p.salePrice) : "",
    saleStartsAt: sale.start,
    saleEndsAt: sale.end,
    costPrice: finance && p.costPrice != null ? String(p.costPrice) : "",
    allowBackorder: p.allowBackorder,
    backorderNoteRu: p.backorderNoteRu ?? "",
    backorderNoteKk: p.backorderNoteKk ?? "",
    videoMediaId: p.videoMediaId,
    videoFileUrl: mediaUrl(p.videoMedia),
    videoUrl: p.videoUrl ?? "",
    sizeChartId: p.sizeChartId ?? "",
    seoTitleRu: p.seoTitleRu ?? "",
    seoTitleKk: p.seoTitleKk ?? "",
    seoDescriptionRu: p.seoDescriptionRu ?? "",
    seoDescriptionKk: p.seoDescriptionKk ?? "",
    categoryIds: p.categories.map((c) => c.categoryId),
    primaryCategoryId: p.primaryCategoryId ?? "",
    badgeIds: p.badges.map((b) => b.badgeId),
    attributeValueIds: p.attributeValues.map((a) => a.attributeValueId),
    specs: p.specs.map((s) => ({ key: s.id, labelRu: s.labelRu, labelKk: s.labelKk ?? "", valueRu: s.valueRu, valueKk: s.valueKk ?? "" })),
    hasVariants: optionAttributeIds.length > 0,
    optionAttributeIds,
    axisValues,
    variants: p.variants.map((v) => ({
      key: v.id || newKey("v"),
      id: v.id,
      optionValueIds: optionAttributeIds.map((a) => v.optionValues.find((o) => o.attributeId === a)?.attributeValueId ?? ""),
      sku: v.sku,
      barcode: v.barcode ?? "",
      price: v.price != null ? String(v.price) : "",
      costPrice: finance && v.costPrice != null ? String(v.costPrice) : "",
      stock: String(v.stock),
      isActive: v.isActive,
      hasOrders: v._count.orderItems > 0,
    })),
    skuBase: optionAttributeIds.length ? firstSku.split("-").slice(0, -optionAttributeIds.length).join("-") || defaultSkuBase(p.nameRu) : firstSku,
    media: p.media.map((m) => ({ mediaId: m.mediaId, url: mediaUrl(m.media, 320), colorValueId: m.colorValueId })),
  };
}
