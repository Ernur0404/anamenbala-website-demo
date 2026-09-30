/** Справочники каталога в админке: категории, характеристики, бренды, метки, таблицы размеров */
import { z } from "zod";
import { db, transaction, type Tx } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { CacheTags, invalidateTags } from "../cache";
import { refreshProductIndex } from "../catalog/indexer";
import { slugify } from "@/lib/slug";
import type { AdminActor } from "./action";

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const id = z.string().min(1);
const optionalId = z.string().optional().nullable();
const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

async function reindexWhere(where: Prisma.ProductWhereInput) {
  const products = await db.product.findMany({ where, select: { id: true } });
  // пересчёт по частям, чтобы не держать долгую транзакцию
  for (let i = 0; i < products.length; i += 50) await refreshProductIndex(products.slice(i, i + 50).map((p) => p.id));
}

async function uniqueSlug(check: (slug: string) => Promise<boolean>, wanted: string, fallback: string) {
  const base = slugify(wanted) || fallback;
  if (!(await check(base))) return base;
  for (let i = 2; i < 200; i++) if (!(await check(`${base}-${i}`))) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36)}`;
}

// ───────────── категории ─────────────

export const categorySchema = z.object({
  id: optionalId,
  parentId: optionalId,
  nameRu: z.string().trim().min(1).max(100),
  nameKk: text(100),
  slug: text(100),
  descriptionRu: text(2000),
  descriptionKk: text(2000),
  heroTitleRu: text(200),
  heroTitleKk: text(200),
  heroTextRu: text(400),
  heroTextKk: text(400),
  heroScriptRu: text(120),
  heroScriptKk: text(120),
  heroImageId: optionalId,
  heroMobileImageId: optionalId,
  tileImageId: optionalId,
  icon: text(40),
  sizeChartId: optionalId,
  isVisible: z.boolean(),
  showInMenu: z.boolean(),
  seoTitleRu: text(200),
  seoTitleKk: text(200),
  seoDescriptionRu: text(400),
  seoDescriptionKk: text(400),
  attributes: z.array(z.object({ attributeId: id, isFilter: z.boolean() })).max(60),
});

export async function saveCategory(raw: z.infer<typeof categorySchema>, actor: AdminActor) {
  const input = categorySchema.parse(raw);
  const result = await transaction(async (tx) => {
    const existing = input.id ? await tx.category.findUnique({ where: { id: input.id }, include: { _count: { select: { children: true } } } }) : null;
    if (input.id && !existing) throw new DomainError("NOT_FOUND");
    // каталог двухуровневый: родителем может быть только категория верхнего уровня
    const parentId = input.parentId || null;
    if (parentId) {
      const parent = await tx.category.findUnique({ where: { id: parentId } });
      if (!parent || parent.parentId || parent.id === existing?.id) throw new DomainError("VALIDATION", "Неверная родительская категория", { fieldErrors: { parentId: "invalid" } });
      if (existing && existing._count.children > 0) throw new DomainError("VALIDATION", "У категории есть подкатегории", { fieldErrors: { parentId: "invalid" } });
    }
    const wantedSlug = blank(input.slug) ?? input.nameRu;
    const slug = await uniqueSlug(
      async (s) => {
        const row = await tx.category.findUnique({ where: { slug: s }, select: { id: true } });
        return Boolean(row && row.id !== existing?.id);
      },
      wantedSlug,
      "category",
    );
    const data = {
      parentId,
      slug,
      nameRu: input.nameRu,
      nameKk: blank(input.nameKk),
      descriptionRu: blank(input.descriptionRu),
      descriptionKk: blank(input.descriptionKk),
      heroTitleRu: blank(input.heroTitleRu),
      heroTitleKk: blank(input.heroTitleKk),
      heroTextRu: blank(input.heroTextRu),
      heroTextKk: blank(input.heroTextKk),
      heroScriptRu: blank(input.heroScriptRu),
      heroScriptKk: blank(input.heroScriptKk),
      heroImageId: input.heroImageId || null,
      heroMobileImageId: input.heroMobileImageId || null,
      tileImageId: input.tileImageId || null,
      icon: blank(input.icon),
      sizeChartId: input.sizeChartId || null,
      isVisible: input.isVisible,
      showInMenu: input.showInMenu,
      seoTitleRu: blank(input.seoTitleRu),
      seoTitleKk: blank(input.seoTitleKk),
      seoDescriptionRu: blank(input.seoDescriptionRu),
      seoDescriptionKk: blank(input.seoDescriptionKk),
    };
    let categoryId: string;
    if (existing) {
      await tx.category.update({ where: { id: existing.id }, data });
      categoryId = existing.id;
    } else {
      const last = await tx.category.findFirst({ where: { parentId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      categoryId = (await tx.category.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } })).id;
    }
    await tx.categoryAttribute.deleteMany({ where: { categoryId } });
    if (input.attributes.length) {
      const known = new Set((await tx.attribute.findMany({ where: { id: { in: input.attributes.map((a) => a.attributeId) } }, select: { id: true } })).map((a) => a.id));
      await tx.categoryAttribute.createMany({
        data: input.attributes.filter((a) => known.has(a.attributeId)).map((a, i) => ({ categoryId, attributeId: a.attributeId, isFilter: a.isFilter, sortOrder: i })),
        skipDuplicates: true,
      });
    }
    await audit({ staffUserId: actor.id, action: existing ? "category.update" : "category.create", entityType: "category", entityId: categoryId, summary: `${existing ? "Изменена" : "Создана"} категория «${input.nameRu}»`, ip: actor.ip }, tx);
    return { id: categoryId, renamed: Boolean(existing && (existing.nameRu !== input.nameRu || existing.nameKk !== blank(input.nameKk))) };
  });
  invalidateTags(CacheTags.categories, CacheTags.catalog, CacheTags.attributes);
  if (result.renamed) await reindexWhere({ categories: { some: { categoryId: result.id } } });
  return { id: result.id };
}

export async function moveCategory(categoryId: string, direction: "up" | "down", actor: AdminActor) {
  await transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new DomainError("NOT_FOUND");
    const siblings = await tx.category.findMany({ where: { parentId: category.parentId }, orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }], select: { id: true } });
    const index = siblings.findIndex((s) => s.id === categoryId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
    for (const [i, s] of siblings.entries()) await tx.category.update({ where: { id: s.id }, data: { sortOrder: i } });
    await audit({ staffUserId: actor.id, action: "category.sort", entityType: "category", entityId: categoryId, summary: `Изменён порядок категории «${category.nameRu}»`, ip: actor.ip }, tx);
  });
  invalidateTags(CacheTags.categories, CacheTags.catalog);
}

export async function toggleCategory(categoryId: string, field: "isVisible" | "showInMenu", value: boolean, actor: AdminActor) {
  const category = await db.category.update({ where: { id: categoryId }, data: { [field]: value } });
  await audit({ staffUserId: actor.id, action: "category.toggle", entityType: "category", entityId: categoryId, summary: `«${category.nameRu}»: ${field} = ${value}`, ip: actor.ip });
  invalidateTags(CacheTags.categories, CacheTags.catalog);
}

export async function deleteCategory(categoryId: string, actor: AdminActor) {
  const category = await db.category.findUnique({ where: { id: categoryId }, include: { _count: { select: { children: true, products: true } } } });
  if (!category) throw new DomainError("NOT_FOUND");
  if (category._count.children > 0 || category._count.products > 0) throw new DomainError("CONFLICT", "В категории есть товары или подкатегории", { reason: "categoryHasProducts" });
  await db.category.delete({ where: { id: categoryId } });
  await audit({ staffUserId: actor.id, action: "category.delete", entityType: "category", entityId: categoryId, summary: `Удалена категория «${category.nameRu}»`, ip: actor.ip });
  invalidateTags(CacheTags.categories, CacheTags.catalog, CacheTags.attributes);
}

// ───────────── характеристики ─────────────

export const attributeSchema = z.object({
  id: optionalId,
  code: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
  nameRu: z.string().trim().min(1).max(80),
  nameKk: text(80),
  type: z.enum(["SELECT", "MULTISELECT", "COLOR"]),
  display: z.enum(["CHECKBOX", "CHIPS", "SWATCH"]),
  isFilterable: z.boolean(),
  isVariantAxis: z.boolean(),
  unit: text(20),
  values: z
    .array(
      z.object({
        id: optionalId,
        valueRu: z.string().trim().min(1).max(80),
        valueKk: text(80),
        slug: text(60),
        colorHex: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).optional().nullable(),
      }),
    )
    .max(400),
});

export async function saveAttribute(raw: z.infer<typeof attributeSchema>, actor: AdminActor) {
  const input = attributeSchema.parse(raw);
  const result = await transaction(async (tx: Tx) => {
    const existing = input.id ? await tx.attribute.findUnique({ where: { id: input.id }, include: { values: true } }) : null;
    if (input.id && !existing) throw new DomainError("NOT_FOUND");
    const codeClash = await tx.attribute.findUnique({ where: { code: input.code }, select: { id: true } });
    if (codeClash && codeClash.id !== existing?.id) throw new DomainError("CONFLICT", "Код занят", { fieldErrors: { code: "CONFLICT" } });
    const data = {
      code: input.code,
      nameRu: input.nameRu,
      nameKk: blank(input.nameKk),
      type: input.type,
      display: input.display,
      isFilterable: input.isFilterable,
      isVariantAxis: input.isVariantAxis,
      unit: blank(input.unit),
    };
    let attributeId: string;
    if (existing) attributeId = (await tx.attribute.update({ where: { id: existing.id }, data })).id;
    else {
      const last = await tx.attribute.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      attributeId = (await tx.attribute.create({ data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } })).id;
    }

    // значения: удалённые — только если не используются
    const keep = new Set(input.values.map((v) => v.id).filter(Boolean) as string[]);
    const removed = (existing?.values ?? []).filter((v) => !keep.has(v.id));
    for (const value of removed) {
      const [inVariants, inProducts] = await Promise.all([tx.variantOptionValue.count({ where: { attributeValueId: value.id } }), tx.productAttributeValue.count({ where: { attributeValueId: value.id } })]);
      if (inVariants + inProducts > 0) throw new DomainError("CONFLICT", "Значение используется", { reason: "valueInUse", value: value.valueRu });
      await tx.attributeValue.delete({ where: { id: value.id } });
    }
    const taken = new Set((existing?.values ?? []).filter((v) => keep.has(v.id)).map((v) => v.slug));
    let renamed = false;
    for (const [i, v] of input.values.entries()) {
      const old = v.id ? existing?.values.find((x) => x.id === v.id) : undefined;
      const valueData = { valueRu: v.valueRu, valueKk: blank(v.valueKk), colorHex: v.colorHex || null, sortOrder: i };
      if (old) {
        if (old.valueRu !== v.valueRu || old.valueKk !== valueData.valueKk) renamed = true;
        await tx.attributeValue.update({ where: { id: old.id }, data: valueData });
      } else {
        let slug = slugify(blank(v.slug) ?? v.valueRu) || `v${i}`;
        for (let n = 2; taken.has(slug); n++) slug = `${slugify(v.valueRu) || "v"}-${n}`;
        taken.add(slug);
        await tx.attributeValue.create({ data: { ...valueData, attributeId, slug } });
      }
    }
    await audit({ staffUserId: actor.id, action: existing ? "attribute.update" : "attribute.create", entityType: "attribute", entityId: attributeId, summary: `${existing ? "Изменена" : "Создана"} характеристика «${input.nameRu}»`, ip: actor.ip }, tx);
    return { id: attributeId, renamed };
  });
  invalidateTags(CacheTags.attributes, CacheTags.categories, CacheTags.catalog);
  if (result.renamed) await reindexWhere({ facets: { some: { attributeValue: { attributeId: result.id } } } });
  return { id: result.id };
}

export async function deleteAttribute(attributeId: string, actor: AdminActor) {
  const attribute = await db.attribute.findUnique({ where: { id: attributeId }, include: { _count: { select: { productOptions: true, variantValues: true } } } });
  if (!attribute) throw new DomainError("NOT_FOUND");
  if (attribute._count.productOptions + attribute._count.variantValues > 0) throw new DomainError("CONFLICT", "Используется в вариантах", { reason: "attrInUse" });
  const affected = await db.product.findMany({ where: { attributeValues: { some: { attributeValue: { attributeId } } } }, select: { id: true } });
  await db.attribute.delete({ where: { id: attributeId } });
  await audit({ staffUserId: actor.id, action: "attribute.delete", entityType: "attribute", entityId: attributeId, summary: `Удалена характеристика «${attribute.nameRu}»`, ip: actor.ip });
  invalidateTags(CacheTags.attributes, CacheTags.categories, CacheTags.catalog);
  await refreshProductIndex(affected.map((p) => p.id));
}

export async function moveAttribute(attributeId: string, direction: "up" | "down") {
  const all = await db.attribute.findMany({ orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }], select: { id: true } });
  const index = all.findIndex((a) => a.id === attributeId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= all.length) return;
  [all[index], all[target]] = [all[target], all[index]];
  await transaction(async (tx) => {
    for (const [i, a] of all.entries()) await tx.attribute.update({ where: { id: a.id }, data: { sortOrder: i } });
  });
  invalidateTags(CacheTags.attributes, CacheTags.categories);
}

// ───────────── бренды ─────────────

export const brandSchema = z.object({ id: optionalId, name: z.string().trim().min(1).max(80), slug: text(80), logoId: optionalId, isVisible: z.boolean() });

export async function saveBrand(raw: z.infer<typeof brandSchema>, actor: AdminActor) {
  const input = brandSchema.parse(raw);
  const existing = input.id ? await db.brand.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !existing) throw new DomainError("NOT_FOUND");
  const slug = await uniqueSlug(
    async (s) => {
      const row = await db.brand.findUnique({ where: { slug: s }, select: { id: true } });
      return Boolean(row && row.id !== existing?.id);
    },
    blank(input.slug) ?? input.name,
    "brand",
  );
  const data = { name: input.name, slug, logoId: input.logoId || null, isVisible: input.isVisible };
  const brand = existing
    ? await db.brand.update({ where: { id: existing.id }, data })
    : await db.brand.create({ data: { ...data, sortOrder: ((await db.brand.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1 } });
  await audit({ staffUserId: actor.id, action: existing ? "brand.update" : "brand.create", entityType: "brand", entityId: brand.id, summary: `Бренд «${brand.name}»`, ip: actor.ip });
  invalidateTags(CacheTags.catalog);
  if (existing && existing.name !== brand.name) await reindexWhere({ brandId: brand.id });
  return { id: brand.id };
}

export async function deleteBrand(brandId: string, actor: AdminActor) {
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new DomainError("NOT_FOUND");
  const products = await db.product.findMany({ where: { brandId }, select: { id: true } });
  await db.brand.delete({ where: { id: brandId } });
  await audit({ staffUserId: actor.id, action: "brand.delete", entityType: "brand", entityId: brandId, summary: `Удалён бренд «${brand.name}»`, ip: actor.ip });
  invalidateTags(CacheTags.catalog, CacheTags.promotions);
  await refreshProductIndex(products.map((p) => p.id));
}

// ───────────── метки ─────────────

export const badgeSchema = z.object({
  id: optionalId,
  code: text(40),
  nameRu: z.string().trim().min(1).max(30),
  nameKk: text(30),
  style: z.enum(["SAGE", "POWDER", "BEIGE", "GRAPHITE"]),
  isActive: z.boolean(),
});

export async function saveBadge(raw: z.infer<typeof badgeSchema>, actor: AdminActor) {
  const input = badgeSchema.parse(raw);
  const existing = input.id ? await db.badge.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !existing) throw new DomainError("NOT_FOUND");
  const code = existing?.code ?? (await uniqueSlug(async (s) => Boolean(await db.badge.findUnique({ where: { code: s }, select: { id: true } })), blank(input.code) ?? input.nameRu, "badge"));
  const data = { nameRu: input.nameRu, nameKk: blank(input.nameKk), style: input.style, isActive: input.isActive };
  const badge = existing
    ? await db.badge.update({ where: { id: existing.id }, data })
    : await db.badge.create({ data: { ...data, code, sortOrder: ((await db.badge.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1 } });
  await audit({ staffUserId: actor.id, action: existing ? "badge.update" : "badge.create", entityType: "badge", entityId: badge.id, summary: `Метка «${badge.nameRu}»`, ip: actor.ip });
  invalidateTags(CacheTags.catalog);
  return { id: badge.id };
}

export async function deleteBadge(badgeId: string, actor: AdminActor) {
  const badge = await db.badge.delete({ where: { id: badgeId } }).catch(() => null);
  if (!badge) throw new DomainError("NOT_FOUND");
  await audit({ staffUserId: actor.id, action: "badge.delete", entityType: "badge", entityId: badgeId, summary: `Удалена метка «${badge.nameRu}»`, ip: actor.ip });
  invalidateTags(CacheTags.catalog);
}

// ───────────── таблицы размеров ─────────────

export const sizeChartSchema = z.object({
  id: optionalId,
  nameRu: z.string().trim().min(1).max(100),
  nameKk: text(100),
  noteRu: text(500),
  noteKk: text(500),
  columns: z.array(z.object({ ru: z.string().trim().max(40), kk: z.string().trim().max(40).default("") })).min(1).max(12),
  rows: z.array(z.array(z.string().trim().max(40)).max(12)).max(60),
});

export async function saveSizeChart(raw: z.infer<typeof sizeChartSchema>, actor: AdminActor) {
  const input = sizeChartSchema.parse(raw);
  const width = input.columns.length;
  const rows = input.rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")).filter((r) => r.some((cell) => cell));
  const data = { nameRu: input.nameRu, nameKk: blank(input.nameKk), noteRu: blank(input.noteRu), noteKk: blank(input.noteKk), columns: input.columns, rows };
  const chart = input.id ? await db.sizeChart.update({ where: { id: input.id }, data }) : await db.sizeChart.create({ data });
  await audit({ staffUserId: actor.id, action: input.id ? "size_chart.update" : "size_chart.create", entityType: "size_chart", entityId: chart.id, summary: `Таблица размеров «${chart.nameRu}»`, ip: actor.ip });
  return { id: chart.id };
}

export async function deleteSizeChart(chartId: string, actor: AdminActor) {
  const chart = await db.sizeChart.delete({ where: { id: chartId } }).catch(() => null);
  if (!chart) throw new DomainError("NOT_FOUND");
  await audit({ staffUserId: actor.id, action: "size_chart.delete", entityType: "size_chart", entityId: chartId, summary: `Удалена таблица размеров «${chart.nameRu}»`, ip: actor.ip });
  invalidateTags(CacheTags.categories);
}

export async function moveSorted(model: "brand" | "badge", itemId: string, direction: "up" | "down") {
  const rows = model === "brand" ? await db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } }) : await db.badge.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const index = rows.findIndex((r) => r.id === itemId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  await transaction(async (tx) => {
    for (const [i, r] of rows.entries()) {
      if (model === "brand") await tx.brand.update({ where: { id: r.id }, data: { sortOrder: i } });
      else await tx.badge.update({ where: { id: r.id }, data: { sortOrder: i } });
    }
  });
  invalidateTags(CacheTags.catalog);
}
