export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isPublicUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !["localhost", "127.0.0.1"].includes(u.hostname);
  } catch {
    return false;
  }
}

/** Отправка сообщения ботом (HTML-разметка Telegram) */
export async function sendTelegramMessage(token: string, chatId: string, text: string, button?: { text: string; url: string }) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, 4000),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  };
  // Telegram принимает в кнопках только публичные https-ссылки
  if (button && isPublicUrl(button.url)) body.reply_markup = { inline_keyboard: [[{ text: button.text, url: button.url }]] };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Telegram ${response.status}: ${details.slice(0, 300)}`);
  }
}

/** Проверка токена и поиск чатов, написавших боту /start (для настройки в админке) */
export async function discoverTelegramChats(token: string): Promise<{ botName: string; chats: { id: string; title: string }[] }> {
  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10_000) });
  if (!me.ok) throw new Error("Неверный токен бота");
  const meJson = (await me.json()) as { result?: { username?: string } };
  const updates = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`, { signal: AbortSignal.timeout(10_000) });
  const updatesJson = (await updates.json()) as {
    result?: Array<{ message?: { chat?: { id: number; title?: string; first_name?: string; last_name?: string; username?: string } } }>;
  };
  const chats = new Map<string, string>();
  for (const update of updatesJson.result ?? []) {
    const chat = update.message?.chat;
    if (!chat) continue;
    const title = chat.title ?? ([chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id));
    chats.set(String(chat.id), title);
  }
  return { botName: meJson.result?.username ?? "", chats: [...chats].map(([id, title]) => ({ id, title })) };
}
