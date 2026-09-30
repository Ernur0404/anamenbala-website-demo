import { db } from "@/server/db";
import { clearCache } from "@/server/cache";
import { refreshProductIndex } from "@/server/catalog/indexer";
import { createCart, addToCart } from "@/server/cart";
import { hashPassword } from "@/server/auth/password";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  clearCache();
}

export async function createStaff(role: "OWNER" | "MANAGER" = "OWNER") {
  return db.staffUser.create({
    data: { email: `${role.toLowerCase()}-${Math.random().toString(36).slice(2)}@test.kz`, name: role, role, passwordHash: await hashPassword("secret123") },
  });
}

/** Каталог: категория «Для детей» → «Одежда», товар «Двойка» в размерах 80/100 */
export async function createCatalog(options: { stock80?: number; stock100?: number; allowBackorder?: boolean; price?: number } = {}) {
  const kids = await db.category.create({ data: { slug: "dlya-detey", nameRu: "Для детей" } });
  const clothes = await db.category.create({ data: { slug: "odezhda", nameRu: "Одежда", parentId: kids.id } });
  const size = await db.attribute.create({ data: { code: "size", nameRu: "Размер", isVariantAxis: true, display: "CHIPS" } });
  const s80 = await db.attributeValue.create({ data: { attributeId: size.id, slug: "80", valueRu: "80", sortOrder: 1 } });
  const s100 = await db.attributeValue.create({ data: { attributeId: size.id, slug: "100", valueRu: "100", sortOrder: 2 } });

  const product = await db.product.create({
    data: {
      slug: "dvoyka",
      status: "PUBLISHED",
      nameRu: "Двойка детская",
      price: options.price ?? 6_000,
      costPrice: 3_500,
      allowBackorder: options.allowBackorder ?? false,
      primaryCategoryId: clothes.id,
      publishedAt: new Date(),
      categories: { create: [{ categoryId: clothes.id }] },
      options: { create: [{ attributeId: size.id, sortOrder: 0 }] },
      variants: {
        create: [
          { sku: "DV-80", stock: options.stock80 ?? 5, sortOrder: 0, optionValues: { create: [{ attributeId: size.id, attributeValueId: s80.id }] } },
          { sku: "DV-100", stock: options.stock100 ?? 1, sortOrder: 1, optionValues: { create: [{ attributeId: size.id, attributeValueId: s100.id }] } },
        ],
      },
    },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  await refreshProductIndex([product.id]);

  const courier = await db.deliveryMethod.create({
    data: { kind: "LOCAL_COURIER", nameRu: "Курьер по Ганюшкино", price: 500, freeFrom: 15_000, addressRu: "Ганюшкино" },
  });
  const pickup = await db.deliveryMethod.create({ data: { kind: "PICKUP", nameRu: "Самовывоз", price: 0 } });
  const kaspi = await db.paymentMethod.create({ data: { kind: "KASPI", nameRu: "Kaspi: счёт или перевод" } });
  const onDelivery = await db.paymentMethod.create({ data: { kind: "ON_DELIVERY", nameRu: "При получении" } });

  return {
    kids,
    clothes,
    product,
    v80: product.variants[0],
    v100: product.variants[1],
    courier,
    pickup,
    kaspi,
    onDelivery,
  };
}

export async function cartWith(items: { variantId: string; quantity: number }[]) {
  const { cart } = await createCart();
  for (const item of items) await addToCart(cart.id, item.variantId, item.quantity);
  return cart;
}

export function checkoutInput(over: Record<string, unknown> = {}) {
  return {
    name: "Аяна Тулегенова",
    phone: "+7 778 707 75 90",
    email: "",
    deliveryMethodId: "",
    paymentMethodId: "",
    street: "Абая",
    house: "12",
    consent: true as const,
    idempotencyKey: `key-${Math.random().toString(36).slice(2)}`,
    ...over,
  };
}

export async function stockOf(variantId: string) {
  return (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
}
