import Image from "next/image";
import { Heart } from "lucide-react";
import type { ImageData } from "@/server/catalog/cards";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { cn } from "@/lib/utils";

/** Баннер-заголовок страниц (каталог, категории, акции, о магазине…) — как в макете */
export function PageHero({
  title,
  subtitle,
  script,
  image,
  breadcrumbs,
  children,
  className,
  compact,
}: {
  title: string;
  subtitle?: string | null;
  script?: string | null;
  image?: ImageData | null;
  breadcrumbs?: Crumb[];
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={cn("container-page pt-4 sm:pt-6", className)}>
      <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-r from-beige-50 to-beige-100", compact ? "min-h-[150px]" : "min-h-[190px] sm:min-h-[230px]")}>
        {image && (
          <div className="absolute inset-y-0 right-0 w-[62%] sm:w-[58%]">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              preload
              loading="eager"
              fetchPriority="high"
              sizes="(max-width: 1024px) 60vw, 780px"
              placeholder={image.blur ? "blur" : "empty"}
              blurDataURL={image.blur ?? undefined}
              className="object-cover [mask-image:linear-gradient(to_right,transparent,black_35%)] sm:[mask-image:linear-gradient(to_right,transparent,black_25%)]"
            />
          </div>
        )}
        {script && (
          <p className="script-accent absolute top-5 right-6 z-10 hidden max-w-[210px] rotate-[-4deg] text-right text-[24px] text-graphite/80 md:block">
            {script}
            <Heart className="mt-1 ml-auto size-4 stroke-[1.4]" />
          </p>
        )}
        <div className={cn("relative z-10 flex h-full max-w-[640px] flex-col justify-center px-5 py-6 sm:px-10", compact ? "sm:py-7" : "sm:py-9")}>
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className={cn("mb-3", image && "max-w-[58%] sm:max-w-none")} />}
          <h1 className={cn("heading-display text-graphite", image ? "max-w-[62%] sm:max-w-none" : "", compact ? "text-[34px] sm:text-[44px]" : "text-[36px] sm:text-[52px]")}>{title}</h1>
          {subtitle && <p className={cn("mt-2 text-sm leading-relaxed text-ink-600 sm:mt-3 sm:text-[15px]", image ? "max-w-[58%] sm:max-w-[420px]" : "max-w-xl")}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}
