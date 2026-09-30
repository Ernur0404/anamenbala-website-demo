/**
 * Каталог: фильтры, счётчики фасетов («дизъюнктивные» — внутри фильтра ИЛИ, между фильтрами И),
 * сортировка и пагинация. Фильтры зависят от категории (характеристики категории, её родителей и подкатегорий).
 */
import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { cached, CacheTags } from "../cache";
import { getCategoryIndex, descendantIds, isCategoryPublic, ancestorIds, type CategoryIndex } from "./categories";
import { cardSelect, toCard, type ProductCardData } from "./cards";
import { searchTokens } from "@/lib/search";
import { tr, type Locale } from "@/lib/l10n";

import { SORTS, type SortKey } from "./listing-sorts";
export { SORTS, type SortKey };

export type ListingParams = {
  locale: Locale;
  categoryId?: string | null;
  /** Несколько категорий (фильтр на странице поиска) — объединение */
  categoryIds?: string[] | null;
  search?: string | null;
  sale?: boolean;
  /** код характеристики → slug значений */
  filters?: Record<string, string[]>;
  brands?: string[];
  priceFrom?: number | null;
  priceTo?: number | null;
  availability?: ("in_stock" | "backorder")[];
  discountMin?: number | null;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

export type FacetValue = { slug: string; label: string; count: number; selected: boolean; colorHex: string | null };
export type Facet = { code: string; label: string; display: "CHECKBOX" | "CHIPS" | "SWATCH"; values: FacetValue[] };

export type Listing = {
  items: ProductCardData[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
  facets: Facet[];
  brands: { slug: string; name: string; count: number; selected: boolean }[];
  priceRange: { min: number; max: number };
  categoryCounts: Map<string, number>;
};

type AttributeMeta = {
  id: string;
  code: string;
  nameRu: string;
  nameKk: string | null;
  display: "CHECKBOX" | "CHIPS" | "SWATCH";
  isFilterable: boolean;
  sortOrder: number;
  values: { id: string; slug: string; valueRu: string; valueKk: string | null; colorHex: string | null; sortOrder: number }[];
};

export function getAttributesMeta(): Promise<AttributeMeta[]> {
  return cached("attributes:meta", [CacheTags.attributes], 10 * 60_000, () =>
    db.attribute.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        nameRu: true,
        nameKk: true,
        display: true,
        isFilterable: true,
        sortOrder: true,
        values: { orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, valueRu: true, valueKk: true, colorHex: true, sortOrder: true } },
      },
    }),
  );
}

/** Какие характеристики показывать фильтрами для категории: её, родителей и всех подкатегорий */
async function filterAttributeIds(index: CategoryIndex, categoryId: string | null): Promise<Set<string> | null> {
  if (!categoryId) return null; // все характеристики, у которых есть значения в выдаче
  const related = new Set([...ancestorIds(index, categoryId), ...descendantIds(index, categoryId)]);
  const links = await cached(`catattr:all`, [CacheTags.categories, CacheTags.attributes], 10 * 60_000, () =>
    db.categoryAttribute.findMany({ where: { isFilter: true }, select: { categoryId: true, attributeId: true, sortOrder: true } }),
  );
  return new Set(links.filter((l) => related.has(l.categoryId)).map((l) => l.attributeId));
}

function orderBy(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "new":
      return [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
    case "price_asc":
      return [{ priceMin: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ priceMin: "desc" }, { id: "asc" }];
    case "discount":
      return [{ discountPercent: "desc" }, { salesCount: "desc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
    default:
      return [{ inStock: "desc" }, { salesCount: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }];
  }
}

export async function listProducts(params: ListingParams): Promise<Listing> {
  const { locale } = params;
  const perPage = params.perPage ?? 12;
  const index = await getCategoryIndex();
  const attributes = await getAttributesMeta();

  // ── базовый фильтр (без характеристик) ──
  const base: Prisma.ProductWhereInput[] = [{ status: "PUBLISHED" }];
  const visible = index.all.filter((c) => isCategoryPublic(index, c.id)).map((c) => c.id);
  base.push({ OR: [{ categories: { some: { categoryId: { in: visible } } } }, { categories: { none: {} } }] });
  if (params.categoryId) base.push({ categories: { some: { categoryId: { in: descendantIds(index, params.categoryId) } } } });
  if (params.categoryIds?.length) {
    const ids = [...new Set(params.categoryIds.flatMap((id) => descendantIds(index, id)))];
    base.push({ categories: { some: { categoryId: { in: ids } } } });
  }
  for (const token of searchTokens(params.search)) base.push({ searchText: { contains: token } });
  if (params.sale) base.push({ discountPercent: { gt: 0 } });
  if (params.discountMin) base.push({ discountPercent: { gte: params.discountMin } });
  if (params.availability?.length === 1) {
    base.push(params.availability[0] === "in_stock" ? { inStock: true } : { inStock: false, allowBackorder: true });
  }

  const brandRows = await cached("brands:all", [CacheTags.catalog], 10 * 60_000, () =>
    db.brand.findMany({ where: { isVisible: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true } }),
  );
  const brandIds = brandRows.filter((b) => params.brands?.includes(b.slug)).map((b) => b.id);

  const baseRows = await db.product.findMany({
    where: { AND: base },
    select: { id: true, brandId: true, priceMin: true, facets: { select: { attributeValueId: true } }, categories: { select: { categoryId: true } } },
  });

  // ── выбранные значения характеристик ──
  const allowedAttrs = await filterAttributeIds(index, params.categoryId ?? null);
  const valueById = new Map<string, { attr: AttributeMeta; slug: string }>();
  for (const attr of attributes) for (const v of attr.values) valueById.set(v.id, { attr, slug: v.slug });

  const selected = new Map<string, Set<string>>(); // attributeId → valueIds
  for (const [code, slugs] of Object.entries(params.filters ?? {})) {
    const attr = attributes.find((a) => a.code === code);
    if (!attr || !slugs.length) continue;
    const ids = attr.values.filter((v) => slugs.includes(v.slug)).map((v) => v.id);
    if (ids.length) selected.set(attr.id, new Set(ids));
  }

  const productFacets = new Map(baseRows.map((r) => [r.id, new Set(r.facets.map((f) => f.attributeValueId))]));
  const matchesAttributes = (productId: string, except?: string) => {
    const values = productFacets.get(productId)!;
    for (const [attrId, wanted] of selected) {
      if (attrId === except) continue;
      let hit = false;
      for (const v of wanted) if (values.has(v)) { hit = true; break; }
      if (!hit) return false;
    }
    return true;
  };
  const matchesBrand = (brandId: string | null) => !brandIds.length || (brandId !== null && brandIds.includes(brandId));
  const matchesPrice = (price: number) => (params.priceFrom == null || price >= params.priceFrom) && (params.priceTo == null || price <= params.priceTo);

  // ── фасеты характеристик ──
  const facets: Facet[] = [];
  for (const attr of attributes) {
    if (!attr.isFilterable) continue;
    if (allowedAttrs && !allowedAttrs.has(attr.id)) continue;
    const counts = new Map<string, number>();
    for (const row of baseRows) {
      if (!matchesBrand(row.brandId) || !matchesPrice(row.priceMin) || !matchesAttributes(row.id, attr.id)) continue;
      for (const v of productFacets.get(row.id)!) {
        if (valueById.get(v)?.attr.id === attr.id) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    const values = attr.values
      .map((v) => ({
        slug: v.slug,
        label: tr(v, "value", locale),
        count: counts.get(v.id) ?? 0,
        selected: selected.get(attr.id)?.has(v.id) ?? false,
        colorHex: v.colorHex,
      }))
      .filter((v) => v.count > 0 || v.selected);
    if (values.length) facets.push({ code: attr.code, label: tr(attr, "name", locale), display: attr.display, values });
  }

  // ── бренды ──
  const brandCounts = new Map<string, number>();
  for (const row of baseRows) {
    if (!row.brandId || !matchesPrice(row.priceMin) || !matchesAttributes(row.id)) continue;
    brandCounts.set(row.brandId, (brandCounts.get(row.brandId) ?? 0) + 1);
  }
  const brands = brandRows
    .map((b) => ({ slug: b.slug, name: b.name, count: brandCounts.get(b.id) ?? 0, selected: params.brands?.includes(b.slug) ?? false }))
    .filter((b) => b.count > 0 || b.selected);

  // ── диапазон цен (без фильтра по цене) ──
  let min = Infinity;
  let max = 0;
  for (const row of baseRows) {
    if (!matchesBrand(row.brandId) || !matchesAttributes(row.id)) continue;
    min = Math.min(min, row.priceMin);
    max = Math.max(max, row.priceMin);
  }
  const priceRange = { min: Number.isFinite(min) ? min : 0, max };

  // ── итоговые товары ──
  const matchingIds = baseRows.filter((r) => matchesBrand(r.brandId) && matchesPrice(r.priceMin) && matchesAttributes(r.id)).map((r) => r.id);
  const matchingSet = new Set(matchingIds);

  const categoryCounts = new Map<string, number>();
  for (const row of baseRows) {
    if (!matchingSet.has(row.id)) continue;
    const cats = new Set<string>();
    for (const c of row.categories) for (const a of ancestorIds(index, c.categoryId)) cats.add(a);
    for (const c of cats) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }

  const total = matchingIds.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, params.page ?? 1), pages);
  const rows = total
    ? await db.product.findMany({
        where: { id: { in: matchingIds } },
        orderBy: orderBy(params.sort ?? "popular"),
        skip: (page - 1) * perPage,
        take: perPage,
        select: cardSelect,
      })
    : [];

  return { items: rows.map((r) => toCard(r, locale)), total, page, pages, perPage, facets, brands, priceRange, categoryCounts };
}

/** Разбор параметров URL каталога */
export function parseListingSearchParams(sp: Record<string, string | string[] | undefined>) {
  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const list = (key: string) =>
    (get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const filters: Record<string, string[]> = {};
  for (const key of Object.keys(sp)) {
    if (key.startsWith("f.")) filters[key.slice(2)] = list(key);
  }
  const sortRaw = get("sort");
  const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as SortKey) : "popular";
  const num = (key: string) => {
    const n = Number.parseInt(get(key) ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const availability = list("avail").filter((a): a is "in_stock" | "backorder" => a === "in_stock" || a === "backorder");
  return {
    q: get("q")?.slice(0, 100) ?? null,
    sort,
    page: num("page") ?? 1,
    priceFrom: num("pmin"),
    priceTo: num("pmax"),
    brands: list("brand"),
    availability,
    discountMin: num("disc"),
    filters,
  };
}

export type ParsedListing = ReturnType<typeof parseListingSearchParams>;
