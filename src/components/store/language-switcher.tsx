"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LABELS = { ru: "Рус", kk: "Қаз" } as const;

export function LanguageSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: "ru" | "kk") => {
    if (next === locale) return;
    const query = searchParams.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { locale: next }));
  };

  return (
    <div
      className={cn(
        "inline-flex rounded-full p-0.5 text-xs font-bold",
        tone === "light" ? "bg-beige-100" : "bg-white/15",
        pending && "opacity-60",
        className,
      )}
      role="group"
      aria-label="Язык / Тіл"
    >
      {(["ru", "kk"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          aria-pressed={locale === l}
          lang={l}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            locale === l ? (tone === "light" ? "bg-white text-graphite shadow-soft" : "bg-white text-sage-800") : tone === "light" ? "text-ink-500 hover:text-graphite" : "text-white/80 hover:text-white",
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
