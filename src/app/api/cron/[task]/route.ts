import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { CRON_TASKS, runCronTask, type CronTask } from "@/server/cron";

export const dynamic = "force-dynamic";

/** Секрет из заголовка Authorization: Bearer <CRON_SECRET> (сравнение за постоянное время); без секрета — отказ */
function authorized(request: Request) {
  const configured = env().CRON_SECRET;
  if (!configured) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const secret = Buffer.from(configured);
  return token.length === secret.length && timingSafeEqual(token, secret);
}

/** Фоновая задача: POST /api/cron/notifications | reprice | cleanup (GET — для Vercel Cron, тот же секрет) */
export async function POST(request: Request, { params }: { params: Promise<{ task: string }> }) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { task } = await params;
  if (!(CRON_TASKS as readonly string[]).includes(task)) return Response.json({ ok: false, error: "unknown task" }, { status: 404 });
  const started = Date.now();
  try {
    const result = await runCronTask(task as CronTask);
    return Response.json({ ok: true, task, ms: Date.now() - started, result });
  } catch (error) {
    console.error(`[cron:${task}]`, error);
    return Response.json({ ok: false, task, error: "failed" }, { status: 500 });
  }
}

export const GET = POST;
