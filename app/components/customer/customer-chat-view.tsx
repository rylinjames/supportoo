"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { CustomerEmptyState } from "./customer-empty-state";
import { CustomerChatDetail } from "./customer-chat-detail";
import { MessageListSkeleton } from "../support/message-skeleton";
import { MobileViewport } from "./mobile-viewport";
import { Id } from "@/convex/_generated/dataModel";

interface CustomerChatViewProps {
  experienceId: string;
  forceCustomerId?: string;
}

export function CustomerChatView({
  experienceId,
  forceCustomerId,
}: CustomerChatViewProps) {
  const { userData, isLoading: userLoading } = useUser();

  // In dev mode, use forced customer ID
  const effectiveUserId = forceCustomerId || userData?.user._id;
  const conversation = useQuery(
    api.conversations.queries.getCustomerConversation,
    effectiveUserId && userData?.currentCompanyId
      ? {
          customerId: effectiveUserId as Id<"users">,
          companyId: userData.currentCompanyId as Id<"companies">,
        }
      : "skip"
  );

  if (userLoading || (!userData && !forceCustomerId)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <MobileViewport />

      {conversation === undefined ? (
        // Loading state - show MessageListSkeleton
        // Provides smooth transition to chat detail (both show chat-style UI)
        <div className="flex-1 overflow-hidden p-4">
          <div className="max-w-[800px] mx-auto">
            <MessageListSkeleton />
          </div>
        </div>
      ) : conversation === null ? (
        // No conversation - show empty state
        <CustomerEmptyState
          userId={effectiveUserId!}
          companyId={userData?.currentCompanyId || ""}
          experienceId={experienceId}
        />
      ) : (
        // Has conversation - show chat detail
        <CustomerChatDetail
          conversation={conversation}
          userId={effectiveUserId!}
          experienceId={experienceId}
        />
      )}
    </div>
  );
}
