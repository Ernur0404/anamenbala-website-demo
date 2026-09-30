import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchX } from "lucide-react";
import { findCustomerOrder } from "@/server/order-view";
import { OrderDetails } from "@/components/store/order-details";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { EmptyState } from "@/components/ui/display";
import { formatDateTime } from "@/lib/dates";
import type { Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Заказ", robots: { index: false } };

type Props = { params: Promise<{ locale: string; number: string }>; searchParams: Promise<{ t?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale: raw, number } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const { t: token } = await searchParams;
  const t = await getTranslations();
  const order = await findCustomerOrder(Number(number), token);

  if (!order) {
    return (
      <div className="container-page py-12">
        <EmptyState icon={<SearchX />} title={t("order.notFound")} text={t("order.notFoundText")} />
      </div>
    );
  }

  return (
    <div className="container-page pt-4 sm:pt-6">
      <Breadcrumbs items={[{ label: t("common.home"), href: "/" }, { label: t("order.title", { number: order.number }) }]} className="mb-3" />
      <h1 className="heading-display text-[36px] sm:text-[46px]">{t("order.title", { number: order.number })}</h1>
      <p className="mt-1 mb-6 text-sm text-ink-500">{t("order.placed", { date: formatDateTime(order.createdAt, locale) })}</p>
      <OrderDetails order={order} locale={locale} />
    </div>
  );
}
