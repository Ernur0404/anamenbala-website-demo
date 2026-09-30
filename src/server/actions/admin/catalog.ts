"use server";

import { z } from "zod";
import { adminAction } from "@/server/admin/action";
import {
  attributeSchema,
  badgeSchema,
  brandSchema,
  categorySchema,
  deleteAttribute,
  deleteBadge,
  deleteBrand,
  deleteCategory,
  deleteSizeChart,
  moveAttribute,
  moveCategory,
  moveSorted,
  saveAttribute,
  saveBadge,
  saveBrand,
  saveCategory,
  saveSizeChart,
  sizeChartSchema,
  toggleCategory,
} from "@/server/admin/catalog";

const byId = z.object({ id: z.string().min(1) });
const move = z.object({ id: z.string().min(1), direction: z.enum(["up", "down"]) });

export const saveCategoryAction = adminAction("catalog", categorySchema, async (input, actor) => saveCategory(input, actor));
export const moveCategoryAction = adminAction("catalog", move, async ({ id, direction }, actor) => moveCategory(id, direction, actor));
export const toggleCategoryAction = adminAction("catalog", z.object({ id: z.string().min(1), field: z.enum(["isVisible", "showInMenu"]), value: z.boolean() }), async ({ id, field, value }, actor) =>
  toggleCategory(id, field, value, actor),
);
export const deleteCategoryAction = adminAction("catalog", byId, async ({ id }, actor) => deleteCategory(id, actor), { refresh: false });

export const saveAttributeAction = adminAction("catalog", attributeSchema, async (input, actor) => saveAttribute(input, actor));
export const deleteAttributeAction = adminAction("catalog", byId, async ({ id }, actor) => deleteAttribute(id, actor));
export const moveAttributeAction = adminAction("catalog", move, async ({ id, direction }) => moveAttribute(id, direction));

export const saveBrandAction = adminAction("catalog", brandSchema, async (input, actor) => saveBrand(input, actor));
export const deleteBrandAction = adminAction("catalog", byId, async ({ id }, actor) => deleteBrand(id, actor));
export const moveBrandAction = adminAction("catalog", move, async ({ id, direction }) => moveSorted("brand", id, direction));

export const saveBadgeAction = adminAction("catalog", badgeSchema, async (input, actor) => saveBadge(input, actor));
export const deleteBadgeAction = adminAction("catalog", byId, async ({ id }, actor) => deleteBadge(id, actor));
export const moveBadgeAction = adminAction("catalog", move, async ({ id, direction }) => moveSorted("badge", id, direction));

export const saveSizeChartAction = adminAction("catalog", sizeChartSchema, async (input, actor) => saveSizeChart(input, actor));
export const deleteSizeChartAction = adminAction("catalog", byId, async ({ id }, actor) => deleteSizeChart(id, actor));
