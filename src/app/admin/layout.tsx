import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.common");
  const title = `${t("panel")} — ${t("appName")}`;
  return {
    title: { default: title, template: `%s — ${t("panel")}` },
    robots: { index: false, follow: false },
    icons: { icon: "/favicon.svg" },
  };
}

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = (await getMessages()) as Record<string, unknown>;
  return (
    <html lang={locale} className={fontVariables} data-scroll-behavior="smooth">
      <body>
        <NextIntlClientProvider locale={locale} messages={{ admin: messages.admin, common: messages.common } as never}>
          {children}
        </NextIntlClientProvider>
        <Toaster
          position="top-center"
          offset={16}
          toastOptions={{
            classNames: {
              toast: "!rounded-lg !border-line !bg-white !font-sans !text-graphite !shadow-pop",
              title: "!text-sm !font-semibold",
              success: "[&_[data-icon]]:!text-sage-700",
              error: "[&_[data-icon]]:!text-powder-700",
            },
          }}
        />
      </body>
    </html>
  );
}
