"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Trash2 } from "lucide-react";
import { AIConfig } from "./ai-studio-view";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";
import type { Id } from "@/convex/_generated/dataModel";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

interface TestAISectionProps {
  config: AIConfig;
  companyContext: string;
  selectedAiModel: string;
}

const quickTests = [
  "How does this work?",
  "I need help with billing",
  "I want to speak to a human",
];

export function TestAISection({
  config,
  companyContext,
  selectedAiModel,
}: TestAISectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const { userData } = useUser();

  const testAI = useAction(api.ai.testAI.testAIResponse);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!userData?.currentCompanyId) {
      toast.error("Company ID not found");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);

    try {
      // Convert handoff toggles + custom triggers to array
      const triggers: string[] = [];
      if (config.handoffTriggers.customerRequestsHuman)
        triggers.push("customer_requests_human");
      if (config.handoffTriggers.billingQuestions)
        triggers.push("billing_questions");
      if (config.handoffTriggers.negativeSentiment)
        triggers.push("negative_sentiment");
      if (config.handoffTriggers.multipleFailedAttempts)
        triggers.push("multiple_failed_attempts");
      triggers.push(...config.customTriggers);

      const response = await testAI({
        testMessage: input,
        aiConfig: {
          aiPersonality: config.personality,
          aiResponseLength: config.responseLength,
          aiSystemPrompt: config.systemInstructions,
          aiHandoffTriggers: triggers,
          companyContext,
          selectedAiModel,
        },
        companyId: userData.currentCompanyId as Id<"companies">,
        conversationHistory: messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.response || "No response generated",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);

      if (response.handoff) {
        toast.info(`AI would hand off: ${response.handoffReason}`);
      }
    } catch (error) {
      console.error("Error testing AI:", error);
      toast.error("Failed to test AI response");
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsThinking(false);
    }
  };

  const handleQuickTest = (question: string) => {
    setInput(question);
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-h3 font-semibold text-foreground">Test AI</h2>
          <Badge variant="secondary" className="text-primary">
            TEST MODE
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          Try out your AI configuration before it goes live
        </p>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Quick Test Buttons */}
        <div className="flex flex-wrap gap-2">
          {quickTests.map((question) => (
            <Button
              key={question}
              variant="outline"
              size="sm"
              onClick={() => handleQuickTest(question)}
            >
              {question}
            </Button>
          ))}
        </div>

        {/* Chat Interface */}
        <div className="bg-secondary rounded-lg border border-border">
          {/* Messages */}
          <div className="h-[400px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Start a test conversation to see how your AI responds
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground border border-border"
                    }`}
                  >
                    <p className="">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            {isThinking && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-3 py-2 bg-card text-foreground border border-border">
                  <p className="text-muted-foreground">AI is thinking...</p>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type test message..."
              className="flex-1"
              disabled={isThinking}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
            {messages.length > 0 && (
              <Button onClick={handleClear} variant="ghost" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
