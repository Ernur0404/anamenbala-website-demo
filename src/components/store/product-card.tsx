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

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
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
    <article className={cn("group relative flex h-full flex-col rounded-lg border border-line bg-white p-2 transition-shadow duration-200 hover:shadow-card sm:p-2.5", className)}>
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
        <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {product.badges.slice(0, 2).map((b) => (
            <ProductBadge key={b.label} style={b.style}>
              {b.label}
            </ProductBadge>
          ))}
          {product.discountPercent > 0 && <ProductBadge style="DISCOUNT">−{product.discountPercent}%</ProductBadge>}
        </span>
        {!available && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-600 shadow-soft">{t("outOfStock")}</span>
        )}
        {product.backorder && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-sky-700 shadow-soft">{t("backorder")}</span>
        )}
      </Link>
      <FavoriteButton productId={product.id} className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4" />

      <div className="flex flex-1 flex-col px-1 pt-2.5 pb-0.5 sm:pt-3">
        <Link href={href} className="line-clamp-2 min-h-[2.7em] text-[13px] leading-snug font-medium text-graphite transition-colors hover:text-sage-700 sm:text-[14px]">
          {product.name}
        </Link>
        <Rating className="mt-1.5" value={product.rating} count={product.ratingCount} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <Price value={product.price} oldValue={product.oldPrice} from={product.fromPrice} size="sm" className="min-w-0" />
          <button
            type="button"
            onClick={onCart}
            disabled={!available || adding}
            aria-label={t("addToCart")}
            className="grid size-9 shrink-0 place-items-center rounded-md bg-sage-700 text-white transition-colors hover:bg-sage-800 disabled:bg-line-strong disabled:text-white"
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
