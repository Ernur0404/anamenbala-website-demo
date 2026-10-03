"use client";

import { useCallback, useEffect, useState } from "react";
import { getImageProps } from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslations } from "next-intl";
import { ArrowRight, Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { BannerView } from "@/server/content";
import { cn } from "@/lib/utils";

/**
 * Фото баннера через <picture>: браузер качает только одну версию — мобильную (до 640px) или
 * компьютерную. Первый слайд грузится сразу с высоким приоритетом, остальные — после загрузки страницы.
 */
function HeroPicture({ banner, first, warm }: { banner: BannerView; first: boolean; warm: boolean }) {
  const desktop = banner.image ?? banner.mobileImage;
  if (!desktop) return null;
  const mobile = banner.mobileImage && banner.mobileImage.src !== desktop.src ? banner.mobileImage : null;
  const { props } = getImageProps({
    src: desktop.src,
    alt: desktop.alt,
    fill: true,
    sizes: "(max-width: 1320px) 100vw, 1320px",
    loading: first || warm ? "eager" : "lazy",
    fetchPriority: first ? "high" : "low",
    // у разных фото для телефона и ПК размытая заготовка была бы от «чужого» кадра — тогда без неё
    placeholder: !mobile && desktop.blur ? "blur" : "empty",
    blurDataURL: desktop.blur ?? undefined,
  });
  const small = mobile ? getImageProps({ src: mobile.src, alt: mobile.alt, fill: true, sizes: "100vw" }).props : null;
  return (
    <picture>
      {small && <source media="(max-width: 639px)" srcSet={small.srcSet} sizes={small.sizes} />}
      <img {...props} alt={props.alt} className="object-cover" />
    </picture>
  );
}

function Slide({ banner, first, warm }: { banner: BannerView; first: boolean; warm: boolean }) {
  return (
    <div className="relative h-[236px] overflow-hidden bg-beige-100 sm:h-[440px] sm:rounded-2xl lg:h-[420px]">
      <HeroPicture banner={banner} first={first} warm={warm} />
      {/* мягкая подложка под текст слева */}
      <div className="absolute inset-0 bg-gradient-to-r from-cream via-cream/80 to-transparent [background-size:82%_100%] bg-no-repeat sm:[background-size:70%_100%]" />
      {banner.script && (
        <p className="script-accent absolute top-6 right-6 hidden max-w-[220px] rotate-[-4deg] text-right text-[26px] text-graphite/80 lg:block">
          {banner.script}
          <Heart className="mt-1 ml-auto size-5 stroke-[1.4]" />
        </p>
      )}
      <div className="absolute inset-y-0 left-0 flex max-w-[66%] flex-col justify-center py-4 pr-2 pl-5 sm:inset-x-0 sm:max-w-[560px] sm:p-10 lg:p-14">
        {banner.eyebrow && <p className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-sage-700 uppercase sm:mb-3 sm:text-[12px] sm:tracking-[0.18em]">{banner.eyebrow}</p>}
        <h2 className="heading-display text-[27px] text-graphite sm:text-[48px] lg:text-[56px]">{banner.title}</h2>
        {banner.text && <p className="mt-1.5 line-clamp-2 max-w-md text-[12.5px] leading-snug text-ink-700 sm:mt-4 sm:line-clamp-none sm:text-base sm:leading-relaxed">{banner.text}</p>}
        {banner.buttonText && banner.url && (
          <Link
            href={banner.url}
            className="mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-sage-700 px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-sage-800 sm:mt-6 sm:h-12 sm:px-6 sm:text-sm"
          >
            {banner.buttonText}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function HeroSlider({ banners }: { banners: BannerView[] }) {
  const t = useTranslations("home");
  const [emblaRef, embla] = useEmblaCarousel({ loop: banners.length > 1 });
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [warm, setWarm] = useState(false);

  const onSelect = useCallback(() => embla && setSelected(embla.selectedScrollSnap()), [embla]);
  useEffect(() => {
    if (!embla) return;
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, onSelect]);

  // остальные слайды догружаются, когда страница уже загрузилась, — к автопрокрутке они готовы
  useEffect(() => {
    if (banners.length < 2) return;
    const start = () => setWarm(true);
    if (document.readyState === "complete") {
      const timer = setTimeout(start, 1200);
      return () => clearTimeout(timer);
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [banners.length]);

  useEffect(() => {
    if (!embla || paused || banners.length < 2) return;
    const timer = setInterval(() => embla.scrollNext(), 6500);
    return () => clearInterval(timer);
  }, [embla, paused, banners.length]);

  if (!banners.length) return null;
  return (
    <section className="container-page sm:pt-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
      <div className="relative -mx-4 sm:mx-0">
        <div ref={emblaRef} className="overflow-hidden sm:rounded-2xl">
          <div className="flex">
            {banners.map((b, i) => (
              <div key={b.id} className="min-w-0 flex-[0_0_100%]" aria-roledescription="slide" aria-label={t("slide", { index: i + 1 })}>
                <Slide banner={b} first={i === 0} warm={warm} />
              </div>
            ))}
          </div>
        </div>
        {banners.length > 1 && (
          <div className="mt-3 flex justify-center gap-2 sm:absolute sm:bottom-4 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => embla?.scrollTo(i)}
                aria-label={t("slide", { index: i + 1 })}
                aria-current={i === selected}
                className={cn("h-2 rounded-full transition-all", i === selected ? "w-6 bg-sage-700" : "w-2 bg-graphite/25 hover:bg-graphite/40")}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
