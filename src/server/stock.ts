/**
 * Складские операции. Все изменения остатков — только через эти функции:
 * строки вариантов блокируются (SELECT … FOR UPDATE в порядке id — без взаимных блокировок),
 * остаток никогда не уходит в минус, каждое изменение пишется в журнал StockMovement.
 */
import type { Tx } from "./db";
import { DomainError } from "./errors";
import type { StockReason } from "@/generated/prisma/enums";

export type StockContext = {
  reason: StockReason;
  orderId?: string | null;
  documentId?: string | null;
  staffUserId?: string | null;
  note?: string | null;
};

export type StockLine = { variantId: string; quantity: number };

export type StockChange = {
  variantId: string;
  productId: string;
  before: number;
  after: number;
  /** Сколько списано со склада */
  taken: number;
  /** Сколько оформлено «под заказ» (не списывалось) */
  backorder: number;
};

type LockedRow = { id: string; stock: number; productId: string; allowBackorder: boolean };

async function lockVariants(tx: Tx, variantIds: string[]): Promise<Map<string, LockedRow>> {
  if (!variantIds.length) return new Map();
  const rows = await tx.$queryRaw<LockedRow[]>`
    SELECT v."id", v."stock", v."productId", p."allowBackorder"
    FROM "ProductVariant" v
    JOIN "Product" p ON p."id" = v."productId"
    WHERE v."id" = ANY(${variantIds}::text[])
    ORDER BY v."id"
    FOR UPDATE OF v
  `;
  return new Map(rows.map((r) => [r.id, { ...r, stock: Number(r.stock) }]));
}

function aggregate(lines: readonly StockLine[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    out.set(line.variantId, (out.get(line.variantId) ?? 0) + line.quantity);
  }
  return out;
}

async function writeMovement(tx: Tx, variantId: string, delta: number, balanceAfter: number, ctx: StockContext) {
  await tx.stockMovement.create({
    data: {
      variantId,
      delta,
      balanceAfter,
      reason: ctx.reason,
      orderId: ctx.orderId ?? null,
      documentId: ctx.documentId ?? null,
      staffUserId: ctx.staffUserId ?? null,
      note: ctx.note ?? null,
    },
  });
}

/**
 * Списание. backorder: "product" — если у товара включено «Под заказ», недостающее не списывается,
 * а помечается как backorder; "never" — нехватка = ошибка OUT_OF_STOCK.
 */
export async function takeStock(
  tx: Tx,
  lines: readonly StockLine[],
  ctx: StockContext,
  options: { backorder?: "product" | "never" } = {},
): Promise<Map<string, StockChange>> {
  const wanted = aggregate(lines);
  const locked = await lockVariants(tx, [...wanted.keys()]);
  const changes = new Map<string, StockChange>();

  for (const [variantId, quantity] of wanted) {
    const row = locked.get(variantId);
    if (!row) throw new DomainError("VARIANT_UNAVAILABLE", "Вариант товара не найден", { variantId });
    const backorderAllowed = options.backorder !== "never" && row.allowBackorder;
    let taken = quantity;
    if (row.stock < quantity) {
      if (!backorderAllowed) {
        throw new DomainError("OUT_OF_STOCK", "Недостаточно товара на складе", { variantId, available: Math.max(0, row.stock) });
      }
      taken = Math.max(0, row.stock);
    }
    const before = row.stock;
    const after = before - taken;
    if (taken > 0) {
      await tx.productVariant.update({ where: { id: variantId }, data: { stock: after } });
      await writeMovement(tx, variantId, -taken, after, ctx);
      row.stock = after;
    }
    changes.set(variantId, { variantId, productId: row.productId, before, after, taken, backorder: quantity - taken });
  }
  return changes;
}

/** Возврат / поступление на склад */
export async function putStock(tx: Tx, lines: readonly StockLine[], ctx: StockContext): Promise<Map<string, StockChange>> {
  const wanted = aggregate(lines);
  const locked = await lockVariants(tx, [...wanted.keys()]);
  const changes = new Map<string, StockChange>();
  for (const [variantId, quantity] of wanted) {
    const row = locked.get(variantId);
    if (!row) continue; // вариант удалён — возвращать некуда
    const before = row.stock;
    const after = before + quantity;
    await tx.productVariant.update({ where: { id: variantId }, data: { stock: after } });
    await writeMovement(tx, variantId, quantity, after, ctx);
    row.stock = after;
    changes.set(variantId, { variantId, productId: row.productId, before, after, taken: -quantity, backorder: 0 });
  }
  return changes;
}

/** Установить точный остаток (инвентаризация / ручная правка) */
export async function setStockLevel(tx: Tx, variantId: string, quantity: number, ctx: StockContext): Promise<StockChange | null> {
  if (quantity < 0 || !Number.isInteger(quantity)) throw new DomainError("VALIDATION", "Остаток должен быть целым числом ≥ 0");
  const locked = await lockVariants(tx, [variantId]);
  const row = locked.get(variantId);
  if (!row) throw new DomainError("NOT_FOUND", "Вариант не найден");
  const delta = quantity - row.stock;
  if (delta === 0) return null;
  await tx.productVariant.update({ where: { id: variantId }, data: { stock: quantity } });
  await writeMovement(tx, variantId, delta, quantity, ctx);
  return { variantId, productId: row.productId, before: row.stock, after: quantity, taken: -delta, backorder: 0 };
}

/**
 * Изменение количества под уже оформленный заказ (редактирование состава):
 * oldTaken — сколько было списано под заказ, newQuantity — нужное количество.
 */
export async function rebalanceStock(
  tx: Tx,
  items: ReadonlyArray<{ variantId: string; oldTaken: number; newQuantity: number }>,
  ctx: StockContext,
  options: { backorder?: "product" | "never" } = {},
): Promise<Map<string, StockChange>> {
  const byVariant = new Map<string, { oldTaken: number; newQuantity: number }>();
  for (const item of items) {
    const prev = byVariant.get(item.variantId) ?? { oldTaken: 0, newQuantity: 0 };
    byVariant.set(item.variantId, { oldTaken: prev.oldTaken + item.oldTaken, newQuantity: prev.newQuantity + item.newQuantity });
  }
  const locked = await lockVariants(tx, [...byVariant.keys()]);
  const changes = new Map<string, StockChange>();
  for (const [variantId, { oldTaken, newQuantity }] of byVariant) {
    const row = locked.get(variantId);
    if (!row) {
      if (newQuantity > 0) throw new DomainError("VARIANT_UNAVAILABLE", "Вариант товара не найден", { variantId });
      continue;
    }
    const available = row.stock + oldTaken;
    const backorderAllowed = options.backorder !== "never" && row.allowBackorder;
    let newTaken = newQuantity;
    if (newQuantity > available) {
      if (!backorderAllowed) throw new DomainError("OUT_OF_STOCK", "Недостаточно товара на складе", { variantId, available });
      newTaken = available;
    }
    const delta = oldTaken - newTaken; // >0 — вернуть на склад
    const before = row.stock;
    const after = before + delta;
    if (delta !== 0) {
      await tx.productVariant.update({ where: { id: variantId }, data: { stock: after } });
      await writeMovement(tx, variantId, delta, after, ctx);
    }
    changes.set(variantId, { variantId, productId: row.productId, before, after, taken: newTaken, backorder: newQuantity - newTaken });
  }
  return changes;
}

/** Варианты, у которых остаток опустился до порога (или ниже) именно сейчас */
export function lowStockCrossings(changes: Iterable<StockChange>, threshold: number): StockChange[] {
  const out: StockChange[] = [];
  for (const c of changes) if (c.after <= threshold && c.before > threshold) out.push(c);
  return out;
}
