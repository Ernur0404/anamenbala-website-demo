import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { categoryPath, getCategoryIndex, isCategoryPublic } from "@/server/catalog/categories";
import { listProducts, parseListingSearchParams } from "@/server/catalog/listing";
import { categoryHref, childTiles, sidebarItems } from "@/server/catalog/navigation";
import { getFreeDeliveryThreshold } from "@/server/content";
import { toImage } from "@/server/catalog/cards";
import { PageHero } from "@/components/store/page-hero";
import { CatalogView } from "@/components/store/catalog/catalog-view";
import { SidebarCategories, SidebarPromo, SubcategoryTiles } from "@/components/store/catalog/sidebar";
import { tr, trOrNull, type Locale } from "@/lib/l10n";
import { getPathname } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string; slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resolveCategory(slugs: string[]) {
  const index = await getCategoryIndex();
  const category = index.bySlug.get(slugs[slugs.length - 1]);
  if (!category || !isCategoryPublic(index, category.id)) return null;
  return { index, category };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolved = await resolveCategory(slug);
  if (!resolved) return {};
  const { category, index } = resolved;
  const name = tr(category, "name", locale);
  return {
    title: trOrNull(category, "seoTitle", locale) ?? name,
    description: trOrNull(category, "seoDescription", locale) ?? trOrNull(category, "heroText", locale) ?? undefined,
    alternates: { canonical: getPathname({ href: categoryHref(index, category.id), locale: locale as Locale }) },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale: raw, slug } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const resolved = await resolveCategory(slug);
  if (!resolved) notFound();
  const { index, category } = resolved;

  // канонический путь: /catalog/родитель/категория
  const canonical = categoryPath(index, category.id).map((c) => c.slug);
  if (canonical.join("/") !== slug.join("/")) permanentRedirect(getPathname({ href: `/catalog/${canonical.join("/")}`, locale }));

  const sp = await searchParams;
  const parsed = parseListingSearchParams(sp);
  const t = await getTranslations();
  const name = tr(category, "name", locale);
  const isRoot = category.parentId === null;

  const [listing, threshold] = await Promise.all([
    listProducts({
      locale,
      categoryId: category.id,
      search: parsed.q,
      filters: parsed.filters,
      brands: parsed.brands,
      priceFrom: parsed.priceFrom,
      priceTo: parsed.priceTo,
      availability: parsed.availability,
      sort: parsed.sort,
      page: parsed.page,
    }),
    getFreeDeliveryThreshold(),
  ]);

  const crumbs = [
    { label: t("common.home"), href: "/" },
    { label: t("nav.catalog"), href: "/catalog" },
    ...categoryPath(index, category.id).map((c) => ({ label: tr(c, "name", locale), href: categoryHref(index, c.id) })),
  ];
  // у подкатегории без своего баннера — фото ближайшего родителя
  const heroImage = categoryPath(index, category.id)
    .reverse()
    .find((c) => c.heroImage)?.heroImage;
  const promoVariant = category.slug === "dlya-sebya" || index.byId.get(category.parentId ?? "")?.slug === "dlya-sebya" ? "gift" : "delivery";

  return (
    <>
      <PageHero
        title={trOrNull(category, "heroTitle", locale) ?? name}
        subtitle={trOrNull(category, "heroText", locale) ?? trOrNull(category, "description", locale)}
        script={trOrNull(category, "heroScript", locale)}
        image={toImage(heroImage ?? null, name)}
        breadcrumbs={crumbs}
      />
      <CatalogView
        title={isRoot ? t("listing.allProducts") : name}
        listing={listing}
        searchParams={sp}
        aboveGrid={isRoot ? <SubcategoryTiles items={childTiles(index, locale, category.id)} /> : undefined}
        sidebarTop={<SidebarCategories items={sidebarItems(index, locale, category.id, { all: t("nav.allCategories"), sale: t("nav.sale") })} />}
        sidebarBottom={<SidebarPromo variant={promoVariant} threshold={threshold} />}
      />
    </>
  );
}
