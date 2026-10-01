"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck, KeyRound, Mail, Plus, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/display";
import { TelegramIcon } from "@/components/ui/icons";
import { Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { discoverChatsAction, saveNotificationsAction, testTelegramAction } from "@/server/actions/admin/settings";

type Events = { newOrder: boolean; newReview: boolean; lowStock: boolean; contactMessage: boolean };
type CustomerEmails = { orderCreated: boolean; statusChanged: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHAT_RE = /^-?\d{3,20}$/;

export function NotificationsForm({
  initial,
  smtp,
}: {
  initial: { tokenSet: boolean; chatIds: string[]; events: Events; customerEmails: CustomerEmails; adminEmails: string };
  smtp: boolean;
}) {
  const t = useTranslations("admin.settings.notifications");
  const ts = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute, fieldError } = useAdminAction();

  const [tokenSet, setTokenSet] = useState(initial.tokenSet);
  const [replacing, setReplacing] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [chatIds, setChatIds] = useState(initial.chatIds);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [found, setFound] = useState<{ botName: string; chats: { id: string; title: string }[] } | null>(null);
  const [manualId, setManualId] = useState("");
  const [events, setEvents] = useState(initial.events);
  const [customerEmails, setCustomerEmails] = useState(initial.customerEmails);
  const [adminEmails, setAdminEmails] = useState(initial.adminEmails);

  const showTokenInput = !tokenSet || replacing;
  const emails = adminEmails.split(/[\s,;]+/).filter(Boolean);

  /** Сохранить; true — успешно */
  const save = (options: { clearToken?: boolean; quiet?: boolean } = {}) => {
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) {
      toast.error(t("emailsInvalid", { emails: invalid.join(", ") }));
      return Promise.resolve(false);
    }
    return execute(
      () =>
        saveNotificationsAction({
          newToken: showTokenInput ? newToken.trim() || null : null,
          clearToken: Boolean(options.clearToken),
          telegramChatIds: chatIds,
          events,
          customerEmails,
          adminEmails: [...new Set(emails.map((e) => e.toLowerCase()))],
        }),
      {
        success: options.quiet ? false : ts("saved"),
        errorMessage: (f) => (f.fieldErrors?.newToken ? t("tokenInvalid") : undefined),
        onSuccess: () => {
          if (options.clearToken) setTokenSet(false);
          else if (showTokenInput && newToken.trim()) setTokenSet(true);
          setNewToken("");
          setReplacing(false);
        },
      },
    ).then((r) => Boolean(r?.ok));
  };

  const discover = () =>
    execute(() => discoverChatsAction({ token: showTokenInput ? newToken.trim() || null : null }), {
      success: false,
      errorMessage: (f) => (f.details?.reason === "token" ? t("tokenInvalid") : undefined),
      onSuccess: (result) => {
        setFound(result);
        setTitles((prev) => ({ ...prev, ...Object.fromEntries(result.chats.map((c) => [c.id, c.title])) }));
        if (!result.chats.length) toast.info(t("discoverEmpty"));
      },
    });

  const test = async () => {
    if (!(await save({ quiet: true }))) return;
    await execute(() => testTelegramAction({}), {
      success: t("testSent"),
      errorMessage: (f) => (f.details?.reason === "telegram" ? t("testFailed", { error: f.error }) : f.details?.reason === "noChats" ? t("noChats") : undefined),
    });
  };

  const addChat = (id: string) => setChatIds((ids) => (ids.includes(id) || ids.length >= 10 ? ids : [...ids, id]));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Panel
        title={
          <span className="flex items-center gap-2.5">
            <TelegramIcon size={22} className="text-[#2AABEE]" />
            {t("telegram")}
          </span>
        }
        subtitle={t("telegramHint")}
        serif
        action={<StatusPill tone={tokenSet && chatIds.length ? "sage" : "gray"} dot>{tokenSet && chatIds.length ? t("connected") : t("notConnected")}</StatusPill>}
      >
        <div className="space-y-5">
          <p className="rounded-lg bg-beige-50 px-4 py-3 text-[13px] leading-relaxed text-ink-600">{t("howTo")}</p>

          {/* токен */}
          <div>
            {showTokenInput ? (
              <Field label={t("token")} error={fieldError("newToken")}>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value.trim())}
                    placeholder={t("tokenPlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 font-mono text-[13px]"
                  />
                  {replacing && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setReplacing(false);
                        setNewToken("");
                      }}
                    >
                      {tc("cancel")}
                    </Button>
                  )}
                </div>
              </Field>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-sage-50/60 px-3.5 py-2.5 text-[13px] font-medium text-sage-800">
                  <KeyRound className="size-4" />
                  {t("tokenSet")}
                  <span className="font-mono tracking-widest text-ink-400">••••••••</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}>
                  {t("replaceToken")}
                </Button>
                <ConfirmButton title={t("removeTokenTitle")} text={t("removeTokenText")} confirmLabel={t("removeToken")} size="sm" onConfirm={() => save({ clearToken: true })}>
                  {t("removeToken")}
                </ConfirmButton>
              </div>
            )}
          </div>

          {/* чаты */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-graphite">{t("chats")}</p>
              <Button variant="secondary" size="sm" onClick={() => void discover()} disabled={pending || (showTokenInput && !newToken.trim())}>
                <Search />
                {t("discover")}
              </Button>
            </div>
            {chatIds.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-[13px] text-ink-500">{t("noChats")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {chatIds.map((id) => (
                  <li key={id} className="inline-flex items-center gap-2 rounded-full border border-sage-200 bg-sage-50 py-1 pr-1 pl-3 text-[13px] text-sage-900">
                    {titles[id] ? (
                      <>
                        <span className="font-semibold">{titles[id]}</span>
                        <span className="font-mono text-[11.5px] text-ink-500">{id}</span>
                      </>
                    ) : (
                      <span className="font-mono">{id}</span>
                    )}
                    <button type="button" className="grid size-6 place-items-center rounded-full text-ink-500 hover:bg-white hover:text-powder-800" onClick={() => setChatIds(chatIds.filter((x) => x !== id))} aria-label={tc("remove")}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {found && found.chats.length > 0 && (
              <div className="mt-3 rounded-lg border border-line p-3">
                <p className="mb-2 text-[12.5px] font-medium text-ink-600">
                  {t("found")} · {t("bot", { name: `@${found.botName}` })}
                </p>
                <ul className="space-y-1.5">
                  {found.chats.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span>
                        <span className="font-semibold text-graphite">{c.title}</span> <span className="font-mono text-[12px] text-ink-500">{c.id}</span>
                      </span>
                      {chatIds.includes(c.id) ? (
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-sage-700">
                          <CircleCheck className="size-4" />
                          {t("added")}
                        </span>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => addChat(c.id)}>
                          <Plus />
                          {t("add")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex max-w-md gap-2">
              <Input value={manualId} onChange={(e) => setManualId(e.target.value.replace(/[^\d-]/g, ""))} placeholder={t("chatId")} inputMode="numeric" aria-label={t("chatId")} />
              <Button
                variant="secondary"
                disabled={!CHAT_RE.test(manualId)}
                onClick={() => {
                  addChat(manualId);
                  setManualId("");
                }}
              >
                {t("addChat")}
              </Button>
            </div>
          </div>

          {/* события */}
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-graphite">{t("events")}</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(Object.keys(events) as (keyof Events)[]).map((key) => (
                <Checkbox key={key} label={t(`eventsList.${key}`)} checked={events[key]} onChange={(e) => setEvents({ ...events, [key]: e.target.checked })} />
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => void test()} disabled={pending || (!tokenSet && !newToken.trim()) || chatIds.length === 0}>
              <Send />
              {t("test")}
            </Button>
            <p className="text-[12.5px] text-ink-500">{t("testHint")}</p>
          </div>
        </div>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-2.5">
            <Mail className="size-5 text-sage-700" />
            {t("customerEmails")}
          </span>
        }
        subtitle={t("customerEmailsHint")}
        serif
        action={
          <StatusPill tone={smtp ? "sage" : "amber"} dot className="whitespace-normal">
            {smtp ? t("smtpOk") : t("smtpMissing")}
          </StatusPill>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(Object.keys(customerEmails) as (keyof CustomerEmails)[]).map((key) => (
              <Checkbox key={key} label={t(`emailsList.${key}`)} checked={customerEmails[key]} onChange={(e) => setCustomerEmails({ ...customerEmails, [key]: e.target.checked })} />
            ))}
          </div>
          <Field label={t("adminEmails")} hint={t("adminEmailsHint")}>
            <Input value={adminEmails} onChange={(e) => setAdminEmails(e.target.value)} placeholder="owner@example.kz" maxLength={500} />
          </Field>
        </div>
      </Panel>

      <Button type="submit" loading={pending}>
        {tc("save")}
      </Button>
    </form>
  );
}
