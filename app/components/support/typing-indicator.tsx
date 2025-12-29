import { motion } from "motion/react";
import { BotMessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TypingIndicatorProps {
  type: "ai" | "agent" | "customer";
  agentName?: string;
  agentAvatar?: string;
  viewType?: "customer" | "support";
  currentUserId?: string; // For "You" logic
}

export function TypingIndicator({
  type,
  agentName,
  agentAvatar,
  viewType = "support",
  currentUserId,
}: TypingIndicatorProps) {
  // Determine alignment based on message type and view type
  const isCustomerTyping = type === "customer";
  const shouldAlignRight =
    viewType === "customer" ? isCustomerTyping : !isCustomerTyping;

  if (type === "ai") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex ${shouldAlignRight ? "justify-end" : "justify-start"} mb-2`}
      >
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <BotMessageSquare className="h-4 w-4 text-primary" />
            <span className="text-caption text-muted-foreground">
              Support Assistant
            </span>
          </div>
          <div className="rounded-2xl bg-primary/5 px-3 py-2.5 w-fit">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1 w-1 rounded-full bg-primary/60"
                  animate={{
                    y: [0, -3, 0],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 0.75,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (type === "agent") {
    const initials =
      agentName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "SA";

    // Check if this is the current user typing
    const isCurrentUser = currentUserId && agentName === currentUserId;
    const displayName = isCurrentUser ? "You" : agentName;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex ${shouldAlignRight ? "justify-end" : "justify-start"} mb-2`}
      >
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={agentAvatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-caption">{displayName}</span>
          </div>
          <div className="rounded-2xl bg-card border border-border px-3 py-2.5 w-fit">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1 w-1 rounded-full bg-muted-foreground/60"
                  animate={{
                    y: [0, -3, 0],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 0.75,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (type === "customer") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex ${shouldAlignRight ? "justify-end" : "justify-start"} mb-2`}
      >
        <div className="rounded-2xl bg-secondary px-3 py-2.5 w-fit">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1 w-1 rounded-full bg-foreground/60"
                animate={{
                  y: [0, -3, 0],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 0.75,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}
