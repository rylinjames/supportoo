"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Package, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/app/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ProductsTabProps {
  companyId: Id<"companies">;
}

export function ProductsTab({ companyId }: ProductsTabProps) {
  const { userData } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  // Query products - will be enabled once API is generated
  // const products = useQuery(
  //   api.products.queries.getCompanyProducts,
  //   { companyId }
  // );

  // Temporarily use empty array until products API is available
  const products: any[] = [];

  // Actions - will be enabled once API is generated
  // const syncProducts = useAction(api.products.actions.syncProducts);
  // const testConnection = useAction(api.products.actions.testWhopConnection);

  const handleSyncProducts = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    
    try {
      // TODO: Enable when API is available
      // const result = await syncProducts({ companyId });
      
      // Simulate sync for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = {
        success: true,
        syncedCount: 0,
        deletedCount: 0,
        errors: [],
      };
      
      setLastSyncResult(result);
      
      if (result.success) {
        toast.success(
          `Successfully synced ${result.syncedCount} products` +
          (result.deletedCount > 0 ? ` (removed ${result.deletedCount} outdated)` : "")
        );
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

  const handleTestConnection = async () => {
    try {
      // TODO: Enable when API is available
      // const result = await testConnection({ companyId });
      
      // Simulate test for now
      const result = {
        success: true,
        message: "Connection test not yet available (products API not generated)",
        sampleProducts: [],
      };
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const formatPrice = (price: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProductTypeColor = (type: string) => {
    const colors = {
      membership: "bg-blue-100 text-blue-800",
      digital_product: "bg-green-100 text-green-800", 
      course: "bg-purple-100 text-purple-800",
      community: "bg-yellow-100 text-yellow-800",
      software: "bg-gray-100 text-gray-800",
      other: "bg-slate-100 text-slate-800",
    };
    return colors[type as keyof typeof colors] || colors.other;
  };

  const getSyncStatusColor = (status: string) => {
    const colors = {
      synced: "text-green-600",
      error: "text-red-600",
      outdated: "text-yellow-600",
    };
    return colors[status as keyof typeof colors] || colors.outdated;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-h3 text-foreground">Products & Services</h2>
        <p className="text-muted-foreground mt-1">
          Sync your Whop products so the AI can help customers with product information
        </p>
      </div>

      {/* Sync Controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Sync
            </CardTitle>
            <CardDescription>
              Automatically fetch your latest products from Whop to keep the AI up-to-date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleSyncProducts}
                disabled={isSyncing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? "Syncing..." : "Sync Products"}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Test Connection
              </Button>
            </div>

            {lastSyncResult && (
              <Alert className={lastSyncResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <AlertCircle className={`h-4 w-4 ${lastSyncResult.success ? "text-green-600" : "text-red-600"}`} />
                <AlertDescription className={lastSyncResult.success ? "text-green-800" : "text-red-800"}>
                  {lastSyncResult.success ? (
                    `Last sync: ${lastSyncResult.syncedCount} products synced` +
                    (lastSyncResult.deletedCount > 0 ? `, ${lastSyncResult.deletedCount} removed` : "")
                  ) : (
                    `Sync failed: ${lastSyncResult.errors?.[0] || "Unknown error"}`
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-h4 text-foreground">Current Products</h3>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {products?.length || 0} products
          </Badge>
        </div>

        {products === undefined ? (
          // Loading state
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          // Empty state
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-h4 text-foreground mb-2">No Products Found</h3>
              <p className="text-muted-foreground mb-4">
                Sync your products from Whop to get started. The AI will use this information to help customers.
              </p>
              <Button onClick={handleSyncProducts} disabled={isSyncing}>
                {isSyncing ? "Syncing..." : "Sync Products Now"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Products grid
          <div className="space-y-4">
            {products.map((product: any) => (
              <Card key={product._id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="text-h5 text-foreground">{product.title}</h4>
                        {product.description && (
                          <p className="text-muted-foreground text-sm line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSyncStatusColor(product.syncStatus)}>
                          {product.syncStatus}
                        </Badge>
                        {!product.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {product.price && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>{formatPrice(product.price, product.currency)}</span>
                          {product.accessType === "subscription" && product.billingPeriod && (
                            <span className="text-muted-foreground">
                              /{product.billingPeriod.replace('ly', '')}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getProductTypeColor(product.productType)} variant="secondary">
                          {product.productType.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="capitalize">{product.accessType.replace('_', ' ')}</span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(product.lastSyncedAt)}</span>
                      </div>
                    </div>

                    {/* Features */}
                    {product.features && product.features.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Features:</span>
                        <div className="flex flex-wrap gap-1">
                          {product.features.slice(0, 3).map((feature: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                          {product.features.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{product.features.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}