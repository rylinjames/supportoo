"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/app/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TemplatesTab } from "./templates-tab";
import { TeamTab } from "./team-tab";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "templates" | "team";

const TABS: { id: TabId; label: string }[] = [
  { id: "templates", label: "Templates" },
  { id: "team", label: "Team" },
];

export function WorkspaceView() {
  const { userData } = useUser();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);

  // Read tab from URL query params
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam === "team" ? "team" : "templates"
  );

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "team") setActiveTab("team");
    else setActiveTab("templates");
  }, [searchParams]);

  // Query fullConfig to determine when data is ready
  const fullConfig = useQuery(
    api.companies.queries.getFullCompanyConfig,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  // Update loading state when data loads
  useEffect(() => {
    if (fullConfig) {
      setIsLoading(false);
    } else if (userData?.currentCompanyId) {
      setIsLoading(true);
    }
  }, [fullConfig, userData?.currentCompanyId]);

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header with Frosted Glass */}
      <div className="sticky top-0 z-10 frosted-glass border-b border-border">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-h2 text-foreground">Workspace</h1>
              <p className="text-body-sm text-muted-foreground">
                Configure your AI assistant with company knowledge
              </p>
            </div>
          </div>
        </div>

        {/* Pill-style Tabs */}
        <div className="px-6 pb-4">
          <div className="inline-flex p-1 rounded-lg bg-secondary gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-8">
            {/* Header skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
            {/* Content skeleton */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-secondary/50 border-b border-border">
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
            {/* Form skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </div>
        ) : activeTab === "templates" ? (
          <TemplatesTab
            companyId={userData!.currentCompanyId as Id<"companies">}
          />
        ) : (
          <TeamTab />
        )}
      </div>
    </div>
  );
}
