import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { promoState } from "@/server/admin/promotions";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { saleDateKeys } from "../products/_form/state";
import { PromoNav } from "./promo-nav";
import { PromotionsManager, type PromotionRow } from "./promotions-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.promotions");
  return { title: t("title") };
}

export default async function PromotionsPage() {
  await requireStaff("promotions");
  const t = await getTranslations("admin.promotions");
  const [promotions, categories, brands] = await Promise.all([
    db.promotion.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        categories: { select: { categoryId: true, category: { select: { nameRu: true } } } },
        brands: { select: { brandId: true, brand: { select: { name: true } } } },
        products: { select: { product: { select: { id: true, nameRu: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } } } } } },
      },
    }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }], select: { id: true, parentId: true, nameRu: true, nameKk: true, isVisible: true, sizeChartId: true, attributes: { select: { attributeId: true, isFilter: true, sortOrder: true } } } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: PromotionRow[] = promotions.map((p) => {
    const dates = saleDateKeys(p.startsAt, p.endsAt);
    return {
      id: p.id,
      nameRu: p.nameRu,
      nameKk: p.nameKk ?? "",
      type: p.type,
      value: p.value,
      scope: p.scope,
      categoryIds: p.categories.map((c) => c.categoryId),
      brandIds: p.brands.map((b) => b.brandId),
      products: p.products.map((x) => ({ id: x.product.id, name: x.product.nameRu, imageUrl: mediaUrl(x.product.media[0]?.media, 320) })),
      targetNames: [...p.categories.map((c) => c.category.nameRu), ...p.brands.map((b) => b.brand.name), ...p.products.map((x) => x.product.nameRu)],
      startsAt: dates.start,
      endsAt: dates.end,
      isActive: p.isActive,
      state: promoState(p),
    };
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <PromoNav active="promotions" />
      <PromotionsManager rows={rows} categories={categories} brands={brands} />
    </>
  );
}
