import type { ReactNode } from "react";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={fontVariables} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
