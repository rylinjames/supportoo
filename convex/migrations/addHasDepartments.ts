import { mutation } from "../_generated/server";

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    for (const plan of plans) {
      const value = plan.name === "free" ? false : true;
      await ctx.db.patch(plan._id, { hasDepartments: value });
    }
    return { updated: plans.length };
  },
});
