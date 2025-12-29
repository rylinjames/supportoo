"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";

interface CompanyContextTabProps {
  fullConfig: any; // Type from getFullCompanyConfig query
}

export function CompanyContextTab({ fullConfig }: CompanyContextTabProps) {
  const { userData } = useUser();
  const [updateMode, setUpdateMode] = useState<"text" | "edit">("text");
  const [newContent, setNewContent] = useState("");

  // fullConfig is now passed as a prop

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

    const contentToSave = newContent; // Always use newContent now

    try {
      await updateContext({
        companyId: userData.currentCompanyId as Id<"companies">,
        text: contentToSave,
        shouldCondense: false, // No condensing for now
      });

      toast.success("Company context updated");
      // Reset state
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
    <div className="space-y-12">
      {/* Current Context */}
      {fullConfig.companyContextOriginal && (
        <div>
          <div className="mb-6">
            <h2 className="text-h3 text-foreground">Current Context</h2>
            <p className="text-muted-foreground mt-1">
              This information helps the AI understand your business
            </p>
          </div>

          <div className="space-y-3">
            {/* Metadata */}
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>
                Last updated: {formatDate(fullConfig.companyContextLastUpdated)}
              </span>
              <span>•</span>
              <span>{wordCount(fullConfig.companyContextOriginal)} words</span>
            </div>

            {/* Content Display */}
            <div className="bg-secondary rounded-md border border-border p-4">
              <pre className="text-foreground whitespace-pre-wrap font-sans">
                {fullConfig.companyContextOriginal}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Update Context */}
      <div>
        <div className="mb-6">
          <h2 className="text-h3 text-foreground">Update Context</h2>
          <p className="text-muted-foreground mt-1">
            Enter or edit text with company information
          </p>
        </div>

        <div className="space-y-6">
          {/* Mode Selection */}
          <RadioGroup
            value={updateMode}
            onValueChange={(v) => setUpdateMode(v as "text" | "edit")}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="text" id="text-mode" />
              <Label
                htmlFor="text-mode"
                className="text-label text-foreground font-normal cursor-pointer"
              >
                Enter Text
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="edit" id="edit-mode" />
              <Label
                htmlFor="edit-mode"
                className="text-label text-foreground font-normal cursor-pointer"
              >
                Edit Text
              </Label>
            </div>
          </RadioGroup>

          {/* Text Entry */}
          {updateMode === "text" && (
            <div className="space-y-2">
              <Label htmlFor="content" className="text-label text-foreground">
                Company Information
              </Label>
              <Textarea
                id="content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={10}
                className="font-mono"
                placeholder={`Enter information about your company...

Include:
• Products and services
• Company policies
• FAQs
• Contact information`}
              />
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                  Include information about your products, services, policies,
                  FAQs, etc.
                </p>
                <p className="text-muted-foreground">
                  {wordCount(newContent)} words
                </p>
              </div>
            </div>
          )}

          {/* Edit Existing Text */}
          {updateMode === "edit" && fullConfig.companyContextOriginal && (
            <div className="space-y-2">
              <Label
                htmlFor="edit-content"
                className="text-label text-foreground"
              >
                Edit Company Information
              </Label>
              <Textarea
                id="edit-content"
                value={newContent || fullConfig.companyContextOriginal}
                onChange={(e) => setNewContent(e.target.value)}
                rows={10}
                className="font-mono"
              />
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                  Edit and update your existing company context
                </p>
                <p className="text-muted-foreground">
                  {wordCount(newContent || fullConfig.companyContextOriginal)}{" "}
                  words
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          {((updateMode === "text" && newContent) ||
            (updateMode === "edit" &&
              newContent &&
              newContent !== fullConfig.companyContextOriginal)) && (
            <div className="flex items-center gap-2">
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
    </div>
  );
}
