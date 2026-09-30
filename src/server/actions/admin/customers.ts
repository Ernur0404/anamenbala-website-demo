"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import { customerUpdateSchema, deleteContactMessage, deleteSubscriber, setContactMessageStatus, updateCustomer } from "@/server/admin/customers";

export const updateCustomerAction = adminAction("customers", customerUpdateSchema, async (input, actor) => updateCustomer(input, actor));

export const setMessageStatusAction = adminAction("customers", z.object({ id: z.string().min(1), status: z.enum(["NEW", "DONE"]) }), async ({ id, status }, actor) =>
  setContactMessageStatus(id, status, actor),
);

export const deleteMessageAction = adminAction("customers", z.object({ id: z.string().min(1) }), async ({ id }, actor) => deleteContactMessage(id, actor));

export const deleteSubscriberAction = adminAction("customers", z.object({ id: z.string().min(1) }), async ({ id }, actor) => deleteSubscriber(id, actor));
