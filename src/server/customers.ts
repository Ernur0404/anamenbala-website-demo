import type { DbClient } from "./db";

/** Клиент (CRM) по номеру телефона: создаётся при первом заказе, email дописывается если не было */
export async function upsertCustomer(client: DbClient, input: { phone: string; name: string; email?: string | null; city?: string | null; isDemo?: boolean }) {
  const customer = await client.customer.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      city: input.city?.trim() || null,
      isDemo: input.isDemo ?? false,
    },
    update: {},
  });
  const patch: { email?: string; city?: string } = {};
  if (!customer.email && input.email?.trim()) patch.email = input.email.trim();
  if (!customer.city && input.city?.trim()) patch.city = input.city.trim();
  if (Object.keys(patch).length) return client.customer.update({ where: { id: customer.id }, data: patch });
  return customer;
}
