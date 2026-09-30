import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader, Panel } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { CatalogNav } from "../catalog-nav";
import { BrandsList } from "./brands-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("tabs.brands") };
}

export default async function BrandsPage() {
  await requireStaff("catalog");
  const t = await getTranslations("admin.catalog");
  const brands = await db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { logo: { select: mediaSelect }, _count: { select: { products: true } } } });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CatalogNav active="brands" />
      <Panel padded={false}>
        <BrandsList brands={brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, isVisible: b.isVisible, logo: b.logo ? { id: b.logo.id, url: mediaUrl(b.logo, 320) } : null, products: b._count.products }))} />
      </Panel>
    </>
  );
}
