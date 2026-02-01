/**
 * Support Tab Types
 *
 * Shared types for the Support tab components.
 */

import type { Doc } from "@/convex/_generated/dataModel";

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
  customerLastActiveAt?: number;
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

export interface QuickReplyTemplate {
  id: string;
  title: string;
  content: string;
  category: "greeting" | "escalation" | "resolution" | "general";
}
