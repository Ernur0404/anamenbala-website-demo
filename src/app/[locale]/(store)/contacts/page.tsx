import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { getPage } from "@/server/content";
import { getSetting } from "@/server/settings";
import { toImage } from "@/server/catalog/cards";
import { PageHero } from "@/components/store/page-hero";
import { TrustRow } from "@/components/store/home/sections";
import { ContactForm } from "@/components/store/contact-form";
import { WhatsAppIcon } from "@/components/ui/icons";
import { formatPhone, telLink, whatsappLink } from "@/lib/phone";
import { pickLocale, tr, trOrNull, type Locale } from "@/lib/l10n";

type L = { ru?: string; kk?: string };
type ContactsContent = { formTitle?: L; formSubtitle?: L; strip?: { icon: string; title: L; text: L }[] };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const page = await getPage("contacts");
  if (!page) return {};
  return { title: trOrNull(page, "seoTitle", locale) ?? tr(page, "title", locale), description: trOrNull(page, "subtitle", locale) ?? undefined };
}

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const [page, contacts] = await Promise.all([getPage("contacts"), getSetting("contacts")]);
  if (!page || !page.isPublished) notFound();
  const t = await getTranslations();
  const content = (page.content ?? {}) as ContactsContent;
  const title = tr(page, "title", locale);

  const cards = [
    contacts.phone && { icon: <Phone className="size-5" />, title: t("pages.phone"), value: formatPhone(contacts.phone), note: pickLocale(contacts.hours, locale), href: telLink(contacts.phone) },
    contacts.whatsapp && { icon: <WhatsAppIcon size={20} />, title: t("pages.whatsapp"), value: formatPhone(contacts.whatsapp), note: t("pages.whatsappNote"), href: whatsappLink(contacts.whatsapp) },
    contacts.email && { icon: <Mail className="size-5" />, title: t("pages.email"), value: contacts.email, note: t("pages.emailNote"), href: `mailto:${contacts.email}` },
    { icon: <MapPin className="size-5" />, title: t("pages.address"), value: pickLocale(contacts.address, locale), note: null, href: contacts.mapLink || null },
  ].filter(Boolean) as { icon: React.ReactNode; title: string; value: string; note: string | null; href: string | null }[];

  return (
    <>
      <PageHero title={title} subtitle={trOrNull(page, "subtitle", locale)} script={trOrNull(page, "script", locale)} image={toImage(page.heroImage, title)} breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: title }]} />

      <section className="container-page mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="heading-section mb-5 text-[32px]">{t("pages.contactUs")}</h2>
          <div className="space-y-3">
            {cards.map((c) => {
              const inner = (
                <>
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sage-700 text-white">{c.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-ink-500">{c.title}</span>
                    <span className="block font-semibold">{c.value}</span>
                    {c.note && <span className="block text-xs text-ink-500">{c.note}</span>}
                  </span>
                </>
              );
              return c.href ? (
                <a key={c.title} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition-shadow hover:shadow-card">
                  {inner}
                </a>
              ) : (
                <div key={c.title} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 sm:p-7">
          <h2 className="heading-section text-[30px]">{pickLocale(content.formTitle, locale) || t("pages.formSend")}</h2>
          {content.formSubtitle && <p className="mt-1 mb-5 text-sm text-ink-500">{pickLocale(content.formSubtitle, locale)}</p>}
          <ContactForm />
        </div>
      </section>

      <section className="container-page mt-12">
        <h2 className="heading-section mb-5 text-[32px]">{t("pages.ourStore")}</h2>
        <div className="grid overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[1.6fr_1fr]">
          <div className="relative min-h-[300px] bg-beige-50">
            {contacts.mapEmbedUrl && <iframe src={contacts.mapEmbedUrl} title={t("pages.ourStore")} className="absolute inset-0 size-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </div>
          <div className="flex flex-col gap-5 p-6">
            <p className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-sage-700" />
              <span className="text-sm leading-relaxed">{pickLocale(contacts.address, locale)}</span>
            </p>
            <p className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-sage-700" />
              <span className="text-sm leading-relaxed">
                <span className="block font-semibold">{t("pages.hours")}</span>
                {pickLocale(contacts.hours, locale)}
              </span>
            </p>
            {contacts.mapLink && (
              <a href={contacts.mapLink} target="_blank" rel="noopener" className="mt-auto inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-sage-700 px-5 text-sm font-semibold text-white hover:bg-sage-800">
                {t("pages.route")}
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      {content.strip && content.strip.length > 0 && (
        <section className="container-page mt-10">
          <TrustRow items={content.strip.map((s) => ({ icon: s.icon, title: pickLocale(s.title, locale), text: pickLocale(s.text, locale) }))} />
        </section>
      )}
    </>
  );
}
