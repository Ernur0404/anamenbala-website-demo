import { db } from "../db";
import { cached, CacheTags } from "../cache";
import { mediaSelect, type MediaRef } from "../media/refs";

export type CategoryRecord = {
  id: string;
  parentId: string | null;
  slug: string;
  nameRu: string;
  nameKk: string | null;
  descriptionRu: string | null;
  descriptionKk: string | null;
  heroTitleRu: string | null;
  heroTitleKk: string | null;
  heroTextRu: string | null;
  heroTextKk: string | null;
  heroScriptRu: string | null;
  heroScriptKk: string | null;
  heroImage: MediaRef | null;
  heroMobileImage: MediaRef | null;
  tileImage: MediaRef | null;
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
  showInMenu: boolean;
  sizeChartId: string | null;
  seoTitleRu: string | null;
  seoTitleKk: string | null;
  seoDescriptionRu: string | null;
  seoDescriptionKk: string | null;
};

export type CategoryIndex = {
  all: CategoryRecord[];
  byId: Map<string, CategoryRecord>;
  bySlug: Map<string, CategoryRecord>;
  /** parentId (null — корень) → дочерние, отсортированы */
  children: Map<string | null, CategoryRecord[]>;
};

async function loadIndex(): Promise<CategoryIndex> {
  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
    select: {
      id: true,
      parentId: true,
      slug: true,
      nameRu: true,
      nameKk: true,
      descriptionRu: true,
      descriptionKk: true,
      heroTitleRu: true,
      heroTitleKk: true,
      heroTextRu: true,
      heroTextKk: true,
      heroScriptRu: true,
      heroScriptKk: true,
      heroImage: { select: mediaSelect },
      heroMobileImage: { select: mediaSelect },
      tileImage: { select: mediaSelect },
      icon: true,
      sortOrder: true,
      isVisible: true,
      showInMenu: true,
      sizeChartId: true,
      seoTitleRu: true,
      seoTitleKk: true,
      seoDescriptionRu: true,
      seoDescriptionKk: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const children = new Map<string | null, CategoryRecord[]>();
  for (const row of rows) {
    const list = children.get(row.parentId) ?? [];
    list.push(row);
    children.set(row.parentId, list);
  }
  return { all: rows, byId, bySlug, children };
}

export function getCategoryIndex(): Promise<CategoryIndex> {
  return cached("categories:index", [CacheTags.categories], 10 * 60_000, loadIndex);
}

/** Категория и все её родители (от самой категории вверх) */
export function ancestorIds(index: CategoryIndex, id: string): string[] {
  const out: string[] = [];
  let current = index.byId.get(id);
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    out.push(current.id);
    current = current.parentId ? index.byId.get(current.parentId) : undefined;
  }
  return out;
}

/** Категория и все вложенные */
export function descendantIds(index: CategoryIndex, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    if (out.includes(current)) continue;
    out.push(current);
    for (const child of index.children.get(current) ?? []) stack.push(child.id);
  }
  return out;
}

/** Набор категорий товара вместе с родителями (для скидок и промокодов) */
export function withAncestors(index: CategoryIndex, ids: readonly string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) for (const a of ancestorIds(index, id)) set.add(a);
  return [...set];
}

/** Путь от корня до категории — для хлебных крошек */
export function categoryPath(index: CategoryIndex, id: string): CategoryRecord[] {
  return ancestorIds(index, id)
    .map((a) => index.byId.get(a)!)
    .reverse();
}

/** Видима ли категория на витрине (она и все родители включены) */
export function isCategoryPublic(index: CategoryIndex, id: string): boolean {
  return ancestorIds(index, id).every((a) => index.byId.get(a)?.isVisible);
}
