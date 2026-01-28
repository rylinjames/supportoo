"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Doc } from "@/convex/_generated/dataModel";

type Plan = Doc<"plans">;

interface PlanCardProps {
  plan: Plan;
  isCurrent: boolean;
  isPopular?: boolean;
  currentPlan: Plan;
  scheduledPlanChangeAt?: number;
  onAction: (planName: string) => void;
}

export function PlanCard({
  plan,
  isCurrent,
  isPopular,
  currentPlan,
  scheduledPlanChangeAt,
  onAction,
}: PlanCardProps) {
  const planName =
    plan.displayName || plan.name.charAt(0).toUpperCase() + plan.name.slice(1) + " Plan";
  const priceInDollars = (plan.price / 100).toFixed(0);

  // Define features for each plan
  const getFeatures = (planName: string) => {
    switch (planName) {
      case "free":
        return ["100 AI responses/month", "Basic AI model", "Email support"];
      case "pro":
        return [
          "Everything in Free Plan",
          "5,000 AI responses/month",
          "Advanced AI model",
          "Unlimited templates",
          "Insights & analytics",
          "Priority support",
        ];
      case "elite":
        return [
          "Everything in Pro Plan",
          "25,000 AI responses/month",
          "Premium AI model",
          "File attachments",
          "Custom handoff triggers",
        ];
      default:
        return [];
    }
  };

  const features = getFeatures(plan.name);

  const getButtonText = () => {
    if (isCurrent) {
      // Check if plan is scheduled for cancellation
      if (scheduledPlanChangeAt) {
        const now = Date.now();
        const daysUntilCancel = Math.ceil(
          (scheduledPlanChangeAt - now) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilCancel <= 0) {
          return "Current Plan"; // Fallback if date has passed
        } else if (daysUntilCancel === 1) {
          return "Cancels in 1 day";
        } else {
          return `Cancels in ${daysUntilCancel} days`;
        }
      }

      return "Current Plan";
    }

    // Compare prices: upgrade if target > current, downgrade if target < current
    if (plan.price < currentPlan.price) return "Downgrade";
    return `Get ${planName.replace(" Plan", "")}`;
  };

  const getButtonVariant = () => {
    if (isCurrent) return "outline";
    // Downgrade = outline, Upgrade = default (cyan)
    if (plan.price < currentPlan.price) return "outline";
    return "default";
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Plan Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-body-sm text-foreground font-medium">
            {planName}
          </h3>
          {isPopular && (
            <span className="text-body-sm text-primary">Popular</span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-h1 text-foreground">${priceInDollars}</span>
          <span className="text-body-sm text-muted-foreground">/ month</span>
        </div>
      </div>

      {/* CTA Button */}
      <Button
        onClick={() => onAction(plan.name)}
        size="sm"
        variant={getButtonVariant()}
        disabled={isCurrent}
        className="w-full mb-6"
      >
        {getButtonText()}
      </Button>

      {/* Features List - Only included features */}
      <ul className="space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-body-sm text-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
