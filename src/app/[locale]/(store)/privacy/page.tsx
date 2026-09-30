import { setRequestLocale } from "next-intl/server";
import { StaticPage, staticPageMetadata } from "@/components/store/static-page";
import type { Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return staticPageMetadata("privacy", (await params).locale);
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StaticPage slug="privacy" locale={locale as Locale} />;
}
