import { motion } from "motion/react";
import { useState, useMemo } from "react";
import { BotMessageSquare, Eye, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Helper to convert URLs in text to clickable links
function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex after test
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:no-underline break-all"
        >
          {part.length > 50 ? part.substring(0, 47) + "..." : part}
        </a>
      );
    }
    return part;
  });
}

export type MessageType = "customer" | "ai" | "agent" | "system";

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  agentId?: string; // For agent/system messages - used for "You" logic
  agentName?: string; // For agent messages
  agentAvatar?: string; // Optional avatar URL
  attachment?: FileAttachment; // Optional file attachment
  readByCustomerAt?: number; // For read receipts
  readByAgentAt?: number; // For read receipts
}

interface MessageBubbleProps {
  message: Message;
  viewType?: "customer" | "support"; // customer view = customer on right, support view = customer on left
  currentUserId?: string; // For "You" logic
}

// Markdown components for styled rendering
const markdownComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="text-body-sm">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ children }: any) => (
    <code className="px-1 py-0.5 rounded bg-secondary text-xs font-mono">{children}</code>
  ),
  pre: ({ children }: any) => (
    <pre className="p-3 rounded-lg bg-secondary overflow-x-auto mb-2 text-xs">{children}</pre>
  ),
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
      {children}
    </a>
  ),
  h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-bold mb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-primary pl-3 italic text-muted-foreground mb-2">{children}</blockquote>
  ),
};

export function MessageBubble({
  message,
  viewType = "customer",
  currentUserId,
}: MessageBubbleProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);

  // In customer view: customer on right, AI/agents on left
  // In support view: customer on left, AI/agents on right
  const isCustomerMessage = message.type === "customer";
  const shouldAlignRight =
    viewType === "customer" ? isCustomerMessage : !isCustomerMessage;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Render read receipt checkmarks
  const renderReadReceipt = () => {
    if (viewType === "support") {
      // Support view: only show for YOUR OWN agent messages
      if (message.type !== "agent" || message.agentId !== currentUserId) {
        return null;
      }
      // Check if customer read it
      const isSeen = !!message.readByCustomerAt;
      const checkmarkColor = isSeen
        ? "text-primary"
        : "text-muted-foreground/60";

      return (
        <div className="flex items-center gap-0.5 ml-1">
          <Check
            className={`h-3 w-3 ${checkmarkColor} -mr-1.5`}
            strokeWidth={2.5}
          />
          <Check className={`h-3 w-3 ${checkmarkColor}`} strokeWidth={2.5} />
        </div>
      );
    } else if (viewType === "customer") {
      // Customer view: only show for YOUR OWN customer messages
      if (message.type !== "customer") {
        return null;
      }
      // Check if agent read it
      const isSeen = !!message.readByAgentAt;
      const checkmarkColor = isSeen
        ? "text-primary"
        : "text-muted-foreground/60";

      return (
        <div className="flex items-center gap-0.5 ml-1">
          <Check
            className={`h-3 w-3 ${checkmarkColor} -mr-1.5`}
            strokeWidth={2.5}
          />
          <Check className={`h-3 w-3 ${checkmarkColor}`} strokeWidth={2.5} />
        </div>
      );
    }

    return null;
  };

  // Render attachment
  const renderAttachment = () => {
    if (!message.attachment) return null;

    if (message.attachment.type.startsWith("image/")) {
      return (
        <TooltipProvider>
          <div className="relative group cursor-pointer">
            <img
              src={message.attachment.url}
              alt={message.attachment.name}
              className="rounded-lg max-w-full h-auto max-h-[200px] object-cover"
              onClick={() => setShowImageDialog(true)}
            />
            {/* Hover overlay */}
            <div
              className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-end justify-start cursor-pointer"
              onClick={() => setShowImageDialog(true)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-2">
                    <Eye className="h-5 w-5 text-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View image</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      );
    }

    return (
      <div className="flex items-center gap-2 p-2 rounded bg-background/50">
        <div className="flex-1 min-w-0">
          <p className="text-body-sm truncate">{message.attachment.name}</p>
          <p className="text-xs text-muted-foreground">
            {(message.attachment.size / 1024).toFixed(1)} KB
          </p>
        </div>
      </div>
    );
  };

  // Image dialog for full-size view
  const renderImageDialog = () => {
    if (!message.attachment?.type.startsWith("image/")) return null;

    return (
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>{message.attachment.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img
              src={message.attachment.url}
              alt={message.attachment.name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // System message (centered, no bubble)
  if (message.type === "system") {
    // Check if this system message is from the current user
    const isCurrentUser = currentUserId && message.agentId === currentUserId;

    // Transform content to show "You" instead of agent name
    let displayContent = message.content;
    if (isCurrentUser && message.agentName) {
      // Replace agent name with "You" and fix grammar
      const agentFirstName = message.agentName.split(" ")[0];

      // Handle different system message patterns
      if (
        displayContent.includes(`${agentFirstName} (Support Staff) has joined`)
      ) {
        displayContent = displayContent.replace(
          `${agentFirstName} (Support Staff) has joined`,
          "You (Support Staff) joined"
        );
      } else if (displayContent.includes(`${agentFirstName} has joined`)) {
        displayContent = displayContent.replace(
          `${agentFirstName} has joined`,
          "You joined"
        );
      } else {
        // Fallback: simple replacement
        displayContent = displayContent.replace(agentFirstName, "You");
      }
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex justify-center my-6"
      >
        <p className="text-body-sm text-muted-foreground">{displayContent}</p>
      </motion.div>
    );
  }

  // Customer message (alignment depends on view)
  if (message.type === "customer") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`flex ${shouldAlignRight ? "justify-end" : "justify-start"} mb-4`}
        >
          <div className="max-w-[80%]">
            <div className="rounded-2xl bg-secondary px-4 py-2.5">
              {message.attachment && (
                <div className={message.content ? "mb-2" : ""}>
                  {renderAttachment()}
                </div>
              )}
              {message.content && (
                <p className="text-body-sm">{linkifyText(message.content)}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
              <span>{formatTime(message.timestamp)}</span>
              {renderReadReceipt()}
            </div>
          </div>
        </motion.div>
        {renderImageDialog()}
      </>
    );
  }

  // AI message (alignment depends on view) - WITH MARKDOWN RENDERING
  if (message.type === "ai") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`flex ${shouldAlignRight ? "justify-end" : "justify-start"} mb-4`}
        >
          <div className="max-w-[80%]">
            <div className="flex items-center gap-2 mb-1">
              <BotMessageSquare className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                Support Assistant
              </span>
            </div>
            <div className="rounded-2xl bg-primary/5 px-4 py-2.5 max-w-max">
              {message.attachment && (
                <div className="mb-2">{renderAttachment()}</div>
              )}
              {message.content && (
                <div className="text-body-sm prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <span>{formatTime(message.timestamp)}</span>
              {renderReadReceipt()}
            </div>
          </div>
        </motion.div>
        {renderImageDialog()}
      </>
    );
  }

  // Agent message (alignment depends on view)
  if (message.type === "agent") {
    const initials =
      message.agentName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "SA";

    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`flex ${shouldAlignRight ? "justify-end" : "justify-start"} mb-4`}
        >
          <div className="max-w-[80%]">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={message.agentAvatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">
                {currentUserId && message.agentId === currentUserId
                  ? "You (Support Staff)"
                  : `${message.agentName?.split(" ")[0]} (Support Staff)`}
              </span>
            </div>
            <div className="rounded-2xl bg-card border border-border px-4 py-2.5 max-w-max">
              {message.attachment && (
                <div className="mb-2">{renderAttachment()}</div>
              )}
              {message.content && (
                <p className="text-body-sm">{linkifyText(message.content)}</p>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <span>{formatTime(message.timestamp)}</span>
              {renderReadReceipt()}
            </div>
          </div>
        </motion.div>
        {renderImageDialog()}
      </>
    );
  }

  return null;
}
