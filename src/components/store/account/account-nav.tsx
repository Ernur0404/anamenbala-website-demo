"use client";

import { Heart, MapPin, Package, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoutButton } from "./account-forms";
import { cn } from "@/lib/utils";

export function AccountNav({ labels }: { labels: { orders: string; addresses: string; profile: string; favorites: string; logout: string } }) {
  const pathname = usePathname();
  const items = [
    { href: "/account", label: labels.orders, icon: Package, active: pathname === "/account" || pathname.startsWith("/account/orders") },
    { href: "/account/addresses", label: labels.addresses, icon: MapPin, active: pathname === "/account/addresses" },
    { href: "/account/profile", label: labels.profile, icon: UserRound, active: pathname === "/account/profile" },
    { href: "/favorites", label: labels.favorites, icon: Heart, active: false },
  ];
  return (
    <nav className="h-fit rounded-xl border border-line bg-white p-2 lg:sticky lg:top-[150px]">
      <ul className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
        {items.map(({ href, label, icon: Icon, active }) => (
          <li key={href} className="shrink-0">
            <Link href={href} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-sage-700 text-white" : "text-ink-700 hover:bg-beige-50")}>
              <Icon className="size-4" />
              {label}
            </Link>
          </li>
        ))}
        <li className="shrink-0 lg:mt-2 lg:border-t lg:border-line lg:pt-2">
          <LogoutButton label={labels.logout} />
        </li>
      </ul>
    </nav>
  );
}
