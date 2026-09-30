"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { db } from "../db";
import { DomainError, type ActionResult } from "../errors";
import { run } from "./run";
import { addToCart, cartCount, cartItems, clearCart, removeFromCart, setCartPromo, setCartQuantity } from "../cart";
import { getCurrentCart, getOrCreateCartId, toggleFavorite, clearFavorites } from "../store-session";
import { buildQuote, normalizePromoCode } from "../orders/quote";
import { getQuickProduct, type QuickProduct } from "../catalog/product";
import { getCardsByIds, toImage, type ProductCardData } from "../catalog/cards";
import { rateLimit } from "../rate-limit";
import { clientIp } from "../request";
import { notifyContactMessage } from "../notifications";
import { normalizePhone } from "@/lib/phone";
import { mediaSelect } from "../media/refs";
import { searchTokens, normalizeSearch } from "@/lib/search";
import { getCategoryIndex, categoryPath, isCategoryPublic } from "../catalog/categories";
import { tr, type Locale } from "@/lib/l10n";

async function currentLocale(): Promise<Locale> {
  return (await getLocale()) === "kk" ? "kk" : "ru";
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<ActionResult<{ count: number; quantity: number; limited: boolean }>> {
  return run(async () => {
    const cartId = await getOrCreateCartId();
    const result = await addToCart(cartId, z.string().min(1).parse(variantId), z.number().int().min(1).max(99).parse(quantity));
    return { ...result, count: await cartCount(cartId) };
  });
}

export async function setCartQuantityAction(variantId: string, quantity: number): Promise<ActionResult<{ count: number; quantity: number }>> {
  return run(async () => {
    const cart = await getCurrentCart();
    if (!cart) return { count: 0, quantity: 0 };
    const result = await setCartQuantity(cart.id, variantId, Math.min(99, Math.max(0, Math.floor(quantity))));
    return { ...result, count: await cartCount(cart.id) };
  });
}

export async function removeFromCartAction(variantId: string): Promise<ActionResult<{ count: number }>> {
  return run(async () => {
    const cart = await getCurrentCart();
    if (!cart) return { count: 0 };
    await removeFromCart(cart.id, variantId);
    return { count: await cartCount(cart.id) };
  });
}

export async function clearCartAction(): Promise<ActionResult<{ count: number }>> {
  return run(async () => {
    const cart = await getCurrentCart();
    if (cart) await clearCart(cart.id);
    return { count: 0 };
  });
}

export async function applyPromoAction(code: string): Promise<ActionResult<{ code: string }>> {
  return run(async () => {
    const normalized = normalizePromoCode(code);
    if (!normalized) throw new DomainError("PROMO_NOT_FOUND", "Введите промокод");
    const ip = (await clientIp()) ?? "unknown";
    if (!(await rateLimit(`promo:${ip}`, 20, 600))) throw new DomainError("RATE_LIMITED", "Слишком много попыток");
    const cart = await getCurrentCart();
    if (!cart) throw new DomainError("CART_EMPTY", "Корзина пуста");
    const quote = await buildQuote(db, { items: await cartItems(cart.id), promoCode: normalized });
    if (quote.promoError) throw new DomainError(quote.promoError.code, "Промокод не применён", { ...quote.promoError });
    await setCartPromo(cart.id, normalized);
    return { code: normalized };
  });
}

export async function removePromoAction(): Promise<ActionResult<undefined>> {
  return run(async () => {
    const cart = await getCurrentCart();
    if (cart) await setCartPromo(cart.id, null);
    return undefined;
  });
}

export async function toggleFavoriteAction(productId: string): Promise<ActionResult<{ favorite: boolean; count: number }>> {
  return run(async () => {
    const exists = await db.product.findUnique({ where: { id: z.string().min(1).parse(productId) }, select: { id: true } });
    if (!exists) throw new DomainError("NOT_FOUND", "Товар не найден");
    return toggleFavorite(productId);
  });
}

export async function clearFavoritesAction(): Promise<ActionResult<undefined>> {
  return run(async () => {
    await clearFavorites();
    return undefined;
  });
}

export async function quickProductAction(productId: string): Promise<ActionResult<QuickProduct>> {
  return run(async () => {
    const product = await getQuickProduct(productId, await currentLocale());
    if (!product) throw new DomainError("NOT_FOUND", "Товар недоступен");
    return product;
  });
}

export async function productCardsAction(ids: string[]): Promise<ActionResult<ProductCardData[]>> {
  return run(async () => getCardsByIds(z.array(z.string()).max(24).parse(ids), await currentLocale()));
}

export type SearchSuggestion = {
  products: { slug: string; name: string; price: number; image: ReturnType<typeof toImage> }[];
  categories: { name: string; path: string }[];
};

export async function searchSuggestAction(query: string): Promise<ActionResult<SearchSuggestion>> {
  return run(async () => {
    const locale = await currentLocale();
    const tokens = searchTokens(query);
    if (!tokens.length) return { products: [], categories: [] };
    const rows = await db.product.findMany({
      where: { status: "PUBLISHED", AND: tokens.map((t) => ({ searchText: { contains: t } })) },
      orderBy: [{ inStock: "desc" }, { salesCount: "desc" }],
      take: 6,
      select: { slug: true, nameRu: true, nameKk: true, priceMin: true, media: { orderBy: { sortOrder: "asc" }, take: 1, select: { media: { select: mediaSelect } } } },
    });
    const index = await getCategoryIndex();
    const needle = normalizeSearch(query);
    const categories = index.all
      .filter((c) => isCategoryPublic(index, c.id) && (normalizeSearch(c.nameRu).includes(needle) || normalizeSearch(c.nameKk).includes(needle)))
      .slice(0, 4)
      .map((c) => ({ name: tr(c, "name", locale), path: `/catalog/${categoryPath(index, c.id).map((p) => p.slug).join("/")}` }));
    return {
      products: rows.map((r) => {
        const name = tr(r, "name", locale);
        return { slug: r.slug, name, price: r.priceMin, image: toImage(r.media[0]?.media, name) };
      }),
      categories,
    };
  });
}

export async function subscribeNewsletterAction(email: string): Promise<ActionResult<undefined>> {
  return run(async () => {
    const value = z.string().trim().toLowerCase().email().max(200).parse(email);
    const ip = (await clientIp()) ?? "unknown";
    if (!(await rateLimit(`newsletter:${ip}`, 5, 3600))) throw new DomainError("RATE_LIMITED", "Слишком много попыток");
    await db.newsletterSubscriber.upsert({ where: { email: value }, create: { email: value, locale: await currentLocale() }, update: {} });
    return undefined;
  });
}

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(30),
  message: z.string().trim().min(5).max(3000),
  website: z.string().max(0).optional(), // ловушка для ботов
});

export async function sendContactMessageAction(input: z.infer<typeof contactSchema>): Promise<ActionResult<undefined>> {
  return run(async () => {
    const data = contactSchema.parse(input);
    const phone = normalizePhone(data.phone);
    if (!phone) throw new DomainError("VALIDATION", "Неверный телефон", { fieldErrors: { phone: "invalidPhone" } });
    const ip = (await clientIp()) ?? "unknown";
    if (!(await rateLimit(`contact:${ip}`, 5, 3600))) throw new DomainError("RATE_LIMITED", "Слишком много сообщений");
    const message = await db.contactMessage.create({ data: { name: data.name, phone, message: data.message, locale: await currentLocale() } });
    await notifyContactMessage(message.id).catch((e) => console.error(e));
    return undefined;
  });
}
