import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { effectiveRange, salesByRootCategory, topProducts } from "@/server/admin/reports";
import { resolvePeriod } from "@/server/admin/period";
import { DataTable, EmptyRow, PageHeader, Panel, Td, Th, Thumb, Tr } from "@/components/admin/ui";
import { withParams, type SearchParams } from "@/components/admin/url";
import { formatMoney } from "@/lib/money";
import { mediaUrl } from "@/lib/media-url";
import { toStoreDateKey, addDays } from "@/lib/dates";
import { ReportsNav } from "../reports-nav";
import { ShareTable } from "../report-ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports.tabs");
  return { title: t("products") };
}

export default async function ProductsReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("reports");
  const sp = await searchParams;
  const t = await getTranslations("admin.reports");
  const period = resolvePeriod(sp, "30d");
  const { from, to } = await effectiveRange(period.from, period.to);
  const [products, categories] = await Promise.all([topProducts(from, to, 50), salesByRootCategory(from, to)]);
  const total = products.reduce((s, p) => s + p.revenue, 0) || 1;
  const exportHref = withParams("/api/admin/export/report-products", {}, { from: toStoreDateKey(from), to: toStoreDateKey(addDays(to, -1)) });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReportsNav active="products" sp={sp} period={period} finance={canSeeFinance(staff.role)} exportHref={exportHref} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t("topProducts")} padded={false}>
          <DataTable minWidth={620}>
            <thead className="bg-cream/60">
              <tr>
                <Th>{t("columns.name")}</Th>
                <Th align="right">{t("columns.qty")}</Th>
                <Th align="right">{t("columns.orders")}</Th>
                <Th align="right">{t("columns.revenue")}</Th>
                <Th align="right">{t("columns.share")}</Th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && <EmptyRow colSpan={5} title={t("empty")} />}
              {products.map((p, i) => (
                <Tr key={p.productId ?? `${p.name}-${i}`}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[12px] text-ink-400">{i + 1}</span>
                      <Thumb src={mediaUrl(p.image, 320)} size={36} />
                      {p.productId ? (
                        <Link href={`/admin/products/${p.productId}`} className="font-semibold text-graphite hover:text-sage-700">
                          {p.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-graphite">{p.name}</span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">{p.qty}</Td>
                  <Td align="right" className="text-ink-600">
                    {p.orders}
                  </Td>
                  <Td align="right" className="font-semibold whitespace-nowrap">
                    {formatMoney(p.revenue)}
                  </Td>
                  <Td align="right" className="text-ink-500">
                    {Math.round((p.revenue / total) * 100)}%
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
        <ShareTable
          title={t("topCategories")}
          labels={{ name: t("columns.name"), orders: t("columns.qty"), revenue: t("columns.revenue"), share: t("columns.share") }}
          empty={t("empty")}
          rows={categories.map((c) => ({ label: c.name, orders: c.qty, revenue: c.revenue }))}
        />
      </div>
    </>
  );
}
