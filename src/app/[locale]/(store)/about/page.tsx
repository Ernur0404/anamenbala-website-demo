import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Heart } from "lucide-react";
import { db } from "@/server/db";
import { getPage } from "@/server/content";
import { toImage } from "@/server/catalog/cards";
import { mediaSelect } from "@/server/media/refs";
import { PageHero } from "@/components/store/page-hero";
import { DynamicIcon } from "@/components/ui/icons";
import { pickLocale, tr, trOrNull, type Locale } from "@/lib/l10n";

type L = { ru?: string; kk?: string };
type AboutContent = {
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const page = await getPage("about");
  if (!page) return {};
  return { title: trOrNull(page, "seoTitle", locale) ?? tr(page, "title", locale), description: trOrNull(page, "seoDescription", locale) ?? trOrNull(page, "subtitle", locale) ?? undefined };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const page = await getPage("about");
  if (!page || !page.isPublished) notFound();
  const t = await getTranslations();
  const content = (page.content ?? {}) as AboutContent;
  const imageIds = [content.valuesImageId, content.storyImageId].filter((id): id is string => Boolean(id));
  const media = imageIds.length ? await db.media.findMany({ where: { id: { in: imageIds } }, select: mediaSelect }) : [];
  const valuesImage = toImage(media.find((m) => m.id === content.valuesImageId), pickLocale(content.quote, locale));
  const storyImage = toImage(media.find((m) => m.id === content.storyImageId), pickLocale(content.storyTitle, locale));
  const title = tr(page, "title", locale);

  return (
    <>
      <PageHero title={title} subtitle={trOrNull(page, "subtitle", locale)} script={trOrNull(page, "script", locale)} image={toImage(page.heroImage, title)} breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: title }]}>
        {content.intro && <p className="mt-1 text-sm leading-relaxed text-ink-600 lg:mt-3 lg:max-w-[440px]">{pickLocale(content.intro, locale)}</p>}
      </PageHero>

      {content.features && content.features.length > 0 && (
        <section className="container-page mt-4 lg:mt-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {content.features.map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-3 rounded-xl border border-line bg-white px-4 py-6 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-sage-50 text-sage-700">
                  <DynamicIcon name={f.icon} className="size-6 stroke-[1.6]" />
                </span>
                <p className="text-sm font-semibold">{pickLocale(f.title, locale)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.values && content.values.length > 0 && (
        <section className="container-page mt-14 grid items-stretch gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="heading-section mb-5 text-[32px]">{pickLocale(content.valuesTitle, locale)}</h2>
            <ul className="space-y-3">
              {content.values.map((v, i) => (
                <li key={i} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full border border-sage-200 text-sage-700">
                    <DynamicIcon name={v.icon} className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{pickLocale(v.title, locale)}</span>
                    <span className="block text-sm text-ink-500">{pickLocale(v.text, locale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative min-h-[320px] overflow-hidden rounded-2xl bg-gradient-to-br from-beige-100 to-sage-100">
            {valuesImage && <Image src={valuesImage.src} alt={valuesImage.alt} fill sizes="(max-width: 1024px) 100vw, 640px" className="object-cover" />}
            {content.quote && (
              <p className="script-accent absolute top-8 left-8 max-w-[260px] text-[34px] text-graphite/85">
                {pickLocale(content.quote, locale)}
                <Heart className="mt-2 size-6 stroke-[1.4]" />
              </p>
            )}
          </div>
        </section>
      )}

      {content.story && (
        <section className="container-page mt-14">
          <h2 className="heading-section mb-5 text-[32px]">{pickLocale(content.storyTitle, locale)}</h2>
          <div className="grid items-center gap-6 rounded-2xl border border-line bg-white p-4 sm:p-6 lg:grid-cols-[1fr_1.2fr] lg:gap-10">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-beige-100">
              {storyImage && <Image src={storyImage.src} alt={storyImage.alt} fill sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />}
            </div>
            <div>
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-700">{pickLocale(content.story, locale)}</p>
              <p className="script-accent mt-5 flex items-center gap-2 text-[26px] text-sage-700">
                {t("pages.thanksForBeing")}
                <Heart className="size-5 stroke-[1.4]" />
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
