import { setRequestLocale } from "next-intl/server";
import { StaticPage, staticPageMetadata } from "@/components/store/static-page";
import type { Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return staticPageMetadata("returns", (await params).locale);
}

export default async function ReturnsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StaticPage slug="returns" locale={locale as Locale} />;
}
