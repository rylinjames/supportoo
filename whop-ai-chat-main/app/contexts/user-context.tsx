"use client";

import { createContext, useContext, ReactNode, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface UserCompany {
  companyId: string;
  role: "admin" | "support" | "customer";
  companyName: string;
  joinedAt: number;
  lastActiveInCompany: number;
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
  userCompanies: UserCompany[];
  isFirstAdmin: boolean;
  setupComplete: boolean;
}

interface UserContextType {
  userData: UserData | undefined;
  userToken: string | undefined;
  isLoading: boolean;
  error: string | undefined;
  switchCompany: (companyId: string) => Promise<void>;
  getCurrentRole: () => "admin" | "support" | "customer" | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  userData: UserData | undefined;
  userToken: string | undefined;
  isLoading: boolean;
  error: string | undefined;
}

export function UserProvider({
  children,
  userData,
  userToken,
  isLoading,
  error,
}: UserProviderProps) {
  const switchActiveCompanyMutation = useMutation(
    api.users.mutations.switchActiveCompany
  );

  const switchCompany = useCallback(
    async (companyId: string) => {
      if (!userData?.user._id) {
        console.error("Cannot switch company: No user data");
        return;
      }

      try {
        await switchActiveCompanyMutation({
          userId: userData.user._id as Id<"users">,
          companyId: companyId as Id<"companies">,
        });

        // Reload the page to refresh the user context with new company
        window.location.reload();
      } catch (error) {
        console.error("Failed to switch company:", error);
      }
    },
    [userData?.user._id, switchActiveCompanyMutation]
  );

  const getCurrentRole = () => {
    if (!userData) return null;

    const currentCompany = userData.userCompanies.find(
      (uc) => uc.companyId === userData.currentCompanyId
    );

    return currentCompany?.role || null;
  };

  return (
    <UserContext.Provider
      value={{
        userData,
        userToken,
        isLoading,
        error,
        switchCompany,
        getCurrentRole,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
