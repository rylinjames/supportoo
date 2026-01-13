"use client";

import { useTheme } from "next-themes";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/app/contexts/user-context";
import {
  ChevronDown,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { getCurrentRole } = useUser();

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);

    // Toast notification
    const themeLabel = newTheme === "system" ? "system default" : newTheme;
    toast.success(`Theme changed to ${themeLabel}`);
  };

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="h-4 w-4" />;
    if (theme === "dark") return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const getThemeLabel = () => {
    if (theme === "light") return "Light";
    if (theme === "dark") return "Dark";
    return "System";
  };

  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const button = (
    <button
      className={`
        flex items-center gap-3 w-full rounded-md px-2 py-2
        text-foreground hover:bg-muted/50
        transition-colors duration-200
        ${isCollapsed ? "justify-center" : ""}
      `}
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
      {!isCollapsed && (
        <>
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
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </>
      )}
    </button>
  );

  // When collapsed, just show dropdown (tooltip on button is enough)
  if (isCollapsed) {
    return (
      <>
        {userName ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
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
      {/* Agent Availability Status */}
      {isAgent && !isCollapsed && (
        <div className="px-2">
          <AgentAvailabilityStatus />
        </div>
      )}
      
      {/* User Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            {userName ? (
              <>
                <p className="text-label font-medium">
                  {userName.split(" ")[0]}
                </p>
                <p className="text-caption text-muted-foreground font-normal">
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
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Billing - Admin only */}
        {getCurrentRole() === "admin" && (
          <DropdownMenuItem
            onClick={() => {
              router.push(`/experiences/${experienceId}/billing`);
            }}
          >
            <CreditCard className="h-4 w-4" />
            Billing
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => {
            router.push(`/experiences/${experienceId}/settings`);
          }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Help & Support */}
        <DropdownMenuItem
          onClick={() => {
            router.push(`/experiences/${experienceId}/help`);
          }}
        >
          <HelpCircle className="h-4 w-4" />
          Help & Support
        </DropdownMenuItem>

        {/* More Apps */}
        <DropdownMenuItem
          onClick={() => {
            router.push(`/experiences/${experienceId}/more-apps`);
          }}
        >
          <Grid className="h-4 w-4" />
          More Apps
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Theme Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {getThemeIcon()}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleThemeChange("light")}>
              <Sun className="h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
              <Moon className="h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleThemeChange("system")}>
              <Monitor className="h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
