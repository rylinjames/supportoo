"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, X, User, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface QuickReplyTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
  isPersonal?: boolean;
}

interface EnhancedQuickReplyPickerProps {
  onSelect: (content: string) => void;
  templates?: QuickReplyTemplate[];
  isLoading?: boolean;
}

export function EnhancedQuickReplyPicker({
  onSelect,
  templates = [],
  isLoading = false,
}: EnhancedQuickReplyPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "personal" | "workspace">("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Fetch personal agent phrases
  const agentPhrases = useQuery(api.agentPhrases.getMyPhrases) ?? [];

  // Convert agent phrases to template format
  const personalTemplates: QuickReplyTemplate[] = agentPhrases.map((phrase) => ({
    id: phrase._id,
    title: phrase.title,
    content: phrase.content,
    category: phrase.category,
    isPersonal: true,
  }));

  // Combine all templates based on active tab
  const combinedTemplates = useMemo(() => {
    let allTemplates: QuickReplyTemplate[] = [];
    
    if (activeTab === "all") {
      allTemplates = [...templates, ...personalTemplates];
    } else if (activeTab === "personal") {
      allTemplates = personalTemplates;
    } else if (activeTab === "workspace") {
      allTemplates = templates;
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allTemplates = allTemplates.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.content.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (activeCategory !== "all") {
      allTemplates = allTemplates.filter((t) => t.category === activeCategory);
    }

    return allTemplates;
  }, [searchQuery, activeTab, activeCategory, templates, personalTemplates]);

  // Get all unique categories
  const categories = useMemo(() => {
    const allTemplates = [...templates, ...personalTemplates];
    const categorySet = new Set(allTemplates.map((t) => t.category));
    return ["all", ...Array.from(categorySet)];
  }, [templates, personalTemplates]);

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "greeting":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "solution":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "followup":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "closing":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "escalation":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "resolution":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[450px] max-h-[500px]">
        <div className="p-3 border-b border-border">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 mb-2" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[450px] max-h-[500px]">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 pr-9 h-9"
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

      {/* Tabs for Personal/Workspace */}
      <div className="border-b border-border">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full justify-start rounded-none h-10 p-0 bg-transparent">
            <TabsTrigger value="all" className="data-[state=active]:shadow-none">
              All
            </TabsTrigger>
            <TabsTrigger value="personal" className="data-[state=active]:shadow-none">
              <User className="h-3 w-3 mr-1.5" />
              My Phrases ({personalTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="workspace" className="data-[state=active]:shadow-none">
              <Building2 className="h-3 w-3 mr-1.5" />
              Workspace ({templates.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Category Filter */}
      <div className="border-b border-border">
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize ${
                activeCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2">
            {combinedTemplates.length > 0 ? (
              <div className="space-y-1">
                {combinedTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template.content)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors group border border-transparent hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {template.isPersonal && (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                        <h4 className="text-sm font-medium group-hover:text-primary transition-colors">
                          {template.title}
                        </h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${getCategoryBadgeColor(template.category)} text-[10px] h-5 px-1.5 flex-shrink-0`}
                      >
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.content}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No templates found</p>
                <p className="text-xs text-muted-foreground">
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