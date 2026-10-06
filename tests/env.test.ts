import { describe, expect, it } from "vitest";
import { parse } from "pg-connection-string";
import { withLibpqSsl } from "@/server/env";

describe("подключение к базе на хостингах", () => {
  it("sslmode=require в строке Supabase/Neon — шифрование без строгой проверки сертификата (как в libpq)", () => {
    const supabase = "postgres://postgres.ref:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";
    const url = withLibpqSsl(supabase);
    expect(url).toBe(`${supabase}&uselibpqcompat=true`);
    expect(parse(url).ssl).toEqual({ rejectUnauthorized: false });
  });

  it("локальная база, verify-full и уже заданная совместимость не меняются", () => {
    for (const url of [
      "postgresql://postgres:postgres@localhost:5433/ana_men_bala",
      "postgres://u:pw@db.example.kz/shop?sslmode=verify-full",
      "postgres://u:pw@db.example.kz/shop?uselibpqcompat=true&sslmode=require",
    ]) {
      expect(withLibpqSsl(url)).toBe(url);
    }
  });
});
