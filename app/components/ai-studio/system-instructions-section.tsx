"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SystemInstructionsSectionProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_CHARS = 2000;

export function SystemInstructionsSection({
  value,
  onChange,
}: SystemInstructionsSectionProps) {
  const charCount = value.length;
  const isNearLimit = charCount > MAX_CHARS * 0.8;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-h3 font-semibold text-foreground">
          System Instructions
        </h2>
        <p className="text-muted-foreground mt-1">
          Core guidelines for how the AI should behave. These instructions are
          applied to every conversation.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="instructions" className="text-label text-foreground">
          Instructions
        </Label>
        <Textarea
          id="instructions"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="resize-none font-mono text-xs"
          placeholder={`Example:
• Always be polite and patient
• Check company context before answering
• Never make promises about refunds without human approval
• Escalate billing issues immediately`}
        />
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Keep instructions clear and concise
          </p>
          <p
            className={` ${
              isOverLimit
                ? "text-red-600 dark:text-red-400"
                : isNearLimit
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-muted-foreground"
            }`}
          >
            {charCount} / {MAX_CHARS}
          </p>
        </div>
      </div>
    </div>
  );
}
