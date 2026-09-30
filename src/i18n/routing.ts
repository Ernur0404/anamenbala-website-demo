import { defineRouting } from "next-intl/routing";

export const locales = ["ru", "kk"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ru",
  // русский — без префикса, казахский — /kk/…
  localePrefix: "as-needed",
  localeDetection: false,
});

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
