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

type TabId = "templates" | "team";

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

  // Get page title and description based on active tab
  const getPageInfo = () => {
    if (activeTab === "team") {
      return {
        title: "Team",
        description: "Manage your support team members",
      };
    }
    return {
      title: "Templates",
      description: "Create quick reply templates to speed up your support responses",
    };
  };

  const pageInfo = getPageInfo();

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="p-4">
          <h1 className="text-h2 font-semibold text-foreground">
            {pageInfo.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {pageInfo.description}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
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
