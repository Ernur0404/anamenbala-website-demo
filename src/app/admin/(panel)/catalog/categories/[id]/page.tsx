import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect, type MediaRef } from "@/server/media/refs";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { CategoryForm, type CategoryFormData } from "./category-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("admin.catalog");
  if (id === "new") return { title: t("newCategory") };
  const c = await db.category.findUnique({ where: { id }, select: { nameRu: true } });
  return { title: c ? t("editCategory", { name: c.nameRu }) : t("title") };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ parent?: string }> }) {
  await requireStaff("catalog");
  const { id } = await params;
  const { parent } = await searchParams;
  const t = await getTranslations("admin.catalog");

  const [roots, attributes, sizeCharts, category] = await Promise.all([
    db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, select: { id: true, nameRu: true, attributes: { select: { attributeId: true } } } }),
    db.attribute.findMany({ orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }], select: { id: true, nameRu: true, code: true, isVariantAxis: true, _count: { select: { values: true } } } }),
    db.sizeChart.findMany({ orderBy: { nameRu: "asc" }, select: { id: true, nameRu: true } }),
    id === "new"
      ? null
      : db.category.findUnique({
          where: { id },
          include: {
            heroImage: { select: mediaSelect },
            heroMobileImage: { select: mediaSelect },
            tileImage: { select: mediaSelect },
            attributes: { orderBy: { sortOrder: "asc" }, select: { attributeId: true, isFilter: true } },
            _count: { select: { children: true, products: true } },
          },
        }),
  ]);
  if (id !== "new" && !category) notFound();

  const img = (m: MediaRef | null) => (m ? { id: m.id, url: mediaUrl(m, 960) } : null);
  const data: CategoryFormData = category
    ? {
        id: category.id,
        parentId: category.parentId ?? "",
        nameRu: category.nameRu,
        nameKk: category.nameKk ?? "",
        slug: category.slug,
        descriptionRu: category.descriptionRu ?? "",
        descriptionKk: category.descriptionKk ?? "",
        heroTitleRu: category.heroTitleRu ?? "",
        heroTitleKk: category.heroTitleKk ?? "",
        heroTextRu: category.heroTextRu ?? "",
        heroTextKk: category.heroTextKk ?? "",
        heroScriptRu: category.heroScriptRu ?? "",
        heroScriptKk: category.heroScriptKk ?? "",
        heroImage: img(category.heroImage),
        heroMobileImage: img(category.heroMobileImage),
        tileImage: img(category.tileImage),
        icon: category.icon ?? "",
        sizeChartId: category.sizeChartId ?? "",
        isVisible: category.isVisible,
        showInMenu: category.showInMenu,
        seoTitleRu: category.seoTitleRu ?? "",
        seoTitleKk: category.seoTitleKk ?? "",
        seoDescriptionRu: category.seoDescriptionRu ?? "",
        seoDescriptionKk: category.seoDescriptionKk ?? "",
        attributes: category.attributes,
        hasChildren: category._count.children > 0,
        products: category._count.products,
      }
    : {
        id: null,
        parentId: parent && roots.some((r) => r.id === parent) ? parent : "",
        nameRu: "",
        nameKk: "",
        slug: "",
        descriptionRu: "",
        descriptionKk: "",
        heroTitleRu: "",
        heroTitleKk: "",
        heroTextRu: "",
        heroTextKk: "",
        heroScriptRu: "",
        heroScriptKk: "",
        heroImage: null,
        heroMobileImage: null,
        tileImage: null,
        icon: "",
        sizeChartId: "",
        isVisible: true,
        showInMenu: true,
        seoTitleRu: "",
        seoTitleKk: "",
        seoDescriptionRu: "",
        seoDescriptionKk: "",
        attributes: [],
        hasChildren: false,
        products: 0,
      };

  return (
    <>
      <PageHeader back={{ href: "/admin/catalog", label: t("title") }} title={category ? category.nameRu : t("newCategory")} />
      <CategoryForm
        key={category?.updatedAt.toISOString() ?? "new"}
        initial={data}
        roots={roots.filter((r) => r.id !== category?.id).map((r) => ({ id: r.id, name: r.nameRu, attributeIds: r.attributes.map((a) => a.attributeId) }))}
        attributes={attributes.map((a) => ({ id: a.id, name: a.nameRu, code: a.code, isVariantAxis: a.isVariantAxis, values: a._count.values }))}
        sizeCharts={sizeCharts}
      />
    </>
  );
}
