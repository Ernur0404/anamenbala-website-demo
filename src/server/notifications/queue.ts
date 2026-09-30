/**
 * Очередь уведомлений (Telegram, email) с повторами.
 * Задача «захватывается» арендой (runAfter + 3 мин, FOR UPDATE SKIP LOCKED) — одно и то же
 * сообщение не отправится дважды, даже если очередь обрабатывают after() и cron одновременно.
 */
import { db, type DbClient } from "../db";
import { getSetting } from "../settings";
import { decryptSecret } from "../crypto";
import { sendTelegramMessage } from "./telegram";
import { sendEmail } from "./email";
import type { Prisma } from "@/generated/prisma/client";

export type TelegramPayload = { text: string; buttonUrl?: string | null; buttonText?: string | null };
export type EmailPayload = { to: string; subject: string; html: string; text: string };

export type NotificationInput =
  | { channel: "TELEGRAM"; event: string; payload: TelegramPayload }
  | { channel: "EMAIL"; event: string; payload: EmailPayload };

class PermanentError extends Error {}

const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360];
const MAX_ATTEMPTS = 6;

export async function enqueueNotification(client: DbClient, input: NotificationInput) {
  await client.notificationJob.create({
    data: { channel: input.channel, event: input.event, payload: input.payload as unknown as Prisma.InputJsonValue },
  });
}

async function deliver(channel: string, payload: unknown) {
  if (channel === "TELEGRAM") {
    const settings = await getSetting("notifications");
    if (!settings.telegramBotToken || !settings.telegramChatIds.length) throw new PermanentError("Telegram не настроен");
    let token: string;
    try {
      token = decryptSecret(settings.telegramBotToken);
    } catch {
      throw new PermanentError("Не удалось расшифровать токен Telegram");
    }
    const p = payload as TelegramPayload;
    for (const chatId of settings.telegramChatIds) {
      await sendTelegramMessage(token, chatId, p.text, p.buttonUrl ? { text: p.buttonText ?? "Открыть", url: p.buttonUrl } : undefined);
    }
    return;
  }
  if (channel === "EMAIL") {
    const p = payload as EmailPayload;
    if (!p.to) throw new PermanentError("Нет адреса получателя");
    await sendEmail(p);
    return;
  }
  throw new PermanentError(`Неизвестный канал ${channel}`);
}

export async function processNotificationQueue(limit = 25): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < limit; i++) {
    const claimed = await db.$queryRaw<{ id: string; channel: string; payload: unknown; attempts: number }[]>`
      UPDATE "NotificationJob"
      SET "runAfter" = now() + interval '3 minutes', "attempts" = "attempts" + 1
      WHERE "id" = (
        SELECT "id" FROM "NotificationJob"
        WHERE "status" = 'PENDING' AND "runAfter" <= now()
        ORDER BY "createdAt"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "channel", "payload", "attempts"
    `;
    const job = claimed[0];
    if (!job) break;
    try {
      await deliver(job.channel, job.payload);
      await db.notificationJob.update({ where: { id: job.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      sent++;
    } catch (error) {
      const permanent = error instanceof PermanentError || job.attempts >= MAX_ATTEMPTS;
      const delay = BACKOFF_MINUTES[Math.min(job.attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 60;
      await db.notificationJob.update({
        where: { id: job.id },
        data: {
          status: permanent ? "FAILED" : "PENDING",
          runAfter: new Date(Date.now() + delay * 60_000),
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}

/** Запустить отправку после ответа пользователю (или сразу, если вызов вне запроса) */
export async function kickNotificationQueue() {
  if (process.env.VITEST) return; // в тестах очередь обрабатывается явно
  const run = () => processNotificationQueue().catch((e) => console.error("[notifications]", e));
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    void run();
  }
}
