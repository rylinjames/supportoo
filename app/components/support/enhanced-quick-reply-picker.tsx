"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, X, User, Building2, Settings, Plus, Edit2, Trash2, MessageSquare, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export interface QuickReplyTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
  isPersonal?: boolean;
}

type PhraseCategory = "greeting" | "solution" | "followup" | "closing" | "general";

interface AgentPhrase {
  _id: Id<"agentPhrases">;
  title: string;
  content: string;
  category: PhraseCategory;
  isActive: boolean;
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
  // Unified filter: "all", "personal", "shared", or a category name
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Phrase management state
  const [showManageView, setShowManageView] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState<AgentPhrase | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general" as PhraseCategory,
  });

  // Phrase mutations
  const createPhrase = useMutation(api.agentPhrases.create);
  const updatePhrase = useMutation(api.agentPhrases.update);
  const deletePhrase = useMutation(api.agentPhrases.remove);

  // Fetch personal agent phrases
  const agentPhrases = useQuery(api.agentPhrases.getMyPhrases) ?? [];

  // Convert agent phrases to template format
  const personalTemplates: QuickReplyTemplate[] = agentPhrases.map((phrase: any) => ({
    id: phrase._id,
    title: phrase.title,
    content: phrase.content,
    category: phrase.category,
    isPersonal: true,
  }));

  // Combine and filter templates based on unified filter
  const combinedTemplates = useMemo(() => {
    let allTemplates: QuickReplyTemplate[] = [...templates, ...personalTemplates];

    // Apply search filter first
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allTemplates = allTemplates.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.content.toLowerCase().includes(query)
      );
    }

    // Apply unified filter
    if (activeFilter === "all") {
      // Show all templates from all sources
      return allTemplates;
    } else if (activeFilter === "personal") {
      // Show only personal phrases (all categories)
      return allTemplates.filter((t) => t.isPersonal === true);
    } else if (activeFilter === "shared") {
      // Show only workspace templates (all categories)
      return allTemplates.filter((t) => !t.isPersonal);
    } else {
      // Filter by category (all sources)
      return allTemplates.filter((t) => t.category === activeFilter);
    }
  }, [searchQuery, activeFilter, templates, personalTemplates]);

  // Build unified filter options: sources first, then categories
  const filterOptions = useMemo(() => {
    const allTemplates = [...templates, ...personalTemplates];
    const categorySet = new Set(allTemplates.map((t) => t.category));
    const categories = Array.from(categorySet);

    // Source filters first, then category filters
    return [
      { id: "all", label: "All" },
      { id: "personal", label: "My Phrases" },
      { id: "shared", label: "Shared" },
      ...categories.map((cat) => ({ id: cat, label: cat })),
    ];
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

  // Phrase management handlers
  const handleSubmitPhrase = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPhrase?._id) {
        await updatePhrase({
          phraseId: editingPhrase._id,
          ...formData,
        });
        toast.success("Phrase updated");
      } else {
        await createPhrase(formData);
        toast.success("Phrase created");
      }

      setEditingPhrase(null);
      setFormData({ title: "", content: "", category: "general" });
    } catch (error) {
      toast.error("Failed to save phrase");
    }
  };

  const handleEditPhrase = (phrase: AgentPhrase) => {
    setEditingPhrase(phrase);
    setFormData({
      title: phrase.title,
      content: phrase.content,
      category: phrase.category,
    });
  };

  const handleDeletePhrase = async (phraseId: Id<"agentPhrases">) => {
    if (confirm("Delete this phrase?")) {
      try {
        await deletePhrase({ phraseId });
        toast.success("Phrase deleted");
      } catch (error) {
        toast.error("Failed to delete phrase");
      }
    }
  };

  const groupedPhrases = agentPhrases.reduce((acc: Record<string, AgentPhrase[]>, phrase: any) => {
    if (!acc[phrase.category]) {
      acc[phrase.category] = [];
    }
    acc[phrase.category].push(phrase);
    return acc;
  }, {} as Record<string, AgentPhrase[]>);

  if (isLoading) {
    return (
      <div className="flex flex-col h-[450px] max-h-[500px]">
        <div className="p-3 border-b border-border">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="border-b border-border">
          <div className="flex items-center gap-1 px-3 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16" />
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

  // Manage Phrases View
  if (showManageView) {
    return (
      <div className="flex flex-col h-[450px] max-h-[500px]">
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setShowManageView(false);
                setEditingPhrase(null);
                setFormData({ title: "", content: "", category: "general" });
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-medium text-sm">
              {editingPhrase ? (editingPhrase._id ? "Edit Phrase" : "New Phrase") : "My Phrases"}
            </h3>
          </div>
          {!editingPhrase && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingPhrase({} as AgentPhrase);
                setFormData({ title: "", content: "", category: "general" });
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {editingPhrase ? (
            // Edit/Create Form
            <form onSubmit={handleSubmitPhrase} className="p-3 space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Welcome Message"
                  className="h-9"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as PhraseCategory })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greeting">Greeting</SelectItem>
                    <SelectItem value="solution">Solution</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Content</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter your quick reply message..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditingPhrase(null);
                    setFormData({ title: "", content: "", category: "general" });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="flex-1">
                  {editingPhrase?._id ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          ) : (
            // Phrases List
            <ScrollArea className="h-full">
              <div className="p-2">
                {agentPhrases.length > 0 ? (
                  Object.entries(groupedPhrases).map(([category, categoryPhrases]) => (
                    <div key={category} className="mb-4">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-xs font-medium capitalize text-muted-foreground">{category}</span>
                        <Badge variant="outline" className={`${getCategoryBadgeColor(category)} text-[10px] h-4 px-1`}>
                          {(categoryPhrases as AgentPhrase[]).length}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {(categoryPhrases as AgentPhrase[]).map((phrase) => (
                          <div
                            key={phrase._id}
                            className="p-2 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium truncate">{phrase.title}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {phrase.content}
                                </p>
                              </div>
                              <div className="flex items-center gap-0.5 ml-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditPhrase(phrase)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeletePhrase(phrase._id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No phrases yet</p>
                    <p className="text-xs text-muted-foreground">
                      Create your first phrase
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
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

      {/* Unified Filter Row */}
      <div className="border-b border-border">
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
          {filterOptions.map((option, index) => (
            <button
              key={option.id}
              onClick={() => setActiveFilter(option.id)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize whitespace-nowrap flex items-center gap-1 ${
                activeFilter === option.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {option.id === "personal" && <User className="h-3 w-3" />}
              {option.id === "shared" && <Building2 className="h-3 w-3" />}
              {option.label}
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

      {/* Footer - Manage Phrases Link */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-muted-foreground hover:text-foreground"
          onClick={() => setShowManageView(true)}
        >
          <Settings className="h-3 w-3 mr-1.5" />
          Manage My Phrases
        </Button>
      </div>
    </div>
  );
}