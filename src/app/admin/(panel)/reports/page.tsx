import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Ban, Boxes, ClipboardList, Receipt, Wallet } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { breakdowns, effectiveRange, pickBucket, salesSeries, salesSummary } from "@/server/admin/reports";
import { deltaPercent, resolvePeriod } from "@/server/admin/period";
import { getStatusLabels } from "@/server/admin/statuses";
import { KpiCard, PageHeader, Panel } from "@/components/admin/ui";
import { SalesChart } from "@/components/admin/charts";
import type { SearchParams } from "@/components/admin/url";
import { StatusPill } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { ReportsNav } from "./reports-nav";
import { ShareTable } from "./report-ui";
import type { OrderStatus } from "@/generated/prisma/enums";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports");
  return { title: t("title") };
}

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("reports");
  const sp = await searchParams;
  const t = await getTranslations("admin.reports");
  const tc = await getTranslations("admin.common");
  const locale = await getLocale();
  const period = resolvePeriod(sp, "30d");
  const { from, to } = await effectiveRange(period.from, period.to);
  const bucket = pickBucket(from, to);
  const [cur, prev, series, parts, labels] = await Promise.all([
    salesSummary(from, to),
    period.prevFrom && period.prevTo ? salesSummary(period.prevFrom, period.prevTo) : null,
    salesSeries(from, to, bucket),
    breakdowns(from, to),
    getStatusLabels(locale),
  ]);
  const d = (k: "revenue" | "orders" | "avgCheck" | "items" | "cancelled") => (prev ? deltaPercent(cur[k], prev[k]) : null);
  const vs = tc("vsPrev");
  const cols = { name: t("columns.name"), orders: t("columns.orders"), revenue: t("columns.revenue"), share: t("columns.share") };

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReportsNav active="sales" sp={sp} period={period} finance={canSeeFinance(staff.role)} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard icon={Wallet} label={t("kpi.revenue")} value={formatMoney(cur.revenue)} delta={d("revenue")} deltaLabel={vs} />
        <KpiCard icon={ClipboardList} label={t("kpi.orders")} value={cur.orders.toLocaleString("ru-RU")} delta={d("orders")} deltaLabel={vs} />
        <KpiCard icon={Receipt} label={t("kpi.avgCheck")} value={formatMoney(cur.avgCheck)} delta={d("avgCheck")} deltaLabel={vs} />
        <KpiCard icon={Boxes} label={t("kpi.items")} value={cur.items.toLocaleString("ru-RU")} delta={d("items")} deltaLabel={vs} />
        <KpiCard icon={Ban} label={t("kpi.cancelled")} value={cur.cancelled.toLocaleString("ru-RU")} delta={d("cancelled")} deltaLabel={vs} invert />
      </div>
      <Panel title={bucket === "day" ? t("byDay") : bucket === "week" ? t("byWeek") : t("byMonth")} className="mt-5">
        {series.some((p) => p.orders > 0) ? <SalesChart points={series} bucket={bucket} height={300} /> : <p className="py-16 text-center text-sm text-ink-500">{t("empty")}</p>}
      </Panel>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ShareTable title={t("byChannel")} labels={cols} empty={t("empty")} rows={parts.channels.map((c) => ({ label: t(`channel.${c.key}` as "channel.WEBSITE"), orders: c.orders, revenue: c.revenue }))} />
        <ShareTable title={t("byPayment")} labels={cols} empty={t("empty")} rows={parts.payments.map((c) => ({ label: c.key ?? t("noPayment"), orders: c.orders, revenue: c.revenue }))} />
        <ShareTable title={t("byDelivery")} labels={cols} empty={t("empty")} rows={parts.deliveries.map((c) => ({ label: c.key ?? t("noDelivery"), orders: c.orders, revenue: c.revenue }))} />
        <Panel title={t("byStatus")}>
          <div className="flex flex-wrap gap-2">
            {parts.statuses.map((s) => (
              <StatusPill key={s.key} tone={labels.order[s.key as OrderStatus].tone} className="px-3 py-1.5 text-[13px]">
                {labels.order[s.key as OrderStatus].label}: {s.orders}
              </StatusPill>
            ))}
            {parts.statuses.length === 0 && <p className="text-sm text-ink-500">{t("empty")}</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
