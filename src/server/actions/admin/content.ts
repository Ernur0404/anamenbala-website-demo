"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import {
  addProductsSection,
  advantagesSchema,
  bannerSchema,
  deleteBanner,
  deleteFaq,
  deleteHomeSection,
  deleteInstagramPost,
  deletePage,
  faqSchema,
  homeSectionSchema,
  instagramSchema,
  moveBanner,
  moveFaq,
  moveHomeSection,
  moveInstagramPost,
  pageSchema,
  saveAdvantages,
  saveBanner,
  saveFaq,
  saveHomeSection,
  saveInstagramPost,
  savePage,
  saveTopbar,
  toggleBanner,
  toggleHomeSection,
  topbarSchema,
} from "@/server/admin/content";

const byId = z.object({ id: z.string().min(1) });
const move = z.object({ id: z.string().min(1), direction: z.enum(["up", "down"]) });
const toggle = z.object({ id: z.string().min(1), isActive: z.boolean() });

export const saveBannerAction = adminAction("content", bannerSchema, async (input, actor) => saveBanner(input, actor));
export const toggleBannerAction = adminAction("content", toggle, async ({ id, isActive }, actor) => toggleBanner(id, isActive, actor));
export const moveBannerAction = adminAction("content", move, async ({ id, direction }, actor) => moveBanner(id, direction, actor));
export const deleteBannerAction = adminAction("content", byId, async ({ id }, actor) => deleteBanner(id, actor));

export const saveHomeSectionAction = adminAction("content", homeSectionSchema, async (input, actor) => saveHomeSection(input, actor));
export const toggleHomeSectionAction = adminAction("content", toggle, async ({ id, isActive }, actor) => toggleHomeSection(id, isActive, actor));
export const moveHomeSectionAction = adminAction("content", move, async ({ id, direction }, actor) => moveHomeSection(id, direction, actor));
export const addProductsSectionAction = adminAction("content", z.object({}), async (_input, actor) => addProductsSection(actor));
export const deleteHomeSectionAction = adminAction("content", byId, async ({ id }, actor) => deleteHomeSection(id, actor));

export const savePageAction = adminAction("content", pageSchema, async (input, actor) => savePage(input, actor));
export const deletePageAction = adminAction("content", byId, async ({ id }, actor) => deletePage(id, actor), { refresh: false });

export const saveFaqAction = adminAction("content", faqSchema, async (input, actor) => saveFaq(input, actor));
export const moveFaqAction = adminAction("content", move, async ({ id, direction }, actor) => moveFaq(id, direction, actor));
export const deleteFaqAction = adminAction("content", byId, async ({ id }, actor) => deleteFaq(id, actor));

export const saveInstagramAction = adminAction("content", instagramSchema, async (input, actor) => saveInstagramPost(input, actor));
export const moveInstagramAction = adminAction("content", move, async ({ id, direction }, actor) => moveInstagramPost(id, direction, actor));
export const deleteInstagramAction = adminAction("content", byId, async ({ id }, actor) => deleteInstagramPost(id, actor));

export const saveTopbarAction = adminAction("content", topbarSchema, async (input, actor) => saveTopbar(input, actor));
export const saveAdvantagesAction = adminAction("content", advantagesSchema, async (input, actor) => saveAdvantages(input, actor));
