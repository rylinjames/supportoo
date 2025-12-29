"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
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
import { useUser } from "@/app/contexts/user-context";

type TemplateCategory = "greeting" | "escalation" | "resolution" | "general";

interface Template {
  _id: Id<"templates">;
  title: string;
  content: string;
  category: TemplateCategory;
  createdAt: number;
  updatedAt: number;
}

const TEMPLATE_CATEGORIES = [
  { value: "greeting" as const, label: "Greeting" },
  { value: "escalation" as const, label: "Escalation" },
  { value: "resolution" as const, label: "Resolution" },
  { value: "general" as const, label: "General" },
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
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null
  );

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
      {/* Top Actions */}
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
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" /> {/* Category header */}
            <Skeleton className="h-24 w-full" /> {/* Template card */}
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : groupedTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchQuery ? "No templates found" : "No templates yet"}
          </p>
          {searchQuery ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </Button>
          ) : (
            <Button onClick={() => setIsModalOpen(true)} size="sm">
              Create Template
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTemplates.map((group) => (
            <div key={group.value}>
              {/* Category Header */}
              <h3 className="text-muted-foreground mb-3">
                {group.label} ({group.templates.length})
              </h3>

              {/* Template Cards */}
              <div className="space-y-2">
                {group.templates.map((template: any) => {
                  const variables = extractVariables(template.content);
                  return (
                    <div
                      key={template._id}
                      className="p-4 bg-secondary rounded-md border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-foreground mb-1">
                            {template.title}
                          </h4>
                          <p className="text-muted-foreground truncate">
                            {template.content}
                          </p>
                          {variables.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {variables.map((variable, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono"
                                >
                                  {variable}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(template)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
