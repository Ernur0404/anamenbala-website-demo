/** Ширины WebP-вариантов, которые создаются при загрузке фото */
export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const;

export type MediaLike = {
  storageKey?: string | null;
  externalUrl?: string | null;
  kind?: string | null;
  mime?: string | null;
};

export function pickWidth(requested: number): number {
  return IMAGE_WIDTHS.find((w) => w >= requested) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

/** URL картинки нужной ширины (локальный вариант или внешний источник) */
export function mediaUrl(media: MediaLike | null | undefined, width = 960): string | null {
  if (!media) return null;
  if (media.externalUrl) return externalImageUrl(media.externalUrl, width);
  if (!media.storageKey) return null;
  if (media.kind === "VIDEO") return `/uploads/${media.storageKey}`;
  return `/uploads/${media.storageKey}/w${pickWidth(width)}.webp`;
}

/** Unsplash / Pexels поддерживают ресайз параметрами URL */
export function externalImageUrl(url: string, width: number, quality = 75): string {
  try {
    const u = new URL(url);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", String(quality));
      u.searchParams.set("auto", "format");
      if (!u.searchParams.has("fit")) u.searchParams.set("fit", "crop");
      return u.toString();
    }
    if (u.hostname === "images.pexels.com") {
      u.searchParams.set("auto", "compress");
      u.searchParams.set("cs", "tinysrgb");
      u.searchParams.set("w", String(width));
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/** Ссылка на видео: YouTube / Instagram → embed, файл → прямой URL */
export function videoEmbedUrl(url: string): { type: "youtube" | "instagram" | "file"; src: string } {
  try {
    const u = new URL(url, "https://local");
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      return { type: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === "youtu.be") return { type: "youtube", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
    if (host === "instagram.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "reel" || p === "p");
      if (idx >= 0 && parts[idx + 1]) return { type: "instagram", src: `https://www.instagram.com/${parts[idx]}/${parts[idx + 1]}/embed` };
    }
  } catch {
    // ignore
  }
  return { type: "file", src: url };
}
