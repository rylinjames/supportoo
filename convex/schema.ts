import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Complete Database Schema for AI Support Agent
 *
 * Multi-tenant architecture with companyId on every table
 * Real-time sync with Convex live queries
 * Optimized indexes for common query patterns
 */

export default defineSchema({
  // ============================================================================
  // PLANS - Subscription tiers
  // ============================================================================
  plans: defineTable({
    name: v.union(v.literal("free"), v.literal("pro"), v.literal("elite")),
    price: v.number(), // Monthly price in cents

    // Whop integration
    whopPlanId: v.optional(v.string()), // Whop's plan ID (null for free plan)

    // AI Configuration
    aiModels: v.array(v.string()), // Available AI models (e.g., ["gpt-3.5-turbo"])
    aiResponsesPerMonth: v.number(),

    // Features
    hasTemplates: v.boolean(),
    hasInsights: v.boolean(),
    hasPrioritySupport: v.boolean(),
    hasCustomTriggers: v.boolean(),
    hasFileAttachments: v.boolean(),

    // Limits
    maxAgents: v.number(),
    maxConversations: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_whop_plan_id", ["whopPlanId"]),

  // ============================================================================
  // COMPANIES - Multi-tenant root
  // ============================================================================
  companies: defineTable({
    // Core company info
    whopCompanyId: v.string(), // Whop's company ID
    whopExperienceId: v.optional(v.string()), // Experience ID for this company's app installation
    name: v.string(),
    domain: v.optional(v.string()),
    timezone: v.string(),

    // Plan & Billing
    planId: v.id("plans"),
    billingStatus: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),

    // Whop billing integration
    whopMembershipId: v.optional(v.string()), // Links to Whop subscription
    lastPaymentAt: v.optional(v.number()),

    // Usage tracking
    aiResponsesThisMonth: v.number(),
    aiResponsesResetAt: v.number(),
    usageWarningSent: v.optional(v.boolean()), // True if 80% warning sent this cycle

    // Scheduled plan changes (for cancellations)
    scheduledPlanChangeAt: v.optional(v.number()), // When to execute change
    scheduledPlanId: v.optional(v.id("plans")), // What plan to change to

    // AI Configuration
    aiPersonality: v.union(
      v.literal("professional"),
      v.literal("friendly"),
      v.literal("casual"),
      v.literal("technical")
    ),
    aiResponseLength: v.union(
      v.literal("brief"),
      v.literal("medium"),
      v.literal("detailed")
    ),
    aiSystemPrompt: v.string(),
    aiHandoffTriggers: v.array(v.string()),
    selectedAiModel: v.string(), // Selected from plan's available models

    // Company context
    companyContextOriginal: v.string(), // Raw text for editing
    companyContextProcessed: v.string(), // AI-condensed version
    companyContextFileId: v.optional(v.id("company_context_files")),
    companyContextLastUpdated: v.number(),

    // OpenAI Assistants API
    openaiAssistantId: v.optional(v.string()), // OpenAI Assistant ID (created per company)
    openaiVectorStoreId: v.optional(v.string()), // Vector Store ID for company knowledge base
    openaiContextFileId: v.optional(v.string()), // Current context file ID in Vector Store
    testAssistantId: v.optional(v.string()), // Cached test assistant ID (for AI Studio testing)

    // Onboarding status
    onboardingCompleted: v.boolean(),
    setupWizardCompleted: v.boolean(),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_whop_company_id", ["whopCompanyId"])
    .index("by_whop_experience_id", ["whopExperienceId"])
    .index("by_plan", ["planId"])
    .index("by_billing_status", ["billingStatus"]),

  // ============================================================================
  // USERS - All user types (admin, support, customer)
  // ============================================================================
  users: defineTable({
    // Whop integration
    whopUserId: v.string(),

    // User info (from Whop)
    whopUsername: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),

    // DEPRECATED: These fields are kept for backwards compatibility with existing data
    // Use user_companies junction table instead. Will be cleaned up in future migration.
    companyId: v.optional(v.id("companies")),
    role: v.optional(
      v.union(v.literal("admin"), v.literal("support"), v.literal("customer"))
    ),

    // Role verification timestamp
    roleLastChecked: v.number(), // When we last verified with Whop

    // User preferences
    timezone: v.string(),
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    notificationsEnabled: v.boolean(),

    // Agent-specific settings
    agentGreeting: v.optional(v.string()), // Custom greeting when joining conversations
    autoGreetingEnabled: v.optional(v.boolean()), // Whether to auto-send greeting
    availabilityStatus: v.optional(v.union(
      v.literal("available"),
      v.literal("busy"),
      v.literal("offline")
    )),
    awayMessage: v.optional(v.string()), // Custom away message when busy/offline

    // Activity tracking
    lastActiveAt: v.number(),
    lastLoginAt: v.number(),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_whop_user_id", ["whopUserId"])
    .index("by_whop_username", ["whopUsername"]),

  // ============================================================================
  // USER_COMPANIES - Junction table for multi-company support
  // ============================================================================
  user_companies: defineTable({
    // Relationships
    userId: v.id("users"),
    companyId: v.id("companies"),

    // Role in this specific company
    role: v.union(
      v.literal("admin"),      // Full access to everything
      v.literal("manager"),    // Manage team, AI, insights (no billing)
      v.literal("support"),    // Handle support tickets
      v.literal("viewer"),     // Read-only access to support & insights
      v.literal("customer")    // Can only view their own tickets
    ),

    // Timestamps
    joinedAt: v.number(), // When user joined this company
    lastActiveInCompany: v.number(), // Last time user was active in this company

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_company", ["companyId"])
    .index("by_user_company", ["userId", "companyId"]) // Compound for unique lookups
    .index("by_company_role", ["companyId", "role"]) // For team member queries
    .index("by_last_active", ["lastActiveInCompany"]), // For default company selection

  // ============================================================================
  // CONVERSATIONS - Chat sessions
  // ============================================================================
  conversations: defineTable({
    // Relationships
    companyId: v.id("companies"),
    customerId: v.id("users"),

    // Status & flow
    status: v.union(
      v.literal("ai_handling"),
      v.literal("available"),
      v.literal("support_staff_handling"),
      v.literal("resolved")
    ),
    handoffTriggeredAt: v.optional(v.number()),
    handoffReason: v.optional(v.string()), // e.g., "User requested support staff", "Billing question"

    // Conversation metadata
    messageCount: v.number(),
    lastMessageAt: v.number(),
    firstMessageAt: v.number(),

    // Agent participation (group chat model)
    participatingAgents: v.array(v.id("users")),
    lastAgentMessage: v.optional(v.number()),

    // AI processing state
    aiProcessing: v.boolean(),
    aiProcessingStartedAt: v.optional(v.number()),

    // Debouncing
    pendingAIJobId: v.optional(v.id("_scheduled_functions")),

    // OpenAI Assistants API
    openaiThreadId: v.optional(v.string()), // Maps to OpenAI Thread for this conversation

    // Rolling summarization
    summary: v.optional(v.string()),
    lastSummaryAt: v.optional(v.number()),
    lastSummaryMessageCount: v.optional(v.number()),

    // Internal notes (only visible to agents)
    internalNotes: v.optional(v.string()),
    internalNotesUpdatedBy: v.optional(v.id("users")),
    internalNotesUpdatedAt: v.optional(v.number()),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company_status", ["companyId", "status"])
    .index("by_company_customer", ["companyId", "customerId"])
    .index("by_company_updated", ["companyId", "updatedAt"])
    .index("by_status", ["status"]),

  // ============================================================================
  // MESSAGES - Individual messages in conversations
  // ============================================================================
  messages: defineTable({
    // Relationships
    conversationId: v.id("conversations"),
    companyId: v.id("companies"), // Denormalized for performance

    // Message content
    role: v.union(
      v.literal("customer"),
      v.literal("ai"),
      v.literal("agent"),
      v.literal("system")
    ),
    content: v.string(),

    // Sender info (for agent messages)
    agentId: v.optional(v.id("users")),
    agentName: v.optional(v.string()), // Denormalized for performance

    // AI metadata (for ai messages)
    aiModel: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    processingTime: v.optional(v.number()),

    // Message metadata
    timestamp: v.number(),

    // Read receipts (for customer/agent messages only, not AI/system)
    readByAgentAt: v.optional(v.number()), // When ANY agent first read this message
    readByCustomerAt: v.optional(v.number()), // When customer first read this message

    // File attachments (Elite plan only)
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),

    // System message context
    systemMessageType: v.optional(
      v.union(
        v.literal("handoff"),
        v.literal("agent_joined"),
        v.literal("agent_left"),
        v.literal("issue_resolved")
      )
    ),
  })
    .index("by_conversation", ["conversationId", "timestamp"])
    .index("by_company", ["companyId", "timestamp"])
    // Compound indexes for efficient unread message queries
    .index("by_conversation_role_unread_agent", [
      "conversationId",
      "role",
      "readByAgentAt",
    ])
    .index("by_conversation_role_unread_customer", [
      "conversationId",
      "role",
      "readByCustomerAt",
    ]),

  // ============================================================================
  // TEMPLATES - Quick reply templates
  // ============================================================================
  templates: defineTable({
    // Relationships
    companyId: v.id("companies"),
    createdBy: v.id("users"),

    // Template content
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("greeting"),
      v.literal("escalation"),
      v.literal("resolution"),
      v.literal("general")
    ),

    // Usage tracking
    usageCount: v.number(),
    lastUsedAt: v.optional(v.number()),
    lastUsedBy: v.optional(v.id("users")),

    // Template management
    isActive: v.boolean(),
    isDefault: v.boolean(), // System-created vs user-created

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company_category", ["companyId", "category"])
    .index("by_company_active", ["companyId", "isActive"])
    .index("by_creator", ["createdBy"]),

  // ============================================================================
  // AGENT PHRASES - Personal quick replies for support agents
  // ============================================================================
  agentPhrases: defineTable({
    // Relationships
    agentId: v.id("users"), // The agent who owns this phrase

    // Phrase content
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("greeting"),
      v.literal("solution"),
      v.literal("followup"),
      v.literal("closing"),
      v.literal("general")
    ),

    // Management
    isActive: v.boolean(),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_category", ["agentId", "category"])
    .index("by_active", ["isActive"]),

  // ============================================================================
  // USAGE RECORDS - AI response usage tracking
  // ============================================================================
  usageRecords: defineTable({
    // Relationships
    companyId: v.id("companies"),

    // Usage tracking
    period: v.string(), // "2024-01" format
    aiResponses: v.number(), // Total AI messages sent this month

    // Usage breakdown by time
    dailyUsage: v.object({}), // { "2024-01-15": 25 }
    hourlyUsage: v.object({}), // { "2024-01-15-14": 3 }

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company_period", ["companyId", "period"])
    .index("by_period", ["period"]),

  // ============================================================================
  // FILES - Chat attachments (images)
  // ============================================================================
  files: defineTable({
    // Relationships
    companyId: v.id("companies"),
    uploadedBy: v.id("users"),
    conversationId: v.optional(v.id("conversations")),

    // File info
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    fileUrl: v.string(), // UploadThing URL

    // File restrictions
    fileType: v.literal("image"), // Only images for Elite plan
    maxSize: v.number(), // 2MB limit

    // Processing status
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    processedText: v.optional(v.string()),
    processingError: v.optional(v.string()),

    // AI analysis results
    aiAnalysis: v.optional(
      v.object({
        description: v.optional(v.string()),
        extractedText: v.optional(v.string()),
        confidence: v.optional(v.number()),
      })
    ),

    // Metadata
    uploadedAt: v.number(),
    processedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_uploader", ["uploadedBy"])
    .index("by_status", ["status"])
    .index("by_conversation", ["conversationId"]),

  // ============================================================================
  // COMPANY CONTEXT FILES - Company knowledge base documents
  // ============================================================================
  company_context_files: defineTable({
    // Relationships
    companyId: v.id("companies"),
    uploadedBy: v.id("users"),

    // File info
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    fileUrl: v.string(), // UploadThing URL
    fileKey: v.string(), // UploadThing key (for deletion)

    // Metadata
    uploadedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_uploader", ["uploadedBy"]),

  // ============================================================================
  // PRESENCE - Real-time typing indicators
  // ============================================================================
  presence: defineTable({
    // Relationships
    userId: v.id("users"),
    companyId: v.id("companies"),

    // User role for context
    userRole: v.union(
      v.literal("customer"),
      v.literal("support"),
      v.literal("admin")
    ),

    // Typing indicators
    isTyping: v.boolean(),
    typingInConversation: v.optional(v.id("conversations")),
    typingStartedAt: v.optional(v.number()),

    // NEW: Viewing tracking
    viewingConversation: v.optional(v.id("conversations")),

    // Metadata
    heartbeatAt: v.number(),
    expiresAt: v.number(), // Auto-cleanup stale records
  })
    .index("by_user", ["userId"])
    .index("by_company", ["companyId"])
    .index("by_conversation", ["typingInConversation"])
    .index("by_viewing", ["viewingConversation"]) // NEW index
    .index("by_expires", ["expiresAt"]),

  // ============================================================================
  // BILLING EVENTS - Payment & subscription history
  // ============================================================================
  billing_events: defineTable({
    companyId: v.id("companies"),

    // Event type
    eventType: v.union(
      v.literal("payment_succeeded"),
      v.literal("subscription_cancelled")
    ),

    // Whop data
    whopPaymentId: v.optional(v.string()),
    whopMembershipId: v.string(),
    whopUserId: v.string(),
    whopPlanId: v.string(),

    // Financial (in USD, not cents!)
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),

    // Plan changes
    newPlanId: v.id("plans"),

    // Raw webhook data for debugging
    rawData: v.optional(v.any()),

    // Metadata
    createdAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_whop_membership", ["whopMembershipId"])
    .index("by_created_at", ["createdAt"]),

  // ============================================================================
  // OPTIMISTIC LOCKS - Prevent race conditions
  // ============================================================================
  optimisticLocks: defineTable({
    resourceId: v.string(), // e.g., "conversation:id123"
    lockedBy: v.id("users"),
    lockedAt: v.number(),
    expiresAt: v.number(),
    operation: v.string(),
  })
    .index("by_resource", ["resourceId"])
    .index("by_expiry", ["expiresAt"]),

  // ============================================================================
  // RATE LIMIT BUCKETS - Track API rate limits
  // ============================================================================
  rateLimitBuckets: defineTable({
    key: v.string(), // e.g., "aiResponse:companyId" or "userMessage:userId"
    requests: v.array(
      v.object({
        timestamp: v.number(),
        metadata: v.optional(v.any()),
      })
    ),
    blockedUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_updated", ["updatedAt"]),

  // ============================================================================
  // USAGE RECORDS - Aggregated usage stats for insights
  // ============================================================================
  usage_records: defineTable({
    companyId: v.id("companies"),

    // Period (hourly or daily aggregates)
    period: v.union(v.literal("hourly"), v.literal("daily")),
    periodStart: v.number(), // Unix timestamp
    periodEnd: v.number(), // Unix timestamp

    // Metrics
    aiResponseCount: v.number(), // AI messages sent
    customerMessageCount: v.number(), // Customer messages
    agentMessageCount: v.number(), // Agent messages
    conversationCount: v.number(), // Active conversations
    handoffCount: v.number(), // AI → Support Staff handoffs

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company_period", ["companyId", "period", "periodStart"])
    .index("by_period_start", ["periodStart"]),

  // ============================================================================
  // PRODUCTS - Whop products/listings for AI context
  // ============================================================================
  products: defineTable({
    // Relationships
    companyId: v.id("companies"),

    // Whop product information
    whopProductId: v.string(), // Whop's product/listing ID
    whopCompanyId: v.string(), // Whop company that owns this product
    
    // Product details
    title: v.string(),
    description: v.optional(v.string()),
    price: v.optional(v.number()), // Price in cents
    currency: v.optional(v.string()), // Currency code (USD, EUR, etc.)
    
    // Product type and access
    productType: v.union(
      v.literal("membership"),
      v.literal("digital_product"), 
      v.literal("course"),
      v.literal("community"),
      v.literal("software"),
      v.literal("other")
    ),
    accessType: v.union(
      v.literal("one_time"),
      v.literal("subscription"),
      v.literal("lifetime")
    ),
    
    // Subscription details (if applicable)
    billingPeriod: v.optional(v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("weekly"),
      v.literal("daily")
    )),
    
    // Product status
    isActive: v.boolean(),
    isVisible: v.boolean(),
    
    // Additional metadata
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    
    // Features and benefits (for AI context)
    features: v.optional(v.array(v.string())),
    benefits: v.optional(v.array(v.string())),
    targetAudience: v.optional(v.string()),
    
    // Sync tracking
    lastSyncedAt: v.number(),
    syncStatus: v.union(
      v.literal("synced"),
      v.literal("error"),
      v.literal("outdated")
    ),
    syncError: v.optional(v.string()),
    
    // Raw Whop data for debugging
    rawWhopData: v.optional(v.any()),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_whop_product_id", ["whopProductId"])
    .index("by_company_whop_product", ["companyId", "whopProductId"]) // Compound index for multi-tenant isolation
    .index("by_whop_company", ["whopCompanyId"])
    .index("by_company_active", ["companyId", "isActive"])
    .index("by_company_type", ["companyId", "productType"])
    .index("by_sync_status", ["syncStatus"])
    .index("by_last_synced", ["lastSyncedAt"]),
});
