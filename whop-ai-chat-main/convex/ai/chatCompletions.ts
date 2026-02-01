/**
 * Chat Completions API implementation
 * Replaces Assistants API for better control and instruction following
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type IfThenRule = {
  condition: string;
  response: string;
};

function extractIfThenRules(context: string): IfThenRule[] {
  if (!context) return [];

  const rules: IfThenRule[] = [];
  const lines = context.split(/\r?\n/);
  const rulePattern = /^\s*(?:[-*]\s*)?if\s+(.+?)\s*,?\s*then\s+(.+)\s*$/i;

  for (const line of lines) {
    const match = line.match(rulePattern);
    if (!match) continue;

    const condition = match[1].replace(/\s+/g, " ").trim();
    const response = match[2].replace(/\s+/g, " ").trim();

    if (condition.length < 3 || response.length === 0) continue;
    rules.push({ condition, response });
  }

  return rules;
}

function findMatchingRule(rules: IfThenRule[], message: string): IfThenRule | null {
  if (!message || rules.length === 0) return null;

  const messageLower = message.toLowerCase();
  const sorted = [...rules].sort(
    (a, b) => b.condition.length - a.condition.length
  );

  for (const rule of sorted) {
    if (messageLower.includes(rule.condition.toLowerCase())) {
      return rule;
    }
  }

  return null;
}

/**
 * Generate AI response using Chat Completions API
 */
export const generateChatResponse = action({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, { conversationId, messageId }): Promise<any> => {
    console.log("\n=== 🤖 AI RESPONSE GENERATION START ===");
    console.log("📝 Conversation ID:", conversationId);
    console.log("📝 Message ID:", messageId);
    console.log("🕐 Timestamp:", new Date().toISOString());

    // Store these outside try block so they're available in catch
    let aiMessageCreated = false;
    let conversation: any = null;

    try {
      // AUTHORIZATION: Verify the triggering message exists and is valid
      const triggeringMessage = await ctx.runQuery(
        api.messages.queries.getMessageById,
        { messageId }
      );

      if (!triggeringMessage) {
        console.error("❌ AUTHORIZATION FAILED: Message not found:", messageId);
        throw new Error("Invalid message ID - authorization failed");
      }

      // Verify message belongs to this conversation
      if (triggeringMessage.conversationId !== conversationId) {
        console.error("❌ AUTHORIZATION FAILED: Message/conversation mismatch");
        throw new Error("Message does not belong to conversation - authorization failed");
      }

      // Verify message is from a customer (AI should only respond to customer messages)
      if (triggeringMessage.role !== "customer") {
        console.error("❌ AUTHORIZATION FAILED: Not a customer message");
        throw new Error("Can only generate AI response for customer messages");
      }

      // Verify message is recent (within last 5 minutes) to prevent replay attacks
      const messageAge = Date.now() - triggeringMessage.timestamp;
      const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000; // 5 minutes
      if (messageAge > MAX_MESSAGE_AGE_MS) {
        console.error("❌ AUTHORIZATION FAILED: Message too old:", messageAge, "ms");
        throw new Error("Message too old for AI response - possible replay attack");
      }

      // 1. Get conversation and company data
      console.log("\n📊 STEP 1: Fetching conversation data...");
      conversation = await ctx.runQuery(
        api.conversations.queries.getConversation,
        { conversationId }
      );

      if (!conversation) {
        console.error("❌ ERROR: Conversation not found for ID:", conversationId);
        throw new Error("Conversation not found");
      }

      // Verify conversation is in a state that should receive AI responses
      if (conversation.status !== "ai_handling" && conversation.status !== "new") {
        console.error("❌ AUTHORIZATION FAILED: Conversation not in AI handling state:", conversation.status);
        throw new Error("Conversation not in AI handling state");
      }

      console.log("✅ Conversation found:", {
        id: conversation._id,
        status: conversation.status,
        customerId: conversation.customerId,
        companyId: conversation.companyId
      });

      // 1.5 Check rate limiting before proceeding
      console.log("\n📊 STEP 1.5: Checking rate limits...");
      const rateLimitCheck = await ctx.runQuery(api.rateLimiter.checkRateLimit, {
        limitType: "aiResponse",
        identifier: conversation.companyId,
      });

      if (rateLimitCheck.isRateLimited) {
        console.warn("⚠️ Rate limit exceeded for company:", conversation.companyId);
        // Create a rate limit message instead of throwing
        await ctx.runMutation(api.messages.mutations.createMessage, {
          conversationId,
          content: "Our AI is receiving a lot of requests right now. Please wait a moment before sending another message.",
          role: "system",
        });

        // Clear processing flag
        await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
          conversationId,
          isProcessing: false,
        });

        return {
          success: false,
          error: "Rate limited",
          message: rateLimitCheck.message || "Too many requests. Please try again later.",
          retryAfter: rateLimitCheck.resetAt,
        };
      }
      console.log("✅ Rate limit check passed. Remaining requests:", rateLimitCheck.remainingRequests);

      // 1.6 Check monthly usage limits before proceeding
      console.log("\n📊 STEP 1.6: Checking monthly usage limits...");
      const usageCheck = await ctx.runQuery(api.usage.queries.checkUsageLimit, {
        companyId: conversation.companyId,
      });

      if (usageCheck.hasReachedLimit) {
        console.warn("⚠️ Monthly usage limit reached for company:", conversation.companyId);
        console.log("  - Current usage:", usageCheck.currentUsage);
        console.log("  - Limit:", usageCheck.limit);
        console.log("  - Plan:", usageCheck.planName);

        // Create a user-friendly message
        await ctx.runMutation(api.messages.mutations.createMessage, {
          conversationId,
          content: "AI support bot is currently not available in this Whop at the moment. A support staff will be in contact with you shortly.",
          role: "system",
        });

        // Trigger handoff to support staff
        try {
          await ctx.runMutation(api.conversations.mutations.triggerHandoff, {
            conversationId,
            reason: "AI usage limit reached for this company",
          });
        } catch (handoffError) {
          console.warn("Failed to trigger handoff:", handoffError);
        }

        // Clear processing flag
        await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
          conversationId,
          isProcessing: false,
        });

        return {
          success: false,
          error: "Usage limit reached",
          message: `Monthly AI response limit (${usageCheck.limit}) has been reached. Please upgrade your plan or wait for the next billing cycle.`,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit,
        };
      }
      console.log("✅ Usage limit check passed. Usage:", usageCheck.currentUsage, "/", usageCheck.limit);

      console.log("\n📊 STEP 2: Fetching company data...");
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId: conversation.companyId,
      });

      if (!company) {
        console.error("❌ ERROR: Company not found for ID:", conversation.companyId);
        throw new Error("Company not found");
      }
      console.log("✅ Company found:", {
        id: company._id,
        name: company.name,
        model: company.selectedAiModel,
        hasContext: !!company.companyContextOriginal
      });

      // 2. Get conversation history (last 20 messages for context)
      console.log("\n📊 STEP 3: Fetching conversation history...");
      const messages = await ctx.runQuery(api.messages.queries.getMessages, {
        conversationId,
        limit: 20,
      });
      console.log("💬 Messages fetched:", messages.length);
      console.log("💬 CRITICAL - Message order check:");
      console.log("  First message:", messages[0] ? {
        role: messages[0].role,
        content: messages[0].content.substring(0, 50),
        timestamp: new Date(messages[0].timestamp).toISOString()
      } : "none");
      console.log("  Last message:", messages[messages.length - 1] ? {
        role: messages[messages.length - 1].role,
        content: messages[messages.length - 1].content.substring(0, 50),
        timestamp: new Date(messages[messages.length - 1].timestamp).toISOString()
      } : "none");

      // 3. Get company products for AI context (only visible and active products)
      console.log("\n📊 STEP 3.5: Fetching company products...");
      const products = await ctx.runQuery(api.products.queries.getVisibleActiveProducts, {
        companyId: conversation.companyId,
      });
      console.log("🛍️ Products fetched:", products.length);

      // 3.6 Get pricing plans for AI context
      console.log("\n📊 STEP 3.6: Fetching pricing plans...");
      const plansByProduct = await ctx.runQuery(api.whopPlans.queries.getVisiblePlansForAI, {
        companyId: conversation.companyId,
      });
      const planCount = Object.values(plansByProduct).flat().length;
      console.log("💰 Plans fetched:", planCount);

      // 4. Build the system message with company context
      console.log("\n📊 STEP 4: Building system message...");
      const companyContext =
        company.companyContextOriginal || 
        company.companyContextProcessed || 
        "";

      // Ensure company context is always included
      if (!companyContext) {
        console.error("⚠️ WARNING: No company context found! Company data:", {
          companyId: company._id,
          hasOriginal: !!company.companyContextOriginal,
          hasProcessed: !!company.companyContextProcessed,
          originalLength: company.companyContextOriginal?.length || 0,
          processedLength: company.companyContextProcessed?.length || 0
        });
      } else {
        console.log("✅ Company context loaded:", {
          length: companyContext.length,
          preview: companyContext.substring(0, 100) + "..."
        });
      }

      // Short-circuit: Apply IF/THEN rules from company context before calling OpenAI
      const ifThenRules = extractIfThenRules(companyContext);
      const matchedRule = findMatchingRule(
        ifThenRules,
        triggeringMessage.content
      );

      if (matchedRule) {
        console.log("✅ IF/THEN rule matched:", matchedRule.condition);

        const ruleMessageId = await ctx.runMutation(
          api.messages.mutations.createMessage,
          {
            conversationId,
            content: matchedRule.response,
            role: "ai",
            aiModel: "if_then_rules",
            tokensUsed: 0,
            processingTime: 0,
          }
        );

        aiMessageCreated = true;

        // Clear AI processing flag
        try {
          await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
            conversationId,
            isProcessing: false,
          });
        } catch (flagError) {
          console.warn("Failed to clear processing flag:", flagError);
        }

        return {
          success: true,
          response: matchedRule.response,
          messageId: ruleMessageId,
          shouldHandoff: false,
          handoffReason: "",
          ruleMatched: matchedRule.condition,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }

      // Build products context with pricing from plans
      let productsContext = "";
      if (products.length > 0) {
        console.log("✅ Building products context:", {
          count: products.length,
          productTitles: products.slice(0, 3).map((p: any) => p.title)
        });

        // Helper function to format price - handles FREE plans correctly
        // Note: Whop API returns prices in DOLLARS, not cents
        const formatPrice = (priceInDollars: number | undefined, currency: string) => {
          if (priceInDollars === undefined || priceInDollars === null) return null;
          if (priceInDollars === 0) return "Free";
          const price = priceInDollars.toFixed(2);
          return `${currency.toUpperCase()} $${price}`;
        };

        // Helper function to format billing period (days to readable)
        const formatBillingPeriod = (days: number | undefined) => {
          if (!days) return "";
          if (days === 30 || days === 31) return "/month";
          if (days === 365 || days === 366) return "/year";
          if (days === 7) return "/week";
          if (days === 1) return "/day";
          return `/${days} days`;
        };

        productsContext = `\n\nCOMPANY PRODUCTS & SERVICES:
${products.map((product: any) => {
  let productInfo = `• ${product.title}`;

  // Get plans for this product from plansByProduct
  const productPlans = plansByProduct[product.whopProductId] || [];

  // Add pricing from plans
  if (productPlans.length > 0) {
    productInfo += `\n  Pricing Options:`;
    for (const plan of productPlans) {
      const price = formatPrice(plan.initialPrice, plan.currency);
      // Always show the plan, even if FREE
      if (price === "Free") {
        productInfo += `\n    - ${plan.title}: Free`;
      } else if (price) {
        if (plan.planType === "one_time") {
          productInfo += `\n    - ${plan.title}: ${price} (one-time purchase)`;
        } else {
          const period = formatBillingPeriod(plan.billingPeriod);
          productInfo += `\n    - ${plan.title}: ${price}${period}`;
          if (plan.trialPeriodDays) {
            productInfo += ` (${plan.trialPeriodDays}-day free trial)`;
          }
        }
      }
    }
  } else if (product.price && product.currency) {
    // Fallback to product price if no plans (legacy)
    // Note: Whop API returns prices in DOLLARS, not cents
    const price = product.price.toFixed(2);
    productInfo += ` - ${product.currency} $${price}`;

    if (product.accessType === "subscription" && product.billingPeriod) {
      productInfo += ` per ${product.billingPeriod.replace('ly', '')}`;
    } else if (product.accessType === "lifetime") {
      productInfo += ` (lifetime access)`;
    }
  }

  // Include more of the description (increased from 200 to 500 chars)
  if (product.description) {
    productInfo += `\n  Description: ${product.description.substring(0, 500)}${product.description.length > 500 ? '...' : ''}`;
  }

  if (product.productType) {
    productInfo += `\n  Type: ${product.productType.replace('_', ' ')}`;
  }

  // Include more features (increased from 3 to 5)
  if (product.features && product.features.length > 0) {
    productInfo += `\n  Key Features: ${product.features.slice(0, 5).join(', ')}`;
    if (product.features.length > 5) {
      productInfo += `, and ${product.features.length - 5} more`;
    }
  }

  return productInfo;
}).join('\n\n')}

IMPORTANT: When customers ask about products, pricing, features, or subscriptions, refer to the exact information above. Always provide accurate pricing and billing information. If a product has multiple pricing options (monthly, yearly, lifetime, or free), explain all available options.`;
      } else {
        console.log("⚠️ No products found for this company");
        productsContext = "";
      }

      // Build system message with explicit company identification
      const WHOP_CONTEXT = `PLATFORM CONTEXT:
You are operating on Whop (whop.com), the leading marketplace for digital products, memberships, and online communities. 

IMPORTANT DISTINCTION:
- "Whop" (the platform): The marketplace at whop.com where creators sell digital products
- "This Whop" or "Our Whop": Refers to ${company.name || 'this specific creator\'s store/community'}

ABOUT WHOP THE PLATFORM:
Whop is a marketplace where creators and entrepreneurs can monetize their expertise. Anyone can create a Whop to sell:
- Memberships & Subscriptions: Recurring access to exclusive content, communities, or services
- Digital Products: One-time purchases for courses, templates, tools, software  
- Communities: Private Discord servers, Telegram groups, and exclusive channels
- Services: Coaching, consulting, signals, analysis, etc.

HOW CREATORS MAKE MONEY ON WHOP:
- Set up products with custom pricing (one-time or subscription)
- Build communities around their expertise (trading, coding, fitness, etc.)
- Use affiliate programs where members earn commissions for referrals
- Leverage Whop's built-in payment processing and access management
- Scale through Whop's marketplace discovery and search features
- Many successful Whops make $10K-$1M+ per month

KEY WHOP PLATFORM FEATURES:
- Payment Processing: Built-in payments, multiple currencies, crypto support
- Access Management: Automatic Discord/Telegram role assignment
- Affiliate System: Built-in referral programs with tracking (up to 50% commissions)
- Analytics Dashboard: Revenue tracking, member insights, conversion metrics
- Whop Wheel: Loyalty and rewards system for members
- Apps Marketplace: Integrate additional tools and features

COMMON QUESTIONS YOU SHOULD ANSWER:
- "What is Whop?" → Explain it's a marketplace for digital products and communities
- "How do I make money on Whop?" → Explain creating products, building community, affiliate programs
- "How does this Whop work?" → Explain THIS specific creator's offerings
- Membership access issues (roles, expiration, renewal)
- Payment and billing questions
- How to join Discord/Telegram after purchase
- Refund policies (set by each creator)
- Upgrading or changing subscription tiers
- Affiliate commission questions

When users mention "the platform" they mean Whop.com. When they say "this Whop" they mean ${company.name || 'this specific store'}.`;
      
      const systemMessage = companyContext ? 
        `${WHOP_CONTEXT}

COMPANY IDENTITY (INTERNAL KNOWLEDGE ONLY):
${companyContext}${productsContext}

🚨 CRITICAL SCOPE RESTRICTIONS 🚨
YOU ARE A CUSTOMER SUPPORT AGENT - YOU MUST ONLY HELP WITH:
✅ ALLOWED TOPICS:
- Questions about THIS company's products, services, and features listed above
- How Whop.com works as a platform (what it is, how to make money, how to create a Whop)
- Whop platform features and capabilities (affiliates, payments, Discord integration)
- Account and order inquiries for THIS specific business
- Technical support for THIS company's offerings
- Pricing, refunds, and subscription management
- How to use or access purchased products
- Troubleshooting access or payment issues
- Questions directly related to content within purchased courses/products
- Support for features included in their membership
- Explaining the difference between Whop platform and this specific Whop

❌ NOT ALLOWED - MUST DEFLECT:
- General knowledge questions (history, science, math, etc.) UNLESS directly part of a course they purchased
- Writing essays, paragraphs, or creative content unrelated to their purchase
- Free tutoring or consulting beyond what they've paid for
- Personal advice, health, legal guidance (unless that IS the product)
- Questions about other companies or competitors
- Providing services for free that the company charges for
- Any request that circumvents the need to purchase the product

WHEN RECEIVING OFF-TOPIC REQUESTS:
Respond ONLY with: "I'm here to help with questions about ${company.name || 'our products'} and your Whop membership. For general questions or other topics, I'd recommend using a general-purpose AI assistant like ChatGPT or Claude. How can I help you with your account or our services today?"

CRITICAL COMMUNICATION RULES:
1. ALWAYS check if the question is support-related before answering
2. NEVER provide information outside your support scope
3. Be helpful but firm about staying on-topic
4. Redirect off-topic requests immediately with the template above
5. If unsure whether something is on-topic, err on the side of deflecting
6. Keep responses brief and focused (max 2-3 sentences for most answers)

Response style:
- Short, direct answers (1-3 sentences when possible)
- Only elaborate if troubleshooting requires multiple steps
- Focus on solving the immediate support issue
- Professional but friendly tone
- Never mention being an AI

${company.aiSystemPrompt || ""}` : 
        `${WHOP_CONTEXT}

🚨 CRITICAL SCOPE RESTRICTIONS 🚨
YOU ARE A CUSTOMER SUPPORT AGENT - YOU MUST ONLY HELP WITH:
✅ ALLOWED TOPICS:
- Whop platform issues (memberships, billing, access, Discord/Telegram)
- General customer support inquiries
- Questions about digital products and subscriptions

❌ NOT ALLOWED - MUST DEFLECT:
- General knowledge questions (history, science, math, etc.)
- Writing essays, paragraphs, or creative content
- Coding or programming help
- Personal advice, health, legal, or financial guidance
- Any topic not directly related to Whop or customer support

WHEN RECEIVING OFF-TOPIC REQUESTS:
Respond ONLY with: "I'm here to help with Whop platform questions and customer support. For general questions or other topics, I'd recommend using a general-purpose AI assistant like ChatGPT or Claude. How can I help you with Whop today?"

Note: Company-specific information hasn't been configured yet in the Workspace settings.

${company.aiSystemPrompt || ""}`;

      // 4. Build message history for API
      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: systemMessage,
        },
      ];

      // Add conversation history (already in chronological order from query)
      // DO NOT REVERSE - messages are already oldest first from getMessages query
      console.log("\n🔴 BUILDING CHAT MESSAGES FOR OPENAI:");
      
      // CRITICAL: Use the triggering message we already fetched for authorization
      console.log("🎯 TRIGGERING MESSAGE:", {
        id: messageId,
        role: triggeringMessage?.role,
        content: triggeringMessage?.content?.substring(0, 100),
        timestamp: triggeringMessage?.timestamp
      });
      
      // Only include messages UP TO (but not including) the triggering message
      // This prevents the AI from seeing future messages or its own response
      const messageIndex = messages.findIndex((m: any) => m._id === messageId);
      const messagesToInclude = messageIndex >= 0 ? messages.slice(0, messageIndex + 1) : messages;
      
      console.log(`🔍 Including ${messagesToInclude.length} of ${messages.length} messages (up to trigger)`);
      
      messagesToInclude.forEach((msg: any, index: number) => {
        console.log(`  Message ${index + 1}:`, {
          id: msg._id,
          role: msg.role,
          content: msg.content.substring(0, 100),
          timestamp: new Date(msg.timestamp).toISOString()
        });

        if (msg.role === "customer") {
          // Sanitize user input to prevent prompt injection
          const sanitizedContent = sanitizeUserInput(msg.content);
          chatMessages.push({
            role: "user",
            content: sanitizedContent,
          });
        } else if (msg.role === "ai" || msg.role === "agent") {
          chatMessages.push({
            role: "assistant",
            content: msg.content,
          });
        }
        // Skip system messages as they're not part of the conversation flow
      });
      
      console.log("\n🔴 FINAL CHAT MESSAGES TO SEND:");
      console.log("  Total messages:", chatMessages.length);
      console.log("  Last user message:", chatMessages.filter(m => m.role === 'user').pop()?.content);
      console.log("  System prompt length:", systemMessage.length);

      // 5. Generate response using Chat Completions
      console.log("\n📊 STEP 5: Calling OpenAI API...");
      const startTime = Date.now();
      
      // Log the exact request being sent
      // Use company's selected model with fallback to gpt-5.2 (400K context)
      const modelToUse = company.selectedAiModel || "gpt-5.2";
      console.log("🚀 OpenAI Request Details:", {
        model: modelToUse,
        systemMessageLength: systemMessage.length,
        systemMessagePreview: systemMessage.substring(0, 300),
        messageCount: chatMessages.length,
        messages: chatMessages.map((m, i) => ({
          index: i,
          role: m.role,
          contentPreview: (m.content as string).substring(0, 100) + "..."
        }))
      });
      
      const completion = await openai.chat.completions.create({
        model: modelToUse,
        messages: chatMessages,
        temperature: 0.7,
        max_completion_tokens: getMaxTokens(company.aiResponseLength || "medium"),
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const processingTime = Date.now() - startTime;
      let response = completion.choices[0]?.message?.content || "";
      const usage = completion.usage;

      console.log("\n📊 STEP 6: OpenAI Response Received");
      console.log("🎯 Response Details:", {
        processingTime: `${processingTime}ms`,
        responseLength: response.length,
        responsePreview: response.substring(0, 200) + "...",
        fullResponse: response,
        tokensUsed: {
          input: usage?.prompt_tokens,
          output: usage?.completion_tokens,
          total: usage?.total_tokens
        },
        model: completion.model,
        finishReason: completion.choices[0]?.finish_reason
      });

      if (!response) {
        console.error("❌ ERROR: No response generated from OpenAI!");
        throw new Error("No response generated from OpenAI");
      }

      // RESPONSE VALIDATION: Check for off-topic responses
      console.log("\n🔍 STEP 6.5: Validating response for off-topic content...");
      
      // Get the last user message to check what they asked
      const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
      
      // Check company context and products to understand what's relevant
      const companyContextLower = (companyContext || "").toLowerCase();
      const productTitlesLower = products.map((p: any) => (p.title || "").toLowerCase());
      const productDescriptionsLower = products.map((p: any) => (p.description || "").toLowerCase()).join(" ");
      const allCompanyContent = companyContextLower + " " + productTitlesLower.join(" ") + " " + productDescriptionsLower;
      
      // Determine if company is related to certain topics
      const isCodeRelatedCompany = allCompanyContent.includes('coding') || 
                                   allCompanyContent.includes('programming') || 
                                   allCompanyContent.includes('developer') ||
                                   allCompanyContent.includes('software') ||
                                   allCompanyContent.includes('api') ||
                                   allCompanyContent.includes('javascript') ||
                                   allCompanyContent.includes('python');
      
      const isEducationalCompany = allCompanyContent.includes('course') ||
                                   allCompanyContent.includes('tutorial') ||
                                   allCompanyContent.includes('education') ||
                                   allCompanyContent.includes('learning') ||
                                   allCompanyContent.includes('training');
      
      const isFinanceCompany = allCompanyContent.includes('trading') ||
                               allCompanyContent.includes('investment') ||
                               allCompanyContent.includes('stocks') ||
                               allCompanyContent.includes('crypto') ||
                               allCompanyContent.includes('finance');
      
      // Build dynamic off-topic indicators based on what the company does
      const offTopicIndicators = [
        // Always off-topic (unless company specifically deals with these)
        'martin luther king', 'mlk', 'abraham lincoln', 'george washington', 'world war',
        'civil war', 'revolution', 'historical figures',
        // Academic (unless educational company)
        ...(isEducationalCompany ? [] : ['write an essay', 'write a paragraph about', 'explain the theory']),
        // Creative writing (always off-topic for support)
        'write a story', 'write a poem', 'creative writing', 'fiction',
        // Programming (unless code-related company)
        ...(isCodeRelatedCompany ? [] : ['write code for', 'python script', 'javascript function', 'debug my code']),
        // Financial advice (unless finance company)
        ...(isFinanceCompany ? [] : ['investment advice', 'stock tips', 'trading strategy']),
        // Medical/Legal (always off-topic for support)
        'medical advice', 'legal advice', 'health diagnosis',
        // General knowledge (always off-topic)
        'capital of', 'population of', 'who invented', 'when was the', 'how many countries'
      ];
      
      // For code-related companies, only flag if they're asking for unrelated code
      if (isCodeRelatedCompany && lastUserMessage.includes('code')) {
        // Check if it's about their purchased product or general coding help
        const isAboutProduct = lastUserMessage.includes('course') ||
                              lastUserMessage.includes('access') ||
                              lastUserMessage.includes('download') ||
                              lastUserMessage.includes('lesson') ||
                              lastUserMessage.includes('module') ||
                              lastUserMessage.includes('purchase');
        
        // If asking for code help but NOT about their purchase, still flag it
        if (!isAboutProduct && (lastUserMessage.includes('write code') || 
                                lastUserMessage.includes('debug my') ||
                                lastUserMessage.includes('fix my code'))) {
          offTopicIndicators.push('requesting free coding help');
        }
      }
      
      // Check if user asked an off-topic question
      // BUT exclude if they're asking about Whop platform itself
      const isAskingAboutWhop = lastUserMessage.includes('what is whop') ||
                                lastUserMessage.includes('how to make money') ||
                                lastUserMessage.includes('how does whop work') ||
                                lastUserMessage.includes('create a whop') ||
                                lastUserMessage.includes('whop platform') ||
                                lastUserMessage.includes('whop marketplace');
      
      const isOffTopicRequest = !isAskingAboutWhop && offTopicIndicators.some(indicator => 
        lastUserMessage.includes(indicator)
      );
      
      // Additional check: If response is too long and doesn't mention company/Whop/products
      const responseCheck = response.toLowerCase();
      const containsRelevantTerms = 
        responseCheck.includes('whop') ||
        responseCheck.includes('membership') ||
        responseCheck.includes('subscription') ||
        responseCheck.includes('billing') ||
        responseCheck.includes('access') ||
        responseCheck.includes('product') ||
        responseCheck.includes('support') ||
        responseCheck.includes('account') ||
        responseCheck.includes('purchase') ||
        responseCheck.includes('course') ||
        (company.name && responseCheck.includes(company.name.toLowerCase())) ||
        productTitlesLower.some(title => title && responseCheck.includes(title));
      
      // If response is long (>500 chars) and doesn't contain relevant terms, it's likely off-topic
      const suspiciouslyOffTopic = response.length > 500 && !containsRelevantTerms;
      
      // Log decision making
      console.log("  - Company type detection:", {
        isCodeRelated: isCodeRelatedCompany,
        isEducational: isEducationalCompany,
        isFinance: isFinanceCompany
      });
      
      if (isOffTopicRequest || suspiciouslyOffTopic) {
        console.log("⚠️ Off-topic content detected! Replacing with redirect message.");
        console.log("  - Off-topic request:", isOffTopicRequest);
        console.log("  - Suspiciously off-topic response:", suspiciouslyOffTopic);
        
        // Replace with standard deflection message
        response = `I'm here to help with questions about ${company.name || 'our products'} and your Whop membership. For general questions or other topics, I'd recommend using a general-purpose AI assistant like ChatGPT or Claude. How can I help you with your account or our services today?`;
      }

      // 6. Check for handoff triggers
      let shouldHandoff = false;
      let handoffReason = "";

      const handoffTriggers = company.aiHandoffTriggers || [];
      const lowerResponse = response.toLowerCase();
      const lowerCustomerMessage = triggeringMessage.content.toLowerCase();

      // Map trigger IDs to actual phrases to detect
      const triggerPhraseMap: Record<string, string[]> = {
        "customer_requests_human": [
          "speak to a human", "talk to a human", "real person", "human agent",
          "talk to someone", "speak to someone", "real agent", "live agent",
          "customer service", "support agent", "talk to support", "speak to support",
          "need a human", "want a human", "get me a human", "transfer me"
        ],
        "billing_questions": [
          "billing", "payment", "refund", "charge", "invoice", "subscription",
          "cancel my", "charged me", "money back", "pricing", "cost", "price",
          "credit card", "debit card", "transaction"
        ],
        "negative_sentiment": [
          "frustrated", "angry", "upset", "terrible", "awful", "horrible",
          "worst", "hate", "useless", "waste of time", "ridiculous", "unacceptable",
          "disappointed", "disgusted", "furious"
        ],
        "multiple_failed_attempts": [] // This is tracked separately by counting AI responses
      };

      // Check customer message for trigger phrases
      for (const trigger of handoffTriggers) {
        // Get phrases for this trigger (or use trigger itself as custom phrase)
        const phrases = triggerPhraseMap[trigger] || [trigger];

        for (const phrase of phrases) {
          if (lowerCustomerMessage.includes(phrase.toLowerCase())) {
            shouldHandoff = true;
            handoffReason = `Customer message matched handoff trigger: "${phrase}"`;
            break;
          }
        }
        if (shouldHandoff) break;
      }

      // Check if AI explicitly wants to escalate (in its response)
      if (!shouldHandoff) {
        if (lowerResponse.includes("escalate") ||
            lowerResponse.includes("human agent") ||
            lowerResponse.includes("transfer you") ||
            lowerResponse.includes("connect you with") ||
            lowerResponse.includes("let me get someone")) {
          shouldHandoff = true;
          handoffReason = "AI determined escalation needed";
        }
      }

      // 7. Store the AI response
      const aiMessageId = await ctx.runMutation(api.messages.mutations.createMessage, {
        conversationId,
        content: response,
        role: "ai",
        aiModel: company.selectedAiModel || "gpt-5.2",
        processingTime,
        tokensUsed: usage?.total_tokens,
      });
      
      // Mark that message was successfully created
      aiMessageCreated = true;

      // 8. Handle handoff if needed
      if (shouldHandoff) {
        try {
          await ctx.runMutation(api.conversations.mutations.triggerHandoff, {
            conversationId,
            reason: handoffReason,
          });
        } catch (handoffError) {
          console.warn("Failed to trigger handoff:", handoffError);
          // Don't fail the whole request if handoff fails
        }
      }

      // 9. Track usage
      try {
        await ctx.runMutation(api.usage.mutations.trackAIResponse, {
          conversationId,
          tokensUsed: (usage?.total_tokens || 0),
          aiModel: company.selectedAiModel || "gpt-5.2",
          experienceId: "exp_unknown", // TODO: Get this from conversation or context
        });
      } catch (usageError) {
        console.warn("Failed to track usage:", usageError);
        // Don't fail the whole request if usage tracking fails
      }

      // 9.5 Record rate limit request for successful AI response
      try {
        await ctx.runMutation(api.rateLimiter.recordRateLimitedRequest, {
          limitType: "aiResponse",
          identifier: conversation.companyId,
          metadata: {
            conversationId,
            tokensUsed: usage?.total_tokens || 0,
          },
        });
      } catch (rateLimitError) {
        console.warn("Failed to record rate limit request:", rateLimitError);
        // Don't fail the whole request if rate limit recording fails
      }

      // 10. Clear AI processing flag
      try {
        await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
          conversationId,
          isProcessing: false,
        });
      } catch (flagError) {
        console.warn("Failed to clear processing flag:", flagError);
        // Don't fail the whole request if flag clearing fails
      }

      return {
        success: true,
        response,
        messageId: aiMessageId,
        shouldHandoff,
        handoffReason,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      console.error("❌ Chat Completions error:", error);
      
      // Clear processing flag on error
      try {
        await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
          conversationId,
          isProcessing: false,
        });
      } catch (clearError) {
        console.error("Failed to clear processing flag:", clearError);
      }

      // Only create error message if we haven't already created a successful AI response
      if (!aiMessageCreated) {
        try {
          await ctx.runMutation(api.messages.mutations.createMessage, {
            conversationId,
            content: "I apologize, but I'm having trouble processing your request. Please try again or wait for a human agent.",
            role: "ai",
          });
        } catch (msgError) {
          console.error("Failed to create error message:", msgError);
        }
      }

      // Only throw if the AI message wasn't created
      if (!aiMessageCreated) {
        throw error;
      }
      
      // If message was created but something else failed, log but don't throw
      console.warn("Post-message creation error (non-critical):", error);
      return {
        success: true,
        response: "Message created but with warnings",
        messageId: null,
        shouldHandoff: false,
        handoffReason: "",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }
  },
});

/**
 * Test the Chat Completions API with a simple query
 */
export const testChatCompletion = action({
  args: {
    companyId: v.id("companies"),
    query: v.string(),
  },
  handler: async (ctx, { companyId, query }): Promise<any> => {
    const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
      companyId,
    });

    if (!company) {
      throw new Error("Company not found");
    }

    const companyContext =
      company.companyContextOriginal || 
      company.companyContextProcessed || 
      "";

    // Ensure company context is always included
    if (!companyContext) {
      console.warn("⚠️ No company context found for test, AI may not respond correctly");
    }

    const systemMessage = `${companyContext}

You are a customer support representative. Your responses should be:
- Professional and helpful
- Consistent with the company identity above
- Never mention that you're an AI or created by OpenAI`;

    const completion = await openai.chat.completions.create({
      model: company.selectedAiModel || "gpt-5.2",
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: query,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: 1000,
    });

    return {
      response: completion.choices[0]?.message?.content || "",
      model: completion.model,
      usage: completion.usage,
    };
  },
});

// Helper function to get max tokens based on response length setting
// Matches schema: "brief" | "medium" | "detailed"
// Note: GPT-5.2 uses reasoning tokens that count toward the limit, so we need higher values
function getMaxTokens(responseLength: string): number {
  switch (responseLength) {
    case "brief":
      return 500;
    case "medium":
      return 1000;
    case "detailed":
      return 2000;
    default:
      return 1000;
  }
}

/**
 * Sanitize user input before sending to OpenAI
 * Prevents prompt injection attacks and removes potentially harmful content
 */
function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // 1. Limit message length (10K chars max to prevent token abuse)
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + '... [message truncated]';
  }

  // 2. Remove null bytes and other control characters (except newlines/tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. Detect and neutralize common prompt injection patterns
  const injectionPatterns = [
    // System prompt manipulation attempts
    /\[SYSTEM\]/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
    /<\|system\|>/gi,
    /<\|assistant\|>/gi,
    /<\|user\|>/gi,
    /###\s*(System|Assistant|Human|User)\s*:/gi,
    // Instruction override attempts
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /new\s+instructions?:/gi,
    /override\s+(system|instructions?|rules?)/gi,
    // Role manipulation
    /you\s+are\s+now\s+(a|an|the)\s+/gi,
    /pretend\s+(to\s+be|you\s+are)/gi,
    /act\s+as\s+(if\s+you\s+are|a|an)/gi,
    /roleplay\s+as/gi,
    // Jailbreak attempts
    /\bDAN\b/g,  // "Do Anything Now" jailbreak
    /developer\s+mode/gi,
    /jailbreak/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }

  // 4. Escape sequences that could be interpreted as special formatting
  sanitized = sanitized
    .replace(/```system/gi, '``` system')
    .replace(/```assistant/gi, '``` assistant');

  return sanitized.trim();
}
