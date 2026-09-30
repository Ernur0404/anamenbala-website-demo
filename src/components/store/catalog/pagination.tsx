"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

export function Pagination({ page, pages, searchParams }: { page: number; pages: number; searchParams: Record<string, string | string[] | undefined> }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  if (pages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      params.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    if (p > 1) params.set("page", String(p));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const item = "grid h-10 min-w-10 place-items-center rounded-md px-2 text-sm font-semibold transition-colors";
  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label={t("page", { page })}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, "border border-line bg-white hover:border-sage-400")} aria-label={t("prev")}>
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(item, "border border-line bg-white opacity-40")} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {pageWindow(page, pages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-ink-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-sage-700 text-white" : "border border-line bg-white hover:border-sage-400")}
          >
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} className={cn(item, "border border-line bg-white hover:border-sage-400")} aria-label={t("next")}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(item, "border border-line bg-white opacity-40")} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
