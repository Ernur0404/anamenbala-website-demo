import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRightLeft, CircleDollarSign, FilePen, PackageCheck, StickyNote, UserRound } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { canSeeFinance } from "@/server/permissions";
import { getAdminOrder, orderFormOptions } from "@/server/admin/orders";
import { getStatusLabels } from "@/server/admin/statuses";
import { allowedOrderTargets, allowedPaymentTargets } from "@/server/orders/status";
import { EDITABLE_STATUSES } from "@/server/orders/edit";
import { customerOrderUrl } from "@/server/notifications/messages";
import { PageHeader, Panel, InfoRow } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { OrderActionsBar, OrderInfoCard, OrderItemsCard, OrderNoteForm, OrderStatusCard, type OrderClientData } from "./order-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("admin.orders");
  const order = await getAdminOrder(id);
  return { title: order ? t("orderNumber", { number: order.number }) : t("title") };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("orders");
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();
  const locale = await getLocale();
  const t = await getTranslations("admin.orders");
  const [labels, options] = await Promise.all([getStatusLabels(locale), orderFormOptions()]);
  const finance = canSeeFinance(staff.role);

  const data: OrderClientData = {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    channel: order.channel,
    deliveryKind: order.deliveryKind,
    editable: (EDITABLE_STATUSES as readonly string[]).includes(order.status),
    orderTargets: allowedOrderTargets(order.status, staff.role),
    paymentTargets: allowedPaymentTargets(order.paymentStatus, staff.role),
    isOwner: staff.role === "OWNER",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryMethodId: order.deliveryMethodId,
    deliveryName: order.deliveryName,
    deliveryPrice: order.deliveryPrice,
    region: order.region,
    city: order.city,
    street: order.street,
    house: order.house,
    apartment: order.apartment,
    postalCode: order.postalCode,
    paymentMethodId: order.paymentMethodId,
    paymentName: order.paymentName,
    comment: order.comment,
    trackingNumber: order.trackingNumber,
    managerNote: order.managerNote,
    items: order.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productId: i.productId,
      name: i.nameRu,
      label: i.variantLabelRu,
      sku: i.sku,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      regularPrice: i.regularPrice,
      lineTotal: i.lineTotal,
      backorderQty: i.backorderQty,
      stock: i.variant?.stock ?? null,
    })),
    customerUrl: customerOrderUrl(order),
    // сообщение покупателю — на языке, на котором он оформлял заказ
    whatsappText:
      order.locale === "kk"
        ? `${order.customerName}, сәлеметсіз бе! «Ана мен бала» дүкені, №${order.number} тапсырыс бойынша жазып отырмыз.`
        : `${order.customerName}, здравствуйте! Это магазин «Ана мен бала», пишем по вашему заказу №${order.number}.`,
  };

  const historyIcon = { CREATED: PackageCheck, STATUS: ArrowRightLeft, PAYMENT: CircleDollarSign, EDIT: FilePen, NOTE: StickyNote } as const;
  const valueLabel = (kind: string, v: string | null) => {
    if (!v) return "—";
    if (kind === "STATUS") return labels.order[v as keyof typeof labels.order]?.label ?? v;
    if (kind === "PAYMENT") return labels.payment[v as keyof typeof labels.payment]?.label ?? v;
    return v;
  };

  const profit = order.costTotal > 0 ? order.itemsTotal - order.promoDiscount - order.costTotal : null;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: t("backToOrders") }}
        title={t("orderNumber", { number: order.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>{t("createdAt", { date: formatDateTime(order.createdAt, locale) })}</span>
            <span>· {t("via", { channel: order.source ? `${t(`channel.${order.channel}`)} (${order.source})` : t(`channel.${order.channel}`) })}</span>
            <StatusPill tone={labels.order[order.status].tone}>{labels.order[order.status].label}</StatusPill>
            <StatusPill tone={labels.payment[order.paymentStatus].tone}>{labels.payment[order.paymentStatus].label}</StatusPill>
            {order.isDemo && <StatusPill tone="beige">Demo</StatusPill>}
          </span>
        }
        actions={<OrderActionsBar data={data} />}
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <OrderItemsCard data={data} />
          <OrderInfoCard data={data} deliveries={options.deliveries} payments={options.payments} />

          <Panel title={t("sections.history")}>
            <OrderNoteForm orderId={order.id} />
            <ol className="mt-4 space-y-0">
              {order.history.map((h, index) => {
                const Icon = historyIcon[h.kind];
                const who = h.staffUser?.name ?? (h.actor === "customer" ? t("history.customer") : h.actor === "system" ? t("history.system") : null);
                return (
                  <li key={h.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < order.history.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px bg-line" aria-hidden />}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sage-50 text-sage-700">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-[13.5px] font-semibold text-graphite">
                        {h.kind === "STATUS" || h.kind === "PAYMENT"
                          ? t(`history.${h.kind}`, { from: valueLabel(h.kind, h.fromValue), to: valueLabel(h.kind, h.toValue) })
                          : t(`history.${h.kind}`)}
                      </p>
                      {h.comment && <p className="mt-0.5 text-[13px] whitespace-pre-line text-ink-600">{h.comment}</p>}
                      <p className="mt-0.5 text-[12px] text-ink-400">
                        {formatDateTime(h.createdAt, locale)}
                        {who && ` · ${who}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        <div className="space-y-5 xl:sticky xl:top-24">
          <OrderStatusCard data={data} labels={labels} />

          <Panel title={t("sections.totals")}>
            <InfoRow label={t("totals.items")}>{formatMoney(order.itemsRegular)}</InfoRow>
            {order.itemsDiscount > 0 && <InfoRow label={t("totals.discount")}>−{formatMoney(order.itemsDiscount)}</InfoRow>}
            {order.promoDiscount > 0 && (
              <InfoRow label={`${t("totals.promo")}${order.promoCodeText ? ` ${order.promoCodeText}` : ""}`}>−{formatMoney(order.promoDiscount)}</InfoRow>
            )}
            <InfoRow label={t("totals.delivery")}>{order.deliveryPrice > 0 ? formatMoney(order.deliveryPrice) : t("totals.free")}</InfoRow>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[15px] font-bold text-graphite">{t("totals.total")}</span>
              <span className="text-[20px] font-bold text-graphite">{formatMoney(order.total)}</span>
            </div>
            {finance && order.costTotal > 0 && (
              <div className="mt-3 rounded-lg bg-cream px-3 py-2">
                <InfoRow label={t("totals.cost")}>{formatMoney(order.costTotal)}</InfoRow>
                {profit != null && <InfoRow label={t("totals.profit")}>{formatMoney(profit)}</InfoRow>}
              </div>
            )}
          </Panel>

          {order.customer && (
            <Panel title={t("sections.customer")}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-sage-700 text-white">
                  <UserRound className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-graphite">{order.customer.name}</p>
                  <p className="text-[12.5px] text-ink-500">{t("customerOrders", { count: order.customer._count.orders })}</p>
                </div>
              </div>
              {order.customer.notes && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-700">{order.customer.notes}</p>}
              <Link href={`/admin/customers/${order.customer.id}`} className="mt-3 inline-block text-[13px] font-semibold text-sage-700 hover:underline">
                {t("customerCard")} →
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
