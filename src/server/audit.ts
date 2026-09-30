import { db, type DbClient } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export type AuditEntry = {
  staffUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  data?: Prisma.InputJsonValue;
  ip?: string | null;
};

/** Журнал действий сотрудников */
export async function audit(entry: AuditEntry, client: DbClient = db) {
  await client.auditLog.create({
    data: {
      staffUserId: entry.staffUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary.slice(0, 500),
      data: entry.data,
      ip: entry.ip ?? null,
    },
  });
}
