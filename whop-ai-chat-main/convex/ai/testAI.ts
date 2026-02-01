"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get personality template instructions (reused from assistants.ts pattern)
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
 * Build test instructions from AI config
 */
function buildTestInstructions(aiConfig: {
  aiPersonality: "professional" | "friendly" | "casual" | "technical";
  aiSystemPrompt: string;
  companyContext: string;
}): string {
  let instructions = "";

  // 1. Personality template
  if (aiConfig.aiPersonality) {
    instructions += getPersonalityTemplate(aiConfig.aiPersonality) + "\n\n";
  }

  // 2. User's custom system prompt
  instructions +=
    aiConfig.aiSystemPrompt || "You are a helpful customer support assistant.";

  // 3. Company context (user controls what's included - no hard-coded rules)
  if (aiConfig.companyContext && aiConfig.companyContext.trim() !== "") {
    instructions += "\n\n## Company Information\n\n" + aiConfig.companyContext;
  }

  return instructions;
}

/**
 * TEST AI ENDPOINT
 * For AI Studio testing - doesn't save to database
 * Uses OpenAI Assistants API to match production flow
 */
export const testAIResponse = action({
  args: {
    testMessage: v.string(),

    // Test AI Config (from AI Studio form)
    aiConfig: v.object({
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
      companyContext: v.string(),
      selectedAiModel: v.string(),
    }),

    // Company ID for caching test assistant
    companyId: v.id("companies"),

    // Optional conversation history for context
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (
    ctx,
    { testMessage, aiConfig, companyId, conversationHistory = [] }
  ) => {
    const startTime = Date.now();
    console.log(
      "[testAI] STARTED - testMessage length:",
      testMessage.length,
      "history:",
      conversationHistory.length
    );

    try {
      // 1. Get company to check for cached test assistant
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company) {
        throw new Error("Company not found");
      }

      // 2. Build instructions
      const instructions = buildTestInstructions({
        aiPersonality: aiConfig.aiPersonality,
        aiSystemPrompt: aiConfig.aiSystemPrompt,
        companyContext: aiConfig.companyContext,
      });
      console.log("[testAI] Instructions built, length:", instructions.length);

      // 3. Get or create test assistant (cached per company)
      let assistantId: string;
      const assistantTools = [
        {
          type: "function" as const,
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
      ];

      if (company.testAssistantId) {
        // Update existing test assistant
        console.log(
          "[testAI] Updating cached test assistant:",
          company.testAssistantId
        );
        const assistant = await openai.beta.assistants.update(
          company.testAssistantId,
          {
            name: "Test Assistant",
            model: aiConfig.selectedAiModel,
            instructions: instructions,
            tools: assistantTools,
          }
        );
        assistantId = assistant.id;
      } else {
        // Create new test assistant (first time)
        console.log(
          "[testAI] Creating new test assistant with model:",
          aiConfig.selectedAiModel
        );
        const assistant = await openai.beta.assistants.create({
          name: "Test Assistant",
          model: aiConfig.selectedAiModel,
          instructions: instructions,
          tools: assistantTools,
        });
        assistantId = assistant.id;
        console.log("[testAI] Test assistant created:", assistantId);

        // Save for reuse
        await ctx.runMutation(api.companies.mutations.updateTestAssistantId, {
          companyId,
          testAssistantId: assistantId,
        });
      }

      // 4. Create thread with conversation history + test message
      const threadMessages: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [
        ...conversationHistory.map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: testMessage },
      ];

      console.log(
        "[testAI] Creating thread with",
        threadMessages.length,
        "messages"
      );
      const thread = await openai.beta.threads.create({
        messages: threadMessages,
      });
      console.log("[testAI] Thread created:", thread.id);

      // 5. Run assistant and collect response
      let fullResponse = "";
      let shouldHandoff = false;
      let handoffReason = "";
      const usageData: {
        total_tokens?: number;
        completion_tokens?: number;
        prompt_tokens?: number;
      } = {};

      console.log(
        "[testAI] Creating stream with thread:",
        thread.id,
        "assistant:",
        assistantId
      );

      let stream;
      try {
        stream = await openai.beta.threads.runs.stream(thread.id, {
          assistant_id: assistantId,
        });
        console.log("[testAI] Stream created successfully");
      } catch (streamError) {
        console.error("[testAI] Failed to create stream:", streamError);
        throw new Error(
          `Failed to create stream: ${streamError instanceof Error ? streamError.message : "Unknown error"}`
        );
      }

      // Log stream initialization
      console.log("[testAI] Stream lifecycle:", {
        action: "start",
        timestamp: Date.now(),
        threadId: thread.id,
        assistantId: assistantId,
      });

      console.log("[testAI] Setting up event listeners");

      // Process stream events with timeout
      const streamPromise = new Promise<void>((resolve, reject) => {
        let hasResolved = false;
        let runId: string | null = null;
        let lastTextTime = Date.now();
        let streamHealthy = false;

        // Timeout safety (60 seconds)
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            console.error("[testAI] Stream timeout after 60 seconds");
            hasResolved = true;
            reject(new Error("Stream timeout - no response after 60 seconds"));
          }
        }, 60000);

        // Fallback: Check run status periodically
        // - If text received: check after 1s of silence
        // - If no text received: check after 3s (in case stream events fail)
        const streamStartTime = Date.now();
        const checkCompletionInterval = setInterval(async () => {
          if (hasResolved) return;

          const timeSinceLastText = Date.now() - lastTextTime;
          const timeSinceStart = Date.now() - streamStartTime;

          // Layer 3: Try to get run ID from stream state (doesn't require events to fire)
          const currentRun = stream.currentRun();
          if (currentRun && !runId) {
            runId = currentRun.id;
            console.log(
              "[testAI] Run ID captured from stream.currentRun():",
              runId
            );
          }

          // Check if we should poll:
          // 1. Received text and 1s silence (fast path)
          // 2. No text received after 3s (fallback if stream events fail)
          const shouldCheck =
            (fullResponse.length > 0 && timeSinceLastText > 1000) ||
            (fullResponse.length === 0 && timeSinceStart > 3000);

          // Fallback: No events after 5 seconds
          if (timeSinceStart > 5000 && !streamHealthy) {
            console.error(
              "[testAI] Stream failed - no events received after 5s"
            );
            reject(
              new Error("Stream initialization failed - no events received")
            );
            clearInterval(checkCompletionInterval);
            clearTimeout(timeout);
            hasResolved = true;
            return;
          }

          if (!shouldCheck) {
            return;
          }

          if (shouldCheck) {
            console.log(
              "[testAI] Checking run status...",
              fullResponse.length > 0 ? "text received" : "no text yet"
            );
            try {
              // Get the most recent run for this thread (works even without runId)
              const runs = await openai.beta.threads.runs.list(thread.id, {
                limit: 1,
              });
              const latestRun = runs.data[0];

              if (latestRun) {
                console.log(
                  "[testAI] Latest run ID:",
                  latestRun.id,
                  "status:",
                  latestRun.status
                );
                runId = latestRun.id; // Update runId for potential later use

                if (latestRun.status === "completed") {
                  // If completed but no text, try to get messages from thread
                  if (fullResponse.length === 0) {
                    console.log(
                      "[testAI] Run completed but no text received, fetching messages..."
                    );
                    try {
                      const threadMessages =
                        await openai.beta.threads.messages.list(thread.id, {
                          limit: 1,
                        });
                      const assistantMessages = threadMessages.data.filter(
                        (m) => m.role === "assistant"
                      );
                      if (assistantMessages.length > 0) {
                        const content = assistantMessages[0].content[0];
                        if (content.type === "text") {
                          fullResponse = content.text.value;
                          console.log(
                            "[testAI] Retrieved response from thread messages"
                          );
                        }
                      }
                    } catch (msgErr) {
                      console.error(
                        "[testAI] Failed to fetch thread messages:",
                        msgErr
                      );
                    }
                  }

                  if (latestRun.usage) {
                    usageData.total_tokens = latestRun.usage.total_tokens;
                    usageData.completion_tokens =
                      latestRun.usage.completion_tokens;
                    usageData.prompt_tokens = latestRun.usage.prompt_tokens;
                  }
                  clearInterval(checkCompletionInterval);
                  clearTimeout(timeout);
                  if (!hasResolved) {
                    hasResolved = true;
                    resolve();
                  }
                } else if (
                  latestRun.status === "failed" ||
                  latestRun.status === "cancelled"
                ) {
                  clearInterval(checkCompletionInterval);
                  clearTimeout(timeout);
                  if (!hasResolved) {
                    hasResolved = true;
                    const errorMsg =
                      (latestRun as any).last_error?.message || "Unknown error";
                    reject(new Error(`Run ${latestRun.status}: ${errorMsg}`));
                  }
                } else {
                  // Still processing - log status
                  console.log("[testAI] Run status:", latestRun.status);
                }
              } else {
                console.log("[testAI] No runs found for thread");
              }
            } catch (err) {
              console.error("[testAI] Error checking run status:", err);
            }
          }
        }, 1000); // Check every second

        // Layer 1: Subscribe to raw event stream FIRST (most reliable)
        stream.on("event", (event: any) => {
          streamHealthy = true;

          console.log("[testAI] Raw event:", event.event, {
            timestamp: Date.now() - streamStartTime,
          });

          // Extract IDs from events
          if (event.event === "thread.run.created" && event.data) {
            runId = event.data.id;
            console.log("[testAI] Run created (raw event) - runId:", runId);
          }

          // Also check for completion in raw events
          if (event.event === "thread.run.completed") {
            console.log("[testAI] Run completed (raw event)");
          }
        });

        // Layer 2: Helper events for normal flow
        stream
          .on("thread.run.created" as any, (run: any) => {
            streamHealthy = true;
            console.log("[testAI] Run created (helper event):", run.id);
            runId = run.id;
          })
          .on("textCreated", () => {
            streamHealthy = true;
            console.log("[testAI] textCreated event");
          })
          .on("textDelta" as any, (delta: { value?: string }) => {
            streamHealthy = true;
            console.log(
              "[testAI] textDelta received:",
              delta.value?.substring(0, 50)
            );
            if (delta.value) {
              fullResponse += delta.value;
              lastTextTime = Date.now();
            }
          })
          .on("textDone", () => {
            console.log(
              "[testAI] textDone event - response length:",
              fullResponse.length
            );
          })
          .on("thread.run.requires_action" as any, async (run: any) => {
            console.log("[testAI] requires_action event received");
            runId = run.id;
            // Handle tool calls for escalation
            if (run.required_action?.type === "submit_tool_outputs") {
              const toolCalls =
                run.required_action.submit_tool_outputs.tool_calls;
              for (const toolCall of toolCalls) {
                if (
                  toolCall.type === "function" &&
                  toolCall.function?.name === "escalate_to_human"
                ) {
                  console.log("[testAI] Escalation tool call detected");
                  shouldHandoff = true;
                  try {
                    const args = JSON.parse(
                      toolCall.function.arguments || "{}"
                    ) as { reason?: string };
                    handoffReason = args.reason || "Customer requested support";
                  } catch {
                    handoffReason = "Customer requested support";
                  }
                  // Submit response
                  await openai.beta.threads.runs.submitToolOutputs(
                    thread.id,
                    run.id,
                    {
                      tool_outputs: [
                        {
                          tool_call_id: toolCall.id,
                          output: JSON.stringify({ escalated: true }),
                        },
                      ],
                    }
                  );
                  console.log("[testAI] Tool output submitted");
                }
              }
            }
          })
          .on("thread.run.completed" as any, (run: any) => {
            console.log("[testAI] Run completed event received");
            runId = run.id;
            if (run.usage) {
              usageData.total_tokens = run.usage.total_tokens;
              usageData.completion_tokens = run.usage.completion_tokens;
              usageData.prompt_tokens = run.usage.prompt_tokens;
            }
            clearInterval(checkCompletionInterval);
            clearTimeout(timeout);
            if (!hasResolved) {
              hasResolved = true;
              resolve();
            }
          })
          .on("error", (error: unknown) => {
            streamHealthy = false;
            console.error("[testAI] Stream error:", error);
            clearInterval(checkCompletionInterval);
            clearTimeout(timeout);
            if (!hasResolved) {
              hasResolved = true;
              reject(error);
            }
          })
          .on("end", async () => {
            console.log("[testAI] Stream ended event fired");

            if (!hasResolved) {
              console.log(
                "[testAI] Stream ended but not resolved, using finalMessages()..."
              );
              try {
                const messages = await stream.finalMessages();
                const assistantMsg = messages.find(
                  (m) => m.role === "assistant"
                );

                if (
                  assistantMsg?.content[0]?.type === "text" &&
                  fullResponse.length === 0
                ) {
                  fullResponse = assistantMsg.content[0].text.value;
                  console.log(
                    "[testAI] Retrieved response via finalMessages()"
                  );
                }

                // Get final run state
                const finalRun = stream.currentRun();
                if (finalRun?.usage) {
                  usageData.total_tokens = finalRun.usage.total_tokens;
                  usageData.completion_tokens =
                    finalRun.usage.completion_tokens;
                  usageData.prompt_tokens = finalRun.usage.prompt_tokens;
                }

                clearInterval(checkCompletionInterval);
                clearTimeout(timeout);
                if (!hasResolved) {
                  hasResolved = true;
                  resolve();
                }
              } catch (err) {
                console.error("[testAI] finalMessages() failed:", err);
              }
            }
          })
          .on("done" as any, () => {
            console.log("[testAI] Stream done event received");
            // Stream ended, check final status
            if (!hasResolved && runId && fullResponse.length > 0) {
              console.log(
                "[testAI] Stream done, resolving with collected response"
              );
              clearInterval(checkCompletionInterval);
              clearTimeout(timeout);
              if (!hasResolved) {
                hasResolved = true;
                resolve();
              }
            }
          });
      });

      console.log("[testAI] Waiting for stream promise...");
      try {
        await streamPromise;
        console.log("[testAI] Stream promise resolved successfully");
      } catch (streamError) {
        console.error("[testAI] Stream promise rejected:", streamError);
        throw streamError;
      }

      // 6. Return results (test assistant is cached, not deleted)
      const processingTime = Date.now() - startTime;
      const tokensUsed = usageData.total_tokens ?? 0;
      return {
        success: true,
        response:
          fullResponse || (shouldHandoff ? "Escalating to support..." : ""),
        handoff: shouldHandoff,
        handoffReason,
        processingTime,
        tokensUsed,
        model: aiConfig.selectedAiModel,
      };
    } catch (error) {
      console.error("Error testing AI:", error);
      throw new Error(
        `Failed to test AI: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
