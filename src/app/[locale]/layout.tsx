import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { getSetting } from "@/server/settings";
import { pickLocale } from "@/lib/l10n";
import { mediaUrl } from "@/lib/media-url";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import "../globals.css";

export const viewport: Viewport = {
  themeColor: "#faf8f3",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [seo, general] = await Promise.all([getSetting("seo"), getSetting("general")]);
  const title = pickLocale(seo.title, locale);
  const description = pickLocale(seo.description, locale);
  const [ogImage, favicon] = await Promise.all([
    seo.ogImageMediaId ? db.media.findUnique({ where: { id: seo.ogImageMediaId } }) : null,
    general.faviconMediaId ? db.media.findUnique({ where: { id: general.faviconMediaId } }) : null,
  ]);
  return {
    metadataBase: new URL(appUrl()),
    title: { default: title, template: `%s — ${general.storeName}` },
    description,
    keywords: pickLocale(seo.keywords, locale),
    openGraph: {
      type: "website",
      siteName: general.storeName,
      locale: locale === "kk" ? "kk_KZ" : "ru_RU",
      title,
      description,
      images: ogImage ? [{ url: mediaUrl(ogImage, 1280)! }] : undefined,
    },
    icons: favicon ? { icon: mediaUrl(favicon, 320)! } : { icon: "/favicon.svg" },
    alternates: { languages: { ru: "/", kk: "/kk" } },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { admin: _admin, ...messages } = (await getMessages()) as Record<string, unknown>;
  void _admin;

  return (
    <html lang={locale} className={fontVariables} data-scroll-behavior="smooth">
      <body>
        <NextIntlClientProvider messages={messages as never}>{children}</NextIntlClientProvider>
        <Toaster
          position="top-center"
          offset={16}
          toastOptions={{
            classNames: {
              toast: "!rounded-lg !border-line !bg-white !font-sans !text-graphite !shadow-pop",
              title: "!text-sm !font-semibold",
              actionButton: "!bg-sage-700 !text-white !rounded-md !font-semibold",
              success: "[&_[data-icon]]:!text-sage-700",
              error: "[&_[data-icon]]:!text-powder-700",
            },
          }}
        />
      </body>
    </html>
  );
}
