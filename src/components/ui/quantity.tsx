"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  disabled,
  className,
  labels = { decrease: "Уменьшить", increase: "Увеличить" },
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  labels?: { decrease: string; increase: string };
}) {
  const h = size === "sm" ? "h-9" : "h-11";
  const btn = size === "sm" ? "w-8" : "w-10";
  return (
    <div className={cn("inline-flex items-stretch overflow-hidden rounded-md border border-line-strong bg-white", h, className)}>
      <button
        type="button"
        className={cn("grid place-items-center text-ink-600 transition-colors hover:bg-beige-50 hover:text-graphite disabled:opacity-40", btn)}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={labels.decrease}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="w-10 [appearance:textfield] bg-transparent text-center text-sm font-semibold outline-none [&::-webkit-inner-spin-button]:appearance-none"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const next = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        aria-label="Количество"
      />
      <button
        type="button"
        className={cn("grid place-items-center text-ink-600 transition-colors hover:bg-beige-50 hover:text-graphite disabled:opacity-40", btn)}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={labels.increase}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
