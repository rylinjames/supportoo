import { v } from "convex/values";
import { query } from "../_generated/server";

export const listDepartments = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("departments")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
  },
});

export const listActiveDepartments = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("departments")
      .withIndex("by_company_active", (q) =>
        q.eq("companyId", companyId).eq("isActive", true)
      )
      .collect();
  },
});

export const getDepartment = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, { departmentId }) => {
    return await ctx.db.get(departmentId);
  },
});

export const getAgentDepartments = query({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { userId, companyId }) => {
    const uc = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!uc || !uc.departmentIds) return [];

    const departments = await Promise.all(
      uc.departmentIds.map((id) => ctx.db.get(id))
    );
    return departments.filter(Boolean);
  },
});

export const getAgentsInDepartment = query({
  args: {
    departmentId: v.id("departments"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { departmentId, companyId }) => {
    const userCompanies = await ctx.db
      .query("user_companies")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("role"), "support"))
      )
      .collect();

    const agentsInDept = userCompanies.filter(
      (uc) => uc.departmentIds?.includes(departmentId)
    );

    const enriched = await Promise.all(
      agentsInDept.map(async (uc) => {
        const user = await ctx.db.get(uc.userId);
        if (!user) return null;
        return {
          ...user,
          role: uc.role,
          departmentIds: uc.departmentIds,
        };
      })
    );

    return enriched.filter(Boolean);
  },
});
