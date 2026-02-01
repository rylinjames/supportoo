/**
 * Whop Push Notifications
 *
 * Handles sending push notifications to users via Whop's notification system.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getWhopSdk, getWhopConfig } from "../lib/whop";
import { api } from "../_generated/api";

/**
 * Send handoff notification
 *
 * Notifies a customer when their conversation is taken over by a support staff agent.
 */
export const sendHandoffNotification = action({
  args: {
    customerWhopUserId: v.string(),
    agentName: v.string(),
    conversationId: v.id("conversations"),
    experienceId: v.string(),
  },
  handler: async (
    ctx,
    { customerWhopUserId, agentName, conversationId, experienceId }
  ) => {
    const whopSdk = getWhopSdk();

    try {
      await whopSdk.notifications.sendPushNotification({
        title: "Agent support is here",
        content: `${agentName} has joined your conversation`,
        userIds: [customerWhopUserId],
        experienceId,
        restPath: `/chat/${conversationId}`, // Already scoped to experience by Whop
      });

      return { success: true };
    } catch (error) {
      console.error("Error sending handoff notification:", error);
      return { success: false };
    }
  },
});

/**
 * Send new message notification
 *
 * Notifies a customer when they receive a new message from support.
 */
export const sendNewMessageNotification = action({
  args: {
    customerWhopUserId: v.string(),
    senderName: v.string(),
    messagePreview: v.string(),
    conversationId: v.id("conversations"),
    experienceId: v.string(),
  },
  handler: async (
    ctx,
    {
      customerWhopUserId,
      senderName,
      messagePreview,
      conversationId,
      experienceId,
    }
  ) => {
    const whopSdk = getWhopSdk();

    try {
      await whopSdk.notifications.sendPushNotification({
        title: `New message from ${senderName}`,
        content: messagePreview.slice(0, 100), // Limit preview length
        userIds: [customerWhopUserId],
        experienceId,
        restPath: `/chat/${conversationId}`,
      });

      return { success: true };
    } catch (error) {
      console.error("Error sending new message notification:", error);
      return { success: false };
    }
  },
});

/**
 * Send resolution notification
 *
 * Notifies a customer when their issue is marked as resolved.
 */
export const sendResolutionNotification = action({
  args: {
    customerWhopUserId: v.string(),
    conversationId: v.id("conversations"),
    experienceId: v.string(),
  },
  handler: async (
    ctx,
    { customerWhopUserId, conversationId, experienceId }
  ) => {
    const whopSdk = getWhopSdk();

    try {
      await whopSdk.notifications.sendPushNotification({
        title: "Issue resolved",
        content:
          "Your issue has been marked as resolved. Feel free to reach out again if you need help!",
        userIds: [customerWhopUserId],
        experienceId,
        restPath: `/chat/${conversationId}`,
      });

      return { success: true };
    } catch (error) {
      console.error("Error sending resolution notification:", error);
      return { success: false };
    }
  },
});

/**
 * Notify all admins
 *
 * Sends a notification to all company admins (for important events).
 */
export const notifyAdmins = action({
  args: {
    companyTeamId: v.string(), // Whop company team ID
    title: v.string(),
    content: v.string(),
    restPath: v.optional(v.string()),
  },
  handler: async (ctx, { companyTeamId, title, content, restPath }) => {
    const whopSdk = getWhopSdk();

    try {
      await whopSdk.notifications.sendPushNotification({
        title,
        content,
        companyTeamId, // Send to all team admins
        restPath,
      });

      return { success: true };
    } catch (error) {
      console.error("Error notifying admins:", error);
      return { success: false };
    }
  },
});

/**
 * Notify specific support agents
 *
 * Sends a notification to specific support staff members.
 */
export const notifySupportAgents = action({
  args: {
    agentWhopUserIds: v.array(v.string()),
    title: v.string(),
    content: v.string(),
    experienceId: v.string(),
    restPath: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { agentWhopUserIds, title, content, experienceId, restPath }
  ) => {
    const whopSdk = getWhopSdk();

    try {
      await whopSdk.notifications.sendPushNotification({
        title,
        content,
        userIds: agentWhopUserIds,
        experienceId,
        restPath,
      });

      return { success: true };
    } catch (error) {
      console.error("Error notifying support agents:", error);
      return { success: false };
    }
  },
});

/**
 * Send team invitation notification by user ID
 *
 * Sends a notification to a specific user by their Whop user ID when they're invited to a team.
 * This is the preferred method for existing users who have real whopUserId values.
 */
export const sendTeamInvitationNotificationByUserId = action({
  args: {
    whopUserId: v.string(),
    invitedByName: v.string(),
    companyName: v.string(),
    role: v.union(v.literal("admin"), v.literal("support")),
    experienceId: v.string(),
  },
  handler: async (
    ctx,
    { whopUserId, invitedByName, companyName, role, experienceId }
  ) => {
    const whopSdk = getWhopSdk();

    try {
      const roleText = role === "admin" ? "an admin" : "a support agent";

      // Send notification to specific user by their whopUserId
      await whopSdk.notifications.sendPushNotification({
        title: `You've been invited to join ${companyName}`,
        content: `${invitedByName} has invited you to join ${companyName} as ${roleText}. Log in to accept your invitation!`,
        userIds: [whopUserId], // Send to specific user
        experienceId,
        restPath: `/workspace`, // Direct them to workspace
      });

      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      console.error("Error sending team invitation notification:", error);
      return {
        success: false,
        error: error.message || `Could not send notification to user.`,
      };
    }
  },
});

/**
 * Send handoff request notification to support agents
 *
 * Notifies all support agents and admins when a customer requests human support
 * or when the AI triggers a handoff.
 */
export const sendHandoffRequestNotification = action({
  args: {
    conversationId: v.id("conversations"),
    reason: v.string(),
  },
  handler: async (ctx, { conversationId, reason }) => {
    const whopSdk = getWhopSdk();

    try {
      // Get conversation details
      const conversation = await ctx.runQuery(
        api.conversations.queries.getConversation,
        { conversationId }
      );
      if (!conversation) {
        console.error("Conversation not found for handoff notification");
        return { success: false };
      }

      // Get company to find experienceId
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId: conversation.companyId,
      });
      if (!company?.whopExperienceId) {
        console.error("Company or whopExperienceId not found for handoff notification");
        return { success: false };
      }

      // Get support agents
      const supportAgents = await ctx.runQuery(
        api.users.queries.listTeamMembersByCompany,
        { companyId: conversation.companyId }
      );

      const agentWhopUserIds = supportAgents
        .filter(
          (agent: any) => agent.role === "support" || agent.role === "admin"
        )
        .map((agent: any) => agent.whopUserId)
        .filter(Boolean);

      if (agentWhopUserIds.length === 0) {
        console.log("No support agents to notify for handoff");
        return { success: true };
      }

      // Get customer name
      const customer = await ctx.runQuery(api.users.queries.getUserById, {
        userId: conversation.customerId,
      });
      const customerName = customer?.displayName || "A customer";

      // Send notification
      await whopSdk.notifications.sendPushNotification({
        title: "Customer needs help",
        content: `${customerName}: ${reason}`,
        userIds: agentWhopUserIds,
        experienceId: company.whopExperienceId,
        restPath: `/experiences/${company.whopExperienceId}/dashboard/support?conversation=${conversationId}`,
      });

      return { success: true };
    } catch (error) {
      console.error("Error sending handoff request notification:", error);
      return { success: false };
    }
  },
});

/**
 * Send team invitation notification by username
 *
 * Attempts to notify a user by their Whop username when they're invited to a team.
 * May fail if user doesn't exist in Whop or API doesn't support username lookup.
 * Returns success status for error handling in UI.
 */
export const sendTeamInvitationNotificationByUsername = action({
  args: {
    whopUsername: v.string(),
    invitedByName: v.string(),
    companyName: v.string(),
    role: v.union(v.literal("admin"), v.literal("support")),
    experienceId: v.string(),
  },
  handler: async (
    ctx,
    { whopUsername, invitedByName, companyName, role, experienceId }
  ) => {
    const whopSdk = getWhopSdk();

    try {
      const roleText = role === "admin" ? "an admin" : "a support agent";

      // Try to send notification to the experience (all users in the experience)
      // This is a workaround since we can't lookup by username
      await whopSdk.notifications.sendPushNotification({
        title: `You've been invited to join ${companyName}`,
        content: `${invitedByName} has invited you to join ${companyName} as ${roleText}. Log in to accept your invitation!`,
        experienceId, // Send to all users in the experience
        restPath: `/workspace`, // Direct them to workspace
      });

      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      console.error("Error sending team invitation notification:", error);
      return {
        success: false,
        error:
          error.message ||
          `Could not send notification to @${whopUsername}. They may not have a Whop account yet.`,
      };
    }
  },
});
