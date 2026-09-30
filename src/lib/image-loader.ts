/**
 * Загрузчик картинок для next/image: загруженные фото уже нарезаны в WebP нужных ширин,
 * внешние (Unsplash/Pexels) ресайзятся параметрами URL. Встроенный оптимизатор не нужен.
 */
import { externalImageUrl, pickWidth } from "./media-url";

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("/uploads/")) {
    return /\/w\d+\.webp$/.test(src) ? src.replace(/\/w\d+\.webp$/, `/w${pickWidth(width)}.webp`) : src;
  }
  if (src.startsWith("http")) return externalImageUrl(src, width, quality ?? 75);
  return src;
}
