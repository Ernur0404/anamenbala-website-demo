import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export type CatalogTab = "categories" | "attributes" | "brands" | "badges" | "sizeCharts";

const TABS: { key: CatalogTab; href: string }[] = [
  { key: "categories", href: "/admin/catalog" },
  { key: "attributes", href: "/admin/catalog/attributes" },
  { key: "brands", href: "/admin/catalog/brands" },
  { key: "badges", href: "/admin/catalog/badges" },
  { key: "sizeCharts", href: "/admin/catalog/size-charts" },
];

/** Вкладки раздела «Категории» (как вкладки «Баннеры / Контент» в макете) */
export async function CatalogNav({ active, actions }: { active: CatalogTab; actions?: React.ReactNode }) {
  const t = await getTranslations("admin.catalog");
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <nav className="scrollbar-none -mx-1 flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-white p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors", active === tab.key ? "bg-sage-700 text-white" : "text-ink-700 hover:text-sage-800")}
          >
            {t(`tabs.${tab.key}`)}
          </Link>
        ))}
      </nav>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
