"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/app/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CompanyContextTab } from "@/app/components/workspace/company-context-tab";
import { TemplatesTab } from "./templates-tab";
import { TeamTab } from "./team-tab";

export function WorkspaceView() {
  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState<"context" | "templates" | "team">(
    "context"
  );
  const [isLoading, setIsLoading] = useState(true);

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
      {/* Page Header - Clean & Flat */}
      <div className="sticky top-0 z-10 bg-background">
        <div className="p-4">
          <h1 className="text-h2 text-foreground">Workspace</h1>
          <p className="text-muted-foreground mt-1">
            Manage company information and quick reply templates
          </p>
        </div>

        {/* Tabs Navigation - Full width border */}
        <div className="border-b border-border px-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("context")}
              className={`px-3 py-2 transition-colors relative ${
                activeTab === "context"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Company Context
              {activeTab === "context" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`px-3 py-2 transition-colors relative ${
                activeTab === "templates"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Templates
              {activeTab === "templates" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`px-3 py-2 transition-colors relative ${
                activeTab === "team"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Team
              {activeTab === "team" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-12">
            <div className="space-y-6">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-96" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-96" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        ) : activeTab === "context" ? (
          <CompanyContextTab fullConfig={fullConfig} />
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
