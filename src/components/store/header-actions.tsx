"use client";

import { useTranslations } from "next-intl";
import { Bell, Heart, ShoppingBag, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useStore } from "./store-provider";
import { cn } from "@/lib/utils";

function CountBadge({ count, tone = "sage" }: { count: number; tone?: "sage" | "powder" }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -top-1.5 -right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] leading-none font-bold text-white ring-2 ring-cream",
        tone === "sage" ? "bg-sage-700" : "bg-powder-600",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function HeaderActions({ userName }: { userName: string | null }) {
  const t = useTranslations("nav");
  const { cartCount, favorites, notificationCount } = useStore();
  const item = "group flex flex-col items-center gap-1 text-[12px] font-medium text-ink-700 transition-colors hover:text-sage-700";
  return (
    <div className="flex items-center gap-7">
      <Link href="/account" className={item}>
        <User className="size-6 stroke-[1.6]" />
        <span className="max-w-20 truncate">{userName ? userName.split(" ")[0] : t("login")}</span>
      </Link>
      <Link href="/favorites" className={item}>
        <span className="relative">
          <Heart className="size-6 stroke-[1.6]" />
          <CountBadge count={favorites.size} tone="powder" />
        </span>
        <span>{t("favorites")}</span>
      </Link>
      <Link href="/notifications" className={item}>
        <span className="relative">
          <Bell className="size-6 stroke-[1.6]" />
          <CountBadge count={notificationCount} tone="powder" />
        </span>
        <span>{t("notifications")}</span>
      </Link>
      <Link href="/cart" className={item}>
        <span className="relative">
          <ShoppingBag className="size-6 stroke-[1.6]" />
          <CountBadge count={cartCount} />
        </span>
        <span>{t("cart")}</span>
      </Link>
    </div>
  );
}

export function MobileAccountButton() {
  const t = useTranslations("nav");
  return (
    <Link href="/account" className="grid size-10 place-items-center rounded-full text-graphite hover:bg-beige-100" aria-label={t("account")}>
      <User className="size-[22px] stroke-[1.7]" />
    </Link>
  );
}

/** Телефон: колокольчик в правом углу шапки (корзина — в нижней панели) */
export function MobileNotificationsButton() {
  const t = useTranslations("nav");
  const { notificationCount } = useStore();
  return (
    <Link
      href="/notifications"
      className="relative grid size-10 place-items-center rounded-full text-graphite hover:bg-beige-100"
      aria-label={notificationCount > 0 ? t("notificationsUnread", { count: notificationCount }) : t("notifications")}
    >
      <Bell className="size-[22px] stroke-[1.7]" />
      <CountBadge count={notificationCount} tone="powder" />
    </Link>
  );
}

export { CountBadge };
