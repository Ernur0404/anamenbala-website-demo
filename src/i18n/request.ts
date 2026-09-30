import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { isLocale, routing, type Locale } from "./routing";

export const ADMIN_LOCALE_COOKIE = "amb_admin_locale";
export const STORE_TIME_ZONE = "Asia/Atyrau";

async function loadMessages(locale: Locale) {
  const [store, admin] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/admin-${locale}.json`),
  ]);
  return { ...store.default, admin: admin.default };
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: Locale;
  if (isLocale(requested)) {
    locale = requested;
  } else {
    // админка работает без префикса языка — язык берётся из профиля сотрудника (cookie)
    const fromCookie = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
    locale = isLocale(fromCookie) ? fromCookie : routing.defaultLocale;
  }
  return {
    locale,
    timeZone: STORE_TIME_ZONE,
    messages: await loadMessages(locale),
  };
});
