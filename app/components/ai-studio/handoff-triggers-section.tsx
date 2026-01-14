"use client";

import { Switch } from "@/components/ui/switch";
import { AIConfig } from "./ai-studio-view";
import { MessageSquare, CreditCard } from "lucide-react";

interface HandoffTriggersSectionProps {
  triggers: AIConfig["handoffTriggers"];
  customTriggers: string[];
  onTriggersChange: (triggers: AIConfig["handoffTriggers"]) => void;
  onCustomTriggersChange: (triggers: string[]) => void;
}

const commonTriggers = [
  {
    id: "customerRequestsHuman" as const,
    label: "Customer requests human help",
    description: 'When customers ask to speak with a human, real person, or agent',
    icon: MessageSquare,
  },
  {
    id: "billingQuestions" as const,
    label: "Billing & payment questions",
    description: "Auto-escalates billing, refund, and payment-related conversations",
    icon: CreditCard,
  },
];

export function HandoffTriggersSection({
  triggers,
  onTriggersChange,
}: HandoffTriggersSectionProps) {
  return (
    <div>
      {/* Triggers */}
      <div className="space-y-3">
        {commonTriggers.map((trigger) => {
          const Icon = trigger.icon;
          return (
            <div
              key={trigger.id}
              className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{trigger.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {trigger.description}
                  </p>
                </div>
              </div>
              <Switch
                checked={triggers[trigger.id]}
                onCheckedChange={(checked) =>
                  onTriggersChange({ ...triggers, [trigger.id]: checked })
                }
              />
            </div>
          );
        })}
      </div>

      {/* Info Note */}
      <div className="mt-6 p-4 rounded-lg bg-secondary/50 border border-border">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> When a handoff is triggered,
          customers will be notified that a human agent will assist them shortly.
          The conversation will appear in your support queue.
        </p>
      </div>
    </div>
  );
}
