export interface UsageData {
  plan: string;
  totalLimit: number;
  currentUsage: number;
  remaining: number;
  percentageUsed: number;
  billingCycleStart: number;
  billingCycleEnd: number;
  daysUntilReset: number;
}

export interface ChartDataPoint {
  date: string;
  responses: number;
  label: string; // Human-readable label for tooltip
}

export type TimePeriod = "3days" | "week" | "month" | "3months";

export interface PeriodStats {
  total: number;
  average: number;
  peak: number;
  peakDate: string;
}

export type UsageStatus = "healthy" | "warning" | "critical";

export function getUsageStatus(percentageUsed: number): UsageStatus {
  if (percentageUsed > 80) return "critical"; // < 20% remaining
  if (percentageUsed > 50) return "warning"; // 20-50% remaining
  return "healthy"; // > 50% remaining
}

export function getStatusColor(status: UsageStatus): string {
  switch (status) {
    case "healthy":
      return "text-primary";
    case "warning":
      return "text-warning";
    case "critical":
      return "text-destructive";
  }
}

export function getStatusMessage(status: UsageStatus): string {
  switch (status) {
    case "healthy":
      return "You're on track";
    case "warning":
      return "You're using responses quickly";
    case "critical":
      return "You're running low on responses";
  }
}
