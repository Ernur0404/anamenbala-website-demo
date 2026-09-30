/** Контент витрины: блоки главной, баннеры, страницы, FAQ, Instagram, отзывы, способы доставки/оплаты */
import { db } from "./db";
import { cached, CacheTags } from "./cache";
import { mediaSelect } from "./media/refs";
import { getSetting } from "./settings";
import { cardSelect, toCard, toImage, type ImageData, type ProductCardData } from "./catalog/cards";
import { descendantIds, getCategoryIndex } from "./catalog/categories";
import { isActiveWindow } from "./pricing/engine";
import { tr, trOrNull, type Locale } from "@/lib/l10n";
import type { Prisma } from "@/generated/prisma/client";
import type { BannerPlacement } from "@/generated/prisma/enums";

export function getHomeSections() {
  return cached("home:sections", [CacheTags.content], 10 * 60_000, () =>
    db.homeSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  );
}

export type BannerView = {
  id: string;
  eyebrow: string | null;
  title: string;
  text: string | null;
  script: string | null;
  buttonText: string | null;
  url: string | null;
  image: ImageData | null;
  mobileImage: ImageData | null;
  features: { icon: string; label: string }[];
};

export async function getBanners(placement: BannerPlacement, locale: Locale): Promise<BannerView[]> {
  const rows = await cached(`banners:${placement}`, [CacheTags.content], 5 * 60_000, () =>
    db.banner.findMany({
      where: { placement, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { image: { select: mediaSelect }, mobileImage: { select: mediaSelect } },
    }),
  );
  const now = new Date();
  return rows
    .filter((b) => isActiveWindow(b.startsAt, b.endsAt, now))
    .map((b) => {
      const title = tr(b, "title", locale);
      return {
        id: b.id,
        eyebrow: trOrNull(b, "eyebrow", locale),
        title,
        text: trOrNull(b, "text", locale),
        script: trOrNull(b, "script", locale),
        buttonText: trOrNull(b, "buttonText", locale),
        url: b.url,
        image: toImage(b.image, title),
        mobileImage: toImage(b.mobileImage, title),
        features: ((b.features as { icon: string; ru: string; kk?: string }[]) ?? []).map((f) => ({
          icon: f.icon,
          label: locale === "kk" && f.kk ? f.kk : f.ru,
        })),
      };
    });
}

type HomeProductsConfig = { source?: string; limit?: number; categorySlug?: string; productIds?: string[] };

export async function getSectionProducts(config: HomeProductsConfig, locale: Locale): Promise<ProductCardData[]> {
  const limit = Math.min(Math.max(config.limit ?? 8, 1), 24);
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };
  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ salesCount: "desc" }, { ratingCount: "desc" }];

  switch (config.source) {
    case "new": {
      const { newArrivalDays } = await getSetting("general");
      where.publishedAt = { gte: new Date(Date.now() - newArrivalDays * 86_400_000) };
      orderBy = [{ publishedAt: "desc" }];
      break;
    }
    case "sale":
      where.discountPercent = { gt: 0 };
      orderBy = [{ discountPercent: "desc" }, { salesCount: "desc" }];
      break;
    case "category": {
      const index = await getCategoryIndex();
      const category = config.categorySlug ? index.bySlug.get(config.categorySlug) : undefined;
      if (!category) return [];
      where.categories = { some: { categoryId: { in: descendantIds(index, category.id) } } };
      break;
    }
    case "manual":
      if (!config.productIds?.length) return [];
      where.id = { in: config.productIds };
      break;
  }

  let rows = await db.product.findMany({ where, orderBy: [{ inStock: "desc" }, ...orderBy], take: limit, select: cardSelect });
  // «Новинки»: если за период ничего не добавлялось — показываем последние добавленные
  if (config.source === "new" && rows.length < 4) {
    rows = await db.product.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }], take: limit, select: cardSelect });
  }
  if (config.source === "manual" && config.productIds) {
    const order = new Map(config.productIds.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  return rows.map((r) => toCard(r, locale));
}

export async function getPage(slug: string) {
  return cached(`page:${slug}`, [CacheTags.content], 10 * 60_000, () =>
    db.page.findUnique({ where: { slug }, include: { heroImage: { select: mediaSelect } } }),
  );
}

export async function getPageHero(slug: string, locale: Locale) {
  const page = await getPage(slug);
  if (!page) return null;
  const title = tr(page, "title", locale);
  return {
    title,
    subtitle: trOrNull(page, "subtitle", locale),
    script: trOrNull(page, "script", locale),
    image: toImage(page.heroImage, title),
  };
}

export async function getFooterPages() {
  return cached("pages:footer", [CacheTags.content], 10 * 60_000, () =>
    db.page.findMany({ where: { isPublished: true, showInFooter: true }, orderBy: { createdAt: "asc" }, select: { slug: true, titleRu: true, titleKk: true, template: true } }),
  );
}

export async function getFaq(onlyDelivery = false) {
  return cached(`faq:${onlyDelivery}`, [CacheTags.content], 10 * 60_000, () =>
    db.faqItem.findMany({ where: { isActive: true, ...(onlyDelivery ? { showOnDelivery: true } : {}) }, orderBy: { sortOrder: "asc" } }),
  );
}

export async function getInstagramPosts(locale: Locale) {
  const rows = await cached("instagram:posts", [CacheTags.content], 10 * 60_000, () =>
    db.instagramPost.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 12, include: { media: { select: mediaSelect } } }),
  );
  return rows
    .map((p) => ({ id: p.id, url: p.url, image: toImage(p.media, locale === "kk" ? "Instagram жазбасы" : "Публикация в Instagram") }))
    .filter((p): p is { id: string; url: string; image: ImageData } => p.image !== null);
}

export async function getFeaturedReviews(limit = 6) {
  const rows = await cached(`reviews:featured:${limit}`, [CacheTags.reviews], 5 * 60_000, () =>
    db.review.findMany({
      where: { status: "APPROVED", OR: [{ isFeatured: true }, { rating: { gte: 4 } }] },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        product: { select: { slug: true, nameRu: true, nameKk: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1, include: { media: { select: mediaSelect } } },
      },
    }),
  );
  return rows;
}

export async function getDeliveryMethods() {
  return cached("delivery:methods", [CacheTags.delivery], 10 * 60_000, () =>
    db.deliveryMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { paymentMethods: { select: { paymentMethodId: true } } } }),
  );
}

export async function getPaymentMethods() {
  return cached("payment:methods", [CacheTags.delivery], 10 * 60_000, () => db.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }));
}

/** Минимальный порог бесплатной доставки среди активных способов (для баннеров) */
export async function getFreeDeliveryThreshold(): Promise<number | null> {
  const methods = await getDeliveryMethods();
  const thresholds = methods.map((m) => m.freeFrom).filter((v): v is number => v !== null && v > 0);
  return thresholds.length ? Math.min(...thresholds) : null;
}
