import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Repeat, ShoppingBag, UserPlus } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { customerStats, effectiveRange } from "@/server/admin/reports";
import { resolvePeriod } from "@/server/admin/period";
import { DataTable, EmptyRow, KpiCard, PageHeader, Panel, Td, Th, Tr } from "@/components/admin/ui";
import type { SearchParams } from "@/components/admin/url";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { ReportsNav } from "../reports-nav";
import { ShareTable } from "../report-ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports.tabs");
  return { title: t("customers") };
}

export default async function CustomersReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("reports");
  const sp = await searchParams;
  const t = await getTranslations("admin.reports");
  const period = resolvePeriod(sp, "30d");
  const { from, to } = await effectiveRange(period.from, period.to);
  const stats = await customerStats(from, to);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReportsNav active="customers" sp={sp} period={period} finance={canSeeFinance(staff.role)} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <KpiCard icon={UserPlus} label={t("kpi.newCustomers")} value={stats.newCustomers} />
        <KpiCard icon={ShoppingBag} label={t("kpi.customersWithOrders")} value={stats.buyers} />
        <KpiCard icon={Repeat} label={t("kpi.returning")} value={stats.returning} />
      </div>
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t("topCustomers")} padded={false}>
          <DataTable minWidth={520}>
            <thead className="bg-cream/60">
              <tr>
                <Th>{t("columns.customer")}</Th>
                <Th align="right">{t("columns.orders")}</Th>
                <Th align="right">{t("columns.revenue")}</Th>
              </tr>
            </thead>
            <tbody>
              {stats.top.length === 0 && <EmptyRow colSpan={3} title={t("empty")} />}
              {stats.top.map((c) => (
                <Tr key={c.customerId}>
                  <Td>
                    <Link href={`/admin/customers/${c.customerId}`} className="font-semibold text-graphite hover:text-sage-700">
                      {c.name}
                    </Link>
                    <p className="text-[12px] text-ink-500">{formatPhone(c.phone)}</p>
                  </Td>
                  <Td align="right">{c.orders}</Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(c.revenue)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
        <ShareTable
          title={t("byCity")}
          labels={{ name: t("columns.city"), orders: t("columns.orders"), revenue: t("columns.revenue"), share: t("columns.share") }}
          empty={t("empty")}
          rows={stats.cities.map((c) => ({ label: c.city ?? "—", orders: c.orders, revenue: c.revenue }))}
        />
      </div>
    </>
  );
}
