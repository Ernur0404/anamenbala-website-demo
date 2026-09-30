export type SearchParams = Record<string, string | string[] | undefined>;

/** Первое значение параметра адреса */
export function param(sp: SearchParams, key: string): string | undefined {
  const value = sp[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() ? first.trim() : undefined;
}

export function pageParam(sp: SearchParams): number {
  const n = Number(param(sp, "page") ?? 1);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

/** Ссылка с текущими параметрами и заменой части из них (null/"" — удалить) */
export function withParams(path: string, current: SearchParams, patch: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
