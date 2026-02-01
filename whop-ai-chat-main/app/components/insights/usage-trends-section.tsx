import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2 } from "lucide-react";
import { TimePeriod, ChartDataPoint, PeriodStats } from "./types";

interface UsageTrendsSectionProps {
  data: ChartDataPoint[];
  stats: PeriodStats;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  isEmpty?: boolean;
  isRefetching?: boolean;
}

const periodLabels: Record<TimePeriod, string> = {
  "3days": "3 Days",
  week: "Week",
  month: "Month",
  "3months": "3 Months",
};

export function UsageTrendsSection({
  data,
  stats,
  period,
  onPeriodChange,
  isEmpty = false,
  isRefetching = false,
}: UsageTrendsSectionProps) {
  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-h3 text-foreground">Usage Trends</h2>
        <p className="text-body-sm text-muted-foreground mt-1">
          View AI response usage over time
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-1 mb-6">
        {(Object.keys(periodLabels) as TimePeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1.5 text-body-sm rounded-md transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Chart or Empty State */}
      {isEmpty ? (
        <div className="border border-border rounded-lg p-12 text-center">
          <div className="max-w-sm mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <svg
                className="w-8 h-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-body-sm text-foreground font-medium mb-1">
              No usage data yet
            </h3>
            <p className="text-body-sm text-muted-foreground">
              Data will appear once your AI starts responding to customers
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="border border-border rounded-lg p-4 bg-card relative">
            {isRefetching && (
              <div className="absolute top-4 right-4 z-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={data}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "Time Period",
                    position: "insideBottom",
                    offset: -5,
                    style: {
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                    },
                  }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "AI Responses",
                    angle: -90,
                    position: "insideLeft",
                    style: {
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                      textAnchor: "middle",
                    },
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0)
                      return null;
                    return (
                      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
                        <p className="text-body-sm text-foreground font-medium">
                          {payload[0].value} responses
                        </p>
                        <p className="text-body-sm text-muted-foreground">
                          {payload[0].payload.label}
                        </p>
                      </div>
                    );
                  }}
                  cursor={{ stroke: "#06b6d4", strokeWidth: 1 }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="line"
                  wrapperStyle={{
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                  formatter={() => "AI Responses"}
                />
                <Line
                  type="monotone"
                  dataKey="responses"
                  name="AI Responses"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--primary)", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Period Stats */}
          <div className="mt-4 space-y-1">
            <p className="text-body-sm text-foreground">
              <span className="text-muted-foreground">
                Past {periodLabels[period]}:
              </span>{" "}
              <span className="font-medium">
                {stats.total.toLocaleString()} responses
              </span>
            </p>
            <p className="text-body-sm text-muted-foreground">
              Avg: {stats.average.toLocaleString()} responses/day • Peak:{" "}
              {stats.peak.toLocaleString()} ({stats.peakDate})
            </p>
          </div>
        </>
      )}
    </div>
  );
}
