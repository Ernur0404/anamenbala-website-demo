import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { pagePath } from "../page-path";
import { PageForm, type AboutState } from "./page-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("admin.content.pages");
  if (id === "new") return { title: t("new") };
  const page = await db.page.findUnique({ where: { id }, select: { titleRu: true } });
  return { title: page?.titleRu ?? t("title") };
}

type L = { ru?: string; kk?: string };
const l = (v: L | undefined) => ({ ru: v?.ru ?? "", kk: v?.kk ?? "" });

export default async function PageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("content");
  const { id } = await params;
  const t = await getTranslations("admin.content");
  const page = id === "new" ? null : await db.page.findUnique({ where: { id }, include: { heroImage: { select: mediaSelect } } });
  if (id !== "new" && !page) notFound();

  let about: AboutState | null = null;
  if (page?.template === "ABOUT") {
    const c = (page.content ?? {}) as Record<string, unknown> & {
      intro?: L;
      features?: { icon: string; title: L }[];
      valuesTitle?: L;
      values?: { icon: string; title: L; text: L }[];
      quote?: L;
      storyTitle?: L;
      story?: L;
      valuesImageId?: string | null;
      storyImageId?: string | null;
    };
    const imageIds = [c.valuesImageId, c.storyImageId].filter((x): x is string => Boolean(x));
    const media = imageIds.length ? await db.media.findMany({ where: { id: { in: imageIds } }, select: mediaSelect }) : [];
    const img = (mid?: string | null) => {
      const m = media.find((x) => x.id === mid);
      return m ? { id: m.id, url: mediaUrl(m, 640) } : null;
    };
    about = {
      intro: l(c.intro),
      features: (c.features ?? []).map((f) => ({ icon: f.icon, title: l(f.title) })),
      valuesTitle: l(c.valuesTitle),
      values: (c.values ?? []).map((v) => ({ icon: v.icon, title: l(v.title), text: l(v.text) })),
      quote: l(c.quote),
      storyTitle: l(c.storyTitle),
      story: l(c.story),
      valuesImage: img(c.valuesImageId),
      storyImage: img(c.storyImageId),
    };
  }

  return (
    <>
      <PageHeader back={{ href: "/admin/content/pages", label: t("pages.title") }} title={page?.titleRu ?? t("pages.new")} subtitle={page ? pagePath(page) : undefined} />
      <PageForm
        key={page?.updatedAt.toISOString() ?? "new"}
        path={page ? pagePath(page) : null}
        initial={{
          id: page?.id ?? null,
          template: page?.template ?? "DEFAULT",
          isSystem: page?.isSystem ?? false,
          slug: page?.slug ?? "",
          titleRu: page?.titleRu ?? "",
          titleKk: page?.titleKk ?? "",
          subtitleRu: page?.subtitleRu ?? "",
          subtitleKk: page?.subtitleKk ?? "",
          scriptRu: page?.scriptRu ?? "",
          scriptKk: page?.scriptKk ?? "",
          heroImage: page?.heroImage ? { id: page.heroImage.id, url: mediaUrl(page.heroImage, 960) } : null,
          bodyRu: page?.bodyRu ?? "",
          bodyKk: page?.bodyKk ?? "",
          isPublished: page?.isPublished ?? true,
          showInFooter: page?.showInFooter ?? false,
          seoTitleRu: page?.seoTitleRu ?? "",
          seoTitleKk: page?.seoTitleKk ?? "",
          seoDescriptionRu: page?.seoDescriptionRu ?? "",
          seoDescriptionKk: page?.seoDescriptionKk ?? "",
          about,
        }}
      />
    </>
  );
}
