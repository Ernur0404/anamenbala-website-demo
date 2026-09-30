"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, Plus, ScanBarcode } from "lucide-react";
import { lookupVariantsAction, type VariantPick } from "@/server/actions/admin/orders";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Thumb } from "./ui";

/**
 * Поиск товара для заказа, кассы и склада. Сканер штрихкода работает как клавиатура:
 * код + Enter — если найден ровно один вариант, он добавляется сразу.
 */
export function VariantPicker({
  onPick,
  placeholder,
  autoFocus,
  className,
  showPrice = true,
}: {
  onPick: (variant: VariantPick) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  showPrice?: boolean;
}) {
  const t = useTranslations("admin.orders.picker");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const search = async (q: string) => {
    const id = ++requestId.current;
    setLoading(true);
    const res = await lookupVariantsAction({ q, limit: 20 });
    if (id !== requestId.current) return null;
    setLoading(false);
    const list = res.ok ? res.data : [];
    setResults(list);
    setActive(0);
    return list;
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => void search(q), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (v: VariantPick) => {
    onPick(v);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const shown = query.trim().length >= 2 ? results : [];

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <ScanBarcode className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-400" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={async (e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const q = query.trim();
            if (!q) return;
            // сканер: ищем сразу, не дожидаясь задержки
            const list = shown.length && !loading ? shown : await search(q);
            if (!list) return;
            const exact = list.find((v) => v.barcode === q || v.sku.toLowerCase() === q.toLowerCase());
            if (exact) pick(exact);
            else if (list.length === 1) pick(list[0]);
            else if (list[active]) pick(list[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder ?? t("placeholder")}
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-line-strong bg-white pr-10 pl-10 text-[14px] text-graphite outline-none transition-[border-color,box-shadow] placeholder:text-ink-400 focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {loading && <LoaderCircle className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-400" />}

      {open && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-[360px] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-pop">
          {!loading && shown.length === 0 && <p className="px-3 py-4 text-sm text-ink-500">{t("nothing")}</p>}
          {shown.map((v, i) => {
            const out = v.stock <= 0;
            return (
              <button
                key={v.variantId}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(v)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors", i === active ? "bg-sage-50" : "hover:bg-cream")}
              >
                <Thumb src={v.imageUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-graphite">{v.name}</span>
                  <span className="block truncate text-[12px] text-ink-500">
                    {[v.label, v.sku].filter(Boolean).join(" · ")}
                    {!v.published && <span className="ml-1.5 text-amber-700">· {t("hidden")}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {showPrice && <span className="block text-[13px] font-semibold text-graphite">{formatMoney(v.price)}</span>}
                  <span className={cn("block text-[11.5px]", out ? (v.allowBackorder ? "text-sky-700" : "text-powder-700") : "text-sage-700")}>
                    {out ? (v.allowBackorder ? t("backorder") : t("outOfStock")) : t("inStock", { count: v.stock })}
                  </span>
                </span>
                <Plus className="size-4 shrink-0 text-ink-400" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
