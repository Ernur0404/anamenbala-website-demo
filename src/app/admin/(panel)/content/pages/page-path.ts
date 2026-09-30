/** Адрес страницы на сайте */
export function pagePath(page: { slug: string; template: string }) {
  const builtIn: Record<string, string> = { about: "/about", delivery: "/delivery", contacts: "/contacts", faq: "/faq", returns: "/returns", privacy: "/privacy", offer: "/offer", catalog: "/catalog", sale: "/sale", search: "/search", checkout: "/checkout", favorites: "/favorites", account: "/account", cart: "/cart" };
  return builtIn[page.slug] ?? `/p/${page.slug}`;
}
