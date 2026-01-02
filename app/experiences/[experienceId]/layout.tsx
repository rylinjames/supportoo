"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sidebar } from "@/app/components/sidebar/sidebar";
import { UserProvider } from "@/app/contexts/user-context";
import { WhopPaymentsProvider } from "@/app/contexts/whop-payments-context";
import { WhopIframeSdkProvider } from "@whop/react";
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

const Layout = ({ children }: LayoutProps) => {
  const [currentUser, setCurrentUser] = useState<UserData | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const previousUserIdRef = useRef<string | null>(null);

  const { experienceId } = useParams() as { experienceId: string };
  const router = useRouter();
  const onboardUser = useAction(api.onboarding.actions.onboardUser);

  useEffect(() => {
    const authenticateUser = async () => {
      // Clear state before starting authentication
      setIsLoading(true);
      setError(undefined);

      try {
        const { userId } = await verifyUserToken();
        if (!userId) {
          setError("Error authenticating user:");
          setCurrentUser(undefined);
          previousUserIdRef.current = null;
          return;
        }

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
      setError(undefined);
      previousUserIdRef.current = null;
    };
  }, [onboardUser, experienceId, router]);

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
    <WhopIframeSdkProvider>
      <WhopPaymentsProvider>
        <UserProvider
          userData={currentUser}
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
                userType={
                  currentUser?.userCompanies.find(
                    (uc) => uc.companyId === currentUser.currentCompanyId
                  )?.role || "customer"
                }
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
                // Only show bottom nav for admin and support, not customers
                if (userRole === "customer") {
                  return null;
                }
                return (
                  <MobileBottomNav userType={userRole} user={currentUser} />
                );
              })()}
            </div>
          </RouteGuard>
        </UserProvider>
      </WhopPaymentsProvider>
    </WhopIframeSdkProvider>
  );
};

export default Layout;
