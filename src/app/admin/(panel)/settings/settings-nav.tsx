import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export type SettingsTab = "general" | "delivery" | "notifications" | "seo" | "statuses" | "staff" | "audit" | "data" | "demo";

const TABS: { key: SettingsTab; href: string }[] = [
  { key: "general", href: "/admin/settings" },
  { key: "delivery", href: "/admin/settings/delivery" },
  { key: "notifications", href: "/admin/settings/notifications" },
  { key: "seo", href: "/admin/settings/seo" },
  { key: "statuses", href: "/admin/settings/statuses" },
  { key: "staff", href: "/admin/settings/staff" },
  { key: "audit", href: "/admin/settings/audit" },
  { key: "data", href: "/admin/settings/data" },
  { key: "demo", href: "/admin/settings/demo" },
];

/** Вкладки настроек (как в макете) */
export async function SettingsNav({ active }: { active: SettingsTab }) {
  const t = await getTranslations("admin.settings");
  return (
    <nav className="scrollbar-none mb-5 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
            active === tab.key ? "bg-sage-700 text-white shadow-[0_6px_16px_-10px_rgb(88_126_99/0.9)]" : "text-ink-700 hover:bg-sage-50 hover:text-sage-800",
          )}
        >
          {t(`tabs.${tab.key}`)}
        </Link>
      ))}
    </nav>
  );
}
