import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

export const STAFF_SESSION_COOKIE = "amb_staff";

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // Быстрая проверка наличия cookie; настоящая проверка сессии — на сервере в каждом запросе
    const isPublic = pathname.startsWith("/admin/login");
    if (!isPublic && !request.cookies.has(STAFF_SESSION_COOKIE)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      if (pathname !== "/admin") url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return handleI18n(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|uploads|.*\\..*).*)"],
};
