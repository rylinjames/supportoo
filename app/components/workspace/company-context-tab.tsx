"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";
import { FileText, Plus, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyContextTabProps {
  fullConfig: any; // Type from getFullCompanyConfig query
}

export function CompanyContextTab({ fullConfig }: CompanyContextTabProps) {
  const { userData } = useUser();
  const [updateMode, setUpdateMode] = useState<"text" | "edit">("text");
  const [newContent, setNewContent] = useState("");

  // Initialize with existing content when switching to edit mode
  useEffect(() => {
    if (updateMode === "edit" && fullConfig?.companyContextOriginal) {
      setNewContent(fullConfig.companyContextOriginal);
    } else if (updateMode !== "edit") {
      setNewContent("");
    }
  }, [updateMode, fullConfig?.companyContextOriginal]);

  // Update context action (calls the action that updates DB + Vector Store)
  const updateContext = useAction(api.workspace.actions.updateContextFromText);

  const handleSave = async () => {
    if (!userData?.currentCompanyId) return;

    const contentToSave = newContent;

    try {
      await updateContext({
        companyId: userData.currentCompanyId as Id<"companies">,
        text: contentToSave,
        shouldCondense: false,
      });

      toast.success("Company context updated");
      setNewContent("");
    } catch (error) {
      console.error("Error saving context:", error);
      toast.error(
        `Failed to save context: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleCancel = () => {
    setNewContent("");
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const wordCount = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length;
  };

  // Don't render if fullConfig is not loaded yet
  if (!fullConfig) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Current Context Display */}
      {fullConfig.companyContextOriginal && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-secondary/50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Stored Context</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{wordCount(fullConfig.companyContextOriginal)} words</span>
              <span>•</span>
              <span>Updated {formatDate(fullConfig.companyContextLastUpdated)}</span>
            </div>
          </div>
          {/* Content */}
          <div className="p-4 max-h-[300px] overflow-y-auto">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {fullConfig.companyContextOriginal}
            </pre>
          </div>
        </div>
      )}

      {/* Update Context Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Update Context</h2>
          <p className="text-sm text-muted-foreground">
            Enter or edit text with company information
          </p>
        </div>

        {/* Segmented Control */}
        <div className="inline-flex p-1 rounded-lg bg-secondary">
          <button
            onClick={() => setUpdateMode("text")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              updateMode === "text"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Plus className="h-4 w-4" />
            New Context
          </button>
          <button
            onClick={() => setUpdateMode("edit")}
            disabled={!fullConfig.companyContextOriginal}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              updateMode === "edit"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              !fullConfig.companyContextOriginal && "opacity-50 cursor-not-allowed"
            )}
          >
            <Edit3 className="h-4 w-4" />
            Edit Existing
          </button>
        </div>

        {/* Textarea with word count */}
        <div className="space-y-2">
          <Label htmlFor="content" className="text-sm font-medium text-foreground">
            {updateMode === "text" ? "Company Information" : "Edit Company Information"}
          </Label>
          <div className="relative">
            <Textarea
              id="content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={12}
              className="resize-none font-sans text-sm"
              placeholder={`Describe your company, products, policies, FAQs...

Include:
• Products and services you offer
• Company policies and procedures
• Frequently asked questions
• Contact information and support hours`}
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {wordCount(newContent)} words
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Include information about your products, services, policies, FAQs, etc.
          </p>
        </div>

        {/* Actions */}
        {((updateMode === "text" && newContent) ||
          (updateMode === "edit" &&
            newContent &&
            newContent !== fullConfig.companyContextOriginal)) && (
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} size="sm">
              Save Context
            </Button>
            <Button onClick={handleCancel} variant="ghost" size="sm">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
