import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { PackageOpen, ChevronRight } from "lucide-react";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/customer";
import { orderStatusLabels } from "@/server/order-view";
import { Link } from "@/i18n/navigation";
import { EmptyState, StatusPill, type Tone } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Мои заказы", robots: { index: false } };

export default async function AccountOrdersPage() {
  const locale = (await getLocale()) as Locale;
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations();
  const [orders, labels] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: { take: 4, select: { imageUrl: true } }, _count: { select: { items: true } } },
    }),
    orderStatusLabels(locale),
  ]);

  return (
    <div>
      <h2 className="heading-section mb-5 text-[30px]">{t("account.orders")}</h2>
      {orders.length ? (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-4 transition-shadow hover:shadow-card">
                <div className="min-w-[120px]">
                  <p className="font-bold">№{o.number}</p>
                  <p className="text-xs text-ink-500">{formatDate(o.createdAt, locale)}</p>
                </div>
                <div className="flex -space-x-2">
                  {o.items.map((item, idx) => (
                    <span key={idx} className="relative size-11 overflow-hidden rounded-md border-2 border-white bg-beige-50">
                      {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-ink-500">{t("account.orderItems", { count: o._count.items })}</p>
                <StatusPill tone={labels.order[o.status].tone as Tone} className="ml-auto">
                  {labels.order[o.status].label}
                </StatusPill>
                <p className="w-28 text-right font-bold">{formatMoney(o.total)}</p>
                <ChevronRight className="size-4 text-ink-300" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<PackageOpen />}
          title={t("account.noOrders")}
          text={t("account.noOrdersText")}
          action={
            <Link href="/catalog" className="inline-flex h-11 items-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
              {t("cart.goShopping")}
            </Link>
          }
        />
      )}
    </div>
  );
}
