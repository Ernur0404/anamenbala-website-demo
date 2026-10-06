import type { MetadataRoute } from "next";
import { appUrl } from "@/server/env";

// адрес сайта берётся из окружения при запуске, а не при сборке
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
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
