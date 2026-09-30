import { getStaff } from "@/server/auth/staff";
import { can } from "@/server/permissions";
import { isDomainError } from "@/server/errors";
import { saveImage, saveVideo } from "@/server/media/upload";
import { rateLimit } from "@/server/rate-limit";
import { mediaUrl } from "@/lib/media-url";

export const dynamic = "force-dynamic";

/** Загрузка фото/видео из админки (товары, баннеры, категории, страницы, отзывы, настройки) */
export async function POST(request: Request) {
  const staff = await getStaff();
  if (!staff) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(["products", "catalog", "content", "reviews", "settings"] as const).some((p) => can(staff.role, p))) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!(await rateLimit(`media-upload:${staff.id}`, 300, 60 * 60))) return Response.json({ error: "RATE_LIMITED" }, { status: 429 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "VALIDATION", message: "Нет файла" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = form.get("kind") === "video" ? "video" : "image";
  const alt = typeof form.get("alt") === "string" ? String(form.get("alt")).slice(0, 200) : null;
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "VALIDATION", message: "Нет файла" }, { status: 400 });

  try {
    const media = kind === "video" ? await saveVideo(file) : await saveImage(file, { alt });
    return Response.json({
      id: media.id,
      kind: media.kind,
      url: mediaUrl(media, kind === "video" ? 0 : 640),
      thumbUrl: kind === "video" ? null : mediaUrl(media, 320),
      width: media.width,
      height: media.height,
    });
  } catch (error) {
    if (isDomainError(error)) return Response.json({ error: error.code, message: error.message }, { status: 400 });
    console.error("[upload]", error);
    return Response.json({ error: "INTERNAL" }, { status: 500 });
  }
}
