import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// Create a new agent phrase
export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("greeting"),
      v.literal("solution"),
      v.literal("followup"),
      v.literal("closing"),
      v.literal("general")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    // Create the agent phrase
    return await ctx.db.insert("agentPhrases", {
      agentId: user._id,
      title: args.title,
      content: args.content,
      category: args.category,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get all phrases for the current agent
export const getMyPhrases = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();
    
    if (!user) return [];

    const phrases = await ctx.db
      .query("agentPhrases")
      .withIndex("by_agent", (q) => q.eq("agentId", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return phrases;
  },
});

// Update an agent phrase
export const update = mutation({
  args: {
    phraseId: v.id("agentPhrases"),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("greeting"),
      v.literal("solution"),
      v.literal("followup"),
      v.literal("closing"),
      v.literal("general")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    // Verify ownership
    const phrase = await ctx.db.get(args.phraseId);
    if (!phrase || phrase.agentId !== user._id) {
      throw new Error("Phrase not found or unauthorized");
    }

    // Update the phrase
    return await ctx.db.patch(args.phraseId, {
      title: args.title,
      content: args.content,
      category: args.category,
      updatedAt: Date.now(),
    });
  },
});

// Delete an agent phrase (soft delete)
export const remove = mutation({
  args: {
    phraseId: v.id("agentPhrases"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    // Verify ownership
    const phrase = await ctx.db.get(args.phraseId);
    if (!phrase || phrase.agentId !== user._id) {
      throw new Error("Phrase not found or unauthorized");
    }

    // Soft delete
    return await ctx.db.patch(args.phraseId, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

// Get phrases by category
export const getByCategory = query({
  args: {
    category: v.union(
      v.literal("greeting"),
      v.literal("solution"),
      v.literal("followup"),
      v.literal("closing"),
      v.literal("general")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();
    
    if (!user) return [];

    const phrases = await ctx.db
      .query("agentPhrases")
      .withIndex("by_agent_category", (q) => 
        q.eq("agentId", user._id).eq("category", args.category)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return phrases;
  },
});