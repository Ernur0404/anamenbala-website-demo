import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBanners, getFeaturedReviews, getFreeDeliveryThreshold, getHomeSections, getInstagramPosts, getSectionProducts } from "@/server/content";
import { getFavoriteIds } from "@/server/store-session";
import { getForYouProducts, getSaleOverview } from "@/server/catalog/landing";
import { getStoreChrome } from "@/server/store-chrome";
import { getSetting } from "@/server/settings";
import { toImage } from "@/server/catalog/cards";
import { HeroSlider } from "@/components/store/home/hero-slider";
import { AdvantagesStrip, CategoryTiles, ForYouSection, HomeSearchPanel, InstagramSection, ProductsSection, PromoBannerSection, ReviewsSection } from "@/components/store/home/sections";
import { RecentlyViewed } from "@/components/store/recently-viewed";
import { getCategoryIndex, categoryPath } from "@/server/catalog/categories";
import { pickLocale, tr, type Locale } from "@/lib/l10n";

type SectionConfig = { source?: string; limit?: number; categorySlug?: string; productIds?: string[] };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const t = await getTranslations();

  const [sections, heroBanners, promoBanners, chrome, advantages, contacts, index, sale, threshold, favoriteIds] = await Promise.all([
    getHomeSections(),
    getBanners("HOME_HERO", locale),
    getBanners("HOME_PROMO", locale),
    getStoreChrome(locale),
    getSetting("advantages"),
    getSetting("contacts"),
    getCategoryIndex(),
    getSaleOverview(),
    getFreeDeliveryThreshold(),
    getFavoriteIds(),
  ]);

  // телефон: «Подобрали для вас» вместо кружков разделов — без повторов с блоком «Популярные товары»
  const popular = sections.find((s) => s.type === "PRODUCTS" && (s.config as SectionConfig | null)?.source === "popular");
  const popularIds = popular ? (await getSectionProducts(popular.config as SectionConfig, locale)).map((p) => p.id) : [];
  const forYou = await getForYouProducts(locale, { favoriteIds, excludeIds: popularIds, limit: 8 });

  const rendered = await Promise.all(
    sections.map(async (section) => {
      const title = tr(section, "title", locale);
      const subtitle = tr(section, "subtitle", locale) || null;
      const config = (section.config ?? {}) as SectionConfig;
      switch (section.type) {
        case "CATEGORY_TILES":
          return <CategoryTiles key={section.id} categories={chrome.menu} />;
        case "PRODUCTS": {
          const products = await getSectionProducts(config, locale);
          let href = "/catalog";
          if (config.source === "new") href = "/catalog?sort=new";
          else if (config.source === "sale") href = "/sale";
          else if (config.source === "category" && config.categorySlug) {
            const category = index.bySlug.get(config.categorySlug);
            if (category) href = `/catalog/${categoryPath(index, category.id).map((c) => c.slug).join("/")}`;
          }
          return <ProductsSection key={section.id} title={title} subtitle={subtitle} href={href} products={products} viewAll={t("common.viewAll")} />;
        }
        case "PROMO_BANNER":
          return <PromoBannerSection key={section.id} banner={promoBanners[0]} />;
        case "REVIEWS": {
          const rows = await getFeaturedReviews(config.limit ?? 6);
          const reviews = rows.map((r) => ({
            id: r.id,
            author: r.authorName,
            rating: r.rating,
            text: r.text,
            date: r.createdAt.toISOString(),
            verified: r.isVerified,
            product: r.product ? { slug: r.product.slug, name: tr(r.product, "name", locale) } : null,
            photo: toImage(r.photos[0]?.media, r.authorName),
          }));
          return <ReviewsSection key={section.id} title={title || t("reviews.storeTitle")} reviews={reviews} locale={locale} />;
        }
        case "INSTAGRAM":
          return <InstagramSection key={section.id} title={title} posts={await getInstagramPosts(locale)} profileUrl={contacts.instagram} />;
        case "ADVANTAGES":
          return (
            <AdvantagesStrip
              key={section.id}
              items={advantages.items.map((a) => ({ icon: a.icon, title: pickLocale(a.title, locale), text: pickLocale(a.text, locale) }))}
            />
          );
        case "RECENTLY_VIEWED":
          return <RecentlyViewed key={section.id} title={title} />;
        default:
          return null;
      }
    }),
  );

  return (
    <>
      <h1 className="sr-only">{chrome.storeName}</h1>
      <HomeSearchPanel freeFrom={threshold} />
      <HeroSlider banners={heroBanners} salePercent={sale.maxDiscount || null} />
      <ForYouSection title={t("home.forYou")} products={forYou} />
      {rendered}
    </>
  );
}
