"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Search, X, LoaderCircle, LayoutGrid } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { searchSuggestAction, type SearchSuggestion } from "@/server/actions/store";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function SearchBox({ className, initialQuery = "", autoFocus, onNavigate }: { className?: string; initialQuery?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SearchSuggestion | null>(null);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchSuggestAction(q);
        if (res.ok) setResult(res.data);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const showPanel = open && query.trim().length >= 2;
  const data = showPanel ? result : null;
  const empty = data && !data.products.length && !data.categories.length;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form role="search" onSubmit={submit} className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          className="h-11 w-full rounded-lg border border-line-strong bg-white pr-20 pl-4 text-sm text-graphite shadow-[0_1px_2px_rgb(47_52_48/0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-ink-400 focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-11 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-beige-100 hover:text-graphite" aria-label={t("clear")}>
            <X className="size-4" />
          </button>
        )}
        <button type="submit" className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-sage-700 hover:bg-sage-50" aria-label={t("label")}>
          {pending ? <LoaderCircle className="size-[18px] animate-spin" /> : <Search className="size-[18px]" />}
        </button>
      </form>

      {showPanel && (data || pending) && (
        <div id={listId} className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-line bg-white shadow-pop animate-fade-in">
          {empty && <p className="px-4 py-5 text-sm text-ink-500">{t("nothing")}</p>}
          {!!data?.categories.length && (
            <div className="border-b border-line p-2">
              <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{t("categories")}</p>
              {data.categories.map((c) => (
                <Link key={c.path} href={c.path} onClick={() => (setOpen(false), onNavigate?.())} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-beige-50">
                  <LayoutGrid className="size-4 text-sage-600" />
                  {c.name}
                </Link>
              ))}
            </div>
          )}
          {!!data?.products.length && (
            <div className="p-2">
              <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{t("suggestions")}</p>
              {data.products.map((p) => (
                <Link key={p.slug} href={`/product/${p.slug}`} onClick={() => (setOpen(false), onNavigate?.())} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-beige-50">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-beige-50">
                    {p.image && <Image src={p.image.src} alt="" fill sizes="44px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <span className="text-sm font-bold whitespace-nowrap">{formatMoney(p.price)}</span>
                </Link>
              ))}
            </div>
          )}
          {!!data?.products.length && (
            <button onClick={submit} className="block w-full border-t border-line bg-cream px-4 py-2.5 text-left text-sm font-semibold text-sage-700 hover:bg-beige-50">
              {t("allResults")} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
