import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "./types";
import { useUser } from "@/app/contexts/user-context";

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationListItem({
  conversation,
  isSelected,
  onClick,
}: ConversationListItemProps) {
  const { userData } = useUser();

  const getStatusBadge = () => {
    switch (conversation.status) {
      case "ai":
        return (
          <Badge
            variant="secondary"
            className="h-5 px-2 text-[10px] bg-primary/10 text-primary hover:bg-primary/10"
          >
            AI handling
          </Badge>
        );
      case "available":
        return (
          <Badge
            variant="secondary"
            className="h-5 px-2 text-[10px] bg-orange/20 text-orange hover:bg-orange/20"
          >
            Available for pick up
          </Badge>
        );
      case "support": {
        // Check if current user is participating in this conversation
        const currentUserId = userData?.user._id;
        const isCurrentUserParticipating =
          conversation.participatingAgents.some(
            (agent) => agent.id === currentUserId
          );

        if (isCurrentUserParticipating) {
          return (
            <Badge
              variant="secondary"
              className="h-5 px-2 text-[10px] bg-success/10 text-success hover:bg-success/10"
            >
              You are handling
            </Badge>
          );
        }

        // Show other agents handling
        const agent = conversation.participatingAgents[0];
        const firstName = agent?.name.split(" ")[0] || "Support Staff";
        const badgeText = agent
          ? `${firstName}'s handling`
          : "Support Staff handling";

        return (
          <Badge
            variant="secondary"
            className="h-5 px-2 text-[10px] bg-success/10 text-success hover:bg-success/10"
          >
            {badgeText}
          </Badge>
        );
      }
      case "resolved":
        return (
          <Badge
            variant="secondary"
            className="h-5 px-2 text-[10px] bg-green-500/10 text-green-600 hover:bg-green-500/10"
          >
            Resolved
          </Badge>
        );
    }
  };

  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true })
      .replace("about ", "")
      .replace(" ago", "");
  };

  const initials = conversation.customerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Determine if this conversation needs our reply
  const needsReply =
    conversation.status === "available" ||
    (conversation.lastMessageFrom === "customer" &&
      conversation.deliveryStatus !== "seen");

  // Render delivery status checkmarks (only when we sent the last message)
  const renderDeliveryStatus = () => {
    if (!conversation.deliveryStatus || needsReply) return null;

    const isSeen = conversation.deliveryStatus === "seen";
    const checkmarkColor = isSeen ? "text-primary" : "text-foreground/40";

    return (
      <div className="flex items-center gap-0.5">
        {/* Double checkmark for delivered/seen */}
        <Check
          className={`h-3 w-3 ${checkmarkColor} -mr-1.5`}
          strokeWidth={2.5}
        />
        <Check className={`h-3 w-3 ${checkmarkColor}`} strokeWidth={2.5} />
      </div>
    );
  };

  return (
    <button
      onClick={onClick}
      className={`
          w-full flex items-start gap-3 py-4 px-3 text-left transition-colors rounded-lg
          ${
            isSelected
              ? "bg-primary/10 border border-primary/20"
              : "hover:bg-muted/50"
          }
        `}
    >
      {/* Avatar - Cyan accent! */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage
          src={conversation.customerAvatar}
          alt={conversation.customerName}
        />
        <AvatarFallback className="bg-primary/20 text-primary text-label-sm">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Content - NO borders! */}
      <div className="flex-1 min-w-0">
        {/* Name + Badge - Darkest text (foreground) */}
        <div className="flex items-center gap-2 mb-0.5">
          <h3
            className={`text-label text-foreground truncate ${conversation.unread ? "font-medium" : ""}`}
          >
            {conversation.customerName}
          </h3>
          {getStatusBadge()}
        </div>

        {/* Last Message - Darker if needs reply */}
        <p
          className={`text-body-sm truncate mb-1.5 ${
            needsReply ? "text-foreground font-medium" : "text-muted-foreground"
          }`}
        >
          {conversation.lastMessageHasAttachment &&
            conversation.lastMessageAttachmentType?.startsWith("image/") && (
              <span className="mr-1">📸</span>
            )}
          {conversation.lastMessage}
        </p>

        {/* Meta Row - Lightest gray (tertiary) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Delivery Status Checkmarks (when we sent last message) */}
          {renderDeliveryStatus()}

          {/* Timestamp */}
          <span className="text-caption text-foreground/40">
            {formatTime(conversation.lastMessageTime)}
          </span>

          {/* Participating Agents */}
          {conversation.participatingAgents.length > 0 && (
            <>
              <span className="text-caption text-foreground/40">•</span>
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1">
                  {conversation.participatingAgents.slice(0, 3).map((agent) => (
                    <Avatar
                      key={agent.id}
                      className="h-4 w-4 border border-background"
                    >
                      <AvatarImage src={agent.avatar} alt={agent.name} />
                      <AvatarFallback className="bg-muted text-[8px]">
                        {agent.initials}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-caption text-foreground/40">
                  {conversation.participatingAgents
                    .map((a) => a.name.split(" ")[0])
                    .join(", ")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Handoff Reason (Available only) - Medium gray */}
        {conversation.status === "available" && conversation.handoffReason && (
          <p className="text-caption text-muted-foreground mt-1.5">
            {conversation.handoffReason}
          </p>
        )}
      </div>

      {/* Unread Indicator */}
      {conversation.unread && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1" />
      )}
    </button>
  );
}
