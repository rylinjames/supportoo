/**
 * Chat Completions API implementation
 * Replaces Assistants API for better control and instruction following
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import OpenAI from "openai";
import { Doc } from "../_generated/dataModel";

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
    console.log("🤖 Starting Chat Completions generation");
    
    // Store these outside try block so they're available in catch
    let aiMessageCreated = false;
    let conversation: any = null;

    try {
      // 1. Get conversation and company data
      conversation = await ctx.runQuery(
        api.conversations.queries.getConversation,
        { conversationId }
      );

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId: conversation.companyId,
      });

      if (!company) {
        throw new Error("Company not found");
      }

      // 2. Get conversation history (last 20 messages for context)
      const messages = await ctx.runQuery(api.messages.queries.getMessages, {
        conversationId,
        limit: 20,
      });

      // 3. Build the system message with company context
      const companyContext =
        company.companyContextOriginal || 
        company.companyContextProcessed || 
        "";

      // Ensure company context is always included
      if (!companyContext) {
        console.error("❌ CRITICAL: No company context found! Company data:", {
          companyId: company._id,
          hasOriginal: !!company.companyContextOriginal,
          hasProcessed: !!company.companyContextProcessed,
          originalLength: company.companyContextOriginal?.length || 0,
          processedLength: company.companyContextProcessed?.length || 0
        });
      } else {
        console.log("✅ Company context loaded:", companyContext.substring(0, 100) + "...");
      }

      // Build system message with explicit company identification
      const systemMessage = companyContext ? 
        `COMPANY IDENTITY (INTERNAL KNOWLEDGE ONLY):
${companyContext}

CRITICAL COMMUNICATION RULES:
1. ONLY mention your company name in these specific situations:
   - Your very first greeting to a NEW conversation
   - When customer EXPLICITLY asks "who do you work for" or similar direct questions
   - When the customer says they know where you work and tells you to stop mentioning it
2. After the initial greeting, DO NOT mention the company name again unless directly asked
3. Focus on being helpful and solving problems
4. When customer says "I know you work for X, stop telling me", acknowledge and stop mentioning it
5. Be natural and conversational - talk like a human support agent, not a robot

Response style:
- Be helpful and professional
- Use natural, conversational language
- Don't repeat information unnecessarily
- Focus on the customer's actual problem
- Never mention being an AI

${company.aiSystemPrompt || ""}` : 
        `ERROR: No company context configured. Please configure company context in the settings.

You are a customer support representative. Please provide helpful support to customers.

${company.aiSystemPrompt || ""}`;

      // 4. Build message history for API
      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: systemMessage,
        },
      ];

      // Add conversation history (oldest first)
      messages.reverse().forEach((msg) => {
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

      // 5. Generate response using Chat Completions
      const startTime = Date.now();
      
      // Log the exact system message being sent
      console.log("📤 Sending to OpenAI with system message:", {
        model: company.selectedAiModel || "gpt-4",
        systemMessagePreview: systemMessage.substring(0, 200) + "...",
        messageCount: chatMessages.length,
        lastUserMessage: chatMessages[chatMessages.length - 1]?.content
      });
      
      const completion = await openai.chat.completions.create({
        model: company.selectedAiModel || "gpt-4",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: getMaxTokens(company.aiResponseLength || "medium"),
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const processingTime = Date.now() - startTime;
      const response = completion.choices[0]?.message?.content || "";
      const usage = completion.usage;

      if (!response) {
        throw new Error("No response generated from OpenAI");
      }

      console.log(`✅ AI response generated in ${processingTime}ms`);
      console.log(`📊 Tokens used - Input: ${usage?.prompt_tokens}, Output: ${usage?.completion_tokens}`);

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