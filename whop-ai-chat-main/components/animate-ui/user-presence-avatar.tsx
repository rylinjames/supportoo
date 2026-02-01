"use client";

import * as React from "react";
import { motion, LayoutGroup } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/components/ui/utils";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AVATAR_MOTION_TRANSITION = {
  type: "spring",
  stiffness: 200,
  damping: 25,
} as const;

const GROUP_CONTAINER_TRANSITION = {
  type: "spring",
  stiffness: 150,
  damping: 20,
} as const;

interface UserPresenceAvatarProps {
  users: Array<{
    id: string;
    src?: string;
    fallback: string;
    tooltip: string;
    online: boolean;
  }>;
  size?: "sm" | "md" | "lg";
}

export function UserPresenceAvatar({
  users,
  size = "md",
}: UserPresenceAvatarProps) {
  // Size mapping
  const sizeClasses = {
    sm: "size-6",
    md: "size-12",
    lg: "size-16",
  };

  const containerHeightClasses = {
    sm: "h-6",
    md: "h-12",
    lg: "h-16",
  };

  const avatarSize = sizeClasses[size];
  const containerHeight = containerHeightClasses[size];
  const borderWidth = size === "sm" ? "border-2" : "border-3";

  return (
    <div className="flex items-center gap-2">
      <LayoutGroup>
        <TooltipProvider>
          {/* Single Group - All agents together */}
          {users.length > 0 && (
            <motion.div
              layout
              className="bg-neutral-300 dark:bg-neutral-700 p-0.5 rounded-full"
              transition={GROUP_CONTAINER_TRANSITION}
            >
              <div
                key={users.map((u) => u.id).join("_")}
                className={cn("flex items-center -space-x-3", containerHeight)}
              >
                {users.map((user) => (
                  <Tooltip key={user.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        layoutId={`avatar-${user.id}`}
                        animate={{
                          filter: user.online ? "grayscale(0)" : "grayscale(1)",
                          scale: 1,
                        }}
                        transition={AVATAR_MOTION_TRANSITION}
                        initial={false}
                      >
                        <Avatar
                          className={cn(
                            avatarSize,
                            borderWidth,
                            "border-neutral-300 dark:border-neutral-700"
                          )}
                        >
                          <AvatarImage src={user.src} />
                          <AvatarFallback>{user.fallback}</AvatarFallback>
                        </Avatar>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{user.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </TooltipProvider>
      </LayoutGroup>
    </div>
  );
}

// j57cx94x29avygza6ktkg91fm17spzwh -company
// jd75f53fmq4zeh9menrr5jj6ts7spm9j -conversation
// k975rqhr3v9ev5m5kpaqxv5r0n7sp58x -agent
