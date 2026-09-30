"use client";

import { useTranslations } from "next-intl";
import { Heart, House, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useStore } from "./store-provider";
import { useMobileMenu } from "./catalog-menu";
import { CountBadge } from "./header-actions";
import { cn } from "@/lib/utils";

/** Нижняя панель навигации для телефона */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { cartCount, favorites } = useStore();
  const { setOpen } = useMobileMenu();

  // на оформлении заказа внизу экрана — кнопка подтверждения
  if (pathname === "/checkout") return null;

  const item = (active: boolean) =>
    cn("flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10.5px] font-semibold transition-colors", active ? "text-sage-700" : "text-ink-500");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t("menu")}>
      <div className="flex h-[58px]">
        <Link href="/" className={item(pathname === "/")}>
          <House className="size-[22px] stroke-[1.7]" />
          {t("home")}
        </Link>
        <button type="button" onClick={() => setOpen(true)} className={item(pathname.startsWith("/catalog"))}>
          <LayoutGrid className="size-[22px] stroke-[1.7]" />
          {t("catalog")}
        </button>
        <Link href="/favorites" className={item(pathname === "/favorites")}>
          <span className="relative">
            <Heart className="size-[22px] stroke-[1.7]" />
            <CountBadge count={favorites.size} tone="powder" />
          </span>
          {t("favorites")}
        </Link>
        <Link href="/cart" className={item(pathname === "/cart" || pathname === "/checkout")}>
          <span className="relative">
            <ShoppingBag className="size-[22px] stroke-[1.7]" />
            <CountBadge count={cartCount} />
          </span>
          {t("cart")}
        </Link>
        <Link href="/account" className={item(pathname.startsWith("/account"))}>
          <User className="size-[22px] stroke-[1.7]" />
          {t("account")}
        </Link>
      </div>
    </nav>
  );
}
