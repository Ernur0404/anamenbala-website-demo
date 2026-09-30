import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { mediaSelect } from "@/server/media/refs";
import { PageHeader, Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media-url";
import { ContentNav } from "./content-nav";
import { BannerRow, type BannerRowData } from "./banner-row";
import { HomeSections, type SectionRow } from "./home-sections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content");
  return { title: t("title") };
}

export default async function ContentPage() {
  await requireStaff("content");
  const t = await getTranslations("admin.content");
  const [banners, sections, categories, manualIds] = await Promise.all([
    db.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }], include: { image: { select: mediaSelect } } }),
    db.homeSection.findMany({ orderBy: { sortOrder: "asc" } }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }], select: { slug: true, nameRu: true, parentId: true } }),
    db.homeSection.findMany({ where: { type: "PRODUCTS" }, select: { config: true } }),
  ]);
  const ids = manualIds.flatMap((s) => ((s.config as { productIds?: string[] }).productIds ?? []));
  const products = ids.length
    ? await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, nameRu: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { media: { select: mediaSelect } } } } })
    : [];
  const productById = new Map(products.map((p) => [p.id, { id: p.id, name: p.nameRu, imageUrl: mediaUrl(p.media[0]?.media, 320) }]));

  const toRow = (b: (typeof banners)[number], i: number, list: typeof banners): BannerRowData => ({
    id: b.id,
    title: b.titleRu,
    text: b.textRu,
    buttonText: b.buttonTextRu,
    imageUrl: mediaUrl(b.image, 640),
    isActive: b.isActive,
    order: i + 1,
    first: i === 0,
    last: i === list.length - 1,
  });
  const hero = banners.filter((b) => b.placement === "HOME_HERO");
  const promo = banners.filter((b) => b.placement === "HOME_PROMO");
  const rows: SectionRow[] = sections.map((s, i) => {
    const config = (s.config ?? {}) as { source?: string; categorySlug?: string; productIds?: string[]; limit?: number };
    return {
      id: s.id,
      type: s.type,
      titleRu: s.titleRu ?? "",
      titleKk: s.titleKk ?? "",
      isActive: s.isActive,
      first: i === 0,
      last: i === sections.length - 1,
      config: { source: config.source ?? "popular", categorySlug: config.categorySlug ?? "", limit: config.limit ?? 8, products: (config.productIds ?? []).map((id) => productById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)) },
    };
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/admin/content/banners/new" className={buttonVariants()}>
            <Plus />
            {t("banners.add")}
          </Link>
        }
      />
      <ContentNav active="home" />
      <div className="space-y-5">
        <Panel title={t("banners.hero")} subtitle={t("banners.heroHint")} serif>
          {hero.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">{t("banners.empty")}</p>
          ) : (
            <div className="space-y-3">
              {hero.map((b, i) => (
                <BannerRow key={b.id} banner={toRow(b, i, hero)} />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={t("banners.promo")}
          subtitle={t("banners.promoHint")}
          serif
          action={
            promo.length === 0 ? (
              <Link href="/admin/content/banners/new?placement=HOME_PROMO" className={buttonVariants({ size: "sm" })}>
                <Plus />
                {t("banners.add")}
              </Link>
            ) : null
          }
        >
          <div className="space-y-3">
            {promo.map((b, i) => (
              <BannerRow key={b.id} banner={toRow(b, i, promo)} />
            ))}
          </div>
        </Panel>

        <Panel title={t("sections.title")} subtitle={t("sections.hint")} serif padded={false}>
          <HomeSections rows={rows} categories={categories.map((c) => ({ slug: c.slug, name: c.nameRu, nested: Boolean(c.parentId) }))} />
        </Panel>
      </div>
    </>
  );
}
