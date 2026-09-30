import { db } from "../db";
import { can } from "../permissions";
import { getSetting } from "../settings";
import type { StaffRole } from "@/generated/prisma/enums";

/** Счётчики для колокольчика и меню админки */
export async function getShellCounts(role: StaffRole) {
  const threshold = (await getSetting("general")).lowStockThreshold;
  const [newOrders, pendingReviews, newMessages, lowStock] = await Promise.all([
    can(role, "orders") ? db.order.count({ where: { status: "NEW" } }) : 0,
    can(role, "reviews") ? db.review.count({ where: { status: "PENDING" } }) : 0,
    can(role, "customers") ? db.contactMessage.count({ where: { status: "NEW" } }) : 0,
    can(role, "stock")
      ? db.productVariant.count({ where: { isActive: true, stock: { gt: 0, lte: threshold }, product: { status: "PUBLISHED" } } })
      : 0,
  ]);
  return { newOrders, pendingReviews, newMessages, lowStock };
}
