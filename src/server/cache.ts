/**
 * Простой кэш в памяти процесса с тегами.
 * Магазин работает одним процессом на VPS, поэтому этого достаточно; любое изменение в админке
 * вызывает invalidateTags(...) — и витрина сразу показывает новые данные.
 */
type Entry = { value: unknown; expires: number; tags: string[] };

const globalStore = globalThis as unknown as { __ambCache?: Map<string, Entry>; __ambPending?: Map<string, Promise<unknown>> };
const store = (globalStore.__ambCache ??= new Map<string, Entry>());
const pending = (globalStore.__ambPending ??= new Map<string, Promise<unknown>>());

export async function cached<T>(key: string, tags: string[], ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;

  const promise = loader()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs, tags });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

export function invalidateTags(...tags: string[]) {
  if (tags.length === 0) return;
  for (const [key, entry] of store) {
    if (entry.tags.some((t) => tags.includes(t))) store.delete(key);
  }
}

export function clearCache() {
  store.clear();
}

/** Теги кэша */
export const CacheTags = {
  settings: "settings",
  categories: "categories",
  attributes: "attributes",
  catalog: "catalog",
  promotions: "promotions",
  content: "content",
  delivery: "delivery",
  reviews: "reviews",
} as const;
