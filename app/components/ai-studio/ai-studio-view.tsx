"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PersonalitySection } from "@/app/components/ai-studio/personality-section";
import { SystemInstructionsSection } from "@/app/components/ai-studio/system-instructions-section";
import { HandoffTriggersSection } from "@/app/components/ai-studio/handoff-triggers-section";
import { TestAISection } from "@/app/components/ai-studio/test-ai-section";
import { CompanyContextTab } from "@/app/components/workspace/company-context-tab";
import { ProductsTab } from "@/app/components/workspace/products-tab";
import { useUser } from "@/app/contexts/user-context";
import { cn } from "@/lib/utils";

export interface AIConfig {
  personality: "professional" | "friendly" | "casual" | "technical";
  responseLength: "brief" | "medium" | "detailed";
  systemInstructions: string;
  handoffTriggers: {
    customerRequestsHuman: boolean;
    billingQuestions: boolean;
    negativeSentiment: boolean;
    multipleFailedAttempts: boolean;
  };
  customTriggers: string[];
}

const defaultConfig: AIConfig = {
  personality: "professional",
  responseLength: "medium",
  systemInstructions: "",
  handoffTriggers: {
    customerRequestsHuman: true,
    billingQuestions: true,
    negativeSentiment: false,
    multipleFailedAttempts: false,
  },
  customTriggers: [],
};

type TabType = "personality" | "context" | "handoff";

export function AIStudioView() {
  const { userData } = useUser();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<AIConfig>(defaultConfig);
  const [savedConfig, setSavedConfig] = useState<AIConfig>(defaultConfig);
  const [isSaving, setIsSaving] = useState(false);

  // Read tab from URL query params
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam === "context" ? "context" : tabParam === "handoff" ? "handoff" : "personality"
  );

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "context") setActiveTab("context");
    else if (tab === "handoff") setActiveTab("handoff");
    else setActiveTab("personality");
  }, [searchParams]);

  // Fetch full company config
  const fullConfig = useQuery(
    api.companies.queries.getFullCompanyConfig,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  // Mutation to update config
  const updateAiConfig = useMutation(api.companies.mutations.updateAiConfig);

  // Load config from backend
  useEffect(() => {
    if (fullConfig) {
      // Parse triggers array back into toggles + custom
      const customerRequestsHuman = fullConfig.aiHandoffTriggers.includes(
        "customer_requests_human"
      );
      const billingQuestions =
        fullConfig.aiHandoffTriggers.includes("billing_questions");
      const negativeSentiment =
        fullConfig.aiHandoffTriggers.includes("negative_sentiment");
      const multipleFailedAttempts = fullConfig.aiHandoffTriggers.includes(
        "multiple_failed_attempts"
      );

      const customTriggers = fullConfig.aiHandoffTriggers.filter(
        (t: any) =>
          ![
            "customer_requests_human",
            "billing_questions",
            "negative_sentiment",
            "multiple_failed_attempts",
          ].includes(t)
      );

      const loadedConfig: AIConfig = {
        personality: fullConfig.aiPersonality,
        responseLength: fullConfig.aiResponseLength,
        systemInstructions: fullConfig.aiSystemPrompt,
        handoffTriggers: {
          customerRequestsHuman,
          billingQuestions,
          negativeSentiment,
          multipleFailedAttempts,
        },
        customTriggers,
      };

      setConfig(loadedConfig);
      setSavedConfig(loadedConfig);
    }
  }, [fullConfig]);

  const hasUnsavedChanges =
    JSON.stringify(config) !== JSON.stringify(savedConfig);

  const handleSave = async () => {
    if (!userData?.currentCompanyId) return;

    setIsSaving(true);

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

      await updateAiConfig({
        companyId: userData.currentCompanyId as Id<"companies">,
        aiPersonality: config.personality,
        aiResponseLength: config.responseLength,
        aiSystemPrompt: config.systemInstructions,
        aiHandoffTriggers: triggers,
      });

      setSavedConfig(config);
      toast.success("AI configuration updated");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setConfig(savedConfig);
    toast.info("Changes discarded");
  };

  const isLoading = !fullConfig && userData?.currentCompanyId;

  // Tab configuration
  const tabs = [
    { id: "personality" as const, label: "Personality & Tone" },
    { id: "context" as const, label: "Company Context" },
    { id: "handoff" as const, label: "Handoff Triggers" },
  ];

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-h2 font-semibold text-foreground">
                AI Studio
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure how your AI assistant responds to customers
              </p>
            </div>
            {/* Only show save/discard on personality and handoff tabs */}
            {activeTab !== "context" && (
              <div className="flex items-center gap-2">
                {hasUnsavedChanges && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscard}
                    disabled={isSaving}
                  >
                    Discard
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || isSaving}
                  size="sm"
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-3 text-body-sm font-medium transition-colors relative",
                "hover:text-foreground",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {/* Personality & Tone Tab */}
            {activeTab === "personality" && (
              <div className="space-y-12">
                <PersonalitySection
                  personality={config.personality}
                  responseLength={config.responseLength}
                  onPersonalityChange={(personality) =>
                    setConfig({ ...config, personality })
                  }
                  onResponseLengthChange={(responseLength) =>
                    setConfig({ ...config, responseLength })
                  }
                />

                <SystemInstructionsSection
                  value={config.systemInstructions}
                  onChange={(systemInstructions) =>
                    setConfig({ ...config, systemInstructions })
                  }
                />

                <TestAISection
                  config={config}
                  companyContext={fullConfig?.companyContextProcessed || ""}
                  selectedAiModel={fullConfig?.selectedAiModel || "gpt-4o-mini"}
                />
              </div>
            )}

            {/* Company Context Tab */}
            {activeTab === "context" && (
              <div className="space-y-12">
                <CompanyContextTab fullConfig={fullConfig} />

                {/* Products Section */}
                {userData?.currentCompanyId && (
                  <ProductsTab companyId={userData.currentCompanyId as Id<"companies">} />
                )}
              </div>
            )}

            {/* Handoff Triggers Tab */}
            {activeTab === "handoff" && (
              <div className="space-y-12">
                <HandoffTriggersSection
                  triggers={config.handoffTriggers}
                  customTriggers={config.customTriggers}
                  onTriggersChange={(handoffTriggers) =>
                    setConfig({ ...config, handoffTriggers })
                  }
                  onCustomTriggersChange={(customTriggers) =>
                    setConfig({ ...config, customTriggers })
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
