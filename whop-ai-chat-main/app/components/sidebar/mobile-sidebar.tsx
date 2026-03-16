"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useSearchParams, useRouter, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Eye,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  LucideIcon,
  Sparkles,
  Building2,
  ArrowRightLeft,
  Activity,
  FileText,
  Users,
  Menu,
  X,
  CreditCard,
  Settings,
  HelpCircle,
  Grid,
} from "lucide-react";
import { Separator } from "../../../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentAvailabilityStatus } from "../support/agent-availability-status";
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

interface MobileSidebarSectionProps {
  section: NavSection;
  isActiveRoute: (route: string) => boolean;
  onNavigate: (route: string) => void;
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
        {section.items.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(item.route);
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.route)}
              className={cn(
                "group relative flex items-center gap-3 w-full rounded-lg px-3 py-2.5",
                "transition-all duration-200 ease-out",
                active
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <div className="relative flex-shrink-0">
                <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[13px] truncate leading-none">{item.label}</span>
            </button>
          );
        })}
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
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { userData, getCurrentRole } = useUser();

  const currentRole = getCurrentRole();
  const effectiveUserType = currentRole || userType;
  const isAgent = effectiveUserType === "support" || effectiveUserType === "admin";
  const userName = user?.user.displayName;

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

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

  const handleNavigate = (route: string) => {
    const basePath = pathname.split("/").slice(0, 3).join("/");
    router.push(basePath + route);
    setIsOpen(false);
  };

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
        { id: "departments", icon: Building2, label: "Departments", route: "/workspace?tab=departments" },
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
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-md bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-sm"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[70] w-[280px] bg-background border-r border-border shadow-lg",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Close button */}
          <div className="flex items-center justify-end h-12 px-3">
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Sections */}
          <nav className="flex-1 px-2 overflow-y-auto">
            {navSections.map((section, index) => (
              <div key={section.id}>
                <MobileSidebarSection
                  section={section}
                  isActiveRoute={isActiveRoute}
                  onNavigate={handleNavigate}
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

          {/* Agent Availability Status */}
          {isAgent && (
            <div className="px-5 py-3">
              <AgentAvailabilityStatus />
            </div>
          )}

          {/* Profile Section at BOTTOM */}
          <div className="px-3 pb-3">
            <button
              onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              className="flex items-center gap-3 w-full rounded-md px-2 py-2 text-foreground hover:bg-muted/50 transition-colors duration-200"
            >
              {userName ? (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={user?.user.avatarUrl} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {userName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              )}
              <div className="flex-1 text-left min-w-0">
                {userName ? (
                  <>
                    <p className="text-[13px] font-medium truncate">
                      {userName.split(" ")[0]}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {user?.user.whopUsername}
                    </p>
                  </>
                ) : (
                  <>
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </>
                )}
              </div>
              {isProfileExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>

            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                isProfileExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="space-y-0.5 pt-1">
                {effectiveUserType === "admin" && (
                  <button
                    onClick={() => handleNavigate("/billing")}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 transition-all duration-200 ease-out",
                      isActiveRoute("/billing")
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <CreditCard className={cn("h-[18px] w-[18px]", isActiveRoute("/billing") && "text-primary")} />
                    <span className="text-[13px] leading-none">Billing</span>
                  </button>
                )}
                <button
                  onClick={() => handleNavigate("/settings")}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 transition-all duration-200 ease-out",
                    isActiveRoute("/settings")
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Settings className={cn("h-[18px] w-[18px]", isActiveRoute("/settings") && "text-primary")} />
                  <span className="text-[13px] leading-none">Settings</span>
                </button>
                <button
                  onClick={() => handleNavigate("/help")}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 transition-all duration-200 ease-out",
                    isActiveRoute("/help")
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <HelpCircle className={cn("h-[18px] w-[18px]", isActiveRoute("/help") && "text-primary")} />
                  <span className="text-[13px] leading-none">Help & Support</span>
                </button>
                <button
                  onClick={() => handleNavigate("/more-apps")}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 transition-all duration-200 ease-out",
                    isActiveRoute("/more-apps")
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Grid className={cn("h-[18px] w-[18px]", isActiveRoute("/more-apps") && "text-primary")} />
                  <span className="text-[13px] leading-none">More Apps</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
