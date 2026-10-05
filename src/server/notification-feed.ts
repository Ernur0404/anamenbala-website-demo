/**
 * Уведомления покупателя (колокольчик на сайте): статусы его заказов, акции, новинки и объявления магазина.
 * Отдельно ничего не хранится — лента собирается из заказов, акций, товаров и объявлений;
 * «прочитано» — время последнего просмотра в cookie браузера (ставится на странице уведомлений).
 */
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { db } from "./db";
import { cached, CacheTags } from "./cache";
import { getCurrentUser } from "./auth/customer";
import { categoryPath, getCategoryIndex, isCategoryPublic } from "./catalog/categories";
import { mediaSelect } from "./media/refs";
import { orderStatusLabels } from "./order-view";
import { ORDER_STATUSES } from "./orders/status";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { mediaUrl } from "@/lib/media-url";
import { formatMoney } from "@/lib/money";
import { formatDayMonth, formatTime, toStoreDateKey } from "@/lib/dates";
import type { Locale } from "@/lib/l10n";
import {
  countUnread,
  noticeDate,
  NOTIFICATIONS_SEEN_COOKIE,
  parseOrderTokens,
  parseSeenCookie,
  unreadSince,
  weekStartKey,
  type NotificationIcon,
  type NotificationView,
} from "@/lib/notifications";

/** Ссылки на гостевые заказы, оформленные в этом браузере */
export const GUEST_ORDERS_COOKIE = "amb_orders";

const DAY = 86_400_000;
const ORDER_DAYS = 60;
const NEW_DAYS = 30;
const MAX_ITEMS = 60;

type Localized = { ru: string; kk: string | null };
type OrderEventType = Exclude<OrderStatus, "NEW"> | "CREATED" | "PAID" | "REFUNDED";

type OrderEvent = {
  kind: "order";
  id: string;
  date: Date;
  event: OrderEventType;
  number: number;
  total: number;
  trackingNumber: string | null;
  /** Причина отмены — сотрудник пишет её для покупателя */
  reason: string | null;
  href: string;
};
type SaleNotice = { kind: "sale"; id: string; date: Date; name: Localized; endsAt: Date | null; href: string };
type NewWeek = { kind: "new"; id: string; date: Date; count: number; products: { name: Localized; image: string | null }[] };
type NewsNotice = { kind: "news"; id: string; date: Date; title: Localized; text: Localized | null; url: string | null };
type RawNotification = OrderEvent | SaleNotice | NewWeek | NewsNotice;

/** Сейчас действует: начало не в будущем, конец не наступил */
function live(now: Date) {
  return { AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };
}

/** Общая часть ленты (одинакова для всех посетителей) — в кэше, сбрасывается при изменениях в админке */
function getPublicNotices(): Promise<RawNotification[]> {
  return cached("notifications:public", [CacheTags.promotions, CacheTags.catalog, CacheTags.categories, CacheTags.content], 5 * 60_000, async () => {
    const now = new Date();
    const [promotions, products, news, index] = await Promise.all([
      db.promotion.findMany({
        where: { isActive: true, ...live(now) },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, nameRu: true, nameKk: true, scope: true, startsAt: true, endsAt: true, createdAt: true, categories: { select: { categoryId: true } }, brands: { select: { brand: { select: { slug: true } } } } },
      }),
      db.product.findMany({
        where: { status: "PUBLISHED", publishedAt: { gte: new Date(now.getTime() - NEW_DAYS * DAY), lte: now } },
        orderBy: { publishedAt: "desc" },
        take: 200,
        select: { nameRu: true, nameKk: true, publishedAt: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } } },
      }),
      db.announcement.findMany({ where: { isActive: true, ...live(now) }, orderBy: { createdAt: "desc" }, take: 20 }),
      getCategoryIndex(),
    ]);

    const items: RawNotification[] = [];
    for (const p of promotions) {
      let href = "/sale";
      const categoryId = p.scope === "CATEGORY" && p.categories.length === 1 ? p.categories[0].categoryId : null;
      if (categoryId && index.byId.has(categoryId) && isCategoryPublic(index, categoryId)) {
        href = `/catalog/${categoryPath(index, categoryId)
          .map((c) => c.slug)
          .join("/")}`;
      } else if (p.scope === "BRAND" && p.brands.length === 1) {
        href = `/catalog?brand=${encodeURIComponent(p.brands[0].brand.slug)}`;
      }
      items.push({ kind: "sale", id: `sale:${p.id}`, date: noticeDate(p.startsAt, p.createdAt), name: { ru: p.nameRu, kk: p.nameKk }, endsAt: p.endsAt, href });
    }

    // новинки — одним уведомлением за неделю (товары отсортированы от новых, первый в неделе — самый свежий)
    const weeks = new Map<string, NewWeek>();
    for (const p of products) {
      if (!p.publishedAt) continue;
      const key = weekStartKey(toStoreDateKey(p.publishedAt));
      let week = weeks.get(key);
      if (!week) {
        week = { kind: "new", id: `new:${key}`, date: p.publishedAt, count: 0, products: [] };
        weeks.set(key, week);
      }
      week.count += 1;
      if (week.products.length < 3) week.products.push({ name: { ru: p.nameRu, kk: p.nameKk }, image: mediaUrl(p.media[0]?.media, 160) });
    }
    items.push(...weeks.values());

    for (const a of news) {
      items.push({
        kind: "news",
        id: `news:${a.id}`,
        date: noticeDate(a.startsAt, a.createdAt),
        title: { ru: a.titleRu, kk: a.titleKk },
        text: a.textRu ? { ru: a.textRu, kk: a.textKk } : null,
        url: a.url,
      });
    }
    return items;
  });
}

/** События заказов этого покупателя: аккаунт и гостевые заказы из этого браузера */
async function getOrderEvents(): Promise<OrderEvent[]> {
  const [user, store] = await Promise.all([getCurrentUser(), cookies()]);
  const tokens = parseOrderTokens(store.get(GUEST_ORDERS_COOKIE)?.value);
  const owners: Prisma.OrderWhereInput[] = [];
  if (user) owners.push({ userId: user.id });
  // заказ, оформленный под аккаунтом, виден только этому аккаунту
  if (tokens.length) owners.push({ accessToken: { in: tokens }, userId: null });
  if (!owners.length) return [];

  const since = new Date(Date.now() - ORDER_DAYS * DAY);
  const orders = await db.order.findMany({
    where: { OR: owners, channel: { not: "POS" }, updatedAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      number: true,
      accessToken: true,
      userId: true,
      total: true,
      trackingNumber: true,
      history: { where: { kind: { in: ["CREATED", "STATUS", "PAYMENT"] }, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, kind: true, toValue: true, comment: true, createdAt: true } },
    },
  });

  const events: OrderEvent[] = [];
  for (const o of orders) {
    const href = user && o.userId === user.id ? `/account/orders/${o.number}` : `/order/${o.number}?t=${o.accessToken}`;
    for (const h of o.history) {
      let event: OrderEventType | null = null;
      if (h.kind === "CREATED") event = "CREATED";
      else if (h.kind === "PAYMENT" && (h.toValue === "PAID" || h.toValue === "REFUNDED")) event = h.toValue;
      else if (h.kind === "STATUS" && h.toValue && h.toValue !== "NEW" && (ORDER_STATUSES as readonly string[]).includes(h.toValue)) event = h.toValue as OrderEventType;
      if (!event) continue;
      const reason = event === "CANCELLED" && h.comment?.trim() ? h.comment.trim() : null;
      events.push({ kind: "order", id: `order:${h.id}`, date: h.createdAt, event, number: o.number, total: o.total, trackingNumber: o.trackingNumber, reason, href });
    }
  }
  return events;
}

const collect = cache(async (): Promise<RawNotification[]> => {
  const [publicNotices, orderEvents] = await Promise.all([getPublicNotices(), getOrderEvents()]);
  const now = Date.now();
  return [...orderEvents, ...publicNotices]
    .filter((n) => n.date.getTime() <= now)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, MAX_ITEMS);
});

async function seenAt(): Promise<number | null> {
  return parseSeenCookie((await cookies()).get(NOTIFICATIONS_SEEN_COOKIE)?.value);
}

/** Число непрочитанных для колокольчика в шапке (ошибка не должна ломать страницу) */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const [items, seen] = await Promise.all([collect(), seenAt()]);
    return countUnread(items.map((i) => i.date), seen);
  } catch (error) {
    // служебные сигналы Next.js (динамическая страница, редирект) пропускаем дальше
    unstable_rethrow(error);
    console.error("[notifications] не удалось посчитать уведомления", error);
    return 0;
  }
}

const ORDER_ICONS: Record<OrderEventType, NotificationIcon> = {
  CREATED: "created",
  CONFIRMED: "confirmed",
  PACKING: "packing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  PAID: "paid",
  REFUNDED: "refunded",
};

/** Лента для страницы «Уведомления»; renderedAt — время сборки (с ним браузер запомнит «просмотрено») */
export async function getNotifications(locale: Locale): Promise<{ items: NotificationView[]; renderedAt: number }> {
  const [items, seen, t, labels] = await Promise.all([collect(), seenAt(), getTranslations({ locale, namespace: "notifications" }), orderStatusLabels(locale)]);
  const now = new Date();
  const since = unreadSince(seen, now.getTime());
  const pick = (value: Localized) => (locale === "kk" && value.kk?.trim() ? value.kk : value.ru);
  const today = toStoreDateKey(now);
  const yesterday = toStoreDateKey(new Date(now.getTime() - DAY));
  const dateLabel = (date: Date) => {
    const key = toStoreDateKey(date);
    if (key === today) return t("today", { time: formatTime(date, locale) });
    if (key === yesterday) return t("yesterday", { time: formatTime(date, locale) });
    return formatDayMonth(date, locale);
  };

  const views = items.map((n): NotificationView => {
    const base = { id: n.id, kind: n.kind, dateLabel: dateLabel(n.date), unread: n.date.getTime() > since, images: [] as string[] };
    switch (n.kind) {
      case "order": {
        const total = formatMoney(n.total);
        let title: string;
        if (n.event === "CREATED") title = t("order.created", { number: n.number });
        else if (n.event === "PAID") title = t("order.paid", { number: n.number });
        else if (n.event === "REFUNDED") title = t("order.refunded", { number: n.number });
        else {
          const label = labels.order[n.event].label;
          title = t("order.status", { number: n.number, status: label.charAt(0).toLocaleLowerCase(locale) + label.slice(1) });
        }
        let text = n.reason ? t("cancelReason", { reason: n.reason }) : t(`orderText.${n.event}`, { total });
        if (n.event === "SHIPPED" && n.trackingNumber) text += ` ${t("tracking", { track: n.trackingNumber })}`;
        return { ...base, icon: ORDER_ICONS[n.event], title, text, href: n.href };
      }
      case "sale":
        return {
          ...base,
          icon: "sale",
          title: pick(n.name),
          // конец акции хранится как начало следующего дня — показываем последний день
          text: n.endsAt ? t("saleUntil", { date: formatDayMonth(new Date(n.endsAt.getTime() - 1), locale) }) : t("saleNow"),
          href: n.href,
        };
      case "new": {
        const names = n.products.slice(0, 2).map((p) => pick(p.name));
        const rest = n.count - names.length;
        return {
          ...base,
          icon: "new",
          title: t("newTitle", { count: n.count }),
          text: names.join(", ") + (rest > 0 ? ` ${t("newMore", { count: rest })}` : ""),
          href: "/catalog?sort=new",
          images: n.products.map((p) => p.image).filter((src): src is string => Boolean(src)),
        };
      }
      case "news":
        return { ...base, icon: "news", title: pick(n.title), text: n.text ? pick(n.text) : null, href: n.url };
    }
  });
  return { items: views, renderedAt: now.getTime() };
}
