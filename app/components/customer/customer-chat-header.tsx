"use client";

import { MoreVertical, Settings, User, Sun, Moon, Monitor, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useUser } from "@/app/contexts/user-context";

interface CustomerChatHeaderProps {
  onRequestHumanSupport?: () => void;
  showMenu?: boolean;
  companyId?: string;
}

export function CustomerChatHeader({
  onRequestHumanSupport,
  showMenu = true,
  companyId,
}: CustomerChatHeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { userData } = useUser();

  // Fetch company data to get company name
  const company = useQuery(
    api.companies.queries.getCompanyById,
    companyId ? { companyId: companyId as Id<"companies"> } : "skip"
  );

  const companyName = company?.name || "Bookoo Apps";

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
  };

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="h-4 w-4" />;
    if (theme === "dark") return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const handleSettingsClick = () => {
    router.push(`/experiences/${experienceId}/settings`);
  };

  return (
    <div className="border-b border-border bg-background px-6 py-4">
      <div className="flex items-center justify-between max-w-[800px] mx-auto">
        <p className="text-body-sm">{companyName} Support</p>

        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="p-2">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  {userData?.user?.displayName && (
                    <>
                      <p className="text-label font-medium">
                        {userData.user.displayName.split(" ")[0]}
                      </p>
                      <p className="text-caption text-muted-foreground font-normal">
                        @{userData.user.whopUsername}
                      </p>
                    </>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Admin Dashboard Button - Only show if user is admin */}
              {userData?.userCompanies?.[0]?.role === "admin" && (
                <>
                  <DropdownMenuItem 
                    onClick={() => router.push(`/experiences/${experienceId}`)}
                    className="text-orange-500 font-medium"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem onClick={onRequestHumanSupport}>
                Request Human Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSettingsClick}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
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
        )}
      </div>
    </div>
  );
}
