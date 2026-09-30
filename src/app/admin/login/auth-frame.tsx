import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/icons";

/** Рамка страниц входа в админку */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f6f5f0] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark size={52} />
          <p className="heading-section mt-3 text-[26px] text-graphite">Ана мен бала</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <h1 className="heading-section text-[28px] text-graphite">{title}</h1>
          {subtitle && <p className="mt-1.5 mb-6 text-sm text-ink-500">{subtitle}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
