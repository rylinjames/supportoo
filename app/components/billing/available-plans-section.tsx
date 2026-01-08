"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { PlanCard } from "./plan-card";
import { useUser } from "@/app/contexts/user-context";
import { useWhopPayments } from "@/app/contexts/whop-payments-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Id, Doc } from "@/convex/_generated/dataModel";

type Plan = Doc<"plans">;

interface AvailablePlansSectionProps {
  allPlans: Plan[]; // Array of Plan types
  currentPlan: Plan; // Current plan
  companyId: string;
  scheduledPlanChangeAt?: number;
}

export function AvailablePlansSection({
  allPlans,
  currentPlan,
  companyId,
  scheduledPlanChangeAt,
}: AvailablePlansSectionProps) {
  const router = useRouter();
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { userData } = useUser();
  const { chargeUserWithModal, isLoaded } = useWhopPayments();
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showMidTierDowngradeDialog, setShowMidTierDowngradeDialog] =
    useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState<{
    targetPlanName: string;
    targetPlan: Plan;
  } | null>(null);
  const [pendingMidTierDowngrade, setPendingMidTierDowngrade] = useState<{
    targetPlanName: string;
    targetPlan: Plan;
  } | null>(null);
  const createCheckoutSession = useAction(
    api.billing.actions.createCheckoutSession
  );
  const cancelMembership = useAction(api.billing.actions.cancelMembership);

  const handlePlanChange = async (targetPlanName: string) => {
    try {
      // Scenario 1: Downgrade to Free
      if (targetPlanName === "free") {
        setShowDowngradeDialog(true); // Already shows dialog ✓
        return;
      }

      const targetPlan = allPlans.find((p) => p.name === targetPlanName);
      if (!targetPlan) {
        toast.error("Plan not found");
        return;
      }

      // Scenario 2: Mid-tier downgrade (Elite→Pro)
      if (targetPlan.price < currentPlan.price) {
        setPendingMidTierDowngrade({ targetPlanName, targetPlan });
        setShowMidTierDowngradeDialog(true); // NEW: Show dialog
        return;
      }

      // Scenario 3: Upgrade (Pro→Elite)
      if (targetPlan.price > currentPlan.price) {
        setPendingUpgrade({ targetPlanName, targetPlan });
        setShowUpgradeDialog(true); // NEW: Show dialog
        return;
      }
    } catch (error) {
      console.error("Error changing plan:", error);
      toast.error("Failed to process plan change. Please try again.");
    }
  };

  const handleDowngrade = async () => {
    try {
      if (!userData?.user.whopUserId) {
        toast.error("User information not found");
        setShowDowngradeDialog(false);
        return;
      }

      // Call backend to cancel Whop membership
      const result = await cancelMembership({
        companyId: companyId as Id<"companies">,
        whopUserId: userData.user.whopUserId,
      });

      toast.success(result.message);
      setShowDowngradeDialog(false);
    } catch (error) {
      console.error("Error downgrading plan:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to downgrade plan. Please try again."
      );
    }
  };

  // Shared function for plan changes (upgrade/downgrade)
  const processPlanChange = async (
    targetPlanName: string,
    successMessage: string,
    onComplete: () => void
  ) => {
    try {
      if (!userData?.user.whopUserId) {
        toast.error("User information not found");
        onComplete();
        return;
      }

      // Step 1: Cancel current membership
      toast.info("Canceling current membership...");

      const cancelResult = await cancelMembership({
        companyId: companyId as Id<"companies">,
        whopUserId: userData.user.whopUserId,
      });

      console.log("Membership cancelled:", cancelResult);

      // Step 2: Create checkout session for new plan
      toast.info("Opening checkout for new plan...");

      const sessionData = await createCheckoutSession({
        companyId: companyId as Id<"companies">,
        targetPlanName: targetPlanName as "pro" | "elite",
        whopUserId: userData.user.whopUserId,
        experienceId: experienceId,
        allowDowngrade: true,
      });

      if (!isLoaded) {
        toast.error("Payment system not ready. Please refresh and try again.");
        onComplete();
        return;
      }

      // Step 3: Open Whop modal
      const result = await chargeUserWithModal({
        planId: sessionData.planId,
        sessionId: sessionData.checkoutSessionId,
        status: "pending",
        amount: sessionData.planPrice,
        title: sessionData.planTitle,
      });

      if (result.success) {
        toast.success(successMessage);
      } else {
        toast.error(result.error || "Payment failed");
      }

      onComplete();
    } catch (error) {
      console.error("Error processing plan change:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to process plan change. Please try again."
      );
      onComplete();
    }
  };

  const handleUpgradeConfirm = async () => {
    if (!pendingUpgrade) {
      setShowUpgradeDialog(false);
      return;
    }

    await processPlanChange(
      pendingUpgrade.targetPlanName,
      "Payment successful! Plan upgraded.",
      () => {
        setShowUpgradeDialog(false);
        setPendingUpgrade(null);
      }
    );
  };

  const handleMidTierDowngradeConfirm = async () => {
    if (!pendingMidTierDowngrade) {
      setShowMidTierDowngradeDialog(false);
      return;
    }

    await processPlanChange(
      pendingMidTierDowngrade.targetPlanName,
      "Payment successful! Plan changed.",
      () => {
        setShowMidTierDowngradeDialog(false);
        setPendingMidTierDowngrade(null);
      }
    );
  };

  // Sort plans: Free, Pro, Elite
  const sortedPlans = allPlans.sort((a, b) => {
    const order: { [key: string]: number } = { free: 0, pro: 1, elite: 2 };
    return order[a.name] - order[b.name];
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-h3 text-foreground">Available Plans</h2>
        <p className="text-muted-foreground mt-1">
          Choose the plan that best fits your needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sortedPlans.map((plan) => (
          <PlanCard
            key={plan._id}
            plan={plan}
            isCurrent={plan._id === currentPlan._id}
            isPopular={plan.name === "pro"}
            currentPlan={currentPlan}
            scheduledPlanChangeAt={scheduledPlanChangeAt}
            onAction={handlePlanChange}
          />
        ))}
      </div>

      {/* Downgrade Confirmation Dialog */}
      <AlertDialog
        open={showDowngradeDialog}
        onOpenChange={setShowDowngradeDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Downgrade to Free Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to downgrade to the Free plan? Your
              subscription will be cancelled and you'll be downgraded at the end
              of your current billing period. You'll keep access to premium
              features until then. You'll lose access to:
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Advanced AI models</li>
                <li>Unlimited templates</li>
                <li>Insights & analytics</li>
                <li>Priority support</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDowngrade}>
              Downgrade to Free
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Confirmation Dialog */}
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Upgrade to{" "}
              {pendingUpgrade?.targetPlanName.charAt(0).toUpperCase()}
              {pendingUpgrade?.targetPlanName.slice(1)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your current {currentPlan.name.charAt(0).toUpperCase()}
              {currentPlan.name.slice(1)} plan will be cancelled at the end of
              your billing cycle. You'll retain all benefits until then. The new
              plan will start immediately after payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowUpgradeDialog(false);
                setPendingUpgrade(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUpgradeConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mid-Tier Downgrade Confirmation Dialog */}
      <AlertDialog
        open={showMidTierDowngradeDialog}
        onOpenChange={setShowMidTierDowngradeDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Downgrade to{" "}
              {pendingMidTierDowngrade?.targetPlanName.charAt(0).toUpperCase()}
              {pendingMidTierDowngrade?.targetPlanName.slice(1)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your current {currentPlan.name.charAt(0).toUpperCase()}
              {currentPlan.name.slice(1)} plan will be cancelled at the end of
              your billing cycle. You'll retain all benefits until then. The new
              plan will start immediately after payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowMidTierDowngradeDialog(false);
                setPendingMidTierDowngrade(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMidTierDowngradeConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
