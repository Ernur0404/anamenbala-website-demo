"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProductOptionView, VariantView } from "@/server/catalog/product";
import { cn } from "@/lib/utils";

export type Selection = Record<string, string>;

function matches(variant: VariantView, selection: Selection) {
  return Object.entries(selection).every(([attr, value]) => variant.values[attr] === value);
}

/** Выбор варианта: недоступные сочетания видны, но помечены; выбор несовместимого значения сбрасывает остальные */
export function useVariantSelection(options: ProductOptionView[], variants: VariantView[], initial?: Selection) {
  const [selection, setSelection] = useState<Selection>(() => {
    if (initial) return initial;
    // по умолчанию выбран первый доступный вариант (как в макете: «Цвет: Молочный», размер отмечен)
    const first = variants.find((v) => v.stock > 0) ?? variants.find((v) => v.available) ?? variants[0];
    return first ? { ...first.values } : {};
  });

  const complete = options.every((o) => selection[o.attributeId]);
  const variant = useMemo(() => {
    if (!options.length) return variants[0] ?? null;
    if (!complete) return null;
    return variants.find((v) => matches(v, selection)) ?? null;
  }, [options.length, complete, variants, selection]);

  const valueState = (attributeId: string, valueId: string): "available" | "unavailable" | "absent" => {
    const others = Object.fromEntries(Object.entries(selection).filter(([a]) => a !== attributeId));
    const candidates = variants.filter((v) => v.values[attributeId] === valueId && matches(v, others));
    if (!candidates.length) return "absent";
    return candidates.some((v) => v.available) ? "available" : "unavailable";
  };

  const choose = (attributeId: string, valueId: string) => {
    setSelection((prev) => {
      const next = { ...prev, [attributeId]: valueId };
      if (variants.some((v) => matches(v, next))) return next;
      return { [attributeId]: valueId };
    });
  };

  return { selection, choose, variant, complete, valueState };
}

export function VariantSelector({
  options,
  valueState,
  selection,
  onChoose,
  sizeChartTrigger,
}: {
  options: ProductOptionView[];
  valueState: (attributeId: string, valueId: string) => "available" | "unavailable" | "absent";
  selection: Selection;
  onChoose: (attributeId: string, valueId: string) => void;
  sizeChartTrigger?: React.ReactNode;
}) {
  const t = useTranslations("product");
  return (
    <div className="space-y-5">
      {options.map((option, index) => {
        const selectedValue = option.values.find((v) => v.id === selection[option.attributeId]);
        const isSwatch = option.display === "SWATCH";
        return (
          <fieldset key={option.attributeId}>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <legend className="text-sm text-ink-600">
                {option.name}: <span className="font-semibold text-graphite">{selectedValue?.label ?? "—"}</span>
              </legend>
              {index === options.length - 1 && sizeChartTrigger}
            </div>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const state = valueState(option.attributeId, value.id);
                const active = selection[option.attributeId] === value.id;
                if (isSwatch) {
                  return (
                    <button
                      key={value.id}
                      type="button"
                      onClick={() => onChoose(option.attributeId, value.id)}
                      aria-pressed={active}
                      aria-label={value.label}
                      title={state === "available" ? value.label : `${value.label} — ${t("unavailable")}`}
                      className={cn(
                        "relative grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-white transition-shadow",
                        active ? "ring-2 ring-sage-700" : "ring-1 ring-line-strong hover:ring-sage-400",
                        state !== "available" && "opacity-45",
                      )}
                    >
                      <span className="size-7 rounded-full border border-black/5" style={{ background: value.colorHex ?? "#ddd" }} />
                      {state !== "available" && <span className="absolute h-px w-8 rotate-45 bg-ink-500" aria-hidden />}
                    </button>
                  );
                }
                return (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => onChoose(option.attributeId, value.id)}
                    aria-pressed={active}
                    title={state === "available" ? undefined : t("unavailable")}
                    className={cn(
                      "h-10 min-w-12 rounded-md border px-3 text-sm font-semibold transition-colors",
                      active ? "border-sage-700 bg-sage-700 text-white" : "border-line-strong bg-white text-graphite hover:border-sage-500",
                      state !== "available" && !active && "border-dashed text-ink-400 line-through decoration-ink-300",
                      state !== "available" && active && "bg-sage-600/80",
                    )}
                  >
                    {value.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
