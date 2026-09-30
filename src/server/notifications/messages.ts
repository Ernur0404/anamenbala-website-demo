/** Тексты уведомлений: Telegram (владельцу, по-русски) и письма покупателям (RU/KZ) */
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { escapeHtml } from "./telegram";
import { env } from "../env";

type OrderForMessage = {
  id: string;
  number: number;
  channel: string;
  source: string | null;
  customerName: string;
  customerPhone: string;
  deliveryName: string | null;
  city: string | null;
  street: string | null;
  house: string | null;
  apartment: string | null;
  comment: string | null;
  paymentName: string | null;
  itemsDiscount: number;
  promoDiscount: number;
  deliveryPrice: number;
  total: number;
  accessToken: string;
  locale: string;
  items: { nameRu: string; nameKk: string | null; variantLabelRu: string | null; variantLabelKk: string | null; quantity: number; lineTotal: number; backorderQty: number }[];
};

const CHANNEL_LABEL: Record<string, string> = { WEBSITE: "Сайт", MANUAL: "Вручную", POS: "Магазин" };

export function adminOrderUrl(orderId: string) {
  return `${env().APP_URL}/admin/orders/${orderId}`;
}

export function customerOrderUrl(order: { number: number; accessToken: string; locale: string }) {
  const prefix = order.locale === "kk" ? "/kk" : "";
  return `${env().APP_URL}${prefix}/order/${order.number}?t=${order.accessToken}`;
}

export function addressLine(o: Pick<OrderForMessage, "city" | "street" | "house" | "apartment">) {
  return [o.city, o.street && `${o.street}${o.house ? `, ${o.house}` : ""}`, o.apartment && `кв. ${o.apartment}`].filter(Boolean).join(", ");
}

export function newOrderTelegram(order: OrderForMessage) {
  const lines = [
    `🛍 <b>Новый заказ №${order.number}</b>`,
    `${CHANNEL_LABEL[order.channel] ?? order.channel}${order.source ? ` (${escapeHtml(order.source)})` : ""} · <b>${formatMoney(order.total)}</b>`,
    `👤 ${escapeHtml(order.customerName)} · ${escapeHtml(formatPhone(order.customerPhone))}`,
  ];
  if (order.deliveryName) lines.push(`🚚 ${escapeHtml(order.deliveryName)}${addressLine(order) ? `: ${escapeHtml(addressLine(order))}` : ""}`);
  if (order.paymentName) lines.push(`💳 ${escapeHtml(order.paymentName)}`);
  if (order.comment) lines.push(`💬 ${escapeHtml(order.comment)}`);
  lines.push("");
  for (const item of order.items) {
    lines.push(
      `• ${escapeHtml(item.nameRu)}${item.variantLabelRu ? ` (${escapeHtml(item.variantLabelRu)})` : ""} × ${item.quantity} — ${formatMoney(item.lineTotal)}${item.backorderQty ? ` ⏳ под заказ: ${item.backorderQty}` : ""}`,
    );
  }
  const extras: string[] = [];
  if (order.itemsDiscount + order.promoDiscount > 0) extras.push(`скидка ${formatMoney(order.itemsDiscount + order.promoDiscount)}`);
  extras.push(order.deliveryPrice > 0 ? `доставка ${formatMoney(order.deliveryPrice)}` : "доставка бесплатно");
  lines.push("", `Итого: <b>${formatMoney(order.total)}</b> (${extras.join(", ")})`);
  return { text: lines.join("\n"), buttonUrl: adminOrderUrl(order.id), buttonText: "Открыть заказ" };
}

export function lowStockTelegram(items: { name: string; label: string | null; sku: string; stock: number }[]) {
  const lines = ["⚠️ <b>Заканчивается товар</b>", ""];
  for (const item of items) {
    lines.push(`• ${escapeHtml(item.name)}${item.label ? ` (${escapeHtml(item.label)})` : ""} — осталось <b>${item.stock}</b> шт. · ${escapeHtml(item.sku)}`);
  }
  return { text: lines.join("\n"), buttonUrl: `${env().APP_URL}/admin/stock?filter=low`, buttonText: "Открыть склад" };
}

export function newReviewTelegram(review: { authorName: string; rating: number; text: string; productName: string | null }) {
  return {
    text: [
      `⭐ <b>Новый отзыв на модерации</b>`,
      review.productName ? `Товар: ${escapeHtml(review.productName)}` : "Отзыв о магазине",
      `${escapeHtml(review.authorName)} · ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`,
      "",
      escapeHtml(review.text.slice(0, 600)),
    ].join("\n"),
    buttonUrl: `${env().APP_URL}/admin/reviews`,
    buttonText: "Модерировать",
  };
}

export function contactMessageTelegram(message: { name: string; phone: string; message: string }) {
  return {
    text: [`✉️ <b>Сообщение с сайта</b>`, `${escapeHtml(message.name)} · ${escapeHtml(formatPhone(message.phone))}`, "", escapeHtml(message.message.slice(0, 1500))].join("\n"),
    buttonUrl: `${env().APP_URL}/admin/customers?tab=messages`,
    buttonText: "Открыть",
  };
}

// ───────────────────────────── Письма ─────────────────────────────

const T = {
  ru: {
    created: (n: number) => `Заказ №${n} принят`,
    thanks: "Спасибо за заказ! Мы свяжемся с вами для подтверждения.",
    status: (n: number, s: string) => `Заказ №${n}: ${s}`,
    statusText: (s: string) => `Статус вашего заказа изменился: ${s}.`,
    items: "Состав заказа",
    total: "Итого",
    delivery: "Доставка",
    free: "бесплатно",
    discount: "Скидка",
    open: "Посмотреть заказ",
    footer: "Ана мен бала — для всей семьи",
    reset: "Восстановление пароля",
    resetText: "Чтобы задать новый пароль, перейдите по ссылке (действует 1 час). Если вы не запрашивали сброс — просто проигнорируйте письмо.",
    resetButton: "Задать новый пароль",
    verify: "Подтвердите email",
    verifyText: "Подтвердите адрес почты, чтобы видеть все свои заказы в личном кабинете.",
    verifyButton: "Подтвердить email",
    backorder: "под заказ",
  },
  kk: {
    created: (n: number) => `№${n} тапсырыс қабылданды`,
    thanks: "Тапсырысыңызға рақмет! Растау үшін сізбен хабарласамыз.",
    status: (n: number, s: string) => `№${n} тапсырыс: ${s}`,
    statusText: (s: string) => `Тапсырысыңыздың күйі өзгерді: ${s}.`,
    items: "Тапсырыс құрамы",
    total: "Барлығы",
    delivery: "Жеткізу",
    free: "тегін",
    discount: "Жеңілдік",
    open: "Тапсырысты көру",
    footer: "Ана мен бала — бүкіл отбасыға",
    reset: "Құпиясөзді қалпына келтіру",
    resetText: "Жаңа құпиясөз орнату үшін сілтемеге өтіңіз (1 сағат жарамды). Егер сұрамаған болсаңыз — хатты елемеңіз.",
    resetButton: "Жаңа құпиясөз орнату",
    verify: "Email-ды растаңыз",
    verifyText: "Жеке кабинетте барлық тапсырыстарыңызды көру үшін поштаңызды растаңыз.",
    verifyButton: "Email-ды растау",
    backorder: "тапсырыспен",
  },
} as const;

function lang(locale: string) {
  return locale === "kk" ? T.kk : T.ru;
}

function layout(title: string, body: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#faf8f3;font-family:Arial,Helvetica,sans-serif;color:#2f3430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ebe5da">
<tr><td style="background:#587e63;padding:20px 28px;color:#ffffff;font-size:22px;font-family:Georgia,serif">Ана мен бала</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;font-family:Georgia,serif;font-weight:600">${escapeHtml(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px;background:#f5f1e9;color:#737974;font-size:12px">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(url: string, label: string) {
  return `<p style="margin:24px 0 0"><a href="${url}" style="display:inline-block;background:#587e63;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

function orderTable(order: OrderForMessage) {
  const t = lang(order.locale);
  const rows = order.items
    .map((i) => {
      const name = order.locale === "kk" ? i.nameKk || i.nameRu : i.nameRu;
      const label = order.locale === "kk" ? i.variantLabelKk || i.variantLabelRu : i.variantLabelRu;
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #ebe5da;font-size:14px">${escapeHtml(name)}${label ? `<br><span style="color:#737974;font-size:12px">${escapeHtml(label)}</span>` : ""}${i.backorderQty ? `<br><span style="color:#a35858;font-size:12px">${t.backorder}: ${i.backorderQty}</span>` : ""}</td><td style="padding:8px 0;border-bottom:1px solid #ebe5da;font-size:14px;text-align:right;white-space:nowrap">× ${i.quantity}<br><b>${formatMoney(i.lineTotal)}</b></td></tr>`;
    })
    .join("");
  const discount = order.itemsDiscount + order.promoDiscount;
  return `<h2 style="font-size:15px;margin:20px 0 8px">${t.items}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:14px">
${discount > 0 ? `<tr><td>${t.discount}</td><td style="text-align:right;color:#a35858">−${formatMoney(discount)}</td></tr>` : ""}
<tr><td>${t.delivery}</td><td style="text-align:right">${order.deliveryPrice > 0 ? formatMoney(order.deliveryPrice) : t.free}</td></tr>
<tr><td style="padding-top:8px;font-size:16px"><b>${t.total}</b></td><td style="padding-top:8px;text-align:right;font-size:16px"><b>${formatMoney(order.total)}</b></td></tr></table>`;
}

export function orderCreatedEmail(order: OrderForMessage & { customerEmail: string }) {
  const t = lang(order.locale);
  const url = customerOrderUrl(order);
  const subject = `${t.created(order.number)} — Ана мен бала`;
  return {
    to: order.customerEmail,
    subject,
    html: layout(t.created(order.number), `<p style="margin:0;line-height:1.6">${t.thanks}</p>${orderTable(order)}${button(url, t.open)}`, t.footer),
    text: `${t.created(order.number)}\n${t.thanks}\n${t.total}: ${formatMoney(order.total)}\n${url}`,
  };
}

export function orderStatusEmail(order: OrderForMessage & { customerEmail: string }, statusLabel: string) {
  const t = lang(order.locale);
  const url = customerOrderUrl(order);
  return {
    to: order.customerEmail,
    subject: `${t.status(order.number, statusLabel)} — Ана мен бала`,
    html: layout(t.status(order.number, statusLabel), `<p style="margin:0;line-height:1.6">${t.statusText(statusLabel)}</p>${button(url, t.open)}`, t.footer),
    text: `${t.statusText(statusLabel)}\n${url}`,
  };
}

export function passwordResetEmail(to: string, url: string, locale: string) {
  const t = lang(locale);
  return {
    to,
    subject: `${t.reset} — Ана мен бала`,
    html: layout(t.reset, `<p style="margin:0;line-height:1.6">${t.resetText}</p>${button(url, t.resetButton)}`, t.footer),
    text: `${t.resetText}\n${url}`,
  };
}

export function verifyEmailEmail(to: string, url: string, locale: string) {
  const t = lang(locale);
  return {
    to,
    subject: `${t.verify} — Ана мен бала`,
    html: layout(t.verify, `<p style="margin:0;line-height:1.6">${t.verifyText}</p>${button(url, t.verifyButton)}`, t.footer),
    text: `${t.verifyText}\n${url}`,
  };
}
