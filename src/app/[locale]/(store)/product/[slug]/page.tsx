import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Truck } from "lucide-react";
import { getProductPage } from "@/server/catalog/product";
import { getDeliveryMethods } from "@/server/content";
import { getSetting } from "@/server/settings";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductView } from "@/components/store/product/product-view";
import { ProductTabs } from "@/components/store/product/product-tabs";
import { AdvantagesStrip, ProductsSection } from "@/components/store/home/sections";
import { RecentlyViewed, TrackRecentlyViewed } from "@/components/store/recently-viewed";
import { Link, getPathname } from "@/i18n/navigation";
import { pickLocale, tr, type Locale } from "@/lib/l10n";
import { formatMoney } from "@/lib/money";
import { sanitizeHtml } from "@/server/sanitize";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProductPage(slug, locale as Locale);
  if (!product) return {};
  const image = product.gallery.find((g) => g.kind === "image");
  const description = product.seo.description ?? product.descriptionHtml?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    title: product.seo.title,
    description,
    alternates: {
      canonical: getPathname({ href: `/product/${slug}`, locale: locale as Locale }),
      languages: { ru: `/product/${slug}`, kk: `/kk/product/${slug}` },
    },
    openGraph: { title: product.name, description, images: image && image.kind === "image" ? [{ url: image.image.src }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const product = await getProductPage(slug, locale);
  if (!product) notFound();
  const t = await getTranslations();
  const [deliveryMethods, advantages] = await Promise.all([getDeliveryMethods(), getSetting("advantages")]);

  const crumbs = [{ label: t("common.home"), href: "/" }, ...product.breadcrumbs, { label: product.name }];
  const appUrl = process.env.APP_URL ?? "";
  const firstImage = product.gallery.find((g) => g.kind === "image");
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: firstImage && firstImage.kind === "image" ? [firstImage.image.src.startsWith("http") ? firstImage.image.src : `${appUrl}${firstImage.image.src}`] : undefined,
    description: product.descriptionHtml?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
    sku: product.variants[0]?.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "KZT",
      lowPrice: minPrice,
      highPrice: Math.max(...product.variants.map((v) => v.price)),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : product.allowBackorder ? "https://schema.org/PreOrder" : "https://schema.org/OutOfStock",
    },
    aggregateRating: product.ratingCount ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.ratingCount } : undefined,
  };

  const description = product.descriptionHtml ? (
    <div className="rich-text max-w-3xl" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.descriptionHtml) }} />
  ) : (
    <p className="text-sm text-ink-500">{t("product.noDescription")}</p>
  );

  const delivery = (
    <div className="max-w-2xl space-y-3">
      {deliveryMethods.map((m) => (
        <div key={m.id} className="flex items-start gap-3 rounded-lg border border-line p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-50 text-sage-700">
            <Truck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{tr(m, "name", locale)}</p>
              <p className="text-sm font-semibold">{m.price > 0 ? formatMoney(m.price) : t("pages.free")}</p>
            </div>
            {tr(m, "description", locale) && <p className="mt-1 text-sm text-ink-600">{tr(m, "description", locale)}</p>}
            <p className="mt-1 text-xs text-ink-500">
              {tr(m, "eta", locale)}
              {m.freeFrom ? ` · ${t("pages.freeFrom", { amount: formatMoney(m.freeFrom) })}` : ""}
            </p>
          </div>
        </div>
      ))}
      <Link href="/delivery" className="inline-block text-sm font-semibold text-sage-700 hover:underline">
        {t("product.deliveryMore")} →
      </Link>
    </div>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TrackRecentlyViewed productId={product.id} />
      <div className="container-page pt-4 sm:pt-6">
        <Breadcrumbs items={crumbs} className="mb-4 sm:mb-6" />
        <ProductView
          id={product.id}
          name={product.name}
          subtitle={product.subtitle}
          badges={product.badges}
          rating={product.rating}
          ratingCount={product.ratingCount}
          gallery={product.gallery}
          options={product.options}
          variants={product.variants}
          allowBackorder={product.allowBackorder}
          backorderNote={product.backorderNote}
          sizeChart={product.sizeChart}
          lowStockThreshold={product.lowStockThreshold}
        />
      </div>

      <AdvantagesStrip
        className="container-page mt-10"
        items={advantages.items.map((a) => ({ icon: a.icon, title: pickLocale(a.title, locale), text: pickLocale(a.text, locale) }))}
      />

      <div className="container-page mt-8">
        <ProductTabs
          productId={product.id}
          description={description}
          specs={product.specs}
          delivery={delivery}
          reviews={product.reviews}
          reviewTotal={product.reviewTotal}
          rating={product.rating}
        />
      </div>

      <ProductsSection
        title={t("product.similar")}
        href={product.breadcrumbs.at(-1)?.href ?? "/catalog"}
        products={product.related}
        viewAll={t("common.viewAll")}
      />
      <RecentlyViewed title={t("home.recentlyViewed")} excludeId={product.id} />
    </>
  );
}
