import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Heart } from "lucide-react";
import { getFavoriteIds } from "@/server/store-session";
import { getCardsByIds } from "@/server/catalog/cards";
import { getPageHero, getSectionProducts } from "@/server/content";
import { PageHero } from "@/components/store/page-hero";
import { FavoritesList } from "@/components/store/favorites-list";
import { ProductsSection } from "@/components/store/home/sections";
import { EmptyState } from "@/components/ui/display";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Избранное", robots: { index: false } };

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const t = await getTranslations();
  const ids = await getFavoriteIds();
  const [hero, products, popular] = await Promise.all([getPageHero("favorites", locale), getCardsByIds(ids, locale), getSectionProducts({ source: "popular", limit: 8 }, locale)]);

  return (
    <>
      <PageHero
        title={hero?.title ?? t("nav.favorites")}
        subtitle={hero?.subtitle}
        script={hero?.script}
        image={hero?.image}
        breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: hero?.title ?? t("nav.favorites") }]}
      />
      <div className="container-page mt-3 lg:mt-8">
        {products.length ? (
          <FavoritesList products={products} labels={{ clear: t("favorites.clear"), empty: t("favorites.empty") }} />
        ) : (
          <EmptyState
            icon={<Heart />}
            title={t("favorites.empty")}
            text={t("favorites.emptyText")}
            action={
              <Link href="/catalog" className="inline-flex h-11 items-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
                {t("cart.goShopping")}
              </Link>
            }
          />
        )}
      </div>
      <ProductsSection title={t("cart.mayLike")} href="/catalog" products={popular.filter((p) => !ids.includes(p.id))} viewAll={t("common.viewAll")} />
    </>
  );
}
