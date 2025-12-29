"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit2, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

type PhraseCategory = "greeting" | "solution" | "followup" | "closing" | "general";

interface AgentPhrase {
  _id: Id<"agentPhrases">;
  title: string;
  content: string;
  category: PhraseCategory;
  isActive: boolean;
}

export function AgentPhrasesManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState<AgentPhrase | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general" as PhraseCategory,
  });

  const phrases = useQuery(api.agentPhrases.getMyPhrases) ?? [];
  const createPhrase = useMutation(api.agentPhrases.create);
  const updatePhrase = useMutation(api.agentPhrases.update);
  const deletePhrase = useMutation(api.agentPhrases.remove);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPhrase) {
        await updatePhrase({
          phraseId: editingPhrase._id,
          ...formData,
        });
        toast.success("Phrase updated successfully");
      } else {
        await createPhrase(formData);
        toast.success("Phrase created successfully");
      }
      
      setIsOpen(false);
      setEditingPhrase(null);
      setFormData({ title: "", content: "", category: "general" });
    } catch (error) {
      toast.error("Failed to save phrase");
    }
  };

  const handleEdit = (phrase: AgentPhrase) => {
    setEditingPhrase(phrase);
    setFormData({
      title: phrase.title,
      content: phrase.content,
      category: phrase.category,
    });
    setIsOpen(true);
  };

  const handleDelete = async (phraseId: Id<"agentPhrases">) => {
    if (confirm("Are you sure you want to delete this phrase?")) {
      try {
        await deletePhrase({ phraseId });
        toast.success("Phrase deleted successfully");
      } catch (error) {
        toast.error("Failed to delete phrase");
      }
    }
  };

  const getCategoryColor = (category: PhraseCategory) => {
    switch (category) {
      case "greeting":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "solution":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "followup":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "closing":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "general":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const groupedPhrases = phrases.reduce((acc: Record<string, AgentPhrase[]>, phrase: AgentPhrase) => {
    if (!acc[phrase.category]) {
      acc[phrase.category] = [];
    }
    acc[phrase.category].push(phrase);
    return acc;
  }, {} as Record<string, AgentPhrase[]>);

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingPhrase(null);
              setFormData({ title: "", content: "", category: "general" });
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Manage My Phrases
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {editingPhrase ? "Edit Phrase" : "My Custom Phrases"}
            </DialogTitle>
            <DialogDescription>
              Create and manage your personal quick reply phrases
            </DialogDescription>
          </DialogHeader>

          {!editingPhrase ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingPhrase({} as AgentPhrase);
                    setFormData({ title: "", content: "", category: "general" });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Phrase
                </Button>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                {Object.entries(groupedPhrases).map(([category, categoryPhrases]) => (
                  <div key={category} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold capitalize">{category}</h3>
                      <Badge
                        variant="outline"
                        className={`${getCategoryColor(category as PhraseCategory)} text-xs`}
                      >
                        {categoryPhrases.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {categoryPhrases.map((phrase) => (
                        <div
                          key={phrase._id}
                          className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm mb-1">{phrase.title}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {phrase.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(phrase)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDelete(phrase._id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {phrases.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No custom phrases yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first phrase to speed up responses
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Welcome Message"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as PhraseCategory })
                  }
                >
                  <SelectTrigger>
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
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter your quick reply message..."
                  rows={4}
                  required
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingPhrase(null);
                    setIsOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPhrase?._id ? "Update Phrase" : "Create Phrase"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}