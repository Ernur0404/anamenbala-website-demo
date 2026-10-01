"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, KeyRound, Pencil, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import { StatusPill } from "@/components/ui/display";
import { DataTable, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/use-action";
import { createStaffAction, resetStaffPasswordAction, updateStaffAction } from "@/server/actions/admin/settings";

type Role = "OWNER" | "MANAGER";
type Locale = "ru" | "kk";
type Staff = { id: string; name: string; email: string; role: Role; locale: Locale; isActive: boolean; totpEnabled: boolean; lastLogin: string | null };
type Draft = { id: string | null; name: string; email: string; role: Role; locale: Locale; isActive: boolean };

const iconBtn = "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700";

export function StaffManager({ staff, meId }: { staff: Staff[]; meId: string }) {
  const t = useTranslations("admin.settings.staff");
  const ts = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const { pending, execute, fieldError } = useAdminAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [secret, setSecret] = useState<{ title: string; text: string; name: string; password: string } | null>(null);

  const isSelf = draft?.id === meId;

  const submit = () => {
    if (!draft) return;
    if (draft.id) {
      void execute(() => updateStaffAction({ id: draft.id!, name: draft.name, role: draft.role, locale: draft.locale, isActive: draft.isActive }), {
        success: ts("saved"),
        errorMessage: (f) => (f.details?.reason === "cannotSelf" ? t("cannotSelf") : f.details?.reason === "lastOwner" ? t("lastOwner") : undefined),
        onSuccess: () => setDraft(null),
      });
    } else {
      void execute(() => createStaffAction({ name: draft.name, email: draft.email, role: draft.role, locale: draft.locale }), {
        success: false,
        errorMessage: (f) => (f.code === "EMAIL_TAKEN" ? t("emailTaken") : undefined),
        onSuccess: ({ password }) => {
          setSecret({ title: t("createdTitle"), text: t("createdText"), name: draft.name, password });
          setDraft(null);
        },
      });
    }
  };

  const reset = (s: Staff) =>
    execute(() => resetStaffPasswordAction({ id: s.id }), {
      success: false,
      onSuccess: ({ password }) => setSecret({ title: t("resetTitle"), text: t("resetText"), name: s.name, password }),
    });

  return (
    <>
      <Panel
        title={t("title")}
        subtitle={t("hint")}
        serif
        padded={false}
        action={
          <Button size="sm" onClick={() => setDraft({ id: null, name: "", email: "", role: "MANAGER", locale: "ru", isActive: true })}>
            <Plus />
            {t("add")}
          </Button>
        }
      >
        <DataTable minWidth={820} className="border-t border-line">
          <thead>
            <tr>
              <Th>{t("name")}</Th>
              <Th>{t("role")}</Th>
              <Th>{t("locale")}</Th>
              <Th>{t("twoFactor")}</Th>
              <Th>{t("lastLogin")}</Th>
              <Th>{t("active")}</Th>
              <Th align="right">{tc("actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-graphite">
                    {s.name}
                    {s.id === meId && <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[11px] font-semibold text-sage-700">{t("you")}</span>}
                  </p>
                  <p className="text-[12.5px] text-ink-500">{s.email}</p>
                </Td>
                <Td>
                  <StatusPill tone={s.role === "OWNER" ? "sage" : "sky"}>{t(`roles.${s.role}`)}</StatusPill>
                </Td>
                <Td className="text-ink-600">{s.locale === "kk" ? tc("kkShort") : tc("ruShort")}</Td>
                <Td>{s.totpEnabled ? <ShieldCheck className="size-4.5 text-sage-700" aria-label={tc("yes")} /> : <span className="text-ink-400">—</span>}</Td>
                <Td className="whitespace-nowrap text-ink-600">{s.lastLogin ?? <span className="text-ink-400">{t("never")}</span>}</Td>
                <Td>
                  <StatusPill tone={s.isActive ? "sage" : "gray"} dot>
                    {s.isActive ? t("activeOn") : t("activeOff")}
                  </StatusPill>
                </Td>
                <Td align="right">
                  <div className="inline-flex gap-1.5">
                    <button type="button" className={iconBtn} onClick={() => setDraft({ id: s.id, name: s.name, email: s.email, role: s.role, locale: s.locale, isActive: s.isActive })} aria-label={tc("edit")}>
                      <Pencil className="size-3.5" />
                    </button>
                    <ConfirmButton
                      title={t("resetConfirmTitle", { name: s.name })}
                      text={t("resetConfirmText")}
                      confirmLabel={t("resetPassword")}
                      tone="primary"
                      size="iconSm"
                      variant="ghost"
                      className="border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700"
                      onConfirm={() => reset(s)}
                      aria-label={t("resetPassword")}
                    >
                      <KeyRound className="size-3.5" />
                    </ConfirmButton>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        {draft && (
          <DialogContent title={draft.id ? t("edit") : t("add")}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Field label={t("name")} required error={fieldError("name")}>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} autoFocus />
              </Field>
              <Field label={t("email")} required error={draft.id ? undefined : fieldError("email")}>
                <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} disabled={Boolean(draft.id)} maxLength={200} autoComplete="off" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("role")} hint={draft.role === "OWNER" ? t("roleHintOwner") : t("roleHintManager")}>
                  <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })} disabled={isSelf}>
                    <option value="MANAGER">{t("roles.MANAGER")}</option>
                    <option value="OWNER">{t("roles.OWNER")}</option>
                  </Select>
                </Field>
                <Field label={t("locale")}>
                  <Select value={draft.locale} onChange={(e) => setDraft({ ...draft, locale: e.target.value as Locale })}>
                    <option value="ru">{tc("ru")}</option>
                    <option value="kk">{tc("kk")}</option>
                  </Select>
                </Field>
              </div>
              {draft.id && <Checkbox label={t("activeOn")} checked={draft.isActive} disabled={isSelf} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />}
              {isSelf && <p className="text-[12.5px] text-ink-500">{t("selfHint")}</p>}
              <div className="flex justify-end gap-2.5 pt-1">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={pending} disabled={draft.name.trim().length < 2 || (!draft.id && !draft.email.includes("@"))}>
                  {draft.id ? tc("save") : t("add")}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={Boolean(secret)} onOpenChange={(v) => !v && setSecret(null)}>
        {secret && (
          <DialogContent title={secret.title} size="sm">
            <p className="text-sm leading-relaxed text-ink-600">
              <span className="font-semibold text-graphite">{secret.name}</span> — {secret.text}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3">
              <code className="font-mono text-[18px] font-semibold tracking-wider text-graphite select-all">{secret.password}</code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(secret.password).then(() => toast.success(tc("copied")));
                }}
              >
                <Copy />
                {t("copyPassword")}
              </Button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSecret(null)}>{t("done")}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
