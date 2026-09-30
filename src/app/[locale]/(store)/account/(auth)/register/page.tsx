import type { Metadata } from "next";
import { AuthPanel } from "@/components/store/account/auth-forms";

export const metadata: Metadata = { title: "Регистрация", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthPanel initialTab="register" next={next} />;
}
