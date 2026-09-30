"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoaderCircle, Search, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Обновление параметров адреса списка (сбрасывает страницу) */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (patch: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in patch)) params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { searchParams, update, pending };
}

/** Поиск по списку: обновляет ?q= с задержкой */
export function SearchInput({ placeholder, param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const t = useTranslations("admin.common");
  const { searchParams, update, pending } = useUrlParams();
  const urlValue = searchParams.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const [synced, setSynced] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // значение из адреса поменялось снаружи (сброс фильтров, «назад»)
  if (urlValue !== synced) {
    setSynced(urlValue);
    setValue(urlValue);
  }

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSynced(next.trim());
      update({ [param]: next.trim() || null });
    }, 350);
  };

  return (
    <div className={cn("relative", className)}>
      {pending ? (
        <LoaderCircle className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-ink-400" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
      )}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("searchPlaceholder")}
        aria-label={placeholder ?? t("search")}
        className="h-11 w-full rounded-lg border border-line-strong bg-white pr-9 pl-10 text-[14px] text-graphite outline-none transition-[border-color,box-shadow] placeholder:text-ink-400 focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-cream-200 hover:text-graphite" aria-label={t("reset")}>
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Выпадающий фильтр списка (?param=value) */
export function ParamSelect({
  param,
  options,
  allLabel,
  className,
  ariaLabel,
}: {
  param: string;
  options: { value: string; label: string }[];
  allLabel: string;
  className?: string;
  ariaLabel?: string;
}) {
  const { searchParams, update } = useUrlParams();
  return (
    <div className={cn("relative", className)}>
      <select
        value={searchParams.get(param) ?? ""}
        onChange={(e) => update({ [param]: e.target.value || null })}
        aria-label={ariaLabel ?? allLabel}
        className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-line-strong bg-white pr-9 pl-3.5 text-[14px] text-graphite outline-none focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/** Кнопка с подтверждением (удаление, отмена заказа…) */
export function ConfirmButton({
  title,
  text,
  confirmLabel,
  onConfirm,
  children,
  variant = "dangerSoft",
  size,
  className,
  disabled,
  tone = "danger",
  "aria-label": ariaLabel,
}: {
  title: ReactNode;
  text?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | void;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  disabled?: boolean;
  tone?: "danger" | "primary";
  "aria-label"?: string;
}) {
  const t = useTranslations("admin.common");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} disabled={disabled} onClick={() => setOpen(true)} aria-label={ariaLabel}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent title={title} className="max-w-md">
          {text && <p className="text-sm leading-relaxed text-ink-600">{text}</p>}
          <div className="mt-6 flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant={tone === "danger" ? "danger" : "primary"}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel ?? t("confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
