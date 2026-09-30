import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Boxes, PackageX, Tag, Wallet } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { stockReport } from "@/server/admin/reports";
import { resolvePeriod } from "@/server/admin/period";
import { DataTable, EmptyRow, KpiCard, KpiGrid, PageHeader, Panel, Td, Th, Tr } from "@/components/admin/ui";
import type { SearchParams } from "@/components/admin/url";
import { formatMoney } from "@/lib/money";
import { ReportsNav } from "../reports-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports.tabs");
  return { title: t("stock") };
}

export default async function StockReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("reports");
  const sp = await searchParams;
  const t = await getTranslations("admin.reports");
  const finance = canSeeFinance(staff.role);
  const report = await stockReport();
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReportsNav active="stock" sp={sp} period={resolvePeriod(sp, "30d")} finance={finance} />
      <KpiGrid>
        <KpiCard icon={Boxes} label={t("kpi.stockUnits")} value={report.units.toLocaleString("ru-RU")} href="/admin/stock" />
        {finance && <KpiCard icon={Wallet} label={t("kpi.stockValue")} value={formatMoney(report.cost)} />}
        <KpiCard icon={Tag} label={t("kpi.stockRetail")} value={formatMoney(report.retail)} />
        <KpiCard icon={PackageX} label={t("kpi.outOfStock")} value={report.out} href="/admin/products?stock=out" />
      </KpiGrid>
      <Panel title={t("noSales")} subtitle={t("noSalesHint")} className="mt-5" padded={false}>
        <DataTable minWidth={480}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("columns.name")}</Th>
              <Th align="right">{t("columns.stock")}</Th>
              {finance && <Th align="right">{t("columns.value")}</Th>}
            </tr>
          </thead>
          <tbody>
            {report.noSales.length === 0 && <EmptyRow colSpan={finance ? 3 : 2} title={t("empty")} />}
            {report.noSales.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <Link href={`/admin/products/${p.id}`} className="font-semibold text-graphite hover:text-sage-700">
                    {p.name}
                  </Link>
                </Td>
                <Td align="right">{p.stock}</Td>
                {finance && <Td align="right">{formatMoney(p.value)}</Td>}
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
    </>
  );
}
