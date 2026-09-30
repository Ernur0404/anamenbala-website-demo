import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { withParams, type SearchParams } from "./url";

/** Заголовок страницы админки: крупный заголовок (Cormorant), подзаголовок, кнопки справа */
export function PageHeader({ title, subtitle, actions, back, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 transition-colors hover:text-sage-700">
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="heading-display text-[34px] text-graphite sm:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Карточка-панель; serif — заголовок Cormorant (как разделы «Баннеры», «Настройки» в макете) */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  serif,
  padded = true,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  serif?: boolean;
  padded?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-xl border border-line bg-white shadow-[0_1px_2px_rgb(47_52_48/0.03)]", className)}>
      {(title || action) && (
        <div className={cn("flex flex-wrap items-start justify-between gap-3", padded ? "px-5 pt-5 pb-1 sm:px-6" : "px-5 pt-5 pb-4 sm:px-6")}>
          <div className="min-w-0">
            {title && <h2 className={serif ? "heading-section text-[22px] text-graphite" : "text-[16px] font-bold text-graphite"}>{title}</h2>}
            {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(padded && "px-5 py-4 sm:px-6 sm:pb-6", bodyClassName)}>{children}</div>
    </section>
  );
}

/** KPI: иконка, подпись, значение, изменение к прошлому периоду */
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  icon: Icon,
  invert,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: number | null;
  deltaLabel?: ReactNode;
  /** Пояснение под значением (когда нет сравнения с прошлым периодом) */
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Для «Отменено»: рост — плохо */
  invert?: boolean;
  href?: string;
}) {
  const positive = delta != null && delta >= 0;
  const good = invert ? !positive : positive;
  const body = (
    <>
      {Icon && (
        <span className="mb-3 grid size-11 place-items-center rounded-full bg-sage-50 text-sage-700">
          <Icon className="size-[20px] stroke-[1.7]" />
        </span>
      )}
      <p className="text-[13px] font-medium text-ink-600">{label}</p>
      <p className="mt-1.5 text-[26px] leading-none font-bold tracking-tight text-graphite">{value}</p>
      {delta == null && hint && <p className="mt-2.5 text-[11.5px] leading-tight text-ink-400">{hint}</p>}
      {delta != null && (
        <p className="mt-2.5 text-[12px] leading-tight">
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-sage-700" : "text-powder-700")}>
            {positive ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
            {Math.abs(delta)}%
          </span>
          {deltaLabel && <span className="mt-1 block text-[11.5px] text-ink-400">{deltaLabel}</span>}
        </p>
      )}
    </>
  );
  const cls = "block rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(47_52_48/0.03)] sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-shadow hover:shadow-card")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4", className)}>{children}</div>;
}

// ───────────── таблицы ─────────────

export function DataTable({ children, className, minWidth = 760 }: { children: ReactNode; className?: string; minWidth?: number }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13.5px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th className={cn("px-4 py-3 text-[12px] font-semibold whitespace-nowrap text-ink-500 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6", align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <td className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6", align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left", className)}>{children}</td>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-t border-line transition-colors hover:bg-cream/70", className)}>{children}</tr>;
}

export function EmptyRow({ colSpan, title, text }: { colSpan: number; title: ReactNode; text?: ReactNode }) {
  return (
    <tr className="border-t border-line">
      <td colSpan={colSpan} className="px-6 py-14 text-center">
        <p className="text-[15px] font-semibold text-graphite">{title}</p>
        {text && <p className="mt-1 text-sm text-ink-500">{text}</p>}
      </td>
    </tr>
  );
}

// ───────────── навигация по спискам ─────────────

/** Пагинация как в макете: ‹ 1 2 3 4 5 › и «Показано 1–10 из 248» */
export function Pagination({
  path,
  searchParams,
  page,
  pageSize,
  total,
  shownLabel,
}: {
  path: string;
  searchParams: SearchParams;
  page: number;
  pageSize: number;
  total: number;
  shownLabel: (from: number, to: number, total: number) => ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const window = pageWindow(page, pages);
  const cell = "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-[13px] font-semibold transition-colors";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
      <div className="flex items-center gap-1.5">
        <PageLink disabled={page <= 1} href={withParams(path, searchParams, { page: page - 1 > 1 ? page - 1 : null })} className={cell}>
          <ChevronLeft className="size-4" />
        </PageLink>
        {window.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-ink-400">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={withParams(path, searchParams, { page: p > 1 ? p : null })}
              aria-current={p === page ? "page" : undefined}
              className={cn(cell, p === page ? "border-sage-700 bg-sage-700 text-white" : "border-line bg-white text-ink-700 hover:border-sage-400")}
            >
              {p}
            </Link>
          ),
        )}
        <PageLink disabled={page >= pages} href={withParams(path, searchParams, { page: page + 1 })} className={cell}>
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
      <p className="text-[12.5px] text-ink-500">{shownLabel(from, to, total)}</p>
    </div>
  );
}

function PageLink({ disabled, href, className, children }: { disabled: boolean; href: string; className: string; children: ReactNode }) {
  if (disabled) return <span className={cn(className, "border-line bg-white text-ink-300")}>{children}</span>;
  return (
    <Link href={href} className={cn(className, "border-line bg-white text-ink-700 hover:border-sage-400")}>
      {children}
    </Link>
  );
}

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const sorted = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/** Вкладки-«пилюли» со ссылками (статусы заказов и т.п.) */
export function FilterPills({ items, className }: { items: { key: string; label: ReactNode; href: string; active: boolean; count?: number }[]; className?: string }) {
  return (
    <div className={cn("scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1", className)}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors",
            item.active ? "border-sage-700 bg-sage-700 text-white" : "border-line bg-white text-ink-700 hover:border-sage-400 hover:text-sage-800",
          )}
        >
          {item.label}
          {item.count != null && <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px]", item.active ? "bg-white/20" : "bg-cream-200 text-ink-500")}>{item.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Миниатюра (товар, баннер) */
export function Thumb({ src, alt = "", size = 44, className }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-md bg-beige-50", className)} style={{ width: size, height: size }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- миниатюры админки: уже нужного размера
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      )}
    </span>
  );
}

/** Строка «подпись — значение» в карточках */
export function InfoRow({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-1.5 text-[13.5px]", className)}>
      <span className="text-ink-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-graphite">{children}</span>
    </div>
  );
}
