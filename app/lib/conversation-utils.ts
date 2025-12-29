/**
 * Conversation Data Transformation Utilities
 *
 * Transforms backend conversation data to frontend format
 * for the Support tab components.
 */

import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Message } from "@/app/components/support/message-bubble";

// Backend conversation type (from our enhanced query)
type BackendConversation = {
  _id: Id<"conversations">;
  customerId: Id<"users">;
  status: "ai_handling" | "available" | "support_staff_handling" | "resolved";
  messageCount: number;
  lastMessageAt: number;
  firstMessageAt: number;
  participatingAgents: Id<"users">[];
  createdAt: number;
  updatedAt: number;
  handoffTriggeredAt?: number;
  handoffReason?: string;
  customer: {
    _id: Id<"users">;
    displayName: string;
    avatarUrl?: string;
    whopUsername: string;
  } | null;
  latestMessage: {
    _id: Id<"messages">;
    role: "customer" | "ai" | "agent" | "system";
    content: string;
    timestamp: number;
    readByCustomerAt?: number;
    readByAgentAt?: number;
    attachmentUrl?: string;
    attachmentType?: string;
  } | null;
  hasUnreadMessages: boolean;
  lastMessageFrom: string | null;
  deliveryStatus?: "sent" | "delivered" | "seen";
  participatingAgentsEnriched: Array<{
    id: Id<"users">;
    name: string;
    initials: string;
    avatar?: string;
  } | null>;
  messages?: Doc<"messages">[]; // Pre-fetched messages for instant display
};

// Frontend conversation type (for components)
export type ConversationStatus = "ai" | "available" | "support" | "resolved";
export type DeliveryStatus = "sent" | "delivered" | "seen";

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerUsername: string;
  customerAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageFrom: "customer" | "ai" | "agent" | "system";
  lastMessageHasAttachment?: boolean;
  lastMessageAttachmentType?: string;
  deliveryStatus?: DeliveryStatus;
  status: ConversationStatus;
  unread: boolean;
  participatingAgents: Agent[];
  handoffReason?: string;
  createdAt: Date;
  messages?: Doc<"messages">[]; // Pre-fetched messages for instant display
}

/**
 * Transform backend conversation to frontend format
 */
export function transformConversation(
  backendConv: BackendConversation
): Conversation {
  // Map backend status to frontend status
  const statusMap: Record<string, ConversationStatus> = {
    ai_handling: "ai",
    available: "available",
    support_staff_handling: "support",
    resolved: "resolved",
  };

  return {
    id: backendConv._id,
    customerId: backendConv.customerId,
    customerName: backendConv.customer?.displayName || "Unknown Customer",
    customerUsername: backendConv.customer?.whopUsername || "",
    customerAvatar: backendConv.customer?.avatarUrl,
    lastMessage: backendConv.latestMessage?.content || "No messages yet",
    lastMessageTime: new Date(
      backendConv.latestMessage?.timestamp || backendConv.lastMessageAt
    ),
    lastMessageFrom: (backendConv.latestMessage?.role as any) || "customer",
    lastMessageHasAttachment: !!backendConv.latestMessage?.attachmentUrl,
    lastMessageAttachmentType: backendConv.latestMessage?.attachmentType,
    deliveryStatus: backendConv.deliveryStatus,
    status: statusMap[backendConv.status] || "ai",
    unread: backendConv.hasUnreadMessages,
    participatingAgents: (backendConv.participatingAgentsEnriched || [])
      .filter(Boolean)
      .map((agent) => ({
        id: agent!.id,
        name: agent!.name,
        initials: agent!.initials,
        avatar: agent!.avatar,
      })),
    handoffReason: backendConv.handoffReason,
    createdAt: new Date(backendConv.createdAt),
    messages: backendConv.messages, // Pass through pre-fetched messages
  };
}

/**
 * Transform array of backend conversations to frontend format
 */
export function transformConversations(
  backendConvs: BackendConversation[]
): Conversation[] {
  return backendConvs.map(transformConversation);
}

/**
 * Get customer initials for avatar fallback
 */
export function getCustomerInitials(customerName: string): string {
  return customerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format relative time (e.g., "2m ago", "1h ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Check if conversation needs agent attention
 */
export function needsAgentAttention(conversation: Conversation): boolean {
  return (
    conversation.status === "available" ||
    (conversation.lastMessageFrom === "customer" && conversation.unread)
  );
}

/**
 * Get status badge color class
 */
export function getStatusBadgeClass(status: ConversationStatus): string {
  switch (status) {
    case "ai":
      return "bg-primary/10 text-primary";
    case "available":
      return "bg-orange/20 text-orange";
    case "support":
      return "bg-success/10 text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
}
