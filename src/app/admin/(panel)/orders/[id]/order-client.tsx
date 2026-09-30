"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Ban, Copy, Pencil, Phone, Printer, RotateCcw, Trash, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/display";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { QuantityStepper } from "@/components/ui/quantity";
import { WhatsAppIcon } from "@/components/ui/icons";
import { Panel, Thumb, InfoRow } from "@/components/admin/ui";
import { VariantPicker } from "@/components/admin/variant-picker";
import { useAdminAction } from "@/components/admin/use-action";
import {
  addOrderNoteAction,
  changeOrderStatusAction,
  changePaymentStatusAction,
  updateOrderInfoAction,
  updateOrderItemsAction,
} from "@/server/actions/admin/orders";
import type { StatusLabels } from "@/server/admin/statuses";
import { formatMoney, parseMoney } from "@/lib/money";
import { formatPhone, telLink, whatsappLink } from "@/lib/phone";
import { formatPhoneInput } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

type OrderStatus = "NEW" | "CONFIRMED" | "PACKING" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export type OrderClientData = {
  id: string;
  number: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: "WEBSITE" | "MANUAL" | "POS";
  deliveryKind: "KAZAKHSTAN" | "LOCAL_COURIER" | "PICKUP" | null;
  editable: boolean;
  orderTargets: OrderStatus[];
  paymentTargets: PaymentStatus[];
  isOwner: boolean;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryMethodId: string | null;
  deliveryName: string | null;
  deliveryPrice: number;
  region: string | null;
  city: string | null;
  street: string | null;
  house: string | null;
  apartment: string | null;
  postalCode: string | null;
  paymentMethodId: string | null;
  paymentName: string | null;
  comment: string | null;
  trackingNumber: string | null;
  managerNote: string | null;
  items: {
    id: string;
    variantId: string | null;
    productId: string | null;
    name: string;
    label: string | null;
    sku: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    regularPrice: number;
    lineTotal: number;
    backorderQty: number;
    stock: number | null;
  }[];
  customerUrl: string;
  whatsappText: string;
};

const FLOW: OrderStatus[] = ["NEW", "CONFIRMED", "PACKING", "SHIPPED", "DELIVERED", "COMPLETED"];

// ───────────── кнопки в заголовке ─────────────

export function OrderActionsBar({ data }: { data: OrderClientData }) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  return (
    <>
      <Button variant="secondary" asChild>
        <a href={whatsappLink(data.customerPhone, data.whatsappText)} target="_blank" rel="noreferrer">
          <WhatsAppIcon size={16} />
          <span className="hidden sm:inline">{t("whatsapp")}</span>
        </a>
      </Button>
      <Button variant="secondary" asChild>
        <a href={telLink(data.customerPhone)} aria-label={t("call")}>
          <Phone />
          <span className="hidden sm:inline">{t("call")}</span>
        </a>
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          void navigator.clipboard.writeText(data.customerUrl).then(() => toast.success(tc("copied")));
        }}
        aria-label={t("copyLink")}
        title={t("customerPage")}
      >
        <Copy />
        <span className="hidden lg:inline">{t("copyLink")}</span>
      </Button>
      <Button variant="secondary" onClick={() => window.print()} aria-label={t("print")} className="print:hidden">
        <Printer />
      </Button>
    </>
  );
}

// ───────────── статус и оплата ─────────────

export function OrderStatusCard({ data, labels }: { data: OrderClientData; labels: StatusLabels }) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [comment, setComment] = useState("");
  const [target, setTarget] = useState<OrderStatus | "">("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("");

  const forward = data.orderTargets.filter((s) => s !== "CANCELLED" && FLOW.indexOf(s) > FLOW.indexOf(data.status));
  const backward = data.orderTargets.filter((s) => s !== "CANCELLED" && data.status !== "CANCELLED" && FLOW.indexOf(s) < FLOW.indexOf(data.status));
  const next = data.status === "CANCELLED" ? null : (forward.find((s) => !(s === "SHIPPED" && data.deliveryKind === "PICKUP")) ?? null);
  const canCancel = data.orderTargets.includes("CANCELLED");
  const canRestore = data.status === "CANCELLED" && data.orderTargets.length > 0;
  const others = [...forward.filter((s) => s !== next), ...backward];

  const change = (to: OrderStatus, note?: string) =>
    execute(() => changeOrderStatusAction({ orderId: data.id, to, comment: note || comment || null }), {
      success: t("statusChanged"),
      onSuccess: () => {
        setComment("");
        setTarget("");
      },
    });

  return (
    <Panel title={t("sections.status")}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={labels.order[data.status].tone} className="px-3 py-1.5 text-[13px]">
          {labels.order[data.status].label}
        </StatusPill>
        <StatusPill tone={labels.payment[data.paymentStatus].tone} className="px-3 py-1.5 text-[13px]">
          {labels.payment[data.paymentStatus].label}
        </StatusPill>
      </div>

      {/* воронка этапов */}
      {data.status !== "CANCELLED" && (
        <ol className="mt-4 flex items-center gap-1" aria-hidden>
          {FLOW.map((s) => (
            <li key={s} className={cn("h-1.5 flex-1 rounded-full", FLOW.indexOf(s) <= FLOW.indexOf(data.status) ? "bg-sage-600" : "bg-line")} title={labels.order[s].label} />
          ))}
        </ol>
      )}

      <div className="mt-4 space-y-2.5">
        {next && (
          <Button block loading={pending} onClick={() => void change(next)}>
            {t("statusTo", { status: labels.order[next].label })}
            <ArrowRight />
          </Button>
        )}
        {others.length > 0 && (
          <div className="flex gap-2">
            <Select value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)} wrapperClassName="flex-1" aria-label={t("changeStatus")}>
              <option value="">{t("changeStatus")}…</option>
              {others.map((s) => (
                <option key={s} value={s}>
                  {labels.order[s].label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" disabled={!target || pending} onClick={() => target && void change(target)}>
              {tc("apply")}
            </Button>
          </div>
        )}
        {(next || others.length > 0) && (
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("statusComment")} className="min-h-0 text-[13px]" maxLength={500} />
        )}
        {canRestore && (
          <Button variant="soft" block loading={pending} onClick={() => void change("NEW")}>
            <Undo2 />
            {t("restoreOrder")}
          </Button>
        )}
        {!next && others.length === 0 && !canRestore && <p className="text-[13px] text-ink-500">{t("noTransitions")}</p>}
        {!data.isOwner && <p className="text-[11.5px] leading-snug text-ink-400">{t("ownerOnlyBack")}</p>}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2.5 text-[13px] font-semibold text-graphite">{t("sections.payment")}</p>
        <div className="flex flex-wrap gap-2">
          {data.paymentTargets.includes("PAID") && (
            <Button size="sm" variant={data.paymentStatus === "UNPAID" ? "primary" : "secondary"} loading={pending} onClick={() => void execute(() => changePaymentStatusAction({ orderId: data.id, to: "PAID" }), { success: t("paymentChanged") })}>
              {t("markPaid")}
            </Button>
          )}
          {data.paymentTargets.includes("REFUNDED") && (
            <Button size="sm" variant="dangerSoft" onClick={() => setRefundOpen(true)}>
              <RotateCcw />
              {t("refund")}
            </Button>
          )}
          {data.paymentTargets.includes("UNPAID") && (
            <Button size="sm" variant="ghost" loading={pending} onClick={() => void execute(() => changePaymentStatusAction({ orderId: data.id, to: "UNPAID" }), { success: t("paymentChanged") })}>
              {labels.payment.UNPAID.label}
            </Button>
          )}
        </div>
      </div>

      {canCancel && (
        <Button variant="ghost" size="sm" className="mt-4 text-powder-800 hover:bg-powder-50" onClick={() => setCancelOpen(true)}>
          <Ban />
          {t("cancelOrder")}
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent title={t("cancelTitle", { number: data.number })} description={t("cancelText")}>
          <Field label={t("cancelReason")}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                void change("CANCELLED", reason).then((r) => {
                  if (r?.ok) {
                    setCancelOpen(false);
                    setReason("");
                  }
                })
              }
            >
              {t("cancelOrder")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent title={t("refundTitle", { number: data.number })} description={t("refundText")}>
          <Field label={tc("comment")}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setRefundOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                void execute(() => changePaymentStatusAction({ orderId: data.id, to: "REFUNDED", comment: reason || null }), {
                  success: t("paymentChanged"),
                  onSuccess: () => {
                    setRefundOpen(false);
                    setReason("");
                  },
                })
              }
            >
              {t("refund")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ───────────── состав заказа ─────────────

type EditLine = {
  key: string;
  variantId: string;
  name: string;
  label: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  /** Цена позиции: у старых — цена на момент заказа, у новых — null (текущая) */
  unitPrice: number | null;
  displayPrice: number;
  stock: number | null;
  allowBackorder?: boolean;
};

export function OrderItemsCard({ data }: { data: OrderClientData }) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [editing, setEditing] = useState(false);
  const initial = useMemo<EditLine[]>(
    () =>
      data.items
        .filter((i) => i.variantId)
        .map((i) => ({ key: i.id, variantId: i.variantId!, name: i.name, label: i.label, sku: i.sku, imageUrl: i.imageUrl, quantity: i.quantity, unitPrice: i.unitPrice, displayPrice: i.unitPrice, stock: i.stock })),
    [data.items],
  );
  const [lines, setLines] = useState<EditLine[]>(initial);
  const canEdit = data.editable && data.items.every((i) => i.variantId);

  const setLine = (key: string, patch: Partial<EditLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const draftTotal = lines.reduce((s, l) => s + (l.unitPrice ?? l.displayPrice) * l.quantity, 0);

  if (!editing) {
    return (
      <Panel
        title={t("sections.items")}
        action={
          canEdit ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setLines(initial);
                setEditing(true);
              }}
            >
              <Pencil />
              {t("editItems")}
            </Button>
          ) : data.editable ? null : (
            <span className="text-[12px] text-ink-400">{t("itemsLocked")}</span>
          )
        }
        padded={false}
      >
        <ul className="divide-y divide-line">
          {data.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
              <Thumb src={i.imageUrl} alt={i.name} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-graphite">{i.name}</p>
                <p className="text-[12.5px] text-ink-500">{[i.label, `${t("item.sku")} ${i.sku}`].filter(Boolean).join(" · ")}</p>
                {i.backorderQty > 0 && <StatusPill tone="sky" className="mt-1">{t("item.backorder", { count: i.backorderQty })}</StatusPill>}
              </div>
              <div className="text-right text-[13px] whitespace-nowrap text-ink-600">
                {formatMoney(i.unitPrice)} × {i.quantity}
                {i.regularPrice > i.unitPrice && <p className="text-[11.5px] text-ink-400 line-through">{formatMoney(i.regularPrice)}</p>}
              </div>
              <div className="w-24 text-right font-semibold whitespace-nowrap text-graphite">{formatMoney(i.lineTotal)}</div>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <Panel title={t("sections.items")} padded={false}>
      <div className="px-5 pb-3 sm:px-6">
        <VariantPicker
          onPick={(v) =>
            setLines((prev) => {
              const existing = prev.find((l) => l.variantId === v.variantId);
              if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
              return [
                ...prev,
                { key: `new-${v.variantId}`, variantId: v.variantId, name: v.name, label: v.label, sku: v.sku, imageUrl: v.imageUrl, quantity: 1, unitPrice: null, displayPrice: v.price, stock: v.stock, allowBackorder: v.allowBackorder },
              ];
            })
          }
        />
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {lines.map((l) => (
          <li key={l.key} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
            <Thumb src={l.imageUrl} size={44} />
            <div className="min-w-40 flex-1">
              <p className="text-[13.5px] font-semibold text-graphite">{l.name}</p>
              <p className="text-[12px] text-ink-500">{[l.label, l.sku].filter(Boolean).join(" · ")}</p>
              {l.stock != null && <p className={cn("text-[11.5px]", l.stock > 0 ? "text-sage-700" : "text-powder-700")}>{t("picker.inStock", { count: l.stock })}</p>}
            </div>
            <QuantityStepper value={l.quantity} onChange={(q) => setLine(l.key, { quantity: q })} min={1} max={999} size="sm" />
            <label className="flex w-32 items-center gap-1 rounded-md border border-line-strong bg-white px-2 text-[13px]" title={t("customPriceHint")}>
              <input
                inputMode="numeric"
                value={l.unitPrice ?? ""}
                placeholder={formatMoney(l.displayPrice).replace(/\s?₸/, "")}
                onChange={(e) => setLine(l.key, { unitPrice: parseMoney(e.target.value) })}
                className="h-9 w-full min-w-0 bg-transparent text-right font-semibold outline-none"
                aria-label={t("customPrice")}
              />
              ₸
            </label>
            <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="grid size-9 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={t("removeItem")}>
              <Trash className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
        <p className="text-[13px] text-ink-600">
          {tc("total")}: <span className="font-bold text-graphite">{formatMoney(draftTotal)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button
            loading={pending}
            disabled={lines.length === 0}
            onClick={() =>
              void execute(
                () => updateOrderItemsAction({ orderId: data.id, items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })) }),
                { success: t("itemsSaved"), onSuccess: () => setEditing(false) },
              )
            }
          >
            {t("saveItems")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

// ───────────── клиент, доставка, оплата ─────────────

type MethodOption = { id: string; nameRu: string; kind: string; price?: number; isActive: boolean };

export function OrderInfoCard({ data, deliveries, payments }: { data: OrderClientData; deliveries: MethodOption[]; payments: MethodOption[] }) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  const { pending, execute, fieldError } = useAdminAction();
  const [editing, setEditing] = useState(false);
  const initial = () => ({
    customerName: data.customerName,
    customerPhone: formatPhoneInput(data.customerPhone),
    customerEmail: data.customerEmail ?? "",
    deliveryMethodId: data.deliveryMethodId ?? "",
    deliveryPrice: String(data.deliveryPrice),
    region: data.region ?? "",
    city: data.city ?? "",
    street: data.street ?? "",
    house: data.house ?? "",
    apartment: data.apartment ?? "",
    postalCode: data.postalCode ?? "",
    paymentMethodId: data.paymentMethodId ?? "",
    comment: data.comment ?? "",
    trackingNumber: data.trackingNumber ?? "",
    managerNote: data.managerNote ?? "",
  });
  const [form, setForm] = useState(initial);
  const set = (key: keyof ReturnType<typeof initial>) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const kind = deliveries.find((d) => d.id === form.deliveryMethodId)?.kind ?? data.deliveryKind;
  const address = [data.region, data.city, data.street && `${data.street}${data.house ? `, ${data.house}` : ""}`, data.apartment && `кв. ${data.apartment}`, data.postalCode].filter(Boolean).join(", ");

  if (!editing) {
    return (
      <Panel
        title={`${t("sections.customer")} · ${t("sections.delivery")}`}
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setForm(initial());
              setEditing(true);
            }}
          >
            <Pencil />
            {t("editInfo")}
          </Button>
        }
      >
        <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
          <div>
            <InfoRow label={t("fields.name")}>{data.customerName}</InfoRow>
            <InfoRow label={t("fields.phone")}>
              <a href={telLink(data.customerPhone)} className="hover:text-sage-700">
                {formatPhone(data.customerPhone)}
              </a>
            </InfoRow>
            <InfoRow label={t("fields.email")}>{data.customerEmail || "—"}</InfoRow>
            <InfoRow label={t("fields.paymentMethod")}>{data.paymentName || t("noPayment")}</InfoRow>
          </div>
          <div>
            <InfoRow label={t("fields.deliveryMethod")}>{data.deliveryName || t("noDelivery")}</InfoRow>
            {data.deliveryKind !== "PICKUP" && address && <InfoRow label={t("fields.city")}>{address}</InfoRow>}
            <InfoRow label={t("fields.trackingNumber")}>{data.trackingNumber || "—"}</InfoRow>
          </div>
        </div>
        {data.comment && (
          <div className="mt-3 rounded-lg bg-cream px-3.5 py-2.5 text-[13.5px]">
            <p className="text-[12px] font-semibold text-ink-500">{t("fields.comment")}</p>
            <p className="mt-0.5 whitespace-pre-line text-graphite">{data.comment}</p>
          </div>
        )}
        {data.managerNote && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13.5px]">
            <p className="text-[12px] font-semibold text-amber-700">{t("fields.managerNote")}</p>
            <p className="mt-0.5 whitespace-pre-line text-graphite">{data.managerNote}</p>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel title={`${t("sections.customer")} · ${t("sections.delivery")}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void execute(
            () =>
              updateOrderInfoAction({
                orderId: data.id,
                ...form,
                deliveryMethodId: form.deliveryMethodId || null,
                paymentMethodId: form.paymentMethodId || null,
                deliveryPrice: parseMoney(form.deliveryPrice) ?? 0,
              }),
            { success: t("infoSaved"), onSuccess: () => setEditing(false) },
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("fields.name")} error={fieldError("customerName")}>
            <Input value={form.customerName} onChange={set("customerName")} maxLength={100} />
          </Field>
          <Field label={t("fields.phone")} error={fieldError("customerPhone")}>
            <Input value={form.customerPhone} inputMode="tel" onChange={(e) => setForm((f) => ({ ...f, customerPhone: formatPhoneInput(e.target.value) }))} />
          </Field>
          <Field label={t("fields.email")} error={fieldError("customerEmail")}>
            <Input type="email" value={form.customerEmail} onChange={set("customerEmail")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("fields.deliveryMethod")} className="sm:col-span-2">
            <Select value={form.deliveryMethodId} onChange={set("deliveryMethodId")}>
              <option value="">{t("noDelivery")}</option>
              {deliveries.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameRu}
                  {!d.isActive ? ` (${tc("inactive")})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.deliveryPrice")}>
            <Input inputMode="numeric" value={form.deliveryPrice} onChange={set("deliveryPrice")} />
          </Field>
        </div>
        {kind !== "PICKUP" ? (
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label={t("fields.region")} className="sm:col-span-3">
              <Input value={form.region} onChange={set("region")} />
            </Field>
            <Field label={t("fields.city")} className="sm:col-span-3">
              <Input value={form.city} onChange={set("city")} />
            </Field>
            <Field label={t("fields.street")} className="sm:col-span-3">
              <Input value={form.street} onChange={set("street")} />
            </Field>
            <Field label={t("fields.house")}>
              <Input value={form.house} onChange={set("house")} />
            </Field>
            <Field label={t("fields.apartment")}>
              <Input value={form.apartment} onChange={set("apartment")} />
            </Field>
            <Field label={t("fields.postalCode")}>
              <Input value={form.postalCode} onChange={set("postalCode")} />
            </Field>
          </div>
        ) : (
          <p className="text-[13px] text-ink-500">{t("pickupNoAddress")}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.paymentMethod")}>
            <Select value={form.paymentMethodId} onChange={set("paymentMethodId")}>
              <option value="">{t("noPayment")}</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameRu}
                  {!p.isActive ? ` (${tc("inactive")})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.trackingNumber")}>
            <Input value={form.trackingNumber} onChange={set("trackingNumber")} maxLength={100} />
          </Field>
        </div>
        <Field label={t("fields.comment")}>
          <Textarea rows={2} value={form.comment} onChange={set("comment")} maxLength={1000} />
        </Field>
        <Field label={t("fields.managerNote")}>
          <Textarea rows={2} value={form.managerNote} onChange={set("managerNote")} maxLength={2000} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={pending}>
            {tc("save")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void execute(() => addOrderNoteAction({ orderId, text }), { success: t("noteAdded"), onSuccess: () => setText("") });
      }}
    >
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("addNote")} maxLength={1000} />
      <Button type="submit" variant="secondary" loading={pending} disabled={!text.trim()}>
        {tc("add")}
      </Button>
    </form>
  );
}
