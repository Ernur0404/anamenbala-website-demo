import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { listStockDocuments, STOCK_PAGE_SIZE } from "@/server/admin/stock";
import { DataTable, EmptyRow, FilterPills, PageHeader, Pagination, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { param, pageParam, withParams, type SearchParams } from "@/components/admin/url";
import { StatusPill } from "@/components/ui/display";
import { formatDateTime } from "@/lib/dates";
import { StockNav } from "../stock-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.stock");
  return { title: `${t("tabs.documents")} — ${t("title")}` };
}

const TYPES = ["RECEIPT", "WRITE_OFF", "ADJUSTMENT"] as const;

export default async function StockDocumentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("stock");
  const sp = await searchParams;
  const t = await getTranslations("admin.stock");
  const tc = await getTranslations("admin.common");
  const locale = await getLocale();
  const typeParam = param(sp, "type");
  const type = TYPES.find((x) => x === typeParam);
  const page = pageParam(sp);
  const { rows, total } = await listStockDocuments(page, type);
  const path = "/admin/stock/documents";

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <StockNav active="documents" />
      <Panel padded={false}>
        <div className="px-5 pt-5 pb-4 sm:px-6">
          <FilterPills
            items={[
              { key: "all", label: tc("all"), href: withParams(path, sp, { type: null, page: null }), active: !type },
              ...TYPES.map((x) => ({ key: x, label: t(`docType.${x}`), href: withParams(path, sp, { type: x, page: null }), active: type === x })),
            ]}
          />
        </div>
        <DataTable minWidth={760}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("docColumns.number")}</Th>
              <Th>{t("docColumns.type")}</Th>
              <Th>{t("docColumns.status")}</Th>
              <Th align="right">{t("docColumns.lines")}</Th>
              <Th align="right">{t("docColumns.qty")}</Th>
              <Th>{t("docColumns.supplier")}</Th>
              <Th>{t("docColumns.author")}</Th>
              <Th>{t("docColumns.date")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={8} title={t("noDocuments")} text={t("noDocumentsText")} />}
            {rows.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <Link href={`/admin/stock/documents/${d.id}`} className="font-bold text-graphite hover:text-sage-700">
                    №{d.number}
                  </Link>
                </Td>
                <Td>{t(`docType.${d.type}`)}</Td>
                <Td>
                  <StatusPill tone={d.status === "POSTED" ? "sage" : "gray"}>{t(`docStatus.${d.status}`)}</StatusPill>
                </Td>
                <Td align="right">{d.lines.length}</Td>
                <Td align="right" className="font-semibold">
                  {d.lines.reduce((s, l) => s + l.quantity, 0)}
                </Td>
                <Td className="max-w-60 truncate text-ink-600">{d.supplier || d.note || "—"}</Td>
                <Td className="text-ink-600">{d.createdBy?.name ?? "—"}</Td>
                <Td className="whitespace-nowrap text-ink-600">{formatDateTime(d.postedAt ?? d.createdAt, locale)}</Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
        <Pagination path={path} searchParams={sp} page={page} pageSize={STOCK_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
