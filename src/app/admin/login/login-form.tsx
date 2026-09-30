"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useAdminAction } from "@/components/admin/use-action";
import { staffLoginAction, staffTwoFactorAction } from "@/server/actions/admin/auth";

export function LoginForm({ next }: { next: string | null }) {
  const t = useTranslations("admin.auth");
  const router = useRouter();
  const { pending, execute } = useAdminAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        void execute(() => staffLoginAction({ email, password, next }), {
          success: false,
          onSuccess: (data) => router.replace(data.next),
          onError: (f) => setError(f.code === "RATE_LIMITED" ? t("rateLimited") : t("invalid")),
        });
      }}
      className="space-y-4"
      noValidate
    >
      <Field label={t("email")}>
        <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus invalid={!!error} />
      </Field>
      <Field label={t("password")}>
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required invalid={!!error} />
      </Field>
      {error && (
        <p role="alert" className="rounded-md bg-powder-50 px-3 py-2.5 text-sm font-medium text-powder-800">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending} disabled={!email || !password}>
        {t("login")}
      </Button>
    </form>
  );
}

export function TwoFactorForm({ next }: { next: string | null }) {
  const t = useTranslations("admin.auth");
  const router = useRouter();
  const { pending, execute } = useAdminAction();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        void execute(() => staffTwoFactorAction({ code, next }), {
          success: false,
          onSuccess: (data) => router.replace(data.next),
          onError: (f) => setError(f.code === "RATE_LIMITED" ? t("rateLimited") : t("invalidCode")),
        });
      }}
      className="space-y-4"
    >
      <Field label={t("code")}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center text-xl font-semibold tracking-[0.4em]"
          autoFocus
          invalid={!!error}
        />
      </Field>
      {error && (
        <p role="alert" className="rounded-md bg-powder-50 px-3 py-2.5 text-sm font-medium text-powder-800">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending} disabled={code.length !== 6}>
        {t("verify")}
      </Button>
    </form>
  );
}
