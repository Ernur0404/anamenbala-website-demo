import {
  ChartColumn,
  ClipboardList,
  FolderTree,
  House,
  Images,
  MessageCircle,
  Package,
  Percent,
  ScanBarcode,
  Settings,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/server/permissions";

export type AdminNavKey = "dashboard" | "orders" | "pos" | "products" | "stock" | "catalog" | "promotions" | "customers" | "reviews" | "content" | "reports" | "settings";

export type AdminNavItem = { key: AdminNavKey; href: string; icon: LucideIcon; permission: Permission; exact?: boolean };

/** Меню админки (порядок как в макете + разделы склада, кассы, акций и отчётов) */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: "dashboard", href: "/admin", icon: House, permission: "dashboard", exact: true },
  { key: "orders", href: "/admin/orders", icon: ClipboardList, permission: "orders" },
  { key: "pos", href: "/admin/pos", icon: ScanBarcode, permission: "pos" },
  { key: "products", href: "/admin/products", icon: Package, permission: "products" },
  { key: "stock", href: "/admin/stock", icon: Warehouse, permission: "stock" },
  { key: "catalog", href: "/admin/catalog", icon: FolderTree, permission: "catalog" },
  { key: "promotions", href: "/admin/promotions", icon: Percent, permission: "promotions" },
  { key: "customers", href: "/admin/customers", icon: Users, permission: "customers" },
  { key: "reviews", href: "/admin/reviews", icon: MessageCircle, permission: "reviews" },
  { key: "content", href: "/admin/content", icon: Images, permission: "content" },
  { key: "reports", href: "/admin/reports", icon: ChartColumn, permission: "reports" },
  { key: "settings", href: "/admin/settings", icon: Settings, permission: "settings" },
];
