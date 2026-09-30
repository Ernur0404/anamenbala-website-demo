"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LogOut, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/primitives";
import {
  changePasswordAction,
  deleteAddressAction,
  logoutAction,
  resendVerificationAction,
  saveAddressAction,
  setDefaultAddressAction,
  updateProfileAction,
} from "@/server/actions/account";
import { PasswordInput } from "./auth-forms";
import { formatPhoneInput } from "@/lib/phone-input";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutAction();
          router.replace("/");
          router.refresh();
        })
      }
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-powder-50 hover:text-powder-700"
    >
      <LogOut className="size-4" />
      {label}
    </button>
  );
}

export function ResendVerification() {
  const t = useTranslations("account");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  if (sent) return <span className="font-semibold">{t("resent")}</span>;
  return (
    <button
      type="button"
      disabled={pending}
      className="font-semibold underline underline-offset-2"
      onClick={() =>
        startTransition(async () => {
          const r = await resendVerificationAction();
          if (r.ok) setSent(true);
          else toast.error(r.error);
        })
      }
    >
      {t("resend")}
    </button>
  );
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState({ name, phone: phone ? formatPhoneInput(phone) : "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pending, startTransition] = useTransition();
  const [pwPending, startPw] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-4 rounded-xl border border-line bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await updateProfileAction(form);
            if (r.ok) {
              toast.success(t("account.saved"));
              router.refresh();
            } else toast.error(t(`errors.${r.fieldErrors?.phone ?? r.code}`));
          });
        }}
      >
        <h2 className="font-bold">{t("account.profile")}</h2>
        <Field label={t("account.email")}>
          <Input value={email} disabled />
        </Field>
        <Field label={t("account.name")} required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required minLength={2} />
        </Field>
        <Field label={t("account.phone")}>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))} inputMode="tel" placeholder="+7 777 123 45 67" />
        </Field>
        <Button type="submit" loading={pending}>
          {t("common.save")}
        </Button>
      </form>

      <form
        className="space-y-4 rounded-xl border border-line bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          startPw(async () => {
            const r = await changePasswordAction(pw);
            if (r.ok) {
              toast.success(t("account.passwordChanged"));
              setPw({ current: "", next: "" });
            } else toast.error(t(`errors.${r.fieldErrors?.password ?? r.code}`));
          });
        }}
      >
        <h2 className="font-bold">{t("account.changePassword")}</h2>
        <Field label={t("account.currentPassword")} required>
          <PasswordInput value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" required />
        </Field>
        <Field label={t("account.newPassword")} required hint={t("account.passwordHint")}>
          <PasswordInput value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" required />
        </Field>
        <Button type="submit" variant="secondary" loading={pwPending}>
          {t("account.changePassword")}
        </Button>
      </form>
    </div>
  );
}

type Address = { id: string; label: string | null; region: string | null; city: string; street: string; house: string; apartment: string | null; postalCode: string | null; isDefault: boolean };

function AddressDialog({ address, open, onOpenChange }: { address: Address | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState({
    label: address?.label ?? "",
    region: address?.region ?? "",
    city: address?.city ?? "",
    street: address?.street ?? "",
    house: address?.house ?? "",
    apartment: address?.apartment ?? "",
    postalCode: address?.postalCode ?? "",
    isDefault: address?.isDefault ?? false,
  });
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={address ? t("common.edit") : t("account.addAddress")}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await saveAddressAction({ ...form, id: address?.id });
              if (r.ok) {
                onOpenChange(false);
                router.refresh();
              } else toast.error(t(`errors.${r.code}`));
            });
          }}
        >
          <Field label={t("account.addressLabel")} className="sm:col-span-2">
            <Input value={form.label} onChange={set("label")} />
          </Field>
          <Field label={t("checkout.region")}>
            <Input value={form.region} onChange={set("region")} />
          </Field>
          <Field label={t("checkout.city")} required>
            <Input value={form.city} onChange={set("city")} required />
          </Field>
          <Field label={t("checkout.street")} required className="sm:col-span-2">
            <Input value={form.street} onChange={set("street")} required />
          </Field>
          <Field label={t("checkout.house")} required>
            <Input value={form.house} onChange={set("house")} required />
          </Field>
          <Field label={t("checkout.apartment")}>
            <Input value={form.apartment} onChange={set("apartment")} />
          </Field>
          <Field label={t("checkout.postalCode")}>
            <Input value={form.postalCode} onChange={set("postalCode")} inputMode="numeric" />
          </Field>
          <div className="flex items-end">
            <Checkbox checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} label={t("account.defaultAddress")} />
          </div>
          <Button type="submit" loading={pending} className="sm:col-span-2">
            {t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {addresses.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-sage-700" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              {a.label || a.city}
              {a.isDefault && <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-bold text-sage-800">{t("account.defaultAddress")}</span>}
            </p>
            <p className="mt-0.5 text-ink-600">{[a.region, a.city, `${a.street}, ${a.house}`, a.apartment].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {!a.isDefault && (
              <button
                type="button"
                title={t("account.makeDefault")}
                disabled={pending}
                onClick={() => startTransition(async () => void (await setDefaultAddressAction(a.id), router.refresh()))}
                className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-beige-100 hover:text-sage-700"
              >
                <Star className="size-4" />
              </button>
            )}
            <button type="button" onClick={() => (setEditing(a), setOpen(true))} className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-beige-100 hover:text-graphite" aria-label={t("common.edit")}>
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => void (await deleteAddressAction(a.id), router.refresh()))}
              className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-powder-50 hover:text-powder-700"
              aria-label={t("common.delete")}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={() => (setEditing(null), setOpen(true))}>
        <Plus />
        {t("account.addAddress")}
      </Button>
      {open && <AddressDialog key={editing?.id ?? "new"} address={editing} open={open} onOpenChange={setOpen} />}
    </div>
  );
}
