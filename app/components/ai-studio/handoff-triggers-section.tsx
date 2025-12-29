"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { AIConfig } from "./ai-studio-view";

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
    description: 'Phrases: "speak to a human", "real person", "agent"',
  },
  {
    id: "billingQuestions" as const,
    label: "Billing & payment questions",
    description: "Auto-escalates billing-related conversations",
  },
  {
    id: "negativeSentiment" as const,
    label: "Negative sentiment detected",
    description: "When customer expresses frustration or anger",
  },
  {
    id: "multipleFailedAttempts" as const,
    label: "Multiple failed attempts",
    description: "AI couldn't help after 3+ responses",
  },
];

export function HandoffTriggersSection({
  triggers,
  customTriggers,
  onTriggersChange,
  onCustomTriggersChange,
}: HandoffTriggersSectionProps) {
  const [newTrigger, setNewTrigger] = useState("");

  const handleAddTrigger = () => {
    if (newTrigger.trim() && !customTriggers.includes(newTrigger.trim())) {
      onCustomTriggersChange([...customTriggers, newTrigger.trim()]);
      setNewTrigger("");
    }
  };

  const handleRemoveTrigger = (trigger: string) => {
    onCustomTriggersChange(customTriggers.filter((t) => t !== trigger));
  };

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-h3 font-semibold text-foreground">
          Handoff Triggers
        </h2>
        <p className="text-muted-foreground mt-1">
          When should the AI hand off to human support?
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Common Triggers */}
        <div className="space-y-4">
          {commonTriggers.map((trigger) => (
            <div
              key={trigger.id}
              className="flex items-start justify-between gap-4 py-2"
            >
              <div className="flex-1">
                <p className="text-foreground">{trigger.label}</p>
                <p className="text-muted-foreground mt-0.5">
                  {trigger.description}
                </p>
              </div>
              <Switch
                checked={triggers[trigger.id]}
                onCheckedChange={(checked) =>
                  onTriggersChange({ ...triggers, [trigger.id]: checked })
                }
              />
            </div>
          ))}
        </div>

        {/* Custom Triggers */}
        <div className="space-y-3">
          <Label className="text-label text-foreground">Custom Triggers</Label>

          {/* Add New Trigger */}
          <div className="flex items-center gap-2">
            <Input
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTrigger();
                }
              }}
              placeholder="Enter custom trigger phrase..."
              className="flex-1"
            />
            <Button
              onClick={handleAddTrigger}
              disabled={!newTrigger.trim()}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Custom Triggers List */}
          {customTriggers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {customTriggers.map((trigger) => (
                <div
                  key={trigger}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-foreground rounded-md"
                >
                  <span>{trigger}</span>
                  <button
                    onClick={() => handleRemoveTrigger(trigger)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
