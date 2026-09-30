import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Boxes, PackageX, TriangleAlert, Wallet } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { listStockBalances, stockKpis, STOCK_PAGE_SIZE, variantLabel, type BalanceFilter } from "@/server/admin/stock";
import { DataTable, EmptyRow, FilterPills, KpiCard, KpiGrid, PageHeader, Pagination, Panel, Td, Th, Thumb, Tr } from "@/components/admin/ui";
import { SearchInput } from "@/components/admin/controls";
import { param, pageParam, withParams, type SearchParams } from "@/components/admin/url";
import { formatMoney } from "@/lib/money";
import { mediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import { StockNav } from "./stock-nav";
import { AdjustStockButton } from "./adjust-stock";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.stock");
  return { title: t("title") };
}

const FILTERS: BalanceFilter[] = ["all", "low", "out", "inactive"];

export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("stock");
  const sp = await searchParams;
  const t = await getTranslations("admin.stock");
  const tc = await getTranslations("admin.common");
  const finance = canSeeFinance(staff.role);
  const filterParam = param(sp, "filter");
  const filter: BalanceFilter = FILTERS.includes(filterParam as BalanceFilter) ? (filterParam as BalanceFilter) : "all";
  const page = pageParam(sp);
  const [{ rows, total, threshold }, kpis] = await Promise.all([listStockBalances({ q: param(sp, "q"), filter }, page), stockKpis()]);
  const path = "/admin/stock";

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <StockNav active="balances" />
      <KpiGrid>
        <KpiCard icon={Boxes} label={t("kpi.units")} value={kpis.units.toLocaleString("ru-RU")} />
        {finance ? <KpiCard icon={Wallet} label={t("kpi.value")} value={formatMoney(kpis.value)} /> : <KpiCard icon={Wallet} label={t("filters.all")} value={total.toLocaleString("ru-RU")} />}
        <KpiCard icon={TriangleAlert} label={t("kpi.low")} value={kpis.low} href={withParams(path, {}, { filter: "low" })} />
        <KpiCard icon={PackageX} label={t("kpi.out")} value={kpis.out} href={withParams(path, {}, { filter: "out" })} />
      </KpiGrid>

      <Panel padded={false} className="mt-5">
        <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:px-6 lg:flex-row lg:items-center">
          <FilterPills items={FILTERS.map((f) => ({ key: f, label: t(`filters.${f}`), href: withParams(path, sp, { filter: f === "all" ? null : f, page: null }), active: filter === f }))} />
          <SearchInput className="lg:ml-auto lg:w-80" placeholder={t("searchPlaceholder")} />
        </div>
        <DataTable minWidth={780}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("columns.product")}</Th>
              <Th>{t("columns.variant")}</Th>
              <Th>{t("columns.sku")}</Th>
              <Th>{t("columns.barcode")}</Th>
              {finance && <Th align="right">{t("columns.cost")}</Th>}
              <Th align="right">{t("columns.stock")}</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={finance ? 7 : 6} title={t("empty")} />}
            {rows.map((v) => {
              const label = variantLabel(v);
              const cost = v.costPrice ?? v.product.costPrice;
              return (
                <Tr key={v.id}>
                  <Td>
                    <Link href={`/admin/products/${v.product.id}`} className="flex items-center gap-3 hover:text-sage-700">
                      <Thumb src={mediaUrl(v.product.media[0]?.media, 320)} size={40} />
                      <span className="line-clamp-2 max-w-64 font-semibold text-graphite">{v.product.nameRu}</span>
                    </Link>
                  </Td>
                  <Td className="text-ink-700">{label || "—"}</Td>
                  <Td className="font-mono text-[12.5px] text-ink-600">{v.sku}</Td>
                  <Td className="font-mono text-[12.5px] text-ink-500">{v.barcode ?? "—"}</Td>
                  {finance && <Td align="right" className="text-ink-600">{cost != null ? formatMoney(cost) : "—"}</Td>}
                  <Td align="right">
                    <span className={cn("text-[15px] font-bold", v.stock <= 0 ? "text-powder-700" : v.stock <= threshold ? "text-amber-700" : "text-graphite")}>{v.stock}</span>
                  </Td>
                  <Td align="right">
                    <AdjustStockButton variantId={v.id} current={v.stock} name={[v.product.nameRu, label].filter(Boolean).join(" — ")} />
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
        <div className="px-5 pt-3 text-[12px] text-ink-400 sm:px-6">{t("threshold", { count: threshold })}</div>
        <Pagination path={path} searchParams={sp} page={page} pageSize={STOCK_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
