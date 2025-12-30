import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed script to populate initial data
 * Run once with: npx convex run seed:seedInitialData
 */

export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🌱 Starting seed...");

    // Check if plans already exist
    const existingPlans = await ctx.db.query("plans").collect();
    if (existingPlans.length > 0) {
      console.log("⚠️  Plans already exist. Skipping seed.");
      return { success: false, message: "Data already seeded" };
    }

    // =====================
    // SEED PLANS
    // =====================
    console.log("📦 Seeding plans...");

    const freePlanId = await ctx.db.insert("plans", {
      name: "free",
      price: 0,
      whopPlanId: "plan_Fj2mgLWut4G8J", // Whop Free plan

      // AI Configuration
      aiModels: ["gpt-5-nano"],
      aiResponsesPerMonth: 20,

      // Features
      hasTemplates: false,
      hasInsights: false,
      hasPrioritySupport: false,
      hasCustomTriggers: false,
      hasFileAttachments: false,

      // Limits
      maxAgents: 3,
      maxConversations: -1, // Unlimited
    });

    const proPlanId = await ctx.db.insert("plans", {
      name: "pro",
      price: 1900, // $19 in cents
      whopPlanId: "plan_9mdGo5MNCGo0J", // Whop Pro plan

      // AI Configuration
      aiModels: ["gpt-5-nano", "gpt-5-mini"],
      aiResponsesPerMonth: 5000,

      // Features
      hasTemplates: true,
      hasInsights: true,
      hasPrioritySupport: true,
      hasCustomTriggers: true, // ✅ Pro gets custom triggers!
      hasFileAttachments: true, // ✅ Pro gets file attachments!

      // Limits
      maxAgents: 10,
      maxConversations: -1,
    });

    const elitePlanId = await ctx.db.insert("plans", {
      name: "elite",
      price: 4900, // $49 in cents
      whopPlanId: "plan_8ZkuyDwyYbNos", // Whop Elite plan

      // AI Configuration
      aiModels: ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
      aiResponsesPerMonth: 25000,

      // Features
      hasTemplates: true,
      hasInsights: true,
      hasPrioritySupport: true,
      hasCustomTriggers: true,
      hasFileAttachments: true,

      // Limits
      maxAgents: -1, // Unlimited
      maxConversations: -1,
    });

    console.log(`✅ Created 3 plans`);

    // =====================
    // SEED DEFAULT TEMPLATES
    // =====================
    console.log("📝 Seeding default templates...");

    // Note: These are global templates, not tied to a company
    // Companies will copy these when they sign up
    // We'll store them with a special companyId of "default"

    const defaultTemplates = [
      // GREETING CATEGORY
      {
        name: "Welcome Message",
        content:
          "Hi {firstName}! Thanks for reaching out to {companyName}. How can I help you today?",
        category: "greeting",
        description: "Initial greeting for new conversations",
      },
      {
        name: "Follow-up Greeting",
        content: "Thanks for getting back to us! Let me help you with that.",
        category: "greeting",
        description: "Greeting for returning customers",
      },

      // ESCALATION CATEGORY
      {
        name: "Escalating to Team",
        content:
          "Let me connect you with our support team who can help you better with this.",
        category: "escalation",
        description: "General escalation to support staff",
      },
      {
        name: "Billing Escalation",
        content:
          "I'm connecting you with our billing specialist who can assist you with this.",
        category: "escalation",
        description: "Escalation for billing-related issues",
      },

      // RESOLUTION CATEGORY
      {
        name: "Issue Resolved",
        content:
          "Great! I'm glad we could help resolve this for you. Is there anything else I can assist you with?",
        category: "resolution",
        description: "Confirmation that issue is resolved",
      },
      {
        name: "Following Up",
        content:
          "Just following up to make sure everything is working well for you now.",
        category: "resolution",
        description: "Follow-up after resolution",
      },

      // GENERAL CATEGORY
      {
        name: "Need More Info",
        content:
          "To help you better, could you provide a bit more detail about {issue}?",
        category: "general",
        description: "Request for additional information",
      },
      {
        name: "Checking on Status",
        content: "Let me check on that for you. One moment please...",
        category: "general",
        description: "Acknowledge request while looking up info",
      },
    ];

    // Store as metadata for companies to copy during onboarding
    // We'll create a separate collection or just document this
    console.log(
      `📋 Default templates defined: ${defaultTemplates.length} templates`
    );
    console.log(
      `   Note: Companies will get these templates during onboarding`
    );

    // =====================
    // DONE
    // =====================
    console.log("✨ Seed complete!");

    return {
      success: true,
      message: "Successfully seeded initial data",
      data: {
        plans: {
          free: freePlanId,
          pro: proPlanId,
          elite: elitePlanId,
        },
        defaultTemplates: defaultTemplates.length,
      },
    };
  },
});

/**
 * Helper: Get default templates for a company
 * Call this during company onboarding to copy default templates
 */
export const getDefaultTemplates = () => {
  return [
    // GREETING
    {
      name: "Welcome Message",
      content:
        "Hi {firstName}! Thanks for reaching out to {companyName}. How can I help you today?",
      category: "greeting",
      description: "Initial greeting for new conversations",
    },
    {
      name: "Follow-up Greeting",
      content: "Thanks for getting back to us! Let me help you with that.",
      category: "greeting",
      description: "Greeting for returning customers",
    },

    // ESCALATION
    {
      name: "Escalating to Team",
      content:
        "Let me connect you with our support team who can help you better with this.",
      category: "escalation",
      description: "General escalation to support staff",
    },
    {
      name: "Billing Escalation",
      content:
        "I'm connecting you with our billing specialist who can assist you with this.",
      category: "escalation",
      description: "Escalation for billing-related issues",
    },

    // RESOLUTION
    {
      name: "Issue Resolved",
      content:
        "Great! I'm glad we could help resolve this for you. Is there anything else I can assist you with?",
      category: "resolution",
      description: "Confirmation that issue is resolved",
    },
    {
      name: "Following Up",
      content:
        "Just following up to make sure everything is working well for you now.",
      category: "resolution",
      description: "Follow-up after resolution",
    },

    // GENERAL
    {
      name: "Need More Info",
      content:
        "To help you better, could you provide a bit more detail about {issue}?",
      category: "general",
      description: "Request for additional information",
    },
    {
      name: "Checking on Status",
      content: "Let me check on that for you. One moment please...",
      category: "general",
      description: "Acknowledge request while looking up info",
    },
  ];
};
