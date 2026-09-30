export type Locale = "ru" | "kk";

type LocalizedSource<K extends string> = { [P in `${K}Ru`]?: string | null } & { [P in `${K}Kk`]?: string | null };

/**
 * Значение переводимого поля: для казахского — *Kk, если заполнено, иначе *Ru.
 * tr(product, "name", "kk")
 */
export function tr<K extends string>(source: LocalizedSource<K>, key: K, locale: Locale | string): string {
  const record = source as Record<string, string | null | undefined>;
  const kk = record[`${key}Kk`];
  if (locale === "kk" && kk && kk.trim()) return kk;
  return record[`${key}Ru`] ?? "";
}

/** То же, но null если поле пустое в обоих языках */
export function trOrNull<K extends string>(source: LocalizedSource<K>, key: K, locale: Locale | string): string | null {
  const value = tr(source, key, locale);
  return value.trim() ? value : null;
}

/** Пара значений из JSON-настроек вида { ru, kk } */
export function pickLocale(value: { ru?: string | null; kk?: string | null } | null | undefined, locale: Locale | string): string {
  if (!value) return "";
  if (locale === "kk" && value.kk && value.kk.trim()) return value.kk;
  return value.ru ?? "";
}
