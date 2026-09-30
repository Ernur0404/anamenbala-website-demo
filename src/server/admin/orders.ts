import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderChannel, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { dateRange, deltaPercent, type ResolvedPeriod } from "./period";

export type OrderListFilters = {
  status?: OrderStatus;
  payment?: PaymentStatus;
  channel?: OrderChannel;
  q?: string;
  from?: Date | null;
  to?: Date | null;
  customerId?: string;
};

export const ORDER_PAGE_SIZE = 20;

/** Условия поиска: номер, имя, телефон, email, товар (название/артикул), трек-номер */
export function orderWhere(f: OrderListFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.payment) where.paymentStatus = f.payment;
  if (f.channel) where.channel = f.channel;
  if (f.customerId) where.customerId = f.customerId;
  const created = dateRange(f.from ?? null, f.to ?? null);
  if (created) where.createdAt = created;

  const q = f.q?.trim();
  if (q) {
    const or: Prisma.OrderWhereInput[] = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { trackingNumber: { contains: q, mode: "insensitive" } },
      { items: { some: { OR: [{ nameRu: { contains: q, mode: "insensitive" } }, { nameKk: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } } },
    ];
    let digits = q.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    if (digits.length >= 4) or.push({ customerPhone: { contains: digits } });
    const asNumber = q.replace(/^#|№/, "").trim();
    if (/^\d{1,9}$/.test(asNumber)) or.push({ number: Number(asNumber) });
    where.OR = or;
  }
  return where;
}

export async function listAdminOrders(filters: OrderListFilters, page: number, pageSize = ORDER_PAGE_SIZE) {
  const where = orderWhere(filters);
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        channel: true,
        source: true,
        customerName: true,
        customerPhone: true,
        total: true,
        createdAt: true,
        deliveryName: true,
        isDemo: true,
        items: { take: 3, orderBy: { id: "asc" }, select: { imageUrl: true, nameRu: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { rows, total };
}

/** Количество по статусам (для вкладок) с учётом остальных фильтров */
export async function orderStatusCounts(filters: OrderListFilters): Promise<Record<OrderStatus | "ALL", number>> {
  const groups = await db.order.groupBy({ by: ["status"], where: orderWhere({ ...filters, status: undefined }), _count: { _all: true } });
  const counts = { ALL: 0, NEW: 0, CONFIRMED: 0, PACKING: 0, SHIPPED: 0, DELIVERED: 0, COMPLETED: 0, CANCELLED: 0 } as Record<OrderStatus | "ALL", number>;
  for (const g of groups) {
    counts[g.status] = g._count._all;
    counts.ALL += g._count._all;
  }
  return counts;
}

const IN_PROGRESS: OrderStatus[] = ["NEW", "CONFIRMED", "PACKING", "SHIPPED"];
const DONE: OrderStatus[] = ["DELIVERED", "COMPLETED"];

async function periodOrderStats(from: Date | null, to: Date | null, extra: Prisma.OrderWhereInput = {}) {
  const where: Prisma.OrderWhereInput = { ...extra };
  const created = dateRange(from, to);
  if (created) where.createdAt = created;
  const [groups, revenue] = await Promise.all([
    db.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.order.aggregate({ where: { ...where, status: { not: "CANCELLED" } }, _sum: { total: true } }),
  ]);
  const count = (statuses?: OrderStatus[]) => groups.filter((g) => !statuses || statuses.includes(g.status)).reduce((s, g) => s + g._count._all, 0);
  return { total: count(), inProgress: count(IN_PROGRESS), delivered: count(DONE), cancelled: count(["CANCELLED"]), revenue: revenue._sum.total ?? 0 };
}

/** KPI заказов за период и изменение к предыдущему периоду */
export async function orderKpis(period: ResolvedPeriod) {
  const [current, previous] = await Promise.all([
    periodOrderStats(period.from, period.to),
    period.prevFrom ? periodOrderStats(period.prevFrom, period.prevTo) : null,
  ]);
  const delta = (k: keyof typeof current) => (previous ? deltaPercent(current[k], previous[k]) : null);
  return {
    current,
    delta: { total: delta("total"), inProgress: delta("inProgress"), delivered: delta("delivered"), cancelled: delta("cancelled"), revenue: delta("revenue") },
  };
}

export async function getAdminOrder(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: { variant: { select: { id: true, stock: true, isActive: true } }, product: { select: { id: true, slug: true, status: true } } },
      },
      history: { orderBy: { createdAt: "desc" }, include: { staffUser: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" }, include: { staffUser: { select: { name: true } } } },
      customer: { select: { id: true, name: true, phone: true, notes: true, _count: { select: { orders: true } } } },
      createdBy: { select: { name: true } },
      deliveryMethod: { select: { id: true, nameRu: true, kind: true } },
      paymentMethod: { select: { id: true, nameRu: true, kind: true } },
    },
  });
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

/** Способы доставки/оплаты для форм заказа (включая выключенные — для старых заказов) */
export async function orderFormOptions() {
  const [deliveries, payments, links] = await Promise.all([
    db.deliveryMethod.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }], select: { id: true, nameRu: true, nameKk: true, kind: true, price: true, freeFrom: true, isActive: true } }),
    db.paymentMethod.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }], select: { id: true, nameRu: true, nameKk: true, kind: true, isActive: true } }),
    db.deliveryPayment.findMany({ select: { deliveryMethodId: true, paymentMethodId: true } }),
  ]);
  return { deliveries, payments, links };
}
