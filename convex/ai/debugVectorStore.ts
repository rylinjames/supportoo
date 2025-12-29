"use node";

/**
 * DEBUG UTILITIES for Vector Store File Search
 *
 * These actions help diagnose issues with file_search by:
 * - Inspecting what's actually in the Vector Store
 * - Testing direct searches
 * - Verifying file indexing status
 */

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Inspect Vector Store contents and configuration
 */
export const inspectVectorStore: ReturnType<typeof action> = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
      companyId,
    });

    if (!company) {
      return { error: "Company not found" };
    }

    console.log("=== VECTOR STORE INSPECTION ===");
    console.log("Company:", company.name);
    console.log("Vector Store ID:", company.openaiVectorStoreId);
    console.log("Context File ID:", company.openaiContextFileId);
    console.log("Assistant ID:", company.openaiAssistantId);

    // 1. Check if vector store exists
    if (!company.openaiVectorStoreId) {
      return {
        error: "No vector store ID found",
        recommendation: "Run createOrUpdateAssistant to create vector store",
      };
    }

    try {
      // 2. Get vector store details
      const vectorStore = await openai.vectorStores.retrieve(
        company.openaiVectorStoreId
      );

      console.log("Vector Store Status:", vectorStore.status);
      console.log("Vector Store File Counts:", vectorStore.file_counts);
      console.log(
        "Vector Store Created:",
        new Date(vectorStore.created_at * 1000)
      );

      // 3. List files in vector store
      const files = await openai.vectorStores.files.list(
        company.openaiVectorStoreId
      );

      console.log("Files in Vector Store:", files.data.length);

      for (const file of files.data) {
        console.log("  File ID:", file.id);
        console.log("  Status:", file.status);
        console.log("  Created:", new Date(file.created_at * 1000));

        // Get file details
        try {
          const fileDetails = await openai.files.retrieve(file.id);
          console.log("  Filename:", fileDetails.filename);
          console.log("  Size:", fileDetails.bytes, "bytes");
          console.log("  Purpose:", fileDetails.purpose);
        } catch (err) {
          console.log("  Could not retrieve file details:", err);
        }
      }

      // 4. Check assistant configuration
      if (company.openaiAssistantId) {
        const assistant = await openai.beta.assistants.retrieve(
          company.openaiAssistantId
        );

        console.log("Assistant Tools:", assistant.tools);
        console.log(
          "Assistant Tool Resources:",
          JSON.stringify(assistant.tool_resources, null, 2)
        );
      }

      // 5. Get actual context content from database
      console.log("=== COMPANY CONTEXT FROM DB ===");
      console.log(
        "Context Length:",
        company.companyContextProcessed?.length || 0
      );
      console.log(
        "Context Preview:",
        company.companyContextProcessed?.substring(0, 200)
      );

      return {
        success: true,
        vectorStore: {
          id: vectorStore.id,
          status: vectorStore.status,
          fileCounts: vectorStore.file_counts,
        },
        files: files.data.map((f) => ({
          id: f.id,
          status: f.status,
        })),
        contextLength: company.companyContextProcessed?.length || 0,
      };
    } catch (error) {
      console.error("Error inspecting vector store:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Test Vector Store search directly with a test assistant
 */
export const testVectorStoreSearch: ReturnType<typeof action> = action({
  args: {
    companyId: v.id("companies"),
    query: v.string(),
  },
  handler: async (ctx, { companyId, query }) => {
    const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
      companyId,
    });

    if (!company?.openaiVectorStoreId) {
      return { error: "No vector store found" };
    }

    console.log("=== TESTING VECTOR STORE SEARCH ===");
    console.log("Query:", query);
    console.log("Vector Store ID:", company.openaiVectorStoreId);

    // Create a test thread with the vector store attached
    try {
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: query,
          },
        ],
      });

      // Create a test assistant with ONLY file_search
      const testAssistant = await openai.beta.assistants.create({
        name: "Debug File Search Test",
        model: "gpt-4o-mini",
        instructions:
          "Search the knowledge base and return what you find. Be explicit about what you found.",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [company.openaiVectorStoreId],
          },
        },
      });

      // Run and wait for completion
      const run = await openai.beta.threads.runs.createAndPoll(
        thread.id,
        {
          assistant_id: testAssistant.id,
        },
        {
          pollIntervalMs: 1000,
        }
      );

      console.log("Run Status:", run.status);

      // Get the response
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data.find((m) => m.role === "assistant");

      // Get run steps to see if file_search was used
      const runSteps = await openai.beta.threads.runs.steps.list(
        thread.id,
        run.id
      );

      console.log(
        "Run Steps:",
        runSteps.data.map((s) => {
          const stepDetails = s.step_details as {
            tool_calls?: Array<{ type?: string }>;
          };
          return {
            type: s.type,
            toolCalls: s.type === "tool_calls" ? stepDetails.tool_calls : null,
          };
        })
      );

      // Clean up test assistant
      await openai.beta.assistants.del(testAssistant.id);

      return {
        success: true,
        runStatus: run.status,
        response:
          response?.content[0]?.type === "text"
            ? response.content[0].text.value
            : null,
        fileSearchUsed: runSteps.data.some((s) => {
          if (s.type === "tool_calls") {
            const stepDetails = s.step_details as {
              tool_calls?: Array<{ type?: string }>;
            };
            return stepDetails.tool_calls?.some(
              (tc: any) => tc.type === "file_search"
            );
          }
          return false;
        }),
      };
    } catch (error) {
      console.error("Error testing vector store search:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
