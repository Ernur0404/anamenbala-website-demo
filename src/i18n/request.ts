import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { isLocale, routing, type Locale } from "./routing";

export const ADMIN_LOCALE_COOKIE = "amb_admin_locale";
export const STORE_TIME_ZONE = "Asia/Atyrau";

/** Разделы переводов админки: messages/admin/{ru,kk}/<раздел>.json */
export const ADMIN_NAMESPACES = [
  "common",
  "nav",
  "auth",
  "errors",
  "profile",
  "dashboard",
  "orders",
  "pos",
  "products",
  "stock",
  "catalog",
  "promotions",
  "customers",
  "reviews",
  "content",
  "reports",
  "settings",
] as const;

async function loadStoreMessages(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

async function loadAdminMessages(locale: Locale) {
  const entries = await Promise.all(
    ADMIN_NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/admin/${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  if (isLocale(requested)) {
    return { locale: requested, timeZone: STORE_TIME_ZONE, messages: await loadStoreMessages(requested) };
  }
  // админка работает без префикса языка — язык берётся из профиля сотрудника (cookie)
  const fromCookie = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(fromCookie) ? fromCookie : routing.defaultLocale;
  const [store, admin] = await Promise.all([loadStoreMessages(locale), loadAdminMessages(locale)]);
  return { locale, timeZone: STORE_TIME_ZONE, messages: { ...store, admin } };
});
