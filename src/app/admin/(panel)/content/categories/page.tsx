import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Pencil } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader, Panel } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { ContentNav } from "../content-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content");
  return { title: t("categoryBanners.title") };
}

export default async function CategoryBannersPage() {
  await requireStaff("content");
  const t = await getTranslations("admin.content");
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
    select: { id: true, parentId: true, nameRu: true, slug: true, isVisible: true, heroTitleRu: true, heroScriptRu: true, heroImage: { select: mediaSelect } },
  });
  const roots = categories.filter((c) => !c.parentId);
  const ordered = roots.flatMap((r) => [r, ...categories.filter((c) => c.parentId === r.id)]);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ContentNav active="categories" />
      <Panel title={t("categoryBanners.title")} subtitle={t("categoryBanners.hint")} serif>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((c) => {
            const url = mediaUrl(c.heroImage, 640);
            const path = c.parentId ? `/catalog/${categories.find((x) => x.id === c.parentId)?.slug}/${c.slug}` : `/catalog/${c.slug}`;
            return (
              <div key={c.id} className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="relative aspect-[16/8] bg-gradient-to-r from-beige-50 to-beige-100">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- превью баннера
                    <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-[12px] text-ink-400">{t("categoryBanners.noImage")}</span>
                  )}
                  <span className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[11px] font-bold text-white ${c.isVisible ? "bg-sage-700" : "bg-ink-400"}`}>{c.isVisible ? t("active") : t("inactive")}</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="heading-section truncate text-[18px] text-graphite">{c.heroTitleRu || c.nameRu}</p>
                    <a href={path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-sage-700 hover:underline">
                      {t("go")}
                      <ArrowRight className="size-3.5" />
                    </a>
                  </div>
                  <Link href={`/admin/catalog/categories/${c.id}`} className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={c.nameRu}>
                    <Pencil className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
