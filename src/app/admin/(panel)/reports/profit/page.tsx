import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Coins, Percent, TrendingUp, Wallet } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { effectiveRange, salesByRootCategory, salesSummary, topProducts } from "@/server/admin/reports";
import { deltaPercent, resolvePeriod } from "@/server/admin/period";
import { DataTable, EmptyRow, KpiCard, KpiGrid, PageHeader, Panel, Td, Th, Tr } from "@/components/admin/ui";
import type { SearchParams } from "@/components/admin/url";
import { formatMoney } from "@/lib/money";
import { ReportsNav } from "../reports-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports.tabs");
  return { title: t("profit") };
}

export default async function ProfitReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("finance");
  const sp = await searchParams;
  const t = await getTranslations("admin.reports");
  const tc = await getTranslations("admin.common");
  const period = resolvePeriod(sp, "30d");
  const { from, to } = await effectiveRange(period.from, period.to);
  const [cur, prev, categories, products] = await Promise.all([
    salesSummary(from, to),
    period.prevFrom && period.prevTo ? salesSummary(period.prevFrom, period.prevTo) : null,
    salesByRootCategory(from, to),
    topProducts(from, to, 30),
  ]);
  const byProfit = products.filter((p) => p.profit != null).sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  const margin = (profit: number, cost: number) => (cost > 0 ? `${Math.round((profit / cost) * 100)}%` : "—");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReportsNav active="profit" sp={sp} period={period} finance />
      <KpiGrid>
        <KpiCard icon={Wallet} label={t("kpi.revenue")} value={formatMoney(cur.revenue)} delta={prev ? deltaPercent(cur.revenue, prev.revenue) : null} deltaLabel={tc("vsPrev")} />
        <KpiCard icon={Coins} label={t("kpi.cost")} value={formatMoney(cur.cost)} />
        <KpiCard icon={TrendingUp} label={t("kpi.grossProfit")} value={formatMoney(cur.grossProfit)} delta={prev ? deltaPercent(cur.grossProfit, prev.grossProfit) : null} deltaLabel={tc("vsPrev")} />
        <KpiCard icon={Percent} label={t("kpi.margin")} value={cur.margin != null ? `${cur.margin}%` : "—"} />
      </KpiGrid>
      <p className="mt-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-500">
        {t("profitNote")} {cur.revenueWithoutCost > 0 && t("withoutCost", { amount: formatMoney(cur.revenueWithoutCost) })}
      </p>
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Panel title={t("byCategory")} padded={false}>
          <DataTable minWidth={520}>
            <thead className="bg-cream/60">
              <tr>
                <Th>{t("columns.name")}</Th>
                <Th align="right">{t("columns.revenue")}</Th>
                <Th align="right">{t("columns.cost")}</Th>
                <Th align="right">{t("columns.profit")}</Th>
                <Th align="right">{t("columns.margin")}</Th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && <EmptyRow colSpan={5} title={t("empty")} />}
              {categories.map((c) => (
                <Tr key={c.id ?? c.name}>
                  <Td className="font-semibold">{c.name}</Td>
                  <Td align="right">{formatMoney(c.revenue)}</Td>
                  <Td align="right" className="text-ink-600">
                    {formatMoney(c.cost)}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(c.profit)}
                  </Td>
                  <Td align="right" className="text-ink-600">
                    {margin(c.profit, c.cost)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
        <Panel title={t("topProducts")} padded={false}>
          <DataTable minWidth={520}>
            <thead className="bg-cream/60">
              <tr>
                <Th>{t("columns.name")}</Th>
                <Th align="right">{t("columns.qty")}</Th>
                <Th align="right">{t("columns.profit")}</Th>
                <Th align="right">{t("columns.margin")}</Th>
              </tr>
            </thead>
            <tbody>
              {byProfit.length === 0 && <EmptyRow colSpan={4} title={t("empty")} />}
              {byProfit.map((p) => (
                <Tr key={p.productId ?? p.name}>
                  <Td>
                    {p.productId ? (
                      <Link href={`/admin/products/${p.productId}`} className="font-semibold text-graphite hover:text-sage-700">
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                  </Td>
                  <Td align="right">{p.qty}</Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(p.profit ?? 0)}
                  </Td>
                  <Td align="right" className="text-ink-600">
                    {margin(p.profit ?? 0, p.cost)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
