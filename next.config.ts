import type { NextConfig } from "next";
import path from "node:path";

// Конфигурация next-intl подключается алиасом напрямую (как это делает next-intl/plugin),
// без плагина: он тянет нативный @swc/core, который нам не нужен.
const I18N_REQUEST_CONFIG = "./src/i18n/request.ts";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
