"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { ProductFormOptions } from "@/server/admin/products";
import { newKey, type SpecState } from "./state";

type Attribute = ProductFormOptions["attributes"][number];

/** Характеристики для фильтров (пол, возраст, сезон, материал…) — набор зависит от категорий товара */
export function AttributesSection({ attributes, selected, onChange }: { attributes: Attribute[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const t = useTranslations("admin.products.attributes");
  if (!attributes.length) return <p className="text-[13px] text-ink-500">{t("none")}</p>;
  const set = new Set(selected);

  const toggle = (attr: Attribute, valueId: string) => {
    const next = new Set(set);
    if (attr.type === "SELECT") {
      // одно значение: снимаем остальные значения этой характеристики
      for (const v of attr.values) if (v.id !== valueId) next.delete(v.id);
    }
    if (next.has(valueId)) next.delete(valueId);
    else next.add(valueId);
    onChange([...next]);
  };

  return (
    <div className="space-y-4">
      {attributes.map((attr) => (
        <div key={attr.id}>
          <p className="mb-2 text-[13px] font-semibold text-graphite">
            {attr.nameRu}
            {attr.unit && <span className="ml-1 font-normal text-ink-400">({attr.unit})</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {attr.values.map((v) => {
              const on = set.has(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggle(attr, v.id)}
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
        </div>
      ))}
    </div>
  );
}

/** Произвольные строки для вкладки «Характеристики» на странице товара */
export function SpecsSection({ specs, onChange }: { specs: SpecState[]; onChange: (next: SpecState[]) => void }) {
  const t = useTranslations("admin.products.specs");
  const set = (key: string, patch: Partial<SpecState>) => onChange(specs.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-ink-500">{t("hint")}</p>
      {specs.map((s) => (
        <div key={s.key} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <Input value={s.labelRu} onChange={(e) => set(s.key, { labelRu: e.target.value })} placeholder={t("label")} aria-label={t("label")} className="h-10" />
          <Input value={s.valueRu} onChange={(e) => set(s.key, { valueRu: e.target.value })} placeholder={t("value")} aria-label={t("value")} className="h-10" />
          <button type="button" onClick={() => onChange(specs.filter((x) => x.key !== s.key))} className="grid size-10 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800 sm:row-span-2" aria-label="×">
            <Trash className="size-4" />
          </button>
          <Input value={s.labelKk} onChange={(e) => set(s.key, { labelKk: e.target.value })} placeholder={t("labelKk")} aria-label={t("labelKk")} className="h-10" />
          <Input value={s.valueKk} onChange={(e) => set(s.key, { valueKk: e.target.value })} placeholder={t("valueKk")} aria-label={t("valueKk")} className="h-10" />
        </div>
      ))}
      <Button variant="soft" size="sm" onClick={() => onChange([...specs, { key: newKey("s"), labelRu: "", labelKk: "", valueRu: "", valueKk: "" }])}>
        <Plus />
        {t("add")}
      </Button>
    </div>
  );
}
