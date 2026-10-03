import { getImageProps } from "next/image";
import type { ImageData } from "@/server/catalog/cards";

const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Фото, которое скачивается только на своей ширине экрана (блоки «только для телефона» или
 * «только для компьютера»): для другой ширины — пустой источник, поэтому скрытая копия не грузится.
 */
export function ViewportImage({
  image,
  only,
  sizes,
  priority,
  className,
}: {
  image: ImageData;
  only: "mobile" | "desktop";
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const { props } = getImageProps({
    src: image.src,
    alt: image.alt,
    fill: true,
    sizes,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    placeholder: image.blur ? "blur" : "empty",
    blurDataURL: image.blur ?? undefined,
  });
  return (
    <picture>
      <source media={only === "mobile" ? "(min-width: 1024px)" : "(max-width: 1023px)"} srcSet={BLANK} />
      <img {...props} alt={props.alt} className={className} />
    </picture>
  );
}
