"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import { adminReviewSchema, createAdminReview, deleteReview, moderateReview, replyToReview, setReviewFeatured } from "@/server/admin/reviews";

const id = z.string().min(1);

export const moderateReviewAction = adminAction("reviews", z.object({ id, status: z.enum(["APPROVED", "REJECTED", "PENDING"]) }), async ({ id, status }, actor) => moderateReview(id, status, actor));
export const featureReviewAction = adminAction("reviews", z.object({ id, isFeatured: z.boolean() }), async ({ id, isFeatured }, actor) => setReviewFeatured(id, isFeatured, actor));
export const replyReviewAction = adminAction("reviews", z.object({ id, text: z.string().max(2000).nullable() }), async ({ id, text }, actor) => replyToReview(id, text, actor));
export const deleteReviewAction = adminAction("reviews", z.object({ id }), async ({ id }, actor) => deleteReview(id, actor));
export const createReviewAction = adminAction("reviews", adminReviewSchema, async (input, actor) => createAdminReview(input, actor));
