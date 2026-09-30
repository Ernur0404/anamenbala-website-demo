const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** 12990 → «12 990 ₸» (неразрывные пробелы) */
export function formatMoney(amount: number): string {
  return `${numberFormat.format(Math.round(amount))} ₸`;
}

/** 12990 → «12 990» */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Разбор суммы, введённой человеком: «12 990 ₸» → 12990 */
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number.parseInt(digits, 10);
}
