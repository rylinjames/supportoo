import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get agent settings
export const getSettings = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();

    if (!user) return null;

    return {
      agentGreeting: user.agentGreeting || "Hello! I'm here to help you today. How can I assist you?",
      autoGreetingEnabled: user.autoGreetingEnabled !== false,
      availabilityStatus: user.availabilityStatus || "available",
      awayMessage: user.awayMessage || "I'm currently away. Another agent will assist you shortly.",
    };
  },
});

// Update agent greeting
export const updateGreeting = mutation({
  args: {
    greeting: v.string(),
    autoGreetingEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      agentGreeting: args.greeting,
      autoGreetingEnabled: args.autoGreetingEnabled,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Update availability status
export const updateAvailability = mutation({
  args: {
    status: v.union(v.literal("available"), v.literal("busy"), v.literal("offline")),
    awayMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const updates: any = {
      availabilityStatus: args.status,
      updatedAt: Date.now(),
    };

    // Only update away message if provided
    if (args.awayMessage !== undefined) {
      updates.awayMessage = args.awayMessage;
    }

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

// Get all available agents for a company
export const getAvailableAgents = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    // Get all agents for the company
    const companyUsers = await ctx.db
      .query("user_companies")
      .withIndex("by_company_role", (q) =>
        q.eq("companyId", args.companyId).eq("role", "support")
      )
      .collect();

    const agents = await Promise.all(
      companyUsers.map(async (cu) => {
        const user = await ctx.db.get(cu.userId);
        if (!user) return null;
        
        return {
          id: user._id,
          name: user.displayName,
          avatarUrl: user.avatarUrl,
          status: user.availabilityStatus || "available",
          lastActiveAt: user.lastActiveAt,
        };
      })
    );

    return agents.filter((a) => a !== null && a.status !== "offline");
  },
});