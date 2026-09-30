"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/server/actions/account";
import { formatPhoneInput } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center text-ink-400 hover:text-graphite" aria-label={show ? "Скрыть пароль" : "Показать пароль"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function AuthPanel({ initialTab, next }: { initialTab: "login" | "register"; next?: string | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: key === "phone" ? formatPhoneInput(e.target.value) : e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = tab === "login" ? await loginAction({ email: form.email, password: form.password, next }) : await registerAction({ ...form, next });
      if (result.ok) {
        router.replace(result.data.redirect);
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      toast.error(t(`errors.${result.code}`));
    });
  };

  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : undefined);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-beige-50 p-1">
        {(["login", "register"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("rounded-md py-2.5 text-sm font-semibold transition-colors", tab === k ? "bg-white text-graphite shadow-soft" : "text-ink-500")}>
            {t(`account.${k}`)}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {tab === "register" && (
          <Field label={t("account.name")} required error={err("name")}>
            <Input value={form.name} onChange={set("name")} autoComplete="name" required minLength={2} invalid={Boolean(errors.name)} />
          </Field>
        )}
        <Field label={t("account.email")} required error={err("email")}>
          <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" required invalid={Boolean(errors.email)} />
        </Field>
        {tab === "register" && (
          <Field label={`${t("account.phone")} (${t("common.optional")})`} error={err("phone")}>
            <Input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="+7 777 123 45 67" invalid={Boolean(errors.phone)} />
          </Field>
        )}
        <Field label={t("account.password")} required error={err("password")} hint={tab === "register" ? t("account.passwordHint") : undefined}>
          <PasswordInput value={form.password} onChange={set("password")} autoComplete={tab === "login" ? "current-password" : "new-password"} required invalid={Boolean(errors.password)} />
        </Field>
        {tab === "login" && (
          <Link href="/account/forgot" className="block text-right text-sm font-semibold text-sage-700 hover:underline">
            {t("account.forgot")}
          </Link>
        )}
        <Button type="submit" block size="lg" loading={pending}>
          {tab === "login" ? t("account.loginButton") : t("account.registerButton")}
        </Button>
      </form>
      <p className="mt-5 text-center text-xs leading-relaxed text-ink-500">{t("account.benefits")}</p>
    </div>
  );
}

export function ForgotForm() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  if (sent) {
    return (
      <p className="flex items-start gap-3 rounded-lg bg-sage-50 p-4 text-sm text-sage-800">
        <CheckCircle2 className="size-5 shrink-0" />
        {t("account.forgotSent")}
      </p>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await forgotPasswordAction(email);
          if (result.ok) setSent(true);
          else toast.error(t(`errors.${result.code === "VALIDATION" ? "invalidEmail" : result.code}`));
        });
      }}
      className="space-y-4"
    >
      <Field label={t("account.email")} required>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </Field>
      <Button type="submit" block size="lg" loading={pending}>
        {t("account.sendLink")}
      </Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await resetPasswordAction({ token, password });
          if (result.ok) {
            toast.success(t("account.passwordChanged"));
            router.replace("/account");
            router.refresh();
          } else setError(result.fieldErrors?.password ?? (result.fieldErrors?.token ? "expired" : result.code));
        });
      }}
      className="space-y-4"
    >
      <Field label={t("account.newPassword")} required hint={t("account.passwordHint")} error={error ? t(`errors.${error}`) : undefined}>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required invalid={Boolean(error)} />
      </Field>
      <Button type="submit" block size="lg" loading={pending}>
        {t("account.resetButton")}
      </Button>
    </form>
  );
}

export { PasswordInput };
