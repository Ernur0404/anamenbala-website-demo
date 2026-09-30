import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PeriodPicker } from "@/components/admin/period-picker";
import { withParams, type SearchParams } from "@/components/admin/url";
import type { ResolvedPeriod } from "@/server/admin/period";
import { cn } from "@/lib/utils";

export type ReportTab = "sales" | "products" | "stock" | "customers" | "profit";
const HREF: Record<ReportTab, string> = {
  sales: "/admin/reports",
  products: "/admin/reports/products",
  stock: "/admin/reports/stock",
  customers: "/admin/reports/customers",
  profit: "/admin/reports/profit",
};

export async function ReportsNav({ active, sp, period, finance, exportHref }: { active: ReportTab; sp: SearchParams; period: ResolvedPeriod; finance: boolean; exportHref?: string }) {
  const t = await getTranslations("admin.reports");
  const tc = await getTranslations("admin.common");
  const keep = { period: sp.period as string | undefined, from: sp.from as string | undefined, to: sp.to as string | undefined };
  const tabs = (Object.keys(HREF) as ReportTab[]).filter((k) => k !== "profit" || finance);
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <nav className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-white p-1">
        {tabs.map((k) => (
          <Link
            key={k}
            href={withParams(HREF[k], {}, keep)}
            aria-current={active === k ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors", active === k ? "bg-sage-700 text-white" : "text-ink-700 hover:text-sage-800")}
          >
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        {active !== "stock" && <PeriodPicker current={period.key} fromKey={period.fromKey} toKey={period.toKey} allLabel={tc("all")} />}
        {exportHref && (
          <a href={exportHref} download className={buttonVariants({ variant: "secondary" })}>
            <Download />
            {t("export")}
          </a>
        )}
      </div>
    </div>
  );
}
