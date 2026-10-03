"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Длинный текст на телефоне свёрнут до нескольких строк с кнопкой «Подробнее» (как в мобильном макете) */
export function CollapsibleText({ children }: { children: ReactNode }) {
  const t = useTranslations("listing");
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setOverflowing(el.scrollHeight > el.clientHeight + 4));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className={cn(!open && "max-lg:max-h-[136px] max-lg:overflow-hidden")}>
        {children}
      </div>
      {!open && overflowing && <div className="pointer-events-none absolute inset-x-0 bottom-8 h-12 bg-gradient-to-t from-cream to-transparent lg:hidden" />}
      {(overflowing || open) && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-sage-700 lg:hidden">
          {open ? t("showLess") : t("showMore")}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
