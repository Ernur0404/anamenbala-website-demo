"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Laptop, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/display";
import { Panel } from "@/components/admin/ui";
import { useAdminAction } from "@/components/admin/use-action";
import {
  changeStaffPasswordAction,
  confirmTwoFactorAction,
  disableTwoFactorAction,
  endStaffSessionAction,
  setStaffLocaleAction,
  startTwoFactorAction,
  updateStaffProfileAction,
} from "@/server/actions/admin/profile";
import { formatDateTime } from "@/lib/dates";
import { describeUserAgent } from "@/lib/user-agent";
import { cn } from "@/lib/utils";

type Staff = { name: string; email: string; role: "OWNER" | "MANAGER"; locale: string; totpEnabled: boolean };
type Session = { id: string; ip: string | null; userAgent: string | null; lastSeenAt: string; createdAt: string; current: boolean };

export function ProfileForms({ staff, sessions }: { staff: Staff; sessions: Session[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <PersonalForm staff={staff} />
      <PasswordForm />
      <TwoFactorPanel enabled={staff.totpEnabled} />
      <SessionsPanel sessions={sessions} />
    </div>
  );
}

function PersonalForm({ staff }: { staff: Staff }) {
  const t = useTranslations("admin.profile");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { pending, execute } = useAdminAction();
  const [name, setName] = useState(staff.name);
  return (
    <Panel title={t("personal")} serif>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void execute(() => updateStaffProfileAction({ name }));
        }}
      >
        <Field label={t("name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("email")}>
            <Input value={staff.email} disabled />
          </Field>
          <Field label={t("role")}>
            <Input value={staff.role === "OWNER" ? tc("owner") : tc("manager")} disabled />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-700">{t("interfaceLanguage")}</p>
          <div className="flex gap-2">
            {(["ru", "kk"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => void execute(() => setStaffLocaleAction({ locale: l }), { success: false })}
                className={cn("h-10 rounded-full border px-4 text-sm font-semibold transition-colors", locale === l ? "border-sage-700 bg-sage-700 text-white" : "border-line-strong bg-white text-ink-700 hover:border-sage-400")}
              >
                {tc(l)}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" loading={pending} disabled={name.trim().length < 2}>
          {tc("save")}
        </Button>
      </form>
    </Panel>
  );
}

function PasswordForm() {
  const t = useTranslations("admin.profile");
  const te = useTranslations("admin.errors");
  const { pending, execute, fieldError } = useAdminAction();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const mismatch = repeat.length > 0 && next !== repeat;
  const currentError = fieldError("current");
  return (
    <Panel title={t("passwordTitle")} serif>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (mismatch) return;
          void execute(() => changeStaffPasswordAction({ current, next }), {
            success: t("passwordChanged"),
            onSuccess: () => {
              setCurrent("");
              setNext("");
              setRepeat("");
            },
          });
        }}
      >
        <Field label={t("currentPassword")} error={currentError ? t("wrongPassword") : undefined}>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={!!currentError} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("newPassword")} error={fieldError("next")} hint={te("PASSWORD_TOO_WEAK")}>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={!!fieldError("next")} />
          </Field>
          <Field label={t("repeatPassword")} error={mismatch ? t("passwordMismatch") : undefined}>
            <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} invalid={mismatch} />
          </Field>
        </div>
        <Button type="submit" loading={pending} disabled={!current || !next || !repeat || mismatch}>
          {t("changePassword")}
        </Button>
      </form>
    </Panel>
  );
}

function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const t = useTranslations("admin.profile");
  const tc = useTranslations("admin.common");
  const { pending, execute, fieldError } = useAdminAction();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");

  const codeInput = (
    <Field label={t("setupStep3")} error={fieldError("code")}>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="max-w-48 text-center text-lg font-semibold tracking-[0.35em]"
        invalid={!!fieldError("code")}
      />
    </Field>
  );

  return (
    <Panel
      title={t("twoFactor")}
      serif
      action={enabled ? <StatusPill tone="sage">{tc("active")}</StatusPill> : <StatusPill tone="gray">{tc("inactive")}</StatusPill>}
    >
      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-600">
        {enabled ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sage-700" /> : <ShieldOff className="mt-0.5 size-5 shrink-0 text-ink-400" />}
        {enabled ? t("twoFactorOn") : t("twoFactorOff")}
      </p>

      {!enabled && !setup && (
        <Button className="mt-5" loading={pending} onClick={() => void execute(() => startTwoFactorAction({}), { success: false, onSuccess: (d) => setSetup(d) })}>
          {t("enable2fa")}
        </Button>
      )}

      {!enabled && setup && (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void execute(() => confirmTwoFactorAction({ code }), {
              success: t("enabled2fa"),
              onSuccess: () => {
                setSetup(null);
                setCode("");
              },
            });
          }}
        >
          <p className="text-sm text-ink-700">{t("setupStep1")}</p>
          <p className="text-sm text-ink-700">{t("setupStep2")}</p>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR-код data:URL */}
            <img src={setup.qr} alt="QR" width={180} height={180} className="rounded-lg border border-line" />
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{t("secretKey")}</p>
              <code className="mt-1 block rounded-md bg-cream-200 px-3 py-2 font-mono text-sm break-all text-graphite">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
            </div>
          </div>
          {codeInput}
          <Button type="submit" loading={pending} disabled={code.length !== 6}>
            {tc("confirm")}
          </Button>
        </form>
      )}

      {enabled && !disabling && (
        <Button variant="dangerSoft" className="mt-5" onClick={() => setDisabling(true)}>
          {t("disable2fa")}
        </Button>
      )}
      {enabled && disabling && (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void execute(() => disableTwoFactorAction({ code }), {
              success: t("disabled2fa"),
              onSuccess: () => {
                setDisabling(false);
                setCode("");
              },
            });
          }}
        >
          <p className="text-sm text-ink-700">{t("disableConfirm")}</p>
          {codeInput}
          <div className="flex gap-2.5">
            <Button type="submit" variant="danger" loading={pending} disabled={code.length !== 6}>
              {t("disable2fa")}
            </Button>
            <Button variant="secondary" onClick={() => setDisabling(false)}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function SessionsPanel({ sessions }: { sessions: Session[] }) {
  const t = useTranslations("admin.profile");
  const locale = useLocale();
  const { pending, execute } = useAdminAction();
  const others = sessions.filter((s) => !s.current).length;
  return (
    <Panel
      title={t("sessions")}
      subtitle={t("sessionsText")}
      serif
      action={
        others > 0 ? (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => void execute(() => endStaffSessionAction({}), { success: t("sessionEnded") })}>
            {t("endOthers")}
          </Button>
        ) : null
      }
    >
      <ul className="divide-y divide-line">
        {sessions.map((s) => {
          const ua = describeUserAgent(s.userAgent);
          return (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage-50 text-sage-700">{ua.mobile ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-graphite">
                  {ua.label}
                  {s.current && <span className="ml-2 text-xs font-medium text-sage-700">· {t("thisDevice")}</span>}
                </p>
                <p className="text-xs text-ink-500">
                  {s.ip ?? "—"} · {t("lastSeen")}: {formatDateTime(s.lastSeenAt, locale)}
                </p>
              </div>
              {!s.current && (
                <Button size="xs" variant="ghost" disabled={pending} onClick={() => void execute(() => endStaffSessionAction({ id: s.id }), { success: t("sessionEnded") })}>
                  {t("endSession")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
