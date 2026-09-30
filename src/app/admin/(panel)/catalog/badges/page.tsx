import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CatalogNav } from "../catalog-nav";
import { BadgesList } from "./badges-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("tabs.badges") };
}

export default async function BadgesPage() {
  await requireStaff("catalog");
  const t = await getTranslations("admin.catalog");
  const badges = await db.badge.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CatalogNav active="badges" />
      <Panel padded={false}>
        <BadgesList badges={badges.map((b) => ({ id: b.id, code: b.code, nameRu: b.nameRu, nameKk: b.nameKk ?? "", style: b.style, isActive: b.isActive, products: b._count.products }))} />
      </Panel>
    </>
  );
}
