import { setRequestLocale } from "next-intl/server";
import { StaticPage, staticPageMetadata } from "@/components/store/static-page";
import type { Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, locale } = await params;
  return staticPageMetadata(slug, locale);
}

/** Страницы, созданные владельцем в админке */
export default async function CustomPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <StaticPage slug={slug} locale={locale as Locale} />;
}
