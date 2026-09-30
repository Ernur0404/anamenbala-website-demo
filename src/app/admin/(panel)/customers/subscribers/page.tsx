import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { listSubscribers, CUSTOMER_PAGE_SIZE } from "@/server/admin/customers";
import { DataTable, EmptyRow, PageHeader, Pagination, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { SearchInput } from "@/components/admin/controls";
import { param, pageParam, type SearchParams } from "@/components/admin/url";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { CustomersNav } from "../customers-nav";
import { DeleteSubscriberButton } from "./delete-subscriber";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.customers.subscribers");
  return { title: t("title") };
}

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("customers");
  const sp = await searchParams;
  const t = await getTranslations("admin.customers");
  const tc = await getTranslations("admin.common");
  const locale = await getLocale();
  const page = pageParam(sp);
  const { rows, total } = await listSubscribers(param(sp, "q"), page);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CustomersNav
        active="subscribers"
        actions={
          <a href="/api/admin/export/subscribers" download className={buttonVariants({ size: "sm", variant: "secondary" })}>
            <Download />
            {tc("exportExcel")}
          </a>
        }
      />
      <Panel padded={false} title={t("subscribers.title")} subtitle={t("subscribers.subtitle")}>
        <div className="px-5 pb-4 sm:px-6">
          <SearchInput className="max-w-md" />
        </div>
        <DataTable minWidth={520}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("subscribers.email")}</Th>
              <Th>{t("subscribers.language")}</Th>
              <Th>{t("subscribers.date")}</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={4} title={t("subscribers.empty")} />}
            {rows.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium text-graphite">{s.email}</Td>
                <Td className="uppercase text-ink-600">{s.locale}</Td>
                <Td className="text-ink-600">{formatDate(s.createdAt, locale)}</Td>
                <Td align="right">
                  <DeleteSubscriberButton id={s.id} email={s.email} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
        <Pagination path="/admin/customers/subscribers" searchParams={sp} page={page} pageSize={CUSTOMER_PAGE_SIZE * 2} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
