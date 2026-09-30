import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCheck, ClipboardList, Eye, Plus, Timer, XCircle } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { listAdminOrders, orderKpis, orderStatusCounts, ORDER_PAGE_SIZE } from "@/server/admin/orders";
import { resolvePeriod } from "@/server/admin/period";
import { getStatusLabels } from "@/server/admin/statuses";
import { ORDER_STATUSES } from "@/server/orders/status";
import { DataTable, EmptyRow, FilterPills, KpiCard, KpiGrid, PageHeader, Pagination, Panel, Td, Th, Thumb, Tr } from "@/components/admin/ui";
import { ParamSelect, SearchInput } from "@/components/admin/controls";
import { PeriodPicker } from "@/components/admin/period-picker";
import { param, pageParam, withParams, type SearchParams } from "@/components/admin/url";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import type { OrderChannel, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.orders");
  return { title: t("title") };
}

const CHANNELS: OrderChannel[] = ["WEBSITE", "MANUAL", "POS"];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("orders");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("admin.orders");
  const tc = await getTranslations("admin.common");

  const period = resolvePeriod(sp, "all");
  const statusParam = param(sp, "status");
  const status = (ORDER_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as OrderStatus) : undefined;
  const paymentParam = param(sp, "payment");
  const payment = ["UNPAID", "PAID", "REFUNDED"].includes(paymentParam ?? "") ? (paymentParam as PaymentStatus) : undefined;
  const channelParam = param(sp, "channel");
  const channel = (CHANNELS as string[]).includes(channelParam ?? "") ? (channelParam as OrderChannel) : undefined;
  const q = param(sp, "q");
  const page = pageParam(sp);
  const filters = { status, payment, channel, q, from: period.from, to: period.to };

  const [{ rows, total }, counts, kpis, labels] = await Promise.all([
    listAdminOrders(filters, page),
    orderStatusCounts(filters),
    orderKpis(period),
    getStatusLabels(locale),
  ]);

  const path = "/admin/orders";
  const deltaLabel = tc("vsPrev");
  const tabs = [
    { key: "all", label: t("tabs.all"), href: withParams(path, sp, { status: null, page: null }), active: !status, count: counts.ALL },
    ...ORDER_STATUSES.map((s) => ({ key: s, label: labels.order[s].label, href: withParams(path, sp, { status: s, page: null }), active: status === s, count: counts[s] })),
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <PeriodPicker current={period.key} fromKey={period.fromKey} toKey={period.toKey} allLabel={tc("all")} />
            <Link href="/admin/orders/new" className={buttonVariants()}>
              <Plus />
              {t("newOrder")}
            </Link>
          </>
        }
      />

      <KpiGrid>
        <KpiCard icon={ClipboardList} label={t("kpi.total")} value={kpis.current.total.toLocaleString("ru-RU")} delta={kpis.delta.total} deltaLabel={deltaLabel} />
        <KpiCard icon={Timer} label={t("kpi.inProgress")} value={kpis.current.inProgress.toLocaleString("ru-RU")} delta={kpis.delta.inProgress} deltaLabel={deltaLabel} />
        <KpiCard icon={CheckCheck} label={t("kpi.delivered")} value={kpis.current.delivered.toLocaleString("ru-RU")} delta={kpis.delta.delivered} deltaLabel={deltaLabel} />
        <KpiCard icon={XCircle} label={t("kpi.cancelled")} value={kpis.current.cancelled.toLocaleString("ru-RU")} delta={kpis.delta.cancelled} deltaLabel={deltaLabel} invert />
      </KpiGrid>

      <Panel padded={false} className="mt-5">
        <div className="px-5 pt-5 sm:px-6">
          <FilterPills items={tabs} />
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row">
          <SearchInput className="flex-1" placeholder={t("searchPlaceholder")} />
          <ParamSelect
            className="lg:w-56"
            param="payment"
            allLabel={t("allPayments")}
            options={(["UNPAID", "PAID", "REFUNDED"] as const).map((p) => ({ value: p, label: labels.payment[p].label }))}
          />
          <ParamSelect className="lg:w-48" param="channel" allLabel={t("allChannels")} options={CHANNELS.map((c) => ({ value: c, label: t(`channel.${c}`) }))} />
        </div>

        {/* таблица — компьютер и планшет */}
        <DataTable className="hidden md:block" minWidth={880}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("columns.number")}</Th>
              <Th>{t("columns.customer")}</Th>
              <Th>{t("columns.items")}</Th>
              <Th align="right">{t("columns.sum")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th>{t("columns.payment")}</Th>
              <Th>{t("columns.date")}</Th>
              <Th align="right">{t("columns.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={8} title={q || status || payment || channel ? tc("nothingFound") : t("emptyTitle")} text={q || status ? tc("tryOtherFilters") : t("emptyText")} />}
            {rows.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="font-bold text-graphite hover:text-sage-700">
                    #{o.number}
                  </Link>
                  {o.channel !== "WEBSITE" && <p className="mt-0.5 text-[11.5px] text-ink-500">{o.source || t(`channel.${o.channel}`)}</p>}
                </Td>
                <Td>
                  <p className="max-w-44 truncate font-medium text-graphite">{o.customerName}</p>
                  <p className="text-[12px] text-ink-500">{formatPhone(o.customerPhone)}</p>
                </Td>
                <Td>
                  <div className="flex items-center">
                    {o.items.map((it, i) => (
                      <Thumb key={i} src={it.imageUrl} alt={it.nameRu} size={34} className="-ml-1.5 border-2 border-white first:ml-0" />
                    ))}
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-500">{t("itemsCount", { count: o._count.items })}</p>
                </Td>
                <Td align="right" className="font-semibold whitespace-nowrap text-graphite">
                  {formatMoney(o.total)}
                </Td>
                <Td>
                  <StatusPill tone={labels.order[o.status].tone}>{labels.order[o.status].label}</StatusPill>
                </Td>
                <Td>
                  <StatusPill tone={labels.payment[o.paymentStatus].tone}>{labels.payment[o.paymentStatus].label}</StatusPill>
                </Td>
                <Td className="whitespace-nowrap">
                  <p className="text-graphite">{formatDate(o.createdAt, locale)}</p>
                  <p className="text-[12px] text-ink-500">{formatTime(o.createdAt, locale)}</p>
                </Td>
                <Td align="right">
                  <Link href={`/admin/orders/${o.id}`} className="inline-grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 transition-colors hover:border-sage-400 hover:text-sage-700" aria-label={t("open")}>
                    <Eye className="size-4" />
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>

        {/* карточки — телефон */}
        <ul className="divide-y divide-line border-t border-line md:hidden">
          {rows.length === 0 && <li className="px-5 py-12 text-center text-sm text-ink-500">{t("emptyTitle")}</li>}
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="block px-5 py-4 active:bg-cream">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-graphite">#{o.number}</span>
                  <span className="font-semibold text-graphite">{formatMoney(o.total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate text-ink-700">{o.customerName}</span>
                  <span className="shrink-0 text-ink-500">
                    {formatDate(o.createdAt, locale)} {formatTime(o.createdAt, locale)}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <StatusPill tone={labels.order[o.status].tone}>{labels.order[o.status].label}</StatusPill>
                  <StatusPill tone={labels.payment[o.paymentStatus].tone}>{labels.payment[o.paymentStatus].label}</StatusPill>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Pagination path={path} searchParams={sp} page={page} pageSize={ORDER_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
