"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/server/errors";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

type Options<T> = {
  /** Текст уведомления об успехе; false — без уведомления */
  success?: string | false;
  onSuccess?: (data: T) => void;
  onError?: (failure: Failure) => void;
  /** Свой текст ошибки (например, по details.reason); undefined — стандартный перевод кода */
  errorMessage?: (failure: Failure) => string | undefined;
};

/**
 * Вызов server action из формы админки: индикатор ожидания, уведомления,
 * перевод кодов ошибок (RU/KZ) и ошибки полей.
 */
export function useAdminAction() {
  const te = useTranslations("admin.errors");
  const tc = useTranslations("admin.common");
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const translate = useCallback(
    (code: string | undefined, fallback?: string) => {
      if (code && te.has(code)) return te(code);
      return fallback ?? te("INTERNAL");
    },
    [te],
  );

  const execute = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, options: Options<T> = {}) =>
      new Promise<ActionResult<T> | null>((resolve) => {
        startTransition(async () => {
          try {
            const result = await fn();
            if (result.ok) {
              setFieldErrors({});
              if (options.success !== false) toast.success(options.success ?? tc("saved"));
              options.onSuccess?.(result.data);
            } else {
              setFieldErrors(result.fieldErrors ?? {});
              toast.error(options.errorMessage?.(result) ?? translate(result.code, result.error));
              options.onError?.(result);
            }
            resolve(result);
          } catch (error) {
            // redirect() из действия — это не ошибка
            if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_")) throw error;
            toast.error(te("network"));
            resolve(null);
          }
        });
      }),
    [tc, te, translate],
  );

  /** Текст ошибки поля (ключ — путь в схеме: "nameRu", "variants.0.sku") */
  const fieldError = useCallback((key: string) => (fieldErrors[key] ? translate(fieldErrors[key], te("invalid")) : undefined), [fieldErrors, translate, te]);

  return { pending, execute, fieldErrors, setFieldErrors, fieldError, translate };
}
