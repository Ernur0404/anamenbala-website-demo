/**
 * Загрузка медиа: фото проверяются по содержимому, поворачиваются по EXIF, метаданные (включая GPS)
 * удаляются, создаются WebP-варианты нужных ширин и крошечная размытая заглушка.
 */
import sharp, { type Metadata } from "sharp";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { DomainError } from "../errors";
import { storage } from "./storage";
import { IMAGE_WIDTHS } from "@/lib/media-url";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

function newKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

async function toBuffer(file: File | Buffer): Promise<Buffer> {
  return Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());
}

export async function saveImage(file: File | Buffer, options: { alt?: string | null; isDemo?: boolean; maxWidth?: number } = {}) {
  const buffer = await toBuffer(file);
  if (buffer.length > MAX_IMAGE_BYTES) throw new DomainError("VALIDATION", "Файл слишком большой (до 15 МБ)");

  let meta: Metadata;
  try {
    meta = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    throw new DomainError("VALIDATION", "Файл не является изображением");
  }
  if (!meta.format || !IMAGE_FORMATS.has(meta.format)) throw new DomainError("VALIDATION", "Формат изображения не поддерживается");

  const base = sharp(buffer, { failOn: "error" }).rotate(); // поворот по EXIF; метаданные не копируются
  const oriented = await base.clone().toBuffer({ resolveWithObject: true });
  const width = oriented.info.width;
  const height = oriented.info.height;

  const key = newKey();
  const widths: number[] = [];
  const limit = options.maxWidth ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
  for (const w of IMAGE_WIDTHS) {
    // все стандартные ширины создаются всегда (без увеличения) — загрузчику не нужно знать исходный размер
    const target = Math.min(w, limit);
    const output = await sharp(oriented.data).resize({ width: target, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    await storage().put(`${key}/w${w}.webp`, output);
    widths.push(w);
  }
  const blur = await sharp(oriented.data).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();

  return db.media.create({
    data: {
      kind: "IMAGE",
      storageKey: key,
      mime: "image/webp",
      width,
      height,
      sizeBytes: buffer.length,
      widths,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
      altRu: options.alt ?? null,
      isDemo: options.isDemo ?? false,
    },
  });
}

const VIDEO_SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "mp4", mime: "video/mp4", test: (b) => b.subarray(4, 8).toString("ascii") === "ftyp" },
  { ext: "webm", mime: "video/webm", test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
];

export async function saveVideo(file: File | Buffer, options: { isDemo?: boolean } = {}) {
  const buffer = await toBuffer(file);
  if (buffer.length > MAX_VIDEO_BYTES) throw new DomainError("VALIDATION", "Видео слишком большое (до 100 МБ)");
  const kind = VIDEO_SIGNATURES.find((s) => s.test(buffer));
  if (!kind) throw new DomainError("VALIDATION", "Поддерживаются видео MP4 и WebM");
  const key = `${newKey()}/video.${kind.ext}`;
  await storage().put(key, buffer);
  return db.media.create({
    data: { kind: "VIDEO", storageKey: key, mime: kind.mime, sizeBytes: buffer.length, widths: [], isDemo: options.isDemo ?? false },
  });
}

/** Внешняя картинка по ссылке (демо-фото Unsplash) — без скачивания */
export async function registerExternalImage(url: string, options: { alt?: string | null; width?: number; height?: number; isDemo?: boolean } = {}) {
  return db.media.create({
    data: { kind: "IMAGE", externalUrl: url, width: options.width ?? null, height: options.height ?? null, widths: [], altRu: options.alt ?? null, isDemo: options.isDemo ?? false },
  });
}

/** Удалить медиа (запись и файлы) */
export async function deleteMedia(mediaId: string) {
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media) return;
  await db.media.delete({ where: { id: mediaId } });
  if (media.storageKey) {
    const prefix = media.kind === "VIDEO" ? media.storageKey.split("/").slice(0, -1).join("/") : media.storageKey;
    await storage().removePrefix(prefix).catch((e) => console.error("[media] не удалось удалить файлы", e));
  }
}
