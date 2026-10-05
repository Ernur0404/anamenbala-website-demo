/**
 * Данные для мобильных блоков каталога (как в мобильном макете): карточки разделов с числом
 * товаров, скидки по разделам, бренды с логотипами. Всё считается из существующих товаров —
 * ничего не придумывается.
 */
import { db } from "../db";
import { cached, CacheTags } from "../cache";
import { mediaSelect } from "../media/refs";
import { cardSelect, toCard, toImage, type CardRow, type ImageData, type ProductCardData } from "./cards";
import { ancestorIds, categoryPath, descendantIds, getCategoryIndex, isCategoryPublic, type CategoryIndex } from "./categories";
import { tr, trOrNull, type Locale } from "@/lib/l10n";
import type { Prisma } from "@/generated/prisma/client";

export type SaleOverview = {
  count: number;
  maxDiscount: number;
  /** по каждой категории (с учётом подкатегорий): число товаров со скидкой и наибольшая скидка */
  byCategory: Record<string, { count: number; maxDiscount: number }>;
};

/** Товары со скидкой: сколько и до скольких процентов — всего и по разделам */
export function getSaleOverview(): Promise<SaleOverview> {
  return cached("landing:sale", [CacheTags.catalog, CacheTags.categories, CacheTags.promotions], 5 * 60_000, async () => {
    const index = await getCategoryIndex();
    const rows = await db.product.findMany({
      where: { status: "PUBLISHED", discountPercent: { gt: 0 } },
      select: { discountPercent: true, categories: { select: { categoryId: true } } },
    });
    const byCategory: SaleOverview["byCategory"] = {};
    let count = 0;
    let maxDiscount = 0;
    for (const row of rows) {
      const cats = new Set<string>();
      for (const c of row.categories) if (isCategoryPublic(index, c.categoryId)) for (const a of ancestorIds(index, c.categoryId)) cats.add(a);
      if (row.categories.length && !cats.size) continue; // только в скрытых разделах
      count++;
      maxDiscount = Math.max(maxDiscount, row.discountPercent);
      for (const id of cats) {
        const entry = (byCategory[id] ??= { count: 0, maxDiscount: 0 });
        entry.count++;
        entry.maxDiscount = Math.max(entry.maxDiscount, row.discountPercent);
      }
    }
    return { count, maxDiscount, byCategory };
  });
}

export type CategoryCard = { key: string; name: string; href: string; description: string | null; image: ImageData | null; count: number | null };

/** Описание раздела для карточки: своё описание → подкатегории («Одежда, Игрушки, Кормление и другое») → текст баннера */
function cardDescription(index: CategoryIndex, id: string, locale: Locale) {
  const category = index.byId.get(id);
  if (!category) return null;
  const own = trOrNull(category, "description", locale);
  if (own) return own;
  const children = (index.children.get(id) ?? []).filter((c) => c.isVisible).map((c) => tr(c, "name", locale));
  if (children.length) {
    const head = children.slice(0, 3).join(", ");
    return children.length > 3 ? `${head} ${locale === "kk" ? "және т.б." : "и другое"}` : head;
  }
  return trOrNull(category, "heroText", locale);
}

/** Карточки корневых разделов для страницы «Каталог» на телефоне */
export async function getRootCategoryCards(locale: Locale, counts: Map<string, number>): Promise<CategoryCard[]> {
  const index = await getCategoryIndex();
  return (index.children.get(null) ?? [])
    .filter((c) => isCategoryPublic(index, c.id) && c.showInMenu)
    .map((c) => {
      const name = tr(c, "name", locale);
      return {
        key: c.id,
        name,
        href: `/catalog/${categoryPath(index, c.id)
          .map((p) => p.slug)
          .join("/")}`,
        description: cardDescription(index, c.id, locale),
        image: toImage(c.tileImage ?? c.heroImage, name),
        count: counts.get(c.id) ?? 0,
      };
    });
}

export type BrandTile = { slug: string; name: string; logo: ImageData | null };

/** Бренды с логотипами — в порядке, заданном в админке; только те, у кого есть товары в выдаче */
export async function getBrandTiles(slugs: string[]): Promise<BrandTile[]> {
  if (!slugs.length) return [];
  const rows = await cached("landing:brands", [CacheTags.catalog], 10 * 60_000, () =>
    db.brand.findMany({ where: { isVisible: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true, logo: { select: mediaSelect } } }),
  );
  const wanted = new Set(slugs);
  return rows.filter((b) => wanted.has(b.slug)).map((b) => ({ slug: b.slug, name: b.name, logo: toImage(b.logo, b.name) }));
}

/**
 * «Подобрали для вас» (главная на телефоне): товары из разделов, которые посетитель добавлял в избранное;
 * если избранного нет — популярные и с хорошими отзывами, по очереди из разных разделов.
 * Товары из блока «Популярные товары» (excludeIds) и само избранное не повторяются.
 */
export async function getForYouProducts(locale: Locale, opts: { favoriteIds: string[]; excludeIds: string[]; limit?: number }): Promise<ProductCardData[]> {
  const limit = opts.limit ?? 8;
  const index = await getCategoryIndex();
  const visible = index.all.filter((c) => isCategoryPublic(index, c.id)).map((c) => c.id);
  const base: Prisma.ProductWhereInput = { status: "PUBLISHED", OR: [{ categories: { some: { categoryId: { in: visible } } } }, { categories: { none: {} } }] };
  const select = { ...cardSelect, categories: { select: { categoryId: true }, take: 1 } } satisfies Prisma.ProductSelect;
  const rootOf = (categoryId: string | undefined) => (categoryId ? (categoryPath(index, categoryId)[0]?.id ?? "") : "");

  const favorites = new Set(opts.favoriteIds);
  const picked: CardRow[] = [];
  const taken = new Set([...favorites, ...opts.excludeIds]);

  // 1) по избранному: товары из тех же корневых разделов
  if (favorites.size) {
    const favRows = await db.product.findMany({ where: { id: { in: [...favorites] } }, select: { categories: { select: { categoryId: true } } } });
    const roots = new Set(favRows.flatMap((f) => f.categories.map((c) => rootOf(c.categoryId))).filter(Boolean));
    if (roots.size) {
      const ids = [...roots].flatMap((r) => descendantIds(index, r));
      const rows = await db.product.findMany({
        where: { AND: [base, { categories: { some: { categoryId: { in: ids } } } }, { id: { notIn: [...taken] } }] },
        orderBy: [{ inStock: "desc" }, { salesCount: "desc" }, { ratingAvg: "desc" }],
        take: limit,
        select,
      });
      for (const row of rows) {
        picked.push(row);
        taken.add(row.id);
      }
    }
  }

  // 2) добор: популярные и с хорошими отзывами — по очереди из разных разделов
  if (picked.length < limit) {
    const rows = await db.product.findMany({
      where: { AND: [base, { id: { notIn: [...taken] } }] },
      orderBy: [{ inStock: "desc" }, { ratingAvg: "desc" }, { salesCount: "desc" }, { publishedAt: "desc" }],
      take: 48,
      select,
    });
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = rootOf(row.categories[0]?.categoryId);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const queues = [...groups.values()];
    while (picked.length < limit && queues.some((q) => q.length)) {
      for (const queue of queues) {
        const row = queue.shift();
        if (row && picked.length < limit) {
          picked.push(row);
          taken.add(row.id);
        }
      }
    }
  }

  // 3) маленький каталог: добираем из популярных (кроме избранного)
  if (picked.length < limit && opts.excludeIds.length) {
    const rows = await db.product.findMany({ where: { AND: [base, { id: { in: opts.excludeIds.filter((id) => !favorites.has(id)) } }] }, select });
    for (const row of rows) if (picked.length < limit && !picked.some((p) => p.id === row.id)) picked.push(row);
  }

  return picked.map((row) => toCard(row, locale));
}
