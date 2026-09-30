import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffSessionState } from "@/server/auth/staff";
import { AuthFrame } from "./auth-frame";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.auth");
  return { title: t("title") };
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const state = await getStaffSessionState();
  const { next } = await searchParams;
  if (state && !state.pending2fa) redirect(next?.startsWith("/admin") ? next : "/admin");
  if (state?.pending2fa) redirect("/admin/login/2fa");
  const t = await getTranslations("admin.auth");
  return (
    <AuthFrame title={t("title")} subtitle={t("subtitle")}>
      <LoginForm next={next ?? null} />
      <p className="mt-5 text-center text-xs leading-relaxed text-ink-500">{t("forgotHint")}</p>
    </AuthFrame>
  );
}
