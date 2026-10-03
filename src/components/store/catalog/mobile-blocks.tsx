import Image from "next/image";
import { ArrowRight, ChevronRight, Percent } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DynamicIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/display";
import type { ImageData } from "@/server/catalog/cards";
import type { BrandTile, CategoryCard } from "@/server/catalog/landing";
import { ViewportImage } from "../viewport-image";
import { cn } from "@/lib/utils";

/**
 * Блоки мобильной версии каталога — по мобильному макету: «таблетки» разделов, карточки разделов,
 * бренды, кружки и плитки подкатегорий, баннеры раздела и акций. На компьютере не показываются.
 */

export type Tone = "sage" | "powder";

export function MobilePills({ items, className }: { items: { key: string; label: string; href: string; active: boolean }[]; className?: string }) {
  return (
    <nav className={cn("scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 lg:hidden", className)}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition-colors",
            item.active ? "bg-sage-700 text-white" : "border border-line-strong bg-white text-ink-700 hover:border-sage-400",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Карточки разделов: фото слева, название, описание, число товаров, стрелка (страница «Каталог») */
export function CategoryListCards({ cards, countLabel, accentKey }: { cards: CategoryCard[]; countLabel: (count: number) => string; accentKey?: string }) {
  return (
    <ul className="space-y-3 lg:hidden">
      {cards.map((card) => (
        <li key={card.key}>
          <Link href={card.href} className="group flex items-stretch gap-3.5 rounded-2xl border border-line bg-white p-2 pr-3 shadow-[0_1px_2px_rgb(47_52_48/0.04)] transition-shadow active:shadow-card">
            <span className={cn("relative aspect-[4/3] w-[42%] shrink-0 overflow-hidden rounded-xl", card.key === accentKey ? "bg-powder-100" : "bg-beige-100")}>
              {card.image ? (
                <Image src={card.image.src} alt={card.image.alt} fill sizes="45vw" className="object-cover" />
              ) : card.key === accentKey ? (
                <span className="grid h-full place-items-center text-powder-600">
                  <Percent className="size-10" />
                </span>
              ) : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center py-1">
              <span className={cn("text-[16px] leading-tight font-bold", card.key === accentKey ? "text-powder-800" : "text-graphite")}>{card.name}</span>
              {card.description && <span className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-500">{card.description}</span>}
              {card.count != null && <span className="mt-2 text-[11.5px] text-ink-400">{countLabel(card.count)}</span>}
            </span>
            <ChevronRight className="size-5 shrink-0 self-center text-ink-400 transition-transform group-active:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Бренды: логотип, если загружен, иначе название */
export function BrandStrip({ title, brands }: { title: string; brands: BrandTile[] }) {
  if (!brands.length) return null;
  return (
    <section className="lg:hidden">
      <SectionHeading title={title} />
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
        {brands.map((b) => (
          <Link
            key={b.slug}
            href={`/catalog?brand=${b.slug}`}
            className="grid h-[58px] w-[calc((100%-3*8px)/4)] shrink-0 place-items-center rounded-xl border border-line bg-white px-2 text-center transition-colors active:border-sage-400"
            aria-label={b.name}
          >
            {b.logo ? (
              <span className="relative block h-8 w-full">
                <Image src={b.logo.src} alt={b.name} fill sizes="90px" className="object-contain" />
              </span>
            ) : (
              <span className="line-clamp-2 text-[12px] leading-tight font-bold tracking-tight text-graphite">{b.name}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

const CIRCLE_TONES: Record<Tone, string[]> = {
  sage: ["bg-sage-100 text-sage-700", "bg-beige-100 text-[#9b7457]"],
  powder: ["bg-powder-100 text-powder-700"],
};

/** Подкатегории кружками с иконками (верх страницы раздела) */
export function SubcategoryCircles({ items, tone = "sage" }: { items: { key: string; label: string; href: string; icon: string | null }[]; tone?: Tone }) {
  if (!items.length) return null;
  const tones = CIRCLE_TONES[tone];
  return (
    <div className="scrollbar-none -mx-4 flex gap-[9px] overflow-x-auto px-4 pb-0.5 lg:hidden">
      {items.map((item, i) => (
        <Link key={item.key} href={item.href} className="group flex w-[calc((100%-4*9px)/5)] min-w-[60px] shrink-0 flex-col items-center gap-1.5 text-center">
          <span className={cn("grid aspect-square w-full place-items-center rounded-full transition-transform group-active:scale-95", tones[i % tones.length])}>
            <DynamicIcon name={item.icon} className="size-7 stroke-[1.5]" />
          </span>
          <span className="text-[11.5px] leading-tight font-medium text-graphite">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

/** Подкатегории плитками с фото, по две в ряд */
export function SubcategoryGrid({ title, items }: { title: string; items: { key: string; label: string; href: string; icon: string | null; image: ImageData | null }[] }) {
  if (!items.length) return null;
  return (
    <section className="lg:hidden">
      <SectionHeading title={title} />
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className="group overflow-hidden rounded-xl border border-line bg-white">
            <span className="relative block aspect-[16/10] bg-beige-100">
              {item.image ? (
                <Image src={item.image.src} alt={item.image.alt} fill sizes="50vw" className="object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-sage-600">
                  <DynamicIcon name={item.icon} className="size-8" />
                </span>
              )}
            </span>
            <span className="flex items-center justify-between gap-2 px-3 py-2.5 text-[13.5px] leading-tight font-semibold text-graphite">
              <span className="min-w-0 truncate">{item.label}</span>
              <ArrowRight className="size-4 shrink-0 text-ink-500" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Баннер раздела/акций: фото, заголовок, текст, кнопка (вместо большого баннера на телефоне) */
export function MobileHeroCard({
  title,
  text,
  chip,
  image,
  button,
  as: Tag = "h1",
  className,
}: {
  title: string;
  text?: string | null;
  chip?: string | null;
  image?: ImageData | null;
  button?: { label: string; href: string } | null;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("relative h-[160px] overflow-hidden rounded-2xl bg-beige-100 lg:hidden", className)}>
      {image && <ViewportImage image={image} only="mobile" priority sizes="100vw" className="object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-cream via-cream/80 to-transparent [background-size:88%_100%] bg-no-repeat" />
      <div className="relative flex h-full max-w-[66%] flex-col justify-center py-3 pr-1 pl-4">
        {chip && <span className="mb-1.5 w-fit rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-powder-800 shadow-soft">{chip}</span>}
        <Tag className="heading-display line-clamp-2 text-[25px] text-graphite">{title}</Tag>
        {text && <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-600">{text}</p>}
        {button && (
          <a href={button.href} className="mt-2.5 inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-sage-700 px-3.5 text-[12px] font-semibold text-white">
            {button.label}
            <ArrowRight className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Компактный баннер «Скидки до X%» для раздела */
export function SalePromoStrip({ title, text, href, image, button, tone = "sage" }: { title: string; text: string; href: string; image: ImageData | null; button: string; tone?: Tone }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative grid min-h-[120px] grid-cols-[1.2fr_1fr] overflow-hidden rounded-2xl lg:hidden",
        tone === "powder" ? "bg-gradient-to-r from-powder-100 via-powder-50 to-beige-50" : "bg-gradient-to-r from-sage-100 via-beige-50 to-beige-100",
      )}
    >
      <span className="relative z-10 flex flex-col justify-center py-4 pr-1 pl-4">
        <span className="heading-display text-[24px] text-graphite">{title}</span>
        <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-600">{text}</span>
        <span className={cn("mt-2.5 inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold text-white", tone === "powder" ? "bg-powder-700" : "bg-sage-700")}>
          {button}
          <ArrowRight className="size-3.5" />
        </span>
      </span>
      <span className="relative">
        {image && <Image src={image.src} alt="" fill sizes="45vw" className="object-cover [mask-image:linear-gradient(to_right,transparent,black_30%)]" />}
      </span>
    </Link>
  );
}

const BADGE_TONES = ["bg-powder-500", "bg-sage-600", "bg-powder-700"];

/** Акции по разделам: фото с бейджем скидки, название, подкатегории, число товаров (страница «Акции») */
export function SaleCategoryCards({ cards }: { cards: { key: string; title: string; text: string | null; href: string; image: ImageData | null; discount: number; chip: string }[] }) {
  if (!cards.length) return null;
  return (
    <ul className="space-y-3 lg:hidden">
      {cards.map((card, i) => (
        <li key={card.key}>
          <Link href={card.href} className="group flex items-stretch gap-3.5 rounded-2xl border border-line bg-white p-2 pr-3 shadow-[0_1px_2px_rgb(47_52_48/0.04)]">
            <span className="relative aspect-[4/3] w-[40%] shrink-0 overflow-hidden rounded-xl bg-beige-100">
              {card.image && <Image src={card.image.src} alt={card.image.alt} fill sizes="40vw" className="object-cover" />}
              <span className={cn("absolute top-2 right-2 rounded-full px-2.5 py-1 text-[13px] font-bold text-white shadow-soft", BADGE_TONES[i % BADGE_TONES.length])}>−{card.discount}%</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center py-1">
              <span className="text-[15px] leading-tight font-bold text-graphite">{card.title}</span>
              {card.text && <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-500">{card.text}</span>}
              <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-sage-50 px-2.5 py-1 text-[11px] font-semibold text-sage-800">
                <Percent className="size-3" />
                {card.chip}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 self-center text-ink-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
