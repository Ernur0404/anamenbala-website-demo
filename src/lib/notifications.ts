/** Уведомления покупателя (колокольчик): общие типы и чистые функции без БД */

export type NotificationKind = "order" | "sale" | "new" | "news";

/** Время последнего просмотра уведомлений (ставит браузер на странице уведомлений) */
export const NOTIFICATIONS_SEEN_COOKIE = "amb_ntf";

/** Значок уведомления: шаг заказа или тип */
export type NotificationIcon =
  | "created"
  | "confirmed"
  | "packing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "paid"
  | "refunded"
  | "sale"
  | "new"
  | "news";

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  icon: NotificationIcon;
  title: string;
  text: string | null;
  href: string | null;
  /** «Сегодня, 14:20» / «Вчера, 09:15» / «29 сентября» */
  dateLabel: string;
  images: string[];
  unread: boolean;
};

/** Новому посетителю непрочитанными считаются уведомления за последние дни, а не вся лента */
export const FIRST_VISIT_DAYS = 7;

/** С какого момента уведомление считается новым */
export function unreadSince(seenAt: number | null, now: number = Date.now()): number {
  return seenAt ?? now - FIRST_VISIT_DAYS * 86_400_000;
}

export function countUnread(dates: readonly Date[], seenAt: number | null, now: number = Date.now()): number {
  const since = unreadSince(seenAt, now);
  return dates.filter((d) => d.getTime() > since && d.getTime() <= now).length;
}

/** Понедельник недели (YYYY-MM-DD) для даты YYYY-MM-DD — новинки собираются в одно уведомление за неделю */
export function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** Дата уведомления об акции/объявлении: начало показа, но не раньше создания (иначе запись «задним числом» не станет новой) */
export function noticeDate(startsAt: Date | null, createdAt: Date): Date {
  return startsAt && startsAt > createdAt ? startsAt : createdAt;
}

/** Значение cookie «просмотрено» → время или null */
export function parseSeenCookie(value: string | undefined): number | null {
  if (!value || !/^\d{10,15}$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

/** Токены гостевых заказов этого браузера (новые первыми, не больше max) */
export function parseOrderTokens(value: string | undefined, max = 10): string[] {
  if (!value) return [];
  return value
    .split(".")
    .filter((t) => /^[A-Za-z0-9_-]{16,64}$/.test(t))
    .slice(0, max);
}

export function addOrderToken(value: string | undefined, token: string, max = 10): string {
  return [token, ...parseOrderTokens(value, max).filter((t) => t !== token)].slice(0, max).join(".");
}
