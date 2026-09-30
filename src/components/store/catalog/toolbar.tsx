"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/form";
import { SORTS } from "@/server/catalog/listing-sorts";
import { useQueryState } from "./use-query-state";

export function SortSelect({ className }: { className?: string }) {
  const t = useTranslations("listing");
  const { searchParams, update } = useQueryState();
  const current = searchParams.get("sort") ?? "popular";
  return (
    <Select
      aria-label={t("sort")}
      value={current}
      wrapperClassName={className}
      className="h-10 w-full min-w-[180px] text-[13px] font-medium"
      onChange={(e) =>
        update((p) => {
          if (e.target.value === "popular") p.delete("sort");
          else p.set("sort", e.target.value);
        })
      }
    >
      {SORTS.map((s) => (
        <option key={s} value={s}>
          {t(`sorts.${s}`)}
        </option>
      ))}
    </Select>
  );
}

export function CategorySearch({ className }: { className?: string }) {
  const t = useTranslations("listing");
  const { searchParams, update } = useQueryState();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  return (
    <form
      className={className}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        update((p) => {
          if (value.trim()) p.set("q", value.trim());
          else p.delete("q");
        });
      }}
    >
      <div className="relative">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("searchInCategory")}
          aria-label={t("searchInCategory")}
          className="h-10 w-full rounded-md border border-line-strong bg-white pr-10 pl-3.5 text-[13px] outline-none focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15"
        />
        <button type="submit" className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center text-ink-500 hover:text-sage-700" aria-label={t("searchInCategory")}>
          <Search className="size-4" />
        </button>
      </div>
    </form>
  );
}
