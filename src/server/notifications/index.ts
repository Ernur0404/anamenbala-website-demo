/** Высокоуровневые уведомления: решают, кому и что отправить, по настройкам */
import { db } from "../db";
import { getSetting } from "../settings";
import { lowStockCrossings, type StockChange } from "../stock";
import { enqueueNotification, kickNotificationQueue, type TelegramPayload } from "./queue";
import {
  contactMessageTelegram,
  lowStockTelegram,
  newOrderTelegram,
  newReviewTelegram,
  orderCreatedEmail,
  orderStatusEmail,
} from "./messages";
import type { OrderStatus } from "@/generated/prisma/enums";

/** Текст для письма-копии из Telegram-сообщения (HTML уже экранирован) */
function staffEmailCopy(to: string, payload: TelegramPayload) {
  const plain = payload.text
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  const link = payload.buttonUrl ? `<p><a href="${payload.buttonUrl}">${payload.buttonText ?? "Открыть"}</a></p>` : "";
  return {
    to,
    subject: plain.split("\n")[0].slice(0, 150),
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#2F3430">${payload.text.replace(/\n/g, "<br>")}${link}</div>`,
    text: payload.buttonUrl ? `${plain}\n\n${payload.buttonUrl}` : plain,
  };
}

/** Уведомление сотрудникам: Telegram + копии на email владельца (если указаны) */
async function notifyStaff(settings: { adminEmails: string[] }, event: string, payload: TelegramPayload) {
  await enqueueNotification(db, { channel: "TELEGRAM", event, payload });
  for (const to of settings.adminEmails) {
    await enqueueNotification(db, { channel: "EMAIL", event: `${event}.staff`, payload: staffEmailCopy(to, payload) });
  }
}

async function loadOrder(orderId: string) {
  return db.order.findUnique({ where: { id: orderId }, include: { items: true } });
}

export async function notifyNewOrder(orderId: string) {
  const [order, settings] = await Promise.all([loadOrder(orderId), getSetting("notifications")]);
  if (!order || order.isDemo) return;
  // заказы, созданные сотрудниками (вручную, касса), в Telegram не дублируются
  if (settings.events.newOrder && order.channel === "WEBSITE") {
    await notifyStaff(settings, "order.created", newOrderTelegram(order));
  }
  if (order.customerEmail && settings.customerEmails.orderCreated && order.channel === "WEBSITE") {
    await enqueueNotification(db, { channel: "EMAIL", event: "order.created.customer", payload: orderCreatedEmail({ ...order, customerEmail: order.customerEmail }) });
  }
  await kickNotificationQueue();
}

export async function notifyOrderStatus(orderId: string, status: OrderStatus) {
  const [order, settings, statuses] = await Promise.all([loadOrder(orderId), getSetting("notifications"), getSetting("statuses")]);
  if (!order || order.isDemo || !order.customerEmail || !settings.customerEmails.statusChanged) return;
  const label = statuses.order[status];
  const text = order.locale === "kk" ? label.kk || label.ru : label.ru;
  await enqueueNotification(db, { channel: "EMAIL", event: "order.status.customer", payload: orderStatusEmail({ ...order, customerEmail: order.customerEmail }, text) });
  await kickNotificationQueue();
}

export async function notifyLowStock(changes: Iterable<StockChange>) {
  const [general, settings] = await Promise.all([getSetting("general"), getSetting("notifications")]);
  if (!settings.events.lowStock) return;
  const crossings = lowStockCrossings(changes, general.lowStockThreshold);
  if (!crossings.length) return;
  const variants = await db.productVariant.findMany({
    where: { id: { in: crossings.map((c) => c.variantId) }, product: { isDemo: false } },
    select: {
      id: true,
      sku: true,
      stock: true,
      product: { select: { nameRu: true } },
      optionValues: { select: { attributeValue: { select: { valueRu: true } } } },
    },
  });
  if (!variants.length) return;
  await notifyStaff(
    settings,
    "stock.low",
    lowStockTelegram(
      variants.map((v) => ({
        name: v.product.nameRu,
        label: v.optionValues.map((o) => o.attributeValue.valueRu).join(", ") || null,
        sku: v.sku,
        stock: v.stock,
      })),
    ),
  );
  await kickNotificationQueue();
}

export async function notifyNewReview(reviewId: string) {
  const settings = await getSetting("notifications");
  if (!settings.events.newReview) return;
  const review = await db.review.findUnique({ where: { id: reviewId }, include: { product: { select: { nameRu: true } } } });
  if (!review || review.source !== "SITE") return;
  await notifyStaff(
    settings,
    "review.created",
    newReviewTelegram({ authorName: review.authorName, rating: review.rating, text: review.text, productName: review.product?.nameRu ?? null }),
  );
  await kickNotificationQueue();
}

export async function notifyContactMessage(messageId: string) {
  const settings = await getSetting("notifications");
  if (!settings.events.contactMessage) return;
  const message = await db.contactMessage.findUnique({ where: { id: messageId } });
  if (!message) return;
  await notifyStaff(settings, "contact.created", contactMessageTelegram(message));
  await kickNotificationQueue();
}
