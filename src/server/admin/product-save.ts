/**
 * Сохранение товара из админки: одна транзакция на все связи (категории, метки, характеристики,
 * варианты, фото). Остатки меняются только через складской сервис — с записью в журнал.
 */
import { z } from "zod";
import { db, transaction, type Tx } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { invalidateTags, CacheTags } from "../cache";
import { sanitizeHtml } from "../sanitize";
import { setStockLevel, type StockChange } from "../stock";
import { afterStockChange } from "../stock-effects";
import { canSeeFinance } from "../permissions";
import { slugify } from "@/lib/slug";
import { internalEan13 } from "@/lib/barcode";
import { addDays, storeDayStart } from "@/lib/dates";
import type { AdminActor } from "./action";

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const money = z.number().int().min(0).max(100_000_000);
const dateKey = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().nullable();

export const productSaveSchema = z.object({
  id: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]),
  nameRu: z.string().trim().min(1).max(200),
  nameKk: text(200),
  subtitleRu: text(120),
  subtitleKk: text(120),
  slug: text(100),
  brandId: z.string().optional().nullable(),
  descriptionRu: z.string().max(60_000).optional().nullable(),
  descriptionKk: z.string().max(60_000).optional().nullable(),
  price: money,
  salePrice: money.nullable().optional(),
  saleStartsAt: dateKey,
  saleEndsAt: dateKey,
  costPrice: money.nullable().optional(),
  allowBackorder: z.boolean(),
  backorderNoteRu: text(200),
  backorderNoteKk: text(200),
  videoMediaId: z.string().optional().nullable(),
  videoUrl: z.union([z.string().trim().url().max(500), z.literal("")]).optional().nullable(),
  sizeChartId: z.string().optional().nullable(),
  seoTitleRu: text(200),
  seoTitleKk: text(200),
  seoDescriptionRu: text(400),
  seoDescriptionKk: text(400),
  categoryIds: z.array(z.string()).min(1).max(20),
  primaryCategoryId: z.string().optional().nullable(),
  badgeIds: z.array(z.string()).max(10),
  attributeValueIds: z.array(z.string()).max(300),
  specs: z
    .array(z.object({ labelRu: z.string().trim().min(1).max(80), labelKk: text(80), valueRu: z.string().trim().min(1).max(300), valueKk: text(300) }))
    .max(50),
  optionAttributeIds: z.array(z.string()).max(2),
  variants: z
    .array(
      z.object({
        id: z.string().optional().nullable(),
        sku: z.string().trim().min(1).max(64),
        barcode: z.string().trim().max(32).optional().nullable(),
        price: money.nullable().optional(),
        salePrice: money.nullable().optional(),
        costPrice: money.nullable().optional(),
        stock: z.number().int().min(0).max(1_000_000),
        isActive: z.boolean(),
        optionValueIds: z.array(z.string()).max(2),
      }),
    )
    .min(1)
    .max(400),
  media: z.array(z.object({ mediaId: z.string(), colorValueId: z.string().optional().nullable() })).max(40),
});

export type ProductSaveInput = z.infer<typeof productSaveSchema>;

const nullIfBlank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

async function uniqueSlug(tx: Tx, wanted: string, selfId: string | null, explicit: boolean): Promise<string> {
  const base = slugify(wanted) || "tovar";
  const taken = async (slug: string) => {
    const row = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    return row && row.id !== selfId;
  };
  if (!(await taken(base))) return base;
  if (explicit) throw new DomainError("VALIDATION", "Адрес занят", { fieldErrors: { slug: "SLUG_TAKEN" } });
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`.slice(0, 100);
    if (!(await taken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function htmlOrNull(html: string | null | undefined) {
  if (!html) return null;
  const clean = sanitizeHtml(html).trim();
  // пустой редактор даёт <p></p>
  return clean.replace(/<p>\s*<\/p>/g, "").trim() ? clean : null;
}

export async function saveProduct(raw: ProductSaveInput, actor: AdminActor): Promise<{ id: string; slug: string; created: boolean }> {
  const input = productSaveSchema.parse(raw);
  const finance = canSeeFinance(actor.role);

  // ── проверки внутри формы ──
  const fieldErrors: Record<string, string> = {};
  const skuSeen = new Map<string, number>();
  const barcodeSeen = new Map<string, number>();
  const comboSeen = new Set<string>();
  input.variants.forEach((v, i) => {
    const sku = v.sku.toUpperCase();
    if (skuSeen.has(sku)) fieldErrors[`variants.${i}.sku`] = "duplicateSku";
    skuSeen.set(sku, i);
    const barcode = v.barcode?.trim();
    if (barcode) {
      if (barcodeSeen.has(barcode)) fieldErrors[`variants.${i}.barcode`] = "invalid";
      barcodeSeen.set(barcode, i);
    }
    if (v.optionValueIds.length !== input.optionAttributeIds.length) fieldErrors[`variants.${i}.sku`] = "invalid";
    const combo = v.optionValueIds.join("|");
    if (comboSeen.has(combo)) fieldErrors[`variants.${i}.sku`] = "invalid";
    comboSeen.add(combo);
  });
  if (Object.keys(fieldErrors).length) throw new DomainError("VALIDATION", "Проверьте варианты", { fieldErrors });

  let stockChanges: StockChange[] = [];
  const result = await transaction(
    async (tx) => {
      const existing = input.id
        ? await tx.product.findUnique({
            where: { id: input.id },
            include: { variants: { include: { _count: { select: { orderItems: true } } } } },
          })
        : null;
      if (input.id && !existing) throw new DomainError("NOT_FOUND");

      // справочные значения должны существовать
      const [categories, optionAttributes, attributeValues] = await Promise.all([
        tx.category.findMany({ where: { id: { in: input.categoryIds } }, select: { id: true } }),
        tx.attribute.findMany({ where: { id: { in: input.optionAttributeIds } }, select: { id: true } }),
        tx.attributeValue.findMany({
          where: {
            id: {
              in: [...new Set([...input.attributeValueIds, ...input.variants.flatMap((v) => v.optionValueIds), ...input.media.map((m) => m.colorValueId).filter((x): x is string => Boolean(x))])],
            },
          },
          select: { id: true, attributeId: true },
        }),
      ]);
      if (!categories.length) throw new DomainError("VALIDATION", "Нет категории", { fieldErrors: { categoryIds: "NO_CATEGORY" } });
      if (optionAttributes.length !== input.optionAttributeIds.length) throw new DomainError("VALIDATION", "Неизвестная характеристика варианта");
      const valueAttr = new Map(attributeValues.map((v) => [v.id, v.attributeId]));
      input.variants.forEach((v, i) => {
        v.optionValueIds.forEach((valueId, axis) => {
          if (valueAttr.get(valueId) !== input.optionAttributeIds[axis]) fieldErrors[`variants.${i}.sku`] = "invalid";
        });
      });
      if (Object.keys(fieldErrors).length) throw new DomainError("VALIDATION", "Проверьте варианты", { fieldErrors });

      // артикулы и штрихкоды не должны совпадать с другими товарами
      const skus = input.variants.map((v) => v.sku.toUpperCase());
      const barcodes = input.variants.map((v) => v.barcode?.trim()).filter((b): b is string => Boolean(b));
      const clashes = await tx.productVariant.findMany({
        where: { OR: [{ sku: { in: skus, mode: "insensitive" } }, { barcode: { in: barcodes } }], NOT: input.id ? { productId: input.id } : undefined },
        select: { sku: true, barcode: true },
      });
      for (const clash of clashes) {
        const si = skus.indexOf(clash.sku.toUpperCase());
        if (si >= 0) fieldErrors[`variants.${si}.sku`] = "SKU_TAKEN";
        const bi = input.variants.findIndex((v) => v.barcode?.trim() && v.barcode.trim() === clash.barcode);
        if (bi >= 0) fieldErrors[`variants.${bi}.barcode`] = "BARCODE_TAKEN";
      }
      if (Object.keys(fieldErrors).length) throw new DomainError("CONFLICT", "Артикул или штрихкод уже используется", { fieldErrors });

      const slug = await uniqueSlug(tx, nullIfBlank(input.slug) ?? input.nameRu, existing?.id ?? null, Boolean(nullIfBlank(input.slug)) && input.slug !== existing?.slug);
      const primaryCategoryId = input.primaryCategoryId && input.categoryIds.includes(input.primaryCategoryId) ? input.primaryCategoryId : input.categoryIds[0];
      const saleStartsAt = input.saleStartsAt ? storeDayStart(input.saleStartsAt) : null;
      const saleEndsAt = input.saleEndsAt ? addDays(storeDayStart(input.saleEndsAt), 1) : null;

      const data = {
        status: input.status,
        slug,
        nameRu: input.nameRu,
        nameKk: nullIfBlank(input.nameKk),
        subtitleRu: nullIfBlank(input.subtitleRu),
        subtitleKk: nullIfBlank(input.subtitleKk),
        brandId: input.brandId || null,
        primaryCategoryId,
        descriptionRu: htmlOrNull(input.descriptionRu),
        descriptionKk: htmlOrNull(input.descriptionKk),
        price: input.price,
        salePrice: input.salePrice ?? null,
        saleStartsAt: input.salePrice != null ? saleStartsAt : null,
        saleEndsAt: input.salePrice != null ? saleEndsAt : null,
        ...(finance ? { costPrice: input.costPrice ?? null } : {}),
        allowBackorder: input.allowBackorder,
        backorderNoteRu: nullIfBlank(input.backorderNoteRu),
        backorderNoteKk: nullIfBlank(input.backorderNoteKk),
        videoMediaId: input.videoMediaId || null,
        videoUrl: input.videoMediaId ? null : nullIfBlank(input.videoUrl),
        sizeChartId: input.sizeChartId || null,
        seoTitleRu: nullIfBlank(input.seoTitleRu),
        seoTitleKk: nullIfBlank(input.seoTitleKk),
        seoDescriptionRu: nullIfBlank(input.seoDescriptionRu),
        seoDescriptionKk: nullIfBlank(input.seoDescriptionKk),
        publishedAt: input.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
      };

      const product = existing ? await tx.product.update({ where: { id: existing.id }, data }) : await tx.product.create({ data });
      const productId = product.id;

      // связи — заменяем целиком
      await tx.productCategory.deleteMany({ where: { productId } });
      await tx.productCategory.createMany({ data: categories.map((c) => ({ productId, categoryId: c.id })) });
      await tx.productBadge.deleteMany({ where: { productId } });
      if (input.badgeIds.length) {
        const badges = await tx.badge.findMany({ where: { id: { in: input.badgeIds } }, select: { id: true } });
        await tx.productBadge.createMany({ data: badges.map((b) => ({ productId, badgeId: b.id })) });
      }
      await tx.productAttributeValue.deleteMany({ where: { productId } });
      const attrIds = input.attributeValueIds.filter((id) => valueAttr.has(id) && !input.optionAttributeIds.includes(valueAttr.get(id)!));
      if (attrIds.length) await tx.productAttributeValue.createMany({ data: [...new Set(attrIds)].map((attributeValueId) => ({ productId, attributeValueId })) });
      await tx.productSpec.deleteMany({ where: { productId } });
      if (input.specs.length) {
        await tx.productSpec.createMany({
          data: input.specs.map((s, i) => ({ productId, labelRu: s.labelRu, labelKk: nullIfBlank(s.labelKk), valueRu: s.valueRu, valueKk: nullIfBlank(s.valueKk), sortOrder: i })),
        });
      }
      await tx.productOption.deleteMany({ where: { productId } });
      if (input.optionAttributeIds.length) {
        await tx.productOption.createMany({ data: input.optionAttributeIds.map((attributeId, i) => ({ productId, attributeId, sortOrder: i })) });
      }

      // варианты
      const oldVariants = new Map((existing?.variants ?? []).map((v) => [v.id, v]));
      const keptIds = new Set<string>();
      const changes: StockChange[] = [];
      for (const [i, v] of input.variants.entries()) {
        const barcode = v.barcode?.trim() || internalEan13();
        const old = v.id ? oldVariants.get(v.id) : undefined;
        const variantData = {
          sku: v.sku.toUpperCase(),
          barcode,
          price: v.price ?? null,
          salePrice: v.salePrice ?? null,
          ...(finance ? { costPrice: v.costPrice ?? null } : {}),
          isActive: v.isActive,
          sortOrder: i,
        };
        let variantId: string;
        if (old) {
          await tx.productVariant.update({ where: { id: old.id }, data: variantData });
          variantId = old.id;
          keptIds.add(old.id);
          if (old.stock !== v.stock) {
            const change = await setStockLevel(tx, variantId, v.stock, { reason: "MANUAL", staffUserId: actor.id, note: "Изменено в карточке товара" });
            if (change) changes.push(change);
          }
        } else {
          const created = await tx.productVariant.create({ data: { ...variantData, productId, stock: 0 } });
          variantId = created.id;
          keptIds.add(variantId);
          if (v.stock > 0) {
            const change = await setStockLevel(tx, variantId, v.stock, { reason: "INITIAL", staffUserId: actor.id, note: "Начальный остаток" });
            if (change) changes.push(change);
          }
        }
        await tx.variantOptionValue.deleteMany({ where: { variantId } });
        if (v.optionValueIds.length) {
          await tx.variantOptionValue.createMany({
            data: v.optionValueIds.map((attributeValueId, axis) => ({ variantId, attributeId: input.optionAttributeIds[axis], attributeValueId })),
          });
        }
      }
      // убранные варианты: с заказами — выключаем (история сохраняется), без заказов — удаляем
      for (const old of oldVariants.values()) {
        if (keptIds.has(old.id)) continue;
        if (old._count.orderItems > 0) await tx.productVariant.update({ where: { id: old.id }, data: { isActive: false } });
        else await tx.productVariant.delete({ where: { id: old.id } });
      }

      // фото
      await tx.productMedia.deleteMany({ where: { productId } });
      if (input.media.length) {
        const known = await tx.media.findMany({ where: { id: { in: input.media.map((m) => m.mediaId) }, kind: "IMAGE" }, select: { id: true } });
        const ok = new Set(known.map((m) => m.id));
        await tx.productMedia.createMany({
          data: input.media
            .filter((m) => ok.has(m.mediaId))
            .map((m, i) => ({ productId, mediaId: m.mediaId, sortOrder: i, colorValueId: m.colorValueId && valueAttr.has(m.colorValueId) ? m.colorValueId : null })),
        });
      }

      await audit(
        {
          staffUserId: actor.id,
          action: existing ? "product.update" : "product.create",
          entityType: "product",
          entityId: productId,
          summary: `${existing ? "Изменён" : "Создан"} товар «${input.nameRu}»${existing && existing.status !== input.status ? ` (${existing.status} → ${input.status})` : ""}`,
          ip: actor.ip,
        },
        tx,
      );
      stockChanges = changes;
      return { id: productId, slug, created: !existing };
    },
    { timeout: 30_000 },
  );

  await afterStockChange([result.id], stockChanges);
  invalidateTags(CacheTags.catalog);
  return result;
}

/** Удаление: товар из заказов не удаляется, а скрывается (история продаж сохраняется) */
export async function deleteProducts(ids: string[], actor: AdminActor) {
  let deleted = 0;
  let hidden = 0;
  for (const id of ids) {
    const product = await db.product.findUnique({ where: { id }, select: { id: true, nameRu: true, _count: { select: { orderItems: true } } } });
    if (!product) continue;
    if (product._count.orderItems > 0) {
      await db.product.update({ where: { id }, data: { status: "HIDDEN" } });
      hidden++;
    } else {
      await db.product.delete({ where: { id } });
      deleted++;
    }
    await audit({ staffUserId: actor.id, action: product._count.orderItems ? "product.hide" : "product.delete", entityType: "product", entityId: id, summary: `${product._count.orderItems ? "Скрыт" : "Удалён"} товар «${product.nameRu}»`, ip: actor.ip });
  }
  invalidateTags(CacheTags.catalog);
  return { deleted, hidden };
}

export async function setProductsStatus(ids: string[], status: "DRAFT" | "PUBLISHED" | "HIDDEN", actor: AdminActor) {
  const now = new Date();
  await db.product.updateMany({ where: { id: { in: ids } }, data: { status } });
  if (status === "PUBLISHED") await db.product.updateMany({ where: { id: { in: ids }, publishedAt: null }, data: { publishedAt: now } });
  await audit({ staffUserId: actor.id, action: "product.bulk_status", entityType: "product", summary: `Статус ${status} для ${ids.length} товаров`, data: { ids }, ip: actor.ip });
  invalidateTags(CacheTags.catalog);
  return { count: ids.length };
}

/** Копия товара: черновик без остатков, с новыми артикулами и штрихкодами */
export async function duplicateProduct(id: string, actor: AdminActor) {
  const source = await db.product.findUnique({
    where: { id },
    include: { categories: true, badges: true, attributeValues: true, specs: true, options: true, media: true, variants: { include: { optionValues: true } } },
  });
  if (!source) throw new DomainError("NOT_FOUND");
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  const copy = await transaction(async (tx) => {
    const slug = await uniqueSlug(tx, `${source.slug}-kopiya`, null, false);
    const product = await tx.product.create({
      data: {
        slug,
        status: "DRAFT",
        nameRu: `${source.nameRu} (копия)`,
        nameKk: source.nameKk,
        subtitleRu: source.subtitleRu,
        subtitleKk: source.subtitleKk,
        descriptionRu: source.descriptionRu,
        descriptionKk: source.descriptionKk,
        brandId: source.brandId,
        primaryCategoryId: source.primaryCategoryId,
        price: source.price,
        salePrice: source.salePrice,
        saleStartsAt: source.saleStartsAt,
        saleEndsAt: source.saleEndsAt,
        costPrice: source.costPrice,
        allowBackorder: source.allowBackorder,
        backorderNoteRu: source.backorderNoteRu,
        backorderNoteKk: source.backorderNoteKk,
        videoMediaId: source.videoMediaId,
        videoUrl: source.videoUrl,
        sizeChartId: source.sizeChartId,
      },
    });
    const productId = product.id;
    if (source.categories.length) await tx.productCategory.createMany({ data: source.categories.map((c) => ({ productId, categoryId: c.categoryId })) });
    if (source.badges.length) await tx.productBadge.createMany({ data: source.badges.map((b) => ({ productId, badgeId: b.badgeId })) });
    if (source.attributeValues.length) await tx.productAttributeValue.createMany({ data: source.attributeValues.map((a) => ({ productId, attributeValueId: a.attributeValueId })) });
    if (source.specs.length) await tx.productSpec.createMany({ data: source.specs.map(({ id: _id, productId: _p, ...s }) => ({ ...s, productId })) });
    if (source.options.length) await tx.productOption.createMany({ data: source.options.map((o) => ({ productId, attributeId: o.attributeId, sortOrder: o.sortOrder })) });
    if (source.media.length) await tx.productMedia.createMany({ data: source.media.map((m) => ({ productId, mediaId: m.mediaId, sortOrder: m.sortOrder, colorValueId: m.colorValueId })) });
    for (const v of source.variants) {
      const created = await tx.productVariant.create({
        data: { productId, sku: `${v.sku}-${suffix}`.slice(0, 64), barcode: internalEan13(), price: v.price, salePrice: v.salePrice, costPrice: v.costPrice, isActive: v.isActive, sortOrder: v.sortOrder, stock: 0 },
      });
      if (v.optionValues.length) {
        await tx.variantOptionValue.createMany({ data: v.optionValues.map((o) => ({ variantId: created.id, attributeId: o.attributeId, attributeValueId: o.attributeValueId })) });
      }
    }
    await audit({ staffUserId: actor.id, action: "product.duplicate", entityType: "product", entityId: productId, summary: `Копия товара «${source.nameRu}»`, ip: actor.ip }, tx);
    return product;
  });
  await afterStockChange([copy.id]);
  return { id: copy.id };
}
