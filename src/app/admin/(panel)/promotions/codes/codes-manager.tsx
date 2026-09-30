"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Pencil, Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog, SheetContent, Switch } from "@/components/ui/primitives";
import { StatusPill } from "@/components/ui/display";
import { DataTable, EmptyRow, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { ProductMultiPicker, type PickedProduct } from "@/components/admin/product-picker";
import { useAdminAction } from "@/components/admin/use-action";
import { deletePromoCodeAction, savePromoCodeAction, togglePromoCodeAction } from "@/server/actions/admin/promotions";
import type { ProductFormOptions } from "@/server/admin/products";
import { formatMoney } from "@/lib/money";
import { CategoryPicker } from "../../products/_form/categories-section";
import { periodLabel, STATE_TONE } from "../promotions-manager";

type State = "active" | "scheduled" | "ended" | "off";
export type CodeRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  scope: "ALL" | "CATEGORIES" | "PRODUCTS";
  categoryIds: string[];
  products: PickedProduct[];
  targetNames: string[];
  minOrderAmount: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  usedCount: number;
  excludeDiscounted: boolean;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  note: string;
  state: State;
};
type Draft = Omit<CodeRow, "id" | "targetNames" | "state" | "usedCount"> & { id: string | null };

const num = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? Number(d) : null;
};

export function CodesManager({ rows, categories }: { rows: CodeRow[]; categories: ProductFormOptions["categories"] }) {
  const t = useTranslations("admin.promotions");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { pending, execute, fieldErrors } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const empty: Draft = {
    id: null,
    code: "",
    type: "PERCENT",
    value: 10,
    scope: "ALL",
    categoryIds: [],
    products: [],
    minOrderAmount: null,
    maxUses: null,
    maxUsesPerCustomer: 1,
    excludeDiscounted: false,
    startsAt: "",
    endsAt: "",
    isActive: true,
    note: "",
  };

  return (
    <>
      <Panel
        padded={false}
        title={t("tabs.codes")}
        action={
          <Button size="sm" onClick={() => setDraft(empty)}>
            <Plus />
            {t("addCode")}
          </Button>
        }
      >
        <DataTable minWidth={820}>
          <thead className="bg-cream/60">
            <tr>
              <Th>{t("columns.code")}</Th>
              <Th>{t("columns.discount")}</Th>
              <Th>{t("columns.conditions")}</Th>
              <Th align="right">{t("columns.uses")}</Th>
              <Th>{t("columns.period")}</Th>
              <Th>{t("columns.status")}</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={7} title={t("emptyCodes")} />}
            {rows.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(c.code).then(() => toast.success(tc("copied")))}
                    className="inline-flex items-center gap-1.5 rounded-md bg-cream-200 px-2.5 py-1 font-mono text-[13px] font-bold text-graphite hover:bg-sage-50"
                    title={tc("copy")}
                  >
                    {c.code}
                    <Copy className="size-3 text-ink-400" />
                  </button>
                  {c.note && <p className="mt-1 max-w-48 truncate text-[11.5px] text-ink-400">{c.note}</p>}
                </Td>
                <Td className="font-semibold text-powder-800">{c.type === "PERCENT" ? `−${c.value}%` : `−${formatMoney(c.value)}`}</Td>
                <Td className="text-[12.5px] text-ink-600">
                  <p>
                    {t(`scope.${c.scope}`)}
                    {c.targetNames.length > 0 && `: ${c.targetNames.slice(0, 2).join(", ")}${c.targetNames.length > 2 ? "…" : ""}`}
                  </p>
                  {c.minOrderAmount != null && <p>{t("minOrder", { amount: formatMoney(c.minOrderAmount) })}</p>}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {c.maxUses ? t("usedOf", { used: String(c.usedCount), max: String(c.maxUses) }) : t("usedCount", { used: String(c.usedCount) })}
                </Td>
                <Td className="text-[12.5px] whitespace-nowrap text-ink-600">{periodLabel(t, locale, c.startsAt, c.endsAt)}</Td>
                <Td>
                  <StatusPill tone={STATE_TONE[c.state]}>{t(`status.${c.state}`)}</StatusPill>
                </Td>
                <Td align="right">
                  <div className="inline-flex items-center gap-1.5">
                    <Switch checked={c.isActive} disabled={pending} onCheckedChange={(isActive) => void execute(() => togglePromoCodeAction({ id: c.id, isActive }), { success: t("saved") })} aria-label={t("fields.isActive")} />
                    <button
                      type="button"
                      onClick={() => setDraft({ ...c })}
                      className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700"
                      aria-label={tc("edit")}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <ConfirmButton title={t("deleteTitle", { name: c.code })} text={t("deleteCodeText")} confirmLabel={tc("delete")} size="iconSm" variant="ghost" className="border border-line bg-white text-ink-600 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("delete")} onConfirm={() => execute(() => deletePromoCodeAction({ id: c.id }), { success: t("deleted") })}>
                      <Trash className="size-3.5" />
                    </ConfirmButton>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <SheetContent
            title={draft.id ? draft.code : t("addCode")}
            className="w-[min(520px,96vw)] bg-white"
            footer={
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button
                  loading={pending}
                  disabled={draft.code.trim().length < 2 || !draft.value}
                  onClick={() =>
                    void execute(
                      () =>
                        savePromoCodeAction({
                          ...draft,
                          productIds: draft.products.map((p) => p.id),
                          startsAt: draft.startsAt || null,
                          endsAt: draft.endsAt || null,
                        }),
                      {
                        success: t("saved"),
                        onSuccess: () => setDraft(null),
                        errorMessage: (f) => (f.fieldErrors?.code === "codeTaken" ? t("codeTaken") : f.fieldErrors?.targets ? t("needTargets") : undefined),
                      },
                    )
                  }
                >
                  {tc("save")}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Field label={t("fields.code")} hint={t("fields.codeHint")} error={fieldErrors.code ? t("codeTaken") : undefined}>
                <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} maxLength={40} className="font-mono font-bold tracking-wide" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fields.type")}>
                  <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })}>
                    <option value="PERCENT">{t("type.PERCENT")}</option>
                    <option value="FIXED">{t("type.FIXED")}</option>
                  </Select>
                </Field>
                <Field label={t("fields.value")}>
                  <Input inputMode="numeric" value={draft.value || ""} onChange={(e) => setDraft({ ...draft, value: num(e.target.value) ?? 0 })} />
                </Field>
              </div>
              <Field label={t("fields.scope")}>
                <Select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Draft["scope"] })}>
                  {(["ALL", "CATEGORIES", "PRODUCTS"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`scope.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              {draft.scope === "CATEGORIES" && <CategoryPicker categories={categories} selected={draft.categoryIds} onChange={(categoryIds) => setDraft({ ...draft, categoryIds })} />}
              {draft.scope === "PRODUCTS" && <ProductMultiPicker value={draft.products} onChange={(products) => setDraft({ ...draft, products })} placeholder={t("fields.searchProduct")} />}
              <Field label={t("fields.minOrderAmount")}>
                <Input inputMode="numeric" value={draft.minOrderAmount ?? ""} onChange={(e) => setDraft({ ...draft, minOrderAmount: num(e.target.value) })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fields.maxUses")}>
                  <Input inputMode="numeric" value={draft.maxUses ?? ""} onChange={(e) => setDraft({ ...draft, maxUses: num(e.target.value) })} placeholder={t("unlimited")} />
                </Field>
                <Field label={t("fields.maxUsesPerCustomer")}>
                  <Input inputMode="numeric" value={draft.maxUsesPerCustomer ?? ""} onChange={(e) => setDraft({ ...draft, maxUsesPerCustomer: num(e.target.value) })} placeholder={t("unlimited")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fields.startsAt")}>
                  <Input type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
                </Field>
                <Field label={t("fields.endsAt")}>
                  <Input type="date" value={draft.endsAt} min={draft.startsAt || undefined} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
                </Field>
              </div>
              <Checkbox label={t("fields.excludeDiscounted")} checked={draft.excludeDiscounted} onChange={(e) => setDraft({ ...draft, excludeDiscounted: e.target.checked })} />
              <Checkbox label={t("fields.isActive")} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <Field label={t("fields.note")}>
                <Textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={500} />
              </Field>
            </div>
          </SheetContent>
        )}
      </Dialog>
    </>
  );
}
