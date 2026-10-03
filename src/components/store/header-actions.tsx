"use client";

import { useTranslations } from "next-intl";
import { Heart, ShoppingBag, User } from "lucide-react";
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
  const { cartCount, favorites } = useStore();
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

export function MobileCartButton() {
  const t = useTranslations("nav");
  const { cartCount } = useStore();
  return (
    <Link href="/cart" className="relative grid size-10 place-items-center rounded-full text-graphite hover:bg-beige-100" aria-label={t("cart")}>
      <ShoppingBag className="size-[22px] stroke-[1.7]" />
      <CountBadge count={cartCount} />
    </Link>
  );
}

export { CountBadge };
