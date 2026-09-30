import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader, Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media-url";
import { CatalogNav } from "./catalog-nav";
import { CategoryRow, type CategoryRowData } from "./category-row";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("title") };
}

export default async function CatalogPage() {
  await requireStaff("catalog");
  const t = await getTranslations("admin.catalog");
  const [categories, counts] = await Promise.all([
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
      select: { id: true, parentId: true, nameRu: true, nameKk: true, slug: true, icon: true, isVisible: true, showInMenu: true, tileImage: { select: mediaSelect } },
    }),
    db.productCategory.groupBy({ by: ["categoryId"], _count: { _all: true } }),
  ]);
  const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  const roots = categories.filter((c) => !c.parentId);
  // у раздела верхнего уровня — уникальные товары вместе с подкатегориями
  const rootTotals = await Promise.all(
    roots.map((root) =>
      db.product.count({ where: { categories: { some: { categoryId: { in: [root.id, ...categories.filter((c) => c.parentId === root.id).map((c) => c.id)] } } } } }),
    ),
  );
  roots.forEach((root, i) => countBy.set(root.id, rootTotals[i]));
  const row = (c: (typeof categories)[number], index: number, siblings: number): CategoryRowData => ({
    id: c.id,
    parentId: c.parentId,
    name: c.nameRu,
    nameKk: c.nameKk,
    slug: c.slug,
    icon: c.icon,
    isVisible: c.isVisible,
    showInMenu: c.showInMenu,
    imageUrl: mediaUrl(c.tileImage, 320),
    products: countBy.get(c.id) ?? 0,
    first: index === 0,
    last: index === siblings - 1,
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CatalogNav
        active="categories"
        actions={
          <Link href="/admin/catalog/categories/new" className={buttonVariants({ size: "sm" })}>
            <Plus />
            {t("addCategory")}
          </Link>
        }
      />
      <Panel padded={false}>
        {roots.length === 0 && <p className="px-6 py-12 text-center text-sm text-ink-500">{t("emptyCategories")}</p>}
        <ul className="divide-y divide-line">
          {roots.map((root, i) => {
            const children = categories.filter((c) => c.parentId === root.id);
            return (
              <li key={root.id}>
                <CategoryRow data={row(root, i, roots.length)} />
                {children.length > 0 && (
                  <ul className="divide-y divide-line border-t border-line bg-cream/40">
                    {children.map((child, j) => (
                      <li key={child.id}>
                        <CategoryRow data={row(child, j, children.length)} nested />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
