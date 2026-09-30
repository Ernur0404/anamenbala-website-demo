import { hash, verify } from "@node-rs/argon2";

// Argon2id с параметрами OWASP (19 MiB, 2 прохода)
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Минимальные требования: 8+ символов, буква и цифра */
export function passwordProblems(password: string): string | null {
  if (password.length < 8) return "PASSWORD_TOO_SHORT";
  if (!/[\p{L}]/u.test(password) || !/\d/.test(password)) return "PASSWORD_TOO_WEAK";
  return null;
}
