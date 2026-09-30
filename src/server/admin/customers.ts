/** Клиенты (CRM по телефону), сообщения с сайта, подписчики */
import { z } from "zod";
import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { addDays } from "@/lib/dates";
import type { AdminActor } from "./action";

export const CUSTOMER_PAGE_SIZE = 20;
/** Активный — покупал за последние полгода; новый — появился за последние 30 дней */
export const ACTIVE_DAYS = 180;
export const NEW_DAYS = 30;

export type CustomerFilter = "active" | "new" | "withOrders" | "noOrders" | "withAccount";
export type CustomerSort = "new" | "name" | "orders";

const LIVE = { status: { not: "CANCELLED" as const } };

export function customerWhere(f: { q?: string; city?: string; filter?: CustomerFilter }, now = new Date()): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    let digits = q.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }
  if (f.city) and.push({ city: { equals: f.city, mode: "insensitive" } });
  if (f.filter === "active") and.push({ orders: { some: { ...LIVE, createdAt: { gte: addDays(now, -ACTIVE_DAYS) } } } });
  if (f.filter === "new") and.push({ createdAt: { gte: addDays(now, -NEW_DAYS) } });
  if (f.filter === "withOrders") and.push({ orders: { some: LIVE } });
  if (f.filter === "noOrders") and.push({ orders: { none: LIVE } });
  if (f.filter === "withAccount") and.push({ users: { some: {} } });
  return and.length ? { AND: and } : {};
}

export async function listCustomers(f: { q?: string; city?: string; filter?: CustomerFilter; sort?: CustomerSort }, page: number) {
  const where = customerWhere(f);
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] = f.sort === "name" ? [{ name: "asc" }] : f.sort === "orders" ? [{ orders: { _count: "desc" } }, { createdAt: "desc" }] : [{ createdAt: "desc" }];
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
      select: { id: true, name: true, phone: true, email: true, city: true, createdAt: true, isDemo: true, _count: { select: { users: true } } },
    }),
    db.customer.count({ where }),
  ]);
  const stats = rows.length
    ? await db.order.groupBy({ by: ["customerId"], where: { customerId: { in: rows.map((r) => r.id) }, ...LIVE }, _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true } })
    : [];
  const byId = new Map(stats.map((s) => [s.customerId, s]));
  return {
    total,
    rows: rows.map((r) => {
      const s = byId.get(r.id);
      return { ...r, orders: s?._count._all ?? 0, spent: s?._sum.total ?? 0, lastOrderAt: s?._max.createdAt ?? null };
    }),
  };
}

export function customerStatus(c: { createdAt: Date; lastOrderAt: Date | null }, now = new Date()): "new" | "active" | "inactive" {
  if (c.createdAt >= addDays(now, -NEW_DAYS)) return "new";
  if (c.lastOrderAt && c.lastOrderAt >= addDays(now, -ACTIVE_DAYS)) return "active";
  return "inactive";
}

export async function customerKpis(now = new Date()) {
  const [total, active, fresh, withOrders] = await Promise.all([
    db.customer.count(),
    db.customer.count({ where: customerWhere({ filter: "active" }, now) }),
    db.customer.count({ where: customerWhere({ filter: "new" }, now) }),
    db.customer.count({ where: customerWhere({ filter: "withOrders" }, now) }),
  ]);
  return { total, active, new: fresh, withOrders };
}

export async function customerCities() {
  const rows = await db.customer.findMany({ where: { city: { not: null } }, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" }, take: 200 });
  return rows.map((r) => r.city!).filter(Boolean);
}

export async function getCustomer(id: string) {
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, email: true, emailVerifiedAt: true, createdAt: true, addresses: { orderBy: { isDefault: "desc" } } } },
      orders: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, number: true, status: true, paymentStatus: true, total: true, createdAt: true, channel: true, _count: { select: { items: true } } } },
    },
  });
  if (!customer) return null;
  const stats = await db.order.aggregate({ where: { customerId: id, ...LIVE }, _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true } });
  const reviews = await db.review.count({ where: { user: { customerId: id } } });
  return { customer, stats: { orders: stats._count._all, spent: stats._sum.total ?? 0, lastOrderAt: stats._max.createdAt, avg: stats._count._all ? Math.round((stats._sum.total ?? 0) / stats._count._all) : 0 }, reviews };
}

export const customerUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  email: z.union([z.string().trim().email().max(200), z.literal("")]).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(3000).optional().nullable(),
});

export async function updateCustomer(raw: z.infer<typeof customerUpdateSchema>, actor: AdminActor) {
  const input = customerUpdateSchema.parse(raw);
  const existing = await db.customer.findUnique({ where: { id: input.id } });
  if (!existing) throw new DomainError("NOT_FOUND");
  await db.customer.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.city !== undefined ? { city: input.city || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
  });
  await audit({ staffUserId: actor.id, action: "customer.update", entityType: "customer", entityId: input.id, summary: `Изменены данные клиента ${existing.name}`, ip: actor.ip });
}

// ───────────── сообщения и подписчики ─────────────

export async function listContactMessages(status: "NEW" | "DONE" | undefined, page: number) {
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    db.contactMessage.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip: (page - 1) * CUSTOMER_PAGE_SIZE, take: CUSTOMER_PAGE_SIZE }),
    db.contactMessage.count({ where }),
  ]);
  return { rows, total };
}

export async function setContactMessageStatus(id: string, status: "NEW" | "DONE", actor: AdminActor) {
  await db.contactMessage.update({ where: { id }, data: { status } });
  await audit({ staffUserId: actor.id, action: "message.status", entityType: "contact_message", entityId: id, summary: `Сообщение с сайта: ${status}`, ip: actor.ip });
}

export async function deleteContactMessage(id: string, actor: AdminActor) {
  await db.contactMessage.delete({ where: { id } }).catch(() => null);
  await audit({ staffUserId: actor.id, action: "message.delete", entityType: "contact_message", entityId: id, summary: "Удалено сообщение с сайта", ip: actor.ip });
}

export async function listSubscribers(q: string | undefined, page: number) {
  const where: Prisma.NewsletterSubscriberWhereInput = q ? { email: { contains: q, mode: "insensitive" } } : {};
  const [rows, total] = await Promise.all([
    db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * CUSTOMER_PAGE_SIZE * 2, take: CUSTOMER_PAGE_SIZE * 2 }),
    db.newsletterSubscriber.count({ where }),
  ]);
  return { rows, total };
}

export async function deleteSubscriber(id: string, actor: AdminActor) {
  const s = await db.newsletterSubscriber.delete({ where: { id } }).catch(() => null);
  if (s) await audit({ staffUserId: actor.id, action: "subscriber.delete", entityType: "subscriber", entityId: id, summary: `Удалён подписчик ${s.email}`, ip: actor.ip });
}
