"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";

interface CompanyContextTabProps {
  fullConfig: any; // Type from getFullCompanyConfig query
}

export function CompanyContextTab({ fullConfig }: CompanyContextTabProps) {
  const { userData } = useUser();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize content from fullConfig
  useEffect(() => {
    if (fullConfig?.companyContextOriginal) {
      setContent(fullConfig.companyContextOriginal);
      setSavedContent(fullConfig.companyContextOriginal);
    }
  }, [fullConfig?.companyContextOriginal]);

  // Update context action (calls the action that updates DB + Vector Store)
  const updateContext = useAction(api.workspace.actions.updateContextFromText);

  const hasChanges = content !== savedContent;

  const handleSave = async () => {
    if (!userData?.currentCompanyId) return;

    setIsSaving(true);
    try {
      await updateContext({
        companyId: userData.currentCompanyId as Id<"companies">,
        text: content,
        shouldCondense: false,
      });

      setSavedContent(content);
      toast.success("Company context updated");
    } catch (error) {
      console.error("Error saving context:", error);
      toast.error(
        `Failed to save context: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setContent(savedContent);
  };

  const wordCount = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length;
  };

  // Don't render if fullConfig is not loaded yet
  if (!fullConfig) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Textarea */}
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="resize-none font-sans text-sm"
          placeholder={`Describe your company, products, policies, FAQs...

Include:
• Products and services you offer
• Company policies and procedures
• Frequently asked questions
• Contact information and support hours`}
        />
        <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          {wordCount(content)} words
        </div>
      </div>

      {/* Actions - only show when there are changes */}
      {hasChanges && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} size="sm" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={handleDiscard} variant="ghost" size="sm" disabled={isSaving}>
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}
