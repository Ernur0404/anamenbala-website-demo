"use client";

import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Изменение параметров URL каталога без перезагрузки (сбрасывает страницу пагинации) */
export function useQueryState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const update = (mutate: (params: URLSearchParams) => void, options?: { keepPage?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    if (!options?.keepPage) params.delete("page");
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const list = (key: string) => (searchParams.get(key) ?? "").split(",").filter(Boolean);

  const toggleInList = (key: string, value: string) =>
    update((p) => {
      const current = (p.get(key) ?? "").split(",").filter(Boolean);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });

  return { searchParams, update, list, toggleInList, pending };
}
