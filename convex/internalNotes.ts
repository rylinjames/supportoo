import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get internal notes for a conversation
export const getNotes = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Check if user is an agent
    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();

    if (!user) return null;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    // Only agents can see internal notes
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", user._id).eq("companyId", conversation.companyId)
      )
      .first();

    if (!userCompany || userCompany.role === "customer") {
      return null; // Customers cannot see internal notes
    }

    let updatedByName = null;
    if (conversation.internalNotesUpdatedBy) {
      const updatedBy = await ctx.db.get(conversation.internalNotesUpdatedBy);
      updatedByName = updatedBy?.displayName;
    }

    return {
      notes: conversation.internalNotes,
      updatedBy: updatedByName,
      updatedAt: conversation.internalNotesUpdatedAt,
    };
  },
});

// Update internal notes for a conversation
export const updateNotes = mutation({
  args: {
    conversationId: v.id("conversations"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Check if user is an agent for this company
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", user._id).eq("companyId", conversation.companyId)
      )
      .first();

    if (!userCompany || userCompany.role === "customer") {
      throw new Error("Only agents can update internal notes");
    }

    // Update the notes
    await ctx.db.patch(args.conversationId, {
      internalNotes: args.notes,
      internalNotesUpdatedBy: user._id,
      internalNotesUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});