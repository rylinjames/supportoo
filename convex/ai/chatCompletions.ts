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
      console.log("✅ Conversation found:", {
        id: conversation._id,
        status: conversation.status,
        customerId: conversation.customerId,
        companyId: conversation.companyId
      });

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

      // 3. Build the system message with company context
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

      // Build system message with explicit company identification
      const systemMessage = companyContext ? 
        `COMPANY IDENTITY (INTERNAL KNOWLEDGE ONLY):
${companyContext}

CRITICAL COMMUNICATION RULES:
1. ALWAYS respond directly to the customer's LATEST message
2. Focus on what they just asked - don't repeat previous responses
3. If they ask for help with something specific, provide that help immediately
4. ONLY mention your company name in these specific situations:
   - Your very first greeting to a NEW conversation
   - When customer EXPLICITLY asks "who do you work for" or similar direct questions
5. After the initial greeting, DO NOT mention the company name again unless directly asked
6. Be natural and conversational - talk like a human support agent, not a robot

Response style:
- Answer the customer's CURRENT question directly
- Be helpful and professional
- Use natural, conversational language
- Don't repeat information unnecessarily
- Focus on the customer's actual problem
- Never mention being an AI

${company.aiSystemPrompt || ""}` : 
        `You are a helpful customer support assistant. Since no specific company context has been configured yet, I'll do my best to help you with your questions.

If asked who you work for, politely explain that the company information hasn't been set up yet in the Workspace settings.

Response style:
- Be helpful and professional
- Use natural, conversational language
- Focus on understanding and helping with the customer's needs
- If you need specific company information to answer a question, politely explain that this information needs to be configured in the Workspace tab

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
      messages.forEach((msg, index) => {
        console.log(`  Message ${index + 1}:`, {
          role: msg.role,
          content: msg.content.substring(0, 100),
          timestamp: new Date(msg.timestamp).toISOString()
        });
        
        if (msg.role === "customer") {
          chatMessages.push({
            role: "user",
            content: msg.content,
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
      const modelToUse = company.selectedAiModel || "gpt-5-nano";
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
        max_tokens: getMaxTokens(company.aiResponseLength || "medium"),
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const processingTime = Date.now() - startTime;
      const response = completion.choices[0]?.message?.content || "";
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

      // 6. Check for handoff triggers
      let shouldHandoff = false;
      let handoffReason = "";

      const handoffTriggers = company.aiHandoffTriggers || [];
      const lowerResponse = response.toLowerCase();
      
      for (const trigger of handoffTriggers) {
        if (lowerResponse.includes(trigger.toLowerCase())) {
          shouldHandoff = true;
          handoffReason = `Customer message contained trigger: "${trigger}"`;
          break;
        }
      }

      // Check if AI explicitly wants to escalate
      if (lowerResponse.includes("escalate") || 
          lowerResponse.includes("human agent") ||
          lowerResponse.includes("transfer you")) {
        shouldHandoff = true;
        handoffReason = "AI determined escalation needed";
      }

      // 7. Store the AI response
      const aiMessageId = await ctx.runMutation(api.messages.mutations.createMessage, {
        conversationId,
        content: response,
        role: "ai",
        aiModel: company.selectedAiModel || "gpt-4",
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
          aiModel: company.selectedAiModel || "gpt-4",
          experienceId: "exp_unknown", // TODO: Get this from conversation or context
        });
      } catch (usageError) {
        console.warn("Failed to track usage:", usageError);
        // Don't fail the whole request if usage tracking fails
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
      model: company.selectedAiModel || "gpt-4",
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
      max_tokens: 150,
    });

    return {
      response: completion.choices[0]?.message?.content || "",
      model: completion.model,
      usage: completion.usage,
    };
  },
});

// Helper function to get max tokens based on response length setting
function getMaxTokens(responseLength: string): number {
  switch (responseLength) {
    case "short":
      return 150;
    case "medium":
      return 300;
    case "long":
      return 500;
    default:
      return 300;
  }
}