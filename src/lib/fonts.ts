import { Cormorant_Garamond, Manrope } from "next/font/google";

/** Основной шрифт интерфейса (кириллица + казахские буквы из cyrillic-ext) */
export const manrope = Manrope({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-manrope",
  display: "swap",
});

/** Крупные заголовки и editorial-фразы */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const fontVariables = `${manrope.variable} ${cormorant.variable}`;
