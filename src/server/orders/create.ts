/**
 * Создание записи заказа из расчёта (Quote) — общая часть для сайта, ручных заказов и кассы.
 * Вызывается внутри транзакции.
 */
import type { Tx } from "../db";
import type { DeliveryMethod, PaymentMethod } from "@/generated/prisma/client";
import type { OrderChannel, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { DomainError } from "../errors";
import { randomToken } from "../crypto";
import { takeStock, type StockChange } from "../stock";
import { upsertCustomer } from "../customers";
import { adjustSalesCount } from "./helpers";
import type { Quote } from "./quote";

export type OrderMeta = {
  channel: OrderChannel;
  source?: string | null;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customer: { name: string; phone: string | null; email?: string | null };
  userId?: string | null;
  delivery?: {
    method: DeliveryMethod | null;
    region?: string | null;
    city?: string | null;
    street?: string | null;
    house?: string | null;
    apartment?: string | null;
    postalCode?: string | null;
  };
  payment?: { method: PaymentMethod | null; label?: string | null };
  comment?: string | null;
  managerNote?: string | null;
  locale?: string;
  idempotencyKey?: string | null;
  createdById?: string | null;
  isDemo?: boolean;
  createdAt?: Date;
  /** Разрешать ли «под заказ» при нехватке остатка */
  backorder: "product" | "never";
  /** Кто создал (для истории) */
  actor: { staffUserId?: string | null; actor?: "customer" | "system" };
};

const clean = (value: string | null | undefined) => {
  const v = value?.trim();
  return v ? v : null;
};

export async function createOrderRecord(tx: Tx, quote: Quote, meta: OrderMeta): Promise<{ orderId: string; number: number; accessToken: string; stockChanges: Map<string, StockChange> }> {
  const lines = quote.lines.filter((l) => l.problem !== "VARIANT_UNAVAILABLE");
  if (!lines.length) throw new DomainError("CART_EMPTY", "В заказе нет товаров");

  const customer = meta.customer.phone
    ? await upsertCustomer(tx, {
        phone: meta.customer.phone,
        name: meta.customer.name,
        email: meta.customer.email,
        city: meta.delivery?.city,
        isDemo: meta.isDemo,
      })
    : null;

  const status = meta.status ?? "NEW";
  const paymentStatus = meta.paymentStatus ?? "UNPAID";
  const now = meta.createdAt ?? new Date();
  const deliveryMethod = meta.delivery?.method ?? null;
  const paymentMethod = meta.payment?.method ?? null;
  const accessToken = randomToken(24);
  const costTotal = lines.reduce((sum, l) => sum + (l.costUnit ?? 0) * l.quantity, 0);

  const order = await tx.order.create({
    data: {
      status,
      paymentStatus,
      channel: meta.channel,
      source: clean(meta.source),
      customerId: customer?.id ?? null,
      userId: meta.userId ?? null,
      customerName: meta.customer.name.trim(),
      customerPhone: meta.customer.phone ?? "",
      customerEmail: clean(meta.customer.email),
      deliveryMethodId: deliveryMethod?.id ?? null,
      deliveryKind: deliveryMethod?.kind ?? null,
      deliveryName: deliveryMethod?.nameRu ?? null,
      region: clean(meta.delivery?.region),
      city: clean(meta.delivery?.city),
      street: clean(meta.delivery?.street),
      house: clean(meta.delivery?.house),
      apartment: clean(meta.delivery?.apartment),
      postalCode: clean(meta.delivery?.postalCode),
      comment: clean(meta.comment),
      paymentMethodId: paymentMethod?.id ?? null,
      paymentKind: paymentMethod?.kind ?? null,
      paymentName: clean(meta.payment?.label) ?? paymentMethod?.nameRu ?? null,
      promoCodeId: quote.promo?.id ?? null,
      promoCodeText: quote.promo?.code ?? null,
      itemsRegular: quote.totals.itemsRegular,
      itemsTotal: quote.totals.itemsTotal,
      itemsDiscount: quote.totals.itemsDiscount,
      promoDiscount: quote.totals.promoDiscount,
      deliveryPrice: quote.totals.deliveryPrice,
      total: quote.totals.total,
      costTotal,
      stockReserved: true,
      managerNote: clean(meta.managerNote),
      locale: meta.locale ?? "ru",
      accessToken,
      idempotencyKey: meta.idempotencyKey ?? null,
      createdById: meta.createdById ?? null,
      isDemo: meta.isDemo ?? false,
      paidAt: paymentStatus === "PAID" ? now : null,
      completedAt: status === "COMPLETED" ? now : null,
      createdAt: now,
    },
  });

  const stockChanges = await takeStock(
    tx,
    lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    { reason: meta.channel === "POS" ? "POS_SALE" : "ORDER_PLACED", orderId: order.id, staffUserId: meta.createdById ?? null },
    { backorder: meta.backorder },
  );

  await tx.orderItem.createMany({
    data: lines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      variantId: l.variantId,
      nameRu: l.nameRu,
      nameKk: l.nameKk,
      variantLabelRu: l.variantLabelRu,
      variantLabelKk: l.variantLabelKk,
      sku: l.sku,
      imageUrl: l.imageUrl,
      regularPrice: l.regularUnit,
      unitPrice: l.finalUnit,
      costPrice: l.costUnit,
      quantity: l.quantity,
      backorderQty: Math.min(l.quantity, stockChanges.get(l.variantId)?.backorder ?? 0),
      lineTotal: l.lineTotal,
    })),
  });

  if (quote.promo) {
    const updated = await tx.$executeRaw`
      UPDATE "PromoCode" SET "usedCount" = "usedCount" + 1
      WHERE "id" = ${quote.promo.id} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;
    if (updated === 0) throw new DomainError("PROMO_LIMIT", "Промокод уже использован максимальное число раз");
    await tx.promoRedemption.create({
      data: { promoCodeId: quote.promo.id, orderId: order.id, customerPhone: meta.customer.phone ?? "", amount: quote.totals.promoDiscount },
    });
  }

  await adjustSalesCount(
    tx,
    lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    1,
  );

  await tx.orderHistory.create({
    data: {
      orderId: order.id,
      kind: "CREATED",
      toValue: status,
      staffUserId: meta.actor.staffUserId ?? null,
      actor: meta.actor.staffUserId ? null : (meta.actor.actor ?? "customer"),
      createdAt: now,
    },
  });

  if (paymentStatus === "PAID") {
    await tx.payment.create({
      data: {
        orderId: order.id,
        kind: paymentMethod?.kind ?? "ON_DELIVERY",
        amount: quote.totals.total,
        status: "SUCCEEDED",
        staffUserId: meta.createdById ?? null,
        createdAt: now,
      },
    });
  }

  return { orderId: order.id, number: order.number, accessToken, stockChanges };
}
