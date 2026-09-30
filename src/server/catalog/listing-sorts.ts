/** Варианты сортировки каталога (общие для сервера и клиента) */
export const SORTS = ["popular", "new", "price_asc", "price_desc", "discount", "rating"] as const;
export type SortKey = (typeof SORTS)[number];
