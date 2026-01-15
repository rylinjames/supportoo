"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";
import { Pencil, FileText } from "lucide-react";

interface CompanyContextTabProps {
  fullConfig: any; // Type from getFullCompanyConfig query
}

export function CompanyContextTab({ fullConfig }: CompanyContextTabProps) {
  const { userData } = useUser();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
      setIsEditing(false);
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
    setIsEditing(false);
  };

  const wordCount = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length;
  };

  // Don't render if fullConfig is not loaded yet
  if (!fullConfig) {
    return null;
  }

  // Preview mode - collapsed view
  if (!isEditing && savedContent) {
    return (
      <div className="space-y-3">
        <div
          className="relative rounded-lg border border-border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {/* Preview content with fade */}
          <div className="relative max-h-[120px] overflow-hidden">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {savedContent}
            </pre>
            {/* Fade overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
          </div>
          {/* Edit hint */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {wordCount(savedContent)} words
            </span>
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <Pencil className="h-3 w-3" />
              Click to edit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no content yet
  if (!savedContent && !isEditing) {
    return (
      <div
        className="rounded-lg border border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setIsEditing(true)}
      >
        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-2">No company context added yet</p>
        <Button variant="outline" size="sm">
          Add Context
        </Button>
      </div>
    );
  }

  // Editing mode - full textarea
  return (
    <div className="space-y-4">
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
          autoFocus
        />
        <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          {wordCount(content)} words
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} size="sm" disabled={isSaving || !content.trim()}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button onClick={handleDiscard} variant="ghost" size="sm" disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
