"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sidebar } from "@/app/components/sidebar/sidebar";
import { UserProvider } from "@/app/contexts/user-context";
import { WhopPaymentsProvider } from "@/app/contexts/whop-payments-context";
import { WhopIframeSdkProvider, useIframeSdk } from "@whop/react";
import { useEffect, useState, useRef } from "react";
import { verifyUserToken } from "@/components/server/whop-sdk";
import { useParams, useRouter } from "next/navigation";
import { MobileBottomNav } from "@/app/components/mobile/mobile-bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RouteGuard } from "@/app/components/auth/route-guard";

interface LayoutProps {
  children: React.ReactNode;
}

interface UserData {
  user: {
    _id: string;
    whopUserId: string;
    whopUsername: string;
    displayName: string;
    avatarUrl?: string;
    timezone?: string;
    createdAt: number;
    updatedAt: number;
  };
  currentCompanyId: string;
  userCompanies: Array<{
    companyId: string;
    role: "admin" | "support" | "customer";
    companyName: string;
    joinedAt: number;
    lastActiveInCompany: number;
  }>;
  isFirstAdmin: boolean;
  setupComplete: boolean;
}

// Inner component that has access to iframe SDK
const InnerLayout = ({ children }: LayoutProps) => {
  const [currentUser, setCurrentUser] = useState<UserData | undefined>(
    undefined
  );
  const [userToken, setUserToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const previousUserIdRef = useRef<string | null>(null);

  const { experienceId } = useParams() as { experienceId: string };
  const router = useRouter();
  const onboardUser = useAction(api.onboarding.actions.onboardUser);
  const iframeSdk = useIframeSdk();

  useEffect(() => {
    const authenticateUser = async () => {
      // Clear state before starting authentication
      setIsLoading(true);
      setError(undefined);

      try {
        const { userId, userToken: token, companyId: headerCompanyId } = await verifyUserToken();
        if (!userId) {
          setError("Error authenticating user:");
          setCurrentUser(undefined);
          setUserToken(undefined);
          previousUserIdRef.current = null;
          return;
        }

        // Log if we got company ID from headers
        if (headerCompanyId) {
          console.log("[Layout] Got company ID from header:", headerCompanyId);
        }

        // Try to get company route and view type from iframe SDK
        let companyRoute: string | undefined;
        let viewType: string | undefined;
        if (iframeSdk?.getTopLevelUrlData) {
          try {
            const urlData = await iframeSdk.getTopLevelUrlData({});
            console.log("[Layout] Iframe SDK URL data:", JSON.stringify(urlData, null, 2));

            // Capture viewType to determine if user is in admin area
            // viewType can be: "app", "admin", "analytics", or "preview"
            viewType = urlData?.viewType;
            console.log("[Layout] View type:", viewType);

            // Try to extract company route from fullHref if companyRoute is malformed
            if (urlData?.fullHref) {
              console.log("[Layout] Full href:", urlData.fullHref);
              // Reserved Whop paths that aren't company routes
              const reservedPaths = ['joined', 'hub', 'admin', 'app', 'analytics', 'api', 'login', 'signup', 'settings'];

              // Parse URL like: https://whop.com/test-whop/hub/support-ai-chat-test/
              // or: https://whop.com/joined/test-whop/hub/support-ai-chat-test/
              const urlParts = urlData.fullHref.split('/');
              const whopIndex = urlParts.findIndex((part: string) => part.includes('whop.com'));

              if (whopIndex !== -1) {
                // Look for first non-reserved path segment after whop.com
                for (let i = whopIndex + 1; i < urlParts.length; i++) {
                  const segment = urlParts[i];
                  if (segment && !reservedPaths.includes(segment.toLowerCase())) {
                    companyRoute = segment;
                    console.log("[Layout] Extracted company route from fullHref:", companyRoute);
                    break;
                  }
                }
              }
            }

            // Fallback to companyRoute if no match from fullHref
            if (!companyRoute && urlData?.companyRoute) {
              // Handle potential duplicate routes like "test-whop-test-whop"
              const parts = urlData.companyRoute.split('-');
              const halfLength = parts.length / 2;
              if (parts.length > 2 && parts.slice(0, halfLength).join('-') === parts.slice(halfLength).join('-')) {
                companyRoute = parts.slice(0, halfLength).join('-');
                console.log("[Layout] Fixed duplicated company route:", companyRoute);
              } else {
                companyRoute = urlData.companyRoute;
              }
            }

            if (companyRoute) {
              console.log("[Layout] Final company route:", companyRoute);
            }
          } catch (iframeError) {
            console.log("[Layout] Failed to get URL data from iframe SDK:", iframeError);
          }
        }

        // Store the user token for later use (e.g., product sync)
        setUserToken(token);

        // Check if userId has changed - if so, force complete reset
        if (
          previousUserIdRef.current !== null &&
          previousUserIdRef.current !== userId
        ) {
          console.log(
            `User changed from ${previousUserIdRef.current} to ${userId}, clearing state`
          );
          setCurrentUser(undefined);
          setError(undefined);
        }

        // Update tracked userId
        previousUserIdRef.current = userId;

        const res = await onboardUser({
          whopUserId: userId,
          experienceId: experienceId,
          userToken: token, // Pass user token for API calls
          companyIdFromHeader: headerCompanyId, // Pass company ID if available from header
          companyRoute: companyRoute, // Pass company route from iframe SDK
          viewType: viewType, // Pass view type to determine admin status
        });

        if (!res.success) {
          setError(res.error || "Failed to authenticate user");
          setCurrentUser(undefined);
          return;
        }

        // Validate that userData exists
        if (!res.userData) {
          setError("User data not returned from authentication");
          setCurrentUser(undefined);
          return;
        }

        // Only update state if userId still matches (prevent race conditions)
        if (previousUserIdRef.current === userId) {
          setCurrentUser(res.userData);

          // Disable automatic redirects to allow users to navigate freely
          // Users can manually navigate using the Admin Dashboard button
          // if (res.redirectTo) {
          //   router.push(res.redirectTo);
          // }
        }
      } catch (error) {
        setError(`Error authenticating user: ${error}`);
        setCurrentUser(undefined);
        setUserToken(undefined);
        previousUserIdRef.current = null;
        return;
      } finally {
        setIsLoading(false);
      }
    };
    authenticateUser();

    // Cleanup on unmount
    return () => {
      setCurrentUser(undefined);
      setUserToken(undefined);
      setError(undefined);
      previousUserIdRef.current = null;
    };
  }, [onboardUser, experienceId, router, iframeSdk]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-body-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-body-sm text-muted-foreground">
        Authenticating...
      </div>
    );
  }

  // Safety check: if no user data and no error, show fallback
  if (!currentUser && !error) {
    return (
      <div className="flex justify-center items-center h-screen text-body-sm text-muted-foreground">
        Authenticating...
      </div>
    );
  }

  return (
    <WhopPaymentsProvider>
      <UserProvider
        userData={currentUser}
        userToken={userToken}
        isLoading={isLoading}
        error={error}
      >
        <RouteGuard>
          <Toaster />
          {/* Desktop View */}
          <div
            suppressHydrationWarning
            className="hidden xl:flex h-screen overflow-hidden"
          >
            <Sidebar
              userType="admin"  // TEMPORARILY: Force admin to show all navigation
              user={currentUser}
            />
            <div className="flex-1 overflow-hidden bg-background">
              {children}
            </div>
          </div>
          {/* Mobile/Tablet View */}
          <div className="flex xl:hidden flex-col h-screen overflow-hidden">
            <main className="flex-1 overflow-hidden bg-background">
              {children}
            </main>
            {(() => {
              const userRole =
                currentUser?.userCompanies.find(
                  (uc) => uc.companyId === currentUser.currentCompanyId
                )?.role || "customer";
              // TEMPORARILY: Show bottom nav for all users including customers
              // if (userRole === "customer") {
              //   return null;
              // }
              return (
                <MobileBottomNav userType="admin" user={currentUser} />
              );
            })()}
          </div>
        </RouteGuard>
      </UserProvider>
    </WhopPaymentsProvider>
  );
};

// Outer Layout that provides iframe SDK context
const Layout = ({ children }: LayoutProps) => {
  return (
    <WhopIframeSdkProvider>
      <InnerLayout>{children}</InnerLayout>
    </WhopIframeSdkProvider>
  );
};

export default Layout;
