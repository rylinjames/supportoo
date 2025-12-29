"use client";

import { useState, useEffect } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type TemplateCategory = "greeting" | "escalation" | "resolution" | "general";

interface Template {
  _id: Id<"templates">;
  title: string;
  content: string;
  category: TemplateCategory;
}

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    category: TemplateCategory;
  }) => void;
  template?: Template | null;
}

export function TemplateModal({
  open,
  onClose,
  onSave,
  template,
}: TemplateModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("general");

  // Load template data when editing
  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setContent(template.content);
      setCategory(template.category);
    } else {
      setTitle("");
      setContent("");
      setCategory("general");
    }
  }, [template, open]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;

    onSave({
      title: title.trim(),
      content: content.trim(),
      category,
    });

    onClose();
  };

  // Extract variables from content
  const extractVariables = (text: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(`{${match[1]}}`);
    }
    return [...new Set(matches)]; // Remove duplicates
  };

  const detectedVariables = extractVariables(content);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="text-body-sm max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-h3">
            {template ? "Edit Template" : "New Template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update your quick reply template"
              : "Create a new quick reply template"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-label">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Welcome Message"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-label">
              Category
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as TemplateCategory)}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="greeting">Greeting</SelectItem>
                <SelectItem value="escalation">Escalation</SelectItem>
                <SelectItem value="resolution">Resolution</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-label">
              Content
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Hi {firstName}! How can I help you today?"
            />
            <p className="text-muted-foreground">
              Use variables like {"{firstName}"}, {"{companyName}"}, etc.
            </p>
          </div>

          {/* Detected Variables */}
          {detectedVariables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-label">Detected Variables</Label>
              <div className="flex flex-wrap gap-1.5">
                {detectedVariables.map((variable, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs font-mono"
                  >
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
          >
            {template ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
