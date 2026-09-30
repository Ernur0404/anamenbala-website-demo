import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCategoryIndex, isCategoryPublic } from "@/server/catalog/categories";
import { listProducts, parseListingSearchParams } from "@/server/catalog/listing";
import { getPageHero } from "@/server/content";
import { PageHero } from "@/components/store/page-hero";
import { CatalogView } from "@/components/store/catalog/catalog-view";
import { SaleTiles, SidebarCategories, SidebarPromo } from "@/components/store/catalog/sidebar";
import { tr, type Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const hero = await getPageHero("sale", locale as Locale);
  return { title: hero?.title ?? "Акции", description: hero?.subtitle ?? undefined };
}

export default async function SalePage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const sp = await searchParams;
  const parsed = parseListingSearchParams(sp);
  const t = await getTranslations();
  const [hero, index] = await Promise.all([getPageHero("sale", locale), getCategoryIndex()]);

  const catSlug = typeof sp.cat === "string" ? sp.cat : null;
  const active = catSlug ? index.bySlug.get(catSlug) : undefined;
  const roots = (index.children.get(null) ?? []).filter((c) => isCategoryPublic(index, c.id) && c.showInMenu);

  const listing = await listProducts({
    locale,
    sale: true,
    categoryId: active?.id ?? null,
    discountMin: parsed.discountMin,
    search: parsed.q,
    filters: parsed.filters,
    brands: parsed.brands,
    priceFrom: parsed.priceFrom,
    priceTo: parsed.priceTo,
    availability: parsed.availability,
    sort: sp.sort ? parsed.sort : "discount",
    page: parsed.page,
  });

  const tiles = [
    { key: "all", label: t("listing.allSales"), href: "/sale", icon: "percent", active: !active },
    ...roots.map((c) => ({ key: c.id, label: tr(c, "name", locale), href: `/sale?cat=${c.slug}`, icon: c.icon, active: active?.id === c.id })),
  ];

  return (
    <>
      <PageHero
        title={hero?.title ?? t("nav.sale")}
        subtitle={hero?.subtitle}
        script={hero?.script}
        image={hero?.image}
        breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: hero?.title ?? t("nav.sale") }]}
      />
      <CatalogView
        title={active ? tr(active, "name", locale) : t("listing.allSales")}
        listing={listing}
        searchParams={sp}
        showDiscount
        aboveGrid={<SaleTiles items={tiles} />}
        sidebarTop={
          <SidebarCategories items={tiles.map((tile) => ({ key: tile.key, label: tile.label, href: tile.href, icon: tile.key === "all" ? "grid" : tile.icon, active: tile.active }))} />
        }
        sidebarBottom={<SidebarPromo variant="deals" />}
      />
    </>
  );
}
