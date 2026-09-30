import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { formatTime, storeDayStart, toStoreDateKey } from "@/lib/dates";
import { PosTerminal } from "./pos-terminal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.pos");
  return { title: t("title") };
}

export default async function PosPage() {
  await requireStaff("pos");
  const t = await getTranslations("admin.pos");
  const locale = await getLocale();
  const since = storeDayStart(toStoreDateKey(new Date()));
  const sales = await db.order.findMany({
    where: { channel: "POS", createdAt: { gte: since }, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, number: true, total: true, createdAt: true, paymentName: true, customerName: true },
  });
  const sum = sales.reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <PosTerminal />
      <Panel title={t("todaySales")} subtitle={sales.length ? t("todayTotal", { count: sales.length, total: formatMoney(sum) }) : undefined} className="mt-5" padded={false}>
        {sales.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-ink-500">{t("noSalesToday")}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {sales.slice(0, 15).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3 text-[13.5px] hover:bg-cream sm:px-6">
                  <span className="w-14 text-ink-500">{formatTime(o.createdAt, locale)}</span>
                  <span className="font-semibold text-graphite">#{o.number}</span>
                  <span className="truncate text-ink-500">{[o.paymentName, o.customerName].filter(Boolean).join(" · ")}</span>
                  <span className="ml-auto font-semibold text-graphite">{formatMoney(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
