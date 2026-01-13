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
  ChevronDown,
  Bot,
  Blocks,
  MessageSquare,
  ChartNoAxesColumn,
  LucideIcon,
  Sparkles,
  Building2,
  ArrowRightLeft,
  Activity,
  FileText,
  Users,
} from "lucide-react";
import { Separator } from "../../../components/ui/separator";
import { SidebarItem } from "./sidebar-item";
import { UserSection } from "./user-section";
import { CompanySwitcher } from "../common/company-switcher";
import { useUser } from "@/app/contexts/user-context";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  route: string;
  badge?: number;
}

interface NavSection {
  id: string;
  label: string | null;
  items: NavItem[];
  defaultExpanded?: boolean;
}

interface SidebarSectionProps {
  section: NavSection;
  isCollapsed: boolean;
  isActiveRoute: (route: string) => boolean;
}

function SidebarSection({ section, isCollapsed, isActiveRoute }: SidebarSectionProps) {
  const [isExpanded, setIsExpanded] = useState(section.defaultExpanded ?? true);

  return (
    <div className="py-1">
      {section.label && !isCollapsed && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          <span>{section.label}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      )}
      <div
        className={cn(
          "space-y-0.5 overflow-hidden transition-all duration-200",
          section.label && !isExpanded && !isCollapsed && "max-h-0 opacity-0",
          (isExpanded || !section.label || isCollapsed) && "max-h-[500px] opacity-100"
        )}
      >
        {section.items.map((item) => (
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
      </div>
    </div>
  );
}

interface SidebarProps {
  userType: "customer" | "support" | "manager" | "viewer" | "admin";
  user?: any;
}

export function Sidebar({ userType, user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { userData, getCurrentRole } = useUser();

  const currentRole = getCurrentRole();
  const effectiveUserType = currentRole || userType;

  // Get conversations to calculate badge count
  const conversations = useQuery(
    api.conversations.queries.listConversationsForAgents,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  const unresolvedCount = conversations
    ? conversations.filter((conv: any) => conv.status !== "resolved").length
    : 0;

  // Customer has no sidebar
  if (userType === "customer") {
    return null;
  }

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

    // Check for partial matches (e.g., /workspace/templates matches /workspace)
    if (route !== "/" && routeAfterExperience.startsWith(route)) {
      return true;
    }

    return routeAfterExperience === route;
  };

  // Define navigation sections based on role
  const getNavSections = (): NavSection[] => {
    // Support Tickets - main entry point
    const supportTicketsSection: NavSection = {
      id: "support-tickets",
      label: null,
      items: [
        { id: "support", icon: MessageSquare, label: "Support Tickets", route: "/", badge: unresolvedCount },
      ],
    };

    // AI Studio - expandable section with tabs
    const aiStudioSection: NavSection = {
      id: "ai-studio",
      label: "AI Studio",
      defaultExpanded: true,
      items: [
        { id: "personality", icon: Sparkles, label: "Personality & Tone", route: "/ai-studio" },
        { id: "company-context", icon: Building2, label: "Company Context", route: "/ai-studio?tab=context" },
        { id: "handoff", icon: ArrowRightLeft, label: "Handoff Triggers", route: "/ai-studio?tab=handoff" },
      ],
    };

    // Customer Test - standalone item
    const customerTestSection: NavSection = {
      id: "customer-test",
      label: null,
      items: [
        { id: "customer-test", icon: Eye, label: "Customer Test", route: "/customer-test" },
      ],
    };

    // Workspace - expandable section with Templates and Team
    const workspaceSection: NavSection = {
      id: "workspace",
      label: "Workspace",
      defaultExpanded: false,
      items: [
        { id: "templates", icon: FileText, label: "Templates", route: "/workspace" },
        { id: "team", icon: Users, label: "Team", route: "/workspace?tab=team" },
      ],
    };

    // Analytics - expandable section
    const analyticsSection: NavSection = {
      id: "analytics",
      label: "Analytics",
      defaultExpanded: false,
      items: [
        { id: "usage", icon: Activity, label: "Usage", route: "/analytics/usage" },
        { id: "insights", icon: ChartNoAxesColumn, label: "Insights", route: "/insights" },
      ],
    };

    // Role-based navigation
    // Note: Billing, Settings, Help, More Apps moved to profile dropdown
    if (effectiveUserType === "admin") {
      return [supportTicketsSection, aiStudioSection, customerTestSection, workspaceSection, analyticsSection];
    }

    if (effectiveUserType === "manager") {
      return [supportTicketsSection, aiStudioSection, customerTestSection, workspaceSection, analyticsSection];
    }

    if (effectiveUserType === "viewer") {
      return [
        supportTicketsSection,
        {
          id: "analytics",
          label: null,
          items: [
            { id: "usage", icon: Activity, label: "Usage", route: "/analytics/usage" },
            { id: "insights", icon: ChartNoAxesColumn, label: "Insights", route: "/insights" },
          ],
        },
      ];
    }

    // Support role
    return [
      supportTicketsSection,
      {
        id: "workspace",
        label: null,
        items: [
          { id: "products", icon: Blocks, label: "Products", route: "/workspace" },
        ],
      },
      customerTestSection,
    ];
  };

  const navSections = getNavSections();

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-background border-r border-border",
        "transition-all duration-300 ease-in-out max-xl:hidden",
        isCollapsed ? "w-[56px]" : "w-[240px]"
      )}
    >
      {/* Header: Collapse Button Only */}
      <div
        className={cn(
          "flex items-center h-14 px-3",
          isCollapsed ? "justify-center" : "justify-end"
        )}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <Separator />

      {/* Navigation Sections */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {navSections.map((section, index) => (
          <div key={section.id}>
            <SidebarSection
              section={section}
              isCollapsed={isCollapsed}
              isActiveRoute={isActiveRoute}
            />
            {index < navSections.length - 1 && section.label && (
              <Separator className="my-2" />
            )}
          </div>
        ))}
      </nav>

      <Separator />

      {/* Company Switcher */}
      {!isCollapsed && userData && userData.userCompanies.length > 1 && (
        <>
          <div className="p-3">
            <CompanySwitcher />
          </div>
          <Separator />
        </>
      )}

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
