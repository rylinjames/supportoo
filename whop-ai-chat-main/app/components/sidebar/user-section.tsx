"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/app/contexts/user-context";
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Sun,
  Moon,
  Monitor,
  CreditCard,
  HelpCircle,
  Grid,
} from "lucide-react";
import { AgentAvailabilityStatus } from "../support/agent-availability-status";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface UserSectionProps {
  isCollapsed: boolean;
  userName?: string;
  userAvatar?: string;
  userUsername?: string;
}

export function UserSection({
  isCollapsed,
  userAvatar,
  userName,
  userUsername,
}: UserSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { getCurrentRole } = useUser();

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    setIsThemeOpen(false);
    const themeLabel = newTheme === "system" ? "system default" : newTheme;
    toast.success(`Theme changed to ${themeLabel}`);
  };

  const handleNavigate = (route: string) => {
    router.push(`/experiences/${experienceId}${route}`);
    setIsExpanded(false);
  };

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="h-4 w-4" />;
    if (theme === "dark") return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isCollapsed) {
    return (
      <>
        {userName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center justify-center w-full rounded-md px-2 py-2 text-foreground hover:bg-muted/50 transition-colors duration-200">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-caption font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="text-left">
                <p className="text-body-sm font-medium">
                  {userName.split(" ")[0]}
                </p>
                <p className="text-caption opacity-70">@{userUsername}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        )}
      </>
    );
  }

  const isAgent = getCurrentRole() === "support" || getCurrentRole() === "admin";

  return (
    <div className="space-y-2">
      {isAgent && (
        <div className="px-2">
          <AgentAvailabilityStatus />
        </div>
      )}

      <div>
        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
            if (isExpanded) setIsThemeOpen(false);
          }}
          className="flex items-center gap-3 w-full rounded-md px-2 py-2 text-foreground hover:bg-muted/50 transition-colors duration-200"
        >
          {initials ? (
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={userAvatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-caption font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 text-left min-w-0">
            {userName ? (
              <>
                <p className="text-body-sm font-medium truncate">
                  {userName.split(" ")[0]}
                </p>
                <p className="text-caption text-muted-foreground truncate">
                  @{userUsername}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-32" />
              </>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </button>

        <div
          className={cn(
            "overflow-hidden transition-all duration-200",
            isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="space-y-0.5 pt-1">
            {getCurrentRole() === "admin" && (
              <button
                onClick={() => handleNavigate("/billing")}
                className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                Billing
              </button>
            )}
            <button
              onClick={() => handleNavigate("/settings")}
              className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={() => handleNavigate("/help")}
              className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              Help & Support
            </button>
            <button
              onClick={() => handleNavigate("/more-apps")}
              className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              <Grid className="h-4 w-4" />
              More Apps
            </button>

            <div>
              <button
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                {getThemeIcon()}
                Theme
                <ChevronDown
                  className={cn(
                    "h-3 w-3 ml-auto transition-transform duration-200",
                    isThemeOpen && "rotate-180"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200 pl-6",
                  isThemeOpen ? "max-h-[120px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <button
                  onClick={() => handleThemeChange("light")}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm transition-colors",
                    theme === "light" ? "text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <Sun className="h-4 w-4" />
                  Light
                </button>
                <button
                  onClick={() => handleThemeChange("dark")}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm transition-colors",
                    theme === "dark" ? "text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <Moon className="h-4 w-4" />
                  Dark
                </button>
                <button
                  onClick={() => handleThemeChange("system")}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-body-sm transition-colors",
                    theme === "system" ? "text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <Monitor className="h-4 w-4" />
                  System
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
