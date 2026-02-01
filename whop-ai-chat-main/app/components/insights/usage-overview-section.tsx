import {
  UsageData,
  getUsageStatus,
  getStatusColor,
  getStatusMessage,
} from "./types";

interface UsageOverviewSectionProps {
  data: UsageData;
}

export function UsageOverviewSection({ data }: UsageOverviewSectionProps) {
  const status = getUsageStatus(data.percentageUsed);
  const statusColor = getStatusColor(status);
  const statusMessage = getStatusMessage(status);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-h3 text-foreground">Usage Overview</h2>
        <p className="text-body-sm text-muted-foreground mt-1">
          Track your AI response usage for the current billing cycle
        </p>
      </div>

      {/* Billing Cycle Info */}
      <div className="flex items-center gap-2 text-body-sm text-muted-foreground mb-4">
        <span>
          Current billing cycle: {formatDate(data.billingCycleStart)} -{" "}
          {formatDate(data.billingCycleEnd)}
        </span>
        <span>•</span>
        <span>Resets in {data.daysUntilReset} days</span>
      </div>

      {/* Usage Card */}
      <div className="space-y-4">
        <div>
          <p className="text-body-sm text-muted-foreground mb-2">
            AI Responses
          </p>

          {/* Main Numbers */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-display-md text-foreground font-semibold">
              {data.currentUsage.toLocaleString()}
            </span>
            <span className="text-h3 text-muted-foreground">/</span>
            <span className="text-h3 text-muted-foreground">
              {data.totalLimit.toLocaleString()}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(data.percentageUsed, 100)}%` }}
              />
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between">
              <span className={`text-body-sm font-medium ${statusColor}`}>
                {data.remaining.toLocaleString()} remaining
              </span>
              <span className="text-body-sm text-muted-foreground">
                {data.percentageUsed}%
              </span>
            </div>
          </div>
        </div>

        {/* Plan Info & Status */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-body-sm text-muted-foreground">
            {data.plan}
          </span>
          <span className={`text-body-sm ${statusColor}`}>{statusMessage}</span>
        </div>
      </div>
    </div>
  );
}
