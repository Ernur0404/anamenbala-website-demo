"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  ClipboardCheck,
  HeartHandshake,
  Megaphone,
  PackageCheck,
  PackageOpen,
  PackageX,
  Percent,
  RotateCcw,
  Sparkles,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/display";
import { useStore } from "./store-provider";
import { NOTIFICATIONS_SEEN_COOKIE, type NotificationIcon, type NotificationKind, type NotificationView } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationIcon, { icon: LucideIcon; tone: string }> = {
  created: { icon: ClipboardCheck, tone: "bg-sage-100 text-sage-700" },
  confirmed: { icon: BadgeCheck, tone: "bg-sage-100 text-sage-700" },
  packing: { icon: PackageOpen, tone: "bg-beige-100 text-beige-700" },
  shipped: { icon: Truck, tone: "bg-sage-100 text-sage-700" },
  delivered: { icon: PackageCheck, tone: "bg-sage-700 text-white" },
  completed: { icon: HeartHandshake, tone: "bg-sage-100 text-sage-700" },
  cancelled: { icon: PackageX, tone: "bg-powder-100 text-powder-700" },
  paid: { icon: Wallet, tone: "bg-sage-100 text-sage-700" },
  refunded: { icon: RotateCcw, tone: "bg-beige-100 text-beige-700" },
  sale: { icon: Percent, tone: "bg-powder-200 text-powder-700" },
  new: { icon: Sparkles, tone: "bg-beige-100 text-beige-700" },
  news: { icon: Megaphone, tone: "bg-sage-700 text-white" },
};

const KINDS: NotificationKind[] = ["order", "sale", "new", "news"];

type Labels = { filters: Record<"all" | NotificationKind, string>; empty: string; emptyText: string; unread: string };

/** Отметить уведомления просмотренными: время сервера (не часы телефона) — в cookie браузера */
function markSeen(at: number) {
  try {
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${NOTIFICATIONS_SEEN_COOKIE}=${at}; path=/; max-age=${365 * 86_400}; samesite=lax${secure}`;
  } catch {
    // cookie недоступны — просто не запомним
  }
}

/** renderedAt — время сервера, когда собрана лента: всё, что было до него, покупатель увидел */
export function NotificationsList({ items, renderedAt, labels }: { items: NotificationView[]; renderedAt: number; labels: Labels }) {
  const { setNotificationCount } = useStore();
  const [filter, setFilter] = useState<"all" | NotificationKind>("all");

  useEffect(() => {
    markSeen(renderedAt);
    setNotificationCount(0);
  }, [renderedAt, setNotificationCount]);

  if (items.length === 0) return <EmptyState icon={<Bell />} title={labels.empty} text={labels.emptyText} />;

  const kinds = KINDS.filter((k) => items.some((i) => i.kind === k));
  const visible = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <div className="mx-auto max-w-[760px]">
      {kinds.length > 1 && (
        <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="toolbar">
          {(["all", ...kinds] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold ring-1 transition-colors",
                filter === k ? "bg-sage-700 text-white ring-sage-700" : "bg-white text-ink-700 ring-line hover:ring-sage-400",
              )}
            >
              {labels.filters[k]}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-2.5">
        {visible.map((n) => (
          <li key={n.id}>
            <NotificationCard item={n} unreadLabel={labels.unread} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotificationCard({ item, unreadLabel }: { item: NotificationView; unreadLabel: string }) {
  const { icon: Icon, tone } = ICONS[item.icon];
  const body = (
    <div
      className={cn(
        "flex gap-3 rounded-2xl p-3.5 ring-1 transition-[box-shadow,background-color] sm:gap-4 sm:p-4",
        item.unread ? "bg-sage-50 ring-sage-200" : "bg-white ring-line",
        item.href && "hover:shadow-[0_10px_24px_-18px_rgb(47_52_48/0.6)] hover:ring-sage-300",
      )}
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", tone)}>
        <Icon className="size-5 stroke-[1.8]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[14.5px] leading-snug font-bold text-graphite">{item.title}</p>
          {item.unread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-powder-600">
              <span className="sr-only">{unreadLabel}</span>
            </span>
          )}
        </div>
        {item.text && <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-ink-600">{item.text}</p>}
        {item.images.length > 0 && (
          <div className="mt-2.5 flex gap-1.5">
            {item.images.map((src) => (
              <span key={src} className="relative size-12 overflow-hidden rounded-lg bg-beige-100">
                <Image src={src} alt="" fill sizes="48px" className="object-cover" />
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11.5px] font-medium text-ink-400">{item.dateLabel}</p>
      </div>
      {item.href && <ChevronRight className="mt-3 size-4 shrink-0 text-ink-300" />}
    </div>
  );

  if (!item.href) return body;
  return <NotificationLink href={item.href}>{body}</NotificationLink>;
}

function NotificationLink({ href, children }: { href: string; children: ReactNode }) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="block">
      {children}
    </Link>
  );
}
