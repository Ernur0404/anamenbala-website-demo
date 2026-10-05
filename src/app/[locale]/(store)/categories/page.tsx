import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStoreChrome } from "@/server/store-chrome";
import { PageHero } from "@/components/store/page-hero";
import { CategoryCircles } from "@/components/store/home/sections";
import type { Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("catalog"), alternates: { canonical: locale === "kk" ? "/kk/categories" : "/categories" } };
}

/** «Каталог» из нижнего меню телефона: разделы кружками («Для мам», «Для детей», …, «Акции», «Все категории») */
export default async function CategoriesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const chrome = await getStoreChrome(locale as Locale);
  return (
    <>
      <PageHero title={t("nav.catalog")} compact breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: t("nav.catalog") }]} />
      <section className="container-page mt-5 lg:mt-10">
        <CategoryCircles categories={chrome.menu} />
      </section>
    </>
  );
}
