"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Banknote, CircleCheck, CreditCard, QrCode, Trash } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { QuantityStepper } from "@/components/ui/quantity";
import { Panel, Thumb } from "@/components/admin/ui";
import { VariantPicker } from "@/components/admin/variant-picker";
import { useAdminAction } from "@/components/admin/use-action";
import { createPosSaleAction, type VariantPick } from "@/server/actions/admin/orders";
import { formatMoney, parseMoney } from "@/lib/money";
import { formatPhoneInput } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

type Line = VariantPick & { quantity: number; customPrice: number | null };
type Method = "CASH" | "CARD" | "KASPI";
const METHODS: { key: Method; icon: typeof Banknote }[] = [
  { key: "CASH", icon: Banknote },
  { key: "CARD", icon: CreditCard },
  { key: "KASPI", icon: QrCode },
];

export function PosTerminal() {
  const t = useTranslations("admin.pos");
  const to = useTranslations("admin.orders");
  const router = useRouter();
  const { pending, execute } = useAdminAction();
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<Method>("CASH");
  const [received, setReceived] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ orderId: string; number: number; total: number } | null>(null);

  const total = lines.reduce((s, l) => s + (l.customPrice ?? l.price) * l.quantity, 0);
  const cash = parseMoney(received);
  const change = method === "CASH" && cash != null ? cash - total : null;
  const shortage = lines.find((l) => l.quantity > l.stock);

  const add = (v: VariantPick) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === v.variantId);
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { ...v, quantity: 1, customPrice: null }];
    });
  const set = (variantId: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));

  const reset = () => {
    setLines([]);
    setReceived("");
    setCustomer({ name: "", phone: "" });
    setNote("");
    setDone(null);
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-sage-200 bg-white p-8 text-center shadow-soft">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-sage-100 text-sage-700">
          <CircleCheck className="size-8" />
        </span>
        <h2 className="heading-section mt-4 text-[30px]">{t("done")}</h2>
        <p className="mt-2 text-ink-600">{t("doneText", { number: done.number, total: formatMoney(done.total) })}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            {t("newSale")}
          </Button>
          <Link href={`/admin/orders/${done.orderId}`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
            {t("openOrder")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel padded={false} className="min-w-0">
        <div className="p-5 sm:p-6">
          <VariantPicker onPick={add} autoFocus />
          <p className="mt-2 text-[12px] text-ink-400">{t("scanHint")}</p>
        </div>
        {lines.length === 0 ? (
          <p className="border-t border-line px-6 py-12 text-center text-sm text-ink-500">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {lines.map((l) => (
              <li key={l.variantId} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <Thumb src={l.imageUrl} size={48} />
                <div className="min-w-40 flex-1">
                  <p className="text-[14px] font-semibold text-graphite">{l.name}</p>
                  <p className="text-[12px] text-ink-500">{[l.label, l.sku].filter(Boolean).join(" · ")}</p>
                  {l.quantity > l.stock && <p className="text-[11.5px] font-semibold text-powder-700">{t("notEnough", { count: l.stock })}</p>}
                </div>
                <QuantityStepper value={l.quantity} onChange={(q) => set(l.variantId, { quantity: q })} min={1} max={999} size="sm" />
                <label className="flex w-28 items-center gap-1 rounded-md border border-line-strong bg-white px-2 text-[13px]" title={to("customPriceHint")}>
                  <input
                    inputMode="numeric"
                    value={l.customPrice ?? ""}
                    placeholder={String(l.price)}
                    onChange={(e) => set(l.variantId, { customPrice: parseMoney(e.target.value) })}
                    className="h-9 w-full min-w-0 bg-transparent text-right font-semibold outline-none"
                    aria-label={to("customPrice")}
                  />
                  ₸
                </label>
                <span className="w-24 text-right font-bold text-graphite">{formatMoney((l.customPrice ?? l.price) * l.quantity)}</span>
                <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.variantId !== l.variantId))} className="grid size-9 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={to("removeItem")}>
                  <Trash className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="lg:sticky lg:top-24">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold text-ink-600">{t("total")}</span>
          <span className="text-[32px] leading-none font-bold text-graphite">{formatMoney(total)}</span>
        </div>

        <p className="mt-5 mb-2 text-[13px] font-semibold text-graphite">{t("payment")}</p>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              aria-pressed={method === key}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-[12.5px] font-semibold transition-colors",
                method === key ? "border-sage-700 bg-sage-700 text-white" : "border-line-strong bg-white text-ink-700 hover:border-sage-400",
              )}
            >
              <Icon className="size-5" />
              {t(`methods.${key}`)}
            </button>
          ))}
        </div>

        {method === "CASH" && (
          <div className="mt-4 grid grid-cols-2 items-end gap-3">
            <Field label={t("received")}>
              <Input inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(total)} />
            </Field>
            <div className="pb-2.5 text-right">
              <p className="text-[12px] text-ink-500">{t("change")}</p>
              <p className={cn("text-[18px] font-bold", change != null && change < 0 ? "text-powder-700" : "text-graphite")}>{change != null ? formatMoney(change) : "—"}</p>
            </div>
          </div>
        )}

        <details className="mt-4 rounded-lg border border-line px-3.5 py-2.5">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink-700">{t("customerOptional")}</summary>
          <div className="mt-3 space-y-3">
            <Field label={t("customerName")}>
              <Input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} maxLength={100} />
            </Field>
            <Field label={t("customerPhone")}>
              <Input inputMode="tel" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: formatPhoneInput(e.target.value) }))} />
            </Field>
            <Field label={t("note")}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
          </div>
        </details>

        <Button
          block
          size="lg"
          className="mt-5 h-14 text-[17px]"
          loading={pending}
          disabled={lines.length === 0 || Boolean(shortage)}
          onClick={() =>
            void execute(
              () =>
                createPosSaleAction({
                  items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.customPrice })),
                  payment: method,
                  customerName: customer.name || null,
                  customerPhone: customer.phone || null,
                  note: note || null,
                }),
              {
                success: false,
                onSuccess: (d) => {
                  setDone({ orderId: d.orderId, number: d.number, total });
                  router.refresh();
                },
              },
            )
          }
        >
          {t("sell")}
        </Button>
        {lines.length > 0 && (
          <Button variant="ghost" block className="mt-2" onClick={reset}>
            {t("clear")}
          </Button>
        )}
      </Panel>
    </div>
  );
}
