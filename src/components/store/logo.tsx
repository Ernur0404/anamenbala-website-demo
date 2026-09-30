import { Link } from "@/i18n/navigation";
import { LogoMark } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function Logo({ name, tagline, size = "md", className }: { name: string; tagline: string; size?: "sm" | "md"; className?: string }) {
  return (
    <Link href="/" className={cn("group flex shrink-0 items-center gap-2.5", className)} aria-label={name}>
      <LogoMark size={size === "sm" ? 34 : 44} className="transition-transform duration-300 group-hover:rotate-[8deg]" />
      <span className="flex flex-col leading-none">
        <span className={cn("font-serif font-semibold tracking-tight text-graphite", size === "sm" ? "text-[21px]" : "text-[27px]")}>{name}</span>
        <span className={cn("text-ink-500", size === "sm" ? "mt-0.5 text-[10px]" : "mt-1 text-[11.5px]")}>{tagline}</span>
      </span>
    </Link>
  );
}
