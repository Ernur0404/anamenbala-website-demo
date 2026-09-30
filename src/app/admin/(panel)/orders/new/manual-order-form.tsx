"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { QuantityStepper } from "@/components/ui/quantity";
import { Panel, Thumb, InfoRow } from "@/components/admin/ui";
import { VariantPicker } from "@/components/admin/variant-picker";
import { useAdminAction } from "@/components/admin/use-action";
import { createManualOrderAction, type VariantPick } from "@/server/actions/admin/orders";
import { formatMoney, parseMoney } from "@/lib/money";
import { formatPhoneInput } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

type Delivery = { id: string; nameRu: string; kind: string; price: number; freeFrom: number | null };
type Payment = { id: string; nameRu: string; kind: string };
type Line = VariantPick & { quantity: number; customPrice: number | null };

const SOURCES = ["WhatsApp", "Instagram", "Телефон", "Другое"] as const;

export function ManualOrderForm({
  deliveries,
  payments,
  links,
  statusNames,
}: {
  deliveries: Delivery[];
  payments: Payment[];
  links: { deliveryMethodId: string; paymentMethodId: string }[];
  statusNames: { NEW: string; CONFIRMED: string };
}) {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const { pending, execute, fieldError } = useAdminAction();

  const [source, setSource] = useState<string>("WhatsApp");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [lines, setLines] = useState<Line[]>([]);
  const [deliveryId, setDeliveryId] = useState(deliveries[0]?.id ?? "");
  const [deliveryPrice, setDeliveryPrice] = useState<string>("");
  const [address, setAddress] = useState({ region: "", city: "", street: "", house: "", apartment: "", postalCode: "" });
  const [paymentId, setPaymentId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [status, setStatus] = useState<"NEW" | "CONFIRMED">("CONFIRMED");
  const [paid, setPaid] = useState(false);
  const [comment, setComment] = useState("");
  const [managerNote, setManagerNote] = useState("");

  const delivery = deliveries.find((d) => d.id === deliveryId) ?? null;
  const allowedPayments = useMemo(() => {
    if (!delivery) return payments;
    const ids = new Set(links.filter((l) => l.deliveryMethodId === delivery.id).map((l) => l.paymentMethodId));
    return ids.size ? payments.filter((p) => ids.has(p.id)) : payments;
  }, [delivery, links, payments]);
  const paymentValue = allowedPayments.some((p) => p.id === paymentId) ? paymentId : (allowedPayments[0]?.id ?? "");

  const itemsTotal = lines.reduce((s, l) => s + (l.customPrice ?? l.price) * l.quantity, 0);
  const autoDelivery = delivery ? (delivery.freeFrom != null && itemsTotal >= delivery.freeFrom ? 0 : delivery.price) : 0;
  const deliveryValue = deliveryPrice.trim() === "" ? autoDelivery : (parseMoney(deliveryPrice) ?? 0);

  const addLine = (v: VariantPick) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === v.variantId);
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { ...v, quantity: 1, customPrice: null }];
    });
  const setLine = (variantId: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));

  const submit = () =>
    execute(
      () =>
        createManualOrderAction({
          source,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email || null,
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.customPrice })),
          deliveryMethodId: deliveryId || null,
          deliveryPrice: deliveryPrice.trim() === "" ? null : (parseMoney(deliveryPrice) ?? 0),
          ...address,
          paymentMethodId: paymentValue || null,
          promoCode: promoCode || null,
          comment: comment || null,
          managerNote: managerNote || null,
          status,
          paymentStatus: paid ? "PAID" : "UNPAID",
        }),
      {
        success: false,
        onSuccess: (data) => {
          router.push(`/admin/orders/${data.orderId}`);
          import("sonner").then(({ toast }) => toast.success(t("manual.created", { number: data.number })));
        },
      },
    );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Panel title={t("manual.customer")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.source")}>
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`sources.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("fields.name")} required error={fieldError("customerName")}>
              <Input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} maxLength={100} />
            </Field>
            <Field label={t("fields.phone")} required error={fieldError("customerPhone")}>
              <Input inputMode="tel" placeholder="+7 7__ ___ __ __" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: formatPhoneInput(e.target.value) }))} />
            </Field>
            <Field label={`${t("fields.email")} (${tc("optional")})`} error={fieldError("customerEmail")}>
              <Input type="email" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} />
            </Field>
          </div>
        </Panel>

        <Panel title={t("manual.items")} padded={false}>
          <div className="px-5 pb-4 sm:px-6">
            <VariantPicker onPick={addLine} autoFocus={false} />
          </div>
          {lines.length === 0 ? (
            <p className="border-t border-line px-6 py-8 text-center text-sm text-ink-500">{t("manual.noItems")}</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {lines.map((l) => {
                const short = l.stock < l.quantity;
                return (
                  <li key={l.variantId} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                    <Thumb src={l.imageUrl} size={44} />
                    <div className="min-w-40 flex-1">
                      <p className="text-[13.5px] font-semibold text-graphite">{l.name}</p>
                      <p className="text-[12px] text-ink-500">{[l.label, l.sku].filter(Boolean).join(" · ")}</p>
                      <p className={cn("text-[11.5px]", short ? (l.allowBackorder ? "text-sky-700" : "text-powder-700") : "text-sage-700")}>
                        {short && l.allowBackorder ? t("picker.backorder") : t("picker.inStock", { count: l.stock })}
                      </p>
                    </div>
                    <QuantityStepper value={l.quantity} onChange={(q) => setLine(l.variantId, { quantity: q })} min={1} max={999} size="sm" />
                    <label className="flex w-32 items-center gap-1 rounded-md border border-line-strong bg-white px-2 text-[13px]" title={t("customPriceHint")}>
                      <input
                        inputMode="numeric"
                        value={l.customPrice ?? ""}
                        placeholder={String(l.price)}
                        onChange={(e) => setLine(l.variantId, { customPrice: parseMoney(e.target.value) })}
                        className="h-9 w-full min-w-0 bg-transparent text-right font-semibold outline-none"
                        aria-label={t("customPrice")}
                      />
                      ₸
                    </label>
                    <span className="w-24 text-right font-semibold text-graphite">{formatMoney((l.customPrice ?? l.price) * l.quantity)}</span>
                    <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.variantId !== l.variantId))} className="grid size-9 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={t("removeItem")}>
                      <Trash className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("manual.delivery")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("fields.deliveryMethod")} className="sm:col-span-2">
              <Select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
                <option value="">{t("noDelivery")}</option>
                {deliveries.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameRu}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("fields.deliveryPrice")}>
              <Input inputMode="numeric" value={deliveryPrice} placeholder={String(autoDelivery)} onChange={(e) => setDeliveryPrice(e.target.value)} />
            </Field>
          </div>
          {delivery && delivery.kind !== "PICKUP" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-6">
              {delivery.kind === "KAZAKHSTAN" && (
                <Field label={t("fields.region")} className="sm:col-span-3">
                  <Input value={address.region} onChange={(e) => setAddress((a) => ({ ...a, region: e.target.value }))} />
                </Field>
              )}
              <Field label={t("fields.city")} className="sm:col-span-3" error={fieldError("city")}>
                <Input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
              </Field>
              <Field label={t("fields.street")} className="sm:col-span-3" error={fieldError("street")}>
                <Input value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} />
              </Field>
              <Field label={t("fields.house")} error={fieldError("house")}>
                <Input value={address.house} onChange={(e) => setAddress((a) => ({ ...a, house: e.target.value }))} />
              </Field>
              <Field label={t("fields.apartment")}>
                <Input value={address.apartment} onChange={(e) => setAddress((a) => ({ ...a, apartment: e.target.value }))} />
              </Field>
              {delivery.kind === "KAZAKHSTAN" && (
                <Field label={t("fields.postalCode")}>
                  <Input value={address.postalCode} onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))} />
                </Field>
              )}
            </div>
          )}
          {delivery?.kind === "PICKUP" && <p className="mt-3 text-[13px] text-ink-500">{t("pickupNoAddress")}</p>}
        </Panel>

        <Panel title={t("manual.payment")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.paymentMethod")}>
              <Select value={paymentValue} onChange={(e) => setPaymentId(e.target.value)}>
                <option value="">{t("noPayment")}</option>
                {allowedPayments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameRu}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${t("fields.promoCode")} (${tc("optional")})`} error={fieldError("promoCode")}>
              <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} maxLength={40} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.comment")}>
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
            </Field>
            <Field label={t("fields.managerNote")}>
              <Textarea rows={2} value={managerNote} onChange={(e) => setManagerNote(e.target.value)} maxLength={2000} />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="space-y-5 xl:sticky xl:top-24">
        <Panel title={t("sections.totals")}>
          <InfoRow label={t("totals.items")}>{formatMoney(itemsTotal)}</InfoRow>
          <InfoRow label={t("totals.delivery")}>{deliveryValue > 0 ? formatMoney(deliveryValue) : t("totals.free")}</InfoRow>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
            <span className="font-bold text-graphite">{t("totals.total")}</span>
            <span className="text-[20px] font-bold text-graphite">{formatMoney(itemsTotal + deliveryValue)}</span>
          </div>
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <Field label={t("manual.status")}>
              <Select value={status} onChange={(e) => setStatus(e.target.value as "NEW" | "CONFIRMED")}>
                <option value="CONFIRMED">{statusNames.CONFIRMED}</option>
                <option value="NEW">{statusNames.NEW}</option>
              </Select>
            </Field>
            <Checkbox label={t("manual.alreadyPaid")} checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          </div>
          <Button block size="lg" className="mt-5" loading={pending} disabled={lines.length === 0 || !customer.name.trim() || customer.phone.replace(/\D/g, "").length < 11} onClick={() => void submit()}>
            {t("manual.create")}
          </Button>
        </Panel>
      </div>
    </div>
  );
}
