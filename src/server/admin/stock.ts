/** Склад в админке: остатки, документы (приход / списание / инвентаризация), журнал движения */
import { z } from "zod";
import { db, transaction } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import type { StockReason } from "@/generated/prisma/enums";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { getSetting } from "../settings";
import { canSeeFinance } from "../permissions";
import { putStock, setStockLevel, takeStock, type StockChange } from "../stock";
import { afterStockChange } from "../stock-effects";
import { mediaSelect } from "../media/refs";
import { searchTokens } from "@/lib/search";
import type { AdminActor } from "./action";

export const STOCK_PAGE_SIZE = 30;

const variantSelect = {
  id: true,
  sku: true,
  barcode: true,
  stock: true,
  costPrice: true,
  isActive: true,
  product: { select: { id: true, nameRu: true, costPrice: true, status: true, media: { take: 1, orderBy: { sortOrder: "asc" as const }, select: { media: { select: mediaSelect } } } } },
  optionValues: { select: { attributeValue: { select: { valueRu: true, sortOrder: true } }, attribute: { select: { sortOrder: true } } } },
} satisfies Prisma.ProductVariantSelect;

export type StockVariantRow = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;

/** «Серый · 2 года» */
export function variantLabel(v: Pick<StockVariantRow, "optionValues">): string {
  return [...v.optionValues]
    .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
    .map((o) => o.attributeValue.valueRu)
    .join(" · ");
}

function variantSearch(q: string | undefined): Prisma.ProductVariantWhereInput | undefined {
  const query = q?.trim();
  if (!query) return undefined;
  const tokens = searchTokens(query);
  return {
    OR: [
      { sku: { contains: query, mode: "insensitive" } },
      { barcode: query },
      ...(tokens.length ? [{ product: { AND: tokens.map((t) => ({ searchText: { contains: t } })) } }] : []),
    ],
  };
}

export type BalanceFilter = "all" | "low" | "out" | "inactive";

export async function listStockBalances(f: { q?: string; filter: BalanceFilter }, page: number) {
  const threshold = (await getSetting("general")).lowStockThreshold;
  const and: Prisma.ProductVariantWhereInput[] = [];
  if (f.filter === "inactive") and.push({ isActive: false });
  else and.push({ isActive: true });
  if (f.filter === "low") and.push({ stock: { gt: 0, lte: threshold } });
  if (f.filter === "out") and.push({ stock: { lte: 0 } });
  const search = variantSearch(f.q);
  if (search) and.push(search);
  const where: Prisma.ProductVariantWhereInput = { AND: and };
  const orderBy: Prisma.ProductVariantOrderByWithRelationInput[] =
    f.filter === "low" || f.filter === "out" ? [{ stock: "asc" }, { product: { nameRu: "asc" } }] : [{ product: { nameRu: "asc" } }, { sortOrder: "asc" }];
  const [rows, total] = await Promise.all([
    db.productVariant.findMany({ where, orderBy, skip: (page - 1) * STOCK_PAGE_SIZE, take: STOCK_PAGE_SIZE, select: variantSelect }),
    db.productVariant.count({ where }),
  ]);
  return { rows, total, threshold };
}

export async function stockKpis() {
  const threshold = (await getSetting("general")).lowStockThreshold;
  const [units, low, out, value] = await Promise.all([
    db.productVariant.aggregate({ where: { isActive: true, stock: { gt: 0 } }, _sum: { stock: true } }),
    db.productVariant.count({ where: { isActive: true, stock: { gt: 0, lte: threshold } } }),
    db.productVariant.count({ where: { isActive: true, stock: { lte: 0 }, product: { status: "PUBLISHED" } } }),
    db.$queryRaw<{ value: bigint | null }[]>`
      SELECT SUM(v."stock" * COALESCE(v."costPrice", p."costPrice", 0))::bigint AS value
      FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
      WHERE v."isActive" = true AND v."stock" > 0
    `,
  ]);
  return { units: units._sum.stock ?? 0, low, out, value: Number(value[0]?.value ?? 0), threshold };
}

// ───────────── быстрая корректировка ─────────────

export const adjustSchema = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(0).max(1_000_000), note: z.string().trim().max(300).optional().nullable() });

export async function adjustVariantStock(input: z.infer<typeof adjustSchema>, actor: AdminActor) {
  const change = await transaction((tx) => setStockLevel(tx, input.variantId, input.quantity, { reason: "MANUAL", staffUserId: actor.id, note: input.note || null }));
  if (change) {
    const variant = await db.productVariant.findUnique({ where: { id: input.variantId }, select: { sku: true } });
    await audit({ staffUserId: actor.id, action: "stock.adjust", entityType: "variant", entityId: input.variantId, summary: `Остаток ${variant?.sku}: ${change.before} → ${change.after}`, ip: actor.ip });
    await afterStockChange([change.productId], [change]);
  }
  return { changed: Boolean(change) };
}

// ───────────── документы ─────────────

export const stockDocSchema = z.object({
  id: z.string().optional().nullable(),
  type: z.enum(["RECEIPT", "WRITE_OFF", "ADJUSTMENT"]),
  supplier: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  lines: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(0).max(1_000_000), costPrice: z.number().int().min(0).max(100_000_000).nullable().optional() }))
    .min(1)
    .max(500),
});

export async function saveStockDocument(raw: z.infer<typeof stockDocSchema>, actor: AdminActor) {
  const input = stockDocSchema.parse(raw);
  const finance = canSeeFinance(actor.role);
  // одна строка на вариант
  const merged = new Map<string, { variantId: string; quantity: number; costPrice: number | null }>();
  for (const line of input.lines) {
    const prev = merged.get(line.variantId);
    if (prev && input.type !== "ADJUSTMENT") prev.quantity += line.quantity;
    else merged.set(line.variantId, { variantId: line.variantId, quantity: line.quantity, costPrice: finance ? (line.costPrice ?? null) : null });
  }
  const lines = [...merged.values()].filter((l) => input.type === "ADJUSTMENT" || l.quantity > 0);
  if (!lines.length) throw new DomainError("VALIDATION", "Добавьте товары", { fieldErrors: { lines: "required" } });

  return transaction(async (tx) => {
    let docId = input.id ?? null;
    if (docId) {
      const doc = await tx.stockDocument.findUnique({ where: { id: docId } });
      if (!doc) throw new DomainError("NOT_FOUND");
      if (doc.status === "POSTED") throw new DomainError("ORDER_LOCKED", "Документ уже проведён");
      await tx.stockDocument.update({ where: { id: docId }, data: { supplier: input.supplier || null, note: input.note || null } });
      await tx.stockDocumentLine.deleteMany({ where: { documentId: docId } });
    } else {
      const doc = await tx.stockDocument.create({ data: { type: input.type, supplier: input.supplier || null, note: input.note || null, createdById: actor.id } });
      docId = doc.id;
    }
    const known = await tx.productVariant.findMany({ where: { id: { in: lines.map((l) => l.variantId) } }, select: { id: true } });
    const ok = new Set(known.map((v) => v.id));
    await tx.stockDocumentLine.createMany({ data: lines.filter((l) => ok.has(l.variantId)).map((l) => ({ documentId: docId!, ...l })) });
    return { id: docId };
  });
}

export async function postStockDocument(id: string, options: { updateCost: boolean }, actor: AdminActor) {
  let changes: StockChange[] = [];
  const result = await transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; status: string }[]>`SELECT "id", "status" FROM "StockDocument" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw new DomainError("NOT_FOUND");
    if (rows[0].status === "POSTED") throw new DomainError("ORDER_LOCKED", "Документ уже проведён");
    const doc = await tx.stockDocument.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    if (!doc.lines.length) throw new DomainError("VALIDATION", "В документе нет товаров");
    const ctx = { documentId: id, staffUserId: actor.id, note: doc.note };
    let map = new Map<string, StockChange>();
    if (doc.type === "RECEIPT") {
      map = await putStock(tx, doc.lines, { ...ctx, reason: "RECEIPT" });
      if (options.updateCost && canSeeFinance(actor.role)) {
        for (const line of doc.lines) if (line.costPrice != null) await tx.productVariant.update({ where: { id: line.variantId }, data: { costPrice: line.costPrice } });
      }
    } else if (doc.type === "WRITE_OFF") {
      map = await takeStock(tx, doc.lines, { ...ctx, reason: "WRITE_OFF" }, { backorder: "never" });
    } else {
      for (const line of doc.lines) {
        const change = await setStockLevel(tx, line.variantId, line.quantity, { ...ctx, reason: "ADJUSTMENT" });
        if (change) map.set(line.variantId, change);
      }
    }
    await tx.stockDocument.update({ where: { id }, data: { status: "POSTED", postedAt: new Date(), postedById: actor.id } });
    await audit(
      { staffUserId: actor.id, action: "stock.post", entityType: "stock_document", entityId: id, summary: `Проведён документ №${doc.number} (${doc.type}), позиций: ${doc.lines.length}`, ip: actor.ip },
      tx,
    );
    changes = [...map.values()];
    return { number: doc.number };
  });
  await afterStockChange([], changes);
  return result;
}

export async function deleteStockDocument(id: string, actor: AdminActor) {
  const doc = await db.stockDocument.findUnique({ where: { id } });
  if (!doc) throw new DomainError("NOT_FOUND");
  if (doc.status === "POSTED") throw new DomainError("ORDER_LOCKED", "Проведённый документ удалить нельзя");
  await db.stockDocument.delete({ where: { id } });
  await audit({ staffUserId: actor.id, action: "stock.delete_draft", entityType: "stock_document", entityId: id, summary: `Удалён черновик №${doc.number}`, ip: actor.ip });
}

export async function listStockDocuments(page: number, type?: "RECEIPT" | "WRITE_OFF" | "ADJUSTMENT") {
  const where: Prisma.StockDocumentWhereInput = type ? { type } : {};
  const [rows, total] = await Promise.all([
    db.stockDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * STOCK_PAGE_SIZE,
      take: STOCK_PAGE_SIZE,
      include: { createdBy: { select: { name: true } }, lines: { select: { quantity: true } } },
    }),
    db.stockDocument.count({ where }),
  ]);
  return { rows, total };
}

export async function getStockDocument(id: string) {
  return db.stockDocument.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      postedBy: { select: { name: true } },
      lines: { orderBy: { id: "asc" }, include: { variant: { select: variantSelect } } },
    },
  });
}

// ───────────── журнал ─────────────

export async function listMovements(f: { q?: string; reason?: StockReason; from?: Date | null; to?: Date | null }, page: number) {
  const and: Prisma.StockMovementWhereInput[] = [];
  if (f.reason) and.push({ reason: f.reason });
  if (f.from || f.to) and.push({ createdAt: { gte: f.from ?? undefined, lt: f.to ?? undefined } });
  const search = variantSearch(f.q);
  if (search) and.push({ variant: search });
  const where: Prisma.StockMovementWhereInput = and.length ? { AND: and } : {};
  const [rows, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * STOCK_PAGE_SIZE,
      take: STOCK_PAGE_SIZE,
      include: {
        variant: { select: { id: true, sku: true, product: { select: { id: true, nameRu: true } }, optionValues: variantSelect.optionValues } },
        order: { select: { id: true, number: true } },
        document: { select: { id: true, number: true } },
        staffUser: { select: { name: true } },
      },
    }),
    db.stockMovement.count({ where }),
  ]);
  return { rows, total };
}
