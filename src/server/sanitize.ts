import sanitize from "sanitize-html";

/** Очистка HTML из редактора (описания товаров, страницы): только безопасные теги и ссылки */
export function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "a", "blockquote", "hr", "table", "thead", "tbody", "tr", "th", "td", "span"],
    allowedAttributes: { a: ["href", "target", "rel"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, ...(attribs.href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {}) },
      }),
    },
  });
}
