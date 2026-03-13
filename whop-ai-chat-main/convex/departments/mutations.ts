import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";

export const createDepartment = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, { companyId, name, description, createdBy }) => {
    const now = Date.now();
    const id = await ctx.db.insert("departments", {
      companyId,
      name,
      description,
      isActive: true,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const updateDepartment = mutation({
  args: {
    departmentId: v.id("departments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { departmentId, ...updates }) => {
    const dept = await ctx.db.get(departmentId);
    if (!dept) throw new Error("Department not found");

    const patch: any = { updatedAt: Date.now() };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;

    await ctx.db.patch(departmentId, patch);
    return { success: true };
  },
});

export const deleteDepartment = mutation({
  args: {
    departmentId: v.id("departments"),
  },
  handler: async (ctx, { departmentId }) => {
    const dept = await ctx.db.get(departmentId);
    if (!dept) throw new Error("Department not found");

    // Remove this department from any user_companies.departmentIds
    const userCompanies = await ctx.db
      .query("user_companies")
      .withIndex("by_company", (q) => q.eq("companyId", dept.companyId))
      .collect();

    for (const uc of userCompanies) {
      if (uc.departmentIds?.includes(departmentId)) {
        await ctx.db.patch(uc._id, {
          departmentIds: uc.departmentIds.filter((id) => id !== departmentId),
          updatedAt: Date.now(),
        });
      }
    }

    // Clear departmentId from any conversations referencing this department
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_status", (q) => q.eq("companyId", dept.companyId))
      .collect();

    for (const conv of conversations) {
      if (conv.departmentId === departmentId) {
        await ctx.db.patch(conv._id, {
          departmentId: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete(departmentId);
    return { success: true };
  },
});

export const assignAgentToDepartment = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    departmentId: v.id("departments"),
  },
  handler: async (ctx, { userId, companyId, departmentId }) => {
    const uc = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!uc) throw new Error("User not found in company");

    const current = uc.departmentIds || [];
    if (current.includes(departmentId)) return { success: true };

    await ctx.db.patch(uc._id, {
      departmentIds: [...current, departmentId],
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const removeAgentFromDepartment = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    departmentId: v.id("departments"),
  },
  handler: async (ctx, { userId, companyId, departmentId }) => {
    const uc = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!uc) throw new Error("User not found in company");

    const current = uc.departmentIds || [];
    await ctx.db.patch(uc._id, {
      departmentIds: current.filter((id) => id !== departmentId),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const selectDepartmentForConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    departmentId: v.id("departments"),
  },
  handler: async (ctx, { conversationId, departmentId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const department = await ctx.db.get(departmentId);
    if (!department) throw new Error("Department not found");

    const now = Date.now();

    await ctx.db.patch(conversationId, {
      departmentId,
      status: "available",
      handoffTriggeredAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "system",
      content: `Routed to ${department.name}. A support agent will be with you shortly.`,
      timestamp: now,
      systemMessageType: "department_selected",
    });

    // Notify agents in this department
    await ctx.scheduler.runAfter(
      0,
      api.notifications.whop.sendHandoffRequestNotification,
      {
        conversationId,
        reason: conversation.handoffReason || "Customer selected department",
        departmentId,
      }
    );

    return { success: true };
  },
});

export const toggleDepartmentsEnabled = mutation({
  args: {
    companyId: v.id("companies"),
    enabled: v.boolean(),
  },
  handler: async (ctx, { companyId, enabled }) => {
    await ctx.db.patch(companyId, {
      departmentsEnabled: enabled,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
