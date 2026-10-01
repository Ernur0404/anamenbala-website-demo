/** Журнал действий сотрудников (просмотр в настройках) */
import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";

export const AUDIT_PAGE_SIZE = 50;

/** Разделы журнала → типы сущностей, которые пишут сервисы */
export const AUDIT_GROUPS = {
  orders: ["order"],
  products: ["product"],
  stock: ["stock_document", "variant"],
  catalog: ["category", "attribute", "brand", "badge", "size_chart"],
  promotions: ["promotion", "promo_code"],
  customers: ["customer", "contact_message", "subscriber"],
  reviews: ["review"],
  content: ["banner", "page", "faq", "home_section", "instagram"],
  settings: ["setting"],
  staff: ["staff"],
  data: ["export", "import"],
} as const;

export type AuditGroup = keyof typeof AUDIT_GROUPS | "other";

export function auditGroup(entityType: string | null): AuditGroup {
  for (const [group, types] of Object.entries(AUDIT_GROUPS)) {
    if (entityType && (types as readonly string[]).includes(entityType)) return group as AuditGroup;
  }
  return "other";
}

/** Ссылка на объект в админке (если он открывается отдельной страницей и не удалён этим действием) */
export function auditLink(entry: { entityType: string | null; entityId: string | null; action: string }): string | null {
  if (!entry.entityId || entry.action.endsWith(".delete")) return null;
  const id = entry.entityId;
  switch (entry.entityType) {
    case "order":
      return `/admin/orders/${id}`;
    case "product":
      return `/admin/products/${id}`;
    case "stock_document":
      return `/admin/stock/documents/${id}`;
    case "customer":
      return `/admin/customers/${id}`;
    case "category":
      return `/admin/catalog/categories/${id}`;
    case "attribute":
      return `/admin/catalog/attributes/${id}`;
    case "size_chart":
      return `/admin/catalog/size-charts/${id}`;
    case "banner":
      return `/admin/content/banners/${id}`;
    case "page":
      return `/admin/content/pages/${id}`;
    default:
      return null;
  }
}

export async function listAuditLog(filter: { staffId?: string; group?: string }, page: number) {
  const where: Prisma.AuditLogWhereInput = {};
  if (filter.staffId) where.staffUserId = filter.staffId;
  if (filter.group && filter.group in AUDIT_GROUPS) where.entityType = { in: [...AUDIT_GROUPS[filter.group as keyof typeof AUDIT_GROUPS]] };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: { id: true, action: true, entityType: true, entityId: true, summary: true, ip: true, createdAt: true, staffUser: { select: { name: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total };
}
