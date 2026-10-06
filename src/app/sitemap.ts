import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { getCategoryIndex, isCategoryPublic } from "@/server/catalog/categories";
import { categoryHref } from "@/server/catalog/navigation";

// карта сайта всегда из текущей базы (в том числе при сборке в Docker, где базы ещё нет)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const entry = (path: string, lastModified?: Date, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path === "/" ? "" : path}` || base,
    lastModified,
    priority,
    alternates: { languages: { ru: `${base}${path === "/" ? "" : path}`, kk: `${base}/kk${path === "/" ? "" : path}` } },
  });

  const [index, products, pages] = await Promise.all([
    getCategoryIndex(),
    db.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { isPublished: true, template: { not: "HERO_ONLY" } }, select: { slug: true, template: true, updatedAt: true } }),
  ]);

  const builtIn = new Set(["about", "delivery", "contacts", "faq", "returns", "privacy", "offer"]);
  return [
    entry("/", new Date(), 1),
    entry("/catalog", new Date(), 0.9),
    entry("/sale", new Date(), 0.8),
    entry("/reviews", undefined, 0.5),
    ...index.all.filter((c) => isCategoryPublic(index, c.id)).map((c) => entry(categoryHref(index, c.id), undefined, 0.8)),
    ...products.map((p) => entry(`/product/${p.slug}`, p.updatedAt, 0.7)),
    ...pages.map((p) => entry(builtIn.has(p.slug) ? `/${p.slug}` : `/p/${p.slug}`, p.updatedAt, 0.4)),
  ];
}
