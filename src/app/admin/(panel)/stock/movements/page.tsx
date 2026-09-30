import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { listMovements, STOCK_PAGE_SIZE, variantLabel } from "@/server/admin/stock";
import { resolvePeriod } from "@/server/admin/period";
import { DataTable, EmptyRow, PageHeader, Pagination, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { ParamSelect, SearchInput } from "@/components/admin/controls";
import { PeriodPicker } from "@/components/admin/period-picker";
import { param, pageParam, type SearchParams } from "@/components/admin/url";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { StockReason } from "@/generated/prisma/enums";
import { StockNav } from "../stock-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.stock");
  return { title: `${t("tabs.movements")} — ${t("title")}` };
}

const REASONS: StockReason[] = ["RECEIPT", "WRITE_OFF", "ADJUSTMENT", "MANUAL", "ORDER_PLACED", "ORDER_EDITED", "ORDER_CANCELLED", "ORDER_RESTORED", "ORDER_RETURNED", "POS_SALE", "INITIAL", "IMPORT"];

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("stock");
  const sp = await searchParams;
  const t = await getTranslations("admin.stock");
  const tc = await getTranslations("admin.common");
  const locale = await getLocale();
  const period = resolvePeriod(sp, "all");
  const reasonParam = param(sp, "reason");
  const reason = REASONS.find((r) => r === reasonParam);
  const page = pageParam(sp);
  const { rows, total } = await listMovements({ q: param(sp, "q"), reason, from: period.from, to: period.to }, page);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <StockNav active="movements" />
      <Panel padded={false}>
        <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:px-6 lg:flex-row">
          <SearchInput className="flex-1" placeholder={t("searchPlaceholder")} />
          <ParamSelect className="lg:w-64" param="reason" allLabel={t("allReasons")} options={REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))} />
          <PeriodPicker current={period.key} fromKey={period.fromKey} toKey={period.toKey} allLabel={tc("all")} />
        </div>
        <DataTable minWidth={900}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("moveColumns.date")}</Th>
              <Th>{t("moveColumns.product")}</Th>
              <Th align="right">{t("moveColumns.delta")}</Th>
              <Th align="right">{t("moveColumns.balance")}</Th>
              <Th>{t("moveColumns.reason")}</Th>
              <Th>{t("moveColumns.source")}</Th>
              <Th>{t("moveColumns.who")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={7} title={t("noMovements")} />}
            {rows.map((m) => (
              <Tr key={m.id}>
                <Td className="whitespace-nowrap text-ink-600">{formatDateTime(m.createdAt, locale)}</Td>
                <Td>
                  <Link href={`/admin/products/${m.variant.product.id}`} className="font-semibold text-graphite hover:text-sage-700">
                    {m.variant.product.nameRu}
                  </Link>
                  <p className="text-[12px] text-ink-500">{[variantLabel(m.variant), m.variant.sku].filter(Boolean).join(" · ")}</p>
                  {m.note && <p className="mt-0.5 text-[12px] text-ink-400 italic">{m.note}</p>}
                </Td>
                <Td align="right" className={cn("text-[14px] font-bold", m.delta > 0 ? "text-sage-700" : "text-powder-700")}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </Td>
                <Td align="right" className="font-semibold text-graphite">
                  {m.balanceAfter}
                </Td>
                <Td className="text-ink-700">{t(`reasons.${m.reason}`)}</Td>
                <Td>
                  {m.order ? (
                    <Link href={`/admin/orders/${m.order.id}`} className="text-sage-700 hover:underline">
                      {t("order", { number: m.order.number })}
                    </Link>
                  ) : m.document ? (
                    <Link href={`/admin/stock/documents/${m.document.id}`} className="text-sage-700 hover:underline">
                      {t("document", { number: m.document.number })}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-ink-600">{m.staffUser?.name ?? "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
        <Pagination path="/admin/stock/movements" searchParams={sp} page={page} pageSize={STOCK_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
