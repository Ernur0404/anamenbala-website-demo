import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { getSetting } from "@/server/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsNav } from "../settings-nav";
import { StatusesForm } from "./statuses-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("statuses") };
}

export default async function StatusesSettingsPage() {
  await requireStaff("settings");
  const t = await getTranslations("admin.settings");
  const statuses = await getSetting("statuses");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsNav active="statuses" />
      <StatusesForm initial={statuses} />
    </>
  );
}
