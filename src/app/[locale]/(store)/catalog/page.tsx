import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCategoryIndex } from "@/server/catalog/categories";
import { listProducts, parseListingSearchParams } from "@/server/catalog/listing";
import { sidebarItems } from "@/server/catalog/navigation";
import { getFreeDeliveryThreshold, getPageHero } from "@/server/content";
import { PageHero } from "@/components/store/page-hero";
import { CatalogView } from "@/components/store/catalog/catalog-view";
import { SidebarCategories, SidebarPromo } from "@/components/store/catalog/sidebar";
import { BrandStrip, CategoryListCards, MobilePills } from "@/components/store/catalog/mobile-blocks";
import { SearchBox } from "@/components/store/search-box";
import { getBrandTiles, getRootCategoryCards, getSaleOverview } from "@/server/catalog/landing";
import type { Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const hero = await getPageHero("catalog", locale as Locale);
  return { title: hero?.title ?? "Каталог", description: hero?.subtitle ?? undefined, alternates: { canonical: locale === "kk" ? "/kk/catalog" : "/catalog" } };
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const sp = await searchParams;
  const parsed = parseListingSearchParams(sp);
  const t = await getTranslations();

  const [hero, index, listing, threshold, sale, saleHero] = await Promise.all([
    getPageHero("catalog", locale),
    getCategoryIndex(),
    listProducts({ locale, search: parsed.q, filters: parsed.filters, brands: parsed.brands, priceFrom: parsed.priceFrom, priceTo: parsed.priceTo, availability: parsed.availability, sort: parsed.sort, page: parsed.page }),
    getFreeDeliveryThreshold(),
    getSaleOverview(),
    getPageHero("sale", locale),
  ]);

  // мобильная версия (по мобильному макету): разделы карточками, бренды, фильтры списком
  const [cards, brandTiles] = await Promise.all([getRootCategoryCards(locale, listing.categoryCounts), getBrandTiles(listing.brands.map((b) => b.slug))]);
  const pills = [{ key: "all", label: t("nav.allProducts"), href: "/catalog", active: true }, ...cards.map((c) => ({ key: c.key, label: c.name, href: c.href, active: false }))];
  const saleCard =
    sale.count > 0
      ? { key: "sale", name: t("nav.sale"), href: "/sale", description: saleHero?.subtitle ?? t("landing.saleCard"), image: saleHero?.image ?? null, count: sale.count }
      : null;

  return (
    <>
      <PageHero
        title={hero?.title ?? t("nav.catalog")}
        subtitle={hero?.subtitle}
        script={hero?.script}
        image={hero?.image}
        breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: hero?.title ?? t("nav.catalog") }]}
      />
      <div className="container-page mt-2 space-y-5 lg:hidden">
        <SearchBox />
        <MobilePills items={pills} />
        <CategoryListCards cards={saleCard ? [...cards, saleCard] : cards} countLabel={(count) => t("listing.products", { count })} accentKey="sale" />
        <BrandStrip title={t("landing.popularBrands")} brands={brandTiles} />
      </div>
      <CatalogView
        title={t("listing.allProducts")}
        listing={listing}
        searchParams={sp}
        inlineFilters
        belowGrid={<SidebarPromo variant="delivery" threshold={threshold} />}
        sidebarTop={<SidebarCategories items={sidebarItems(index, locale, null, { all: t("nav.allCategories"), sale: t("nav.sale") })} />}
        sidebarBottom={<SidebarPromo variant="delivery" threshold={threshold} />}
      />
    </>
  );
}
