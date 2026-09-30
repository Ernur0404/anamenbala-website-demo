"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { adminAction, staffActor } from "@/server/admin/action";
import { DomainError } from "@/server/errors";
import { can } from "@/server/permissions";
import { searchTokens } from "@/lib/search";
import { changeOrderStatus, changePaymentStatus } from "@/server/orders/status";
import { orderInfoSchema, orderItemsEditSchema, updateOrderInfo, updateOrderItems } from "@/server/orders/edit";
import { createManualOrder, createPosSale, manualOrderSchema, posSaleSchema } from "@/server/orders/staff";
import { buildQuote } from "@/server/orders/quote";
import { audit } from "@/server/audit";

const ORDER_STATUS = z.enum(["NEW", "CONFIRMED", "PACKING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"]);
const PAYMENT_STATUS = z.enum(["UNPAID", "PAID", "REFUNDED"]);

export const changeOrderStatusAction = adminAction(
  "orders",
  z.object({ orderId: z.string().min(1), to: ORDER_STATUS, comment: z.string().trim().max(500).optional().nullable() }),
  async ({ orderId, to, comment }, actor) => changeOrderStatus({ orderId, to, comment, actor: staffActor(actor) }),
);

export const changePaymentStatusAction = adminAction(
  "orders",
  z.object({ orderId: z.string().min(1), to: PAYMENT_STATUS, comment: z.string().trim().max(500).optional().nullable() }),
  async ({ orderId, to, comment }, actor) => changePaymentStatus({ orderId, to, comment, actor: staffActor(actor) }),
);

export const updateOrderItemsAction = adminAction("orders", orderItemsEditSchema.extend({ orderId: z.string().min(1) }), async ({ orderId, ...input }, actor) =>
  updateOrderItems(orderId, input, staffActor(actor)),
);

export const updateOrderInfoAction = adminAction("orders", orderInfoSchema.extend({ orderId: z.string().min(1) }), async ({ orderId, ...input }, actor) => {
  await updateOrderInfo(orderId, input, staffActor(actor));
});

export const addOrderNoteAction = adminAction("orders", z.object({ orderId: z.string().min(1), text: z.string().trim().min(1).max(1000) }), async ({ orderId, text }, actor) => {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { number: true } });
  if (!order) throw new DomainError("NOT_FOUND");
  await db.orderHistory.create({ data: { orderId, kind: "NOTE", comment: text, staffUserId: actor.id } });
  await audit({ staffUserId: actor.id, action: "order.note", entityType: "order", entityId: orderId, summary: `Заказ №${order.number}: заметка`, ip: actor.ip });
});

export const createManualOrderAction = adminAction("orders", manualOrderSchema, async (input, actor) => createManualOrder(input, staffActor(actor)), { refresh: false });

export const createPosSaleAction = adminAction("pos", posSaleSchema, async (input, actor) => createPosSale(input, staffActor(actor)), { refresh: false });

export type VariantPick = {
  variantId: string;
  productId: string;
  name: string;
  label: string | null;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  price: number;
  regularPrice: number;
  stock: number;
  allowBackorder: boolean;
  published: boolean;
};

/** Поиск товаров для заказа / кассы / склада: название (RU/KZ), артикул, штрихкод */
export const lookupVariantsAction = adminAction(
  null,
  z.object({ q: z.string().trim().min(1).max(100), limit: z.number().int().min(1).max(50).default(20) }),
  async ({ q, limit }, actor): Promise<VariantPick[]> => {
    if (!(["orders", "pos", "stock", "products"] as const).some((p) => can(actor.role, p))) throw new DomainError("FORBIDDEN");
    const tokens = searchTokens(q);
    const exact = await db.productVariant.findMany({
      where: { OR: [{ barcode: q }, { sku: { equals: q, mode: "insensitive" } }] },
      select: { id: true },
      take: 5,
    });
    const found = await db.productVariant.findMany({
      where: {
        isActive: true,
        OR: [
          { sku: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q } },
          ...(tokens.length ? [{ product: { AND: tokens.map((t) => ({ searchText: { contains: t } })) } }] : []),
        ],
      },
      orderBy: [{ product: { salesCount: "desc" } }, { productId: "asc" }, { sortOrder: "asc" }],
      take: limit,
      select: { id: true },
    });
    const ids = [...new Set([...exact.map((v) => v.id), ...found.map((v) => v.id)])].slice(0, limit);
    if (!ids.length) return [];
    const quote = await buildQuote(db, { items: ids.map((variantId) => ({ variantId, quantity: 1 })) }, { allowUnpublished: true });
    const barcodes = new Map((await db.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, barcode: true } })).map((v) => [v.id, v.barcode]));
    return quote.lines.map((l) => ({
      variantId: l.variantId,
      productId: l.productId,
      name: l.nameRu,
      label: l.variantLabelRu,
      sku: l.sku,
      barcode: barcodes.get(l.variantId) ?? null,
      imageUrl: l.imageUrl,
      price: l.finalUnit,
      regularPrice: l.regularUnit,
      stock: l.stock,
      allowBackorder: l.allowBackorder,
      published: l.productStatus === "PUBLISHED",
    }));
  },
  { refresh: false },
);
