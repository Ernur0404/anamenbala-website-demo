import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStaffSessionState } from "@/server/auth/staff";
import { staffLogoutAction } from "@/server/actions/admin/auth";
import { AuthFrame } from "../auth-frame";
import { TwoFactorForm } from "../login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.auth");
  return { title: t("twoFactorTitle") };
}

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const state = await getStaffSessionState();
  const { next } = await searchParams;
  if (!state) redirect("/admin/login");
  if (!state.pending2fa) redirect("/admin");
  const t = await getTranslations("admin.auth");
  return (
    <AuthFrame title={t("twoFactorTitle")} subtitle={t("twoFactorText")}>
      <TwoFactorForm next={next ?? null} />
      <form action={staffLogoutAction} className="mt-4 text-center">
        <button type="submit" className="text-sm font-medium text-sage-700 hover:underline">
          {t("otherAccount")}
        </button>
      </form>
    </AuthFrame>
  );
}
