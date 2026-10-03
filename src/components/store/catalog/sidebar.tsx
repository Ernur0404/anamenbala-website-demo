import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Percent, Truck, Gift } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DynamicIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ImageData } from "@/server/catalog/cards";

export type SidebarItem = { key: string; label: string; href: string; icon: string | null; active: boolean; children?: SidebarItem[]; accent?: "powder" };

/** Список категорий в сайдбаре — белая карточка с иконками, как в макете */
export function SidebarCategories({ items }: { items: SidebarItem[] }) {
  return (
    <nav className="rounded-xl border border-line bg-white p-2">
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                item.active ? "bg-sage-700 text-white" : item.accent === "powder" ? "text-powder-700 hover:bg-powder-50" : "text-ink-700 hover:bg-beige-50",
              )}
            >
              {item.accent === "powder" ? <Percent className="size-4 shrink-0" /> : <DynamicIcon name={item.icon} className="size-4 shrink-0 opacity-80" />}
              {item.label}
            </Link>
            {item.children && item.children.length > 0 && (
              <ul className="mt-0.5 mb-1 ml-[26px] space-y-0.5 border-l border-line pl-2">
                {item.children.map((child) => (
                  <li key={child.key}>
                    <Link
                      href={child.href}
                      aria-current={child.active ? "page" : undefined}
                      className={cn("block rounded-md px-2.5 py-1.5 text-[13px] transition-colors", child.active ? "bg-sage-50 font-semibold text-sage-800" : "text-ink-600 hover:bg-beige-50")}
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Промо-карточка в сайдбаре (бесплатная доставка / подарок / выгодные предложения) */
export async function SidebarPromo({ variant, threshold }: { variant: "delivery" | "gift" | "deals"; threshold?: number | null }) {
  const t = await getTranslations("listing");
  const content = {
    delivery: { icon: <Truck className="size-6" />, title: t("freeDelivery"), text: threshold ? t("freeDeliveryFrom", { amount: formatMoney(threshold) }) : null },
    gift: { icon: <Gift className="size-6" />, title: t("giftTitle"), text: t("giftText") },
    deals: { icon: <Percent className="size-6" />, title: t("dealsTitle"), text: t("dealsText") },
  }[variant];
  if (variant === "delivery" && !threshold) return null;
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-beige-100 to-powder-100 p-5">
      <span className="grid size-11 place-items-center rounded-full bg-white/70 text-sage-700">{content.icon}</span>
      <p className="heading-section mt-3 text-[24px] leading-tight">{content.title}</p>
      {content.text && <p className="mt-1 text-sm text-ink-600">{content.text}</p>}
      <span className="absolute -right-8 -bottom-8 size-28 rounded-full bg-white/40" aria-hidden />
    </div>
  );
}

/** Плитки подкатегорий (страница «Для детей» в макете) */
export function SubcategoryTiles({ items }: { items: { key: string; label: string; href: string; icon: string | null; image: ImageData | null }[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-8 hidden gap-3 lg:grid lg:grid-cols-6">
      {items.map((item) => (
        <Link key={item.key} href={item.href} className="group overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-card">
          <span className="relative block aspect-square bg-beige-50">
            {item.image ? (
              <Image src={item.image.src} alt={item.image.alt} fill sizes="(max-width: 1024px) 30vw, 180px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <span className="grid h-full place-items-center text-sage-600">
                <DynamicIcon name={item.icon} className="size-9" />
              </span>
            )}
          </span>
          <span className="block px-3 py-2.5 text-center text-[13px] leading-tight font-semibold">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

/** Плитки разделов на странице «Акции» */
export function SaleTiles({ items }: { items: { key: string; label: string; href: string; icon: string | null; active: boolean }[] }) {
  return (
    <div className="mb-8 hidden gap-3 lg:grid lg:grid-cols-5">
      {items.map((item, i) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl px-4 py-6 text-sm font-semibold transition-colors",
            item.active ? "bg-powder-200 text-powder-800 ring-2 ring-powder-400" : "bg-beige-100 text-graphite hover:bg-beige-200",
          )}
        >
          <span className={cn("grid size-12 place-items-center rounded-full", item.active ? "bg-powder-400 text-white" : "bg-white/70 text-sage-700")}>
            {i === 0 ? <Percent className="size-6" /> : <DynamicIcon name={item.icon} className="size-6" />}
          </span>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
