"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { CustomerChatHeader } from "./customer-chat-header";
import { CustomerEmptyState } from "./customer-empty-state";
import { CustomerChatDetail } from "./customer-chat-detail";
import { MessageListSkeleton } from "../support/message-skeleton";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

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
  const requestHumanSupport = useMutation(
    api.conversations.mutations.requestHumanSupport
  );

  const conversation = useQuery(
    api.conversations.queries.getCustomerConversation,
    effectiveUserId && userData?.currentCompanyId
      ? {
          customerId: effectiveUserId as Id<"users">,
          companyId: userData.currentCompanyId as Id<"companies">,
        }
      : "skip"
  );

  const handleRequestHumanSupport = async () => {
    if (!conversation || !effectiveUserId) return;

    try {
      await requestHumanSupport({
        conversationId: conversation._id as Id<"conversations">,
        customerId: effectiveUserId as Id<"users">,
      });
      toast.success("Human support requested");
    } catch (error) {
      toast.error("Failed to request human support");
    }
  };

  if (userLoading || (!userData && !forceCustomerId)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Always show header on mobile, or when conversation exists on desktop */}
      <CustomerChatHeader
        onRequestHumanSupport={handleRequestHumanSupport}
        showMenu={true}
        companyId={userData?.currentCompanyId || ""}
      />

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
