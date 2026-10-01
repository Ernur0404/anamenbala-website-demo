/**
 * Excel: выгрузка товаров (строка = вариант) и заказов; импорт товаров из той же таблицы.
 * Импорт ищет вариант по артикулу: найден — обновляет цену, акционную цену, остаток, себестоимость,
 * штрихкод и статус; не найден, но есть название и категория — создаёт товар-черновик.
 */
import ExcelJS from "exceljs";
import { db, transaction } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { CacheTags, invalidateTags } from "../cache";
import { setStockLevel, type StockChange } from "../stock";
import { afterStockChange } from "../stock-effects";
import { getCategoryIndex, categoryPath } from "../catalog/categories";
import { canSeeFinance } from "../permissions";
import { buildWorkbook, type SheetColumn } from "./xlsx";
import { internalEan13 } from "@/lib/barcode";
import { slugify } from "@/lib/slug";
import { formatPhone } from "@/lib/phone";
import type { AdminActor } from "./action";

const STATUS_RU = { PUBLISHED: "Опубликован", DRAFT: "Черновик", HIDDEN: "Скрыт" } as const;
const STATUS_FROM = new Map<string, "PUBLISHED" | "DRAFT" | "HIDDEN">([
  ["опубликован", "PUBLISHED"],
  ["жарияланған", "PUBLISHED"],
  ["published", "PUBLISHED"],
  ["черновик", "DRAFT"],
  ["жоба", "DRAFT"],
  ["draft", "DRAFT"],
  ["скрыт", "HIDDEN"],
  ["жасырын", "HIDDEN"],
  ["hidden", "HIDDEN"],
]);

export const PRODUCT_COLUMNS = {
  sku: "Артикул (SKU)",
  barcode: "Штрихкод",
  name: "Название",
  nameKk: "Название (KZ)",
  variant: "Вариант",
  category: "Категория",
  brand: "Бренд",
  price: "Цена",
  salePrice: "Акционная цена",
  stock: "Остаток",
  cost: "Себестоимость",
  status: "Статус",
} as const;

export async function exportProducts(actor: AdminActor): Promise<Buffer> {
  const finance = canSeeFinance(actor.role);
  const index = await getCategoryIndex();
  const variants = await db.productVariant.findMany({
    orderBy: [{ product: { nameRu: "asc" } }, { sortOrder: "asc" }],
    include: {
      product: { select: { nameRu: true, nameKk: true, price: true, salePrice: true, costPrice: true, status: true, primaryCategoryId: true, brand: { select: { name: true } } } },
      optionValues: { include: { attribute: { select: { sortOrder: true } }, attributeValue: { select: { valueRu: true } } } },
    },
  });
  type V = (typeof variants)[number];
  const columns: SheetColumn<V>[] = [
    { header: PRODUCT_COLUMNS.sku, width: 20, value: (v) => v.sku },
    { header: PRODUCT_COLUMNS.barcode, width: 16, value: (v) => v.barcode },
    { header: PRODUCT_COLUMNS.name, width: 40, value: (v) => v.product.nameRu },
    { header: PRODUCT_COLUMNS.nameKk, width: 36, value: (v) => v.product.nameKk },
    { header: PRODUCT_COLUMNS.variant, width: 20, value: (v) => [...v.optionValues].sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder).map((o) => o.attributeValue.valueRu).join(" · ") },
    { header: PRODUCT_COLUMNS.category, width: 28, value: (v) => (v.product.primaryCategoryId ? categoryPath(index, v.product.primaryCategoryId).map((c) => c.nameRu).join(" / ") : "") },
    { header: PRODUCT_COLUMNS.brand, width: 16, value: (v) => v.product.brand?.name },
    { header: PRODUCT_COLUMNS.price, width: 12, value: (v) => v.price ?? v.product.price, numFmt: "#,##0" },
    { header: PRODUCT_COLUMNS.salePrice, width: 14, value: (v) => v.salePrice ?? (v.price == null ? v.product.salePrice : null), numFmt: "#,##0" },
    { header: PRODUCT_COLUMNS.stock, width: 10, value: (v) => v.stock },
    ...(finance ? [{ header: PRODUCT_COLUMNS.cost, width: 14, value: (v: V) => v.costPrice ?? v.product.costPrice, numFmt: "#,##0" }] : []),
    { header: PRODUCT_COLUMNS.status, width: 14, value: (v) => (v.isActive ? STATUS_RU[v.product.status] : `${STATUS_RU[v.product.status]} (вариант выключен)`) },
  ];
  await audit({ staffUserId: actor.id, action: "export.products", entityType: "export", summary: `Выгрузка товаров (${variants.length} вариантов)`, ip: actor.ip });
  return buildWorkbook("Товары", columns, variants);
}

export async function exportOrders(from: Date, to: Date, actor: AdminActor): Promise<Buffer> {
  const orders = await db.order.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { items: true } } },
  });
  const statuses = await import("../settings").then((m) => m.getSetting("statuses"));
  const finance = canSeeFinance(actor.role);
  type O = (typeof orders)[number];
  const columns: SheetColumn<O>[] = [
    { header: "№", width: 9, value: (o) => o.number },
    { header: "Дата", width: 18, value: (o) => o.createdAt, numFmt: "dd.mm.yyyy hh:mm" },
    { header: "Статус", width: 14, value: (o) => statuses.order[o.status].ru },
    { header: "Оплата", width: 13, value: (o) => statuses.payment[o.paymentStatus].ru },
    { header: "Канал", width: 12, value: (o) => ({ WEBSITE: "Сайт", MANUAL: "Вручную", POS: "Магазин" })[o.channel] },
    { header: "Клиент", width: 24, value: (o) => o.customerName },
    { header: "Телефон", width: 18, value: (o) => formatPhone(o.customerPhone) },
    { header: "Город", width: 16, value: (o) => o.city },
    { header: "Адрес", width: 30, value: (o) => [o.street, o.house, o.apartment && `кв. ${o.apartment}`].filter(Boolean).join(", ") },
    { header: "Доставка", width: 20, value: (o) => o.deliveryName },
    { header: "Способ оплаты", width: 20, value: (o) => o.paymentName },
    { header: "Позиций", width: 9, value: (o) => o._count.items },
    { header: "Товары, ₸", width: 12, value: (o) => o.itemsTotal, numFmt: "#,##0" },
    { header: "Промокод", width: 12, value: (o) => o.promoCodeText },
    { header: "Скидка по промокоду, ₸", width: 12, value: (o) => o.promoDiscount, numFmt: "#,##0" },
    { header: "Доставка, ₸", width: 12, value: (o) => o.deliveryPrice, numFmt: "#,##0" },
    { header: "Итого, ₸", width: 12, value: (o) => o.total, numFmt: "#,##0" },
    ...(finance ? [{ header: "Себестоимость, ₸", width: 14, value: (o: O) => o.costTotal, numFmt: "#,##0" }] : []),
    { header: "Трек-номер", width: 16, value: (o) => o.trackingNumber },
    { header: "Комментарий", width: 30, value: (o) => o.comment },
  ];
  await audit({ staffUserId: actor.id, action: "export.orders", entityType: "export", summary: `Выгрузка заказов (${orders.length})`, ip: actor.ip });
  return buildWorkbook("Заказы", columns, orders);
}

// ───────────── импорт ─────────────

type ImportRow = {
  row: number;
  sku: string;
  barcode?: string;
  name?: string;
  nameKk?: string;
  category?: string;
  brand?: string;
  price?: number;
  salePrice?: number | null;
  stock?: number;
  cost?: number | null;
  status?: "PUBLISHED" | "DRAFT" | "HIDDEN";
};

export type ImportPlan = {
  rows: number;
  updates: number;
  creates: number;
  errors: { row: number; message: string }[];
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

function cellNumber(value: ExcelJS.CellValue): number | undefined {
  const raw = cellText(value).replace(/\s|₸/g, "").replace(",", ".");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
}

async function parseWorkbook(buffer: Buffer): Promise<{ rows: ImportRow[]; errors: { row: number; message: string }[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new DomainError("VALIDATION", "Файл не похож на Excel (.xlsx)");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new DomainError("VALIDATION", "В файле нет листов");
  const header = sheet.getRow(1);
  const col = new Map<string, number>();
  header.eachCell((cell, n) => col.set(cellText(cell.value).toLowerCase(), n));
  const find = (title: string) => col.get(title.toLowerCase());
  const skuCol = find(PRODUCT_COLUMNS.sku);
  if (!skuCol) throw new DomainError("VALIDATION", `Нет столбца «${PRODUCT_COLUMNS.sku}»`);

  const rows: ImportRow[] = [];
  const errors: { row: number; message: string }[] = [];
  const seen = new Set<string>();
  sheet.eachRow((r, n) => {
    if (n === 1) return;
    const get = (title: string) => {
      const c = find(title);
      return c ? r.getCell(c).value : null;
    };
    const sku = cellText(get(PRODUCT_COLUMNS.sku)).toUpperCase();
    if (!sku) return;
    if (seen.has(sku)) {
      errors.push({ row: n, message: `Повтор артикула ${sku}` });
      return;
    }
    seen.add(sku);
    const price = cellNumber(get(PRODUCT_COLUMNS.price));
    const salePriceRaw = cellText(get(PRODUCT_COLUMNS.salePrice));
    const salePrice = salePriceRaw === "" ? undefined : salePriceRaw === "-" || salePriceRaw === "0" ? null : cellNumber(get(PRODUCT_COLUMNS.salePrice));
    const stock = cellNumber(get(PRODUCT_COLUMNS.stock));
    const costRaw = cellText(get(PRODUCT_COLUMNS.cost));
    const cost = costRaw === "" ? undefined : costRaw === "-" ? null : cellNumber(get(PRODUCT_COLUMNS.cost));
    const statusText = cellText(get(PRODUCT_COLUMNS.status)).toLowerCase().replace(/\s*\(.*\)$/, "");
    const status = statusText ? STATUS_FROM.get(statusText) : undefined;
    const bad = [
      [price, PRODUCT_COLUMNS.price],
      [salePrice, PRODUCT_COLUMNS.salePrice],
      [stock, PRODUCT_COLUMNS.stock],
      [cost, PRODUCT_COLUMNS.cost],
    ].find(([v]) => typeof v === "number" && (Number.isNaN(v) || v < 0));
    if (bad) {
      errors.push({ row: n, message: `Неверное число в столбце «${bad[1]}»` });
      return;
    }
    if (statusText && !status) {
      errors.push({ row: n, message: `Неизвестный статус «${statusText}»` });
      return;
    }
    rows.push({
      row: n,
      sku,
      barcode: cellText(get(PRODUCT_COLUMNS.barcode)) || undefined,
      name: cellText(get(PRODUCT_COLUMNS.name)) || undefined,
      nameKk: cellText(get(PRODUCT_COLUMNS.nameKk)) || undefined,
      category: cellText(get(PRODUCT_COLUMNS.category)) || undefined,
      brand: cellText(get(PRODUCT_COLUMNS.brand)) || undefined,
      price,
      salePrice: salePrice as number | null | undefined,
      stock,
      cost: cost as number | null | undefined,
      status,
    });
  });
  return { rows, errors };
}

async function resolveCategory(path: string | undefined) {
  if (!path) return null;
  const index = await getCategoryIndex();
  const parts = path.split("/").map((p) => p.trim().toLowerCase()).filter(Boolean);
  const last = parts.at(-1);
  const candidates = index.all.filter((c) => c.nameRu.toLowerCase() === last || c.nameKk?.toLowerCase() === last);
  if (parts.length > 1) {
    const parent = parts.at(-2);
    const match = candidates.find((c) => c.parentId && index.byId.get(c.parentId)?.nameRu.toLowerCase() === parent);
    if (match) return match;
  }
  return candidates[0] ?? null;
}

/** Проверка файла без изменений в базе */
export async function previewImport(buffer: Buffer): Promise<ImportPlan> {
  const { rows, errors } = await parseWorkbook(buffer);
  const existing = new Set((await db.productVariant.findMany({ where: { sku: { in: rows.map((r) => r.sku) } }, select: { sku: true } })).map((v) => v.sku.toUpperCase()));
  let updates = 0;
  let creates = 0;
  for (const r of rows) {
    if (existing.has(r.sku)) updates++;
    else if (!r.name) errors.push({ row: r.row, message: `Артикул ${r.sku} не найден, а для нового товара нет названия` });
    else if (!r.category) errors.push({ row: r.row, message: `Артикул ${r.sku} не найден: для нового товара укажите категорию` });
    else if (!(await resolveCategory(r.category))) errors.push({ row: r.row, message: `Категория «${r.category}» не найдена` });
    else if (r.price == null) errors.push({ row: r.row, message: `Для нового товара нужна цена` });
    else creates++;
  }
  return { rows: rows.length, updates, creates, errors: errors.sort((a, b) => a.row - b.row).slice(0, 200) };
}

export async function applyImport(buffer: Buffer, actor: AdminActor) {
  const plan = await previewImport(buffer);
  if (plan.errors.length) throw new DomainError("VALIDATION", "В файле есть ошибки", { plan });
  const { rows } = await parseWorkbook(buffer);
  const finance = canSeeFinance(actor.role);
  let updated = 0;
  let created = 0;
  const changes: StockChange[] = [];
  const touched = new Set<string>();

  for (const r of rows) {
    await transaction(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { sku: { equals: r.sku, mode: "insensitive" } },
        include: { product: { select: { id: true, price: true, salePrice: true, costPrice: true, publishedAt: true, _count: { select: { variants: true } } } } },
      });
      if (variant) {
        const single = variant.product._count.variants === 1;
        const productData: Record<string, unknown> = {};
        const variantData: Record<string, unknown> = {};
        if (single) {
          if (r.price != null) productData.price = r.price;
          if (r.salePrice !== undefined) productData.salePrice = r.salePrice;
          if (finance && r.cost !== undefined) productData.costPrice = r.cost;
        } else {
          // Вариант наследует цену, акцию и себестоимость товара: значение, совпадающее с унаследованным,
          // остаётся наследуемым (иначе выгрузка → загрузка без правок «отвязала» бы варианты от товара)
          const nextPrice = r.price != null ? (r.price === variant.product.price ? null : r.price) : variant.price;
          if (r.price != null) variantData.price = nextPrice;
          if (r.salePrice !== undefined) {
            const inherited = nextPrice === null ? variant.product.salePrice : null;
            // пустая акция при акции у товара — 0 («без акции» именно у этого варианта)
            variantData.salePrice = r.salePrice === inherited ? null : r.salePrice === null ? (inherited !== null ? 0 : null) : r.salePrice;
          }
          if (finance && r.cost !== undefined) variantData.costPrice = r.cost === variant.product.costPrice ? null : r.cost;
        }
        if (r.barcode && r.barcode !== variant.barcode) {
          const clash = await tx.productVariant.findFirst({ where: { barcode: r.barcode, id: { not: variant.id } }, select: { sku: true } });
          if (clash) throw new DomainError("CONFLICT", `Строка ${r.row}: штрихкод ${r.barcode} уже у ${clash.sku}`);
          variantData.barcode = r.barcode;
        }
        if (r.status) {
          productData.status = r.status;
          if (r.status === "PUBLISHED" && !variant.product.publishedAt) productData.publishedAt = new Date();
        }
        if (Object.keys(variantData).length) await tx.productVariant.update({ where: { id: variant.id }, data: variantData });
        if (Object.keys(productData).length) await tx.product.update({ where: { id: variant.product.id }, data: productData });
        if (r.stock != null && r.stock !== variant.stock) {
          const change = await setStockLevel(tx, variant.id, r.stock, { reason: "IMPORT", staffUserId: actor.id, note: "Импорт из Excel" });
          if (change) changes.push(change);
        }
        touched.add(variant.product.id);
        updated++;
      } else {
        const category = await resolveCategory(r.category);
        if (!category || !r.name || r.price == null) return;
        let slug = slugify(r.name) || "tovar";
        for (let i = 2; await tx.product.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${slugify(r.name)}-${i}`;
        const brand = r.brand ? await tx.brand.findFirst({ where: { name: { equals: r.brand, mode: "insensitive" } }, select: { id: true } }) : null;
        const product = await tx.product.create({
          data: {
            slug,
            status: r.status ?? "DRAFT",
            nameRu: r.name,
            nameKk: r.nameKk ?? null,
            price: r.price,
            salePrice: r.salePrice ?? null,
            costPrice: finance ? (r.cost ?? null) : null,
            brandId: brand?.id ?? null,
            primaryCategoryId: category.id,
            publishedAt: r.status === "PUBLISHED" ? new Date() : null,
            categories: { create: { categoryId: category.id } },
          },
        });
        const v = await tx.productVariant.create({ data: { productId: product.id, sku: r.sku, barcode: r.barcode || internalEan13(), stock: 0 } });
        if (r.stock) {
          const change = await setStockLevel(tx, v.id, r.stock, { reason: "IMPORT", staffUserId: actor.id, note: "Импорт из Excel" });
          if (change) changes.push(change);
        }
        touched.add(product.id);
        created++;
      }
    });
  }
  await audit({ staffUserId: actor.id, action: "import.products", entityType: "import", summary: `Импорт из Excel: обновлено ${updated}, создано ${created}`, ip: actor.ip });
  await afterStockChange(touched, changes);
  invalidateTags(CacheTags.catalog);
  return { updated, created };
}
