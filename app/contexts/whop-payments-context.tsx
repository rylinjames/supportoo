"use client";

import { createContext, useContext, ReactNode } from "react";
import { useIframeSdk } from "@whop/react";

interface WhopPaymentsContextType {
  iframeSdk: ReturnType<typeof useIframeSdk> | null;
  isLoaded: boolean;
  /**
   * Charge user with native Whop modal + server-side charge creation
   *
   * @param sessionData - Result from server-side createCharge action
   * @returns Promise with payment result
   */
  chargeUserWithModal: (sessionData: {
    planId: string;
    sessionId?: string;
    status: string;
    amount: number;
    title: string;
  }) => Promise<{
    success: boolean;
    error?: string;
    receiptId?: string;
  }>;
}

const WhopPaymentsContext = createContext<WhopPaymentsContextType | null>(null);

interface WhopPaymentsProviderProps {
  children: ReactNode;
}

export function WhopPaymentsProvider({ children }: WhopPaymentsProviderProps) {
  const iframeSdk = useIframeSdk();
  const isLoaded = !!iframeSdk;

  const chargeUserWithModal = async (sessionData: {
    planId: string;
    sessionId?: string;
    status: string;
    amount: number;
    title: string;
  }) => {
    if (!iframeSdk?.inAppPurchase) {
      return {
        success: false,
        error: "Whop SDK not loaded. Please refresh and try again.",
      };
    }

    try {
      console.log(`[WHOP] Starting in-app purchase`, {
        planId: sessionData.planId,
        sessionId: sessionData.sessionId,
        amount: sessionData.amount,
        title: sessionData.title,
      });

      // Open native Whop modal with plan ID and optional session ID
      const result = await iframeSdk.inAppPurchase({
        planId: sessionData.planId,
        id: sessionData.sessionId, // Optional checkout session ID
      });

      console.log(`[WHOP] In-app purchase completed`, {
        planId: sessionData.planId,
        status: result.status,
        receiptId: result.status === "ok" ? result.data?.receiptId : undefined,
      });

      if (result.status === "ok" && result.data?.receiptId) {
        return {
          success: true,
          receiptId: result.data.receiptId,
        };
      } else {
        return {
          success: false,
          error:
            result.status === "error"
              ? result.error
              : "Payment was not completed",
        };
      }
    } catch (error) {
      console.error(`[WHOP] In-app purchase failed`, {
        planId: sessionData.planId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  };

  const value: WhopPaymentsContextType = {
    iframeSdk,
    isLoaded,
    chargeUserWithModal,
  };

  return (
    <WhopPaymentsContext.Provider value={value}>
      {children}
    </WhopPaymentsContext.Provider>
  );
}

export function useWhopPayments() {
  const context = useContext(WhopPaymentsContext);
  if (!context) {
    throw new Error(
      "useWhopPayments must be used within a WhopPaymentsProvider"
    );
  }
  return context;
}
