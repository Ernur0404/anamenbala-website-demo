import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { listAdminProducts, PRODUCT_PAGE_SIZE, PRODUCT_SORTS, type ProductSort } from "@/server/admin/products";
import { getCategoryIndex } from "@/server/catalog/categories";
import { db } from "@/server/db";
import { PageHeader, Pagination, Panel } from "@/components/admin/ui";
import { ParamSelect, SearchInput } from "@/components/admin/controls";
import { param, pageParam, type SearchParams } from "@/components/admin/url";
import { buttonVariants } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media-url";
import type { ProductStatus } from "@/generated/prisma/enums";
import { ProductsTable, type ProductRow } from "./products-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.products");
  return { title: t("title") };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("products");
  const sp = await searchParams;
  const t = await getTranslations("admin.products");
  const tc = await getTranslations("admin.common");

  const statusParam = param(sp, "status");
  const status = ["PUBLISHED", "DRAFT", "HIDDEN"].includes(statusParam ?? "") ? (statusParam as ProductStatus) : undefined;
  const stockParam = param(sp, "stock");
  const stock = ["in", "low", "out"].includes(stockParam ?? "") ? (stockParam as "in" | "low" | "out") : undefined;
  const sortParam = param(sp, "sort");
  const sort = (PRODUCT_SORTS as readonly string[]).includes(sortParam ?? "") ? (sortParam as ProductSort) : "new";
  const page = pageParam(sp);

  const [{ rows, total, threshold }, index, brands] = await Promise.all([
    listAdminProducts({ q: param(sp, "q"), categoryId: param(sp, "category"), brandId: param(sp, "brand"), status, stock, sort }, page),
    getCategoryIndex(),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // дерево категорий для фильтра: «Для детей», «— Одежда»
  const categoryOptions = index.all
    .filter((c) => !c.parentId)
    .flatMap((root) => [
      { value: root.id, label: root.nameRu },
      ...index.all.filter((c) => c.parentId === root.id).map((c) => ({ value: c.id, label: `— ${c.nameRu}` })),
    ]);

  const data: ProductRow[] = rows.map((p) => {
    const minStock = p.variants.length ? Math.min(...p.variants.map((v) => v.stock)) : 0;
    return {
      id: p.id,
      slug: p.slug,
      name: p.nameRu,
      status: p.status,
      category: p.primaryCategory?.nameRu ?? p.categories[0]?.category.nameRu ?? null,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      regularMin: p.regularMin,
      discountPercent: p.discountPercent,
      totalStock: p.totalStock,
      variants: p.variants.length,
      stockState: !p.inStock ? (p.allowBackorder ? "backorder" : "out") : minStock <= threshold ? "low" : "in",
      imageUrl: mediaUrl(p.media[0]?.media, 320),
      isDemo: p.isDemo,
    };
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/admin/products/new" className={buttonVariants()}>
            <Plus />
            {t("add")}
          </Link>
        }
      />
      <Panel padded={false}>
        <div className="space-y-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_200px]">
            <SearchInput placeholder={t("searchPlaceholder")} />
            <ParamSelect param="category" allLabel={t("allCategories")} options={categoryOptions} />
            <ParamSelect
              param="status"
              allLabel={t("allStatuses")}
              options={(["PUBLISHED", "DRAFT", "HIDDEN"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:max-w-[720px]">
            <ParamSelect param="stock" allLabel={t("allStock")} options={(["in", "low", "out"] as const).map((s) => ({ value: s, label: t(`stockFilter.${s}`) }))} />
            {brands.length > 0 && <ParamSelect param="brand" allLabel={t("allBrands")} options={brands.map((b) => ({ value: b.id, label: b.name }))} />}
            <ParamSelect param="sort" allLabel={t("sort.new")} ariaLabel={tc("sort")} options={PRODUCT_SORTS.filter((s) => s !== "new").map((s) => ({ value: s, label: t(`sort.${s}`) }))} />
          </div>
        </div>
        <ProductsTable rows={data} empty={total === 0} filtered={Boolean(param(sp, "q") || status || stock || param(sp, "category") || param(sp, "brand"))} />
        <Pagination path="/admin/products" searchParams={sp} page={page} pageSize={PRODUCT_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
