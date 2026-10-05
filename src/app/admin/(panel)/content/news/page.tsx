import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime, formatDayMonth } from "@/lib/dates";
import { noticeDate } from "@/lib/notifications";
import { saleDateKeys } from "../../products/_form/state";
import { ContentNav } from "../content-nav";
import { NewsManager, type NewsItem } from "./news-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content.news");
  return { title: t("title") };
}

/** Объявления для покупателей — показываются в «Уведомлениях» (колокольчик на сайте) */
export default async function NewsPage() {
  const staff = await requireStaff("content");
  const t = await getTranslations("admin.content");
  const rows = await db.announcement.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();
  const locale = staff.locale ?? "ru";

  const items: NewsItem[] = rows.map((a) => {
    const dates = saleDateKeys(a.startsAt, a.endsAt);
    let state: NewsItem["state"] = "live";
    if (!a.isActive) state = "hidden";
    else if (a.endsAt && a.endsAt <= now) state = "ended";
    else if (a.startsAt && a.startsAt > now) state = "scheduled";
    return {
      id: a.id,
      titleRu: a.titleRu,
      titleKk: a.titleKk ?? "",
      textRu: a.textRu ?? "",
      textKk: a.textKk ?? "",
      url: a.url ?? "",
      startsAt: dates.start,
      endsAt: dates.end,
      isActive: a.isActive,
      state,
      startLabel: a.startsAt ? formatDayMonth(a.startsAt, locale) : "",
      endLabel: a.endsAt ? formatDayMonth(new Date(a.endsAt.getTime() - 1), locale) : "",
      dateLabel: formatDateTime(noticeDate(a.startsAt, a.createdAt), locale),
    };
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ContentNav active="news" />
      <NewsManager items={items} />
    </>
  );
}
