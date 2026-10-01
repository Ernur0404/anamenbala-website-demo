import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CircleCheck, Image as ImageIcon, Package, ShoppingBag, Users } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { demoStats } from "@/server/demo";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SettingsNav } from "../settings-nav";
import { DeleteDemoButton } from "./delete-demo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("demo") };
}

export default async function DemoSettingsPage() {
  await requireStaff("demo");
  const [t, ts] = await Promise.all([getTranslations("admin.settings.demo"), getTranslations("admin.settings")]);
  const stats = await demoStats();
  const items = [
    { label: t("products"), value: stats.products, icon: Package },
    { label: t("orders"), value: stats.orders, icon: ShoppingBag },
    { label: t("customers"), value: stats.customers, icon: Users },
    { label: t("banners"), value: stats.media, icon: ImageIcon },
  ];
  const any = stats.products + stats.orders + stats.customers + stats.media + stats.brands + stats.promotions > 0;
  return (
    <>
      <PageHeader title={ts("title")} subtitle={ts("subtitle")} />
      <SettingsNav active="demo" />
      <Panel title={t("title")} subtitle={t("hint")} serif>
        {any ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-beige-50 text-ink-600">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-[22px] leading-none font-bold text-graphite">{value.toLocaleString("ru-RU")}</p>
                    <p className="mt-1 text-[12.5px] text-ink-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <DeleteDemoButton />
          </div>
        ) : (
          <p className="flex items-center gap-2.5 rounded-xl bg-sage-50 px-4 py-3.5 text-[14px] font-medium text-sage-800">
            <CircleCheck className="size-5" />
            {t("none")}
          </p>
        )}
      </Panel>
    </>
  );
}
