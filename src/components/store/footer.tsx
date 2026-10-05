import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InstagramIcon, KaspiBadge, TelegramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/icons";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter-form";
import { LanguageSwitcher } from "./language-switcher";
import { whatsappLink } from "@/lib/phone";
import type { ChromeContacts, MenuCategory } from "./chrome-types";

export async function Footer({
  storeName,
  tagline,
  categories,
  contacts,
  extraPages,
}: {
  storeName: string;
  tagline: string;
  categories: MenuCategory[];
  contacts: ChromeContacts;
  extraPages: { slug: string; title: string }[];
}) {
  const t = await getTranslations();
  const socials = [
    contacts.instagram && { href: contacts.instagram, label: "Instagram", icon: <InstagramIcon size={18} /> },
    contacts.tiktok && { href: contacts.tiktok, label: "TikTok", icon: <TikTokIcon size={17} /> },
    contacts.telegram && { href: contacts.telegram, label: "Telegram", icon: <TelegramIcon size={18} /> },
    contacts.whatsapp && { href: whatsappLink(contacts.whatsapp), label: "WhatsApp", icon: <WhatsAppIcon size={18} /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  const col = "space-y-2.5 text-[13.5px] text-ink-600";
  const link = "transition-colors hover:text-sage-700";

  return (
    <footer className="mt-16 border-t border-line bg-white/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.5fr] lg:gap-8">
        <div>
          <Logo name={storeName} tagline={tagline} />
          <div className="mt-6 flex gap-2.5">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener"
                aria-label={s.label}
                className="grid size-9 place-items-center rounded-full border border-line-strong text-ink-600 transition-colors hover:border-sage-600 hover:bg-sage-700 hover:text-white"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold">{t("footer.forCustomers")}</h3>
          <ul className={col}>
            <li><Link className={link} href="/delivery">{t("nav.delivery")}</Link></li>
            <li><Link className={link} href="/faq">{t("nav.faq")}</Link></li>
            <li><Link className={link} href="/contacts">{t("nav.contacts")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold">{t("footer.catalog")}</h3>
          <ul className={col}>
            {categories.map((c) => (
              <li key={c.id}><Link className={link} href={c.href}>{c.name}</Link></li>
            ))}
            <li><Link className="text-powder-700 transition-colors hover:text-powder-800" href="/sale">{t("nav.sale")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold">{t("footer.about")}</h3>
          <ul className={col}>
            <li><Link className={link} href="/about">{t("footer.aboutUs")}</Link></li>
            <li><Link className={link} href="/reviews">{t("footer.reviews")}</Link></li>
            {extraPages.map((p) => (
              <li key={p.slug}><Link className={link} href={`/p/${p.slug}`}>{p.title}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold">{t("footer.newsletterTitle")}</h3>
          <NewsletterForm />
          <div className="mt-6 flex items-center gap-3">
            <span className="text-xs font-semibold text-ink-500">{t("nav.language")}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-2" aria-label={t("footer.payments")}>
            <KaspiBadge label="Kaspi" />
            <KaspiBadge label="Kaspi QR" />
          </div>
        </div>
      </div>
    </footer>
  );
}
