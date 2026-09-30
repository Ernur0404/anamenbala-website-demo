/**
 * Статусы заказа и оплаты.
 * Заказ: Новый → Подтверждён → Собирается → Отправлен → Доставлен → Завершён, + Отменён.
 * Оплата (отдельно): Не оплачен → Оплачен → Возврат.
 * Вперёд можно перескакивать шаги (самовывоз); назад и восстановление отменённого — только владелец.
 * Отмена и «Возврат» возвращают товар на склад ровно один раз.
 */
import { transaction } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import type { OrderStatus, PaymentStatus, StaffRole } from "@/generated/prisma/enums";
import { lockOrder, releaseOrderStock, reserveOrderStock } from "./helpers";
import { afterStockChange } from "../stock-effects";
import { notifyOrderStatus } from "../notifications";
import type { StockChange } from "../stock";

export const ORDER_FLOW: readonly OrderStatus[] = ["NEW", "CONFIRMED", "PACKING", "SHIPPED", "DELIVERED", "COMPLETED"];
export const ORDER_STATUSES: readonly OrderStatus[] = [...ORDER_FLOW, "CANCELLED"];
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["UNPAID", "PAID", "REFUNDED"];

export function orderTransitionAllowed(from: OrderStatus, to: OrderStatus, role: StaffRole): boolean {
  if (from === to) return false;
  if (to === "CANCELLED") return from !== "COMPLETED" || role === "OWNER";
  if (from === "CANCELLED") return role === "OWNER";
  const fromIndex = ORDER_FLOW.indexOf(from);
  const toIndex = ORDER_FLOW.indexOf(to);
  if (toIndex > fromIndex) return true;
  return role === "OWNER";
}

export function paymentTransitionAllowed(from: PaymentStatus, to: PaymentStatus, role: StaffRole): boolean {
  if (from === to) return false;
  if (to === "PAID") return from === "UNPAID" || role === "OWNER";
  if (to === "REFUNDED") return from === "PAID";
  if (to === "UNPAID") return role === "OWNER";
  return false;
}

export function allowedOrderTargets(from: OrderStatus, role: StaffRole): OrderStatus[] {
  return ORDER_STATUSES.filter((to) => orderTransitionAllowed(from, to, role));
}

export function allowedPaymentTargets(from: PaymentStatus, role: StaffRole): PaymentStatus[] {
  return PAYMENT_STATUSES.filter((to) => paymentTransitionAllowed(from, to, role));
}

type Actor = { staffUserId: string | null; role: StaffRole; ip?: string | null; system?: boolean };

export async function changeOrderStatus(input: { orderId: string; to: OrderStatus; comment?: string | null; actor: Actor }) {
  const { orderId, to, actor } = input;
  const comment = input.comment?.trim() || null;
  let productIds: string[] = [];
  let changes: StockChange[] = [];

  const result = await transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new DomainError("NOT_FOUND", "Заказ не найден");
    const from = order.status;
    if (!actor.system && !orderTransitionAllowed(from, to, actor.role)) {
      throw new DomainError("INVALID_TRANSITION", "Такой переход статуса недоступен", { from, to });
    }

    const now = new Date();
    if (to === "CANCELLED") {
      changes = [...(await releaseOrderStock(tx, order, "ORDER_CANCELLED", actor.staffUserId)).values()];
      // промокод освобождается
      const redemption = await tx.promoRedemption.findUnique({ where: { orderId } });
      if (redemption) {
        await tx.promoRedemption.delete({ where: { id: redemption.id } });
        await tx.$executeRaw`UPDATE "PromoCode" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "id" = ${redemption.promoCodeId}`;
      }
    } else if (from === "CANCELLED") {
      changes = [...(await reserveOrderStock(tx, order, "ORDER_RESTORED", actor.staffUserId)).values()];
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        cancelledAt: to === "CANCELLED" ? now : from === "CANCELLED" ? null : undefined,
        cancelReason: to === "CANCELLED" ? comment : from === "CANCELLED" ? null : undefined,
        completedAt: to === "COMPLETED" ? now : undefined,
      },
    });
    await tx.orderHistory.create({
      data: {
        orderId,
        kind: "STATUS",
        fromValue: from,
        toValue: to,
        comment,
        staffUserId: actor.staffUserId,
        actor: actor.staffUserId ? null : "system",
      },
    });
    if (actor.staffUserId) {
      await audit(
        { staffUserId: actor.staffUserId, action: "order.status", entityType: "order", entityId: orderId, summary: `Заказ №${order.number}: ${from} → ${to}`, ip: actor.ip },
        tx,
      );
    }
    productIds = order.items.map((i) => i.productId).filter((id): id is string => Boolean(id));
    return { from, to, number: order.number };
  });

  if (changes.length) await afterStockChange(productIds, changes);
  if (result.to !== "NEW") await notifyOrderStatus(orderId, result.to).catch((e) => console.error("[notify]", e));
  return result;
}

export async function changePaymentStatus(input: { orderId: string; to: PaymentStatus; comment?: string | null; actor: Actor }) {
  const { orderId, to, actor } = input;
  const comment = input.comment?.trim() || null;
  let productIds: string[] = [];
  let changes: StockChange[] = [];
  let autoConfirmed = false;

  const result = await transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new DomainError("NOT_FOUND", "Заказ не найден");
    const from = order.paymentStatus;
    if (!actor.system && !paymentTransitionAllowed(from, to, actor.role)) {
      throw new DomainError("INVALID_TRANSITION", "Такое изменение оплаты недоступно", { from, to });
    }
    const now = new Date();

    if (to === "PAID") {
      await tx.payment.create({
        data: { orderId, kind: order.paymentKind ?? "ON_DELIVERY", amount: order.total, status: "SUCCEEDED", staffUserId: actor.staffUserId },
      });
    } else if (to === "REFUNDED") {
      await tx.payment.create({
        data: { orderId, kind: order.paymentKind ?? "ON_DELIVERY", amount: order.total, status: "REFUNDED", staffUserId: actor.staffUserId },
      });
      // возврат товара на склад (если заказ не был отменён раньше)
      changes = [...(await releaseOrderStock(tx, order, "ORDER_RETURNED", actor.staffUserId)).values()];
    }

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: to, paidAt: to === "PAID" ? now : to === "UNPAID" ? null : undefined },
    });
    await tx.orderHistory.create({
      data: { orderId, kind: "PAYMENT", fromValue: from, toValue: to, comment, staffUserId: actor.staffUserId, actor: actor.staffUserId ? null : "system" },
    });

    // после оплаты новый заказ автоматически подтверждается
    if (to === "PAID" && order.status === "NEW") {
      await tx.order.update({ where: { id: orderId }, data: { status: "CONFIRMED" } });
      await tx.orderHistory.create({
        data: { orderId, kind: "STATUS", fromValue: "NEW", toValue: "CONFIRMED", comment: "Автоматически после оплаты", actor: "system" },
      });
      autoConfirmed = true;
    }

    if (actor.staffUserId) {
      await audit(
        { staffUserId: actor.staffUserId, action: "order.payment", entityType: "order", entityId: orderId, summary: `Заказ №${order.number}: оплата ${from} → ${to}`, ip: actor.ip },
        tx,
      );
    }
    productIds = order.items.map((i) => i.productId).filter((id): id is string => Boolean(id));
    return { from, to, number: order.number };
  });

  if (changes.length) await afterStockChange(productIds, changes);
  if (autoConfirmed) await notifyOrderStatus(orderId, "CONFIRMED").catch((e) => console.error("[notify]", e));
  return result;
}
