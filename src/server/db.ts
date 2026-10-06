import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { databaseUrl } from "./env";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: databaseUrl() });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = db;

/** Клиент внутри транзакции */
export type Tx = Prisma.TransactionClient;
/** Обычный клиент или транзакция */
export type DbClient = PrismaClient | Tx;

/** Транзакция с уровнем изоляции по умолчанию и разумным таймаутом */
export function transaction<T>(fn: (tx: Tx) => Promise<T>, options?: { timeout?: number }): Promise<T> {
  return db.$transaction(fn, { timeout: options?.timeout ?? 20_000, maxWait: 10_000 });
}
