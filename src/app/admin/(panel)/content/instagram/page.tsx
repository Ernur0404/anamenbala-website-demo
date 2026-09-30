import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { ContentNav } from "../content-nav";
import { InstagramManager } from "./instagram-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content.instagram");
  return { title: t("title") };
}

export default async function InstagramPage() {
  await requireStaff("content");
  const t = await getTranslations("admin.content");
  const posts = await db.instagramPost.findMany({ orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ContentNav active="instagram" />
      <InstagramManager posts={posts.map((p) => ({ id: p.id, url: p.url, isActive: p.isActive, media: { id: p.mediaId, url: mediaUrl(p.media, 640) } }))} />
    </>
  );
}
