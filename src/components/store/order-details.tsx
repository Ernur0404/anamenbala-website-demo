import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Check, MapPin, PackageX, Truck } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/display";
import { WhatsAppIcon } from "@/components/ui/icons";
import { orderStatusLabels, orderWhatsappLink, statusTimeline, type CustomerOrder } from "@/server/order-view";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { tr, type Locale } from "@/lib/l10n";
import { cn } from "@/lib/utils";

/** Подробности заказа для покупателя (страница по ссылке и личный кабинет) */
export async function OrderDetails({ order, locale }: { order: CustomerOrder; locale: Locale }) {
  const t = await getTranslations();
  const labels = await orderStatusLabels(locale);
  const timeline = statusTimeline(order);
  const whatsapp = await orderWhatsappLink(order, locale, {
    greeting: t("success.whatsappGreeting", { number: order.number }),
    total: t("success.whatsappTotal", { total: formatMoney(order.total) }),
  });
  const address = [order.region, order.city, order.street && `${order.street}${order.house ? `, ${order.house}` : ""}`, order.apartment].filter(Boolean).join(", ");
  const instructions = order.paymentMethod && order.paymentStatus === "UNPAID" && order.status !== "CANCELLED" ? tr(order.paymentMethod, "instructions", locale) : "";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t("order.status")}</h2>
            <StatusPill tone={labels.order[order.status].tone as Tone}>{labels.order[order.status].label}</StatusPill>
          </div>
          {order.status === "CANCELLED" ? (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-powder-50 p-4 text-sm font-medium text-powder-800">
              <PackageX className="size-5" />
              {t("order.cancelled")}
            </p>
          ) : (
            <ol className="mt-5 grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:gap-2">
              {timeline.map((step) => (
                <li key={step.status} className="flex items-center gap-3 sm:flex-col sm:text-center">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full border-2",
                      step.done ? "border-sage-700 bg-sage-700 text-white" : "border-line-strong bg-white text-ink-300",
                      step.current && "ring-4 ring-sage-100",
                    )}
                  >
                    {step.done ? <Check className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <span>
                    <span className={cn("block text-[13px] font-semibold", !step.done && "text-ink-400")}>{labels.order[step.status].label}</span>
                    {step.at && <span className="block text-[11px] text-ink-400">{formatDateTime(step.at, locale)}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {order.trackingNumber && (
            <p className="mt-5 flex items-center gap-2 rounded-lg bg-beige-50 px-4 py-3 text-sm">
              <Truck className="size-4 text-sage-700" />
              {t("order.tracking")}: <span className="font-semibold">{order.trackingNumber}</span>
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="mb-2 text-lg font-bold">{t("order.items")}</h2>
          <ul className="divide-y divide-line">
            {order.items.map((item) => {
              const name = locale === "kk" ? item.nameKk || item.nameRu : item.nameRu;
              const label = locale === "kk" ? item.variantLabelKk || item.variantLabelRu : item.variantLabelRu;
              return (
                <li key={item.id} className="flex gap-3 py-3">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-beige-50">
                    {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{name}</span>
                    {label && <span className="block text-xs text-ink-500">{label}</span>}
                    <span className="block text-xs text-ink-500">
                      {formatMoney(item.unitPrice)} × {item.quantity}
                    </span>
                    {item.backorderQty > 0 && <span className="block text-xs text-sky-700">{t("cart.backorderNote", { count: item.backorderQty })}</span>}
                  </span>
                  <span className="text-sm font-bold whitespace-nowrap">{formatMoney(item.lineTotal)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-line pt-4 text-sm">
            {order.itemsDiscount + order.promoDiscount > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-600">{t("cart.discount")}</dt>
                <dd className="font-semibold text-powder-700">−{formatMoney(order.itemsDiscount + order.promoDiscount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-600">{t("cart.delivery")}</dt>
              <dd className="font-semibold">{order.deliveryPrice > 0 ? formatMoney(order.deliveryPrice) : t("checkout.free")}</dd>
            </div>
            <div className="flex justify-between pt-1 text-base">
              <dt className="font-semibold">{t("cart.total")}</dt>
              <dd className="font-bold">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-xl border border-line bg-white p-5 text-sm">
          <h3 className="mb-3 font-bold">{t("order.delivery")}</h3>
          <p className="font-semibold">{order.deliveryName}</p>
          {address && (
            <p className="mt-1 flex items-start gap-1.5 text-ink-600">
              <MapPin className="mt-0.5 size-4 shrink-0 text-sage-700" />
              {address}
            </p>
          )}
          <h3 className="mt-5 mb-2 font-bold">{t("order.contact")}</h3>
          <p>{order.customerName}</p>
          <p className="text-ink-600">{formatPhone(order.customerPhone)}</p>
          {order.comment && (
            <>
              <h3 className="mt-5 mb-2 font-bold">{t("order.comment")}</h3>
              <p className="text-ink-600">{order.comment}</p>
            </>
          )}
          <h3 className="mt-5 mb-2 font-bold">{t("order.payment")}</h3>
          <p className="flex flex-wrap items-center gap-2">
            {order.paymentName}
            <StatusPill tone={labels.payment[order.paymentStatus].tone as Tone}>{labels.payment[order.paymentStatus].label}</StatusPill>
          </p>
          {instructions && <p className="mt-3 rounded-lg bg-beige-50 p-3 text-xs leading-relaxed text-ink-700">{instructions}</p>}
        </section>
        <section className="rounded-xl bg-[#25d366]/10 p-5 text-sm">
          <p className="font-semibold">{t("order.questions")}</p>
          <a href={whatsapp} target="_blank" rel="noopener" className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg bg-[#25d366] px-5 font-bold text-white hover:bg-[#1fb857]">
            <WhatsAppIcon size={18} />
            {t("order.writeUs")}
          </a>
        </section>
      </aside>
    </div>
  );
}
