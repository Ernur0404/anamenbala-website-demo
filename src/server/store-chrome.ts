import { getSetting } from "./settings";
import { getCategoryIndex } from "./catalog/categories";
import { getFooterPages } from "./content";
import { toImage } from "./catalog/cards";
import { pickLocale, tr, type Locale } from "@/lib/l10n";
import type { ChromeContacts, MenuCategory } from "@/components/store/chrome-types";

/** Данные «обвязки» витрины: инфо-панель, меню категорий, контакты, страницы подвала */
export async function getStoreChrome(locale: Locale) {
  const [general, contacts, topbar, index, footerPages] = await Promise.all([
    getSetting("general"),
    getSetting("contacts"),
    getSetting("topbar"),
    getCategoryIndex(),
    getFooterPages(),
  ]);

  const menu: MenuCategory[] = (index.children.get(null) ?? [])
    .filter((c) => c.isVisible && c.showInMenu)
    .map((c) => {
      const name = tr(c, "name", locale);
      return {
        id: c.id,
        slug: c.slug,
        name,
        icon: c.icon,
        href: `/catalog/${c.slug}`,
        image: toImage(c.tileImage, name),
        children: (index.children.get(c.id) ?? [])
          .filter((s) => s.isVisible && s.showInMenu)
          .map((s) => {
            const childName = tr(s, "name", locale);
            return { id: s.id, slug: s.slug, name: childName, icon: s.icon, href: `/catalog/${c.slug}/${s.slug}`, image: toImage(s.tileImage, childName) };
          }),
      };
    });

  const chromeContacts: ChromeContacts = {
    phone: contacts.phone,
    whatsapp: contacts.whatsapp,
    email: contacts.email,
    address: pickLocale(contacts.address, locale),
    hours: pickLocale(contacts.hours, locale),
    instagram: contacts.instagram,
    tiktok: contacts.tiktok,
    telegram: contacts.telegram,
  };

  const builtIn = new Set(["about", "delivery", "contacts", "faq", "returns"]);
  return {
    storeName: general.storeName,
    tagline: pickLocale(general.tagline, locale),
    topbar: topbar.items.map((i) => ({ icon: i.icon, text: pickLocale(i.text, locale) })).filter((i) => i.text),
    menu,
    contacts: chromeContacts,
    footerPages: footerPages.filter((p) => !builtIn.has(p.slug)).map((p) => ({ slug: p.slug, title: tr(p, "title", locale) })),
  };
}
