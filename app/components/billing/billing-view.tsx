"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrentSubscriptionSection } from "@/app/components/billing/current-subscription-section";
import { AvailablePlansSection } from "@/app/components/billing/available-plans-section";
import { PaymentHistorySection } from "@/app/components/billing/payment-history-section";
import { Id } from "@/convex/_generated/dataModel";

interface BillingViewProps {
  experienceId: string;
}

export function BillingView({ experienceId }: BillingViewProps) {
  const { userData } = useUser();

  // Fetch all required data
  const fullConfig = useQuery(
    api.companies.queries.getFullCompanyConfig,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  const allPlans = useQuery(api.plans.queries.getAllPlans);

  const billingHistory = useQuery(
    api.billing.queries.getBillingHistory,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  // Loading state
  const isLoading = !fullConfig || !allPlans || billingHistory === undefined;

  return (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0 text-body-sm">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <h1 className="text-h2 text-foreground">Billing</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-12">
            {/* Current subscription skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            {/* Available plans skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((j) => (
                        <Skeleton key={j} className="h-4 w-full" />
                      ))}
                    </div>
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Payment history skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        ) : !fullConfig || !allPlans ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Failed to load billing data</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Current Subscription */}
            <CurrentSubscriptionSection fullConfig={fullConfig} />

            {/* Available Plans */}
            <AvailablePlansSection
              allPlans={allPlans}
              currentPlan={
                allPlans.find((plan: any) => plan.name === fullConfig.plan.name)!
              }
              companyId={fullConfig.companyId}
              scheduledPlanChangeAt={fullConfig.scheduledPlanChangeAt}
            />

            {/* Payment History */}
            <PaymentHistorySection billingHistory={billingHistory || []} />
          </div>
        )}
      </div>
    </div>
  );
}
