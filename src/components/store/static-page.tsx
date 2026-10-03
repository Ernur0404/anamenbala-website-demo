import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPage } from "@/server/content";
import { toImage } from "@/server/catalog/cards";
import { sanitizeHtml } from "@/server/sanitize";
import { PageHero } from "./page-hero";
import { tr, trOrNull, type Locale } from "@/lib/l10n";

/** Страница из админки с текстом (возврат, политика, оферта, свои страницы) */
export async function StaticPage({ slug, locale }: { slug: string; locale: Locale }) {
  const page = await getPage(slug);
  if (!page || !page.isPublished || page.template !== "DEFAULT") notFound();
  const t = await getTranslations();
  const title = tr(page, "title", locale);
  const body = trOrNull(page, "body", locale);
  return (
    <>
      <PageHero title={title} subtitle={trOrNull(page, "subtitle", locale)} script={trOrNull(page, "script", locale)} image={toImage(page.heroImage, title)} compact breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: title }]} />
      <article className="container-page mt-4 lg:mt-8">
        <div className="rich-text max-w-3xl rounded-2xl border border-line bg-white p-6 text-[15px] sm:p-10" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body ?? "") }} />
      </article>
    </>
  );
}

export async function staticPageMetadata(slug: string, locale: string) {
  const page = await getPage(slug);
  if (!page) return {};
  return { title: trOrNull(page, "seoTitle", locale) ?? tr(page, "title", locale), description: trOrNull(page, "seoDescription", locale) ?? undefined };
}
