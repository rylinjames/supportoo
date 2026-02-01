"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StickyNote, Save, Edit2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface InternalNotesProps {
  conversationId: Id<"conversations">;
}

export function InternalNotes({ conversationId }: InternalNotesProps) {
  const notesData = useQuery(
    api.internalNotes.getNotes,
    conversationId ? { conversationId } : "skip"
  );
  const updateNotes = useMutation(api.internalNotes.updateNotes);

  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (notesData) {
      setNotes(notesData.notes || "");
    }
  }, [notesData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateNotes({
        conversationId,
        notes: notes.trim(),
      });
      toast.success("Internal notes updated");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(notesData?.notes || "");
    setIsEditing(false);
  };

  // Don't show for customers
  if (notesData === null) {
    return null;
  }

  return (
    <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
              Internal Notes
            </h3>
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              (Only visible to agents)
            </span>
          </div>
          {!isEditing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this conversation..."
              rows={3}
              className="bg-white dark:bg-gray-900 border-yellow-300 dark:border-yellow-800"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="h-3 w-3 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {notes ? (
              <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">
                {notes}
              </p>
            ) : (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 italic">
                No internal notes yet. Click edit to add notes.
              </p>
            )}
            {notesData?.updatedBy && notesData?.updatedAt && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Last updated by {notesData.updatedBy}{" "}
                {formatDistanceToNow(notesData.updatedAt, { addSuffix: true })}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}