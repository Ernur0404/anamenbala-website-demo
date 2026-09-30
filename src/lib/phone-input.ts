/** Маска ввода телефона: «+7 777 123 45 67» (клиент и сервер) */
export function formatPhoneInput(raw: string): string {
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (!hasPlus && digits.length === 10) digits = `7${digits}`; // вставили номер без кода страны: 701 123 45 67
  else if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  else if (!digits.startsWith("7")) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const parts = [digits.slice(1, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)].filter(Boolean);
  return `+7 ${parts.join(" ")}`.trimEnd();
}
