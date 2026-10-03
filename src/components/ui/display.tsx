import type { HTMLAttributes, ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

export type Tone = "sage" | "amber" | "sky" | "powder" | "lavender" | "graphite" | "gray" | "beige";

const toneClasses: Record<Tone, string> = {
  sage: "bg-sage-100 text-sage-800",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  powder: "bg-powder-100 text-powder-800",
  lavender: "bg-[#ece8f3] text-[#5b4f78]",
  graphite: "bg-graphite text-white",
  gray: "bg-[#eeeeea] text-ink-600",
  beige: "bg-beige-100 text-beige-700",
};

/** Пилюля статуса (заказы, наличие, публикация) */
export function StatusPill({ tone = "gray", className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", toneClasses[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

const badgeStyles = {
  SAGE: "bg-sage-700 text-white",
  POWDER: "bg-powder-300 text-powder-800",
  BEIGE: "bg-beige-200 text-beige-700",
  GRAPHITE: "bg-graphite text-white",
  DISCOUNT: "bg-powder-300 text-powder-800",
} as const;

/** Метка на карточке товара: Хит, Новинка, −30% */
export function ProductBadge({ style, children, className }: { style: keyof typeof badgeStyles; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold tracking-wide", badgeStyles[style], className)}>{children}</span>;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-white", className)} {...props} />;
}

/** Цена с зачёркнутой старой ценой */
export function Price({
  value,
  oldValue,
  from,
  size = "md",
  className,
}: {
  value: number;
  oldValue?: number | null;
  from?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const main = { sm: "text-[15px]", md: "text-base", lg: "text-xl", xl: "text-[28px] leading-none" }[size];
  const old = { sm: "text-xs", md: "text-[13px]", lg: "text-sm", xl: "text-base" }[size];
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-bold tracking-tight whitespace-nowrap text-graphite", main)}>
        {from && <span className="mr-1 text-[0.8em] font-semibold text-ink-500">от</span>}
        {formatMoney(value)}
      </span>
      {oldValue && oldValue > value ? <span className={cn("whitespace-nowrap text-ink-400 line-through", old)}>{formatMoney(oldValue)}</span> : null}
    </span>
  );
}

export function Rating({ value, count, size = "sm", className }: { value: number; count?: number; size?: "sm" | "md"; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-ink-500", size === "sm" ? "text-xs" : "text-sm", className)}>
      <Star className={cn("fill-[#e9b949] text-[#e9b949]", size === "sm" ? "size-3.5" : "size-4")} aria-hidden />
      <span className="font-semibold text-graphite">{value.toFixed(1)}</span>
      <span>({count})</span>
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${value} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-4", i <= Math.round(value) ? "fill-[#e9b949] text-[#e9b949]" : "fill-line text-line")} aria-hidden />
      ))}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-beige-100", className)} />;
}

export function EmptyState({ icon, title, text, action, className }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-white/60 px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-16 place-items-center rounded-full bg-sage-100 text-sage-700 [&_svg]:size-7">{icon}</div>}
      <h3 className="heading-section text-2xl">{title}</h3>
      {text && <p className="mt-2 max-w-md text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Заголовок секции: Cormorant Garamond + ссылка справа */
export function SectionHeading({ title, subtitle, action, className, as: Tag = "h2" }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return (
    <div className={cn("mb-3.5 flex items-end justify-between gap-4 sm:mb-6", className)}>
      <div className="min-w-0">
        <Tag className="heading-section text-[25px] sm:text-[34px]">{title}</Tag>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
