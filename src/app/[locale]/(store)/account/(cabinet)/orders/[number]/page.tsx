import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { findCustomerOrder } from "@/server/order-view";
import { OrderDetails } from "@/components/store/order-details";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import type { Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Заказ", robots: { index: false } };

export default async function AccountOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const locale = (await getLocale()) as Locale;
  const order = await findCustomerOrder(Number(number), null);
  if (!order) notFound();
  const t = await getTranslations();
  return (
    <div>
      <Link href="/account" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-sage-700">
        <ArrowLeft className="size-4" />
        {t("account.orders")}
      </Link>
      <h2 className="heading-section text-[30px]">{t("order.title", { number: order.number })}</h2>
      <p className="mt-1 mb-5 text-sm text-ink-500">{t("order.placed", { date: formatDateTime(order.createdAt, locale) })}</p>
      <OrderDetails order={order} locale={locale} />
    </div>
  );
}
