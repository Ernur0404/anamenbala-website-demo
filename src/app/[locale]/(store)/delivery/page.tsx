import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, Truck, Wallet } from "lucide-react";
import { getDeliveryMethods, getFaq, getPage, getPaymentMethods } from "@/server/content";
import { toImage } from "@/server/catalog/cards";
import { PageHero } from "@/components/store/page-hero";
import { TrustRow } from "@/components/store/home/sections";
import { DynamicIcon, KaspiMark } from "@/components/ui/icons";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { pickLocale, tr, trOrNull, type Locale } from "@/lib/l10n";

type L = { ru?: string; kk?: string };
type DeliveryContent = { deliverySubtitle?: L; paymentSubtitle?: L; strip?: { icon: string; title: L; text: L }[] };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const page = await getPage("delivery");
  if (!page) return {};
  return { title: trOrNull(page, "seoTitle", locale) ?? tr(page, "title", locale), description: trOrNull(page, "subtitle", locale) ?? undefined };
}

export default async function DeliveryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const [page, deliveries, payments, faq] = await Promise.all([getPage("delivery"), getDeliveryMethods(), getPaymentMethods(), getFaq(true)]);
  if (!page || !page.isPublished) notFound();
  const t = await getTranslations();
  const content = (page.content ?? {}) as DeliveryContent;
  const title = tr(page, "title", locale);

  return (
    <>
      <PageHero title={title} subtitle={trOrNull(page, "subtitle", locale)} script={trOrNull(page, "script", locale)} image={toImage(page.heroImage, title)} breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: title }]} />

      <section className="container-page mt-4 lg:mt-10">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-sage-100 text-sage-700">
            <Truck className="size-5" />
          </span>
          <div>
            <h2 className="heading-section text-[32px]">{t("pages.deliveryTitle")}</h2>
            {content.deliverySubtitle && <p className="text-sm text-ink-500">{pickLocale(content.deliverySubtitle, locale)}</p>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {deliveries.map((d) => (
            <article key={d.id} className="flex flex-col rounded-xl border border-line bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-beige-50 text-sage-700">
                  <DynamicIcon name={d.icon ?? "truck"} className="size-5" />
                </span>
                <div>
                  <h3 className="font-bold">{tr(d, "name", locale)}</h3>
                  {trOrNull(d, "description", locale) && <p className="mt-1 text-sm text-ink-600">{tr(d, "description", locale)}</p>}
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                {trOrNull(d, "eta", locale) && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">{t("pages.term")}</dt>
                    <dd className="font-semibold">{tr(d, "eta", locale)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">{t("pages.cost")}</dt>
                  <dd className="font-semibold">{d.price > 0 ? t("pages.costFrom", { amount: formatMoney(d.price) }) : t("pages.free")}</dd>
                </div>
              </dl>
              <div className="mt-auto pt-4">
                {d.kind === "PICKUP" ? (
                  <p className="rounded-md bg-beige-50 px-3 py-2.5 text-center text-sm font-semibold">{trOrNull(d, "address", locale) ?? t("pages.pickupAddress")}</p>
                ) : d.freeFrom ? (
                  <p className="rounded-md bg-sage-700 px-3 py-2.5 text-center text-sm font-semibold text-white">{t("pages.freeFrom", { amount: formatMoney(d.freeFrom) })}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page mt-12">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-sage-100 text-sage-700">
            <CreditCard className="size-5" />
          </span>
          <div>
            <h2 className="heading-section text-[32px]">{t("pages.paymentTitle")}</h2>
            {content.paymentSubtitle && <p className="text-sm text-ink-500">{pickLocale(content.paymentSubtitle, locale)}</p>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {payments.map((p) => (
            <article key={p.id} className="rounded-xl border border-line bg-white p-5">
              <span className="grid size-11 place-items-center rounded-lg bg-beige-50 text-sage-700">{p.kind === "KASPI" ? <KaspiMark /> : <Wallet className="size-5" />}</span>
              <h3 className="mt-3 font-bold">{tr(p, "name", locale)}</h3>
              {trOrNull(p, "description", locale) && <p className="mt-1 text-sm text-ink-600">{tr(p, "description", locale)}</p>}
            </article>
          ))}
        </div>
      </section>

      {content.strip && content.strip.length > 0 && (
        <section className="container-page mt-10">
          <TrustRow items={content.strip.map((s) => ({ icon: s.icon, title: pickLocale(s.title, locale), text: pickLocale(s.text, locale) }))} />
        </section>
      )}

      {faq.length > 0 && (
        <section className="container-page mt-12">
          <h2 className="heading-section mb-4 text-[32px]">{t("pages.faqTitle")}</h2>
          <Accordion type="single" collapsible className="rounded-xl border border-line bg-white px-5">
            {faq.map((f) => (
              <AccordionItem key={f.id} value={f.id}>
                <AccordionTrigger>{tr(f, "question", locale)}</AccordionTrigger>
                <AccordionContent>{tr(f, "answer", locale)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}
    </>
  );
}
