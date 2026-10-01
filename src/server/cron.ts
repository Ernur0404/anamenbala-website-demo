/**
 * Фоновые задачи. Запускаются cron-контейнером через /api/cron/<задача> (см. deploy/):
 *   notifications — каждую минуту: отправка и повтор уведомлений (Telegram, email)
 *   reprice       — каждые 5 минут: начало/конец акций и акционных цен → цены в каталоге
 *   cleanup       — раз в сутки: просроченные сессии, токены, лимиты, старые корзины, «осиротевшие» фото
 */
import { db } from "./db";
import { CacheTags, invalidateTags } from "./cache";
import { getSetting } from "./settings";
import { repriceAllProducts } from "./catalog/indexer";
import { processNotificationQueue } from "./notifications/queue";
import { purgeStaleCarts } from "./cart";
import { purgeExpiredRateLimits } from "./rate-limit";
import { deleteMedia } from "./media/upload";

const DAY = 86_400_000;

export const CRON_TASKS = ["notifications", "reprice", "cleanup"] as const;
export type CronTask = (typeof CRON_TASKS)[number];

export async function runNotifications() {
  return processNotificationQueue(50);
}

export async function runReprice() {
  const changed = await repriceAllProducts();
  // изменились цены — сбросить кэш витрины (листинги, подборки главной)
  if (changed > 0) invalidateTags(CacheTags.catalog, CacheTags.promotions);
  return { changed };
}

/** Фото, которые загрузили, но так и не привязали ни к чему (старше суток) */
async function purgeOrphanMedia(now: Date) {
  const [general, seo] = await Promise.all([getSetting("general"), getSetting("seo")]);
  const keep = [general.logoMediaId, general.faviconMediaId, seo.ogImageMediaId].filter((id): id is string => Boolean(id));
  const orphans = await db.media.findMany({
    where: {
      createdAt: { lt: new Date(now.getTime() - DAY) },
      isDemo: false,
      id: { notIn: keep },
      productMedia: { none: {} },
      productVideos: { none: {} },
      categoryHero: { none: {} },
      categoryHeroMobile: { none: {} },
      categoryTile: { none: {} },
      bannerImages: { none: {} },
      bannerMobileImages: { none: {} },
      pageHeroes: { none: {} },
      instagramPosts: { none: {} },
      reviewPhotos: { none: {} },
      brandLogos: { none: {} },
    },
    select: { id: true },
    take: 500,
  });
  for (const m of orphans) await deleteMedia(m.id);
  return orphans.length;
}

export async function runCleanup(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const [staffSessions, userSessions, tokens, jobs, searchLogs] = await Promise.all([
    db.staffSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.userSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.userToken.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(1) } }, { usedAt: { lt: ago(7) } }] } }),
    db.notificationJob.deleteMany({ where: { OR: [{ status: "SENT", createdAt: { lt: ago(30) } }, { status: "FAILED", createdAt: { lt: ago(90) } }] } }),
    // «Популярные запросы» считаются за 30 дней; журнал храним год
    db.searchLog.deleteMany({ where: { createdAt: { lt: ago(365) } } }),
  ]);
  await purgeExpiredRateLimits();
  await purgeStaleCarts(60);
  const media = await purgeOrphanMedia(now);
  return { staffSessions: staffSessions.count, userSessions: userSessions.count, tokens: tokens.count, notificationJobs: jobs.count, searchLogs: searchLogs.count, orphanMedia: media };
}

export async function runCronTask(task: CronTask) {
  switch (task) {
    case "notifications":
      return runNotifications();
    case "reprice":
      return runReprice();
    case "cleanup":
      return runCleanup();
  }
}
