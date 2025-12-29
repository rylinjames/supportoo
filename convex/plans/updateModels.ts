import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const updatePlanModels = mutation({
  args: {
    planId: v.id("plans"),
    aiModels: v.array(v.string()),
  },
  handler: async (ctx, { planId, aiModels }) => {
    await ctx.db.patch(planId, {
      aiModels,
    });
    return { success: true };
  },
});