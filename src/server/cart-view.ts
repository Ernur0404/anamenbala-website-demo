import { db } from "./db";
import { cartItems } from "./cart";
import { getCurrentCart } from "./store-session";
import { buildQuote } from "./orders/quote";
import { toImage, type ImageData } from "./catalog/cards";
import { getFreeDeliveryThreshold } from "./content";
import type { Locale } from "@/lib/l10n";

export type CartLineView = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string | null;
  image: ImageData | null;
  regularUnit: number;
  finalUnit: number;
  quantity: number;
  lineTotal: number;
  lineRegular: number;
  stock: number;
  allowBackorder: boolean;
  backorderQty: number;
  maxQuantity: number;
  problem: "OUT_OF_STOCK" | "VARIANT_UNAVAILABLE" | null;
};

export type CartView = {
  lines: CartLineView[];
  itemsCount: number;
  itemsRegular: number;
  itemsTotal: number;
  itemsDiscount: number;
  promo: { code: string; discount: number } | null;
  promoError: { code: string; minOrderAmount?: number } | null;
  freeDeliveryThreshold: number | null;
  total: number;
  hasProblems: boolean;
};

/** Корзина текущего посетителя, пересчитанная на сервере (цены, акции, промокод, наличие) */
export async function getCartView(locale: Locale): Promise<CartView | null> {
  const cart = await getCurrentCart();
  if (!cart) return null;
  const items = await cartItems(cart.id);
  if (!items.length) return null;
  const [quote, threshold] = await Promise.all([buildQuote(db, { items, promoCode: cart.promoCode }), getFreeDeliveryThreshold()]);

  const lines: CartLineView[] = quote.lines.map((l) => {
    const name = locale === "kk" ? l.nameKk || l.nameRu : l.nameRu;
    return {
      variantId: l.variantId,
      productId: l.productId,
      slug: l.productSlug,
      name,
      variantLabel: locale === "kk" ? l.variantLabelKk || l.variantLabelRu : l.variantLabelRu,
      image: toImage(l.image, name),
      regularUnit: l.regularUnit,
      finalUnit: l.finalUnit,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      lineRegular: l.lineRegular,
      stock: Math.max(0, l.stock),
      allowBackorder: l.allowBackorder,
      backorderQty: l.allowBackorder ? Math.max(0, l.quantity - Math.max(0, l.stock)) : 0,
      maxQuantity: l.allowBackorder ? 99 : Math.max(1, Math.min(99, l.stock)),
      problem: l.problem,
    };
  });

  return {
    lines,
    itemsCount: quote.totals.itemsCount,
    itemsRegular: quote.totals.itemsRegular,
    itemsTotal: quote.totals.itemsTotal,
    itemsDiscount: quote.totals.itemsDiscount,
    promo: quote.promo ? { code: quote.promo.code, discount: quote.promo.discount } : null,
    promoError: cart.promoCode && quote.promoError ? { code: quote.promoError.code, minOrderAmount: quote.promoError.minOrderAmount } : null,
    freeDeliveryThreshold: threshold,
    total: quote.totals.itemsTotal - quote.totals.promoDiscount,
    hasProblems: lines.some((l) => l.problem !== null),
  };
}
