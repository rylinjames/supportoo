"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PersonalitySectionProps {
  personality: "professional" | "friendly" | "casual" | "technical";
  responseLength: "brief" | "medium" | "detailed";
  onPersonalityChange: (
    value: "professional" | "friendly" | "casual" | "technical"
  ) => void;
  onResponseLengthChange: (value: "brief" | "medium" | "detailed") => void;
}

const personalityExamples = {
  professional:
    "Thank you for contacting us. I'd be happy to assist you with that.",
  friendly: "Hey there! I'd love to help you with that.",
  casual: "Hey! Let's get that sorted for you.",
  technical:
    "I can help diagnose this issue. Could you provide additional details?",
};

export function PersonalitySection({
  personality,
  responseLength,
  onPersonalityChange,
  onResponseLengthChange,
}: PersonalitySectionProps) {
  return (
    <div>
      {/* Content */}
      <div className="space-y-6">
        {/* Personality Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="personality" className="text-label text-foreground">
            Personality
          </Label>
          <Select value={personality} onValueChange={onPersonalityChange}>
            <SelectTrigger id="personality" className="w-full max-w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground mt-2">
            Example: &quot;{personalityExamples[personality]}&quot;
          </p>
        </div>

        {/* Response Length Radio */}
        <div className="space-y-3">
          <Label className="text-label text-foreground">Response Length</Label>
          <RadioGroup
            value={responseLength}
            onValueChange={onResponseLengthChange}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="brief" id="brief" />
              <Label
                htmlFor="brief"
                className="text-foreground font-normal cursor-pointer"
              >
                Brief
              </Label>
              <span className="text-muted-foreground">
                — Short, concise answers
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="medium" id="medium" />
              <Label
                htmlFor="medium"
                className=" text-foreground font-normal cursor-pointer"
              >
                Medium
              </Label>
              <span className="text-muted-foreground">— Balanced detail</span>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="detailed" id="detailed" />
              <Label
                htmlFor="detailed"
                className=" text-foreground font-normal cursor-pointer"
              >
                Detailed
              </Label>
              <span className="text-muted-foreground">
                — Comprehensive explanations
              </span>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
