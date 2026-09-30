import { addDays, storeDayStart, toStoreDateKey } from "@/lib/dates";
import { param, type SearchParams } from "@/components/admin/url";

export const PERIOD_KEYS = ["today", "7d", "30d", "90d", "month", "prevMonth", "year", "all", "custom"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export type ResolvedPeriod = {
  key: PeriodKey;
  /** Начало (включительно) и конец (не включительно); null — без ограничения */
  from: Date | null;
  to: Date | null;
  /** Предыдущий период той же длины — для «↑ 12% к прошлому периоду» */
  prevFrom: Date | null;
  prevTo: Date | null;
  /** YYYY-MM-DD для полей выбора дат */
  fromKey: string | null;
  toKey: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthStartKey(dateKey: string, shift = 0): string {
  const [y, m] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + shift, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Период из адреса: ?period=30d или ?from=2026-09-01&to=2026-09-30 (даты по времени магазина) */
export function resolvePeriod(sp: SearchParams, fallback: PeriodKey, now = new Date()): ResolvedPeriod {
  const fromParam = param(sp, "from");
  const toParam = param(sp, "to");
  const raw = param(sp, "period");
  const key: PeriodKey = (PERIOD_KEYS as readonly string[]).includes(raw ?? "") ? (raw as PeriodKey) : fromParam || toParam ? "custom" : fallback;

  const today = toStoreDateKey(now);
  const todayStart = storeDayStart(today);
  const tomorrow = addDays(todayStart, 1);
  let from: Date | null = null;
  let to: Date | null = null;

  switch (key) {
    case "today":
      [from, to] = [todayStart, tomorrow];
      break;
    case "7d":
      [from, to] = [addDays(todayStart, -6), tomorrow];
      break;
    case "30d":
      [from, to] = [addDays(todayStart, -29), tomorrow];
      break;
    case "90d":
      [from, to] = [addDays(todayStart, -89), tomorrow];
      break;
    case "month":
      [from, to] = [storeDayStart(monthStartKey(today)), tomorrow];
      break;
    case "prevMonth":
      [from, to] = [storeDayStart(monthStartKey(today, -1)), storeDayStart(monthStartKey(today))];
      break;
    case "year":
      [from, to] = [storeDayStart(`${today.slice(0, 4)}-01-01`), tomorrow];
      break;
    case "custom": {
      const f = fromParam && DATE_RE.test(fromParam) ? fromParam : null;
      const t = toParam && DATE_RE.test(toParam) ? toParam : null;
      from = f ? storeDayStart(f) : null;
      to = t ? addDays(storeDayStart(t), 1) : null;
      if (from && to && to <= from) [from, to] = [addDays(to, -1), addDays(from, 1)];
      break;
    }
    case "all":
      break;
  }

  let prevFrom: Date | null = null;
  let prevTo: Date | null = null;
  if (from && to) {
    if (key === "month") {
      // месяц на сегодня сравниваем с тем же числом дней прошлого месяца
      prevFrom = storeDayStart(monthStartKey(today, -1));
      prevTo = new Date(prevFrom.getTime() + (to.getTime() - from.getTime()));
    } else if (key === "prevMonth") {
      prevFrom = storeDayStart(monthStartKey(today, -2));
      prevTo = from;
    } else {
      prevTo = from;
      prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    }
  }

  return {
    key,
    from,
    to,
    prevFrom,
    prevTo,
    fromKey: from ? toStoreDateKey(from) : null,
    toKey: to ? toStoreDateKey(addDays(to, -1)) : null,
  };
}

/** Изменение в процентах; null — сравнивать не с чем */
export function deltaPercent(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function dateRange(from: Date | null, to: Date | null) {
  return from || to ? { gte: from ?? undefined, lt: to ?? undefined } : undefined;
}
