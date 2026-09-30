import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { PackageSearch } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ProductGrid } from "../product-card";
import { EmptyState } from "@/components/ui/display";
import { FiltersPanel, MobileFilters, type FiltersProps } from "./filters";
import { CategorySearch, SortSelect } from "./toolbar";
import { Pagination } from "./pagination";
import type { Listing } from "@/server/catalog/listing";

export async function CatalogView({
  title,
  listing,
  searchParams,
  sidebarTop,
  sidebarBottom,
  aboveGrid,
  categoryFacet,
  showDiscount,
  showCategorySearch = true,
}: {
  title: string;
  listing: Listing;
  searchParams: Record<string, string | string[] | undefined>;
  sidebarTop?: ReactNode;
  sidebarBottom?: ReactNode;
  aboveGrid?: ReactNode;
  categoryFacet?: FiltersProps["categoryFacet"];
  showDiscount?: boolean;
  showCategorySearch?: boolean;
}) {
  const t = await getTranslations("listing");
  const filterProps: FiltersProps = {
    facets: listing.facets,
    brands: listing.brands,
    priceRange: listing.priceRange,
    categoryFacet,
    showDiscount,
    total: listing.total,
  };

  return (
    <div className="container-page mt-6 sm:mt-8">
      {aboveGrid}
      <div className="grid gap-8 lg:grid-cols-[252px_1fr]">
        <aside className="hidden lg:block">
          <div className="space-y-6">
            {sidebarTop}
            <div>
              <h2 className="mb-4 text-base font-bold">{t("filters")}</h2>
              <FiltersPanel {...filterProps} />
            </div>
            {sidebarBottom}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="heading-section text-[28px] sm:text-[32px]">{title}</h2>
              <p className="mt-0.5 text-sm text-ink-500">{t("products", { count: listing.total })}</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <MobileFilters {...filterProps} />
              {showCategorySearch && <CategorySearch className="hidden w-60 md:block" />}
              <SortSelect className="ml-auto sm:ml-0" />
            </div>
          </div>

          {listing.items.length ? (
            <>
              <ProductGrid products={listing.items} />
              <Pagination page={listing.page} pages={listing.pages} searchParams={searchParams} />
            </>
          ) : (
            <EmptyState
              icon={<PackageSearch />}
              title={t("noResults")}
              text={t("noResultsText")}
              action={
                <Link href="/catalog" className="inline-flex h-11 items-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
                  {t("allProducts")}
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
