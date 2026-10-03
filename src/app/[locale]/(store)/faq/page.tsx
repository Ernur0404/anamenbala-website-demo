import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFaq, getPage } from "@/server/content";
import { toImage } from "@/server/catalog/cards";
import { PageHero } from "@/components/store/page-hero";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/primitives";
import { tr, trOrNull, type Locale } from "@/lib/l10n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const page = await getPage("faq");
  return { title: page ? tr(page, "title", locale) : "FAQ" };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const [page, faq] = await Promise.all([getPage("faq"), getFaq()]);
  const t = await getTranslations();
  const title = page ? tr(page, "title", locale) : t("nav.faq");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: tr(f, "question", locale), acceptedAnswer: { "@type": "Answer", text: tr(f, "answer", locale) } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero title={title} subtitle={page ? trOrNull(page, "subtitle", locale) : null} image={page ? toImage(page.heroImage, title) : null} compact breadcrumbs={[{ label: t("common.home"), href: "/" }, { label: title }]} />
      <section className="container-page mt-4 lg:mt-8">
        <Accordion type="single" collapsible className="max-w-3xl rounded-xl border border-line bg-white px-5">
          {faq.map((f) => (
            <AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger>{tr(f, "question", locale)}</AccordionTrigger>
              <AccordionContent>{tr(f, "answer", locale)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
