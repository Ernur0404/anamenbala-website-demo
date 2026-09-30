import { getSetting } from "@/server/settings";
import { mediaUrl } from "@/lib/media-url";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Браузеры сами запрашивают /favicon.ico — отдаём значок из настроек (или стандартный SVG) */
export async function GET() {
  const general = await getSetting("general");
  const media = general.faviconMediaId ? await db.media.findUnique({ where: { id: general.faviconMediaId } }) : null;
  const target = (media && mediaUrl(media, 320)) || "/favicon.svg";
  return new Response(null, { status: 307, headers: { Location: target, "Cache-Control": "public, max-age=3600" } });
}
