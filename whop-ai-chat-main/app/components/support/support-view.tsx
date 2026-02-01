"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { ConversationList } from "./conversation-list";
import { ConversationDetail } from "./conversation-detail";
import { transformConversations } from "@/app/lib/conversation-utils";
import type { Conversation } from "./types";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton component for loading state
function ConversationListItemSkeleton() {
  return (
    <div className="w-full flex items-start gap-3 py-4 px-3">
      {/* Avatar Skeleton */}
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />

      {/* Content Skeleton */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Name + Badge Row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Message Preview */}
        <Skeleton className="h-3 w-full" />

        {/* Meta Row */}
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Skeleton */}
      <div className="p-4 border-b border-border">
        <Skeleton className="h-6 w-48 mb-3" />

        {/* Search Bar */}
        <Skeleton className="h-9 w-full mb-3 rounded-md" />

        {/* Filters */}
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md" />
        </div>
      </div>

      {/* Conversation List Skeleton */}
      <div className="flex-1 overflow-y-auto">
        {/* Available Section Skeleton */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div>
            <ConversationListItemSkeleton />
            <ConversationListItemSkeleton />
          </div>
        </div>

        {/* All Conversations Skeleton */}
        <div className="p-3">
          <Skeleton className="h-4 w-40 mb-2 px-1" />
          <div>
            <ConversationListItemSkeleton />
            <ConversationListItemSkeleton />
            <ConversationListItemSkeleton />
            <ConversationListItemSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupportView() {
  const { experienceId } = useParams() as { experienceId: string };
  const { userData, isLoading: userLoading } = useUser();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | undefined
  >();

  // Get conversations using Convex live query
  const backendConversations = useQuery(
    api.conversations.queries.listConversationsForAgents,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as any }
      : "skip"
  );

  // Transform backend data to frontend format
  const conversations: Conversation[] = backendConversations
    ? transformConversations(backendConversations)
    : [];

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
  };

  const handleBack = () => {
    setSelectedConversationId(undefined);
  };

  // Show loading state
  if (userLoading || !userData || !backendConversations) {
    return <ConversationListSkeleton />;
  }

  // Show detail when conversation selected
  if (selectedConversation) {
    return (
      <div className="h-full">
        <ConversationDetail
          conversation={selectedConversation}
          onBack={handleBack}
          messages={selectedConversation.messages}
        />
      </div>
    );
  }

  // Show list by default
  return (
    <div className="h-full">
      <ConversationList
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
      />
    </div>
  );
}
