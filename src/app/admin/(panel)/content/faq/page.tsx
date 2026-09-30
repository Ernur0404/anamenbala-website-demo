import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { ContentNav } from "../content-nav";
import { FaqManager } from "./faq-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content.faq");
  return { title: t("title") };
}

export default async function FaqPage() {
  await requireStaff("content");
  const t = await getTranslations("admin.content");
  const items = await db.faqItem.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ContentNav active="faq" />
      <FaqManager
        items={items.map((f) => ({ id: f.id, questionRu: f.questionRu, questionKk: f.questionKk ?? "", answerRu: f.answerRu, answerKk: f.answerKk ?? "", isActive: f.isActive, showOnDelivery: f.showOnDelivery }))}
      />
    </>
  );
}
