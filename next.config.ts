import type { NextConfig } from "next";
import path from "node:path";

// Конфигурация next-intl подключается алиасом напрямую (как это делает next-intl/plugin),
// без плагина: он тянет нативный @swc/core, который нам не нужен.
const I18N_REQUEST_CONFIG = "./src/i18n/request.ts";

/**
 * Content-Security-Policy (только в продакшне: dev-сервер Next использует eval и websocket).
 * Встраивание (iframe): видео YouTube/Instagram у товаров и карты на странице «Контакты».
 * Картинки и видео — с любого https (демо-фото, будущее S3-хранилище).
 */
const FRAME_SOURCES = [
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
  "https://www.instagram.com",
  "https://www.openstreetmap.org",
  "https://*.2gis.com",
  "https://*.2gis.kz",
  "https://yandex.ru",
  "https://*.yandex.ru",
  "https://yandex.kz",
  "https://*.yandex.kz",
  "https://www.google.com",
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  `frame-src 'self' ${FRAME_SOURCES.join(" ")}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "sharp", "exceljs", "embedded-postgres"],
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  turbopack: {
    resolveAlias: { "next-intl/config": I18N_REQUEST_CONFIG },
  },
  webpack(config) {
    config.resolve.alias["next-intl/config"] = path.resolve(I18N_REQUEST_CONFIG);
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
