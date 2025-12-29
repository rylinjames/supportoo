"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Bot,
  Blocks,
  CreditCard,
  MessageSquare,
  Settings,
  ChartNoAxesColumn,
} from "lucide-react";
import { Separator } from "../../../components/ui/separator";
import { SidebarItem } from "./sidebar-item";
import { UserSection } from "./user-section";
import { CompanySwitcher } from "../common/company-switcher";
import { useUser } from "@/app/contexts/user-context";

interface SidebarProps {
  userType: "customer" | "support" | "manager" | "viewer" | "admin";
  user?: any; // Current user data from Convex - will be replaced by context
}

export function Sidebar({ userType, user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { userData, getCurrentRole } = useUser(); // Use new context

  // Get current role from context instead of props
  const currentRole = getCurrentRole();
  const effectiveUserType = currentRole || userType; // Fallback to prop for now

  // Get conversations to calculate badge count
  const conversations = useQuery(
    api.conversations.queries.listConversationsForAgents,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  // Count unresolved conversations (all except "resolved")
  const unresolvedCount = conversations
    ? conversations.filter((conv: any) => conv.status !== "resolved").length
    : 0;

  // Customer has no sidebar
  if (userType === "customer") {
    return null;
  }

  // Viewer navigation items (read-only access)
  const viewerNavItems = [
    {
      id: "support",
      icon: MessageSquare,
      label: "Support",
      route: "/",
      badge: unresolvedCount,
    },
    {
      id: "insights",
      icon: ChartNoAxesColumn,
      label: "Insights",
      route: "/insights",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Settings",
      route: "/settings",
    },
  ];

  // Support navigation items
  const supportNavItems = [
    {
      id: "support",
      icon: MessageSquare,
      label: "Support",
      route: "/",
      badge: unresolvedCount,
    },
    {
      id: "workspace",
      icon: Blocks,
      label: "Workspace",
      route: "/workspace",
    },
    {
      id: "customer-test",
      icon: Eye,
      label: "Customer Test",
      route: "/customer-test",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Settings",
      route: "/settings",
    },
  ];

  // Manager navigation items (everything except billing)
  const managerNavItems = [
    {
      id: "support",
      icon: MessageSquare,
      label: "Support",
      route: "/",
      badge: unresolvedCount,
    },
    {
      id: "ai-studio",
      icon: Bot,
      label: "AI Studio",
      route: "/ai-studio",
    },
    {
      id: "insights",
      icon: ChartNoAxesColumn,
      label: "Insights",
      route: "/insights",
    },
    {
      id: "workspace",
      icon: Blocks,
      label: "Workspace",
      route: "/workspace",
    },
    {
      id: "customer-test",
      icon: Eye,
      label: "Customer Test",
      route: "/customer-test",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Settings",
      route: "/settings",
    },
  ];

  // Admin navigation items
  const adminNavItems = [
    {
      id: "support",
      icon: MessageSquare,
      label: "Support",
      route: "/",
      badge: unresolvedCount,
    },
    {
      id: "ai-studio",
      icon: Bot,
      label: "AI Studio",
      route: "/ai-studio",
    },
    {
      id: "insights",
      icon: ChartNoAxesColumn,
      label: "Insights",
      route: "/insights",
    },
    {
      id: "workspace",
      icon: Blocks,
      label: "Workspace",
      route: "/workspace",
    },
    {
      id: "billing",
      icon: CreditCard,
      label: "Billing",
      route: "/billing",
    },
    {
      id: "customer-test",
      icon: Eye,
      label: "Customer Test",
      route: "/customer-test",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Settings",
      route: "/settings",
    },
  ];

  const navItems =
    effectiveUserType === "admin" ? adminNavItems :
    effectiveUserType === "manager" ? managerNavItems :
    effectiveUserType === "viewer" ? viewerNavItems :
    supportNavItems;

  // Helper function to check if a route is active
  const isActiveRoute = (route: string) => {
    // Extract the path after /experiences/[experienceId]
    const pathParts = pathname.split("/");
    const experienceIndex = pathParts.findIndex((part) =>
      part.startsWith("exp_")
    );
    if (experienceIndex === -1) return false;

    const routeAfterExperience =
      "/" + pathParts.slice(experienceIndex + 1).join("/");

    // Handle default route case: if we're just on /experiences/[experienceId], show Support as active
    if (routeAfterExperience === "/" && route === "/") {
      return true;
    }

    return routeAfterExperience === route;
  };

  return (
    <aside
      className={`
        relative flex flex-col h-screen bg-background border-r border-border
        transition-all duration-300 ease-in-out max-xl:hidden
        ${isCollapsed ? "w-[56px]" : "w-[240px]"}
      `}
    >
      {/* Header: Logo + Collapse Button */}
      <div
        className={`flex items-center gap-2 p-3 ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!isCollapsed && (
          <h1 className="text-h2 text-foreground font-semibold">CHAT</h1>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <Separator />

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            isCollapsed={isCollapsed}
            badge={item.badge}
            active={isActiveRoute(item.route)}
            href={item.route}
          />
        ))}
      </nav>

      <Separator />

      {/* Company Switcher */}
      {!isCollapsed && userData && userData.userCompanies.length > 1 && (
        <div className="p-3">
          <CompanySwitcher />
        </div>
      )}

      <Separator />

      {/* User Section at BOTTOM */}
      <div className="p-3">
        <UserSection
          isCollapsed={isCollapsed}
          userAvatar={user?.user.avatarUrl}
          userName={user?.user.displayName}
          userUsername={user?.user.whopUsername}
        />
      </div>
    </aside>
  );
}
