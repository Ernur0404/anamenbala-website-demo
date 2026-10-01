import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { SettingsNav } from "../settings-nav";
import { DeliveryMethods, PaymentMethods } from "./methods-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("delivery") };
}

export default async function DeliverySettingsPage() {
  await requireStaff("settings");
  const t = await getTranslations("admin.settings");
  const [deliveries, payments] = await Promise.all([
    db.deliveryMethod.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { orders: true } } } }),
    db.paymentMethod.findMany({ orderBy: { sortOrder: "asc" }, include: { deliveryMethods: { select: { deliveryMethodId: true } }, _count: { select: { orders: true } } } }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsNav active="delivery" />
      <div className="space-y-5">
        <DeliveryMethods
          methods={deliveries.map((d) => ({
            id: d.id,
            kind: d.kind,
            nameRu: d.nameRu,
            nameKk: d.nameKk ?? "",
            descriptionRu: d.descriptionRu ?? "",
            descriptionKk: d.descriptionKk ?? "",
            etaRu: d.etaRu ?? "",
            etaKk: d.etaKk ?? "",
            price: d.price,
            freeFrom: d.freeFrom,
            addressRu: d.addressRu ?? "",
            addressKk: d.addressKk ?? "",
            icon: d.icon ?? "truck",
            isActive: d.isActive,
            orders: d._count.orders,
          }))}
        />
        <PaymentMethods
          deliveries={deliveries.map((d) => ({ id: d.id, name: d.nameRu, isActive: d.isActive }))}
          methods={payments.map((p) => ({
            id: p.id,
            kind: p.kind,
            nameRu: p.nameRu,
            nameKk: p.nameKk ?? "",
            descriptionRu: p.descriptionRu ?? "",
            descriptionKk: p.descriptionKk ?? "",
            instructionsRu: p.instructionsRu ?? "",
            instructionsKk: p.instructionsKk ?? "",
            icon: p.icon ?? "",
            isActive: p.isActive,
            deliveryMethodIds: p.deliveryMethods.map((x) => x.deliveryMethodId),
            orders: p._count.orders,
          }))}
        />
      </div>
    </>
  );
}
