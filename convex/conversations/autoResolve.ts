import { internalMutation } from "../_generated/server";

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const autoResolveStaleConversations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - STALE_THRESHOLD_MS;

    const staleConversations = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "resolved"),
          q.lt(q.field("lastMessageAt"), cutoff)
        )
      )
      .collect();

    let resolvedCount = 0;
    for (const conv of staleConversations) {
      await ctx.db.patch(conv._id, {
        status: "resolved",
        updatedAt: now,
      });

      await ctx.db.insert("messages", {
        conversationId: conv._id,
        companyId: conv.companyId,
        role: "system",
        content: "This conversation was automatically resolved after 7 days of inactivity.",
        timestamp: now,
        systemMessageType: "auto_resolved",
      });

      resolvedCount++;
      console.log(`  Auto-resolved: ${conv._id} (last message ${Math.round((now - conv.lastMessageAt) / (24 * 60 * 60 * 1000))} days ago)`);
    }

    if (resolvedCount > 0) {
      console.log(`✅ Auto-resolved ${resolvedCount} stale conversations`);
    }

    return { success: true, resolvedCount };
  },
});
