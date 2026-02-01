"use client";

import { Progress } from "@/components/ui/progress";

interface CurrentSubscriptionSectionProps {
  fullConfig: any; // Type from getFullCompanyConfig query
}

export function CurrentSubscriptionSection({
  fullConfig,
}: CurrentSubscriptionSectionProps) {
  const { plan } = fullConfig;

  // Calculate usage percentage
  const percentageUsed = Math.min(
    (fullConfig.aiResponsesThisMonth / plan.aiResponsesPerMonth) * 100,
    100
  );

  // Calculate remaining responses
  const remaining = Math.max(
    plan.aiResponsesPerMonth - fullConfig.aiResponsesThisMonth,
    0
  );

  // Format next billing date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate days until reset (handle negative days)
  const now = Date.now();
  const daysUntilReset = Math.max(
    Math.ceil((fullConfig.aiResponsesResetAt - now) / (1000 * 60 * 60 * 24)),
    0
  );

  // Format plan name
  const planName =
    plan.name.charAt(0).toUpperCase() + plan.name.slice(1) + " Plan";

  // Format price
  const priceInDollars = (plan.price / 100).toFixed(0);

  return (
    <div>
      <h2 className="text-h3 text-foreground mb-6">
        Your active subscription and usage
      </h2>

      <div className="space-y-6">
        {/* Plan Details */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {planName}
            </h3>
            <p className="text-muted-foreground">
              ${priceInDollars}/month • Billed monthly
            </p>
          </div>
        </div>

        {/* AI Responses Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-label text-foreground">
              AI Responses Usage
            </span>
            <span className="text-label text-muted-foreground">
              {fullConfig.aiResponsesThisMonth.toLocaleString()} /{" "}
              {plan.aiResponsesPerMonth.toLocaleString()}
            </span>
          </div>

          <Progress value={percentageUsed} className="h-2" />

          <div className="flex items-center justify-between">
            <span className="text-label text-muted-foreground">
              {remaining.toLocaleString()} remaining •{" "}
              {percentageUsed.toFixed(1)}% used
            </span>
          </div>
        </div>

        {/* Billing Cycle Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-label text-muted-foreground">
          <div>
            <span>Next billing date: </span>
            <span className="text-foreground">
              {formatDate(fullConfig.currentPeriodEnd)}
            </span>
          </div>
          <div>
            <span>Usage resets in: </span>
            <span className="text-foreground">{daysUntilReset} days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
