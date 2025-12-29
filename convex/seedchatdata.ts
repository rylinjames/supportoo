/**
 * SEED CHAT DATA
 *
 * Creates realistic mock chat data for testing the Support tab.
 * Includes various conversation states, message types, and agent scenarios.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedChatData = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🌱 Starting chat data seeding...");

    // Get the existing company (we'll use the first one)
    const company = await ctx.db
      .query("companies")
      .withIndex("by_whop_company_id")
      .first();

    if (!company) {
      throw new Error(
        "No company found. Please run the main seed script first."
      );
    }

    console.log(`📋 Using company: ${company.name}`);

    // Create test users (admins, support agents, customers)
    const users = await createTestUsers(ctx, company._id);
    console.log(`👥 Created ${users.length} test users`);

    // Create conversations with realistic scenarios
    const conversations = await createTestConversations(
      ctx,
      company._id,
      users
    );
    console.log(`💬 Created ${conversations.length} test conversations`);

    // Create messages for each conversation
    await createTestMessages(ctx, conversations, users);
    console.log("📝 Created test messages for all conversations");

    console.log("✅ Chat data seeding complete!");
    return {
      success: true,
      usersCreated: users.length,
      conversationsCreated: conversations.length,
    };
  },
});

// ============================================================================
// CREATE TEST USERS
// ============================================================================

async function createTestUsers(ctx: any, companyId: any) {
  const users = [
    // Admins
    {
      whopUserId: "admin_1",
      role: "admin" as const,
      whopUsername: "alex.rivera",
      displayName: "Alex Rivera",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "admin_2",
      role: "admin" as const,
      whopUsername: "sarah.kim",
      displayName: "Sarah Kim",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
    },

    // Support Agents
    {
      whopUserId: "support_1",
      role: "support" as const,
      whopUsername: "mike.chen",
      displayName: "Mike Chen",
      avatarUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "support_2",
      role: "support" as const,
      whopUsername: "jessica.wong",
      displayName: "Jessica Wong",
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "support_3",
      role: "support" as const,
      whopUsername: "david.martinez",
      displayName: "David Martinez",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    },

    // Customers
    {
      whopUserId: "customer_1",
      role: "customer" as const,
      whopUsername: "sarah.johnson",
      displayName: "Sarah Johnson",
      avatarUrl:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "customer_2",
      role: "customer" as const,
      whopUsername: "michael.chen",
      displayName: "Michael Chen",
      avatarUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "customer_3",
      role: "customer" as const,
      whopUsername: "emma.davis",
      displayName: "Emma Davis",
      avatarUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "customer_4",
      role: "customer" as const,
      whopUsername: "james.wilson",
      displayName: "James Wilson",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "customer_5",
      role: "customer" as const,
      whopUsername: "olivia.martinez",
      displayName: "Olivia Martinez",
      avatarUrl:
        "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "customer_6",
      role: "customer" as const,
      whopUsername: "daniel.brown",
      displayName: "Daniel Brown",
      avatarUrl:
        "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "customer_7",
      role: "customer" as const,
      whopUsername: "sophia.lee",
      displayName: "Sophia Lee",
      avatarUrl:
        "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face",
    },
    {
      whopUserId: "customer_8",
      role: "customer" as const,
      whopUsername: "liam.taylor",
      displayName: "Liam Taylor",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    },
  ];

  const createdUsers = [];
  for (const userData of users) {
    const userId = await ctx.db.insert("users", {
      companyId,
      whopUserId: userData.whopUserId,
      role: userData.role,
      roleLastChecked: Date.now(),
      whopUsername: userData.whopUsername,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl,
      timezone: "America/New_York",
      theme: "system",
      notificationsEnabled: true,
      lastActiveAt: Date.now(),
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    createdUsers.push({
      _id: userId,
      ...userData,
    });
  }

  return createdUsers;
}

// ============================================================================
// CREATE TEST CONVERSATIONS
// ============================================================================

async function createTestConversations(ctx: any, companyId: any, users: any[]) {
  const now = Date.now();
  const customers = users.filter((u) => u.role === "customer");
  const agents = users.filter(
    (u) => u.role === "support" || u.role === "admin"
  );

  const conversationScenarios = [
    // Available conversations (urgent, need pickup)
    {
      customer: customers[0], // Sarah Johnson
      status: "available" as const,
      handoffReason: "User requested support staff help",
      handoffTriggeredAt: now - 15 * 60 * 1000, // 15 minutes ago
      lastMessageAt: now - 5 * 60 * 1000, // 5 minutes ago
      firstMessageAt: now - 45 * 60 * 1000, // 45 minutes ago
      messageCount: 6,
      participatingAgents: [],
    },
    {
      customer: customers[1], // Michael Chen
      status: "available" as const,
      handoffReason: "Billing question detected",
      handoffTriggeredAt: now - 8 * 60 * 1000, // 8 minutes ago
      lastMessageAt: now - 3 * 60 * 1000, // 3 minutes ago
      firstMessageAt: now - 20 * 60 * 1000, // 20 minutes ago
      messageCount: 4,
      participatingAgents: [],
    },
    {
      customer: customers[2], // Emma Davis
      status: "available" as const,
      handoffReason: "Complex account modification",
      handoffTriggeredAt: now - 2 * 60 * 1000, // 2 minutes ago
      lastMessageAt: now - 1 * 60 * 1000, // 1 minute ago
      firstMessageAt: now - 25 * 60 * 1000, // 25 minutes ago
      messageCount: 8,
      participatingAgents: [],
    },

    // AI handling conversations
    {
      customer: customers[3], // James Wilson
      status: "ai_handling" as const,
      lastMessageAt: now - 10 * 60 * 1000, // 10 minutes ago
      firstMessageAt: now - 2 * 60 * 60 * 1000, // 2 hours ago
      messageCount: 12,
      participatingAgents: [],
    },
    {
      customer: customers[4], // Olivia Martinez
      status: "ai_handling" as const,
      lastMessageAt: now - 5 * 60 * 1000, // 5 minutes ago
      firstMessageAt: now - 90 * 60 * 1000, // 90 minutes ago
      messageCount: 6,
      participatingAgents: [],
    },
    {
      customer: customers[5], // Daniel Brown
      status: "ai_handling" as const,
      lastMessageAt: now - 30 * 60 * 1000, // 30 minutes ago
      firstMessageAt: now - 3 * 60 * 60 * 1000, // 3 hours ago
      messageCount: 15,
      participatingAgents: [],
    },

    // Support staff handling conversations
    {
      customer: customers[6], // Sophia Lee
      status: "support_staff_handling" as const,
      lastMessageAt: now - 2 * 60 * 1000, // 2 minutes ago
      firstMessageAt: now - 4 * 60 * 60 * 1000, // 4 hours ago
      messageCount: 20,
      participatingAgents: [agents[2]._id], // Mike Chen
      lastAgentMessage: now - 5 * 60 * 1000, // 5 minutes ago
    },
    {
      customer: customers[7], // Liam Taylor
      status: "support_staff_handling" as const,
      lastMessageAt: now - 15 * 60 * 1000, // 15 minutes ago
      firstMessageAt: now - 6 * 60 * 60 * 1000, // 6 hours ago
      messageCount: 25,
      participatingAgents: [agents[3]._id, agents[4]._id], // Jessica Wong, David Martinez
      lastAgentMessage: now - 20 * 60 * 1000, // 20 minutes ago
    },
  ];

  const createdConversations: any[] = [];
  for (const scenario of conversationScenarios) {
    const conversationId = await ctx.db.insert("conversations", {
      companyId,
      customerId: scenario.customer._id,
      status: scenario.status,
      handoffTriggeredAt: scenario.handoffTriggeredAt,
      handoffReason: scenario.handoffReason,
      messageCount: scenario.messageCount,
      lastMessageAt: scenario.lastMessageAt,
      firstMessageAt: scenario.firstMessageAt,
      participatingAgents: scenario.participatingAgents,
      lastAgentMessage: scenario.lastAgentMessage,
      aiProcessing: false,
      createdAt: scenario.firstMessageAt,
      updatedAt: scenario.lastMessageAt,
    });

    createdConversations.push({
      _id: conversationId,
      customer: scenario.customer,
      agents: scenario.participatingAgents
        .map((id: any) => agents.find((a: any) => a._id === id))
        .filter(Boolean),
      companyId,
      status: scenario.status,
      handoffTriggeredAt: scenario.handoffTriggeredAt,
      handoffReason: scenario.handoffReason,
      messageCount: scenario.messageCount,
      lastMessageAt: scenario.lastMessageAt,
      firstMessageAt: scenario.firstMessageAt,
      participatingAgents: scenario.participatingAgents,
      lastAgentMessage: scenario.lastAgentMessage,
    });
  }

  return createdConversations;
}

// ============================================================================
// CREATE TEST MESSAGES
// ============================================================================

async function createTestMessages(
  ctx: any,
  conversations: any[],
  users: any[]
) {
  const agents = users.filter(
    (u) => u.role === "support" || u.role === "admin"
  );

  for (const conversation of conversations) {
    const messages = generateMessageThread(conversation, agents);

    for (const messageData of messages) {
      await ctx.db.insert("messages", {
        conversationId: conversation._id,
        companyId: conversation.companyId,
        role: messageData.role,
        content: messageData.content,
        timestamp: messageData.timestamp,
        agentId: messageData.agentId,
        agentName: messageData.agentName,
        aiModel: messageData.aiModel,
        tokensUsed: messageData.tokensUsed,
        processingTime: messageData.processingTime,
        systemMessageType: messageData.systemMessageType,
        readByAgentAt: messageData.readByAgentAt,
        readByCustomerAt: messageData.readByCustomerAt,
      });
    }
  }
}

// ============================================================================
// GENERATE MESSAGE THREADS
// ============================================================================

function generateMessageThread(conversation: any, agents: any[]): any[] {
  const startTime = conversation.firstMessageAt;
  const endTime = conversation.lastMessageAt;

  // Generate realistic message flow based on conversation type
  if (conversation.status === "available") {
    return generateAvailableConversationMessages(
      conversation,
      agents,
      startTime,
      endTime
    );
  } else if (conversation.status === "ai_handling") {
    return generateAIHandlingMessages(conversation, agents, startTime, endTime);
  } else if (conversation.status === "support_staff_handling") {
    return generateSupportStaffHandlingMessages(
      conversation,
      agents,
      startTime,
      endTime
    );
  }

  return [];
}

function generateAvailableConversationMessages(
  conversation: any,
  agents: any[],
  startTime: number,
  endTime: number
): any[] {
  const messages: any[] = [];
  const customer = conversation.customer;
  let currentTime = startTime;

  // Customer initial message
  const customerMessages = [
    "I was charged $99 but I only signed up for the free plan! This is completely wrong.",
    "My payment failed and I need to update my billing info ASAP. Can someone help me?",
    "I'm trying to upgrade my plan but I'm confused about the pricing. Can I speak to someone?",
  ];

  messages.push({
    role: "customer",
    content:
      customerMessages[Math.floor(Math.random() * customerMessages.length)],
    timestamp: currentTime,
    readByAgentAt: undefined,
    readByCustomerAt: currentTime + 1000,
  });

  currentTime += 2 * 60 * 1000; // 2 minutes later

  // AI response
  const aiResponses = [
    "I understand your concern about the billing charge. Let me help you resolve this issue. Could you please provide me with your account email so I can look into this?",
    "I can definitely help you update your billing information. For security reasons, I'll need to verify your account details first.",
    "I'd be happy to help you understand our pricing options. Our Pro plan includes unlimited conversations and priority support for $19/month.",
  ];

  messages.push({
    role: "ai",
    content: aiResponses[Math.floor(Math.random() * aiResponses.length)],
    timestamp: currentTime,
    aiModel: "gpt-4o-mini",
    tokensUsed: 45,
    processingTime: 2500,
    readByCustomerAt: currentTime + 5000,
  });

  currentTime += 3 * 60 * 1000; // 3 minutes later

  // Customer frustrated response
  const frustratedResponses = [
    "This is ridiculous! I want to speak to support staff right now!",
    "This isn't helping. I need to talk to someone who can actually fix this.",
    "I've been waiting for hours. Can I please speak to a real person?",
  ];

  messages.push({
    role: "customer",
    content:
      frustratedResponses[
        Math.floor(Math.random() * frustratedResponses.length)
      ],
    timestamp: currentTime,
    readByAgentAt: undefined,
    readByCustomerAt: currentTime + 1000,
  });

  currentTime += 1 * 60 * 1000; // 1 minute later

  // AI handoff response
  messages.push({
    role: "ai",
    content:
      "I understand your frustration. Let me connect you with our support team who can better assist you with this matter.",
    timestamp: currentTime,
    aiModel: "gpt-4o-mini",
    tokensUsed: 32,
    processingTime: 1800,
  });

  currentTime += 30 * 1000; // 30 seconds later

  // System handoff message
  messages.push({
    role: "system",
    content: `Conversation handed off to support staff.`,
    timestamp: currentTime,
    systemMessageType: "handoff",
  });

  return messages;
}

function generateAIHandlingMessages(
  conversation: any,
  agents: any[],
  startTime: number,
  endTime: number
): any[] {
  const messages: any[] = [];
  const customer = conversation.customer;
  let currentTime = startTime;

  // Generate a back-and-forth conversation with AI
  const conversationTopics = [
    {
      customer: "How do I integrate your API with my React application?",
      ai: "I'd be happy to help you integrate our API with React! Here's a step-by-step guide:\n\n1. Install our SDK: `npm install @yourcompany/api-sdk`\n2. Initialize the client with your API key\n3. Use our React hooks for easy integration\n\nWould you like me to show you a specific example?",
    },
    {
      customer:
        "I'm getting a CORS error when trying to make requests. What should I do?",
      ai: "CORS errors are common with API integrations. Here are the solutions:\n\n1. Make sure you're using the correct API endpoint\n2. Check that your API key is valid\n3. Ensure your domain is whitelisted in our dashboard\n\nCan you share the specific error message you're seeing?",
    },
    {
      customer:
        "Perfect! That solved it. One more question - how do I handle rate limiting?",
      ai: "Great question! Our API has rate limits to ensure fair usage:\n\n- Free tier: 100 requests/hour\n- Pro tier: 1,000 requests/hour\n- Enterprise: Custom limits\n\nWe also provide rate limit headers in responses. Would you like me to show you how to handle them in your code?",
    },
  ];

  for (let i = 0; i < conversationTopics.length; i++) {
    const topic = conversationTopics[i];

    // Customer message
    messages.push({
      role: "customer",
      content: topic.customer,
      timestamp: currentTime,
      readByAgentAt: undefined,
      readByCustomerAt: currentTime + 2000,
    });

    currentTime += 2 * 60 * 1000; // 2 minutes later

    // AI response
    messages.push({
      role: "ai",
      content: topic.ai,
      timestamp: currentTime,
      aiModel: "gpt-4o-mini",
      tokensUsed: 85,
      processingTime: 3200,
      readByCustomerAt: currentTime + 8000,
    });

    currentTime += 3 * 60 * 1000; // 3 minutes later
  }

  return messages;
}

function generateSupportStaffHandlingMessages(
  conversation: any,
  agents: any[],
  startTime: number,
  endTime: number
): any[] {
  const messages: any[] = [];
  const customer = conversation.customer;
  let currentTime = startTime;

  // Initial customer message
  messages.push({
    role: "customer",
    content:
      "I need help upgrading my plan but I'm not sure which one is right for my business.",
    timestamp: currentTime,
    readByAgentAt: undefined,
    readByCustomerAt: currentTime + 1000,
  });

  currentTime += 2 * 60 * 1000;

  // AI initial response
  messages.push({
    role: "ai",
    content:
      "I can help you choose the right plan! Could you tell me a bit about your business size and expected usage?",
    timestamp: currentTime,
    aiModel: "gpt-4o-mini",
    tokensUsed: 35,
    processingTime: 2000,
    readByCustomerAt: currentTime + 5000,
  });

  currentTime += 5 * 60 * 1000;

  // Customer detailed response
  messages.push({
    role: "customer",
    content:
      "We're a growing startup with about 50 employees. We expect around 500 customer conversations per month. We also need priority support and custom integrations.",
    timestamp: currentTime,
    readByAgentAt: undefined,
    readByCustomerAt: currentTime + 1000,
  });

  currentTime += 2 * 60 * 1000;

  // System handoff message
  messages.push({
    role: "system",
    content:
      "Conversation handed off to support staff. Reason: Complex account modification",
    timestamp: currentTime,
    systemMessageType: "handoff",
  });

  currentTime += 30 * 1000;

  // Agent joins
  const agent = conversation.agents[0];
  messages.push({
    role: "agent",
    content: `Hi ${customer.displayName}! I'm ${agent.displayName} from our sales team. I'd be happy to help you find the perfect plan for your startup. Based on your needs, I'd recommend our Elite plan.`,
    timestamp: currentTime,
    agentId: agent._id,
    agentName: agent.displayName,
    readByCustomerAt: currentTime + 10000,
  });

  currentTime += 3 * 60 * 1000;

  // Customer response
  messages.push({
    role: "customer",
    content: "Great! Can you tell me more about the Elite plan features?",
    timestamp: currentTime,
    readByAgentAt: currentTime + 5000,
    readByCustomerAt: currentTime + 1000,
  });

  currentTime += 2 * 60 * 1000;

  // Agent detailed response
  messages.push({
    role: "agent",
    content:
      "Absolutely! The Elite plan includes:\n\n• 25,000 AI responses/month\n• Unlimited support staff agents\n• Priority support (1-hour response time)\n• Custom integrations\n• Advanced analytics\n• White-label options\n\nAll for $49/month. Would you like me to set this up for you?",
    timestamp: currentTime,
    agentId: agent._id,
    agentName: agent.displayName,
    readByCustomerAt: currentTime + 15000,
  });

  return messages;
}
