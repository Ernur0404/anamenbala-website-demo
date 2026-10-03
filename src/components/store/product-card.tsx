"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Heart, ShoppingBag, LoaderCircle, ImageOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Price, ProductBadge, Rating } from "@/components/ui/display";
import type { ProductCardData } from "@/server/catalog/cards";
import { useStore } from "./store-provider";
import { QuickAddDialog } from "./quick-add";
import { cn } from "@/lib/utils";

export const CARD_IMAGE_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px";

export function FavoriteButton({ productId, className, size = "md" }: { productId: string; className?: string; size?: "md" | "lg" }) {
  const t = useTranslations("product");
  const { isFavorite, toggleFavorite } = useStore();
  const active = isFavorite(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        void toggleFavorite(productId);
      }}
      aria-pressed={active}
      aria-label={active ? t("inFavorites") : t("addToFavorites")}
      className={cn(
        "grid place-items-center rounded-full bg-white/95 text-graphite shadow-soft transition-transform hover:scale-105 active:scale-95",
        size === "lg" ? "size-10" : "size-8",
        className,
      )}
    >
      <Heart className={cn(size === "lg" ? "size-5" : "size-4", active && "fill-powder-500 text-powder-500")} />
    </button>
  );
}

/** compact — узкая карточка (по три в ленте на телефоне): мельче цена и кнопка, один бейдж */
export function ProductCard({ product, className, compact }: { product: ProductCardData; className?: string; compact?: boolean }) {
  const t = useTranslations("product");
  const { addToCart } = useStore();
  const [quickOpen, setQuickOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const available = product.inStock || product.backorder;
  const href = `/product/${product.slug}`;

  const onCart = async () => {
    if (!available) return;
    if (product.quickVariantId) {
      setAdding(true);
      await addToCart(product.quickVariantId);
      setAdding(false);
    } else {
      setQuickOpen(true);
    }
  };

  return (
    <article className={cn("group relative flex h-full flex-col rounded-lg border border-line bg-white transition-shadow duration-200 hover:shadow-card sm:p-2.5", compact ? "p-1.5" : "p-2", className)}>
      <Link href={href} className="relative block aspect-[6/5] overflow-hidden rounded-md bg-beige-50" tabIndex={-1}>
        {product.image ? (
          <>
            <Image
              src={product.image.src}
              alt={product.image.alt}
              fill
              sizes={CARD_IMAGE_SIZES}
              placeholder={product.image.blur ? "blur" : "empty"}
              blurDataURL={product.image.blur ?? undefined}
              className={cn("object-cover transition-[transform,opacity] duration-500 group-hover:scale-[1.03]", product.hoverImage && "group-hover:opacity-0")}
            />
            {product.hoverImage && (
              <Image src={product.hoverImage.src} alt="" fill sizes={CARD_IMAGE_SIZES} className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            )}
          </>
        ) : (
          <span className="grid h-full place-items-center text-beige-400">
            <ImageOff className="size-8" />
          </span>
        )}
        <span className={cn("absolute top-2 left-2 flex flex-col items-start gap-1", compact && "top-1.5 left-1.5")}>
          {compact && product.discountPercent > 0 && <ProductBadge style="DISCOUNT">−{product.discountPercent}%</ProductBadge>}
          {product.badges.slice(0, 2).map((b) => (
            <ProductBadge key={b.label} style={b.style} className={compact ? "max-sm:hidden" : undefined}>
              {b.label}
            </ProductBadge>
          ))}
          {!compact && product.discountPercent > 0 && <ProductBadge style="DISCOUNT">−{product.discountPercent}%</ProductBadge>}
        </span>
        {!available && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-600 shadow-soft">{t("outOfStock")}</span>
        )}
        {product.backorder && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-sky-700 shadow-soft">{t("backorder")}</span>
        )}
      </Link>
      <FavoriteButton productId={product.id} className={cn("absolute sm:top-4 sm:right-4", compact ? "top-2.5 right-2.5 max-sm:size-7" : "top-3.5 right-3.5")} />

      <div className={cn("flex flex-1 flex-col pb-0.5 sm:px-1 sm:pt-3", compact ? "px-0.5 pt-2" : "px-1 pt-2.5")}>
        <Link href={href} className={cn("line-clamp-2 min-h-[2.7em] leading-snug font-medium text-graphite transition-colors hover:text-sage-700 sm:text-[14px]", compact ? "text-[12px]" : "text-[13px]")}>
          {product.name}
        </Link>
        <Rating className="mt-1.5" value={product.rating} count={product.ratingCount} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <Price
            value={product.price}
            oldValue={product.oldPrice}
            from={product.fromPrice}
            size="sm"
            className={cn("min-w-0", compact && "gap-y-0 max-sm:[&>span:first-child]:text-[13px] max-sm:[&>span:last-child]:text-[10.5px]")}
          />
          <button
            type="button"
            onClick={onCart}
            disabled={!available || adding}
            aria-label={t("addToCart")}
            className={cn(
              "grid shrink-0 place-items-center rounded-md bg-sage-700 text-white transition-colors hover:bg-sage-800 disabled:bg-line-strong disabled:text-white sm:size-9",
              compact ? "size-8 [&_svg]:size-4 sm:[&_svg]:size-[18px]" : "size-9",
            )}
          >
            {adding ? <LoaderCircle className="size-[18px] animate-spin" /> : <ShoppingBag className="size-[18px]" />}
          </button>
        </div>
      </div>
      {quickOpen && <QuickAddDialog productId={product.id} open={quickOpen} onOpenChange={setQuickOpen} />}
    </article>
  );
}

export function ProductGrid({ products, className }: { products: ProductCardData[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3", className)}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
