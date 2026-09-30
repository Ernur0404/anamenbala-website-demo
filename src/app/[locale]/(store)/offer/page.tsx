import { setRequestLocale } from "next-intl/server";
import { StaticPage, staticPageMetadata } from "@/components/store/static-page";
import type { Locale } from "@/lib/l10n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return staticPageMetadata("offer", (await params).locale);
}

export default async function OfferPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StaticPage slug="offer" locale={locale as Locale} />;
}
