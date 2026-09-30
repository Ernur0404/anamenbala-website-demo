import { cookies } from "next/headers";
import { isProduction } from "../env";
import { ADMIN_LOCALE_COOKIE } from "@/i18n/request";

/** Язык интерфейса админки хранится в профиле сотрудника и дублируется в cookie */
export async function setAdminLocaleCookie(locale: string) {
  (await cookies()).set(ADMIN_LOCALE_COOKIE, locale === "kk" ? "kk" : "ru", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
}
