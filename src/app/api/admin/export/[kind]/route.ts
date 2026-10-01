import { getStaff } from "@/server/auth/staff";
import { can, type Permission } from "@/server/permissions";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { buildWorkbook, xlsxResponse } from "@/server/admin/xlsx";
import { customerWhere, type CustomerFilter } from "@/server/admin/customers";
import { addDays, storeDayStart, toStoreDateKey } from "@/lib/dates";
import { effectiveRange, topProducts } from "@/server/admin/reports";
import { exportOrders, exportProducts } from "@/server/admin/import-export";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const PERMISSIONS: Record<string, Permission> = { customers: "customers", subscribers: "customers", "report-products": "reports", products: "import", orders: "import" };

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

  if (kind === "products") {
    const buffer = await exportProducts({ ...staff, ip: null });
    return xlsxResponse(buffer, "tovary-" + date + ".xlsx");
  }

  if (kind === "orders") {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const f = url.searchParams.get("from");
    const tt = url.searchParams.get("to");
    const { from, to } = await effectiveRange(f && re.test(f) ? storeDayStart(f) : null, tt && re.test(tt) ? addDays(storeDayStart(tt), 1) : null);
    const buffer = await exportOrders(from, to, { ...staff, ip: null });
    return xlsxResponse(buffer, "zakazy-" + toStoreDateKey(from) + "-" + toStoreDateKey(addDays(to, -1)) + ".xlsx");
  }

  if (kind === "report-products") {
    const f = url.searchParams.get("from");
    const tt = url.searchParams.get("to");
    const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const { from, to } = await effectiveRange(valid(f) ? storeDayStart(valid(f)!) : null, valid(tt) ? addDays(storeDayStart(valid(tt)!), 1) : null);
    const rows = await topProducts(from, to, 1000);
    const buffer = await buildWorkbook(
      "Товары",
      [
        { header: "Товар", width: 40, value: (r) => r.name },
        { header: "Продано, шт.", width: 12, value: (r) => r.qty },
        { header: "Заказов", width: 10, value: (r) => r.orders },
        { header: "Выручка, ₸", width: 14, value: (r) => r.revenue, numFmt: "#,##0" },
        ...(can(staff.role, "finance")
          ? [
              { header: "Себестоимость, ₸", width: 16, value: (r: (typeof rows)[number]) => r.cost, numFmt: "#,##0" },
              { header: "Прибыль, ₸", width: 14, value: (r: (typeof rows)[number]) => r.profit, numFmt: "#,##0" },
            ]
          : []),
      ],
      rows,
    );
    await audit({ staffUserId: staff.id, action: "export.report_products", entityType: "export", summary: `Выгрузка отчёта по товарам (${rows.length})` });
    return xlsxResponse(buffer, `otchet-tovary-${toStoreDateKey(from)}-${toStoreDateKey(addDays(to, -1))}.xlsx`);
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
