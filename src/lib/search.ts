/**
 * Нормализация текста для поиска: нижний регистр, ё→е, казахские буквы → близкие русские
 * (покупатель может набрать «кофта» вместо «қофта», «уйге» вместо «үйге»).
 */
const LETTER_MAP: Record<string, string> = {
  ё: "е",
  ә: "а",
  ғ: "г",
  қ: "к",
  ң: "н",
  ө: "о",
  ұ: "у",
  ү: "у",
  һ: "х",
  і: "и",
};

export function normalizeSearch(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[ёәғқңөұүһі]/g, (ch) => LETTER_MAP[ch] ?? ch)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Токены запроса (до 8 слов) */
export function searchTokens(query: string | null | undefined): string[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];
  return [...new Set(normalized.split(" ").filter(Boolean))].slice(0, 8);
}

/** Собирает строку для поиска из частей (названия RU/KZ, артикулы, бренд, категории…) */
export function buildSearchText(parts: Array<string | null | undefined>): string {
  return normalizeSearch(parts.filter(Boolean).join(" "));
}
