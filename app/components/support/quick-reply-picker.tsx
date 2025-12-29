"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export interface QuickReplyTemplate {
  id: string;
  title: string;
  content: string;
  category: "greeting" | "general" | "escalation" | "resolution";
}

interface QuickReplyPickerProps {
  onSelect: (content: string) => void;
  templates?: QuickReplyTemplate[];
  isLoading?: boolean;
}

export function QuickReplyPicker({
  onSelect,
  templates = [],
  isLoading = false,
}: QuickReplyPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Category filter
    if (activeTab !== "all") {
      filtered = filtered.filter((t) => t.category === activeTab);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.content.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, activeTab, templates]);

  const getCategoryBadgeColor = (category: QuickReplyTemplate["category"]) => {
    switch (category) {
      case "greeting":
        return "bg-primary/10 text-primary border-primary/20";
      case "escalation":
        return "bg-warning/10 text-warning border-warning/20";
      case "resolution":
        return "bg-success/10 text-success border-success/20";
      case "general":
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[400px] max-h-[500px]">
        {/* Search skeleton */}
        <div className="p-3 border-b border-border">
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Category tabs skeleton */}
        <div className="border-b border-border">
          <div className="flex items-center gap-0.5 px-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16" />
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] max-h-[500px]">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 pr-9 h-9"
            autoFocus={false}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-0.5 px-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-2 py-2 text-caption whitespace-nowrap transition-colors relative ${
              activeTab === "all"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
            {activeTab === "all" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("greeting")}
            className={`px-2 py-2 text-caption whitespace-nowrap transition-colors relative ${
              activeTab === "greeting"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Greeting
            {activeTab === "greeting" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className={`px-2 py-2 text-caption whitespace-nowrap transition-colors relative ${
              activeTab === "general"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            General
            {activeTab === "general" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("escalation")}
            className={`px-2 py-2 text-caption whitespace-nowrap transition-colors relative ${
              activeTab === "escalation"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Escalation
            {activeTab === "escalation" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("resolution")}
            className={`px-2 py-2 text-caption whitespace-nowrap transition-colors relative ${
              activeTab === "resolution"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Resolution
            {activeTab === "resolution" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2">
            {filteredTemplates.length > 0 ? (
              <div className="space-y-1">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template.content)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-label font-medium group-hover:text-primary transition-colors">
                        {template.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={`${getCategoryBadgeColor(template.category)} text-[10px] h-5 px-1.5 flex-shrink-0`}
                      >
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-body-sm text-muted-foreground line-clamp-2">
                      {template.content}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-label text-muted-foreground">
                  No templates found
                </p>
                <p className="text-caption text-muted-foreground">
                  Try a different search or category
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
