"use node";

/**
 * AI RESPONSE GENERATION using OpenAI Assistants API
 *
 * Generates AI responses using OpenAI Assistants, Threads, and Vector Stores
 * for automatic context management and conversation history.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get token limit based on response length setting
 */
function getTokenLimit(
  responseLength: "brief" | "medium" | "detailed"
): number {
  switch (responseLength) {
    case "brief":
      return 200;
    case "medium":
      return 500;
    case "detailed":
      return 1500;
    default:
      return 500;
  }
}

/**
 * Sanitize AI response to ensure it's human-friendly
 * Filters out error messages, technical errors, and API failures
 */
function sanitizeAIResponse(response: string): string {
  if (!response || response.trim().length === 0) {
    console.log("[sanitizeAIResponse] Empty response detected, using fallback");
    return "I'd be happy to help you with that! How can I assist you today?";
  }

  // List of error patterns to detect
  const errorPatterns = [
    /error:\s*/i,
    /failed:\s*/i,
    /exception:\s*/i,
    /api error/i,
    /system error/i,
    /internal error/i,
    /server error/i,
    /failed to/i,
    /error occurred/i,
    /error message/i,
    /error code/i,
    /status code\s*\d{3}/i,
    /http error/i,
    /openai error/i,
    /openai api/i,
    /rate limit/i,
    /timeout error/i,
    /connection error/i,
    /network error/i,
    /database error/i,
    /sql error/i,
    /stack trace/i,
    /traceback/i,
    /at\s+\w+\.\w+/i, // Stack trace patterns like "at function.name"
    /\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}/i, // Timestamp patterns
  ];

  // List of forbidden technical language patterns (file_search, knowledge base, etc.)
  const forbiddenPatterns = [
    /no files uploaded/i,
    /files uploaded/i,
    /uploaded files/i,
    /no files/i,
    /file_search/i,
    /file search/i,
    /search did not return/i,
    /search returned no results/i,
    /search did not find/i,
    /search found nothing/i,
    /search found no/i,
    /no relevant information/i,
    /couldn't find information/i,
    /could not find information/i,
    /couldn't find/i,
    /could not find/i,
    /information not found/i,
    /no information found/i,
    /information was not found/i,
    /knowledge base/i,
    /vector store/i,
    /in the files/i,
    /in the uploaded files/i,
    /in the knowledge base/i,
    /according to the files/i,
    /according to the knowledge base/i,
    /found in the files/i,
    /found in the knowledge base/i,
    /from the files/i,
    /from the knowledge base/i,
    /the search/i,
    /search results/i,
    /search query/i,
    /search returned/i,
  ];

  // Check if response contains error patterns
  const containsError = errorPatterns.some((pattern) => pattern.test(response));

  // Check if response contains forbidden technical language
  const containsForbidden = forbiddenPatterns.some((pattern) =>
    pattern.test(response)
  );

  // Check if response starts with error-like phrases
  const errorStarters = [
    "error",
    "failed",
    "exception",
    "unable to",
    "cannot",
    "unexpected",
  ];
  const startsWithError = errorStarters.some((starter) =>
    response.toLowerCase().trim().startsWith(starter)
  );

  // If error or forbidden language detected, log but don't replace (for debugging)
  if (containsError || containsForbidden || startsWithError) {
    console.log(
      "[sanitizeAIResponse] Potential error pattern detected (but not replacing for debugging)",
      {
        containsError,
        containsForbidden,
        startsWithError,
        responsePreview: response.substring(0, 300),
      }
    );
    // Temporarily disabled to debug AI responses
    // return "I'd be happy to help you with that! How can I assist you today?";
  }

  return response;
}

export const generateAIResponse = action({
  args: {
    conversationId: v.id("conversations"),
    experienceId: v.string(),
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
  },
  handler: async (ctx, { conversationId, experienceId, aiConfig }) => {
    const startTime = Date.now();

    // Guard: skip if already processing
    const conv = await ctx.runQuery(api.conversations.queries.getConversation, {
      conversationId,
    });

    if (conv?.aiProcessing) {
      console.log("⏭️  AI already processing, skipping duplicate trigger");
      return {
        success: false,
        reason: "already_processing",
        handoff: false,
        processingTime: 0,
      };
    }

    // Clear pendingAIJobId (job is now running)
    await ctx.runMutation(api.conversations.mutations.clearPendingAIJob, {
      conversationId,
    });

    const MAX_RETRIES = 3;
    let attempt = 0;
    let lastError: Error | null = null;

    // Set AI processing state ONCE before retry loop
    await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
      conversationId,
      isProcessing: true,
    });

    while (attempt < MAX_RETRIES) {
      try {
        attempt++;
        console.log(`🤖 AI generation attempt ${attempt}/${MAX_RETRIES}`);

        // 1. Get conversation and company
        const conversation = await ctx.runQuery(
          api.conversations.queries.getConversation,
          {
            conversationId,
          }
        );

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        const company = await ctx.runQuery(
          api.companies.queries.getCompanyById,
          {
            companyId: conversation.companyId,
          }
        );

        if (!company) {
          throw new Error("Company not found");
        }

        if (!company.openaiAssistantId) {
          throw new Error(
            "OpenAI Assistant not created yet. Please wait a moment and try again."
          );
        }

        // 2. Check rate limits before generating response
        const rateLimitCheck = await ctx.runQuery(
          api.rateLimiter.checkRateLimit,
          { 
            limitType: "aiResponse",
            identifier: conversation.companyId 
          }
        );

        if (rateLimitCheck.isRateLimited) {
          console.log(`⚠️ Rate limit exceeded for company ${conversation.companyId}`);
          
          // Create system message about rate limit
          await ctx.runMutation(api.messages.mutations.createMessage, {
            conversationId,
            role: "system",
            content: `Our system is experiencing high demand. ${rateLimitCheck.message || 'Please wait a moment before sending another message.'}`,
            systemMessageType: "handoff",
          });

          // Update conversation to available for human support
          await ctx.runMutation(api.conversations.mutations.updateStatus, {
            conversationId,
            status: "available",
            handoffReason: "Rate limit exceeded - high demand",
          });
          
          return { success: false, error: "Rate limited" };
        }

        // 3. Check monthly usage limits before generating response
        const usageCheck = await ctx.runQuery(
          api.usage.queries.checkUsageLimit,
          {
            companyId: conversation.companyId,
          }
        );

        if (usageCheck.hasReachedLimit) {
          // Don't generate AI response, create customer-friendly message and handoff
          await ctx.runMutation(api.messages.mutations.createMessage, {
            conversationId,
            role: "system",
            content:
              "AI support bot is currently not available in this Whop at the moment. A support staff will be in contact with you shortly.",
          });

          // Trigger handoff to support staff
          await ctx.runMutation(api.conversations.mutations.triggerHandoff, {
            conversationId,
            reason: "AI usage limit reached for this company",
          });

          // Notify support agents
          const supportAgents = await ctx.runQuery(
            api.users.queries.listTeamMembersByCompany,
            { companyId: conversation.companyId }
          );

          const agentWhopUserIds = supportAgents
            .filter(
              (agent: any) => agent.role === "support" || agent.role === "admin"
            )
            .map((agent: any) => agent.whopUserId);

          if (agentWhopUserIds.length > 0 && experienceId) {
            const customer = await ctx.runQuery(api.users.queries.getUserById, {
              userId: conversation.customerId,
            });

            await ctx.runAction(api.notifications.whop.notifySupportAgents, {
              agentWhopUserIds,
              title: "Customer needs assistance",
              content: `${customer?.displayName || "A customer"} is waiting for support (AI limit reached)`,
              experienceId,
              restPath: `/experiences/${experienceId}/dashboard/support?conversation=${conversationId}`,
            });
          }

          // Clear AI processing state
          await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
            conversationId,
            isProcessing: false,
          });

          return {
            success: false,
            reason: "usage_limit_reached",
            handoff: true,
            processingTime: Date.now() - startTime,
          };
        }

        // 3. Get last customer message
        const messages = await ctx.runQuery(api.messages.queries.getMessages, {
          conversationId,
          limit: 1,
        });

        const lastMessage = messages.find((m: any) => m.role === "customer");

        if (!lastMessage) {
          throw new Error("No customer message found");
        }

        // 4. Create or get thread, then run assistant
        // Type for the stream (union of both possible stream types)
        type StreamType =
          | Awaited<ReturnType<typeof openai.beta.threads.createAndRunStream>>
          | Awaited<ReturnType<typeof openai.beta.threads.runs.stream>>;
        let stream: StreamType;
        let threadId: string = "";
        let runId: string = "";

        let fullResponse = "";
        let shouldHandoff = false;
        let handoffReason = "";
        let finalRunData: OpenAI.Beta.Threads.Runs.Run | null = null;
        let lastTextTime = Date.now();

        if (!conversation.openaiThreadId) {
          // First message: Create thread + run together (optimized - 1 API call)
          console.log("📝 Creating new thread with first message");

          // Log stream initialization
          console.log("[AI] Stream lifecycle:", {
            action: "start",
            timestamp: Date.now(),
            conversationId,
            assistantId: company.openaiAssistantId,
            hasExistingThread: false,
          });

          const companyContext = company.companyContextOriginal || company.companyContextProcessed || "";
          stream = openai.beta.threads.createAndRunStream({
            assistant_id: company.openaiAssistantId,
            thread: {
              messages: [
                {
                  role: "user",
                  content: lastMessage.content,
                },
              ],
              metadata: {
                conversationId: conversation._id,
                companyId: conversation.companyId,
              },
            },
            temperature: 0.7,
            max_completion_tokens: getTokenLimit(aiConfig.aiResponseLength),
          } as any);

          // Wrap streamPromise with polling fallback
          const streamPromiseWithPolling =
            new Promise<OpenAI.Beta.Threads.Runs.Run>((resolve, reject) => {
              let hasResolved = false;
              const streamStartTime = Date.now();
              let streamHealthy = false;

              const timeout = setTimeout(() => {
                if (!hasResolved) {
                  hasResolved = true;
                  reject(new Error("Stream timeout after 60 seconds"));
                }
              }, 60000);

              const checkCompletionInterval = setInterval(async () => {
                if (hasResolved) return;

                const timeSinceLastText = Date.now() - lastTextTime;
                const timeSinceStart = Date.now() - streamStartTime;

                // Layer 3: Try to get IDs from stream state (doesn't require events to fire)
                const currentRun = stream.currentRun();
                if (currentRun && (!runId || !threadId)) {
                  runId = currentRun.id;
                  threadId = currentRun.thread_id;
                  console.log(
                    "[generateResponse] IDs captured from stream.currentRun():",
                    { threadId, runId }
                  );
                }

                // Check if we should poll:
                // 1. Received text and 1s silence (fast path) - requires threadId
                // 2. No text received after 3s (fallback if stream events fail)
                const shouldCheck =
                  (fullResponse.length > 0 &&
                    timeSinceLastText > 1000 &&
                    threadId) ||
                  (fullResponse.length === 0 && timeSinceStart > 3000);

                // Fallback: No threadId after 5 seconds and stream not healthy
                if (!threadId && timeSinceStart > 5000 && !streamHealthy) {
                  console.error(
                    "[generateResponse] Stream failed - no events received after 5s"
                  );
                  reject(
                    new Error(
                      "Stream initialization failed - no events received"
                    )
                  );
                  clearInterval(checkCompletionInterval);
                  clearTimeout(timeout);
                  hasResolved = true;
                  return;
                }

                if (!shouldCheck || !threadId) {
                  return;
                }

                if (shouldCheck) {
                  console.log(
                    "[generateResponse] Checking run status...",
                    fullResponse.length > 0 ? "text received" : "no text yet"
                  );
                  try {
                    const runs = await openai.beta.threads.runs.list(threadId, {
                      limit: 1,
                    });
                    const latestRun = runs.data[0];

                    if (latestRun) {
                      if (latestRun.status === "completed") {
                        // If completed but no text, try to get messages from thread
                        if (fullResponse.length === 0) {
                          console.log(
                            "[generateResponse] Run completed but no text received, fetching messages..."
                          );
                          try {
                            const threadMessages =
                              await openai.beta.threads.messages.list(
                                threadId,
                                {
                                  limit: 2, // Get last 2 messages to ensure we get the assistant's response
                                  order: "desc"
                                }
                              );
                            const assistantMessages =
                              threadMessages.data.filter(
                                (m) => m.role === "assistant"
                              );
                            if (assistantMessages.length > 0) {
                              const content = assistantMessages[0].content[0];
                              if (content.type === "text") {
                                fullResponse = content.text.value;
                                console.log(
                                  "[generateResponse] Retrieved response from thread messages"
                                );
                              }
                            }
                          } catch (msgErr) {
                            console.error(
                              "[generateResponse] Failed to fetch thread messages:",
                              msgErr
                            );
                          }
                        }

                        finalRunData =
                          latestRun as OpenAI.Beta.Threads.Runs.Run;
                        clearInterval(checkCompletionInterval);
                        clearTimeout(timeout);
                        if (!hasResolved) {
                          hasResolved = true;
                          resolve(latestRun as OpenAI.Beta.Threads.Runs.Run);
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
                            (latestRun as any).last_error?.message ||
                            "Unknown error";
                          reject(
                            new Error(`Run ${latestRun.status}: ${errorMsg}`)
                          );
                        }
                      } else {
                        // Still processing - log status
                        console.log(
                          "[generateResponse] Run status:",
                          latestRun.status
                        );
                      }
                    }
                  } catch (err) {
                    console.error(
                      "[generateResponse] Error checking run status:",
                      err
                    );
                  }
                }
              }, 1000);

              // Layer 1: Subscribe to raw event stream FIRST (most reliable)
              stream.on("event", (event: any) => {
                streamHealthy = true;

                console.log("[AI] Raw event:", event.event, {
                  timestamp: Date.now() - streamStartTime,
                });

                // Extract IDs from first events
                if (event.event === "thread.created" && event.data?.id) {
                  threadId = event.data.id;
                  console.log(
                    "[generateResponse] Thread ID captured from raw event:",
                    threadId
                  );
                }

                if (event.event === "thread.run.created" && event.data) {
                  runId = event.data.id;
                  threadId = event.data.thread_id || threadId;
                  console.log(
                    "[generateResponse] Run created (raw event) - threadId:",
                    threadId,
                    "runId:",
                    runId
                  );
                }

                // Also check for completion in raw events
                if (event.event === "thread.run.completed") {
                  console.log("[generateResponse] Run completed (raw event)");
                }
              });

              // Layer 2: Helper events for normal flow
              stream
                .on(
                  "thread.run.created" as any,
                  (run: OpenAI.Beta.Threads.Runs.Run) => {
                    streamHealthy = true;
                    // Capture threadId and runId as early as possible
                    runId = run.id;
                    threadId = run.thread_id;
                    console.log(
                      "[generateResponse] Run created (helper event):",
                      run.id,
                      "threadId:",
                      run.thread_id
                    );
                  }
                )
                .on("textCreated", () => {
                  streamHealthy = true;
                  console.log("[generateResponse] textCreated event");
                })
                .on("textDelta", (delta: { value?: string }) => {
                  streamHealthy = true;
                  if (delta.value) {
                    fullResponse += delta.value;
                    lastTextTime = Date.now();
                  }
                })
                .on("textDone", () => {
                  console.log(
                    "[generateResponse] textDone event - response length:",
                    fullResponse.length
                  );
                })
                .on(
                  "thread.run.requires_action" as any,
                  async (run: OpenAI.Beta.Threads.Runs.Run) => {
                    console.log("[AI] requires_action handler triggered", {
                      runId: run.id,
                      threadId: run.thread_id,
                      required_action: run.required_action
                    });
                    
                    runId = run.id;
                    threadId = run.thread_id;

                    if (run.required_action?.type === "submit_tool_outputs") {
                      const toolCalls =
                        run.required_action.submit_tool_outputs.tool_calls;

                      for (const toolCall of toolCalls) {
                        console.log("[AI] Function call detected:", {
                          type: toolCall.type,
                          functionName: toolCall.function?.name,
                          arguments: toolCall.function?.arguments
                        });
                        
                        if (
                          toolCall.type === "function" &&
                          toolCall.function?.name === "escalate_to_human"
                        ) {
                          shouldHandoff = true;
                          try {
                            const args = JSON.parse(
                              toolCall.function.arguments || "{}"
                            ) as { reason?: string };
                            handoffReason =
                              args.reason || "Customer requested support staff";
                          } catch {
                            handoffReason = "Customer requested support staff";
                          }

                          // Submit tool output (required by API)
                          await openai.beta.threads.runs.submitToolOutputs(
                            threadId,
                            runId,
                            {
                              tool_outputs: [
                                {
                                  tool_call_id: toolCall.id,
                                  output: JSON.stringify({ escalated: true }),
                                },
                              ],
                            }
                          );
                        }
                      }
                    }
                  }
                )
                .on(
                  "thread.run.completed" as any,
                  async (run: OpenAI.Beta.Threads.Runs.Run) => {
                    runId = run.id;
                    threadId = run.thread_id;
                    finalRunData = run;

                    // Save thread ID to conversation
                    try {
                      await ctx.runMutation(
                        api.conversations.mutations.updateThreadId,
                        {
                          conversationId,
                          openaiThreadId: threadId,
                        }
                      );
                    } catch (mutationError) {
                      // Log error but don't fail the entire operation
                      // The thread still exists in OpenAI, we just failed to save the reference
                      console.error(
                        "[generateResponse] Failed to save thread ID to conversation:",
                        mutationError,
                        { conversationId, threadId }
                      );
                      // Continue - the thread exists in OpenAI even if we couldn't save the reference
                    }

                    clearInterval(checkCompletionInterval);
                    clearTimeout(timeout);
                    if (!hasResolved) {
                      hasResolved = true;
                      resolve(run);
                    }
                  }
                )
                .on("error", (error: unknown) => {
                  streamHealthy = false;
                  console.error("[generateResponse] Stream error:", error);
                  clearInterval(checkCompletionInterval);
                  clearTimeout(timeout);
                  if (!hasResolved) {
                    hasResolved = true;
                    reject(error);
                  }
                })
                .on("end", async () => {
                  console.log("[generateResponse] Stream ended event fired");

                  if (!hasResolved) {
                    console.log(
                      "[generateResponse] Stream ended but not resolved, using finalMessages()..."
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
                          "[generateResponse] Retrieved response via finalMessages()"
                        );
                      }

                      // Get final run state
                      const finalRun = stream.currentRun();
                      if (finalRun) {
                        finalRunData = finalRun;
                      }

                      clearInterval(checkCompletionInterval);
                      clearTimeout(timeout);
                      if (!hasResolved) {
                        hasResolved = true;
                        resolve(
                          (finalRunData || {
                            status: "completed",
                          }) as OpenAI.Beta.Threads.Runs.Run
                        );
                      }
                    } catch (err) {
                      console.error(
                        "[generateResponse] finalMessages() failed:",
                        err
                      );
                    }
                  }
                });
            });

          await streamPromiseWithPolling;
        } else {
          // Existing thread: Add message + run (2 API calls)
          console.log("📝 Adding message to existing thread");

          threadId = conversation.openaiThreadId;

          // Add customer message to thread
          await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: lastMessage.content,
          });

          // Create run with streaming
          // Log stream initialization
          console.log("[AI] Stream lifecycle:", {
            action: "start",
            timestamp: Date.now(),
            conversationId,
            assistantId: company.openaiAssistantId,
            hasExistingThread: true,
            threadId,
          });

          const companyContext = company.companyContextOriginal || company.companyContextProcessed || "";
          stream = openai.beta.threads.runs.stream(threadId, {
            assistant_id: company.openaiAssistantId,
            temperature: 0.7,
            max_completion_tokens: getTokenLimit(aiConfig.aiResponseLength),
            additional_instructions: companyContext ? `CRITICAL: ${companyContext}` : undefined,
          });

          // Wrap streamPromise with polling fallback
          const streamPromiseWithPolling =
            new Promise<OpenAI.Beta.Threads.Runs.Run>((resolve, reject) => {
              let hasResolved = false;
              const streamStartTime = Date.now();
              let streamHealthy = false;

              const timeout = setTimeout(() => {
                if (!hasResolved) {
                  hasResolved = true;
                  reject(new Error("Stream timeout after 60 seconds"));
                }
              }, 60000);

              const checkCompletionInterval = setInterval(async () => {
                if (hasResolved) return;

                const timeSinceLastText = Date.now() - lastTextTime;
                const timeSinceStart = Date.now() - streamStartTime;

                // Layer 3: Try to get IDs from stream state (doesn't require events to fire)
                const currentRun = stream.currentRun();
                if (currentRun && !runId) {
                  runId = currentRun.id;
                  // threadId is already set for existing threads
                  console.log(
                    "[generateResponse] Run ID captured from stream.currentRun():",
                    runId
                  );
                }

                // Check if we should poll:
                // 1. Received text and 1s silence (fast path)
                // 2. No text received after 3s (fallback if stream events fail)
                const shouldCheck =
                  (fullResponse.length > 0 && timeSinceLastText > 1000) ||
                  (fullResponse.length === 0 && timeSinceStart > 3000);

                // Fallback: Stream not healthy after 5 seconds (for new threads only)
                // For existing threads, threadId is already set so we can always poll
                // This check only applies if we somehow don't have threadId (shouldn't happen for existing threads)

                if (!shouldCheck) {
                  return;
                }

                if (shouldCheck) {
                  console.log(
                    "[generateResponse] Checking run status...",
                    fullResponse.length > 0 ? "text received" : "no text yet"
                  );
                  try {
                    const runs = await openai.beta.threads.runs.list(threadId, {
                      limit: 1,
                    });
                    const latestRun = runs.data[0];

                    if (latestRun) {
                      if (latestRun.status === "completed") {
                        // If completed but no text, try to get messages from thread
                        if (fullResponse.length === 0) {
                          console.log(
                            "[generateResponse] Run completed but no text received, fetching messages..."
                          );
                          try {
                            const threadMessages =
                              await openai.beta.threads.messages.list(
                                threadId,
                                {
                                  limit: 2, // Get last 2 messages to ensure we get the assistant's response
                                  order: "desc"
                                }
                              );
                            const assistantMessages =
                              threadMessages.data.filter(
                                (m) => m.role === "assistant"
                              );
                            if (assistantMessages.length > 0) {
                              const content = assistantMessages[0].content[0];
                              if (content.type === "text") {
                                fullResponse = content.text.value;
                                console.log(
                                  "[generateResponse] Retrieved response from thread messages"
                                );
                              }
                            }
                          } catch (msgErr) {
                            console.error(
                              "[generateResponse] Failed to fetch thread messages:",
                              msgErr
                            );
                          }
                        }

                        finalRunData =
                          latestRun as OpenAI.Beta.Threads.Runs.Run;
                        clearInterval(checkCompletionInterval);
                        clearTimeout(timeout);
                        if (!hasResolved) {
                          hasResolved = true;
                          resolve(latestRun as OpenAI.Beta.Threads.Runs.Run);
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
                            (latestRun as any).last_error?.message ||
                            "Unknown error";
                          reject(
                            new Error(`Run ${latestRun.status}: ${errorMsg}`)
                          );
                        }
                      } else {
                        // Still processing - log status
                        console.log(
                          "[generateResponse] Run status:",
                          latestRun.status
                        );
                      }
                    }
                  } catch (err) {
                    console.error(
                      "[generateResponse] Error checking run status:",
                      err
                    );
                  }
                }
              }, 1000);

              // Layer 1: Subscribe to raw event stream FIRST (most reliable)
              stream.on("event", (event: any) => {
                streamHealthy = true;

                console.log("[AI] Raw event:", event.event, {
                  timestamp: Date.now() - streamStartTime,
                });

                // Extract IDs from events (threadId already set for existing threads)
                if (event.event === "thread.run.created" && event.data) {
                  runId = event.data.id;
                  console.log(
                    "[generateResponse] Run created (raw event) - runId:",
                    runId
                  );
                }

                // Also check for completion in raw events
                if (event.event === "thread.run.completed") {
                  console.log("[generateResponse] Run completed (raw event)");
                }
              });

              // Layer 2: Helper events for normal flow
              stream
                .on("textCreated", () => {
                  streamHealthy = true;
                  console.log("[generateResponse] textCreated event");
                })
                .on("textDelta", (delta: { value?: string }) => {
                  streamHealthy = true;
                  if (delta.value) {
                    fullResponse += delta.value;
                    lastTextTime = Date.now();
                  }
                })
                .on("textDone", () => {
                  console.log(
                    "[generateResponse] textDone event - response length:",
                    fullResponse.length
                  );
                })
                .on(
                  "thread.run.requires_action" as any,
                  async (run: OpenAI.Beta.Threads.Runs.Run) => {
                    console.log("[AI] requires_action handler triggered", {
                      runId: run.id,
                      threadId: threadId,
                      required_action: run.required_action
                    });
                    
                    runId = run.id;

                    if (run.required_action?.type === "submit_tool_outputs") {
                      const toolCalls =
                        run.required_action.submit_tool_outputs.tool_calls;

                      for (const toolCall of toolCalls) {
                        console.log("[AI] Function call detected:", {
                          type: toolCall.type,
                          functionName: toolCall.function?.name,
                          arguments: toolCall.function?.arguments
                        });
                        
                        if (
                          toolCall.type === "function" &&
                          toolCall.function?.name === "escalate_to_human"
                        ) {
                          shouldHandoff = true;
                          try {
                            const args = JSON.parse(
                              toolCall.function.arguments || "{}"
                            ) as { reason?: string };
                            handoffReason =
                              args.reason || "Customer requested support staff";
                          } catch {
                            handoffReason = "Customer requested support staff";
                          }

                          // Submit tool output
                          await openai.beta.threads.runs.submitToolOutputs(
                            threadId,
                            runId,
                            {
                              tool_outputs: [
                                {
                                  tool_call_id: toolCall.id,
                                  output: JSON.stringify({ escalated: true }),
                                },
                              ],
                            }
                          );
                        }
                      }
                    }
                  }
                )
                .on(
                  "thread.run.completed" as any,
                  (run: OpenAI.Beta.Threads.Runs.Run) => {
                    runId = run.id;
                    finalRunData = run;
                    clearInterval(checkCompletionInterval);
                    clearTimeout(timeout);
                    if (!hasResolved) {
                      hasResolved = true;
                      resolve(run);
                    }
                  }
                )
                .on("error", (error: unknown) => {
                  streamHealthy = false;
                  console.error("[generateResponse] Stream error:", error);
                  clearInterval(checkCompletionInterval);
                  clearTimeout(timeout);
                  if (!hasResolved) {
                    hasResolved = true;
                    reject(error);
                  }
                })
                .on("end", async () => {
                  console.log("[generateResponse] Stream ended event fired");

                  if (!hasResolved) {
                    console.log(
                      "[generateResponse] Stream ended but not resolved, using finalMessages()..."
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
                          "[generateResponse] Retrieved response via finalMessages()"
                        );
                      }

                      // Get final run state
                      const finalRun = stream.currentRun();
                      if (finalRun) {
                        finalRunData = finalRun;
                      }

                      clearInterval(checkCompletionInterval);
                      clearTimeout(timeout);
                      if (!hasResolved) {
                        hasResolved = true;
                        resolve(
                          (finalRunData || {
                            status: "completed",
                          }) as OpenAI.Beta.Threads.Runs.Run
                        );
                      }
                    } catch (err) {
                      console.error(
                        "[generateResponse] finalMessages() failed:",
                        err
                      );
                    }
                  }
                });
            });

          await streamPromiseWithPolling;
        }

        // Check if run requires action after streaming completes
        if (threadId && runId) {
          console.log("[AI] Checking run status after stream...");
          try {
            const currentRunStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
            console.log("[AI] Current run status:", currentRunStatus.status);
            
            if (currentRunStatus.status === "requires_action" && currentRunStatus.required_action) {
              console.log("[AI] Run requires action:", currentRunStatus.required_action);
              
              if (currentRunStatus.required_action.type === "submit_tool_outputs") {
                const toolCalls = currentRunStatus.required_action.submit_tool_outputs.tool_calls;
                console.log("[AI] Tool calls requiring action:", toolCalls);
                
                // For now, just continue without the tool to generate a response
                // This is a temporary fix to prevent the fallback message
                console.log("[AI] Cancelling run to generate response without tool");
                await openai.beta.threads.runs.cancel(threadId, runId);
                
                // Create a new run without requiring the tool
                const newRun = await openai.beta.threads.runs.create(threadId, {
                  assistant_id: company.openaiAssistantId,
                  instructions: "Please answer the user's question directly without using any tools.",
                  temperature: 0.7,
                  max_completion_tokens: getTokenLimit(aiConfig.aiResponseLength),
                });
                
                // Wait for the new run to complete
                let newRunStatus = await openai.beta.threads.runs.retrieve(threadId, newRun.id);
                let attempts = 0;
                while (newRunStatus.status !== "completed" && attempts < 30) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  newRunStatus = await openai.beta.threads.runs.retrieve(threadId, newRun.id);
                  attempts++;
                }
                
                // Get the messages
                if (newRunStatus.status === "completed") {
                  const messages = await openai.beta.threads.messages.list(threadId, {
                    limit: 1,
                    order: "desc"
                  });
                  
                  const assistantMessage = messages.data.find(m => m.role === "assistant");
                  if (assistantMessage?.content[0]?.type === "text") {
                    fullResponse = assistantMessage.content[0].text.value;
                    console.log("[AI] Retrieved response from new run without tools");
                  }
                }
              }
            }
          } catch (err) {
            console.error("[AI] Error checking/handling run status:", err);
          }
        }

        // Debug: Log run steps to see tool usage (especially file_search)
        if (finalRunData && threadId) {
          try {
            const finalRunId = (finalRunData as any).id || runId || "";
            if (!finalRunId) {
              console.log("Cannot log run steps - no run ID available");
            } else {
              const runSteps = await openai.beta.threads.runs.steps.list(
                threadId,
                finalRunId
              );

              console.log("=== RUN STEPS DEBUG ===");
              console.log("Thread ID:", threadId);
              console.log("Run ID:", finalRunId);
              console.log("Total Steps:", runSteps.data.length);

              let hasFileSearch = false;
              let messageCreationStep: any = null;

              for (const step of runSteps.data) {
                console.log("Step Type:", step.type);
                if (step.type === "tool_calls") {
                  const stepDetails = step.step_details as {
                    tool_calls?: Array<{ type?: string; id?: string }>;
                  };
                  const toolCalls = stepDetails.tool_calls || [];
                  console.log("  Tool Calls Count:", toolCalls.length);
                  for (const tc of toolCalls) {
                    console.log("    Tool Type:", tc.type);
                    if (tc.type === "file_search") {
                      console.log("    FILE_SEARCH INVOKED!");
                      console.log("    Tool Call ID:", tc.id);
                      hasFileSearch = true;
                    }
                  }
                }
                if (step.type === "message_creation") {
                  const stepDetails = step.step_details as {
                    message_creation?: { message_id?: string };
                  };
                  console.log(
                    "  Message Created:",
                    stepDetails.message_creation
                  );
                  messageCreationStep = stepDetails.message_creation;
                }
              }

              // If file_search was used but we got no text, fetch the message directly
              if (hasFileSearch && fullResponse.length === 0 && messageCreationStep?.message_id) {
                console.log("[generateResponse] File search was used but no text received, fetching message directly");
                try {
                  const message = await openai.beta.threads.messages.retrieve(
                    threadId,
                    messageCreationStep.message_id
                  );
                  
                  if (message.content[0]?.type === "text") {
                    fullResponse = message.content[0].text.value;
                    console.log("[generateResponse] Retrieved response from message after file_search");
                  }
                } catch (msgErr) {
                  console.error("[generateResponse] Failed to fetch message after file_search:", msgErr);
                }
              }
            }
          } catch (err) {
            console.log("Could not retrieve run steps:", err);
          }
        }

        // 5. Get usage from final run
        // Usage may not be available immediately, safely extract it
        const usage = finalRunData
          ? (
              finalRunData as {
                usage?: {
                  total_tokens?: number;
                  completion_tokens?: number;
                  prompt_tokens?: number;
                };
              }
            ).usage
          : null;
        const processingTime = Date.now() - startTime;

        // 6. Handle handoff
        if (shouldHandoff) {
          // Create AI message with handoff notification
          const handoffMessage =
            fullResponse.trim() ||
            "Let me connect you with our support team who can better assist you.";

          await ctx.runMutation(api.messages.mutations.createMessage, {
            conversationId,
            role: "ai",
            content: handoffMessage,
            aiModel: aiConfig.selectedAiModel,
            processingTime,
            tokensUsed: usage?.completion_tokens || 0,
          });

          // Trigger handoff
          await ctx.runMutation(api.conversations.mutations.triggerHandoff, {
            conversationId,
            reason: handoffReason,
          });

          // Send notification to support agents
          const supportAgents = await ctx.runQuery(
            api.users.queries.listTeamMembersByCompany,
            {
              companyId: conversation.companyId,
            }
          );

          const agentWhopUserIds = supportAgents
            .filter(
              (agent: any) => agent.role === "support" || agent.role === "admin"
            )
            .map((agent: any) => agent.whopUserId);

          if (agentWhopUserIds.length > 0 && experienceId) {
            const customer = await ctx.runQuery(api.users.queries.getUserById, {
              userId: conversation.customerId,
            });

            await ctx.runAction(api.notifications.whop.notifySupportAgents, {
              agentWhopUserIds,
              title: "New customer needs help",
              content: `${customer?.displayName || "A customer"} needs assistance: ${handoffReason}`,
              experienceId,
              restPath: `/experiences/${experienceId}/dashboard/support?conversation=${conversationId}`,
            });
          }
        } else {
          // 7. Normal AI response - save to Convex
          // Note: Message is already in thread, we just save to Convex for our UI

          // Filter out error messages and technical details to ensure human-friendly responses
          console.log("[AI] Raw response:", fullResponse.substring(0, 200));
          const sanitizedResponse = sanitizeAIResponse(fullResponse);
          console.log("[AI] Sanitized response:", sanitizedResponse.substring(0, 200));

          await ctx.runMutation(api.messages.mutations.createMessage, {
            conversationId,
            role: "ai",
            content: sanitizedResponse,
            aiModel: aiConfig.selectedAiModel,
            tokensUsed: usage?.total_tokens || 0,
            processingTime,
          });

          // Track usage and rate limiting
          await ctx.runMutation(api.usage.mutations.trackAIResponse, {
            conversationId,
            aiModel: aiConfig.selectedAiModel,
            tokensUsed: usage?.total_tokens || 0,
            experienceId,
          });
          
          // Record this request for rate limiting
          await ctx.runMutation(api.rateLimiter.recordRateLimitedRequest, {
            limitType: "aiResponse",
            identifier: conversation.companyId,
            metadata: { 
              conversationId,
              aiModel: aiConfig.selectedAiModel,
              tokensUsed: usage?.total_tokens || 0
            },
          });
        }

        // 8. Clear AI processing state
        await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
          conversationId,
          isProcessing: false,
        });

        console.log(
          `✅ AI response generated successfully (attempt ${attempt})`
        );

        return {
          success: true,
          handoff: shouldHandoff,
          processingTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ AI generation failed (attempt ${attempt}):`, error);

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = 1000 * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${backoffMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    console.error("💥 All AI generation attempts failed:", lastError);

    // Clear AI processing state before showing error
    await ctx.runMutation(api.conversations.mutations.setAiProcessing, {
      conversationId,
      isProcessing: false,
    });

    // Create fallback system message
    await ctx.runMutation(api.messages.mutations.createMessage, {
      conversationId,
      role: "system",
      content:
        "AI is temporarily unavailable. A support agent will assist you shortly.",
    });

    // Trigger handoff to support staff
    await ctx.runMutation(api.conversations.mutations.triggerHandoff, {
      conversationId,
      reason: "AI generation failed after multiple attempts",
    });

    // Notify support agents
    const conversation = await ctx.runQuery(
      api.conversations.queries.getConversation,
      { conversationId }
    );

    if (conversation) {
      const supportAgents = await ctx.runQuery(
        api.users.queries.listTeamMembersByCompany,
        { companyId: conversation.companyId }
      );

      const agentWhopUserIds = supportAgents
        .filter(
          (agent: any) => agent.role === "support" || agent.role === "admin"
        )
        .map((agent: any) => agent.whopUserId);

      if (agentWhopUserIds.length > 0 && experienceId) {
        const customer = await ctx.runQuery(api.users.queries.getUserById, {
          userId: conversation.customerId,
        });

        await ctx.runAction(api.notifications.whop.notifySupportAgents, {
          agentWhopUserIds,
          title: "Customer needs assistance",
          content: `${customer?.displayName || "A customer"} is waiting for support (AI unavailable)`,
          experienceId,
          restPath: `/experiences/${experienceId}/dashboard/support?conversation=${conversationId}`,
        });
      }
    }

    throw lastError || new Error("AI generation failed");
  },
});
