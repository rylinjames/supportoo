"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, MessageSquare, ChevronDown, Hand, CheckCircle, Sparkles, MessagesSquare } from "lucide-react";
import { TemplateModal } from "./template-modal";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUser } from "@/app/contexts/user-context";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type TemplateCategory = "greeting" | "escalation" | "resolution" | "general";

interface Template {
  _id: Id<"templates">;
  title: string;
  content: string;
  category: TemplateCategory;
  createdAt: number;
  updatedAt: number;
}

const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string; icon: LucideIcon }[] = [
  { value: "greeting", label: "Greeting", icon: Hand },
  { value: "escalation", label: "Escalation", icon: MessagesSquare },
  { value: "resolution", label: "Resolution", icon: CheckCircle },
  { value: "general", label: "General", icon: Sparkles },
];

interface TemplatesTabProps {
  companyId: Id<"companies">;
}

export function TemplatesTab({ companyId }: TemplatesTabProps) {
  const { userData } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  // Fetch templates
  const templates = useQuery(api.templates.queries.listTemplatesByCompany, {
    companyId,
  });

  // Add loading check
  const isLoading = templates === undefined;

  // Mutations
  const createTemplate = useMutation(api.templates.mutations.createTemplate);
  const updateTemplate = useMutation(api.templates.mutations.updateTemplate);
  const deleteTemplate = useMutation(api.templates.mutations.deleteTemplate);

  // Filter templates
  const filteredTemplates =
    templates?.filter(
      (template: any) =>
        template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.content.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Group by category
  const groupedTemplates = TEMPLATE_CATEGORIES.map((category) => ({
    ...category,
    templates: filteredTemplates.filter(
      (t: any) => t.category === category.value
    ),
  })).filter((group) => group.templates.length > 0);

  const handleCreate = async (data: {
    title: string;
    content: string;
    category: TemplateCategory;
  }) => {
    if (!userData?.user?._id) return;

    try {
      await createTemplate({
        companyId,
        createdBy: userData.user._id as Id<"users">,
        title: data.title,
        content: data.content,
        category: data.category,
      });
      toast.success("Template created");
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    }
  };

  const handleUpdate = async (data: {
    title: string;
    content: string;
    category: TemplateCategory;
  }) => {
    if (!editingTemplate) return;

    try {
      await updateTemplate({
        templateId: editingTemplate._id,
        title: data.title,
        content: data.content,
        category: data.category,
      });
      toast.success("Template updated");
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      await deleteTemplate({
        templateId: templateToDelete._id,
      });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      toast.success("Template deleted");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const openDeleteDialog = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const openEditModal = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  // Extract variables from content
  const extractVariables = (content: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push(`{${match[1]}}`);
    }
    return matches;
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Action */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
            disabled={isLoading}
          />
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          size="sm"
          disabled={isLoading}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Template
        </Button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-secondary/50">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      ) : groupedTemplates.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-full bg-secondary mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? "No templates found" : "No templates yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {searchQuery
              ? "Try adjusting your search query"
              : "Create quick reply templates to speed up your support responses"}
          </p>
          {searchQuery ? (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          ) : (
            <Button onClick={() => setIsModalOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create First Template
            </Button>
          )}
        </div>
      ) : (
        /* Template Categories */
        <div className="space-y-4">
          {groupedTemplates.map((group) => {
            const Icon = group.icon;
            return (
              <Collapsible key={group.value} defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{group.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {group.templates.length}
                    </Badge>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  {group.templates.map((template: any) => {
                    const variables = extractVariables(template.content);
                    return (
                      <div
                        key={template._id}
                        className="group/card p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">
                              {template.title}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {template.content}
                            </p>
                            {variables.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {variables.map((variable, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono"
                                  >
                                    {variable}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditModal(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(template)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Template Modal */}
      <TemplateModal
        open={isModalOpen}
        onClose={closeModal}
        onSave={editingTemplate ? handleUpdate : handleCreate}
        template={editingTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.title}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
