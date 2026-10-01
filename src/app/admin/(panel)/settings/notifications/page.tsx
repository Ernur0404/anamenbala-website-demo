import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { getSetting } from "@/server/settings";
import { smtpConfigured } from "@/server/admin/settings-admin";
import { PageHeader } from "@/components/admin/ui";
import { SettingsNav } from "../settings-nav";
import { NotificationsForm } from "./notifications-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("notifications") };
}

export default async function NotificationsSettingsPage() {
  await requireStaff("settings");
  const t = await getTranslations("admin.settings");
  const settings = await getSetting("notifications");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsNav active="notifications" />
      <NotificationsForm
        initial={{
          // сам токен в браузер не передаётся — только признак, что он сохранён
          tokenSet: Boolean(settings.telegramBotToken),
          chatIds: settings.telegramChatIds,
          events: settings.events,
          customerEmails: settings.customerEmails,
          adminEmails: settings.adminEmails.join(", "),
        }}
        smtp={smtpConfigured()}
      />
    </>
  );
}
