"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { COMMON_TIMEZONES, detectTimezone } from "@/app/lib/timezones";
import { AgentGreetingSettings } from "../support/agent-greeting-settings";

export function SettingsView() {
  const { userData, getCurrentRole } = useUser();
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

  // Generate initials from displayName
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
          Manage your profile and preferences
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="space-y-12">
          {isLoading ? (
            <>
              {/* Profile Section Skeleton */}
              <div className="space-y-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-64" />
                <div className="flex items-start gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                </div>
              </div>

              {/* Preferences Section Skeleton */}
              <div className="space-y-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-64" />
                <div className="space-y-8">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
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
              {/* Profile Section */}
              <div>
                <div className="mb-6">
                  <h2 className="text-h3 text-foreground">Profile</h2>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Your account information from Whop
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage
                      src={userData?.user?.avatarUrl}
                      alt={userData?.user?.displayName || "User"}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-body-sm">
                      {userData?.user?.displayName
                        ? getInitials(userData.user.displayName)
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-body-sm text-foreground font-medium">
                      {userData?.user?.displayName || "User"}
                    </p>
                    <p className="text-body-sm text-muted-foreground mt-0.5">
                      @{userData?.user?.whopUsername || "username"}
                    </p>
                    <p className="text-body-sm text-muted-foreground mt-3">
                      Profile information is managed through your Whop account
                    </p>
                  </div>
                </div>
              </div>

              {/* Preferences Section */}
              <div>
                <div className="mb-6">
                  <h2 className="text-h3 text-foreground">Preferences</h2>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Customize your experience
                  </p>
                </div>

                <div className="space-y-8">
                  {/* Theme Selection */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-body-sm text-foreground font-medium">
                        Theme
                      </Label>
                      <p className="text-body-sm text-muted-foreground mt-0.5">
                        Choose your preferred color scheme
                      </p>
                    </div>
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

                  {/* Timezone Selection */}
                  {/* <div className="space-y-3">
                    <div>
                      <Label
                        htmlFor="timezone"
                        className="text-body-sm text-foreground font-medium"
                      >
                        Timezone
                      </Label>
                      <p className="text-body-sm text-muted-foreground mt-0.5">
                        Select your timezone for accurate timestamps
                      </p>
                    </div>
                    <Select
                      value={preferences.timezone}
                      onValueChange={handleTimezoneChange}
                    >
                      <SelectTrigger id="timezone" className="w-full max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div> */}
                </div>
              </div>

              {/* Notifications Section */}
              <div>
                <div className="mb-6">
                  <h2 className="text-h3 text-foreground">Notifications</h2>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Receive alerts for important events
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-body-sm text-foreground font-medium">
                      Notifications
                    </Label>
                    <p className="text-body-sm text-muted-foreground mt-0.5">
                      Receive alerts for important events
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
              </div>

              {/* Agent Greeting Settings - Only for support/admin users */}
              {(getCurrentRole() === "support" || getCurrentRole() === "admin") && (
                <div className="mt-8">
                  <AgentGreetingSettings />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
