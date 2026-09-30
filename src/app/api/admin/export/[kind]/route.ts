import { getStaff } from "@/server/auth/staff";
import { can, type Permission } from "@/server/permissions";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { buildWorkbook, xlsxResponse } from "@/server/admin/xlsx";
import { customerWhere, type CustomerFilter } from "@/server/admin/customers";
import { toStoreDateKey } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const PERMISSIONS: Record<string, Permission> = { customers: "customers", subscribers: "customers" };

/** Выгрузка списков в Excel: /api/admin/export/customers?q=…&filter=…, /api/admin/export/subscribers */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const staff = await getStaff();
  if (!staff) return new Response("Unauthorized", { status: 401 });
  const permission = PERMISSIONS[kind];
  if (!permission) return new Response("Not found", { status: 404 });
  if (!can(staff.role, permission)) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const date = toStoreDateKey(new Date());

  if (kind === "customers") {
    const filter = url.searchParams.get("filter") as CustomerFilter | null;
    const customers = await db.customer.findMany({
      where: customerWhere({ q: url.searchParams.get("q") ?? undefined, city: url.searchParams.get("city") ?? undefined, filter: filter ?? undefined }),
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, phone: true, email: true, city: true, notes: true, createdAt: true },
    });
    const stats = await db.order.groupBy({ by: ["customerId"], where: { status: { not: "CANCELLED" } }, _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true } });
    const byId = new Map(stats.map((s) => [s.customerId, s]));
    const buffer = await buildWorkbook(
      "Клиенты",
      [
        { header: "Имя", width: 28, value: (c) => c.name },
        { header: "Телефон", width: 18, value: (c) => formatPhone(c.phone) },
        { header: "Email", width: 28, value: (c) => c.email },
        { header: "Город", width: 18, value: (c) => c.city },
        { header: "Заказов", width: 10, value: (c) => byId.get(c.id)?._count._all ?? 0 },
        { header: "Сумма покупок, ₸", width: 16, value: (c) => byId.get(c.id)?._sum.total ?? 0, numFmt: "#,##0" },
        { header: "Последний заказ", width: 16, value: (c) => byId.get(c.id)?._max.createdAt ?? null, numFmt: "dd.mm.yyyy" },
        { header: "Клиент с", width: 14, value: (c) => c.createdAt, numFmt: "dd.mm.yyyy" },
        { header: "Заметки", width: 40, value: (c) => c.notes },
      ],
      customers,
    );
    await audit({ staffUserId: staff.id, action: "export.customers", entityType: "export", summary: `Выгрузка клиентов (${customers.length})` });
    return xlsxResponse(buffer, `klienty-${date}.xlsx`);
  }

  const subscribers = await db.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
  const buffer = await buildWorkbook(
    "Подписчики",
    [
      { header: "Email", width: 34, value: (s) => s.email },
      { header: "Язык", width: 8, value: (s) => s.locale },
      { header: "Дата подписки", width: 16, value: (s) => s.createdAt, numFmt: "dd.mm.yyyy" },
    ],
    subscribers,
  );
  await audit({ staffUserId: staff.id, action: "export.subscribers", entityType: "export", summary: `Выгрузка подписчиков (${subscribers.length})` });
  return xlsxResponse(buffer, `podpischiki-${date}.xlsx`);
}
