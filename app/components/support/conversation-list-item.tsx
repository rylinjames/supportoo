import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Check, Bot, AlertCircle, User, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "./types";
import { useUser } from "@/app/contexts/user-context";
import { cn } from "@/lib/utils";

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
            className="h-5 px-2 text-[10px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10 flex items-center gap-1"
          >
            <Bot className="h-3 w-3" />
            AI handling
          </Badge>
        );
      case "available":
        return (
          <Badge
            variant="secondary"
            className="h-5 px-2 text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 flex items-center gap-1"
          >
            <AlertCircle className="h-3 w-3" />
            Needs pickup
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
              className="h-5 px-2 text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 hover:bg-green-500/10 flex items-center gap-1"
            >
              <User className="h-3 w-3" />
              You&apos;re handling
            </Badge>
          );
        }

        // Show other agents handling
        const agent = conversation.participatingAgents[0];
        const firstName = agent?.name.split(" ")[0] || "Support";

        return (
          <Badge
            variant="secondary"
            className="h-5 px-2 text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 hover:bg-green-500/10 flex items-center gap-1"
          >
            <User className="h-3 w-3" />
            {firstName}&apos;s handling
          </Badge>
        );
      }
      case "resolved":
        return (
          <Badge
            variant="secondary"
            className="h-5 px-2 text-[10px] bg-secondary text-muted-foreground border border-border hover:bg-secondary flex items-center gap-1"
          >
            <CheckCircle className="h-3 w-3" />
            Resolved
          </Badge>
        );
    }
  };

  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: false })
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

  // Get avatar ring color based on status
  const getAvatarRingClass = () => {
    if (isSelected) return "ring-primary";
    if (conversation.status === "available") return "ring-orange-500";
    if (conversation.status === "ai") return "ring-primary/50";
    return "ring-transparent";
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-4 text-left transition-all duration-200 rounded-xl border",
        "hover:shadow-md hover:border-border/80 hover:-translate-y-0.5",
        isSelected
          ? "bg-primary/5 border-primary/30 shadow-sm"
          : "border-border/50 hover:bg-muted/30",
        conversation.unread && !isSelected && "border-l-4 border-l-primary",
        conversation.status === "available" && !isSelected && "bg-orange-500/5"
      )}
    >
      {/* Avatar with status ring */}
      <Avatar className={cn(
        "h-11 w-11 flex-shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all",
        getAvatarRingClass()
      )}>
        <AvatarImage
          src={conversation.customerAvatar}
          alt={conversation.customerName}
        />
        <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + Badge */}
        <div className="flex items-center gap-2 mb-1">
          <h3
            className={cn(
              "text-sm truncate",
              conversation.unread ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}
          >
            {conversation.customerName}
          </h3>
          {getStatusBadge()}
        </div>

        {/* Last Message */}
        <p
          className={cn(
            "text-sm truncate mb-2",
            needsReply ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {conversation.lastMessageHasAttachment &&
            conversation.lastMessageAttachmentType?.startsWith("image/") && (
              <span className="mr-1">📸</span>
            )}
          {conversation.lastMessage}
        </p>

        {/* Meta Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Delivery Status Checkmarks (when we sent last message) */}
          {renderDeliveryStatus()}

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground">
            {formatTime(conversation.lastMessageTime)}
          </span>

          {/* Participating Agents */}
          {conversation.participatingAgents.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground/50">•</span>
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
                <span className="text-xs text-muted-foreground">
                  {conversation.participatingAgents
                    .map((a) => a.name.split(" ")[0])
                    .join(", ")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Handoff Reason (Available only) */}
        {conversation.status === "available" && conversation.handoffReason && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 line-clamp-1">
            💬 {conversation.handoffReason}
          </p>
        )}
      </div>
    </button>
  );
}
