import { db } from "./db";
import { cached, CacheTags } from "./cache";

/** Популярные запросы за 30 дней (только те, по которым что-то нашлось) */
export async function getPopularQueries(limit = 8): Promise<string[]> {
  return cached(`search:popular:${limit}`, [CacheTags.catalog], 30 * 60_000, async () => {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await db.searchLog.groupBy({
      by: ["normalized"],
      where: { createdAt: { gte: since }, resultsCount: { gt: 0 }, normalized: { not: "" } },
      _count: { _all: true },
      orderBy: { _count: { normalized: "desc" } },
      take: limit,
    });
    return rows.map((r) => r.normalized);
  });
}
