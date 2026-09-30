import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/customer";
import { ProfileForm } from "@/components/store/account/account-forms";

export const metadata: Metadata = { title: "Профиль", robots: { index: false } };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("account");
  return (
    <div>
      <h2 className="heading-section mb-5 text-[30px]">{t("profile")}</h2>
      <ProfileForm name={user.name} phone={user.phone ?? ""} email={user.email} />
    </div>
  );
}
