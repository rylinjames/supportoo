"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Package, Clock, EyeOff, Loader2, Bot, AlertTriangle, Tag } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface ProductsTabProps {
  companyId: Id<"companies">;
}

export function ProductsTab({ companyId }: ProductsTabProps) {
  const { userToken } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingPlans, setIsSyncingPlans] = useState(false);
  const [showHiddenProducts, setShowHiddenProducts] = useState(false);

  // Always fetch all products (including hidden) so we can auto-show hidden ones with paid plans
  const allProducts = useQuery(
    api.products.queries.getCompanyProducts,
    { companyId, includeHidden: true, includeInactive: true }
  );

  // Query plans for all products — always include hidden since pricing plans are often hidden
  const plans = useQuery(
    api.whopPlans.queries.getCompanyPlans,
    { companyId, includeHidden: true }
  );

  // Group plans by whopProductId for easy lookup
  const plansByProduct = plans?.reduce((acc: Record<string, any[]>, plan: any) => {
    if (!acc[plan.whopProductId]) {
      acc[plan.whopProductId] = [];
    }
    acc[plan.whopProductId].push(plan);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // Check if a product has at least one paid plan
  const hasPaidPlan = (whopProductId: string) => {
    const productPlans = plansByProduct[whopProductId] || [];
    return productPlans.some((p: any) =>
      (p.initialPrice && p.initialPrice > 0) || (p.renewalPrice && p.renewalPrice > 0)
    );
  };

  // Filter products: always show visible + hidden-with-paid-plans; toggle controls the rest
  const products = allProducts?.filter(p => {
    if (p.isVisible && p.isActive) return true;
    if (hasPaidPlan(p.whopProductId)) return true; // Always show if has paid plans
    return showHiddenProducts; // Toggle controls free-only hidden products
  });

  // Count hidden products that are ONLY shown via toggle (not auto-shown)
  const hiddenCount = allProducts
    ? allProducts.filter(p => (!p.isVisible || !p.isActive) && !hasPaidPlan(p.whopProductId)).length
    : 0;

  // Get last sync time from most recently synced product
  const lastSyncTime = products?.length
    ? Math.max(...products.map((p: any) => p.lastSyncedAt))
    : null;

  // Actions
  const syncProducts = useAction(api.products.actions.syncProducts);
  const syncPlans = useAction(api.whopPlans.actions.syncPlans);

  // Mutations
  const toggleAIInclusion = useMutation(api.products.mutations.toggleProductAIInclusion);
  const assignPlanTier = useMutation(api.whopPlans.mutations.assignPlanTier);

  // Check tier coverage - which tiers have active plans assigned
  const tierCoverage = {
    pro: plans?.some((p: any) => p.planTier === "pro" && p.isVisible) || false,
    elite: plans?.some((p: any) => p.planTier === "elite" && p.isVisible) || false,
  };
  const hasUnassignedTiers = !tierCoverage.pro || !tierCoverage.elite;

  const handleToggleAI = async (productId: Id<"products">, currentValue: boolean) => {
    try {
      await toggleAIInclusion({ productId, includeInAI: !currentValue });
      toast.success(!currentValue ? "Product will be used by AI" : "Product hidden from AI");
    } catch (error) {
      console.error("Failed to toggle AI inclusion:", error);
      toast.error("Failed to update product");
    }
  };

  const handleAssignTier = async (whopPlanId: Id<"whopPlans">, tier: string | null) => {
    try {
      await assignPlanTier({
        whopPlanId,
        planTier: tier === "none" ? undefined : (tier as "pro" | "elite"),
      });
      toast.success(tier === "none" ? "Tier removed" : `Assigned to ${tier} tier`);
    } catch (error) {
      console.error("Failed to assign tier:", error);
      toast.error("Failed to assign tier");
    }
  };

  const handleSyncProducts = async () => {
    if (isSyncing) return;

    setIsSyncing(true);

    try {
      const result = await syncProducts({ companyId, userToken });

      if (result.success) {
        toast.success(
          `Successfully synced ${result.syncedCount} products` +
          (result.deletedCount > 0 ? ` (removed ${result.deletedCount} outdated)` : "")
        );

        // Also sync plans after products
        setIsSyncingPlans(true);
        try {
          const planResult = await syncPlans({ companyId });
          if (planResult.success) {
            toast.success(`Synced ${planResult.syncedCount} pricing plans`);
          } else {
            toast.error("Failed to sync plans: " + (planResult.errors?.[0] || "Unknown error"));
          }
        } catch (planError) {
          console.error("Plan sync failed:", planError);
          toast.error(`Plan sync failed: ${planError instanceof Error ? planError.message : "Unknown error"}`);
        } finally {
          setIsSyncingPlans(false);
        }
      } else {
        toast.error("Failed to sync products: " + (result.errors?.[0] || "Unknown error"));
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error(`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatPrice = (price: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price / 100);
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getProductTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      membership: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      digital_product: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      course: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      community: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      software: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      other: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    };
    return colors[type] || colors.other;
  };

  const isLoading = products === undefined;

  return (
    <div className="space-y-6">
      {/* Sync Controls */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-background">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Product Sync</p>
            <p className="text-sm text-muted-foreground">
              {lastSyncTime
                ? `Last synced ${formatRelativeTime(lastSyncTime)}`
                : "Never synced"}
            </p>
          </div>
        </div>
        <Button onClick={handleSyncProducts} disabled={isSyncing || isSyncingPlans} size="sm">
          {isSyncing || isSyncingPlans ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isSyncing ? "Syncing..." : "Syncing Plans..."}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      {/* Tier Coverage Warning */}
      {hasUnassignedTiers && plans && plans.length > 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Subscription Tiers Not Configured
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Users cannot upgrade until you assign Whop plans to subscription tiers.
                {!tierCoverage.pro && !tierCoverage.elite && " Both Pro and Elite tiers need a plan."}
                {!tierCoverage.pro && tierCoverage.elite && " The Pro tier needs a plan assigned."}
                {tierCoverage.pro && !tierCoverage.elite && " The Elite tier needs a plan assigned."}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant={tierCoverage.pro ? "default" : "outline"} className={cn(
                  "text-xs",
                  tierCoverage.pro
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "border-yellow-400 text-yellow-700 dark:text-yellow-300"
                )}>
                  Pro: {tierCoverage.pro ? "✓ Configured" : "⚠ Needs Plan"}
                </Badge>
                <Badge variant={tierCoverage.elite ? "default" : "outline"} className={cn(
                  "text-xs",
                  tierCoverage.elite
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "border-yellow-400 text-yellow-700 dark:text-yellow-300"
                )}>
                  Elite: {tierCoverage.elite ? "✓ Configured" : "⚠ Needs Plan"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {products?.length || 0} products
            </span>
          </div>
          {hiddenCount > 0 && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-hidden"
                checked={showHiddenProducts}
                onCheckedChange={setShowHiddenProducts}
              />
              <Label htmlFor="show-hidden" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <EyeOff className="h-3 w-3" />
                Show {hiddenCount} hidden
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="flex gap-2 mb-3">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-6 rounded-full bg-secondary/50 mb-6">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No products synced</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Sync your Whop products so the AI can help customers with accurate product information
          </p>
          <Button onClick={handleSyncProducts} disabled={isSyncing} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Products Now
          </Button>
        </div>
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product: any) => {
            const productPlans = plansByProduct[product.whopProductId] || [];
            // Default to true if includeInAI is not set
            const isIncludedInAI = product.includeInAI !== false;

            return (
              <div
                key={product._id}
                className={cn(
                  "p-4 rounded-lg border border-border bg-card",
                  (!product.isVisible || !product.isActive) && "opacity-60"
                )}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{product.title}</h4>
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <Badge className={cn("text-xs shrink-0", getProductTypeColor(product.productType))}>
                    {product.productType.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Pricing & Tier Assignment */}
                {productPlans.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {productPlans.map((plan: any) => (
                      <div
                        key={plan._id}
                        className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {plan.title || "Unnamed Plan"}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {plan.initialPrice
                              ? formatPrice(plan.initialPrice, plan.currency)
                              : plan.renewalPrice
                              ? formatPrice(plan.renewalPrice, plan.currency)
                              : "Free"}
                            {plan.planType === "renewal" && plan.billingPeriod && (
                              <>
                                /{plan.billingPeriod === 30 || plan.billingPeriod === 31
                                  ? "mo"
                                  : plan.billingPeriod === 365 || plan.billingPeriod === 366
                                  ? "yr"
                                  : plan.billingPeriod === 7
                                  ? "wk"
                                  : `${plan.billingPeriod}d`}
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          <Select
                            value={plan.planTier || "none"}
                            onValueChange={(value) => handleAssignTier(plan._id, value)}
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue placeholder="Tier" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="elite">Elite</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Inclusion Toggle */}
                <div className="flex items-center justify-between py-2 mb-2 border-y border-border">
                  <div className="flex items-center gap-2">
                    <Bot className={cn(
                      "h-4 w-4",
                      isIncludedInAI ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-xs text-muted-foreground">
                      {isIncludedInAI ? "AI can reference this product" : "Hidden from AI"}
                    </span>
                  </div>
                  <Switch
                    checked={isIncludedInAI}
                    onCheckedChange={() => handleToggleAI(product._id, isIncludedInAI)}
                    className="scale-75"
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Synced {formatRelativeTime(product.lastSyncedAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    {!product.isVisible && (
                      <Badge variant="outline" className="text-xs py-0 px-1.5 text-orange-600 border-orange-300">
                        Hidden
                      </Badge>
                    )}
                    {!product.isActive && (
                      <Badge variant="secondary" className="text-xs py-0 px-1.5">
                        Inactive
                      </Badge>
                    )}
                    <span className={cn(
                      "flex items-center gap-1",
                      product.syncStatus === "synced" ? "text-green-600" : "text-yellow-600"
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      {product.syncStatus}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
