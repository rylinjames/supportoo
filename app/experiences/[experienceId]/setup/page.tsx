"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Sparkles, Building2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PERSONALITIES = [
  { value: "professional" as const, label: "Professional", desc: "Formal and business-like" },
  { value: "friendly" as const, label: "Friendly", desc: "Warm and approachable" },
  { value: "casual" as const, label: "Casual", desc: "Relaxed and conversational" },
  { value: "technical" as const, label: "Technical", desc: "Detailed and precise" },
];

const DEFAULT_TRIGGERS = [
  "customer_requests_human",
  "billing_questions",
];

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [companyContext, setCompanyContext] = useState("");
  const [personality, setPersonality] = useState<"professional" | "friendly" | "casual" | "technical">("friendly");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { userData } = useUser();
  const { experienceId } = useParams() as { experienceId: string };
  const router = useRouter();
  const completeOnboarding = useMutation(api.companies.mutations.completeOnboarding);

  const companyId = userData?.currentCompanyId;

  const handleComplete = async () => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        companyId: companyId as Id<"companies">,
        companyContextOriginal: companyContext,
        companyContextProcessed: companyContext,
        aiPersonality: personality,
        aiResponseLength: "medium",
        aiSystemPrompt: "",
        aiHandoffTriggers: DEFAULT_TRIGGERS,
      });
      router.push(`/experiences/${experienceId}`);
    } catch (e) {
      console.error("Failed to complete setup:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    {
      title: "Tell us about your business",
      icon: Building2,
      content: (
        <div className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            Describe your business, products, and services. This helps the AI answer customer questions accurately.
          </p>
          <textarea
            value={companyContext}
            onChange={(e) => setCompanyContext(e.target.value)}
            placeholder="e.g. We sell online courses about trading. Our main product is a monthly subscription that includes daily signals, a private Discord, and weekly coaching calls..."
            className="w-full min-h-[180px] p-4 rounded-lg border border-border bg-background text-body-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
          />
          <p className="text-caption text-muted-foreground">
            You can always update this later in Company Context.
          </p>
        </div>
      ),
    },
    {
      title: "Choose your AI's personality",
      icon: Sparkles,
      content: (
        <div className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            How should your support bot talk to customers?
          </p>
          <div className="grid gap-3">
            {PERSONALITIES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPersonality(p.value)}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                  personality === p.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  personality === p.value ? "border-primary" : "border-muted-foreground"
                }`}>
                  {personality === p.value && <Check className="h-3 w-3 text-primary" />}
                </div>
                <div>
                  <span className="text-body-sm font-medium block">{p.label}</span>
                  <span className="text-caption text-muted-foreground">{p.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const isLastStep = step === steps.length - 1;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-[560px] p-8">
        <div className="flex items-center gap-2 mb-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">{currentStep.title}</h1>
        </div>

        {currentStep.content}

        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => step > 0 ? setStep(step - 1) : router.push(`/experiences/${experienceId}`)}
          >
            {step > 0 ? "Back" : "Skip setup"}
          </Button>
          {isLastStep ? (
            <Button onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? "Setting up..." : "Finish setup"}
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
