import { ZodError } from "zod";
import { DomainError, fail, ok, type ActionResult } from "../errors";

/** Выполнить действие и превратить исключения в ActionResult для клиента */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof DomainError) {
      const fieldErrors = (error.details?.fieldErrors as Record<string, string> | undefined) ?? undefined;
      return fail(error.code, error.message, { details: error.details, fieldErrors });
    }
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.code === "too_small" ? "required" : "invalid";
      }
      return fail("VALIDATION", "Проверьте правильность заполнения", { fieldErrors });
    }
    // redirect()/notFound() из next/navigation должны пробрасываться дальше
    if (error && typeof error === "object" && "digest" in error && typeof (error as { digest?: unknown }).digest === "string" && String((error as { digest: string }).digest).startsWith("NEXT_")) {
      throw error;
    }
    console.error("[action]", error);
    return fail("INTERNAL", "Что-то пошло не так");
  }
}
