/**
 * Раздача загруженных файлов из локального хранилища (в продакшне их отдаёт Caddy напрямую).
 * Поддерживает Range-запросы для видео.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ico": "image/x-icon",
};

function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./storage/uploads");
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const root = uploadRoot();
  const filePath = path.resolve(root, ...parts);
  if (!filePath.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });

  let info;
  try {
    info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const type = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  if (type === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'";

  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      if (start >= info.size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      }
      const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
      return new Response(stream, {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(info.size) } });
}
