import { describe, expect, it } from "vitest";
import { addOrderToken, countUnread, FIRST_VISIT_DAYS, noticeDate, parseOrderTokens, parseSeenCookie, weekStartKey } from "@/lib/notifications";

const DAY = 86_400_000;
const token = (n: number) => `tok${String(n).padStart(2, "0")}_abcdefghijklmnopqrstuv`;

describe("уведомления покупателя", () => {
  it("новинки группируются по неделям с понедельника", () => {
    expect(weekStartKey("2026-10-05")).toBe("2026-10-05"); // понедельник
    expect(weekStartKey("2026-10-04")).toBe("2026-09-28"); // воскресенье — прошлая неделя
    expect(weekStartKey("2026-10-01")).toBe("2026-09-28");
    expect(weekStartKey("2026-01-01")).toBe("2025-12-29"); // через границу года
  });

  it("непрочитанные — новее последнего просмотра, новому посетителю — за последние дни", () => {
    const now = Date.UTC(2026, 9, 5, 12);
    const dates = [new Date(now - 1000), new Date(now - 2 * DAY), new Date(now - (FIRST_VISIT_DAYS + 1) * DAY), new Date(now + DAY)];
    expect(countUnread(dates, now - 3 * DAY, now)).toBe(2);
    expect(countUnread(dates, now, now)).toBe(0);
    // без cookie: старше FIRST_VISIT_DAYS и «будущие» не считаются
    expect(countUnread(dates, null, now)).toBe(2);
  });

  it("дата объявления — начало показа, но не раньше создания", () => {
    const created = new Date("2026-10-05T10:00:00Z");
    expect(noticeDate(null, created)).toEqual(created);
    expect(noticeDate(new Date("2026-10-04T19:00:00Z"), created)).toEqual(created);
    expect(noticeDate(new Date("2026-10-10T19:00:00Z"), created)).toEqual(new Date("2026-10-10T19:00:00Z"));
  });

  it("cookie просмотра: только число", () => {
    expect(parseSeenCookie("1791211301472")).toBe(1791211301472);
    expect(parseSeenCookie("abc")).toBeNull();
    expect(parseSeenCookie(undefined)).toBeNull();
    expect(parseSeenCookie("1e12")).toBeNull();
  });

  it("гостевые заказы: новые первыми, без повторов и мусора, не больше 10", () => {
    let value: string | undefined;
    for (let i = 1; i <= 12; i++) value = addOrderToken(value, token(i));
    const tokens = parseOrderTokens(value);
    expect(tokens).toHaveLength(10);
    expect(tokens[0]).toBe(token(12));
    expect(parseOrderTokens(addOrderToken(value, token(5)))[0]).toBe(token(5));
    expect(new Set(parseOrderTokens(addOrderToken(value, token(12)))).size).toBe(10);
    expect(parseOrderTokens("bad token.<script>." + token(1))).toEqual([token(1)]);
  });
});
