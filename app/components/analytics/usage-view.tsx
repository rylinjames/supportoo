"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@/app/contexts/user-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Calendar, TrendingUp, Zap } from "lucide-react";

export function UsageView() {
  const { userData } = useUser();

  // Fetch current usage data
  const usageData = useQuery(
    api.usage.queries.getCurrentUsage,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  // Get usage status
  const getUsageStatus = (percentageUsed: number) => {
    if (percentageUsed > 80) return { status: "critical", color: "text-red-500", bg: "bg-red-500" };
    if (percentageUsed > 50) return { status: "warning", color: "text-yellow-500", bg: "bg-yellow-500" };
    return { status: "healthy", color: "text-primary", bg: "bg-primary" };
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isLoading = !usageData && userData?.currentCompanyId;

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto pb-20 lg:pb-0">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="p-4 space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Unable to load usage data</p>
      </div>
    );
  }

  const { status, color, bg } = getUsageStatus(usageData.percentageUsed);

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <div>
          <h1 className="text-h2 font-semibold text-foreground">Usage</h1>
          <p className="text-muted-foreground mt-1">
            Track your AI response usage and credits
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Main Usage Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  AI Responses
                </CardTitle>
                <CardDescription>
                  Current billing cycle usage
                </CardDescription>
              </div>
              <Badge variant={status === "healthy" ? "default" : status === "warning" ? "secondary" : "destructive"}>
                {usageData.plan}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Usage Display */}
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">
                  {usageData.currentUsage.toLocaleString()}
                </span>
                <span className="text-xl text-muted-foreground">
                  / {usageData.totalLimit.toLocaleString()}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress
                  value={Math.min(usageData.percentageUsed, 100)}
                  className="h-3"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-medium ${color}`}>
                    {usageData.remaining.toLocaleString()} credits remaining
                  </span>
                  <span className="text-muted-foreground">
                    {usageData.percentageUsed}% used
                  </span>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className={`p-3 rounded-lg ${
              status === "healthy" ? "bg-primary/10" :
              status === "warning" ? "bg-yellow-500/10" :
              "bg-red-500/10"
            }`}>
              <p className={`text-sm ${color}`}>
                {status === "healthy" && "You're on track with your usage this month."}
                {status === "warning" && "You're using responses quickly. Consider your usage pace."}
                {status === "critical" && "You're running low on responses. Consider upgrading your plan."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Billing Period */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billing Period</p>
                  <p className="font-medium text-foreground">
                    {formatDate(usageData.billingCycleStart)} - {formatDate(usageData.billingCycleEnd)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Days Until Reset */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resets In</p>
                  <p className="font-medium text-foreground">
                    {usageData.daysUntilReset} day{usageData.daysUntilReset !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Daily */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Daily Average</p>
                  <p className="font-medium text-foreground">
                    {usageData.daysUntilReset > 0
                      ? Math.round(usageData.currentUsage / (30 - usageData.daysUntilReset) || 0)
                      : usageData.currentUsage
                    } responses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Information */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Current Plan</span>
                <span className="font-medium">{usageData.plan}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Monthly Limit</span>
                <span className="font-medium">{usageData.totalLimit.toLocaleString()} responses</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Used This Month</span>
                <span className="font-medium">{usageData.currentUsage.toLocaleString()} responses</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
