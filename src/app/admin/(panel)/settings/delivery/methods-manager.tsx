"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Info, Pencil, Plus, Trash, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent, Switch } from "@/components/ui/primitives";
import { StatusPill } from "@/components/ui/display";
import { DynamicIcon, KaspiMark } from "@/components/ui/icons";
import { Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { IconSelect } from "@/components/admin/icon-select";
import { useAdminAction } from "@/components/admin/use-action";
import { formatMoney } from "@/lib/money";
import { deleteMethodAction, moveMethodAction, saveDeliveryMethodAction, savePaymentMethodAction } from "@/server/actions/admin/settings";

type DeliveryKind = "KAZAKHSTAN" | "LOCAL_COURIER" | "PICKUP";
type PaymentKind = "KASPI" | "ON_DELIVERY" | "ONLINE";

export type DeliveryRow = {
  id: string;
  kind: DeliveryKind;
  nameRu: string;
  nameKk: string;
  descriptionRu: string;
  descriptionKk: string;
  etaRu: string;
  etaKk: string;
  price: number;
  freeFrom: number | null;
  addressRu: string;
  addressKk: string;
  icon: string;
  isActive: boolean;
  orders: number;
};

export type PaymentRow = {
  id: string;
  kind: PaymentKind;
  nameRu: string;
  nameKk: string;
  descriptionRu: string;
  descriptionKk: string;
  instructionsRu: string;
  instructionsKk: string;
  icon: string;
  isActive: boolean;
  deliveryMethodIds: string[];
  orders: number;
};

const iconBtn = "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700 disabled:opacity-30";
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 9);

function MoveButtons({ kind, id, first, last }: { kind: "delivery" | "payment"; id: string; first: boolean; last: boolean }) {
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const move = (direction: "up" | "down") => execute(() => moveMethodAction({ kind, id, direction }), { success: false });
  return (
    <div className="inline-flex gap-1.5">
      <button type="button" className={iconBtn} disabled={first || pending} onClick={() => void move("up")} aria-label={tc("moveUp")}>
        <ArrowUp className="size-3.5" />
      </button>
      <button type="button" className={iconBtn} disabled={last || pending} onClick={() => void move("down")} aria-label={tc("moveDown")}>
        <ArrowDown className="size-3.5" />
      </button>
    </div>
  );
}

function useDeleteMethod() {
  const t = useTranslations("admin.settings.delivery");
  const tc = useTranslations("admin.common");
  const { execute } = useAdminAction();
  return (kind: "delivery" | "payment", id: string) =>
    execute(() => deleteMethodAction({ kind, id }), { success: false, onSuccess: (r) => toast.success(r.disabled ? t("inUse") : tc("deleted")) });
}

/** Пара полей RU / KZ */
function Pair({ labelRu, labelKk, ru, kk, onRu, onKk, area, max }: { labelRu: string; labelKk: string; ru: string; kk: string; onRu: (v: string) => void; onKk: (v: string) => void; area?: boolean; max: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={labelRu}>{area ? <Textarea rows={3} value={ru} maxLength={max} onChange={(e) => onRu(e.target.value)} /> : <Input value={ru} maxLength={max} onChange={(e) => onRu(e.target.value)} />}</Field>
      <Field label={labelKk}>{area ? <Textarea rows={3} value={kk} maxLength={max} onChange={(e) => onKk(e.target.value)} /> : <Input value={kk} maxLength={max} onChange={(e) => onKk(e.target.value)} />}</Field>
    </div>
  );
}

// ───────────── доставка ─────────────

const EMPTY_DELIVERY: DeliveryRow = {
  id: "",
  kind: "KAZAKHSTAN",
  nameRu: "",
  nameKk: "",
  descriptionRu: "",
  descriptionKk: "",
  etaRu: "",
  etaKk: "",
  price: 0,
  freeFrom: null,
  addressRu: "",
  addressKk: "",
  icon: "truck",
  isActive: true,
  orders: 0,
};

export function DeliveryMethods({ methods }: { methods: DeliveryRow[] }) {
  const t = useTranslations("admin.settings.delivery");
  const ts = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const remove = useDeleteMethod();
  const [draft, setDraft] = useState<DeliveryRow | null>(null);

  const save = (row: DeliveryRow, close: boolean) =>
    execute(
      () =>
        saveDeliveryMethodAction({
          id: row.id || null,
          kind: row.kind,
          nameRu: row.nameRu,
          nameKk: row.nameKk,
          descriptionRu: row.descriptionRu,
          descriptionKk: row.descriptionKk,
          etaRu: row.etaRu,
          etaKk: row.etaKk,
          price: row.price,
          freeFrom: row.freeFrom,
          addressRu: row.addressRu,
          addressKk: row.addressKk,
          icon: row.icon,
          isActive: row.isActive,
        }),
      { success: ts("saved"), onSuccess: () => close && setDraft(null) },
    );

  const priceLine = (m: DeliveryRow) => {
    const base = m.price === 0 ? t("free") : formatMoney(m.price);
    return m.price > 0 && m.freeFrom != null ? `${base} · ${t("freeFromShort", { amount: formatMoney(m.freeFrom) })}` : base;
  };

  return (
    <Panel
      title={t("methods")}
      serif
      padded={false}
      action={
        <Button size="sm" onClick={() => setDraft(EMPTY_DELIVERY)}>
          <Plus />
          {t("addDelivery")}
        </Button>
      }
    >
      <ul className="divide-y divide-line border-t border-line">
        {methods.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink-500">{tc("emptyList")}</li>}
        {methods.map((m, i) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sage-50 text-sage-700">
              <DynamicIcon name={m.icon} size={20} />
            </span>
            <div className="min-w-48 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-graphite">
                {m.nameRu}
                {!m.isActive && <StatusPill tone="gray">{tc("inactive")}</StatusPill>}
              </p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">
                {t(`kinds.${m.kind}`)} · {priceLine(m)}
                {m.etaRu && ` · ${m.etaRu}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={m.isActive} disabled={pending} onCheckedChange={(v) => void save({ ...m, isActive: v }, false)} aria-label={t("isActive")} />
              <MoveButtons kind="delivery" id={m.id} first={i === 0} last={i === methods.length - 1} />
              <button type="button" className={iconBtn} onClick={() => setDraft(m)} aria-label={tc("edit")}>
                <Pencil className="size-3.5" />
              </button>
              <ConfirmButton
                title={t("deleteTitle", { name: m.nameRu })}
                text={t("deleteText")}
                confirmLabel={tc("delete")}
                size="iconSm"
                variant="ghost"
                className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800"
                onConfirm={() => remove("delivery", m.id)}
                aria-label={tc("delete")}
              >
                <Trash className="size-3.5" />
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={draft.id ? draft.nameRu : t("addDelivery")} size="lg">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save(draft, true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <Field label={t("kind")}>
                  <Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DeliveryKind })}>
                    {(["KAZAKHSTAN", "LOCAL_COURIER", "PICKUP"] as const).map((k) => (
                      <option key={k} value={k}>
                        {t(`kinds.${k}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("icon")}>
                  <IconSelect value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
                </Field>
              </div>
              <Pair labelRu={t("nameRu")} labelKk={t("nameKk")} ru={draft.nameRu} kk={draft.nameKk} onRu={(v) => setDraft({ ...draft, nameRu: v })} onKk={(v) => setDraft({ ...draft, nameKk: v })} max={100} />
              <Pair
                labelRu={t("descriptionRu")}
                labelKk={t("descriptionKk")}
                ru={draft.descriptionRu}
                kk={draft.descriptionKk}
                onRu={(v) => setDraft({ ...draft, descriptionRu: v })}
                onKk={(v) => setDraft({ ...draft, descriptionKk: v })}
                area
                max={500}
              />
              <Pair labelRu={t("etaRu")} labelKk={t("etaKk")} ru={draft.etaRu} kk={draft.etaKk} onRu={(v) => setDraft({ ...draft, etaRu: v })} onKk={(v) => setDraft({ ...draft, etaKk: v })} max={80} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("price")}>
                  <Input inputMode="numeric" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: Number(digits(e.target.value)) || 0 })} />
                </Field>
                <Field label={t("freeFrom")} hint={t("freeFromHint")}>
                  <Input inputMode="numeric" value={draft.freeFrom == null ? "" : String(draft.freeFrom)} onChange={(e) => setDraft({ ...draft, freeFrom: digits(e.target.value) ? Number(digits(e.target.value)) : null })} />
                </Field>
              </div>
              {draft.kind !== "KAZAKHSTAN" && (
                <Pair labelRu={t("addressRu")} labelKk={t("addressKk")} ru={draft.addressRu} kk={draft.addressKk} onRu={(v) => setDraft({ ...draft, addressRu: v })} onKk={(v) => setDraft({ ...draft, addressKk: v })} max={300} />
              )}
              <Checkbox label={t("isActive")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <div className="flex justify-end gap-2.5 pt-1">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={!draft.nameRu.trim()}>
                  {tc("save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </Panel>
  );
}

// ───────────── оплата ─────────────

export function PaymentMethods({ methods, deliveries }: { methods: PaymentRow[]; deliveries: { id: string; name: string; isActive: boolean }[] }) {
  const t = useTranslations("admin.settings.delivery");
  const ts = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute } = useAdminAction();
  const remove = useDeleteMethod();
  const [draft, setDraft] = useState<PaymentRow | null>(null);

  const save = (row: PaymentRow, close: boolean) =>
    execute(
      () =>
        savePaymentMethodAction({
          id: row.id || null,
          kind: row.kind,
          nameRu: row.nameRu,
          nameKk: row.nameKk,
          descriptionRu: row.descriptionRu,
          descriptionKk: row.descriptionKk,
          instructionsRu: row.instructionsRu,
          instructionsKk: row.instructionsKk,
          icon: row.icon,
          isActive: row.isActive,
          deliveryMethodIds: row.deliveryMethodIds,
        }),
      { success: ts("saved"), onSuccess: () => close && setDraft(null) },
    );

  const empty: PaymentRow = {
    id: "",
    kind: "KASPI",
    nameRu: "",
    nameKk: "",
    descriptionRu: "",
    descriptionKk: "",
    instructionsRu: "",
    instructionsKk: "",
    icon: "",
    isActive: true,
    deliveryMethodIds: deliveries.filter((d) => d.isActive).map((d) => d.id),
    orders: 0,
  };
  const kinds: PaymentKind[] = draft?.kind === "ONLINE" ? ["KASPI", "ON_DELIVERY", "ONLINE"] : ["KASPI", "ON_DELIVERY"];

  return (
    <Panel
      title={t("payments")}
      serif
      padded={false}
      action={
        <Button size="sm" onClick={() => setDraft(empty)}>
          <Plus />
          {t("addPayment")}
        </Button>
      }
    >
      <ul className="divide-y divide-line border-t border-line">
        {methods.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink-500">{tc("emptyList")}</li>}
        {methods.map((m, i) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-beige-50 text-sage-700">
              {m.kind === "KASPI" ? <KaspiMark /> : <Wallet className="size-5" />}
            </span>
            <div className="min-w-48 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-graphite">
                {m.nameRu}
                {!m.isActive && <StatusPill tone="gray">{tc("inactive")}</StatusPill>}
              </p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">{t(`paymentKinds.${m.kind}`)}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {deliveries
                  .filter((d) => m.deliveryMethodIds.includes(d.id))
                  .map((d) => (
                    <span key={d.id} className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${d.isActive ? "bg-sage-50 text-sage-800" : "bg-beige-100 text-ink-500 line-through"}`}>
                      {d.name}
                    </span>
                  ))}
                {m.deliveryMethodIds.length === 0 && <span className="text-[12px] font-medium text-amber-700">{t("noDeliveries")}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={m.isActive} disabled={pending} onCheckedChange={(v) => void save({ ...m, isActive: v }, false)} aria-label={t("isActive")} />
              <MoveButtons kind="payment" id={m.id} first={i === 0} last={i === methods.length - 1} />
              <button type="button" className={iconBtn} onClick={() => setDraft(m)} aria-label={tc("edit")}>
                <Pencil className="size-3.5" />
              </button>
              <ConfirmButton
                title={t("deleteTitle", { name: m.nameRu })}
                text={t("deleteText")}
                confirmLabel={tc("delete")}
                size="iconSm"
                variant="ghost"
                className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800"
                onConfirm={() => remove("payment", m.id)}
                aria-label={tc("delete")}
              >
                <Trash className="size-3.5" />
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-2 border-t border-line px-5 py-4 text-[12.5px] leading-relaxed text-ink-500 sm:px-6">
        <Info className="mt-0.5 size-4 shrink-0 text-sage-600" />
        {t("onlineNote")}
      </p>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={draft.id ? draft.nameRu : t("addPayment")} size="lg">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save(draft, true);
              }}
            >
              <Field label={t("kind")}>
                <Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as PaymentKind })}>
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {t(`paymentKinds.${k}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Pair labelRu={t("nameRu")} labelKk={t("nameKk")} ru={draft.nameRu} kk={draft.nameKk} onRu={(v) => setDraft({ ...draft, nameRu: v })} onKk={(v) => setDraft({ ...draft, nameKk: v })} max={100} />
              <Pair
                labelRu={t("descriptionRu")}
                labelKk={t("descriptionKk")}
                ru={draft.descriptionRu}
                kk={draft.descriptionKk}
                onRu={(v) => setDraft({ ...draft, descriptionRu: v })}
                onKk={(v) => setDraft({ ...draft, descriptionKk: v })}
                area
                max={500}
              />
              <Pair
                labelRu={t("instructionsRu")}
                labelKk={t("instructionsKk")}
                ru={draft.instructionsRu}
                kk={draft.instructionsKk}
                onRu={(v) => setDraft({ ...draft, instructionsRu: v })}
                onKk={(v) => setDraft({ ...draft, instructionsKk: v })}
                area
                max={2000}
              />
              <p className="-mt-2 text-[12px] text-ink-500">{t("instructionsHint")}</p>
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink-700">{t("availableFor")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {deliveries.map((d) => (
                    <Checkbox
                      key={d.id}
                      label={d.name}
                      description={d.isActive ? undefined : tc("inactive")}
                      checked={draft.deliveryMethodIds.includes(d.id)}
                      onChange={(e) =>
                        setDraft({ ...draft, deliveryMethodIds: e.target.checked ? [...draft.deliveryMethodIds, d.id] : draft.deliveryMethodIds.filter((x) => x !== d.id) })
                      }
                    />
                  ))}
                </div>
              </fieldset>
              <Checkbox label={t("isActive")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <div className="flex justify-end gap-2.5 pt-1">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={!draft.nameRu.trim()}>
                  {tc("save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </Panel>
  );
}
