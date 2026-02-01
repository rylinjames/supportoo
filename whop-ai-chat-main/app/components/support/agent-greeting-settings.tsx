"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";

export function AgentGreetingSettings() {
  const settings = useQuery(api.agentSettings.getSettings);
  const updateGreeting = useMutation(api.agentSettings.updateGreeting);

  const [greeting, setGreeting] = useState("");
  const [autoGreetingEnabled, setAutoGreetingEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setGreeting(settings.agentGreeting);
      setAutoGreetingEnabled(settings.autoGreetingEnabled);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateGreeting({
        greeting,
        autoGreetingEnabled,
      });
      toast.success("Greeting settings updated successfully");
    } catch (error) {
      toast.error("Failed to update greeting settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-20 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded w-24"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Agent Greeting Message
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            This message will be sent automatically when you join a conversation
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-greeting" className="flex flex-col">
              <span>Auto-send greeting</span>
              <span className="text-xs text-muted-foreground font-normal">
                Automatically send your greeting when joining conversations
              </span>
            </Label>
            <Switch
              id="auto-greeting"
              checked={autoGreetingEnabled}
              onCheckedChange={setAutoGreetingEnabled}
            />
          </div>

          <div>
            <Label htmlFor="greeting-message">Greeting Message</Label>
            <Textarea
              id="greeting-message"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Enter your greeting message..."
              rows={3}
              className="mt-1.5"
              disabled={!autoGreetingEnabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: Keep it friendly and professional. You can personalize it later for specific conversations.
            </p>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
            <div className="bg-background p-2 rounded border">
              <p className="text-sm">{greeting || "No greeting message set"}</p>
            </div>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </Card>
  );
}