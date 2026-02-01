"use client";

import { useState } from "react";
import {
  MessageSquare,
  Settings as SettingsIcon,
  Eye,
  Bot,
  ChartNoAxesColumn,
  MoreHorizontal,
  LucideIcon,
  Activity,
  CreditCard,
  HelpCircle,
  Grid,
} from "lucide-react";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useUser } from "@/app/contexts/user-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  route: string;
}

interface MobileBottomNavProps {
  userType: "customer" | "support" | "manager" | "viewer" | "admin";
  user?: any;
}

export function MobileBottomNav({ userType, user }: MobileBottomNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { userData, getCurrentRole } = useUser();

  const currentRole = getCurrentRole();
  const effectiveUserType = currentRole || userType;

  // Customer has no bottom nav
  if (userType === "customer") {
    return null;
  }

  // Define navigation items based on role
  // Matches new sidebar structure: Support Tickets, AI Studio, Customer Test, Analytics
  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [
      { id: "support", icon: MessageSquare, label: "Support", route: "/" },
    ];

    if (effectiveUserType === "admin") {
      return [
        ...baseItems,
        { id: "ai-studio", icon: Bot, label: "AI Studio", route: "/ai-studio" },
        { id: "customer-test", icon: Eye, label: "Test", route: "/customer-test" },
        { id: "usage", icon: Activity, label: "Usage", route: "/analytics/usage" },
        { id: "insights", icon: ChartNoAxesColumn, label: "Insights", route: "/insights" },
        { id: "billing", icon: CreditCard, label: "Billing", route: "/billing" },
        { id: "settings", icon: SettingsIcon, label: "Settings", route: "/settings" },
        { id: "help", icon: HelpCircle, label: "Help", route: "/help" },
        { id: "more-apps", icon: Grid, label: "More Apps", route: "/more-apps" },
      ];
    }

    if (effectiveUserType === "manager") {
      return [
        ...baseItems,
        { id: "ai-studio", icon: Bot, label: "AI Studio", route: "/ai-studio" },
        { id: "customer-test", icon: Eye, label: "Test", route: "/customer-test" },
        { id: "usage", icon: Activity, label: "Usage", route: "/analytics/usage" },
        { id: "insights", icon: ChartNoAxesColumn, label: "Insights", route: "/insights" },
        { id: "settings", icon: SettingsIcon, label: "Settings", route: "/settings" },
        { id: "help", icon: HelpCircle, label: "Help", route: "/help" },
      ];
    }

    if (effectiveUserType === "viewer") {
      return [
        ...baseItems,
        { id: "usage", icon: Activity, label: "Usage", route: "/analytics/usage" },
        { id: "insights", icon: ChartNoAxesColumn, label: "Insights", route: "/insights" },
        { id: "settings", icon: SettingsIcon, label: "Settings", route: "/settings" },
        { id: "help", icon: HelpCircle, label: "Help", route: "/help" },
      ];
    }

    // Support role
    return [
      ...baseItems,
      { id: "customer-test", icon: Eye, label: "Test", route: "/customer-test" },
      { id: "settings", icon: SettingsIcon, label: "Settings", route: "/settings" },
      { id: "help", icon: HelpCircle, label: "Help", route: "/help" },
    ];
  };

  const navItems = getNavItems();

  // Show max 4 items in bottom bar, rest go to "More" sheet
  const maxVisibleItems = 4;
  const visibleItems = navItems.slice(0, maxVisibleItems);
  const overflowItems = navItems.slice(maxVisibleItems);
  const hasOverflow = overflowItems.length > 0;

  // Helper function to check if a route is active
  const isActiveRoute = (route: string) => {
    const pathParts = pathname.split("/");
    const experienceIndex = pathParts.findIndex((part) =>
      part.startsWith("exp_")
    );
    if (experienceIndex === -1) return false;

    const routeAfterExperience =
      "/" + pathParts.slice(experienceIndex + 1).join("/");

    if (routeAfterExperience === "/" && route === "/") {
      return true;
    }

    // Check for partial matches
    if (route !== "/" && routeAfterExperience.startsWith(route)) {
      return true;
    }

    return routeAfterExperience === route;
  };

  // Check if any overflow item is active
  const isOverflowActive = overflowItems.some((item) => isActiveRoute(item.route));

  // Helper function to build full href
  const buildFullHref = (route: string) => {
    return `/experiences/${experienceId}${route}`;
  };

  const handleNavigation = (route: string) => {
    router.push(buildFullHref(route));
    setSheetOpen(false);
  };

  const NavButton = ({
    item,
    isActive,
    onClick,
  }: {
    item: NavItem;
    isActive: boolean;
    onClick: () => void;
  }) => {
    const Icon = item.icon;
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 px-3 py-1 rounded-lg",
          "transition-colors min-w-[56px]",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="text-[11px] font-medium leading-none truncate max-w-[56px]">
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="border-t border-border bg-card safe-area-inset-bottom xl:hidden">
      <div className="flex items-center justify-around px-2 py-3">
        {/* Visible Navigation Items */}
        {visibleItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={isActiveRoute(item.route)}
            onClick={() => handleNavigation(item.route)}
          />
        ))}

        {/* More Button with Sheet for overflow items */}
        {hasOverflow && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 px-3 py-1 rounded-lg",
                  "transition-colors min-w-[56px]",
                  isOverflowActive || sheetOpen
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[11px] font-medium leading-none">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="pb-safe">
              <SheetHeader className="pb-2">
                <SheetTitle>More Options</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-4 gap-4 py-4">
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveRoute(item.route);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.route)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl",
                        "transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
}
