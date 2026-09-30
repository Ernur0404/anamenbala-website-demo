import type { StaffRole } from "@/generated/prisma/enums";

/**
 * Права в админке. Владелец — всё. Менеджер — заказы, клиенты, товары, остатки, касса, отзывы;
 * без настроек, сотрудников, себестоимости и прибыли.
 */
export const PERMISSIONS = [
  "dashboard",
  "orders",
  "pos",
  "products",
  "stock",
  "customers",
  "reviews",
  "catalog",
  "promotions",
  "content",
  "reports",
  "finance",
  "settings",
  "staff",
  "audit",
  "import",
  "demo",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MANAGER_PERMISSIONS: readonly Permission[] = ["dashboard", "orders", "pos", "products", "stock", "customers", "reviews"];

export function can(role: StaffRole, permission: Permission): boolean {
  if (role === "OWNER") return true;
  return MANAGER_PERMISSIONS.includes(permission);
}

/** Видит ли роль себестоимость и прибыль */
export function canSeeFinance(role: StaffRole): boolean {
  return can(role, "finance");
}
