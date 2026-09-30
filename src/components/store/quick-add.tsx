"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LoaderCircle, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/display";
import { QuantityStepper } from "@/components/ui/quantity";
import { Link } from "@/i18n/navigation";
import { quickProductAction } from "@/server/actions/store";
import type { QuickProduct } from "@/server/catalog/product";
import { useStore } from "./store-provider";
import { useVariantSelection, VariantSelector } from "./variant-selector";
import { StockStatus } from "./stock-status";

function QuickBody({ product, onDone }: { product: QuickProduct; onDone: () => void }) {
  const t = useTranslations("product");
  const { addToCart } = useStore();
  const { selection, choose, variant, valueState } = useVariantSelection(product.options, product.variants);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const colorValue = Object.values(selection).find((v) => product.gallery.some((g) => g.colorValueId === v));
  const image = product.gallery.find((g) => g.colorValueId && g.colorValueId === colorValue)?.image ?? product.image;
  const displayVariant = variant ?? product.variants[0];
  const max = variant ? (product.allowBackorder ? 99 : Math.max(1, variant.stock)) : 99;

  const add = async () => {
    if (!variant) return;
    setAdding(true);
    const ok = await addToCart(variant.id, quantity);
    setAdding(false);
    if (ok) onDone();
  };

  return (
    <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-beige-50 sm:aspect-[4/5]">
        {image && <Image src={image.src} alt={image.alt} fill sizes="200px" className="object-cover" />}
      </div>
      <div className="flex flex-col">
        <h3 className="text-base leading-snug font-semibold">{product.name}</h3>
        {displayVariant && <Price className="mt-2" size="lg" value={displayVariant.price} oldValue={displayVariant.oldPrice} />}
        <div className="mt-4">
          <VariantSelector options={product.options} selection={selection} onChoose={choose} valueState={valueState} />
        </div>
        {variant && (
          <StockStatus className="mt-4" stock={variant.stock} allowBackorder={product.allowBackorder} backorderNote={product.backorderNote} lowStockThreshold={product.lowStockThreshold} />
        )}
        <div className="mt-5 flex gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={max} />
          <Button className="flex-1" onClick={add} loading={adding} disabled={!variant || !variant.available}>
            <ShoppingBag />
            {!variant ? t("chooseOptions") : variant.available ? t("addToCart") : t("outOfStock")}
          </Button>
        </div>
        <Link href={`/product/${product.slug}`} className="mt-4 text-sm font-semibold text-sage-700 hover:underline">
          {t("openProduct")} →
        </Link>
      </div>
    </div>
  );
}

export function QuickAddDialog({ productId, open, onOpenChange }: { productId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("product");
  const [product, setProduct] = useState<QuickProduct | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || product) return;
    let cancelled = false;
    quickProductAction(productId).then((result) => {
      if (cancelled) return;
      if (result.ok) setProduct(result.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, product, productId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("quickTitle")} size="lg">
        {product ? (
          <QuickBody product={product} onDone={() => onOpenChange(false)} />
        ) : failed ? (
          <p className="py-10 text-center text-sm text-ink-500">{t("notAvailable")}</p>
        ) : (
          <div className="grid place-items-center py-16 text-sage-700">
            <LoaderCircle className="size-7 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
