"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/contexts/user-context";
import { useParams } from "next/navigation";

/**
 * RouteGuard Component
 *
 * Protects routes based on user role:
 * - Customer: Can only access /customer-view with their customerId
 * - Support: Can only access / (support) and /settings
 * - Admin: Full access to all routes, except /customer-view (only in dev mode)
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { experienceId } = useParams() as { experienceId: string };
  const { userData, getCurrentRole, isLoading } = useUser();

  // Check if route is allowed synchronously (before render)
  const isRouteAllowed = useMemo(() => {
    // Don't check routes while loading or if no user data
    if (isLoading || !userData) {
      return true; // Allow render while loading
    }

    const role = getCurrentRole();
    if (!role) {
      return true; // Allow render if no role yet
    }

    // Extract the route after /experiences/[experienceId]
    const pathParts = pathname.split("/");
    const experienceIndex = pathParts.findIndex(
      (part) => part.startsWith("exp_") || part === experienceId
    );

    if (experienceIndex === -1) {
      return true; // Allow if can't parse route
    }

    // Get route after experienceId (e.g., "/ai-studio", "/customer-view", "/")
    const routeAfterExperience =
      "/" + pathParts.slice(experienceIndex + 1).join("/");

    // Normalize route: remove query params for comparison
    const routeWithoutQuery = routeAfterExperience.split("?")[0];

    // Define allowed routes per role
    const customerAllowedRoutes = ["/customer-view"];
    const supportAllowedRoutes = ["/", "/settings", "/customer-test", "/workspace"];

    if (role === "customer") {
      // Customer: Only allow /customer-view with correct customerId
      const customerId = searchParams.get("customerId");
      const expectedCustomerId = userData.user._id;

      return (
        routeWithoutQuery === "/customer-view" &&
        customerId === expectedCustomerId
      );
    } else if (role === "support") {
      // Support: Can handle tickets and access workspace
      return supportAllowedRoutes.includes(routeWithoutQuery);
    } else if (role === "admin") {
      // Admin: Allow all routes except customer-view (only in dev mode)
      if (routeWithoutQuery === "/customer-view") {
        // Only allow customer-view in development mode
        return process.env.NODE_ENV === "development";
      }
      // Allow all other routes for admins
      return true;
    }
    // Unknown role - deny access
    return false;
  }, [
    pathname,
    searchParams,
    userData,
    getCurrentRole,
    isLoading,
    experienceId,
  ]);

  // Perform redirect if route is not allowed
  useEffect(() => {
    if (isLoading || !userData) {
      return;
    }

    const role = getCurrentRole();
    if (!role) {
      return;
    }

    // Extract the route after /experiences/[experienceId]
    const pathParts = pathname.split("/");
    const experienceIndex = pathParts.findIndex(
      (part) => part.startsWith("exp_") || part === experienceId
    );

    if (experienceIndex === -1) {
      return;
    }

    // Get route after experienceId
    const routeAfterExperience =
      "/" + pathParts.slice(experienceIndex + 1).join("/");
    const routeWithoutQuery = routeAfterExperience.split("?")[0];

    // Build redirect URLs
    const baseUrl = `/experiences/${experienceId}`;

    // TEMPORARILY DISABLED: Allow customers to access admin dashboard for testing
    // if (role === "customer") {
    //   const customerId = searchParams.get("customerId");
    //   const expectedCustomerId = userData.user._id;

    //   if (
    //     routeWithoutQuery !== "/customer-view" ||
    //     customerId !== expectedCustomerId
    //   ) {
    //     // Redirect to customer view with correct customerId
    //     router.replace(
    //       `${baseUrl}/customer-view?customerId=${expectedCustomerId}`
    //     );
    //     return;
    //   }
    // }
    
    if (role === "support") {
      const supportAllowedRoutes = ["/", "/settings", "/customer-test", "/workspace"];
      if (!supportAllowedRoutes.includes(routeWithoutQuery)) {
        // Redirect to support dashboard (root)
        router.replace(`${baseUrl}/`);
        return;
      }
    } else if (role === "admin") {
      // Admin: Block customer-view in production, redirect to support dashboard
      if (
        routeWithoutQuery === "/customer-view" &&
        process.env.NODE_ENV !== "development"
      ) {
        router.replace(`${baseUrl}/`);
        return;
      }
    }
  }, [
    pathname,
    searchParams,
    userData,
    getCurrentRole,
    isLoading,
    experienceId,
    router,
    isRouteAllowed,
  ]);

  // Show authenticating screen if route is not allowed (prevents flash)
  if (!isRouteAllowed && !isLoading && userData) {
    return (
      <div className="flex justify-center items-center h-screen text-body-sm text-muted-foreground">
        Authenticating...
      </div>
    );
  }

  return <>{children}</>;
}
