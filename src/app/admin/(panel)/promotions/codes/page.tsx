import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { promoState } from "@/server/admin/promotions";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { saleDateKeys } from "../../products/_form/state";
import { PromoNav } from "../promo-nav";
import { CodesManager, type CodeRow } from "./codes-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.promotions");
  return { title: t("tabs.codes") };
}

export default async function PromoCodesPage() {
  await requireStaff("promotions");
  const t = await getTranslations("admin.promotions");
  const [codes, categories] = await Promise.all([
    db.promoCode.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        categories: { select: { categoryId: true, category: { select: { nameRu: true } } } },
        products: { select: { product: { select: { id: true, nameRu: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } } } } } },
      },
    }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }], select: { id: true, parentId: true, nameRu: true, nameKk: true, isVisible: true, sizeChartId: true, attributes: { select: { attributeId: true, isFilter: true, sortOrder: true } } } }),
  ]);
  const rows: CodeRow[] = codes.map((c) => {
    const dates = saleDateKeys(c.startsAt, c.endsAt);
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      scope: c.scope,
      categoryIds: c.categories.map((x) => x.categoryId),
      products: c.products.map((x) => ({ id: x.product.id, name: x.product.nameRu, imageUrl: mediaUrl(x.product.media[0]?.media, 320) })),
      targetNames: [...c.categories.map((x) => x.category.nameRu), ...c.products.map((x) => x.product.nameRu)],
      minOrderAmount: c.minOrderAmount,
      maxUses: c.maxUses,
      maxUsesPerCustomer: c.maxUsesPerCustomer,
      usedCount: c.usedCount,
      excludeDiscounted: c.excludeDiscounted,
      startsAt: dates.start,
      endsAt: dates.end,
      isActive: c.isActive,
      note: c.note ?? "",
      state: promoState(c),
    };
  });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <PromoNav active="codes" />
      <CodesManager rows={rows} categories={categories} />
    </>
  );
}
