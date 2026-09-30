import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { mediaSelect, type MediaRef } from "../media/refs";
import { mediaUrl } from "@/lib/media-url";
import { tr, type Locale } from "@/lib/l10n";

export type ImageData = { src: string; alt: string; blur: string | null; width: number | null; height: number | null };

export function toImage(media: MediaRef | null | undefined, alt: string): ImageData | null {
  const src = mediaUrl(media, 1920);
  if (!media || !src) return null;
  return {
    src: media.externalUrl ?? src,
    alt: (media.altRu ?? alt) || alt,
    blur: media.blurDataUrl,
    width: media.width,
    height: media.height,
  };
}

export const cardSelect = {
  id: true,
  slug: true,
  nameRu: true,
  nameKk: true,
  priceMin: true,
  priceMax: true,
  regularMin: true,
  discountPercent: true,
  inStock: true,
  allowBackorder: true,
  ratingAvg: true,
  ratingCount: true,
  media: { orderBy: { sortOrder: "asc" }, take: 2, select: { media: { select: mediaSelect } } },
  badges: { select: { badge: { select: { nameRu: true, nameKk: true, style: true, isActive: true, sortOrder: true } } } },
  options: { select: { attributeId: true } },
  variants: { where: { isActive: true }, select: { id: true }, orderBy: { sortOrder: "asc" }, take: 2 },
} satisfies Prisma.ProductSelect;

export type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  image: ImageData | null;
  hoverImage: ImageData | null;
  price: number;
  oldPrice: number | null;
  discountPercent: number;
  fromPrice: boolean;
  badges: { label: string; style: "SAGE" | "POWDER" | "BEIGE" | "GRAPHITE" }[];
  rating: number;
  ratingCount: number;
  inStock: boolean;
  backorder: boolean;
  /** Если у товара один вариант без опций — можно добавить в корзину прямо с карточки */
  quickVariantId: string | null;
};

export function toCard(row: CardRow, locale: Locale): ProductCardData {
  const name = tr(row, "name", locale);
  const badges = row.badges
    .map((b) => b.badge)
    .filter((b) => b.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({ label: tr(b, "name", locale), style: b.style }));
  return {
    id: row.id,
    slug: row.slug,
    name,
    image: toImage(row.media[0]?.media, name),
    hoverImage: toImage(row.media[1]?.media, name),
    price: row.priceMin,
    oldPrice: row.regularMin > row.priceMin ? row.regularMin : null,
    discountPercent: row.discountPercent,
    fromPrice: row.priceMax > row.priceMin,
    badges,
    rating: row.ratingAvg,
    ratingCount: row.ratingCount,
    inStock: row.inStock,
    backorder: !row.inStock && row.allowBackorder,
    quickVariantId: row.options.length === 0 && row.variants.length === 1 ? row.variants[0].id : null,
  };
}

/** Карточки по списку id (порядок сохраняется), только опубликованные */
export async function getCardsByIds(ids: readonly string[], locale: Locale): Promise<ProductCardData[]> {
  if (!ids.length) return [];
  const rows = await db.product.findMany({ where: { id: { in: [...ids] }, status: "PUBLISHED" }, select: cardSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is CardRow => Boolean(r)).map((r) => toCard(r, locale));
}
