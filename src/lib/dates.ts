export const STORE_TIME_ZONE = "Asia/Atyrau";

function intlLocale(locale: string) {
  return locale === "kk" ? "kk-KZ" : "ru-RU";
}

/** 30.10.2025 */
export function formatDate(value: Date | string | null | undefined, locale = "ru"): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: STORE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

/** 30.10.2025, 14:32 */
export function formatDateTime(value: Date | string | null | undefined, locale = "ru"): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: STORE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** 14:32 */
export function formatTime(value: Date | string | null | undefined, locale = "ru"): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: STORE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** «30 октября» */
export function formatDayMonth(value: Date | string, locale = "ru"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: STORE_TIME_ZONE,
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

/** YYYY-MM-DD в часовом поясе магазина */
export function toStoreDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  return parts;
}

/** Смещение часового пояса магазина (минуты) — для полуночи по местному времени */
function storeOffsetMinutes(at: Date): number {
  const local = new Date(at.toLocaleString("en-US", { timeZone: STORE_TIME_ZONE }));
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 60000);
}

/** Начало суток (00:00 по времени магазина) для даты YYYY-MM-DD, как UTC Date */
export function storeDayStart(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - storeOffsetMinutes(guess) * 60000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
