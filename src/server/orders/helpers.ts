import type { Tx } from "../db";
import type { Order, OrderItem } from "@/generated/prisma/client";
import type { StockReason } from "@/generated/prisma/enums";
import { putStock, takeStock, type StockChange } from "../stock";

/** Заблокировать заказ на время изменения (защита от одновременных правок) */
export async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  return tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
}

export type OrderWithItems = Order & { items: OrderItem[] };

/** Вернуть товары заказа на склад (отмена / возврат) — ровно один раз */
export async function releaseOrderStock(
  tx: Tx,
  order: OrderWithItems,
  reason: StockReason,
  staffUserId: string | null,
): Promise<Map<string, StockChange>> {
  if (!order.stockReserved) return new Map();
  const lines = order.items
    .filter((i) => i.variantId && i.quantity - i.backorderQty > 0)
    .map((i) => ({ variantId: i.variantId!, quantity: i.quantity - i.backorderQty }));
  const changes = await putStock(tx, lines, { reason, orderId: order.id, staffUserId });
  await tx.order.update({ where: { id: order.id }, data: { stockReserved: false } });
  await adjustSalesCount(tx, order.items, -1);
  return changes;
}

/** Снова зарезервировать товары (восстановление отменённого заказа) */
export async function reserveOrderStock(
  tx: Tx,
  order: OrderWithItems,
  reason: StockReason,
  staffUserId: string | null,
): Promise<Map<string, StockChange>> {
  if (order.stockReserved) return new Map();
  const lines = order.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity }));
  const changes = await takeStock(tx, lines, { reason, orderId: order.id, staffUserId }, { backorder: order.channel === "POS" ? "never" : "product" });
  for (const item of order.items) {
    if (!item.variantId) continue;
    const change = changes.get(item.variantId);
    const backorderQty = change ? Math.min(item.quantity, change.backorder) : 0;
    if (backorderQty !== item.backorderQty) await tx.orderItem.update({ where: { id: item.id }, data: { backorderQty } });
  }
  await tx.order.update({ where: { id: order.id }, data: { stockReserved: true } });
  await adjustSalesCount(tx, order.items, 1);
  return changes;
}

export async function adjustSalesCount(tx: Tx, items: ReadonlyArray<Pick<OrderItem, "productId" | "quantity">>, sign: 1 | -1) {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  }
  for (const [productId, quantity] of byProduct) {
    if (sign > 0) {
      await tx.product.update({ where: { id: productId }, data: { salesCount: { increment: quantity } } });
    } else {
      await tx.$executeRaw`UPDATE "Product" SET "salesCount" = GREATEST(0, "salesCount" - ${quantity}) WHERE "id" = ${productId}`;
    }
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
