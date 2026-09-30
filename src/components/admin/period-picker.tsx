"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { useUrlParams } from "./controls";
import { cn } from "@/lib/utils";

const PRESETS = ["today", "7d", "30d", "month", "prevMonth", "90d", "year", "all"] as const;

/** Выбор периода (как в макете: «01.10.2025 – 31.10.2025») */
export function PeriodPicker({ current, fromKey, toKey, allLabel }: { current: string; fromKey: string | null; toKey: string | null; allLabel: string }) {
  const t = useTranslations("admin.common");
  const locale = useLocale();
  const { update } = useUrlParams();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(fromKey ?? "");
  const [to, setTo] = useState(toKey ?? "");

  const label =
    current === "all" || (!fromKey && !toKey)
      ? allLabel
      : `${fromKey ? formatDate(`${fromKey}T12:00:00`, locale) : "…"} – ${toKey ? formatDate(`${toKey}T12:00:00`, locale) : "…"}`;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setFrom(fromKey ?? "");
          setTo(toKey ?? "");
        }
      }}
    >
      <Popover.Trigger className="inline-flex h-11 items-center gap-2.5 rounded-lg border border-line-strong bg-white px-3.5 text-[13.5px] font-medium text-graphite shadow-[0_1px_2px_rgb(47_52_48/0.03)] transition-colors hover:border-sage-400">
        <CalendarDays className="size-4 text-ink-500" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className="size-4 text-ink-400" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[300px] rounded-xl border border-line bg-white p-3 shadow-pop animate-fade-in">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  update({ period: p, from: null, to: null });
                  setOpen(false);
                }}
                className={cn(
                  "h-9 rounded-md px-3 text-left text-[13px] font-medium transition-colors",
                  current === p ? "bg-sage-700 text-white" : "bg-cream text-ink-700 hover:bg-sage-50 hover:text-sage-800",
                )}
              >
                {p === "all" ? allLabel : t(`periods.${p}`)}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold text-ink-500">{t("periods.custom")}</p>
            <div className="flex items-center gap-2">
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label={t("from")} className="h-9 min-w-0 flex-1 rounded-md border border-line-strong px-2 text-[13px] outline-none focus:border-sage-500" />
              <span className="text-ink-400">–</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label={t("to")} className="h-9 min-w-0 flex-1 rounded-md border border-line-strong px-2 text-[13px] outline-none focus:border-sage-500" />
            </div>
            <Button
              size="sm"
              block
              className="mt-2.5"
              disabled={!from && !to}
              onClick={() => {
                update({ period: "custom", from: from || null, to: to || null });
                setOpen(false);
              }}
            >
              {t("apply")}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
