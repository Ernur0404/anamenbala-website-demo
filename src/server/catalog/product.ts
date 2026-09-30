import { db } from "../db";
import { mediaSelect } from "../media/refs";
import { getPricingContext, toPricingProduct } from "../pricing/context";
import { resolvePrice } from "../pricing/engine";
import { categoryPath, descendantIds, getCategoryIndex, ancestorIds } from "./categories";
import { cardSelect, toCard, toImage, type ImageData, type ProductCardData } from "./cards";
import { getSetting } from "../settings";
import { tr, trOrNull, type Locale } from "@/lib/l10n";
import { mediaUrl, videoEmbedUrl } from "@/lib/media-url";

export type ProductOptionView = {
  attributeId: string;
  code: string;
  name: string;
  display: "CHECKBOX" | "CHIPS" | "SWATCH";
  values: { id: string; label: string; colorHex: string | null }[];
};

export type VariantView = {
  id: string;
  sku: string;
  values: Record<string, string>;
  price: number;
  oldPrice: number | null;
  discountPercent: number;
  stock: number;
  available: boolean;
};

export type GalleryItem =
  | { kind: "image"; id: string; image: ImageData; colorValueId: string | null }
  | { kind: "video"; id: string; src: string; embed: "youtube" | "instagram" | "file"; poster: ImageData | null };

export type ReviewView = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  verified: boolean;
  reply: string | null;
  photos: ImageData[];
};

export type SizeChartView = { name: string; note: string | null; columns: string[]; rows: string[][] };

export async function getProductPage(slug: string, locale: Locale) {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      brand: { select: { name: true, slug: true } },
      categories: { select: { categoryId: true } },
      badges: { select: { badge: true } },
      media: { orderBy: { sortOrder: "asc" }, select: { id: true, colorValueId: true, media: { select: mediaSelect } } },
      videoMedia: { select: mediaSelect },
      options: { orderBy: { sortOrder: "asc" }, include: { attribute: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { optionValues: { include: { attributeValue: true } } },
      },
      attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
      specs: { orderBy: { sortOrder: "asc" } },
      sizeChart: true,
    },
  });
  if (!product || product.status !== "PUBLISHED") return null;

  const [ctx, index, general] = await Promise.all([getPricingContext(), getCategoryIndex(), getSetting("general")]);
  const name = tr(product, "name", locale);
  const pricingProduct = toPricingProduct(product, ctx.categoryIndex);

  // ── варианты и опции ──
  const variants: VariantView[] = product.variants.map((v) => {
    const price = resolvePrice(pricingProduct, v, ctx.promotions, ctx.now);
    return {
      id: v.id,
      sku: v.sku,
      values: Object.fromEntries(v.optionValues.map((o) => [o.attributeId, o.attributeValueId])),
      price: price.final,
      oldPrice: price.regular > price.final ? price.regular : null,
      discountPercent: price.discountPercent,
      stock: Math.max(0, v.stock),
      available: v.stock > 0 || product.allowBackorder,
    };
  });

  const options: ProductOptionView[] = product.options.map((o) => {
    const used = new Map<string, { id: string; label: string; colorHex: string | null; sortOrder: number }>();
    for (const v of product.variants) {
      for (const ov of v.optionValues) {
        if (ov.attributeId !== o.attributeId) continue;
        used.set(ov.attributeValueId, {
          id: ov.attributeValueId,
          label: tr(ov.attributeValue, "value", locale),
          colorHex: ov.attributeValue.colorHex,
          sortOrder: ov.attributeValue.sortOrder,
        });
      }
    }
    return {
      attributeId: o.attributeId,
      code: o.attribute.code,
      name: tr(o.attribute, "name", locale),
      display: o.attribute.display,
      values: [...used.values()].sort((a, b) => a.sortOrder - b.sortOrder).map(({ sortOrder: _s, ...rest }) => {
        void _s;
        return rest;
      }),
    };
  });

  // ── галерея ──
  const gallery: GalleryItem[] = product.media
    .map((m) => {
      const image = toImage(m.media, name);
      return image ? ({ kind: "image", id: m.id, image, colorValueId: m.colorValueId } as GalleryItem) : null;
    })
    .filter((g): g is GalleryItem => g !== null);
  const videoSrc = product.videoMedia ? mediaUrl(product.videoMedia) : product.videoUrl;
  if (videoSrc) {
    const embed = product.videoMedia ? { type: "file" as const, src: videoSrc } : videoEmbedUrl(videoSrc);
    gallery.push({ kind: "video", id: "video", src: embed.src, embed: embed.type, poster: gallery[0]?.kind === "image" ? gallery[0].image : null });
  }

  // ── характеристики ──
  const specGroups = new Map<string, { label: string; values: string[]; sortOrder: number }>();
  for (const pav of product.attributeValues) {
    const attr = pav.attributeValue.attribute;
    const group = specGroups.get(attr.id) ?? { label: tr(attr, "name", locale), values: [], sortOrder: attr.sortOrder };
    group.values.push(tr(pav.attributeValue, "value", locale));
    specGroups.set(attr.id, group);
  }
  const specs = [
    ...(product.brand ? [{ label: locale === "kk" ? "Бренд" : "Бренд", value: product.brand.name }] : []),
    ...[...specGroups.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((g) => ({ label: g.label, value: g.values.join(", ") })),
    ...product.specs.map((s) => ({ label: tr(s, "label", locale), value: tr(s, "value", locale) })),
  ];

  // ── таблица размеров: у товара или у категории (только если у товара есть размеры) ──
  const hasSizeAxis = product.options.some((o) => o.attribute.code.includes("size"));
  let chart = product.sizeChart;
  if (!chart && hasSizeAxis) {
    const catIds = product.primaryCategoryId ? ancestorIds(index, product.primaryCategoryId) : product.categories.flatMap((c) => ancestorIds(index, c.categoryId));
    const chartId = catIds.map((id) => index.byId.get(id)?.sizeChartId).find(Boolean);
    chart = chartId ? await db.sizeChart.findUnique({ where: { id: chartId } }) : null;
  }
  const sizeChart: SizeChartView | null = chart
    ? {
        name: tr(chart, "name", locale),
        note: trOrNull(chart, "note", locale),
        columns: (chart.columns as { ru?: string; kk?: string }[]).map((c) => (locale === "kk" && c.kk ? c.kk : (c.ru ?? ""))),
        rows: chart.rows as string[][],
      }
    : null;

  // ── хлебные крошки ──
  const primary = product.primaryCategoryId ?? product.categories[0]?.categoryId ?? null;
  const breadcrumbs = primary
    ? categoryPath(index, primary).map((c) => ({
        label: tr(c, "name", locale),
        href: `/catalog/${categoryPath(index, c.id).map((p) => p.slug).join("/")}`,
      }))
    : [];
  const categoryLabel = primary ? tr(index.byId.get(primary)!, "name", locale) : null;

  // ── отзывы ──
  const [reviewRows, reviewTotal] = await Promise.all([
    db.review.findMany({
      where: { productId: product.id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { photos: { orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } } },
    }),
    db.review.count({ where: { productId: product.id, status: "APPROVED" } }),
  ]);
  const reviews: ReviewView[] = reviewRows.map((r) => ({
    id: r.id,
    author: r.authorName,
    rating: r.rating,
    text: r.text,
    date: r.createdAt.toISOString(),
    verified: r.isVerified,
    reply: r.replyText,
    photos: r.photos.map((p) => toImage(p.media, r.authorName)).filter((i): i is ImageData => i !== null),
  }));

  // ── похожие товары ──
  const relatedCats = primary ? descendantIds(index, index.byId.get(primary)?.parentId ?? primary) : product.categories.map((c) => c.categoryId);
  const relatedRows = await db.product.findMany({
    where: { status: "PUBLISHED", id: { not: product.id }, categories: { some: { categoryId: { in: relatedCats } } } },
    orderBy: [{ inStock: "desc" }, { salesCount: "desc" }],
    take: 8,
    select: cardSelect,
  });
  const related: ProductCardData[] = relatedRows.map((r) => toCard(r, locale));

  const badges = product.badges
    .map((b) => b.badge)
    .filter((b) => b.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({ label: tr(b, "name", locale), style: b.style }));

  return {
    id: product.id,
    slug: product.slug,
    name,
    subtitle: trOrNull(product, "subtitle", locale) ?? categoryLabel,
    descriptionHtml: trOrNull(product, "description", locale),
    brand: product.brand,
    badges,
    rating: product.ratingAvg,
    ratingCount: product.ratingCount,
    gallery,
    options,
    variants,
    allowBackorder: product.allowBackorder,
    backorderNote: trOrNull(product, "backorderNote", locale),
    specs,
    sizeChart,
    breadcrumbs,
    reviews,
    reviewTotal,
    related,
    lowStockThreshold: general.lowStockThreshold,
    seo: {
      title: trOrNull(product, "seoTitle", locale) ?? name,
      description: trOrNull(product, "seoDescription", locale),
    },
    card: {
      priceMin: product.priceMin,
      regularMin: product.regularMin,
      inStock: product.inStock,
    },
  };
}

export type ProductPageData = NonNullable<Awaited<ReturnType<typeof getProductPage>>>;

/** Данные для быстрого выбора варианта из карточки */
export async function getQuickProduct(productId: string, locale: Locale) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { slug: true, status: true } });
  if (!product || product.status !== "PUBLISHED") return null;
  const page = await getProductPage(product.slug, locale);
  if (!page) return null;
  return {
    id: page.id,
    slug: page.slug,
    name: page.name,
    image: page.gallery.find((g) => g.kind === "image")?.image ?? null,
    gallery: page.gallery.filter((g): g is Extract<GalleryItem, { kind: "image" }> => g.kind === "image").map((g) => ({ image: g.image, colorValueId: g.colorValueId })),
    options: page.options,
    variants: page.variants,
    allowBackorder: page.allowBackorder,
    backorderNote: page.backorderNote,
    lowStockThreshold: page.lowStockThreshold,
  };
}

export type QuickProduct = NonNullable<Awaited<ReturnType<typeof getQuickProduct>>>;
