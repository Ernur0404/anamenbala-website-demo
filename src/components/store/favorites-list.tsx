"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Heart, ImageOff, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Price, ProductBadge, Rating } from "@/components/ui/display";
import { clearFavoritesAction } from "@/server/actions/store";
import type { ProductCardData } from "@/server/catalog/cards";
import { useStore } from "./store-provider";
import { QuickAddDialog } from "./quick-add";

function FavoriteRow({ product }: { product: ProductCardData }) {
  const t = useTranslations("product");
  const { toggleFavorite, addToCart } = useStore();
  const [quick, setQuick] = useState(false);
  const [adding, setAdding] = useState(false);
  const available = product.inStock || product.backorder;

  const onCart = async () => {
    if (product.quickVariantId) {
      setAdding(true);
      await addToCart(product.quickVariantId);
      setAdding(false);
    } else setQuick(true);
  };

  return (
    <article className="flex gap-3 rounded-xl border border-line bg-white p-3 sm:gap-5 sm:p-4">
      <Link href={`/product/${product.slug}`} className="relative aspect-[6/5] w-28 shrink-0 overflow-hidden rounded-md bg-beige-50 sm:w-44">
        {product.image ? <Image src={product.image.src} alt={product.image.alt} fill sizes="176px" className="object-cover" /> : <ImageOff className="m-auto mt-10 size-6 text-beige-400" />}
        <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {product.badges.slice(0, 1).map((b) => (
            <ProductBadge key={b.label} style={b.style}>
              {b.label}
            </ProductBadge>
          ))}
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Link href={`/product/${product.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-sage-700 sm:text-base">
            {product.name}
          </Link>
          <Rating className="mt-1" value={product.rating} count={product.ratingCount} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Price value={product.price} oldValue={product.oldPrice} from={product.fromPrice} />
            {product.discountPercent > 0 && <ProductBadge style="DISCOUNT">−{product.discountPercent}%</ProductBadge>}
          </div>
          <p className={`mt-1.5 text-xs font-semibold ${product.inStock ? "text-sage-700" : product.backorder ? "text-sky-700" : "text-ink-400"}`}>
            {product.inStock ? t("inStock") : product.backorder ? t("backorder") : t("outOfStock")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => toggleFavorite(product.id)} className="grid size-10 place-items-center rounded-full text-powder-500 hover:bg-powder-50" aria-label={t("inFavorites")}>
            <Heart className="size-5 fill-powder-500" />
          </button>
          <Button size="sm" onClick={onCart} loading={adding} disabled={!available}>
            <ShoppingBag />
            {t("inCart")}
          </Button>
          <button type="button" onClick={() => toggleFavorite(product.id)} className="grid size-10 place-items-center rounded-full text-ink-400 hover:bg-beige-100 hover:text-powder-700" aria-label={t("unavailable")}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {quick && <QuickAddDialog productId={product.id} open={quick} onOpenChange={setQuick} />}
    </article>
  );
}

export function FavoritesList({ products, labels }: { products: ProductCardData[]; labels: { clear: string; empty: string } }) {
  const { favorites } = useStore();
  const [pending, startTransition] = useTransition();
  const visible = products.filter((p) => favorites.has(p.id));
  if (!visible.length) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong bg-white/60 px-6 py-12 text-center text-[15px] text-ink-500">
        <Heart className="mx-auto mb-3 size-7 text-powder-400" />
        {labels.empty}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await clearFavoritesAction();
              window.location.reload();
            })
          }
          className="flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-powder-700"
        >
          <Trash2 className="size-4" />
          {labels.clear}
        </button>
      </div>
      {visible.map((p) => (
        <FavoriteRow key={p.id} product={p} />
      ))}
    </div>
  );
}
