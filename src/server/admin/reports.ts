/**
 * Отчёты и главная панель. Выручка — заказы, кроме отменённых и возвращённых.
 * Периоды и группировка по дням — по времени магазина (Asia/Atyrau).
 */
import { db } from "../db";
import { Prisma } from "@/generated/prisma/client";
import { getCategoryIndex, ancestorIds } from "../catalog/categories";
import { getSetting } from "../settings";
import { mediaSelect } from "../media/refs";
import { addDays, toStoreDateKey } from "@/lib/dates";

export type Bucket = "day" | "week" | "month";
const TZ = "Asia/Atyrau";

const live = (alias = "o") => Prisma.sql`${Prisma.raw(`"${alias}"`)}."status" <> 'CANCELLED' AND ${Prisma.raw(`"${alias}"`)}."paymentStatus" <> 'REFUNDED'`;
const range = (from: Date, to: Date, alias = "o") => Prisma.sql`${Prisma.raw(`"${alias}"`)}."createdAt" >= ${from} AND ${Prisma.raw(`"${alias}"`)}."createdAt" < ${to}`;
const num = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** Границы «всего времени» — от первого заказа */
export async function effectiveRange(from: Date | null, to: Date | null): Promise<{ from: Date; to: Date }> {
  const end = to ?? addDays(new Date(), 1);
  if (from) return { from, to: end };
  const first = await db.order.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  return { from: first?.createdAt ?? addDays(end, -30), to: end };
}

export function pickBucket(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return days <= 62 ? "day" : days <= 366 ? "week" : "month";
}

export async function salesSeries(from: Date, to: Date, bucket: Bucket) {
  const rows = await db.$queryRaw<{ bucket: Date; revenue: bigint; orders: bigint }[]>`
    SELECT date_trunc(${bucket}, (o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}) AS bucket,
           COALESCE(SUM(o."total"), 0)::bigint AS revenue,
           COUNT(*)::bigint AS orders
    FROM "Order" o
    WHERE ${range(from, to)} AND ${live()}
    GROUP BY 1 ORDER BY 1`;
  const byKey = new Map(rows.map((r) => [r.bucket.toISOString().slice(0, 10), r]));
  // непрерывный ряд без пропусков
  const points: { key: string; revenue: number; orders: number }[] = [];
  const cursor = new Date(`${toStoreDateKey(from)}T00:00:00Z`);
  const end = new Date(`${toStoreDateKey(addDays(to, -1))}T00:00:00Z`);
  if (bucket === "week") cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  if (bucket === "month") cursor.setUTCDate(1);
  let guard = 0;
  while (cursor <= end && guard++ < 800) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byKey.get(key);
    points.push({ key, revenue: num(row?.revenue), orders: num(row?.orders) });
    if (bucket === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (bucket === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return points;
}

export async function salesSummary(from: Date, to: Date) {
  const [orders] = await db.$queryRaw<{ revenue: bigint; orders: bigint; delivery: bigint }[]>`
    SELECT COALESCE(SUM(o."total"), 0)::bigint AS revenue, COUNT(*)::bigint AS orders, COALESCE(SUM(o."deliveryPrice"), 0)::bigint AS delivery
    FROM "Order" o WHERE ${range(from, to)} AND ${live()}`;
  const [items] = await db.$queryRaw<{ qty: bigint; revenue_with_cost: bigint | number | null; cost: bigint; revenue_without_cost: number | null }[]>`
    SELECT COALESCE(SUM(oi."quantity"), 0)::bigint AS qty,
           SUM(CASE WHEN oi."costPrice" IS NOT NULL THEN oi."lineTotal" * (1 - o."promoDiscount"::float / NULLIF(o."itemsTotal", 0)) END) AS revenue_with_cost,
           COALESCE(SUM(oi."costPrice" * oi."quantity"), 0)::bigint AS cost,
           SUM(CASE WHEN oi."costPrice" IS NULL THEN oi."lineTotal" END) AS revenue_without_cost
    FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
    WHERE ${range(from, to)} AND ${live()}`;
  const cancelled = await db.order.count({ where: { createdAt: { gte: from, lt: to }, status: "CANCELLED" } });
  const revenue = num(orders.revenue);
  const count = num(orders.orders);
  const revenueWithCost = Math.round(Number(items.revenue_with_cost ?? 0));
  const cost = num(items.cost);
  return {
    revenue,
    orders: count,
    avgCheck: count ? Math.round(revenue / count) : 0,
    items: num(items.qty),
    cancelled,
    cost,
    grossProfit: revenueWithCost - cost,
    margin: cost > 0 ? Math.round(((revenueWithCost - cost) / cost) * 100) : null,
    revenueWithoutCost: Math.round(Number(items.revenue_without_cost ?? 0)),
  };
}

export async function breakdowns(from: Date, to: Date) {
  const [channels, payments, deliveries, statuses] = await Promise.all([
    db.$queryRaw<{ key: string; revenue: bigint; orders: bigint }[]>`
      SELECT o."channel"::text AS key, COALESCE(SUM(o."total"),0)::bigint AS revenue, COUNT(*)::bigint AS orders
      FROM "Order" o WHERE ${range(from, to)} AND ${live()} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ key: string | null; revenue: bigint; orders: bigint }[]>`
      SELECT o."paymentName" AS key, COALESCE(SUM(o."total"),0)::bigint AS revenue, COUNT(*)::bigint AS orders
      FROM "Order" o WHERE ${range(from, to)} AND ${live()} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ key: string | null; revenue: bigint; orders: bigint }[]>`
      SELECT o."deliveryName" AS key, COALESCE(SUM(o."total"),0)::bigint AS revenue, COUNT(*)::bigint AS orders
      FROM "Order" o WHERE ${range(from, to)} AND ${live()} GROUP BY 1 ORDER BY 2 DESC`,
    db.order.groupBy({ by: ["status"], where: { createdAt: { gte: from, lt: to } }, _count: { _all: true } }),
  ]);
  const map = (rows: { key: string | null; revenue: bigint; orders: bigint }[]) => rows.map((r) => ({ key: r.key, revenue: num(r.revenue), orders: num(r.orders) }));
  return { channels: map(channels), payments: map(payments), deliveries: map(deliveries), statuses: statuses.map((s) => ({ key: s.status, orders: s._count._all })) };
}

export async function topProducts(from: Date, to: Date, limit = 20) {
  const rows = await db.$queryRaw<{ productId: string | null; name: string; qty: bigint; revenue: bigint; orders: bigint; cost: bigint; with_cost: bigint | number | null }[]>`
    SELECT oi."productId" AS "productId", MIN(oi."nameRu") AS name, SUM(oi."quantity")::bigint AS qty, SUM(oi."lineTotal")::bigint AS revenue,
           COUNT(DISTINCT oi."orderId")::bigint AS orders, COALESCE(SUM(oi."costPrice" * oi."quantity"),0)::bigint AS cost,
           SUM(CASE WHEN oi."costPrice" IS NOT NULL THEN oi."lineTotal" END) AS with_cost
    FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
    WHERE ${range(from, to)} AND ${live()}
    GROUP BY oi."productId" ORDER BY revenue DESC LIMIT ${limit}`;
  const ids = rows.map((r) => r.productId).filter((x): x is string => Boolean(x));
  const media = ids.length
    ? await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, priceMin: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } } } })
    : [];
  const byId = new Map(media.map((m) => [m.id, m]));
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    qty: num(r.qty),
    revenue: num(r.revenue),
    orders: num(r.orders),
    cost: num(r.cost),
    profit: r.with_cost != null ? Math.round(Number(r.with_cost)) - num(r.cost) : null,
    image: r.productId ? (byId.get(r.productId)?.media[0]?.media ?? null) : null,
    price: r.productId ? (byId.get(r.productId)?.priceMin ?? null) : null,
  }));
}

/** Продажи по разделам верхнего уровня (по основной категории товара) */
export async function salesByRootCategory(from: Date, to: Date) {
  const rows = await db.$queryRaw<{ categoryId: string | null; qty: bigint; revenue: bigint; cost: bigint; with_cost: bigint | number | null }[]>`
    SELECT p."primaryCategoryId" AS "categoryId", SUM(oi."quantity")::bigint AS qty, SUM(oi."lineTotal")::bigint AS revenue,
           COALESCE(SUM(oi."costPrice" * oi."quantity"),0)::bigint AS cost, SUM(CASE WHEN oi."costPrice" IS NOT NULL THEN oi."lineTotal" END) AS with_cost
    FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" LEFT JOIN "Product" p ON p."id" = oi."productId"
    WHERE ${range(from, to)} AND ${live()}
    GROUP BY 1`;
  const index = await getCategoryIndex();
  const totals = new Map<string, { id: string | null; name: string; qty: number; revenue: number; cost: number; withCost: number }>();
  for (const r of rows) {
    const rootId = r.categoryId ? ancestorIds(index, r.categoryId).at(-1) ?? r.categoryId : null;
    const key = rootId ?? "—";
    const name = rootId ? (index.byId.get(rootId)?.nameRu ?? "—") : "—";
    const cur = totals.get(key) ?? { id: rootId, name, qty: 0, revenue: 0, cost: 0, withCost: 0 };
    cur.qty += num(r.qty);
    cur.revenue += num(r.revenue);
    cur.cost += num(r.cost);
    cur.withCost += Math.round(Number(r.with_cost ?? 0));
    totals.set(key, cur);
  }
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).map((c) => ({ ...c, profit: c.withCost - c.cost }));
}

export async function customerStats(from: Date, to: Date) {
  const [newCustomers, buyers, returning, top, cities] = await Promise.all([
    db.customer.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT o."customerId")::bigint AS n FROM "Order" o WHERE ${range(from, to)} AND ${live()}`,
    db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT o."customerId")::bigint AS n FROM "Order" o
      WHERE ${range(from, to)} AND ${live()} AND EXISTS (SELECT 1 FROM "Order" p WHERE p."customerId" = o."customerId" AND p."createdAt" < ${from} AND p."status" <> 'CANCELLED')`,
    db.$queryRaw<{ customerId: string; name: string; phone: string; orders: bigint; revenue: bigint }[]>`
      SELECT o."customerId" AS "customerId", MIN(o."customerName") AS name, MIN(o."customerPhone") AS phone, COUNT(*)::bigint AS orders, SUM(o."total")::bigint AS revenue
      FROM "Order" o WHERE ${range(from, to)} AND ${live()} AND o."customerId" IS NOT NULL
      GROUP BY 1 ORDER BY revenue DESC LIMIT 15`,
    db.$queryRaw<{ city: string | null; orders: bigint; revenue: bigint }[]>`
      SELECT COALESCE(NULLIF(TRIM(o."city"), ''), NULL) AS city, COUNT(*)::bigint AS orders, SUM(o."total")::bigint AS revenue
      FROM "Order" o WHERE ${range(from, to)} AND ${live()} GROUP BY 1 ORDER BY revenue DESC LIMIT 15`,
  ]);
  return {
    newCustomers,
    buyers: num(buyers[0]?.n),
    returning: num(returning[0]?.n),
    top: top.map((r) => ({ ...r, orders: num(r.orders), revenue: num(r.revenue) })),
    cities: cities.map((r) => ({ city: r.city, orders: num(r.orders), revenue: num(r.revenue) })),
  };
}

export async function stockReport() {
  const [totals] = await db.$queryRaw<{ units: bigint; cost: bigint; retail: bigint }[]>`
    SELECT COALESCE(SUM(v."stock"),0)::bigint AS units,
           COALESCE(SUM(v."stock" * COALESCE(v."costPrice", p."costPrice", 0)),0)::bigint AS cost,
           COALESCE(SUM(v."stock" * COALESCE(v."price", p."price")),0)::bigint AS retail
    FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
    WHERE v."isActive" = true AND v."stock" > 0`;
  const since = addDays(new Date(), -60);
  const noSales = await db.$queryRaw<{ id: string; name: string; stock: bigint; value: bigint }[]>`
    SELECT p."id", p."nameRu" AS name, SUM(v."stock")::bigint AS stock, SUM(v."stock" * COALESCE(v."costPrice", p."costPrice", 0))::bigint AS value
    FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p."id" AND v."isActive" = true AND v."stock" > 0
    WHERE p."status" = 'PUBLISHED' AND p."createdAt" < ${since}
      AND NOT EXISTS (SELECT 1 FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" WHERE oi."productId" = p."id" AND o."createdAt" >= ${since} AND o."status" <> 'CANCELLED')
    GROUP BY p."id", p."nameRu" ORDER BY stock DESC LIMIT 30`;
  const out = await db.product.count({ where: { status: "PUBLISHED", inStock: false } });
  return { units: num(totals.units), cost: num(totals.cost), retail: num(totals.retail), out, noSales: noSales.map((r) => ({ ...r, stock: num(r.stock), value: num(r.value) })) };
}

// ───────────── главная панель ─────────────

export async function dashboardData(from: Date, to: Date, prevFrom: Date | null, prevTo: Date | null) {
  const [cur, prev, newCustomers, prevCustomers, inStock, latest, popular, newest, categoryCounts, attention] = await Promise.all([
    salesSummary(from, to),
    prevFrom && prevTo ? salesSummary(prevFrom, prevTo) : null,
    db.customer.count({ where: { createdAt: { gte: from, lt: to } } }),
    prevFrom && prevTo ? db.customer.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }) : null,
    db.product.count({ where: { status: "PUBLISHED", inStock: true } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, number: true, customerName: true, total: true, status: true, createdAt: true } }),
    topProducts(from, to, 5),
    db.customer.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, phone: true, createdAt: true } }),
    rootCategoryProductCounts(),
    attentionCounts(),
  ]);
  return { cur, prev, newCustomers, prevCustomers, inStock, latest, popular, newest, categoryCounts, attention };
}

async function rootCategoryProductCounts() {
  const index = await getCategoryIndex();
  const links = await db.productCategory.findMany({ where: { product: { status: "PUBLISHED" } }, select: { productId: true, categoryId: true } });
  const byRoot = new Map<string, Set<string>>();
  for (const l of links) {
    const root = ancestorIds(index, l.categoryId).at(-1) ?? l.categoryId;
    if (!byRoot.has(root)) byRoot.set(root, new Set());
    byRoot.get(root)!.add(l.productId);
  }
  const total = await db.product.count({ where: { status: "PUBLISHED" } });
  return {
    total,
    items: [...byRoot.entries()].map(([id, set]) => ({ id, name: index.byId.get(id)?.nameRu ?? "—", count: set.size })).sort((a, b) => b.count - a.count),
  };
}

async function attentionCounts() {
  const threshold = (await getSetting("general")).lowStockThreshold;
  const [newOrders, unpaid, reviews, lowStock, messages] = await Promise.all([
    db.order.count({ where: { status: "NEW" } }),
    db.order.count({ where: { paymentStatus: "UNPAID", status: { in: ["CONFIRMED", "PACKING", "SHIPPED"] }, paymentKind: "KASPI" } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.productVariant.count({ where: { isActive: true, stock: { gt: 0, lte: threshold }, product: { status: "PUBLISHED" } } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  return { newOrders, unpaid, reviews, lowStock, messages };
}
