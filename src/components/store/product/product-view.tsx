"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, ShoppingBag } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Price, ProductBadge, Rating } from "@/components/ui/display";
import { QuantityStepper } from "@/components/ui/quantity";
import type { ProductPageData } from "@/server/catalog/product";
import { useStore } from "../store-provider";
import { useVariantSelection, VariantSelector } from "../variant-selector";
import { StockStatus } from "../stock-status";
import { ProductGallery } from "./gallery";
import { SizeChartDialog } from "./size-chart";
import { cn } from "@/lib/utils";

type Props = Pick<
  ProductPageData,
  "id" | "name" | "subtitle" | "badges" | "rating" | "ratingCount" | "gallery" | "options" | "variants" | "allowBackorder" | "backorderNote" | "sizeChart" | "lowStockThreshold"
>;

export function ProductView(product: Props) {
  const t = useTranslations("product");
  const router = useRouter();
  const { addToCart, isFavorite, toggleFavorite } = useStore();
  const { selection, choose, variant, valueState } = useVariantSelection(product.options, product.variants);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState<"cart" | "buy" | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const colorOption = product.options.find((o) => o.display === "SWATCH");
  const activeColor = colorOption ? (selection[colorOption.attributeId] ?? null) : null;

  const shown = variant ?? product.variants.reduce<(typeof product.variants)[number] | null>((min, v) => (!min || v.price < min.price ? v : min), null);
  const maxQty = variant ? (product.allowBackorder ? 99 : Math.max(1, variant.stock)) : 99;
  const canBuy = Boolean(variant && variant.available);
  const favorite = isFavorite(product.id);
  // выбрали размер с меньшим остатком — количество не превышает доступное
  const qty = Math.min(quantity, maxQty);

  useEffect(() => {
    const el = buttonsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const add = async (mode: "cart" | "buy") => {
    if (!variant) {
      document.getElementById("variant-options")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(mode);
    const ok = await addToCart(variant.id, qty, { silent: mode === "buy" });
    setBusy(null);
    if (ok && mode === "buy") router.push("/checkout");
  };

  const buttonLabel = !variant ? t("chooseOptions") : variant.available ? t("addToCart") : t("outOfStock");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-12">
      <ProductGallery
        items={product.gallery}
        activeColorValueId={activeColor}
        badges={
          <>
            {product.badges.map((b) => (
              <ProductBadge key={b.label} style={b.style}>
                {b.label}
              </ProductBadge>
            ))}
          </>
        }
      />

      <div className="min-w-0">
        {product.subtitle && <p className="text-[13px] font-semibold text-sage-700">{product.subtitle}</p>}
        <h1 className="heading-display mt-1.5 text-[32px] sm:text-[40px]">{product.name}</h1>
        {product.ratingCount > 0 && (
          <a href="#reviews" className="mt-2 inline-flex">
            <Rating value={product.rating} count={product.ratingCount} size="md" />
          </a>
        )}

        {shown && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Price value={shown.price} oldValue={shown.oldPrice} size="xl" />
            {shown.discountPercent > 0 && <ProductBadge style="DISCOUNT">−{shown.discountPercent}%</ProductBadge>}
          </div>
        )}
        {variant ? (
          <StockStatus className="mt-3" stock={variant.stock} allowBackorder={product.allowBackorder} backorderNote={product.backorderNote} lowStockThreshold={product.lowStockThreshold} />
        ) : (
          !product.variants.some((v) => v.available) && <StockStatus className="mt-3" stock={0} allowBackorder={false} lowStockThreshold={product.lowStockThreshold} />
        )}

        {product.options.length > 0 && (
          <div id="variant-options" className="mt-6">
            <VariantSelector
              options={product.options}
              selection={selection}
              onChoose={choose}
              valueState={valueState}
              sizeChartTrigger={product.sizeChart ? <SizeChartDialog chart={product.sizeChart} /> : undefined}
            />
          </div>
        )}
        {product.options.length === 0 && product.sizeChart && (
          <div className="mt-4">
            <SizeChartDialog chart={product.sizeChart} />
          </div>
        )}

        <div className="mt-6">
          <p className="mb-2.5 text-sm text-ink-600">{t("quantity")}:</p>
          <QuantityStepper value={qty} onChange={setQuantity} max={maxQty} disabled={!canBuy} />
        </div>

        <div ref={buttonsRef} className="mt-6 space-y-3 sm:max-w-md">
          <Button block size="lg" onClick={() => add("cart")} loading={busy === "cart"} disabled={Boolean(variant) && !canBuy}>
            <ShoppingBag />
            {buttonLabel}
          </Button>
          <Button block size="lg" variant="powder" onClick={() => add("buy")} loading={busy === "buy"} disabled={Boolean(variant) && !canBuy}>
            {t("buyNow")}
          </Button>
          <button
            type="button"
            onClick={() => toggleFavorite(product.id)}
            className="mx-auto flex items-center gap-2 py-1 text-sm font-semibold text-ink-700 transition-colors hover:text-powder-700"
            aria-pressed={favorite}
          >
            <Heart className={cn("size-[18px]", favorite && "fill-powder-500 text-powder-500")} />
            {favorite ? t("inFavorites") : t("addToFavorites")}
          </button>
        </div>
        {variant && (
          <p className="mt-4 text-xs text-ink-400">
            {t("sku")}: {variant.sku}
          </p>
        )}
      </div>

      {/* липкая панель на телефоне */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 px-4 py-2.5 backdrop-blur transition-transform duration-200 lg:hidden",
          showSticky ? "translate-y-0" : "pointer-events-none translate-y-[calc(100%+60px)]",
        )}
      >
        <div className="flex items-center gap-3">
          {shown && <Price value={shown.price} oldValue={shown.oldPrice} size="md" className="min-w-0 flex-col !gap-0" />}
          <Button className="ml-auto flex-1" onClick={() => add("cart")} loading={busy === "cart"} disabled={Boolean(variant) && !canBuy}>
            <ShoppingBag />
            {variant ? (variant.available ? t("inCart") : t("outOfStock")) : t("chooseOptions")}
          </Button>
        </div>
      </div>
    </div>
  );
}
