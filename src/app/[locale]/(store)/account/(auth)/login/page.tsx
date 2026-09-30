import type { Metadata } from "next";
import { AuthPanel } from "@/components/store/account/auth-forms";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthPanel initialTab="login" next={next} />;
}
