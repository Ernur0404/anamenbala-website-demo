import { refresh } from "next/cache";
import type { z } from "zod";
import { requireStaffAction, type StaffIdentity } from "../auth/staff";
import { run } from "../actions/run";
import type { ActionResult } from "../errors";
import type { Permission } from "../permissions";

export type AdminActor = StaffIdentity & { ip: string | null };

/** Актор для доменных сервисов заказов/склада */
export function staffActor(actor: AdminActor) {
  return { staffUserId: actor.id, role: actor.role, ip: actor.ip };
}

/**
 * Server action админки: проверка сессии и права → валидация Zod → выполнение →
 * обновление текущей страницы у сотрудника. Ошибки превращаются в ActionResult.
 *
 *   export const saveBrand = adminAction("catalog", brandSchema, async (input, actor) => { … });
 */
export function adminAction<S extends z.ZodType, R>(
  permission: Permission | null,
  schema: S,
  handler: (input: z.output<S>, actor: AdminActor) => Promise<R>,
  options: { refresh?: boolean } = {},
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> =>
    run(async () => {
      const actor = await requireStaffAction(permission ?? undefined);
      const input = schema.parse(raw);
      const result = await handler(input, actor);
      if (options.refresh !== false) refresh();
      return result;
    });
}
