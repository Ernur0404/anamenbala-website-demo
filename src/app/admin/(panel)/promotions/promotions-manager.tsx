"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Dialog, SheetContent, Switch } from "@/components/ui/primitives";
import { StatusPill, type Tone } from "@/components/ui/display";
import { Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { ProductMultiPicker, type PickedProduct } from "@/components/admin/product-picker";
import { useAdminAction } from "@/components/admin/use-action";
import { deletePromotionAction, savePromotionAction, togglePromotionAction } from "@/server/actions/admin/promotions";
import type { ProductFormOptions } from "@/server/admin/products";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { CategoryPicker } from "../products/_form/categories-section";

type State = "active" | "scheduled" | "ended" | "off";
export type PromotionRow = {
  id: string;
  nameRu: string;
  nameKk: string;
  type: "PERCENT" | "FIXED";
  value: number;
  scope: "CATEGORY" | "BRAND" | "PRODUCT";
  categoryIds: string[];
  brandIds: string[];
  products: PickedProduct[];
  targetNames: string[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  state: State;
};
type Draft = Omit<PromotionRow, "id" | "targetNames" | "state"> & { id: string | null };

export const STATE_TONE: Record<State, Tone> = { active: "sage", scheduled: "sky", ended: "gray", off: "beige" };

export function periodLabel(t: (key: string, values?: Record<string, string>) => string, locale: string, start: string, end: string) {
  const d = (k: string) => formatDate(`${k}T12:00:00`, locale);
  if (!start && !end) return t("always");
  if (start && end) return `${d(start)} – ${d(end)}`;
  return start ? t("fromDate", { date: d(start) }) : t("toDate", { date: d(end) });
}

export function PromotionsManager({ rows, categories, brands }: { rows: PromotionRow[]; categories: ProductFormOptions["categories"]; brands: { id: string; name: string }[] }) {
  const t = useTranslations("admin.promotions");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { pending, execute, fieldErrors } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const empty: Draft = { id: null, nameRu: "", nameKk: "", type: "PERCENT", value: 10, scope: "CATEGORY", categoryIds: [], brandIds: [], products: [], startsAt: "", endsAt: "", isActive: true };

  return (
    <>
      <Panel
        padded={false}
        title={t("tabs.promotions")}
        action={
          <Button size="sm" onClick={() => setDraft(empty)}>
            <Plus />
            {t("addPromotion")}
          </Button>
        }
      >
        {rows.length === 0 ? (
          <p className="px-6 pb-10 text-center text-sm text-ink-500">{t("emptyPromotions")}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                <span className="grid h-12 min-w-16 place-items-center rounded-xl bg-powder-100 px-3 text-[17px] font-bold text-powder-800">{p.type === "PERCENT" ? `−${p.value}%` : `−${formatMoney(p.value)}`}</span>
                <div className="min-w-48 flex-1">
                  <p className="font-semibold text-graphite">{p.nameRu}</p>
                  <p className="line-clamp-1 text-[12.5px] text-ink-500">
                    {t(`scope.${p.scope}`)}: {p.targetNames.join(", ") || "—"}
                  </p>
                  <p className="text-[12px] text-ink-400">{periodLabel(t, locale, p.startsAt, p.endsAt)}</p>
                </div>
                <StatusPill tone={STATE_TONE[p.state]}>{t(`status.${p.state}`)}</StatusPill>
                <Switch checked={p.isActive} disabled={pending} onCheckedChange={(isActive) => void execute(() => togglePromotionAction({ id: p.id, isActive }), { success: t("repriced") })} aria-label={t("fields.isActive")} />
                <button
                  type="button"
                  onClick={() => setDraft({ id: p.id, nameRu: p.nameRu, nameKk: p.nameKk, type: p.type, value: p.value, scope: p.scope, categoryIds: p.categoryIds, brandIds: p.brandIds, products: p.products, startsAt: p.startsAt, endsAt: p.endsAt, isActive: p.isActive })}
                  className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700"
                  aria-label={tc("edit")}
                >
                  <Pencil className="size-3.5" />
                </button>
                <ConfirmButton title={t("deleteTitle", { name: p.nameRu })} text={t("deleteText")} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("delete")} onConfirm={() => execute(() => deletePromotionAction({ id: p.id }), { success: t("deleted") })}>
                  <Trash className="size-3.5" />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <SheetContent
            title={draft.id ? draft.nameRu : t("addPromotion")}
            className="w-[min(520px,96vw)] bg-white"
            footer={
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button
                  loading={pending}
                  disabled={!draft.nameRu.trim() || !draft.value}
                  onClick={() =>
                    void execute(() => savePromotionAction({ ...draft, productIds: draft.products.map((p) => p.id), startsAt: draft.startsAt || null, endsAt: draft.endsAt || null }), {
                      success: t("repriced"),
                      onSuccess: () => setDraft(null),
                      errorMessage: (f) => (f.fieldErrors?.targets ? t("needTargets") : undefined),
                    })
                  }
                >
                  {tc("save")}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Field label={t("fields.nameRu")} required>
                <Input value={draft.nameRu} onChange={(e) => setDraft({ ...draft, nameRu: e.target.value })} maxLength={120} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fields.type")}>
                  <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })}>
                    <option value="PERCENT">{t("type.PERCENT")}</option>
                    <option value="FIXED">{t("type.FIXED")}</option>
                  </Select>
                </Field>
                <Field label={t("fields.value")} error={fieldErrors.value ? tc("required") : undefined}>
                  <Input inputMode="numeric" value={draft.value || ""} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </Field>
              </div>
              <Field label={t("fields.scope")}>
                <Select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Draft["scope"] })}>
                  {(["CATEGORY", "BRAND", "PRODUCT"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`scope.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              {draft.scope === "CATEGORY" && (
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("fields.categories")}</p>
                  <CategoryPicker categories={categories} selected={draft.categoryIds} onChange={(categoryIds) => setDraft({ ...draft, categoryIds })} />
                </div>
              )}
              {draft.scope === "BRAND" && (
                <div className="space-y-2 rounded-lg border border-line p-3">
                  {brands.map((b) => (
                    <Checkbox
                      key={b.id}
                      label={b.name}
                      checked={draft.brandIds.includes(b.id)}
                      onChange={(e) => setDraft({ ...draft, brandIds: e.target.checked ? [...draft.brandIds, b.id] : draft.brandIds.filter((x) => x !== b.id) })}
                    />
                  ))}
                </div>
              )}
              {draft.scope === "PRODUCT" && (
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("fields.products")}</p>
                  <ProductMultiPicker value={draft.products} onChange={(products) => setDraft({ ...draft, products })} placeholder={t("fields.searchProduct")} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fields.startsAt")}>
                  <Input type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
                </Field>
                <Field label={t("fields.endsAt")} error={fieldErrors.endsAt ? tc("required") : undefined}>
                  <Input type="date" value={draft.endsAt} min={draft.startsAt || undefined} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
                </Field>
              </div>
              <p className="text-[12px] text-ink-500">{t("fields.noDates")}</p>
              <Checkbox label={t("fields.isActive")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
            </div>
          </SheetContent>
        )}
      </Dialog>
    </>
  );
}
