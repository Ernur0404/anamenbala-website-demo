"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import { deletePromoCode, deletePromotion, promoCodeSchema, promotionSchema, savePromoCode, savePromotion, togglePromoCode, togglePromotion } from "@/server/admin/promotions";

const byId = z.object({ id: z.string().min(1) });
const toggle = z.object({ id: z.string().min(1), isActive: z.boolean() });

export const savePromotionAction = adminAction("promotions", promotionSchema, async (input, actor) => savePromotion(input, actor));
export const togglePromotionAction = adminAction("promotions", toggle, async ({ id, isActive }, actor) => togglePromotion(id, isActive, actor));
export const deletePromotionAction = adminAction("promotions", byId, async ({ id }, actor) => deletePromotion(id, actor));

export const savePromoCodeAction = adminAction("promotions", promoCodeSchema, async (input, actor) => savePromoCode(input, actor));
export const togglePromoCodeAction = adminAction("promotions", toggle, async ({ id, isActive }, actor) => togglePromoCode(id, isActive, actor));
export const deletePromoCodeAction = adminAction("promotions", byId, async ({ id }, actor) => deletePromoCode(id, actor));
