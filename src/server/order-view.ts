/** Заказ для покупателя: по номеру и секретной ссылке (гость) или по аккаунту */
import { db } from "./db";
import { safeEqual } from "./crypto";
import { getSetting } from "./settings";
import { getCurrentUser } from "./auth/customer";
import { ORDER_FLOW } from "./orders/status";
import { formatMoney } from "@/lib/money";
import { pickLocale, type Locale } from "@/lib/l10n";
import { whatsappLink } from "@/lib/phone";
import type { OrderStatus } from "@/generated/prisma/enums";

export async function findCustomerOrder(number: number, token: string | null | undefined) {
  if (!Number.isInteger(number) || number <= 0) return null;
  const order = await db.order.findUnique({
    where: { number },
    include: {
      items: true,
      history: { where: { kind: { in: ["CREATED", "STATUS"] } }, orderBy: { createdAt: "asc" } },
      paymentMethod: true,
    },
  });
  if (!order || order.channel === "POS") return null;
  if (token && safeEqual(token, order.accessToken)) return order;
  const user = await getCurrentUser();
  if (user && order.userId === user.id) return order;
  return null;
}

export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof findCustomerOrder>>>;

export async function orderStatusLabels(locale: Locale) {
  const statuses = await getSetting("statuses");
  const order = Object.fromEntries(Object.entries(statuses.order).map(([k, v]) => [k, { label: pickLocale(v, locale), tone: v.tone }])) as Record<OrderStatus, { label: string; tone: string }>;
  const payment = Object.fromEntries(Object.entries(statuses.payment).map(([k, v]) => [k, { label: pickLocale(v, locale), tone: v.tone }])) as Record<string, { label: string; tone: string }>;
  return { order, payment };
}

/** Шаги для шкалы статуса (самовывоз пропускает «Отправлен») */
export function statusTimeline(order: CustomerOrder) {
  const flow = ORDER_FLOW.filter((s) => !(order.deliveryKind === "PICKUP" && s === "SHIPPED"));
  const reached = new Map<string, Date>();
  for (const h of order.history) if (h.toValue) reached.set(h.toValue, h.createdAt);
  const currentIndex = flow.indexOf(order.status);
  return flow.map((status, i) => ({
    status,
    done: order.status !== "CANCELLED" && (i <= currentIndex || reached.has(status)),
    current: status === order.status,
    at: reached.get(status) ?? null,
  }));
}

/** Готовое сообщение для WhatsApp: номер, состав, сумма */
export async function orderWhatsappLink(order: CustomerOrder, locale: Locale, texts: { greeting: string; total: string }) {
  const contacts = await getSetting("contacts");
  const lines = order.items.map((i) => {
    const name = locale === "kk" ? i.nameKk || i.nameRu : i.nameRu;
    const label = locale === "kk" ? i.variantLabelKk || i.variantLabelRu : i.variantLabelRu;
    return `• ${name}${label ? ` (${label})` : ""} × ${i.quantity} — ${formatMoney(i.lineTotal)}`;
  });
  const message = [texts.greeting, "", ...lines, "", texts.total].join("\n");
  return whatsappLink(contacts.whatsapp, message);
}
