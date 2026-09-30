import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CircleCheck, Mail } from "lucide-react";
import { findCustomerOrder, orderWhatsappLink } from "@/server/order-view";
import { Link } from "@/i18n/navigation";
import { WhatsAppIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { tr, type Locale } from "@/lib/l10n";

export const metadata: Metadata = { title: "Спасибо за заказ", robots: { index: false } };

type Props = { params: Promise<{ locale: string; number: string }>; searchParams: Promise<{ t?: string }> };

export default async function SuccessPage({ params, searchParams }: Props) {
  const { locale: raw, number } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const { t: token } = await searchParams;
  const order = await findCustomerOrder(Number(number), token);
  if (!order) notFound();
  const t = await getTranslations();

  const whatsapp = await orderWhatsappLink(order, locale, {
    greeting: t("success.whatsappGreeting", { number: order.number }),
    total: t("success.whatsappTotal", { total: formatMoney(order.total) }),
  });
  const instructions = order.paymentMethod ? tr(order.paymentMethod, "instructions", locale) : "";

  return (
    <div className="container-page py-10 sm:py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 text-center shadow-soft sm:p-10">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-sage-100 text-sage-700">
          <CircleCheck className="size-9" />
        </span>
        <h1 className="heading-display mt-5 text-[40px]">{t("success.title")}</h1>
        <p className="mt-2 text-lg font-semibold">{t("success.number", { number: order.number })}</p>
        <p className="mt-3 text-[15px] text-ink-600">{t("success.text")}</p>
        {order.customerEmail && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink-500">
            <Mail className="size-4" />
            {t("success.emailSent", { email: order.customerEmail })}
          </p>
        )}

        {instructions && (
          <div className="mt-6 rounded-xl bg-beige-50 p-4 text-left text-sm leading-relaxed text-ink-700">
            <p className="mb-1 font-semibold text-graphite">{t("order.howToPay")}</p>
            {instructions}
          </div>
        )}

        <div className="mt-7 rounded-xl bg-[#25d366]/10 p-5">
          <p className="text-sm text-ink-600">{t("success.whatsappHint")}</p>
          <a href={whatsapp} target="_blank" rel="noopener" className="mt-3 inline-flex h-12 items-center gap-2 rounded-lg bg-[#25d366] px-6 text-sm font-bold text-white transition-colors hover:bg-[#1fb857]">
            <WhatsAppIcon size={20} />
            {t("success.whatsapp")}
          </a>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={`/order/${order.number}?t=${order.accessToken}`} className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-5 text-sm font-semibold hover:border-sage-500">
            {t("success.viewOrder")}
          </Link>
          <Link href="/catalog" className="inline-flex h-11 items-center justify-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
            {t("success.continue")}
          </Link>
        </div>
      </div>
    </div>
  );
}
