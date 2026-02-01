"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Eye,
  ChevronDown,
  MessageSquare,
  LucideIcon,
  Sparkles,
  Building2,
  ArrowRightLeft,
  Activity,
  FileText,
  Users,
  Menu,
} from "lucide-react";
import { Separator } from "../../../components/ui/separator";
import { SidebarItem } from "./sidebar-item";
import { UserSection } from "./user-section";
import { CompanySwitcher } from "../common/company-switcher";
import { useUser } from "@/app/contexts/user-context";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

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

interface MobileSidebarSectionProps {
  section: NavSection;
  isActiveRoute: (route: string) => boolean;
  onNavigate: () => void;
}

function MobileSidebarSection({ section, isActiveRoute, onNavigate }: MobileSidebarSectionProps) {
  const [isExpanded, setIsExpanded] = useState(section.defaultExpanded ?? true);

  return (
    <div className="py-1">
      {section.label && (
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
          section.label && !isExpanded && "max-h-0 opacity-0",
          (isExpanded || !section.label) && "max-h-[500px] opacity-100"
        )}
      >
        {section.items.map((item) => (
          <div key={item.id} onClick={onNavigate}>
            <SidebarItem
              icon={item.icon}
              label={item.label}
              isCollapsed={false}
              badge={item.badge}
              active={isActiveRoute(item.route)}
              href={item.route}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface MobileSidebarProps {
  userType: "customer" | "support" | "manager" | "viewer" | "admin";
  user?: any;
}

export function MobileSidebar({ userType, user }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

    const [routePath, routeQuery] = route.split("?");
    const currentTab = searchParams.get("tab");

    if (routeAfterExperience === "/" && route === "/") {
      return true;
    }

    if (routeQuery) {
      const routeParams = new URLSearchParams(routeQuery);
      const routeTab = routeParams.get("tab");
      return routeAfterExperience === routePath && currentTab === routeTab;
    }

    if (routeAfterExperience === routePath) {
      if (routePath === "/ai-studio" || routePath === "/workspace") {
        return !currentTab;
      }
      return true;
    }

    return false;
  };

  // Define navigation sections based on role
  const getNavSections = (): NavSection[] => {
    const supportTicketsSection: NavSection = {
      id: "support-tickets",
      label: null,
      items: [
        { id: "support", icon: MessageSquare, label: "Support Tickets", route: "/", badge: unresolvedCount },
      ],
    };

    const aiStudioSection: NavSection = {
      id: "ai-studio",
      label: "AI Studio",
      defaultExpanded: true,
      items: [
        { id: "personality", icon: Sparkles, label: "Personality & Tone", route: "/ai-studio" },
        { id: "company-context", icon: Building2, label: "Company Context", route: "/ai-studio?tab=context" },
        { id: "handoff", icon: ArrowRightLeft, label: "Handoff Triggers", route: "/ai-studio?tab=handoff" },
        { id: "customer-test", icon: Eye, label: "Customer Test", route: "/customer-test" },
      ],
    };

    const workspaceSection: NavSection = {
      id: "workspace",
      label: "Workspace",
      defaultExpanded: true,
      items: [
        { id: "templates", icon: FileText, label: "Templates", route: "/workspace" },
        { id: "team", icon: Users, label: "Team", route: "/workspace?tab=team" },
      ],
    };

    const analyticsSection: NavSection = {
      id: "analytics",
      label: "Analytics",
      defaultExpanded: false,
      items: [
        { id: "usage", icon: Activity, label: "Usage", route: "/analytics/usage" },
      ],
    };

    if (effectiveUserType === "admin") {
      return [supportTicketsSection, aiStudioSection, workspaceSection, analyticsSection];
    }

    if (effectiveUserType === "manager") {
      return [supportTicketsSection, aiStudioSection, workspaceSection, analyticsSection];
    }

    if (effectiveUserType === "viewer") {
      return [
        supportTicketsSection,
        {
          id: "analytics",
          label: null,
          items: [
            { id: "usage", icon: Activity, label: "Usage", route: "/analytics/usage" },
          ],
        },
      ];
    }

    return [
      supportTicketsSection,
      aiStudioSection,
    ];
  };

  const navSections = getNavSections();

  return (
    <div className="xl:hidden">
      {/* Floating Hamburger Button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-md bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-sm"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="flex flex-col h-full">
              {/* Navigation Sections */}
              <nav className="flex-1 px-2 py-4 overflow-y-auto">
                {navSections.map((section, index) => (
                  <div key={section.id}>
                    <MobileSidebarSection
                      section={section}
                      isActiveRoute={isActiveRoute}
                      onNavigate={() => setIsOpen(false)}
                    />
                    {index < navSections.length - 1 && section.label && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))}
              </nav>

              <Separator />

              {/* Company Switcher */}
              {userData && userData.userCompanies.length > 1 && (
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
                  isCollapsed={false}
                  userAvatar={user?.user.avatarUrl}
                  userName={user?.user.displayName}
                  userUsername={user?.user.whopUsername}
                />
              </div>
            </div>
          </SheetContent>
      </Sheet>
    </div>
  );
}
