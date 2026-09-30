"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import { adjustSchema, adjustVariantStock, deleteStockDocument, postStockDocument, saveStockDocument, stockDocSchema } from "@/server/admin/stock";

export const adjustStockAction = adminAction("stock", adjustSchema, async (input, actor) => adjustVariantStock(input, actor));

export const saveStockDocumentAction = adminAction("stock", stockDocSchema, async (input, actor) => saveStockDocument(input, actor), { refresh: false });

export const postStockDocumentAction = adminAction("stock", z.object({ id: z.string().min(1), updateCost: z.boolean().default(false) }), async ({ id, updateCost }, actor) =>
  postStockDocument(id, { updateCost }, actor),
);

export const deleteStockDocumentAction = adminAction("stock", z.object({ id: z.string().min(1) }), async ({ id }, actor) => deleteStockDocument(id, actor), { refresh: false });
