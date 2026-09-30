import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Download, Eye, UserCheck, UserPlus, Users, ShoppingBag } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { customerCities, customerKpis, customerStatus, listCustomers, CUSTOMER_PAGE_SIZE, type CustomerFilter, type CustomerSort } from "@/server/admin/customers";
import { DataTable, EmptyRow, KpiCard, KpiGrid, PageHeader, Pagination, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { ParamSelect, SearchInput } from "@/components/admin/controls";
import { param, pageParam, withParams, type SearchParams } from "@/components/admin/url";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { CustomersNav } from "./customers-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.customers");
  return { title: t("title") };
}

const FILTERS: CustomerFilter[] = ["active", "new", "withOrders", "noOrders", "withAccount"];
const SORTS: CustomerSort[] = ["new", "name", "orders"];
const TONE = { new: "sky", active: "sage", inactive: "gray" } as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("customers");
  const sp = await searchParams;
  const t = await getTranslations("admin.customers");
  const tc = await getTranslations("admin.common");
  const locale = await getLocale();
  const filter = FILTERS.find((f) => f === param(sp, "filter"));
  const sort = SORTS.find((s) => s === param(sp, "sort")) ?? "new";
  const q = param(sp, "q");
  const city = param(sp, "city");
  const page = pageParam(sp);
  const [{ rows, total }, kpis, cities] = await Promise.all([listCustomers({ q, city, filter, sort }, page), customerKpis(), customerCities()]);
  const path = "/admin/customers";
  const exportHref = withParams("/api/admin/export/customers", {}, { q: q ?? null, city: city ?? null, filter: filter ?? null });

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <a href={exportHref} download className={buttonVariants()}>
            <Download />
            {t("export")}
          </a>
        }
      />
      <CustomersNav active="customers" />
      <KpiGrid>
        <KpiCard icon={Users} label={t("kpi.total")} value={kpis.total.toLocaleString("ru-RU")} href={path} />
        <KpiCard icon={UserCheck} label={t("kpi.active")} value={kpis.active.toLocaleString("ru-RU")} hint={t("kpiHint.active")} href={withParams(path, {}, { filter: "active" })} />
        <KpiCard icon={UserPlus} label={t("kpi.new")} value={kpis.new.toLocaleString("ru-RU")} hint={t("kpiHint.new")} href={withParams(path, {}, { filter: "new" })} />
        <KpiCard icon={ShoppingBag} label={t("kpi.withOrders")} value={kpis.withOrders.toLocaleString("ru-RU")} hint={t("kpiHint.withOrders")} href={withParams(path, {}, { filter: "withOrders" })} />
      </KpiGrid>

      <Panel padded={false} className="mt-5">
        <div className="grid gap-3 px-5 pt-5 pb-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_200px_200px_180px]">
          <SearchInput placeholder={t("searchPlaceholder")} />
          <ParamSelect param="filter" allLabel={t("allCustomers")} options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`) }))} />
          <ParamSelect param="city" allLabel={t("allCities")} options={cities.map((c) => ({ value: c, label: c }))} />
          <ParamSelect param="sort" allLabel={t("sort.new")} ariaLabel={tc("sort")} options={SORTS.filter((s) => s !== "new").map((s) => ({ value: s, label: t(`sort.${s}`) }))} />
        </div>
        <DataTable minWidth={860}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("columns.customer")}</Th>
              <Th>{t("columns.phone")}</Th>
              <Th>{t("columns.email")}</Th>
              <Th align="right">{t("columns.orders")}</Th>
              <Th align="right">{t("columns.sum")}</Th>
              <Th>{t("columns.lastOrder")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={8} title={q || filter || city ? tc("nothingFound") : t("empty")} text={q || filter || city ? tc("tryOtherFilters") : t("emptyText")} />}
            {rows.map((c) => {
              const status = customerStatus(c);
              return (
                <Tr key={c.id}>
                  <Td>
                    <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 hover:text-sage-700">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage-700 text-[14px] font-bold text-white">{c.name.trim().charAt(0).toUpperCase() || "?"}</span>
                      <span className="min-w-0">
                        <span className="block max-w-48 truncate font-semibold text-graphite">{c.name}</span>
                        {c.city && <span className="block text-[12px] text-ink-500">{c.city}</span>}
                      </span>
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-700">{formatPhone(c.phone)}</Td>
                  <Td className="max-w-48 truncate text-ink-600">{c.email ?? "—"}</Td>
                  <Td align="right" className="font-semibold">
                    {c.orders}
                  </Td>
                  <Td align="right" className="font-semibold whitespace-nowrap text-graphite">
                    {formatMoney(c.spent)}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">{c.lastOrderAt ? formatDate(c.lastOrderAt, locale) : "—"}</Td>
                  <Td>
                    <StatusPill tone={TONE[status]}>{t(`status.${status}`)}</StatusPill>
                  </Td>
                  <Td align="right">
                    <Link href={`/admin/customers/${c.id}`} className="inline-grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={tc("view")}>
                      <Eye className="size-4" />
                    </Link>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
        <Pagination path={path} searchParams={sp} page={page} pageSize={CUSTOMER_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
