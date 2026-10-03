import type { Metadata } from "next";
import { after } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchX } from "lucide-react";
import { db } from "@/server/db";
import { getCategoryIndex } from "@/server/catalog/categories";
import { listProducts, parseListingSearchParams } from "@/server/catalog/listing";
import { getFreeDeliveryThreshold, getPageHero, getSectionProducts } from "@/server/content";
import { getPopularQueries } from "@/server/search-log";
import { PageHero } from "@/components/store/page-hero";
import { CatalogView } from "@/components/store/catalog/catalog-view";
import { SidebarPromo } from "@/components/store/catalog/sidebar";
import { ProductsSection } from "@/components/store/home/sections";
import { EmptyState } from "@/components/ui/display";
import { Link } from "@/i18n/navigation";
import { normalizeSearch } from "@/lib/search";
import { tr, type Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `«${q.slice(0, 60)}»` : "Поиск", robots: { index: false } };
}

function PopularQueries({ title, queries }: { title: string; queries: string[] }) {
  if (!queries.length) return null;
  return (
    <section className="container-page mt-10">
      <h2 className="heading-section mb-4 text-[26px]">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {queries.map((q) => (
          <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="rounded-full border border-line-strong bg-white px-4 py-2 text-sm transition-colors hover:border-sage-500 hover:text-sage-700">
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const sp = await searchParams;
  const parsed = parseListingSearchParams(sp);
  const t = await getTranslations();
  const query = parsed.q?.trim() ?? "";
  const [hero, index, threshold, popularQueries] = await Promise.all([getPageHero("search", locale), getCategoryIndex(), getFreeDeliveryThreshold(), getPopularQueries(8)]);

  const catSlugs = typeof sp.cat === "string" ? sp.cat.split(",").filter(Boolean) : [];
  const categoryIds = catSlugs.map((s) => index.bySlug.get(s)?.id).filter((id): id is string => Boolean(id));

  if (!query) {
    const popular = await getSectionProducts({ source: "popular", limit: 8 }, locale);
    return (
      <>
        <PageHero title={hero?.title ?? t("search.nothingTitle")} script={hero?.script} image={hero?.image} breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("common.search") }]} compact />
        <div className="container-page mt-4 lg:mt-8">
          <EmptyState icon={<SearchX />} title={t("search.emptyQuery")} />
        </div>
        <PopularQueries title={t("search.popular")} queries={popularQueries} />
        <ProductsSection title={t("search.popularProducts")} href="/catalog" products={popular} viewAll={t("common.viewAll")} />
      </>
    );
  }

  const listing = await listProducts({
    locale,
    search: query,
    categoryIds,
    filters: parsed.filters,
    brands: parsed.brands,
    priceFrom: parsed.priceFrom,
    priceTo: parsed.priceTo,
    availability: parsed.availability,
    sort: parsed.sort,
    page: parsed.page,
  });

  after(async () => {
    await db.searchLog.create({ data: { query: query.slice(0, 100), normalized: normalizeSearch(query).slice(0, 100), resultsCount: listing.total } }).catch(() => {});
  });

  const categoryFacet = index.all
    .filter((c) => (listing.categoryCounts.get(c.id) ?? 0) > 0 || catSlugs.includes(c.slug))
    .map((c) => ({ slug: c.slug, label: tr(c, "name", locale), count: listing.categoryCounts.get(c.id) ?? 0, selected: catSlugs.includes(c.slug) }));

  const heroTitle = hero?.title ?? t("search.nothingTitle");
  const subtitle = t("search.found", { count: listing.total, query });

  if (!listing.total && !categoryIds.length && !Object.keys(parsed.filters).length) {
    const popular = await getSectionProducts({ source: "popular", limit: 8 }, locale);
    return (
      <>
        <PageHero title={heroTitle} subtitle={subtitle} script={hero?.script} image={hero?.image} breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("common.search") }]} />
        <div className="container-page mt-4 lg:mt-8">
          <EmptyState icon={<SearchX />} title={t("search.nothingTitle")} text={t("search.nothingText")} />
        </div>
        <PopularQueries title={t("search.popular")} queries={popularQueries} />
        <ProductsSection title={t("search.popularProducts")} href="/catalog" products={popular} viewAll={t("common.viewAll")} />
      </>
    );
  }

  return (
    <>
      <PageHero title={heroTitle} subtitle={subtitle} script={hero?.script} image={hero?.image} breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("common.search") }]} />
      <CatalogView
        title={`«${query}»`}
        listing={listing}
        searchParams={sp}
        categoryFacet={categoryFacet}
        showCategorySearch={false}
        sidebarBottom={<SidebarPromo variant="delivery" threshold={threshold} />}
      />
      <PopularQueries title={t("search.popular")} queries={popularQueries} />
    </>
  );
}
