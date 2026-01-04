"use client";

import { createContext, useContext, ReactNode } from "react";

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
  switchCompany: (companyId: string) => void;
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
  const switchCompany = (companyId: string) => {
    // TODO: Implement company switching logic
    // This will need to call a backend mutation to update lastActiveInCompany
    // and potentially trigger a re-fetch of user data
    console.log("Switching to company:", companyId);
  };

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
