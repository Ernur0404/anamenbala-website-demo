/** Корзина и избранное текущего посетителя (cookie для гостя, БД для аккаунта) */
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { isProduction } from "./env";
import { cartCount, createCart, findCartByToken, findCartByUser, mergeCarts } from "./cart";
import { getCurrentUser } from "./auth/customer";

export const CART_COOKIE = "amb_cart";
export const FAV_COOKIE = "amb_fav";
const YEAR = 365 * 86_400_000;
const MAX_GUEST_FAVORITES = 60;

async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/", expires: new Date(Date.now() + YEAR) });
}

/** Корзина для чтения (может не существовать) */
export const getCurrentCart = cache(async () => {
  const user = await getCurrentUser();
  if (user) return findCartByUser(user.id);
  return findCartByToken((await cookies()).get(CART_COOKIE)?.value);
});

/** Корзина для записи — создаётся при первом добавлении */
export async function getOrCreateCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const existing = await findCartByUser(user.id);
    if (existing) return existing.id;
    const { cart } = await createCart(user.id);
    return cart.id;
  }
  const token = (await cookies()).get(CART_COOKIE)?.value;
  const existing = await findCartByToken(token);
  if (existing) return existing.id;
  const { cart, token: newToken } = await createCart();
  await setCookie(CART_COOKIE, newToken);
  return cart.id;
}

export async function getCartCount(): Promise<number> {
  const cart = await getCurrentCart();
  return cart ? cartCount(cart.id) : 0;
}

// ───────────── Избранное ─────────────

function parseFavCookie(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(".").filter((id) => /^[a-z0-9]{10,40}$/i.test(id)).slice(0, MAX_GUEST_FAVORITES);
}

export const getFavoriteIds = cache(async (): Promise<string[]> => {
  const user = await getCurrentUser();
  if (user) {
    const rows = await db.wishlistItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { productId: true } });
    return rows.map((r) => r.productId);
  }
  return parseFavCookie((await cookies()).get(FAV_COOKIE)?.value);
});

export async function toggleFavorite(productId: string): Promise<{ favorite: boolean; count: number }> {
  const user = await getCurrentUser();
  if (user) {
    const existing = await db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId } } });
    if (existing) await db.wishlistItem.delete({ where: { userId_productId: { userId: user.id, productId } } });
    else await db.wishlistItem.create({ data: { userId: user.id, productId } });
    const count = await db.wishlistItem.count({ where: { userId: user.id } });
    return { favorite: !existing, count };
  }
  const ids = parseFavCookie((await cookies()).get(FAV_COOKIE)?.value);
  const has = ids.includes(productId);
  const next = has ? ids.filter((id) => id !== productId) : [productId, ...ids].slice(0, MAX_GUEST_FAVORITES);
  await setCookie(FAV_COOKIE, next.join("."));
  return { favorite: !has, count: next.length };
}

export async function clearFavorites() {
  const user = await getCurrentUser();
  if (user) await db.wishlistItem.deleteMany({ where: { userId: user.id } });
  else (await cookies()).delete(FAV_COOKIE);
}

/** При входе/регистрации: перенести гостевую корзину и избранное в аккаунт */
export async function mergeGuestIntoUser(userId: string) {
  const store = await cookies();
  const guestCart = await findCartByToken(store.get(CART_COOKIE)?.value);
  if (guestCart && guestCart.userId !== userId) {
    const userCart = await findCartByUser(userId);
    if (userCart) await mergeCarts(guestCart.id, userCart.id);
    else await db.cart.update({ where: { id: guestCart.id }, data: { userId } });
  }
  store.delete(CART_COOKIE);

  const favIds = parseFavCookie(store.get(FAV_COOKIE)?.value);
  if (favIds.length) {
    const existing = await db.product.findMany({ where: { id: { in: favIds } }, select: { id: true } });
    await db.wishlistItem.createMany({ data: existing.map((p) => ({ userId, productId: p.id })), skipDuplicates: true });
  }
  store.delete(FAV_COOKIE);
}
