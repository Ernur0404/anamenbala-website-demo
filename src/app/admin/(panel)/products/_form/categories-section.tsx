"use client";

import { useTranslations } from "next-intl";
import { Checkbox, Field, Select } from "@/components/ui/form";
import { ProductBadge } from "@/components/ui/display";
import { cn } from "@/lib/utils";
import type { ProductFormOptions } from "@/server/admin/products";

type Category = ProductFormOptions["categories"][number];

/** Дерево категорий с галочками (2 уровня, как в каталоге) */
export function CategoryPicker({ categories, selected, onChange, error }: { categories: Category[]; selected: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const t = useTranslations("admin.products");
  const roots = categories.filter((c) => !c.parentId);
  const set = new Set(selected);
  const toggle = (id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  return (
    <div>
      <p className="mb-3 text-[12px] leading-snug text-ink-500">{t("fields.categoriesHint")}</p>
      <div className={cn("max-h-80 space-y-1 overflow-y-auto rounded-lg border p-2", error ? "border-powder-600" : "border-line")}>
        {roots.map((root) => (
          <div key={root.id}>
            <div className="rounded-md px-2 py-1.5 hover:bg-cream">
              <Checkbox label={<span className="font-semibold text-graphite">{root.nameRu}</span>} checked={set.has(root.id)} onChange={() => toggle(root.id)} />
            </div>
            {categories
              .filter((c) => c.parentId === root.id)
              .map((child) => (
                <div key={child.id} className="rounded-md py-1.5 pr-2 pl-8 hover:bg-cream">
                  <Checkbox label={child.nameRu} checked={set.has(child.id)} onChange={() => toggle(child.id)} />
                </div>
              ))}
          </div>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-powder-700">{error}</p>}
    </div>
  );
}

export function PrimaryCategorySelect({ categories, selected, value, onChange }: { categories: Category[]; selected: string[]; value: string; onChange: (id: string) => void }) {
  const t = useTranslations("admin.products");
  if (selected.length < 2) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (
    <Field label={t("fields.primaryCategory")} hint={t("fields.primaryHint")} className="mt-4">
      <Select value={value || selected[0]} onChange={(e) => onChange(e.target.value)}>
        {selected.map((id) => {
          const c = byId.get(id);
          const parent = c?.parentId ? byId.get(c.parentId) : null;
          return (
            <option key={id} value={id}>
              {parent ? `${parent.nameRu} → ` : ""}
              {c?.nameRu}
            </option>
          );
        })}
      </Select>
    </Field>
  );
}

export function BadgePicker({ badges, selected, onChange }: { badges: ProductFormOptions["badges"]; selected: string[]; onChange: (ids: string[]) => void }) {
  const t = useTranslations("admin.products");
  const set = new Set(selected);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => {
          const on = set.has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((id) => id !== b.id) : [...selected, b.id])}
              className={cn("rounded-full p-0.5 transition-all", on ? "ring-2 ring-sage-600 ring-offset-1" : "opacity-60 hover:opacity-100")}
            >
              <ProductBadge style={b.style}>{b.nameRu}</ProductBadge>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[12px] leading-snug text-ink-500">{t("badgesHint")}</p>
    </div>
  );
}
