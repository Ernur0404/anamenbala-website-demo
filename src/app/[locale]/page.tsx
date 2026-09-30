import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("common");
  return (
    <main className="container-page py-16">
      <h1 className="heading-display text-6xl">{t("storeName")}</h1>
      <p className="script-accent text-3xl text-sage-700">Забота в каждой детали · Қазақша: әғқңөұүһі</p>
      <p className="mt-4">{t("tagline")} — Manrope: әғқңөұүһі ӘҒҚҢӨҰҮҺІ</p>
      <button className="mt-6 rounded-md bg-sage-700 px-5 py-3 text-sm font-semibold text-white">Перейти к покупкам</button>
    </main>
  );
}
