"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Slider } from "radix-ui";
import { SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/primitives";
import type { Facet } from "@/server/catalog/listing";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useQueryState } from "./use-query-state";

export type FiltersProps = {
  facets: Facet[];
  brands: { slug: string; name: string; count: number; selected: boolean }[];
  priceRange: { min: number; max: number };
  categoryFacet?: { slug: string; label: string; count: number; selected: boolean }[];
  showDiscount?: boolean;
  total: number;
};

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-5 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-sm font-bold text-graphite">{title}</h3>
      {children}
    </div>
  );
}

function PriceFilter({ range }: { range: { min: number; max: number } }) {
  const t = useTranslations("listing");
  const { searchParams, update } = useQueryState();
  const floor = Math.floor(range.min / 100) * 100;
  const ceil = Math.max(floor + 100, Math.ceil(range.max / 100) * 100);
  const currentMin = Number(searchParams.get("pmin") ?? floor);
  const currentMax = Number(searchParams.get("pmax") ?? ceil);
  // черновик ползунка действует, пока диапазон в адресе не изменился (фильтры сбросили, перешли назад…)
  const committed: [number, number] = [Math.max(floor, currentMin), Math.min(ceil, currentMax)];
  const base = `${floor}-${ceil}-${committed.join("-")}`;
  const [draft, setDraft] = useState<{ base: string; value: [number, number] } | null>(null);
  const value = draft && draft.base === base ? draft.value : committed;
  const setValue = (next: [number, number]) => setDraft({ base, value: next });

  const apply = ([a, b]: [number, number]) =>
    update((p) => {
      const [from, to] = a <= b ? [a, b] : [b, a];
      if (from > floor) p.set("pmin", String(from));
      else p.delete("pmin");
      if (to < ceil) p.set("pmax", String(to));
      else p.delete("pmax");
    });

  if (ceil <= floor) return null;
  return (
    <div>
      <Slider.Root
        className="relative flex h-5 touch-none items-center select-none"
        min={floor}
        max={ceil}
        step={100}
        value={value}
        minStepsBetweenThumbs={1}
        onValueChange={(v) => setValue([v[0], v[1]])}
        onValueCommit={(v) => apply([v[0], v[1]])}
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-line-strong">
          <Slider.Range className="absolute h-full rounded-full bg-sage-700" />
        </Slider.Track>
        {[0, 1].map((i) => (
          <Slider.Thumb key={i} className="block size-[18px] rounded-full border-2 border-sage-700 bg-white shadow-soft outline-none focus-visible:ring-3 focus-visible:ring-sage-500/30" aria-label={i === 0 ? t("priceFrom") : t("priceTo")} />
        ))}
      </Slider.Root>
      <div className="mt-3 flex items-center gap-2">
        <label className="flex h-9 flex-1 items-center gap-1 rounded-md border border-line-strong bg-white px-2 text-xs text-ink-500">
          {t("priceFrom")}
          <input
            inputMode="numeric"
            className="w-full bg-transparent text-sm font-semibold text-graphite outline-none"
            value={formatNumber(value[0])}
            onChange={(e) => setValue([Number(e.target.value.replace(/\D/g, "")) || floor, value[1]])}
            onBlur={() => apply(value)}
            onKeyDown={(e) => e.key === "Enter" && apply(value)}
          />
        </label>
        <span className="text-ink-300">—</span>
        <label className="flex h-9 flex-1 items-center gap-1 rounded-md border border-line-strong bg-white px-2 text-xs text-ink-500">
          {t("priceTo")}
          <input
            inputMode="numeric"
            className="w-full bg-transparent text-sm font-semibold text-graphite outline-none"
            value={formatNumber(value[1])}
            onChange={(e) => setValue([value[0], Number(e.target.value.replace(/\D/g, "")) || ceil])}
            onBlur={() => apply(value)}
            onKeyDown={(e) => e.key === "Enter" && apply(value)}
          />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">
        {formatMoney(floor)} — {formatMoney(ceil)}
      </p>
    </div>
  );
}

function FacetValues({ facet }: { facet: Facet }) {
  const t = useTranslations("listing");
  const { toggleInList } = useQueryState();
  const [expanded, setExpanded] = useState(false);
  const key = `f.${facet.code}`;
  const limit = facet.display === "SWATCH" ? 12 : 6;
  const values = expanded ? facet.values : facet.values.slice(0, limit);

  return (
    <>
      {facet.display === "SWATCH" ? (
        <div className="flex flex-wrap gap-2.5">
          {values.map((v) => (
            <button
              key={v.slug}
              type="button"
              onClick={() => toggleInList(key, v.slug)}
              aria-pressed={v.selected}
              aria-label={`${v.label} (${v.count})`}
              title={`${v.label} (${v.count})`}
              className={cn("grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-white transition-shadow", v.selected ? "ring-2 ring-sage-700" : "ring-1 ring-line-strong hover:ring-sage-400")}
            >
              <span className="size-6 rounded-full border border-black/5" style={{ background: v.colorHex ?? "#ddd" }} />
            </button>
          ))}
        </div>
      ) : facet.display === "CHIPS" ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button
              key={v.slug}
              type="button"
              onClick={() => toggleInList(key, v.slug)}
              aria-pressed={v.selected}
              className={cn(
                "h-8 min-w-10 rounded-md border px-2.5 text-xs font-semibold transition-colors",
                v.selected ? "border-sage-700 bg-sage-700 text-white" : "border-line-strong bg-white hover:border-sage-500",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {values.map((v) => (
            <Checkbox
              key={v.slug}
              checked={v.selected}
              onChange={() => toggleInList(key, v.slug)}
              label={
                <span className="flex justify-between gap-2">
                  {v.label}
                  <span className="text-xs text-ink-400">{v.count}</span>
                </span>
              }
            />
          ))}
        </div>
      )}
      {facet.values.length > limit && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 text-xs font-semibold text-sage-700 hover:underline">
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </>
  );
}

export function FiltersPanel({ facets, brands, priceRange, categoryFacet, showDiscount }: FiltersProps) {
  const t = useTranslations("listing");
  const { list, toggleInList, update, searchParams } = useQueryState();
  const availability = list("avail");
  const discount = searchParams.get("disc");
  const hasActive = [...searchParams.keys()].some((k) => k.startsWith("f.") || ["pmin", "pmax", "avail", "brand", "disc", "cat"].includes(k));

  return (
    <div>
      {hasActive && (
        <button
          type="button"
          className="mb-4 text-xs font-semibold text-sage-700 hover:underline"
          onClick={() =>
            update((p) => {
              for (const key of [...p.keys()]) if (key.startsWith("f.") || ["pmin", "pmax", "avail", "brand", "disc", "cat"].includes(key)) p.delete(key);
            })
          }
        >
          {t("resetAll")}
        </button>
      )}

      {categoryFacet && categoryFacet.length > 0 && (
        <FilterGroup title={t("category")}>
          <div className="space-y-2.5">
            {categoryFacet.map((c) => (
              <Checkbox
                key={c.slug}
                checked={c.selected}
                onChange={() => toggleInList("cat", c.slug)}
                label={
                  <span className="flex justify-between gap-2">
                    {c.label}
                    <span className="text-xs text-ink-400">{c.count}</span>
                  </span>
                }
              />
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title={t("price")}>
        <PriceFilter range={priceRange} />
      </FilterGroup>

      <FilterGroup title={t("availability")}>
        <div className="space-y-2.5">
          <Checkbox checked={availability.includes("in_stock")} onChange={() => toggleInList("avail", "in_stock")} label={t("inStock")} />
          <Checkbox checked={availability.includes("backorder")} onChange={() => toggleInList("avail", "backorder")} label={t("backorder")} />
        </div>
      </FilterGroup>

      {showDiscount && (
        <FilterGroup title={t("discount")}>
          <div className="space-y-2.5">
            {[10, 20, 30, 50].map((d) => (
              <Checkbox
                key={d}
                checked={discount === String(d)}
                onChange={() =>
                  update((p) => {
                    if (p.get("disc") === String(d)) p.delete("disc");
                    else p.set("disc", String(d));
                  })
                }
                label={t("discountFrom", { value: d })}
              />
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.map((facet) => (
        <FilterGroup key={facet.code} title={facet.label}>
          <FacetValues facet={facet} />
        </FilterGroup>
      ))}

      {brands.length > 0 && (
        <FilterGroup title={t("brand")}>
          <div className="space-y-2.5">
            {brands.map((b) => (
              <Checkbox
                key={b.slug}
                checked={b.selected}
                onChange={() => toggleInList("brand", b.slug)}
                label={
                  <span className="flex justify-between gap-2">
                    {b.name}
                    <span className="text-xs text-ink-400">{b.count}</span>
                  </span>
                }
              />
            ))}
          </div>
        </FilterGroup>
      )}
    </div>
  );
}

/** Кнопка «Фильтры» и нижняя шторка на телефоне */
export function MobileFilters(props: FiltersProps) {
  const t = useTranslations("listing");
  const [open, setOpen] = useState(false);
  const { searchParams, pending } = useQueryState();
  const activeCount = [...searchParams.keys()].filter((k) => k.startsWith("f.") || ["pmin", "avail", "brand", "disc", "cat"].includes(k)).length;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal />
        {t("filters")}
        {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-sage-700 text-[10px] text-white">{activeCount}</span>}
      </Button>
      <SheetContent
        side="bottom"
        title={t("filters")}
        footer={
          <Button block size="lg" onClick={() => setOpen(false)} loading={pending}>
            {t("show", { count: props.total })}
          </Button>
        }
      >
        <FiltersPanel {...props} />
      </SheetContent>
    </Dialog>
  );
}
