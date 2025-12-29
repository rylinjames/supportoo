"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/app/contexts/user-context";
import { UsageOverviewSection } from "./usage-overview-section";
import { UsageTrendsSection } from "./usage-trends-section";
import { TimePeriod, ChartDataPoint, PeriodStats } from "./types";

export function InsightsView() {
  const { userData } = useUser();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>("3days");

  // Previous data state for smooth transitions
  const [previousTrendsData, setPreviousTrendsData] = useState<
    ChartDataPoint[] | null
  >(null);
  const [previousStatsData, setPreviousStatsData] =
    useState<PeriodStats | null>(null);

  const companyId = userData?.currentCompanyId as Id<"companies"> | undefined;

  // Fetch usage data
  const usageData = useQuery(
    api.usage.queries.getCurrentUsage,
    companyId ? { companyId } : "skip"
  );

  // Fetch trend data
  const trendsData = useQuery(
    api.usage.queries.getUsageTrends,
    companyId ? { companyId, period } : "skip"
  );

  // Fetch period stats
  const statsData = useQuery(
    api.usage.queries.getPeriodStats,
    companyId ? { companyId, period } : "skip"
  );

  // Track initial load
  useEffect(() => {
    if (usageData && !hasLoadedOnce) {
      setHasLoadedOnce(true);
      setIsInitialLoading(false);
    }
  }, [usageData, hasLoadedOnce]);

  // Update previous data when new data arrives
  useEffect(() => {
    if (trendsData && trendsData.length > 0) {
      setPreviousTrendsData(trendsData);
    }
  }, [trendsData]);

  useEffect(() => {
    if (statsData) {
      setPreviousStatsData(statsData);
    }
  }, [statsData]);

  // Separate loading states for each section
  const isUsageOverviewLoading = isInitialLoading || !usageData;

  // Use current data if available, fallback to previous
  const displayTrendsData = trendsData || previousTrendsData || [];
  const displayStatsData = statsData ||
    previousStatsData || { total: 0, average: 0, peak: 0, peakDate: "No data" };

  // Only show empty state if we've truly never had data
  const isReallyEmpty = !trendsData && !previousTrendsData;

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <h1 className="text-h2 text-foreground">Insights</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Track AI usage and plan limits
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="space-y-12">
          {/* Usage Overview */}
          {isUsageOverviewLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : usageData ? (
            <UsageOverviewSection data={usageData} />
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Unable to load usage data</p>
            </div>
          )}

          {/* Usage Trends */}
          {isInitialLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : (
            <UsageTrendsSection
              data={displayTrendsData}
              stats={displayStatsData}
              period={period}
              onPeriodChange={setPeriod}
              isEmpty={isReallyEmpty}
              isRefetching={!trendsData && previousTrendsData !== null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
