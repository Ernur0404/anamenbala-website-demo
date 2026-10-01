import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Download, Mail, Package, Users } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { PageHeader, Panel } from "@/components/admin/ui";
import { toStoreDateKey } from "@/lib/dates";
import { SettingsNav } from "../settings-nav";
import { ExportOrders, ImportProducts } from "./data-tools";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("data") };
}

const card = "flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 transition-colors hover:border-sage-400 hover:bg-sage-50/40";

export default async function DataSettingsPage() {
  await requireStaff("import");
  const [t, ts] = await Promise.all([getTranslations("admin.settings.data"), getTranslations("admin.settings")]);
  const today = toStoreDateKey(new Date());
  const links = [
    { href: "/api/admin/export/products", label: t("exportProducts"), icon: Package },
    { href: "/api/admin/export/customers", label: t("exportCustomers"), icon: Users },
    { href: "/api/admin/export/subscribers", label: t("exportSubscribers"), icon: Mail },
  ];
  return (
    <>
      <PageHeader title={ts("title")} subtitle={ts("subtitle")} />
      <SettingsNav active="data" />
      <div className="space-y-5">
        <Panel title={t("export")} subtitle={t("exportHint")} serif>
          <div className="grid gap-3 md:grid-cols-3">
            {links.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} download className={card}>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sage-50 text-sage-700">
                  <Icon className="size-5" />
                </span>
                <span className="flex-1 text-[14px] font-semibold text-graphite">{label}</span>
                <Download className="size-4 text-ink-400" />
              </a>
            ))}
          </div>
          <ExportOrders defaultFrom={`${today.slice(0, 8)}01`} defaultTo={today} />
        </Panel>
        <ImportProducts />
      </div>
    </>
  );
}
