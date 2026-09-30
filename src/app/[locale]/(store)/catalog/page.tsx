import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCategoryIndex } from "@/server/catalog/categories";
import { listProducts, parseListingSearchParams } from "@/server/catalog/listing";
import { sidebarItems } from "@/server/catalog/navigation";
import { getFreeDeliveryThreshold, getPageHero } from "@/server/content";
import { PageHero } from "@/components/store/page-hero";
import { CatalogView } from "@/components/store/catalog/catalog-view";
import { SidebarCategories, SidebarPromo } from "@/components/store/catalog/sidebar";
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

  const [hero, index, listing, threshold] = await Promise.all([
    getPageHero("catalog", locale),
    getCategoryIndex(),
    listProducts({ locale, search: parsed.q, filters: parsed.filters, brands: parsed.brands, priceFrom: parsed.priceFrom, priceTo: parsed.priceTo, availability: parsed.availability, sort: parsed.sort, page: parsed.page }),
    getFreeDeliveryThreshold(),
  ]);

  return (
    <>
      <PageHero
        title={hero?.title ?? t("nav.catalog")}
        subtitle={hero?.subtitle}
        script={hero?.script}
        image={hero?.image}
        breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: hero?.title ?? t("nav.catalog") }]}
      />
      <CatalogView
        title={t("listing.allProducts")}
        listing={listing}
        searchParams={sp}
        sidebarTop={<SidebarCategories items={sidebarItems(index, locale, null, { all: t("nav.allCategories"), sale: t("nav.sale") })} />}
        sidebarBottom={<SidebarPromo variant="delivery" threshold={threshold} />}
      />
    </>
  );
}
