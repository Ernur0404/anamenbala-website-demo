import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { listContactMessages, CUSTOMER_PAGE_SIZE } from "@/server/admin/customers";
import { FilterPills, PageHeader, Pagination, Panel } from "@/components/admin/ui";
import { param, pageParam, withParams, type SearchParams } from "@/components/admin/url";
import { StatusPill } from "@/components/ui/display";
import { formatDateTime } from "@/lib/dates";
import { formatPhone, telLink } from "@/lib/phone";
import { CustomersNav } from "../customers-nav";
import { MessageActions } from "./message-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.customers.messages");
  return { title: t("title") };
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("customers");
  const sp = await searchParams;
  const t = await getTranslations("admin.customers");
  const tc = await getTranslations("admin.common");
  const locale = await getLocale();
  const statusParam = param(sp, "status");
  const status = statusParam === "NEW" || statusParam === "DONE" ? statusParam : undefined;
  const page = pageParam(sp);
  const { rows, total } = await listContactMessages(status, page);
  const path = "/admin/customers/messages";

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CustomersNav active="messages" />
      <Panel padded={false} title={t("messages.title")} subtitle={t("messages.subtitle")}>
        <div className="px-5 pb-4 sm:px-6">
          <FilterPills
            items={[
              { key: "all", label: tc("all"), href: withParams(path, sp, { status: null, page: null }), active: !status },
              { key: "NEW", label: t("messages.status.NEW"), href: withParams(path, sp, { status: "NEW", page: null }), active: status === "NEW" },
              { key: "DONE", label: t("messages.status.DONE"), href: withParams(path, sp, { status: "DONE", page: null }), active: status === "DONE" },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <p className="border-t border-line px-6 py-12 text-center text-sm text-ink-500">{t("messages.empty")}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-graphite">{m.name}</span>
                    <a href={telLink(m.phone)} className="text-[13px] text-sage-700 hover:underline">
                      {formatPhone(m.phone)}
                    </a>
                    <StatusPill tone={m.status === "NEW" ? "powder" : "gray"}>{t(`messages.status.${m.status}`)}</StatusPill>
                    <span className="text-[12px] text-ink-400">
                      {formatDateTime(m.createdAt, locale)} · {m.locale.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-line text-ink-700">{m.message}</p>
                </div>
                <MessageActions id={m.id} status={m.status} phone={m.phone} name={m.name} locale={m.locale} />
              </li>
            ))}
          </ul>
        )}
        <Pagination path={path} searchParams={sp} page={page} pageSize={CUSTOMER_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
