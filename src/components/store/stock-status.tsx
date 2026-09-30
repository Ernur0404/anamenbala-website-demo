"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function StockStatus({
  stock,
  allowBackorder,
  backorderNote,
  lowStockThreshold,
  className,
}: {
  stock: number;
  allowBackorder: boolean;
  backorderNote?: string | null;
  lowStockThreshold: number;
  className?: string;
}) {
  const t = useTranslations("product");
  if (stock > 0) {
    const low = stock <= lowStockThreshold;
    return (
      <p className={cn("flex items-center gap-2 text-sm font-medium", low ? "text-amber-700" : "text-sage-700", className)}>
        <span className={cn("size-2 rounded-full", low ? "bg-amber-700" : "bg-sage-600")} />
        {low ? t("lowStock", { count: stock }) : t("inStock")}
      </p>
    );
  }
  if (allowBackorder) {
    return (
      <p className={cn("flex flex-wrap items-center gap-x-2 text-sm font-medium text-sky-700", className)}>
        <span className="size-2 rounded-full bg-sky-700" />
        {t("backorder")}
        <span className="font-normal text-ink-500">· {backorderNote || t("backorderDefault")}</span>
      </p>
    );
  }
  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium text-ink-500", className)}>
      <span className="size-2 rounded-full bg-ink-300" />
      {t("outOfStock")}
    </p>
  );
}
