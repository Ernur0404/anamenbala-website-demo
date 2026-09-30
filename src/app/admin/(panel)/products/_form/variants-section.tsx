"use client";

import { useTranslations } from "next-intl";
import { Barcode, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/primitives";
import { internalEan13 } from "@/lib/barcode";
import { cn } from "@/lib/utils";
import type { ProductFormOptions } from "@/server/admin/products";
import { defaultSkuBase, emptyProductState, rebuildVariants, variantSku, type ProductFormState, type ValueLookup, type VariantState } from "./state";

type Attribute = ProductFormOptions["attributes"][number];

const cellInput = "h-9 w-full min-w-0 rounded-md border border-line-strong bg-white px-2.5 text-[13px] text-graphite outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15";

export function VariantsSection({
  state,
  update,
  axisAttributes,
  values,
  finance,
  fieldError,
}: {
  state: ProductFormState;
  update: (patch: Partial<ProductFormState> | ((s: ProductFormState) => Partial<ProductFormState>)) => void;
  axisAttributes: Attribute[];
  values: ValueLookup;
  finance: boolean;
  fieldError: (key: string) => string | undefined;
}) {
  const t = useTranslations("admin.products.variants");
  const tp = useTranslations("admin.products");
  const byId = new Map(axisAttributes.map((a) => [a.id, a]));

  const setVariant = (key: string, patch: Partial<VariantState>) => update((s) => ({ variants: s.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));

  const setAxes = (optionAttributeIds: string[], axisValues: Record<string, string[]>) =>
    update((s) => {
      const next = { ...s, optionAttributeIds, axisValues };
      return { optionAttributeIds, axisValues, variants: rebuildVariants(next, values) };
    });

  const toggleValue = (attributeId: string, valueId: string) => {
    const current = state.axisValues[attributeId] ?? [];
    const attr = byId.get(attributeId);
    // порядок значений — как в справочнике
    const order = attr?.values.map((v) => v.id) ?? [];
    const nextList = current.includes(valueId) ? current.filter((v) => v !== valueId) : [...current, valueId].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    setAxes(state.optionAttributeIds, { ...state.axisValues, [attributeId]: nextList });
  };

  const single = state.variants[0];
  const totalStock = state.variants.filter((v) => v.isActive).reduce((s, v) => s + (Number(v.stock) || 0), 0);

  if (!state.hasVariants) {
    return (
      <div className="space-y-4">
        <Checkbox
          label={t("hasVariants")}
          description={t("hint")}
          checked={false}
          onChange={() => update((s) => ({ hasVariants: true, skuBase: s.skuBase || defaultSkuBase(s.nameRu), variants: rebuildVariants({ ...s, hasVariants: true }, values) }))}
        />
        {single && (
          <div className={cn("grid gap-4", finance ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
            <Field label={t("sku")} required error={fieldError("variants.0.sku")}>
              <Input value={single.sku} onChange={(e) => setVariant(single.key, { sku: e.target.value.toUpperCase() })} maxLength={64} placeholder={defaultSkuBase(state.nameRu) || "SKU-001"} />
            </Field>
            <Field label={t("barcode")} error={fieldError("variants.0.barcode")} hint={t("barcodeHint")}>
              <div className="flex gap-1.5">
                <Input value={single.barcode} onChange={(e) => setVariant(single.key, { barcode: e.target.value.replace(/\s/g, "") })} maxLength={32} inputMode="numeric" />
                <Button variant="secondary" size="icon" className="size-11" onClick={() => setVariant(single.key, { barcode: internalEan13() })} aria-label={t("generateBarcodes")} title={t("generateBarcodes")}>
                  <Barcode />
                </Button>
              </div>
            </Field>
            <Field label={t("stock")} hint={single.id ? t("stockHint") : undefined}>
              <Input inputMode="numeric" value={single.stock} onChange={(e) => setVariant(single.key, { stock: e.target.value.replace(/\D/g, "") })} />
            </Field>
            {finance && (
              <Field label={tp("fields.costPrice")}>
                <Input inputMode="numeric" value={state.costPrice} onChange={(e) => update({ costPrice: e.target.value.replace(/\D/g, "") })} />
              </Field>
            )}
          </div>
        )}
      </div>
    );
  }

  const usedAxis = new Set(state.optionAttributeIds);
  return (
    <div className="space-y-5">
      <Checkbox
        label={t("hasVariants")}
        checked
        onChange={() =>
          update((s) => ({
            hasVariants: false,
            optionAttributeIds: [],
            axisValues: {},
            variants: [{ ...(s.variants.find((v) => v.id) ?? s.variants[0] ?? emptyProductState().variants[0]), optionValueIds: [] }],
          }))
        }
      />

      {/* оси вариантов */}
      <div className="space-y-4">
        {[0, 1].map((axis) => {
          const attributeId = state.optionAttributeIds[axis];
          if (axis === 1 && !state.optionAttributeIds[0]) return null;
          if (axis === 1 && !attributeId) {
            return (
              <Button
                key="add-axis"
                variant="soft"
                size="sm"
                onClick={() => {
                  const next = axisAttributes.find((a) => !usedAxis.has(a.id));
                  if (next) setAxes([...state.optionAttributeIds, next.id], { ...state.axisValues, [next.id]: [] });
                }}
                disabled={axisAttributes.every((a) => usedAxis.has(a.id))}
              >
                <Plus />
                {t("addAxis")}
              </Button>
            );
          }
          const attr = attributeId ? byId.get(attributeId) : undefined;
          return (
            <div key={axis} className="rounded-xl border border-line bg-cream/40 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-semibold text-graphite">{t("axis", { n: axis + 1 })}</span>
                <Select
                  value={attributeId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const ids = [...state.optionAttributeIds];
                    const { [ids[axis]]: _old, ...rest } = state.axisValues;
                    void _old;
                    ids[axis] = id;
                    setAxes(ids, { ...rest, [id]: [] });
                  }}
                  wrapperClassName="w-60"
                  className="h-9 text-[13px]"
                >
                  {!attributeId && <option value="">{t("chooseAxis")}</option>}
                  {axisAttributes
                    .filter((a) => a.id === attributeId || !usedAxis.has(a.id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nameRu}
                      </option>
                    ))}
                </Select>
                {axis === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const { [attributeId!]: _removed, ...rest } = state.axisValues;
                      void _removed;
                      setAxes(state.optionAttributeIds.slice(0, 1), rest);
                    }}
                    className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-500 hover:text-powder-800"
                  >
                    <X className="size-3.5" />
                    {t("removeAxis")}
                  </button>
                )}
              </div>
              {attr && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attr.values.length === 0 && <p className="text-[12.5px] text-ink-500">{t("noValues")}</p>}
                  {attr.values.map((v) => {
                    const on = (state.axisValues[attr.id] ?? []).includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggleValue(attr.id, v.id)}
                        aria-pressed={on}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors",
                          on ? "border-sage-700 bg-sage-700 text-white" : "border-line-strong bg-white text-ink-700 hover:border-sage-400",
                        )}
                      >
                        {v.colorHex && <span className="size-3.5 rounded-full border border-black/10" style={{ background: v.colorHex }} />}
                        {v.valueRu}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* артикулы */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("skuBase")} hint={t("skuBaseHint")} className="w-full max-w-xs">
          <Input value={state.skuBase} onChange={(e) => update({ skuBase: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} maxLength={30} placeholder={defaultSkuBase(state.nameRu)} />
        </Field>
        <Button
          variant="secondary"
          size="sm"
          className="mb-6"
          onClick={() => update((s) => ({ variants: s.variants.map((v) => ({ ...v, sku: variantSku(s.skuBase || defaultSkuBase(s.nameRu), v.optionValueIds, values) })) }))}
        >
          <RefreshCw />
          {t("generateSku")}
        </Button>
        <Button variant="secondary" size="sm" className="mb-6" onClick={() => update((s) => ({ variants: s.variants.map((v) => (v.barcode.trim() ? v : { ...v, barcode: internalEan13() })) }))}>
          <Barcode />
          {t("generateBarcodes")}
        </Button>
      </div>

      {/* таблица вариантов */}
      {state.variants.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="bg-cream/70 text-left text-[12px] text-ink-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">{t("variant")}</th>
                <th className="px-2 py-2.5 font-semibold">{t("sku")}</th>
                <th className="px-2 py-2.5 font-semibold">{t("barcode")}</th>
                <th className="w-28 px-2 py-2.5 font-semibold">{t("price")}</th>
                <th className="w-24 px-2 py-2.5 font-semibold">{t("stock")}</th>
                {finance && <th className="w-24 px-2 py-2.5 font-semibold">{t("cost")}</th>}
                <th className="w-20 px-3 py-2.5 text-center font-semibold">{t("active")}</th>
              </tr>
            </thead>
            <tbody>
              {state.variants.map((v, i) => {
                const skuError = fieldError(`variants.${i}.sku`);
                const barcodeError = fieldError(`variants.${i}.barcode`);
                return (
                  <tr key={v.key} className={cn("border-t border-line", !v.isActive && "bg-cream/50 text-ink-400")}>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {v.optionValueIds.map((id) => {
                          const val = values.get(id);
                          return (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-[12px] font-semibold text-graphite">
                              {val?.colorHex && <span className="size-3 rounded-full border border-black/10" style={{ background: val.colorHex }} />}
                              {val?.valueRu ?? "?"}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input value={v.sku} onChange={(e) => setVariant(v.key, { sku: e.target.value.toUpperCase() })} className={cn(cellInput, skuError && "border-powder-600")} aria-label={t("sku")} title={skuError} />
                    </td>
                    <td className="px-2 py-2">
                      <input value={v.barcode} onChange={(e) => setVariant(v.key, { barcode: e.target.value.replace(/\s/g, "") })} inputMode="numeric" className={cn(cellInput, barcodeError && "border-powder-600")} aria-label={t("barcode")} title={barcodeError} />
                    </td>
                    <td className="px-2 py-2">
                      <input value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder={state.price || "—"} className={cellInput} aria-label={t("price")} />
                    </td>
                    <td className="px-2 py-2">
                      <input value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={cellInput} aria-label={t("stock")} />
                    </td>
                    {finance && (
                      <td className="px-2 py-2">
                        <input value={v.costPrice} onChange={(e) => setVariant(v.key, { costPrice: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder={state.costPrice || "—"} className={cellInput} aria-label={t("cost")} />
                      </td>
                    )}
                    <td className="px-3 py-2 text-center">
                      <Switch checked={v.isActive} onCheckedChange={(checked) => setVariant(v.key, { isActive: checked })} aria-label={t("active")} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-500">
        <span>{t("totalStock", { count: totalStock })}</span>
        {state.id && <span>{t("stockHint")}</span>}
      </div>
    </div>
  );
}
