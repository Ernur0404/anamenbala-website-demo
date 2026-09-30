import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { orderFormOptions } from "@/server/admin/orders";
import { getStatusLabels } from "@/server/admin/statuses";
import { PageHeader } from "@/components/admin/ui";
import { ManualOrderForm } from "./manual-order-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.orders.manual");
  return { title: t("title") };
}

export default async function NewOrderPage() {
  await requireStaff("orders");
  const t = await getTranslations("admin.orders");
  const [options, labels] = await Promise.all([orderFormOptions(), getStatusLabels(await getLocale())]);
  return (
    <>
      <PageHeader back={{ href: "/admin/orders", label: t("backToOrders") }} title={t("manual.title")} subtitle={t("manual.subtitle")} />
      <ManualOrderForm
        deliveries={options.deliveries.filter((d) => d.isActive)}
        payments={options.payments.filter((p) => p.isActive)}
        links={options.links}
        statusNames={{ NEW: labels.order.NEW.label, CONFIRMED: labels.order.CONFIRMED.label }}
      />
    </>
  );
}
