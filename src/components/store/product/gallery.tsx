"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image, { getImageProps } from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Expand, ImageOff, Play, ZoomIn } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { GalleryItem } from "@/server/catalog/product";
import { cn } from "@/lib/utils";

function VideoPlayer({ item }: { item: Extract<GalleryItem, { kind: "video" }> }) {
  if (item.embed === "file") {
    return <video src={item.src} controls playsInline className="size-full bg-graphite object-contain" poster={item.poster?.src} />;
  }
  return <iframe src={item.src} className="size-full border-0 bg-graphite" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title="video" />;
}

const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const MOBILE = "(max-width: 1023px)";
const DESKTOP = "(min-width: 1024px)";

/**
 * Фото, которое скачивается только на своей ширине экрана: на телефоне — слайды, на ПК — большое фото.
 * Иначе скрытая (display:none) копия с немедленной загрузкой качалась бы впустую.
 */
function OnlyAt({
  image,
  sizes,
  skip,
  eager,
  className,
  style,
}: {
  image: Extract<GalleryItem, { kind: "image" }>["image"];
  sizes: string;
  skip: string;
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { props } = getImageProps({
    src: image.src,
    alt: image.alt,
    fill: true,
    sizes,
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "auto",
    placeholder: image.blur ? "blur" : "empty",
    blurDataURL: image.blur ?? undefined,
  });
  return (
    <picture>
      <source media={skip} srcSet={BLANK} />
      <img {...props} alt={props.alt} className={className} style={{ ...props.style, ...style }} />
    </picture>
  );
}

function ZoomImage({ item, onOpen }: { item: Extract<GalleryItem, { kind: "image" }>; onOpen: () => void }) {
  const [origin, setOrigin] = useState<string | null>(null);
  return (
    <button
      type="button"
      className="relative block size-full cursor-zoom-in overflow-hidden"
      onClick={onOpen}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`);
      }}
      onMouseLeave={() => setOrigin(null)}
      aria-label={item.image.alt}
    >
      <OnlyAt
        image={item.image}
        sizes="(max-width: 1024px) 100vw, 620px"
        skip={MOBILE}
        eager
        className="object-cover transition-transform duration-200 ease-out"
        style={origin ? { transform: "scale(1.8)", transformOrigin: origin } : undefined}
      />
    </button>
  );
}

export function ProductGallery({ items, activeColorValueId, badges }: { items: GalleryItem[]; activeColorValueId: string | null; badges?: React.ReactNode }) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const visible = useMemo(() => {
    if (!activeColorValueId) return items;
    const filtered = items.filter((i) => i.kind === "video" || !i.colorValueId || i.colorValueId === activeColorValueId);
    const colorFirst = [...filtered].sort((a, b) => Number(b.kind === "image" && b.colorValueId === activeColorValueId) - Number(a.kind === "image" && a.colorValueId === activeColorValueId));
    return colorFirst.some((i) => i.kind === "image") ? colorFirst : items;
  }, [items, activeColorValueId]);

  // позиция привязана к набору фото: сменили цвет — галерея снова с первого кадра
  const setKey = visible.map((v) => v.id).join(",");
  const [position, setPosition] = useState({ key: setKey, index: 0 });
  const index = position.key === setKey ? position.index : 0;
  const [lightbox, setLightbox] = useState(false);
  const [warm, setWarm] = useState(false);
  const [emblaRef, embla] = useEmblaCarousel({ loop: false });
  const thumbsRef = useRef<HTMLDivElement>(null);

  // остальные слайды на телефоне догружаются после загрузки страницы — свайп без пустых кадров
  useEffect(() => {
    const start = () => setWarm(true);
    if (document.readyState === "complete") {
      const timer = setTimeout(start, 800);
      return () => clearTimeout(timer);
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  useEffect(() => {
    embla?.scrollTo(0, true);
  }, [setKey, embla]);
  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setPosition({ key: setKey, index: embla.selectedScrollSnap() });
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, setKey]);

  const go = (i: number) => {
    const next = (i + visible.length) % visible.length;
    setPosition({ key: setKey, index: next });
    embla?.scrollTo(next);
  };

  if (!visible.length) {
    return (
      <div className="grid aspect-square place-items-center rounded-xl bg-beige-50 text-beige-400">
        <ImageOff className="size-12" />
      </div>
    );
  }

  const current = visible[Math.min(index, visible.length - 1)];
  const images = visible.filter((v): v is Extract<GalleryItem, { kind: "image" }> => v.kind === "image");

  return (
    <div className="lg:grid lg:grid-cols-[84px_1fr] lg:gap-4">
      {/* миниатюры (ПК) */}
      <div ref={thumbsRef} className="scrollbar-none hidden max-h-[620px] flex-col gap-3 overflow-y-auto lg:flex">
        {visible.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(i)}
            aria-label={t("photo", { index: i + 1 })}
            aria-current={i === index}
            className={cn("relative aspect-square w-full shrink-0 overflow-hidden rounded-md bg-beige-50 ring-offset-2 ring-offset-cream transition-shadow", i === index ? "ring-2 ring-sage-700" : "ring-1 ring-line hover:ring-sage-400")}
          >
            {item.kind === "image" ? (
              <Image src={item.image.src} alt="" fill sizes="84px" className="object-cover" />
            ) : (
              <>
                {item.poster && <Image src={item.poster.src} alt="" fill sizes="84px" className="object-cover opacity-70" />}
                <span className="absolute inset-0 grid place-items-center bg-graphite/30 text-white">
                  <Play className="size-6 fill-white" />
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* основное фото */}
      <div className="relative">
        <div className="relative hidden aspect-square overflow-hidden rounded-xl bg-beige-50 lg:block">
          {current.kind === "image" ? <ZoomImage item={current} onOpen={() => setLightbox(true)} /> : <VideoPlayer item={current} />}
          {current.kind === "image" && (
            <div className="pointer-events-none absolute right-3 bottom-3 flex gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-soft">
                <ZoomIn className="size-3.5" />
                {t("zoom")}
              </span>
              <button type="button" onClick={() => setLightbox(true)} className="pointer-events-auto grid size-8 place-items-center rounded-full bg-white/90 text-ink-700 shadow-soft hover:text-sage-700" aria-label={t("fullscreen")}>
                <Expand className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* свайп (телефон) */}
        <div className="-mx-4 lg:hidden">
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex">
              {visible.map((item, i) => (
                <div key={item.id} className="relative aspect-square min-w-0 flex-[0_0_100%] bg-beige-50">
                  {item.kind === "image" ? (
                    <button type="button" className="relative block size-full" onClick={() => setLightbox(true)} aria-label={item.image.alt}>
                      <OnlyAt image={item.image} sizes="100vw" skip={DESKTOP} eager={i === 0 || warm} className="object-cover" />
                    </button>
                  ) : (
                    <VideoPlayer item={item} />
                  )}
                </div>
              ))}
            </div>
          </div>
          {visible.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {visible.map((item, i) => (
                <button key={item.id} type="button" onClick={() => go(i)} aria-label={t("photo", { index: i + 1 })} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-sage-700" : "w-1.5 bg-graphite/20")} />
              ))}
            </div>
          )}
        </div>
        {badges && <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5 lg:top-4 lg:left-4">{badges}</div>}
      </div>

      {/* просмотр на весь экран */}
      <DialogPrimitive.Root open={lightbox} onOpenChange={setLightbox}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-graphite/90 data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col outline-none" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">{images[0]?.image.alt ?? t("fullscreen")}</DialogPrimitive.Title>
            <div className="relative flex-1">
              {current.kind === "image" && <Image src={current.image.src} alt={current.image.alt} fill sizes="100vw" className="object-contain" quality={90} />}
              {current.kind === "video" && (
                <div className="absolute inset-8">
                  <VideoPlayer item={current} />
                </div>
              )}
              {visible.length > 1 && (
                <>
                  <button type="button" onClick={() => go(index - 1)} className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-graphite" aria-label={tc("prev")}>
                    <ChevronLeft className="size-6" />
                  </button>
                  <button type="button" onClick={() => go(index + 1)} className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-graphite" aria-label={tc("next")}>
                    <ChevronRight className="size-6" />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
              <span>
                {index + 1} / {visible.length}
              </span>
              <DialogPrimitive.Close className="rounded-full bg-white/15 px-4 py-2 font-semibold text-white hover:bg-white/25">{tc("close")}</DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
