import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Heart, ShieldCheck, Percent, BadgeCheck, LayoutGrid, ChevronRight, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DynamicIcon, InstagramIcon } from "@/components/ui/icons";
import { SectionHeading, Stars } from "@/components/ui/display";
import { ProductCarousel } from "../product-carousel";
import { ProductGrid } from "../product-card";
import { SearchBox } from "../search-box";
import { formatMoney } from "@/lib/money";
import type { ProductCardData, ImageData } from "@/server/catalog/cards";
import type { BannerView } from "@/server/content";
import type { MenuCategory } from "../chrome-types";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function ViewAllLink({ href, label }: { href: string; label: string }) {
  const className = "flex items-center gap-1 text-[13px] font-semibold text-sage-700 transition-colors hover:text-sage-800 sm:gap-1.5 sm:text-sm sm:text-graphite sm:hover:text-sage-700";
  const content = (
    <>
      {label}
      <ArrowRight className="size-4" />
    </>
  );
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener" className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

/**
 * Разделы кружками: «Для мам», «Для детей», «Для дома», «Для себя», «Акции», «Все категории».
 * Страница «Каталог» из нижнего меню телефона.
 */
export async function CategoryCircles({ categories }: { categories: MenuCategory[] }) {
  const t = await getTranslations("nav");
  const item = "group flex flex-col items-center gap-2 text-center";
  const circle = "relative grid aspect-square w-full max-w-[104px] place-items-center overflow-hidden rounded-full transition-transform group-active:scale-95";
  const label = "text-[13.5px] leading-tight font-semibold text-graphite";
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-6 sm:gap-x-6">
      {categories.map((c) => (
        <Link key={c.id} href={c.href} className={item}>
          <span className={`${circle} bg-beige-100 text-sage-700 ring-1 ring-line`}>
            {c.image ? <Image src={c.image.src} alt="" fill sizes="(max-width: 640px) 30vw, 140px" className="object-cover" /> : <DynamicIcon name={c.icon} className="size-9" />}
          </span>
          <span className={label}>{c.name}</span>
        </Link>
      ))}
      <Link href="/sale" className={item}>
        <span className={`${circle} bg-powder-200 text-powder-700`}>
          <Percent className="size-10 stroke-[2.2]" />
        </span>
        <span className={label}>{t("sale")}</span>
      </Link>
      <Link href="/catalog" className={item}>
        <span className={`${circle} bg-sage-100 text-sage-700`}>
          <LayoutGrid className="size-9 stroke-[1.7]" />
        </span>
        <span className={label}>{t("allCategories")}</span>
      </Link>
    </div>
  );
}

export async function CategoryTiles({ categories }: { categories: MenuCategory[] }) {
  const t = await getTranslations("nav");
  return (
    <section className="container-page mt-6 hidden sm:mt-10 sm:block">
      <div className="hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((c) => (
          <Link key={c.id} href={c.href} className="group overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-card">
            <span className="relative block aspect-[4/3] bg-beige-100">
              {c.image ? (
                <Image src={c.image.src} alt={c.image.alt} fill sizes="(max-width: 640px) 45vw, 260px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              ) : (
                <span className="grid h-full place-items-center text-sage-600">
                  <DynamicIcon name={c.icon} className="size-10" />
                </span>
              )}
            </span>
            <span className="flex items-center justify-between px-4 py-3 text-[15px] font-semibold">
              {c.name}
              <ArrowRight className="size-4 text-ink-500 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
        <Link href="/sale" className="group relative overflow-hidden rounded-xl bg-powder-200 transition-shadow hover:shadow-card">
          <span className="relative grid aspect-[4/3] place-items-center overflow-hidden">
            <span className="absolute -right-6 -bottom-8 size-40 rounded-full bg-powder-300/70" />
            <span className="relative grid size-20 rotate-[-12deg] place-items-center rounded-2xl bg-powder-400 text-white shadow-card transition-transform group-hover:rotate-0">
              <Percent className="size-10" />
            </span>
          </span>
          <span className="flex items-center justify-between px-4 py-3 text-[15px] font-semibold text-powder-800">
            {t("sale")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}

/** Телефон: зелёная панель с большой строкой поиска и строкой о бесплатной доставке (вверху главной) */
export async function HomeSearchPanel({ freeFrom }: { freeFrom: number | null }) {
  const t = await getTranslations();
  return (
    <section className="rounded-b-[28px] bg-sage-700 px-4 pt-3 pb-4 sm:hidden">
      <SearchBox variant="hero" />
      {freeFrom ? (
        <div className="mt-3 flex items-center gap-3 text-white">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
            <Truck className="size-[18px]" />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug font-semibold">
            {t("listing.freeDelivery")} {t("listing.freeDeliveryFrom", { amount: formatMoney(freeFrom) })}
          </p>
          <Link href="/delivery" className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-white pr-2.5 pl-3.5 text-[12px] font-semibold text-sage-800">
            {t("common.more")}
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/** Телефон: «Подобрали для вас» — товары сеткой по два (вместо кружков разделов) */
export function ForYouSection({ title, products }: { title: string; products: ProductCardData[] }) {
  if (!products.length) return null;
  return (
    <section className="container-page mt-8 sm:hidden">
      <SectionHeading title={title} />
      <ProductGrid products={products} />
    </section>
  );
}

export function ProductsSection({
  title,
  subtitle,
  href,
  products,
  viewAll,
  mobilePerView,
}: {
  title: string;
  subtitle?: string | null;
  href: string;
  products: ProductCardData[];
  viewAll: string;
  mobilePerView?: 2 | 3;
}) {
  if (!products.length) return null;
  return (
    <section className="container-page mt-9 sm:mt-16">
      <SectionHeading title={title} subtitle={subtitle} action={<ViewAllLink href={href} label={viewAll} />} />
      <ProductCarousel products={products} mobilePerView={mobilePerView} />
    </section>
  );
}

export function PromoBannerSection({ banner }: { banner: BannerView | undefined }) {
  if (!banner) return null;
  return (
    <section className="container-page mt-9 sm:mt-16">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sage-100 via-beige-50 to-beige-100">
        <div className="grid grid-cols-[1.15fr_1fr] items-stretch sm:grid-cols-1 sm:items-center lg:grid-cols-[1fr_1.1fr]">
          <div className="relative z-10 py-4 pr-1 pl-4 sm:p-10 lg:py-12 lg:pr-0 lg:pl-14">
            {banner.eyebrow && <p className="script-accent text-[17px] text-sage-700 sm:text-2xl">{banner.eyebrow}</p>}
            <h2 className="heading-display mt-0.5 text-[23px] sm:mt-1 sm:text-[42px]">{banner.title}</h2>
            {banner.text && <p className="mt-1 line-clamp-2 max-w-sm text-[12px] leading-snug text-ink-600 sm:mt-3 sm:line-clamp-none sm:text-[15px] sm:leading-normal">{banner.text}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-5 sm:mt-6">
              {banner.buttonText && banner.url && (
                <Link
                  href={banner.url}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sage-700 px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-sage-800 sm:h-11 sm:gap-2 sm:rounded-lg sm:px-5 sm:text-sm"
                >
                  {banner.buttonText}
                  <ArrowRight className="size-4" />
                </Link>
              )}
              {banner.features.length > 0 && (
                <ul className="hidden gap-6 sm:flex">
                  {banner.features.map((f) => (
                    <li key={f.label} className="flex flex-col items-center gap-1.5 text-center text-xs font-medium text-ink-600">
                      <span className="grid size-10 place-items-center rounded-full border border-sage-300 bg-white/70 text-sage-700">
                        <DynamicIcon name={f.icon} className="size-5" />
                      </span>
                      {f.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="relative min-h-[150px] sm:h-72 sm:min-h-0 lg:h-full lg:min-h-[300px]">
            {banner.image && (
              <Image
                src={banner.image.src}
                alt={banner.image.alt}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 100vw, 700px"
                className="object-cover [mask-image:linear-gradient(to_right,transparent,black_30%)] sm:[mask-image:none] lg:[mask-image:linear-gradient(to_right,transparent,black_18%)]"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export type ReviewCard = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  verified: boolean;
  product: { slug: string; name: string } | null;
  photo: ImageData | null;
};

export async function ReviewsSection({ title, reviews, locale }: { title: string; reviews: ReviewCard[]; locale: string }) {
  const t = await getTranslations();
  return (
    <section className="container-page mt-10 sm:mt-16">
      <SectionHeading title={title} action={<ViewAllLink href="/reviews" label={t("common.viewAll")} />} />
      {reviews.length ? (
        <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
          {reviews.map((r) => (
            <figure key={r.id} className="flex w-[82%] shrink-0 snap-start flex-col rounded-xl border border-line bg-white p-5 sm:w-[46%] lg:w-auto">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                <span className="text-xs text-ink-400">{formatDate(r.date, locale)}</span>
              </div>
              <blockquote className="mt-3 line-clamp-5 flex-1 text-sm leading-relaxed text-ink-700">«{r.text}»</blockquote>
              {r.photo && (
                <div className="relative mt-3 size-16 overflow-hidden rounded-md">
                  <Image src={r.photo.src} alt="" fill sizes="64px" className="object-cover" />
                </div>
              )}
              <figcaption className="mt-4 flex items-center gap-3 border-t border-line pt-3">
                <span className="grid size-9 place-items-center rounded-full bg-sage-100 font-serif text-lg font-semibold text-sage-800">{r.author.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.author}</span>
                  {r.product ? (
                    <Link href={`/product/${r.product.slug}`} className="block truncate text-xs text-sage-700 hover:underline">
                      {r.product.name}
                    </Link>
                  ) : (
                    r.verified && (
                      <span className="flex items-center gap-1 text-xs text-sage-700">
                        <BadgeCheck className="size-3.5" />
                        {t("reviews.verified")}
                      </span>
                    )
                  )}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line-strong bg-white/60 px-6 py-10 text-center sm:flex-row sm:text-left">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-powder-100 text-powder-700">
            <Heart className="size-6" />
          </span>
          <p className="flex-1 text-[15px] text-ink-600">{t("reviews.storeEmpty")}</p>
          <Link href="/reviews#write" className="inline-flex h-11 items-center rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
            {t("home.leaveReview")}
          </Link>
        </div>
      )}
    </section>
  );
}

export async function InstagramSection({ title, posts, profileUrl }: { title: string; posts: { id: string; url: string; image: ImageData }[]; profileUrl: string }) {
  const t = await getTranslations("home");
  if (!posts.length) return null;
  return (
    <section className="container-page mt-10 sm:mt-16">
      <SectionHeading title={title} action={profileUrl ? <ViewAllLink href={profileUrl} label={t("goInstagram")} /> : undefined} />
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        {posts.slice(0, 6).map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noopener" className="group relative aspect-square overflow-hidden rounded-lg bg-beige-100">
            <Image src={p.image.src} alt={p.image.alt} fill sizes="(max-width: 1024px) 33vw, 210px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 grid place-items-center bg-graphite/0 text-white opacity-0 transition-all group-hover:bg-graphite/25 group-hover:opacity-100">
              <InstagramIcon size={28} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

const ADVANTAGE_COLS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

/** Преимущества одним рядом (до 4 в ряд); на телефоне значок над подписью */
export function AdvantagesStrip({ items, className, compact }: { items: { icon: string; title: string; text: string }[]; className?: string; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <section className={className ?? "container-page mt-10 sm:mt-16"}>
      <div
        className={cn(
          "grid gap-x-2 gap-y-5 rounded-xl border border-line bg-white px-3 py-5 sm:gap-x-4 sm:px-8 sm:py-6",
          ADVANTAGE_COLS[Math.min(items.length, 4) - 1],
          compact && "max-lg:border-0 max-lg:bg-transparent max-lg:p-0",
        )}
      >
        {items.map((a) => (
          <div key={a.title} className="flex flex-col items-center gap-2 text-center md:flex-row md:gap-3.5 md:text-left">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full border border-sage-200 bg-sage-50 text-sage-700 md:size-12",
                compact && "max-lg:size-9 max-lg:[&_svg]:size-[18px]",
              )}
            >
              <DynamicIcon name={a.icon} className="size-5 stroke-[1.6] md:size-[22px]" />
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[12.5px] leading-tight font-semibold md:text-[13.5px]", compact && "max-lg:text-[12px]")}>{a.title}</span>
              {a.text && <span className={cn("mt-1 block text-[11px] leading-snug text-ink-500 md:mt-0.5 md:text-xs", compact && "max-lg:hidden")}>{a.text}</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrustRow({ items }: { items: { icon: string; title: string; text: string }[] }) {
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-3 sm:p-5">
      {items.map((a) => (
        <div key={a.title} className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-50 text-sage-700">
            {a.icon === "shield-check" ? <ShieldCheck className="size-5" /> : <DynamicIcon name={a.icon} className="size-5" />}
          </span>
          <span>
            <span className="block text-sm font-semibold">{a.title}</span>
            <span className="block text-xs text-ink-500">{a.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
