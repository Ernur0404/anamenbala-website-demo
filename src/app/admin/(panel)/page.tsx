import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, BadgePercent, ClipboardList, Package, PackagePlus, ScanBarcode, Settings, ShoppingBag, Users, Wallet, TriangleAlert, CircleCheck } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { can } from "@/server/permissions";
import { dashboardData, effectiveRange, pickBucket, salesSeries } from "@/server/admin/reports";
import { deltaPercent, resolvePeriod } from "@/server/admin/period";
import { getStatusLabels } from "@/server/admin/statuses";
import { KpiCard, KpiGrid, PageHeader, Panel, Thumb } from "@/components/admin/ui";
import { PeriodPicker } from "@/components/admin/period-picker";
import { DonutChart, SalesChart } from "@/components/admin/charts";
import type { SearchParams } from "@/components/admin/url";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { mediaUrl } from "@/lib/media-url";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dashboard");
  return { title: t("title") };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("dashboard");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("admin.dashboard");
  const tc = await getTranslations("admin.common");
  const period = resolvePeriod(sp, "30d");
  const { from, to } = await effectiveRange(period.from, period.to);
  const bucket = pickBucket(from, to);
  const [data, series, labels] = await Promise.all([dashboardData(from, to, period.prevFrom, period.prevTo), salesSeries(from, to, bucket), getStatusLabels(locale)]);
  const vs = t("vsPrev");

  const quick = [
    { href: "/admin/products/new", icon: PackagePlus, label: t("quickActions.addProduct"), show: can(staff.role, "products") },
    { href: "/admin/promotions", icon: BadgePercent, label: t("quickActions.createPromo"), show: can(staff.role, "promotions") },
    { href: "/admin/orders", icon: ClipboardList, label: t("quickActions.viewOrders"), show: can(staff.role, "orders") },
    { href: "/admin/settings", icon: Settings, label: t("quickActions.settings"), show: can(staff.role, "settings") },
    { href: "/admin/orders/new", icon: ShoppingBag, label: t("quickActions.newOrder"), show: can(staff.role, "orders") && !can(staff.role, "settings") },
    { href: "/admin/pos", icon: ScanBarcode, label: t("quickActions.pos"), show: can(staff.role, "pos") && !can(staff.role, "promotions") },
  ].filter((q) => q.show);

  const attention = [
    { key: "newOrders", count: data.attention.newOrders, href: "/admin/orders?status=NEW" },
    { key: "unpaid", count: data.attention.unpaid, href: "/admin/orders?payment=UNPAID" },
    { key: "reviews", count: data.attention.reviews, href: "/admin/reviews" },
    { key: "lowStock", count: data.attention.lowStock, href: "/admin/stock?filter=low" },
    { key: "messages", count: data.attention.messages, href: "/admin/customers/messages" },
  ].filter((a) => a.count > 0);

  const categoryItems = data.categoryCounts.items.slice(0, 4).map((c) => ({ name: c.name, value: c.count }));
  const rest = data.categoryCounts.items.slice(4).reduce((s, c) => s + c.count, 0);
  if (rest > 0) categoryItems.push({ name: t("other"), value: rest });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<PeriodPicker current={period.key} fromKey={period.fromKey} toKey={period.toKey} allLabel={tc("all")} />} />

      <KpiGrid>
        <KpiCard icon={ClipboardList} label={t("kpi.orders")} value={data.cur.orders.toLocaleString("ru-RU")} delta={data.prev ? deltaPercent(data.cur.orders, data.prev.orders) : null} deltaLabel={vs} href="/admin/orders" />
        <KpiCard icon={Users} label={t("kpi.customers")} value={data.newCustomers.toLocaleString("ru-RU")} delta={deltaPercent(data.newCustomers, data.prevCustomers)} deltaLabel={vs} href="/admin/customers?filter=new" />
        <KpiCard icon={Wallet} label={t("kpi.revenue")} value={formatMoney(data.cur.revenue)} delta={data.prev ? deltaPercent(data.cur.revenue, data.prev.revenue) : null} deltaLabel={vs} />
        <KpiCard icon={Package} label={t("kpi.inStock")} value={data.inStock.toLocaleString("ru-RU")} hint={t("inStockHint")} href="/admin/products?stock=in" />
      </KpiGrid>

      {attention.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-700/15 bg-amber-50 px-4 py-3">
          <span className="mr-1 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
            <TriangleAlert className="size-4" />
            {t("attention")}:
          </span>
          {attention.map((a) => (
            <Link key={a.key} href={a.href} className="rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-graphite shadow-soft hover:text-sage-700">
              {t(`attentionItems.${a.key}`, { count: a.count })}
            </Link>
          ))}
        </div>
      )}
      {attention.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-sage-700">
          <CircleCheck className="size-4" />
          {t("allGood")}
        </p>
      )}

      <Panel title={t("sales")} className="mt-5" action={<span className="flex items-center gap-4 text-[12px] text-ink-500"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sage-700" />{t("revenue")}</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sage-300" />{t("ordersCount")}</span></span>}>
        {series.some((p) => p.orders > 0) ? <SalesChart points={series} bucket={bucket} /> : <p className="py-16 text-center text-sm text-ink-500">{t("noData")}</p>}
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title={t("latestOrders")} padded={false} action={<Link href="/admin/orders" className="flex items-center gap-1 text-[12.5px] font-semibold text-sage-700 hover:underline">{t("allOrders")} <ArrowRight className="size-3.5" /></Link>}>
          <table className="w-full text-[13px]">
            <tbody>
              {data.latest.map((o) => (
                <tr key={o.id} className="border-t border-line first:border-t-0">
                  <td className="py-3 pr-2 pl-5 sm:pl-6">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold text-graphite hover:text-sage-700">
                      #{o.number}
                    </Link>
                  </td>
                  <td className="max-w-32 truncate px-2 text-ink-700">{o.customerName}</td>
                  <td className="px-2 text-right font-semibold whitespace-nowrap">{formatMoney(o.total)}</td>
                  <td className="px-2">
                    <StatusPill tone={labels.order[o.status].tone}>{labels.order[o.status].label}</StatusPill>
                  </td>
                  <td className="py-3 pr-5 pl-2 text-right whitespace-nowrap text-ink-500 sm:pr-6">{formatDate(o.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={t("popular")} action={<Link href="/admin/products?sort=sales" className="flex items-center gap-1 text-[12.5px] font-semibold text-sage-700 hover:underline">{t("allProducts")} <ArrowRight className="size-3.5" /></Link>}>
          {data.popular.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">{t("noData")}</p>
          ) : (
            <ol className="space-y-3">
              {data.popular.map((p, i) => (
                <li key={p.productId ?? p.name} className="flex items-center gap-3">
                  <span className="w-4 text-[13px] font-semibold text-ink-400">{i + 1}</span>
                  <Thumb src={mediaUrl(p.image, 320)} size={42} className="rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-graphite">{p.name}</p>
                    <p className="text-[12px] text-ink-500">{p.price != null ? formatMoney(p.price) : ""}</p>
                  </div>
                  <span className="text-[12px] whitespace-nowrap text-ink-500">{t("sold", { count: p.qty })}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title={t("newCustomers")} padded={false} action={<Link href="/admin/customers" className="flex items-center gap-1 text-[12.5px] font-semibold text-sage-700 hover:underline">{t("allCustomers")} <ArrowRight className="size-3.5" /></Link>}>
          <table className="w-full text-[13px]">
            <tbody>
              {data.newest.map((c) => (
                <tr key={c.id} className="border-t border-line first:border-t-0">
                  <td className="py-3 pr-2 pl-5 sm:pl-6">
                    <Link href={`/admin/customers/${c.id}`} className="font-semibold text-graphite hover:text-sage-700">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-2 whitespace-nowrap text-ink-600">{formatPhone(c.phone)}</td>
                  <td className="py-3 pr-5 pl-2 text-right whitespace-nowrap text-ink-500 sm:pr-6">{formatDate(c.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={t("categories")}>
          <DonutChart items={categoryItems} centerValue={data.categoryCounts.total.toLocaleString("ru-RU")} centerLabel={t("productsTotal", { count: data.categoryCounts.total })} />
        </Panel>

        <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-r from-beige-100 to-cream p-6">
          <p className="heading-section text-[26px] text-graphite">{t("promoTitle")}</p>
          <p className="mt-1 text-[13.5px] text-ink-600">{t("promoText")}</p>
          <Link href="/admin/products" className={buttonVariants({ className: "mt-5" })}>
            {t("promoButton")}
            <ArrowRight />
          </Link>
          <svg className="pointer-events-none absolute -right-4 -bottom-6 h-36 w-36 text-sage-300/60" viewBox="0 0 100 100" aria-hidden>
            <path fill="currentColor" d="M50 10c10 18 30 22 30 42S62 88 50 88 20 72 20 52s20-24 30-42z" />
          </svg>
        </div>

        <Panel title={t("quick")}>
          <div className="grid grid-cols-2 gap-2.5">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-3 text-[13px] font-semibold text-graphite transition-colors hover:border-sage-400 hover:bg-sage-50">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sage-50 text-sage-700">
                  <q.icon className="size-4" />
                </span>
                {q.label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
