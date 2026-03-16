"use node";

/**
 * OpenAI Assistants API Management
 *
 * Handles creation and updates of OpenAI Assistants and Vector Stores
 * per company. Called on company creation and when AI settings change.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get personality template instructions
 */
function getPersonalityTemplate(
  personality: "professional" | "friendly" | "casual" | "technical"
): string {
  switch (personality) {
    case "professional":
      return `You are a professional AI assistant. Your tone should be:
- Polite and respectful
- Clear and articulate
- Business-appropriate
- Courteous and helpful

Example: "Thank you for contacting us. I'd be happy to assist you with that. Let me help you understand..."`;

    case "friendly":
      return `You are a friendly AI assistant. Your tone should be:
- Warm and welcoming
- Conversational and approachable
- Positive and enthusiastic
- Helpful and caring

Example: "Hey there! I'd love to help you with that. Let's get this sorted out together..."`;

    case "casual":
      return `You are a casual AI assistant. Your tone should be:
- Relaxed and informal
- Easy-going and conversational
- Simple and straightforward
- Friendly but not overly formal

Example: "Hey! No worries, I can help with that. Let me break this down for you..."`;

    case "technical":
      return `You are a technical AI assistant. Your tone should be:
- Precise and accurate
- Detail-oriented and thorough
- Technical but clear
- Focused on problem-solving

Example: "I can help diagnose this issue. Could you provide the following details so I can assist more effectively..."`;

    default:
      return getPersonalityTemplate("professional");
  }
}

/**
 * Build assistant instructions from company config
 */
function buildInstructions(company: {
  aiPersonality: "professional" | "friendly" | "casual" | "technical";
  aiSystemPrompt: string;
  companyContextProcessed?: string;
  companyContextOriginal?: string;
}): string {
  let instructions = "";
  
  // START WITH COMPANY IDENTITY - HIGHEST PRIORITY
  const companyContext =
    company.companyContextOriginal || company.companyContextProcessed || "";
    
  if (companyContext.trim() !== "") {
    instructions = `# MANDATORY CONTEXT - YOU MUST ALWAYS FOLLOW THIS\n\n${companyContext}\n\nThis context defines everything about your role, identity, and the company you represent. ALL your responses must be consistent with this context. Use this information to:\n- Answer questions about the company, products, and services\n- Maintain consistent identity and brand voice\n- Provide accurate company-specific information\n- Guide customers based on company policies and offerings\n\nNever contradict this context. Always respond as a representative of this company.\n\n`;
  }

  // ============================================================================
  // CRITICAL RULE #1: ABSOLUTELY FORBIDDEN TECHNICAL LANGUAGE (HIGHEST PRIORITY)
  // ============================================================================
  instructions += `🚨 **ABSOLUTELY FORBIDDEN - NEVER MENTION TO CUSTOMERS:**
  
You MUST NEVER mention any of the following technical terms or concepts to customers:
- "files", "uploaded files", "files uploaded", "no files", "files not found"
- "file_search", "search", "search did not return", "search returned no results"
- "knowledge base", "vector store", "database", "index"
- "no relevant information found", "couldn't find information", "information not found"
- "API", "system error", "technical error", "search query", "search results"
- ANY reference to how you retrieve or search for information
- ANY mention of technical processes, tools, or systems

**If file_search returns no results or finds nothing:**
- DO NOT mention that the search failed or found nothing
- DO NOT say "I couldn't find information" or "no files uploaded"
- DO NOT apologize for missing information
- INSTEAD: Act as if you have the information from the company context provided
- Simply answer the question naturally based on company context or general knowledge
- Use phrases like: "I'd be happy to help with that!" or "Let me help you with that question."

**Examples of FORBIDDEN responses:**
❌ "It seems there are no files uploaded or the search did not return any relevant information."
❌ "I couldn't find information in the uploaded files."
❌ "The file_search returned no results."
❌ "No relevant information was found in the knowledge base."

**Examples of CORRECT responses:**
✅ "I'd be happy to help you with that! [answer the question based on company context]"
✅ "Let me help you with that. [provide helpful answer]"
✅ "I can help you with that question. [answer naturally]"

**REMEMBER: Customers should NEVER know about file_search, files, or any technical processes. Always respond as if you naturally know the information.**


`;

  // 1. Personality template (OPTIONAL - user selects from dropdown)
  if (company.aiPersonality) {
    instructions += getPersonalityTemplate(company.aiPersonality) + "\n\n";
  }

  // 2. User's custom system prompt (they control behavior)
  // But it should complement, not replace the company context
  if (company.aiSystemPrompt) {
    instructions += `\n## Additional Instructions\n\n${company.aiSystemPrompt}\n\n`;
  } else {
    instructions += "\n## Additional Instructions\n\nYou are a helpful customer support assistant for the company described above.\n\n";
  }

  // 3. Company Context is already added at the beginning

  // 4. Knowledge base usage - dual purpose: constraints AND information
  if (companyContext.trim() !== "") {
    instructions += `## Knowledge Base Usage

You have access to the company's knowledge base via file_search. This is for YOUR internal use only - customers must NEVER know about it.

**How to use file_search:**
- Only use file_search when you need detailed information not in the company context above
- For basic identity questions (who you work for), use the company context directly
- The knowledge base serves two purposes:
  1. BEHAVIORAL CONSTRAINTS: If you find rules or constraints (e.g., "don't talk about X", "always mention Y"), these are MANDATORY instructions you MUST follow. These are INTENTIONAL rules, NOT errors.
  2. INFORMATION: If you find factual content about the company, products, or services, use it to enhance your answers

**CRITICAL - When file_search returns results:**
- Use the information naturally in your response
- NEVER mention where the information came from
- NEVER say "I found in the files" or "according to the knowledge base"
- Just answer naturally as if you know this information

**CRITICAL - When file_search returns NO results or finds nothing:**
- DO NOT mention that the search found nothing
- DO NOT say "I couldn't find information" or "no files uploaded"
- DO NOT apologize for missing information
- INSTEAD: Answer based on the company context provided above, or use general knowledge
- Use a friendly opener like: "I'd be happy to help with that!" or "Let me help you with that question."
- Then provide a helpful answer as if you naturally know the information

**When you find a constraint (like "don't talk about pokemon"):**
- Refuse that topic professionally: "I'm here to help with [Company] support. I can't assist with [restricted topic] based on our guidelines."
- NEVER mention that you found this rule in files or a knowledge base

**REMEMBER: file_search is invisible to customers. They should never know it exists.**


`;
  }

  // 5. Critical Response Guidelines - Never show errors to users
  instructions += `## Critical Response Guidelines

**NEVER show error messages, technical errors, API failures, or system errors to users.**
- If you encounter any technical issues or errors, respond with a friendly, human-readable message instead
- Example: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment, or feel free to ask me something else."
- Never mention technical details like "API error", "system failure", "exception", or error codes
- Always maintain a helpful, professional tone even when experiencing issues

**REMINDER: Never mention file_search, files, or any technical processes to customers. Always respond naturally.**

`;

  return instructions;
}

// Vector Stores API is on root client, not beta:
// - openai.vectorStores.create()
// - openai.vectorStores.files.create()
// - openai.vectorStores.files.del()

/**
 * Create or update Vector Store for company knowledge base
 */
async function createOrUpdateVectorStore(company: {
  _id: Id<"companies">;
  openaiVectorStoreId?: string;
  openaiContextFileId?: string;
  companyContextProcessed: string;
  name: string;
}): Promise<{ vectorStoreId: string; fileId: string | null }> {
  console.log(
    "[createOrUpdateVectorStore] Starting for company:",
    company.name
  );
  console.log(
    "[createOrUpdateVectorStore] Context length:",
    company.companyContextProcessed?.length || 0
  );

  // If no context, still create vector store (empty for now)
  if (
    !company.companyContextProcessed ||
    company.companyContextProcessed.trim() === ""
  ) {
    // Create empty vector store if doesn't exist
    if (!company.openaiVectorStoreId) {
      const vectorStore = await openai.vectorStores.create({
        name: `${company.name} Knowledge Base`,
      });
      console.log(
        "[createOrUpdateVectorStore] Created empty vector store:",
        vectorStore.id
      );
      return { vectorStoreId: vectorStore.id, fileId: null };
    }
    return {
      vectorStoreId: company.openaiVectorStoreId,
      fileId: company.openaiContextFileId || null,
    };
  }

  let vectorStoreId: string = company.openaiVectorStoreId!;

  // Create vector store if it doesn't exist
  if (!company.openaiVectorStoreId) {
    const vectorStore = await openai.vectorStores.create({
      name: `${company.name} Knowledge Base`,
    });
    console.log(
      "[createOrUpdateVectorStore] Created vector store:",
      vectorStore.id
    );
    vectorStoreId = vectorStore.id;
  }

  // Delete old file if it exists
  if (company.openaiContextFileId) {
    try {
      await openai.vectorStores.files.del(
        vectorStoreId,
        company.openaiContextFileId
      );
      console.log(
        "[createOrUpdateVectorStore] Deleted old file:",
        company.openaiContextFileId
      );
    } catch (error) {
      console.warn(
        "[createOrUpdateVectorStore] Failed to delete old context file:",
        error
      );
    }
  }

  // Upload new context file
  // OpenAI SDK accepts File, Blob, or ReadableStream
  // In Node.js runtime, we create a File-like object
  const fileContent = company.companyContextProcessed;
  const fileBuffer = Buffer.from(fileContent, "utf-8");

  // Create File object (available in Node.js 18+)
  const file = await openai.files.create({
    file: new File([fileBuffer], "company-context.txt", {
      type: "text/plain",
    }),
    purpose: "assistants",
  });
  console.log("[createOrUpdateVectorStore] Uploaded file to OpenAI:", file.id);

  // Add file to vector store
  if (!file.id) {
    throw new Error("Failed to get file ID from OpenAI");
  }

  await openai.vectorStores.files.create(vectorStoreId, {
    file_id: file.id,
  });
  console.log("[createOrUpdateVectorStore] Added file to vector store");

  // Poll for file indexing status
  console.log("[createOrUpdateVectorStore] Waiting for file to be indexed...");
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max

  while (attempts < maxAttempts) {
    try {
      const vectorStoreFile = await openai.vectorStores.files.retrieve(
        vectorStoreId,
        file.id
      );

      console.log(
        `[createOrUpdateVectorStore] File status: ${vectorStoreFile.status} (attempt ${attempts + 1}/${maxAttempts})`
      );

      if (vectorStoreFile.status === "completed") {
        console.log("[createOrUpdateVectorStore] File indexed successfully!");
        break;
      }

      if (vectorStoreFile.status === "failed") {
        console.error("[createOrUpdateVectorStore] File indexing failed!");
        throw new Error("File indexing failed");
      }

      // Status is "in_progress" or "pending" - wait and retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    } catch (err) {
      // If we can't retrieve status yet (file might not be visible yet), wait
      if (attempts < 5) {
        console.log(
          `[createOrUpdateVectorStore] File not yet visible in vector store, waiting... (attempt ${attempts + 1})`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      } else {
        throw err;
      }
    }
  }

  if (attempts >= maxAttempts) {
    console.warn(
      "[createOrUpdateVectorStore] File indexing timed out - may not be ready immediately"
    );
  }

  // We've already checked file.id exists above
  const fileIdValue = file.id ?? null;
  return { vectorStoreId, fileId: fileIdValue as string | null };
}

/**
 * Create or update OpenAI Assistant for a company
 *
 * Called on:
 * - Company creation
 * - AI personality change
 * - AI system prompt change
 * - AI model change
 * - Company context update
 */
export const createOrUpdateAssistant = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    console.log("[createOrUpdateAssistant] STARTED for company:", companyId);

    const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
      companyId,
    });

    if (!company) {
      console.error("[createOrUpdateAssistant] Company not found:", companyId);
      throw new Error("Company not found");
    }

    console.log("[createOrUpdateAssistant] Company data:", {
      id: company._id,
      name: company.name,
      hasAssistant: !!company.openaiAssistantId,
      hasVectorStore: !!company.openaiVectorStoreId,
      contextLength: company.companyContextProcessed?.length || 0,
    });

    // 1. Create/update Vector Store
    const { vectorStoreId, fileId } = await createOrUpdateVectorStore(company);

    // 2. Build instructions
    const instructions = buildInstructions({
      aiPersonality: company.aiPersonality,
      aiSystemPrompt: company.aiSystemPrompt,
      companyContextProcessed: company.companyContextProcessed,
      companyContextOriginal: company.companyContextOriginal,
    });

    // 3. Create or update assistant
    let assistantId: string;
    if (company.openaiAssistantId) {
      // Update existing assistant
      const assistant = await openai.beta.assistants.update(
        company.openaiAssistantId,
        {
          name: `${company.name} Support Bot`,
          model: company.selectedAiModel,
          instructions: instructions,
          tools: [
            { type: "file_search" },
            {
              type: "function",
              function: {
                name: "escalate_to_human",
                description:
                  "Escalate this conversation to a human support agent. Use this when you cannot help the customer or when they explicitly request human support.",
                parameters: {
                  type: "object",
                  properties: {
                    reason: {
                      type: "string",
                      description:
                        "Brief explanation of why you're escalating to human support",
                    },
                  },
                  required: ["reason"],
                },
              },
            },
          ],
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStoreId],
            },
          },
        }
      );
      assistantId = assistant.id;
    } else {
      // Create new assistant
      const assistant = await openai.beta.assistants.create({
        name: `${company.name} Support Bot`,
        model: company.selectedAiModel,
        instructions: instructions,
        tools: [
          { type: "file_search" },
          {
            type: "function",
            function: {
              name: "escalate_to_human",
              description:
                "Escalate this conversation to a human support agent. Use this when you cannot help the customer or when they explicitly request human support.",
              parameters: {
                type: "object",
                properties: {
                  reason: {
                    type: "string",
                    description:
                      "Brief explanation of why you're escalating to human support",
                  },
                },
                required: ["reason"],
              },
            },
          },
        ],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId],
          },
        },
      });
      assistantId = assistant.id;
    }

    console.log("[createOrUpdateAssistant] Assistant configured:", {
      assistantId,
      vectorStoreId,
      fileId,
    });

    // 4. Save IDs back to Convex
    await ctx.runMutation(api.companies.mutations.updateOpenAIIds, {
      companyId,
      openaiAssistantId: assistantId,
      openaiVectorStoreId: vectorStoreId,
      openaiContextFileId: fileId ?? undefined,
    });
    console.log("[createOrUpdateAssistant] COMPLETED - IDs saved to DB");

    return {
      success: true,
      assistantId,
      vectorStoreId,
      fileId,
    };
  },
});

/**
 * Update company context in Vector Store
 *
 * Called when company updates their knowledge base.
 */
export const updateCompanyContext = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<{ success: boolean }> => {
    console.log("[updateCompanyContext] CALLED for company:", companyId);
    console.log("[updateCompanyContext] Scheduling createOrUpdateAssistant...");

    // Delegate to createOrUpdateAssistant - it handles context updates
    // We need to call it through the scheduler since actions can't directly call other actions
    await ctx.scheduler.runAfter(0, api.ai.assistants.createOrUpdateAssistant, {
      companyId,
    });

    console.log("[updateCompanyContext] Scheduled successfully");
    return { success: true };
  },
});

/**
 * Add agent message to OpenAI thread
 *
 * Called when an agent sends a message so the AI can see it later.
 */
export const addAgentMessageToThread = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    agentName: v.string(),
  },
  handler: async (ctx, { conversationId, content, agentName }) => {
    const conversation = await ctx.runQuery(
      api.conversations.queries.getConversation,
      { conversationId }
    );

    if (!conversation?.openaiThreadId) {
      // No thread yet, nothing to do (thread will be created when AI responds)
      return { success: false, reason: "no_thread" };
    }

    try {
      await openai.beta.threads.messages.create(conversation.openaiThreadId, {
        role: "user",
        content: `[Agent ${agentName}]: ${content}`,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to add agent message to thread:", error);
      return { success: false, reason: "api_error" };
    }
  },
});
