import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { getSetting } from "@/server/settings";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { SettingsNav } from "../settings-nav";
import { SeoForm } from "./seo-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("seo") };
}

export default async function SeoSettingsPage() {
  await requireStaff("settings");
  const t = await getTranslations("admin.settings");
  const seo = await getSetting("seo");
  const og = seo.ogImageMediaId ? await db.media.findUnique({ where: { id: seo.ogImageMediaId }, select: mediaSelect }) : null;
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SettingsNav active="seo" />
      <SeoForm initial={{ title: seo.title, description: seo.description, keywords: seo.keywords, og: og ? { id: og.id, url: mediaUrl(og, 640) } : null }} />
    </>
  );
}
