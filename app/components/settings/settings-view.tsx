"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { detectTimezone } from "@/app/lib/timezones";

export function SettingsView() {
  const { userData } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const updatePreferences = useMutation(
    api.users.preferences_mutations.updateUserPreferences
  );

  // Query full user document to get preferences
  const fullUser = useQuery(
    api.users.queries.getUserById,
    userData?.user?._id ? { userId: userData.user._id as Id<"users"> } : "skip"
  );

  // Initialize preferences from user data
  const [preferences, setPreferences] = useState<{
    theme: "light" | "dark" | "system";
    timezone: string;
    notificationsEnabled: boolean;
  }>({
    theme: "dark",
    timezone: detectTimezone(),
    notificationsEnabled: true,
  });

  // Update preferences when fullUser loads
  useEffect(() => {
    if (fullUser) {
      setPreferences({
        theme: (fullUser.theme || "dark") as "light" | "dark" | "system",
        timezone: fullUser.timezone || detectTimezone(),
        notificationsEnabled: fullUser.notificationsEnabled !== false,
      });
      setIsLoading(false);
    } else if (userData?.user && !fullUser) {
      // Still loading
      setIsLoading(true);
    }
  }, [fullUser, userData]);

  // Apply theme changes
  const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
    if (!userData?.user?._id) return;

    try {
      await updatePreferences({
        userId: userData.user._id as Id<"users">,
        theme: newTheme,
      });

      // Apply theme to document root
      const root = document.documentElement;
      if (newTheme === "dark") {
        root.classList.add("dark");
      } else if (newTheme === "light") {
        root.classList.remove("dark");
      } else {
        // System theme - follow OS preference
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        if (prefersDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }

      setPreferences({ ...preferences, theme: newTheme });
      toast.success(`Theme changed to ${newTheme}`);
    } catch (error) {
      console.error("Error updating theme:", error);
      toast.error("Failed to update theme");
    }
  };

  // Apply timezone changes
  const handleTimezoneChange = async (newTimezone: string) => {
    if (!userData?.user?._id) return;

    try {
      await updatePreferences({
        userId: userData.user._id as Id<"users">,
        timezone: newTimezone,
      });
      setPreferences({ ...preferences, timezone: newTimezone });
      toast.success("Timezone updated");
    } catch (error) {
      console.error("Error updating timezone:", error);
      toast.error("Failed to update timezone");
    }
  };

  // Apply notification changes
  const handleNotificationsChange = async (enabled: boolean) => {
    if (!userData?.user?._id) return;

    try {
      await updatePreferences({
        userId: userData.user._id as Id<"users">,
        notificationsEnabled: enabled,
      });
      setPreferences({ ...preferences, notificationsEnabled: enabled });
      toast.success(
        enabled ? "Notifications enabled" : "Notifications disabled"
      );
    } catch (error) {
      console.error("Error updating notifications:", error);
      toast.error("Failed to update notifications");
    }
  };

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <h1 className="text-h2 text-foreground">Settings</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Customize your preferences
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="space-y-12">
          {isLoading ? (
            <>
              {/* Theme Section Skeleton */}
              <div className="space-y-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-64" />
                <div className="space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>

              {/* Notifications Section Skeleton */}
              <div className="space-y-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-10 w-full max-w-md" />
              </div>
            </>
          ) : (
            <>
              {/* Theme Section */}
              <div>
                <div className="mb-6">
                  <h2 className="text-h3 text-foreground">Appearance</h2>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Choose your preferred color scheme
                  </p>
                </div>

                <div className="space-y-3">
                  <RadioGroup
                    value={preferences.theme}
                    onValueChange={(v) =>
                      handleThemeChange(v as "light" | "dark" | "system")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="light" id="light" />
                      <Label
                        htmlFor="light"
                        className="text-body-sm text-foreground font-normal cursor-pointer"
                      >
                        Light
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="dark" id="dark" />
                      <Label
                        htmlFor="dark"
                        className="text-body-sm text-foreground font-normal cursor-pointer"
                      >
                        Dark
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="system" id="system" />
                      <Label
                        htmlFor="system"
                        className="text-body-sm text-foreground font-normal cursor-pointer"
                      >
                        System
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Notifications Section */}
              <div>
                <div className="mb-6">
                  <h2 className="text-h3 text-foreground">Notifications</h2>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Manage your notification preferences
                  </p>
                </div>
                <div className="flex items-center justify-between max-w-md">
                  <Label
                    htmlFor="notifications"
                    className="text-body-sm text-foreground cursor-pointer"
                  >
                    Enable notifications
                  </Label>
                  <Switch
                    id="notifications"
                    checked={preferences.notificationsEnabled}
                    onCheckedChange={handleNotificationsChange}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
