/** Контрольная цифра EAN-13 для 12 цифр */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/**
 * Внутренний штрихкод магазина (EAN-13 с префиксом 21 — диапазон 20–29 зарезервирован для
 * внутреннего использования, с кодами производителей не пересекается). Для товаров без штрихкода.
 */
export function internalEan13(): string {
  const digits = new Uint8Array(10);
  globalThis.crypto.getRandomValues(digits);
  const body = `21${Array.from(digits, (d) => d % 10).join("")}`;
  return `${body}${ean13CheckDigit(body)}`;
}
