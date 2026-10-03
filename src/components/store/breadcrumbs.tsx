import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className, linkLast }: { items: Crumb[]; className?: string; linkLast?: boolean }) {
  return (
    <nav aria-label="breadcrumb" className={cn("text-xs text-ink-500", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3 text-ink-300" aria-hidden />}
            {item.href && (linkLast || i < items.length - 1) ? (
              <Link href={item.href} className="transition-colors hover:text-sage-700">
                {item.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "text-ink-700" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
