import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { getSetting } from "@/server/settings";
import { PageHeader } from "@/components/admin/ui";
import { ContentNav } from "../content-nav";
import { HeaderEditor } from "./header-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content.tabs");
  return { title: t("header") };
}

export default async function HeaderContentPage() {
  await requireStaff("content");
  const t = await getTranslations("admin.content");
  const [topbar, advantages] = await Promise.all([getSetting("topbar"), getSetting("advantages")]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ContentNav active="header" />
      <HeaderEditor
        topbar={topbar.items.map((i) => ({ icon: i.icon, text: { ru: i.text.ru, kk: i.text.kk ?? "" } }))}
        advantages={advantages.items.map((i) => ({ icon: i.icon, title: { ru: i.title.ru, kk: i.title.kk ?? "" }, text: { ru: i.text.ru ?? "", kk: i.text.kk ?? "" } }))}
      />
    </>
  );
}
