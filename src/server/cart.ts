/** Корзина в БД (по токену из cookie или по аккаунту). Слой без зависимостей от Next.js. */
import { db, type DbClient } from "./db";
import { DomainError } from "./errors";
import { randomToken, sha256 } from "./crypto";

export const MAX_LINE_QUANTITY = 99;

export async function findCartByToken(token: string | null | undefined) {
  if (!token) return null;
  return db.cart.findUnique({ where: { tokenHash: sha256(token) } });
}

export async function findCartByUser(userId: string) {
  return db.cart.findUnique({ where: { userId } });
}

export async function createCart(userId?: string | null) {
  const token = randomToken(32);
  const cart = await db.cart.create({ data: { tokenHash: sha256(token), userId: userId ?? null } });
  return { cart, token };
}

export async function cartItems(cartId: string) {
  return db.cartItem.findMany({ where: { cartId }, orderBy: { createdAt: "asc" }, select: { variantId: true, quantity: true } });
}

export async function cartCount(cartId: string): Promise<number> {
  const agg = await db.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

async function purchasableVariant(client: DbClient, variantId: string) {
  const variant = await client.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, stock: true, isActive: true, product: { select: { status: true, allowBackorder: true } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== "PUBLISHED") {
    throw new DomainError("VARIANT_UNAVAILABLE", "Товар недоступен");
  }
  return variant;
}

/** Максимум, который можно положить в корзину: остаток (или 99 при «под заказ») */
function limitFor(variant: { stock: number; product: { allowBackorder: boolean } }) {
  return variant.product.allowBackorder ? MAX_LINE_QUANTITY : Math.min(MAX_LINE_QUANTITY, Math.max(0, variant.stock));
}

export async function addToCart(cartId: string, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new DomainError("VALIDATION", "Неверное количество");
  const variant = await purchasableVariant(db, variantId);
  const limit = limitFor(variant);
  if (limit <= 0) throw new DomainError("OUT_OF_STOCK", "Нет в наличии", { variantId, available: 0 });
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
  const next = Math.min(limit, (existing?.quantity ?? 0) + quantity);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity: next },
    update: { quantity: next },
  });
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  return { quantity: next, limited: next < (existing?.quantity ?? 0) + quantity };
}

export async function setCartQuantity(cartId: string, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity)) throw new DomainError("VALIDATION", "Неверное количество");
  if (quantity <= 0) {
    await db.cartItem.deleteMany({ where: { cartId, variantId } });
    return { quantity: 0 };
  }
  const variant = await purchasableVariant(db, variantId).catch(() => null);
  const next = variant ? Math.min(Math.max(1, limitFor(variant)), quantity) : quantity;
  await db.cartItem.updateMany({ where: { cartId, variantId }, data: { quantity: next } });
  return { quantity: next };
}

export async function removeFromCart(cartId: string, variantId: string) {
  await db.cartItem.deleteMany({ where: { cartId, variantId } });
}

export async function clearCart(cartId: string) {
  await db.cartItem.deleteMany({ where: { cartId } });
  await db.cart.update({ where: { id: cartId }, data: { promoCode: null } });
}

export async function setCartPromo(cartId: string, code: string | null) {
  await db.cart.update({ where: { id: cartId }, data: { promoCode: code } });
}

/** Перенести товары гостевой корзины в корзину аккаунта (при входе) */
export async function mergeCarts(fromCartId: string, intoCartId: string) {
  if (fromCartId === intoCartId) return;
  const items = await db.cartItem.findMany({ where: { cartId: fromCartId } });
  for (const item of items) {
    const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: intoCartId, variantId: item.variantId } } });
    await db.cartItem.upsert({
      where: { cartId_variantId: { cartId: intoCartId, variantId: item.variantId } },
      create: { cartId: intoCartId, variantId: item.variantId, quantity: item.quantity },
      update: { quantity: Math.min(MAX_LINE_QUANTITY, Math.max(existing?.quantity ?? 0, item.quantity)) },
    });
  }
  const from = await db.cart.findUnique({ where: { id: fromCartId } });
  if (from?.promoCode) await db.cart.update({ where: { id: intoCartId }, data: { promoCode: from.promoCode } });
  await db.cart.delete({ where: { id: fromCartId } });
}

/** Удалить старые гостевые корзины (cron) */
export async function purgeStaleCarts(olderThanDays = 60) {
  await db.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(Date.now() - olderThanDays * 86_400_000) } } });
}
