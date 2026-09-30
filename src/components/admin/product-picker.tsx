"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, Search, X } from "lucide-react";
import { lookupProductsAction } from "@/server/actions/admin/products";
import { formatMoney } from "@/lib/money";
import { Thumb } from "./ui";

export type PickedProduct = { id: string; name: string; imageUrl: string | null };

/** Выбор нескольких товаров: поиск и список выбранных */
export function ProductMultiPicker({ value, onChange, placeholder }: { value: PickedProduct[]; onChange: (next: PickedProduct[]) => void; placeholder?: string }) {
  const tc = useTranslations("admin.common");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(PickedProduct & { price: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const selected = new Set(value.map((p) => p.id));

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      const id = ++request.current;
      setLoading(true);
      const res = await lookupProductsAction({ q });
      if (id !== request.current) return;
      setLoading(false);
      setResults(res.ok ? res.data : []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const shown = query.trim().length >= 2 ? results.filter((r) => !selected.has(r.id)) : [];

  return (
    <div>
      <div className="relative">
        {loading ? <LoaderCircle className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-ink-400" /> : <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? tc("searchPlaceholder")}
          className="h-10 w-full rounded-lg border border-line-strong bg-white pr-3 pl-9 text-[13.5px] outline-none focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15"
        />
        {shown.length > 0 && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-pop">
            {shown.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange([...value, { id: p.id, name: p.name, imageUrl: p.imageUrl }]);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-sage-50"
              >
                <Thumb src={p.imageUrl} size={32} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-graphite">{p.name}</span>
                <span className="text-[12px] text-ink-500">{formatMoney(p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {value.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-2 py-1.5">
              <Thumb src={p.imageUrl} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-graphite">{p.name}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} className="grid size-7 place-items-center rounded-md text-ink-400 hover:bg-powder-50 hover:text-powder-800" aria-label={tc("remove")}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
