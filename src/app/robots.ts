import type { MetadataRoute } from "next";

// адрес сайта берётся из окружения при запуске, а не при сборке
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/cart", "/checkout", "/account", "/order", "/search", "/kk/cart", "/kk/checkout", "/kk/account", "/kk/order", "/kk/search"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
