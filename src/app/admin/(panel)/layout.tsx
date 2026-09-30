import type { ReactNode } from "react";
import { requireStaff } from "@/server/auth/staff";
import { can } from "@/server/permissions";
import { getShellCounts } from "@/server/admin/shell";
import { AdminShell } from "@/components/admin/shell";
import { ADMIN_NAV } from "@/components/admin/nav";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const counts = await getShellCounts(staff.role);
  const allowed = ADMIN_NAV.filter((item) => can(staff.role, item.permission)).map((item) => item.key);
  const alerts = [
    { key: "newOrders", href: "/admin/orders?status=NEW", count: counts.newOrders },
    { key: "pendingReviews", href: "/admin/reviews?status=PENDING", count: counts.pendingReviews },
    { key: "newMessages", href: "/admin/customers/messages", count: counts.newMessages },
    { key: "lowStock", href: "/admin/stock?filter=low", count: counts.lowStock },
  ];
  return (
    <AdminShell
      staff={{ name: staff.name, email: staff.email, role: staff.role, locale: staff.locale }}
      allowed={allowed}
      alerts={alerts}
      badges={{ orders: counts.newOrders, reviews: counts.pendingReviews }}
    >
      {children}
    </AdminShell>
  );
}
