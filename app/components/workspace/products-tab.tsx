"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw, Package, Clock, EyeOff, Loader2, Bot } from "lucide-react";
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

  // Query products with filter based on toggle state
  const products = useQuery(
    api.products.queries.getCompanyProducts,
    {
      companyId,
      includeHidden: showHiddenProducts,
      includeInactive: showHiddenProducts,
    }
  );

  // Also query all products to get counts for hidden/inactive
  const allProducts = useQuery(
    api.products.queries.getCompanyProducts,
    { companyId, includeHidden: true, includeInactive: true }
  );

  // Query plans for all products
  const plans = useQuery(
    api.whopPlans.queries.getCompanyPlans,
    { companyId, includeHidden: showHiddenProducts }
  );

  // Group plans by whopProductId for easy lookup
  const plansByProduct = plans?.reduce((acc: Record<string, any[]>, plan: any) => {
    if (!acc[plan.whopProductId]) {
      acc[plan.whopProductId] = [];
    }
    acc[plan.whopProductId].push(plan);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // Calculate hidden product counts
  const hiddenCount = allProducts
    ? allProducts.filter(p => !p.isVisible || !p.isActive).length
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

  const handleToggleAI = async (productId: Id<"products">, currentValue: boolean) => {
    try {
      await toggleAIInclusion({ productId, includeInAI: !currentValue });
      toast.success(!currentValue ? "Product will be used by AI" : "Product hidden from AI");
    } catch (error) {
      console.error("Failed to toggle AI inclusion:", error);
      toast.error("Failed to update product");
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
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

                {/* Pricing chips */}
                {productPlans.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {productPlans.slice(0, 3).map((plan: any) => (
                      <span
                        key={plan._id}
                        className="px-2 py-1 rounded-md bg-secondary text-xs"
                      >
                        {plan.initialPrice
                          ? formatPrice(plan.initialPrice, plan.currency)
                          : "Free"}
                        {plan.planType === "renewal" && plan.billingPeriod && (
                          <span className="text-muted-foreground">
                            /{plan.billingPeriod === 30 || plan.billingPeriod === 31
                              ? "mo"
                              : plan.billingPeriod === 365 || plan.billingPeriod === 366
                              ? "yr"
                              : plan.billingPeriod === 7
                              ? "wk"
                              : `${plan.billingPeriod}d`}
                          </span>
                        )}
                        {plan.planType === "one_time" && (
                          <span className="text-muted-foreground"> once</span>
                        )}
                      </span>
                    ))}
                    {productPlans.length > 3 && (
                      <span className="px-2 py-1 rounded-md bg-secondary text-xs text-muted-foreground">
                        +{productPlans.length - 3} more
                      </span>
                    )}
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
