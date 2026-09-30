import type { Prisma } from "@/generated/prisma/client";

/** Поля медиа, нужные для вывода картинки */
export const mediaSelect = {
  id: true,
  kind: true,
  storageKey: true,
  externalUrl: true,
  mime: true,
  width: true,
  height: true,
  blurDataUrl: true,
  altRu: true,
  altKk: true,
} satisfies Prisma.MediaSelect;

export type MediaRef = Prisma.MediaGetPayload<{ select: typeof mediaSelect }>;
