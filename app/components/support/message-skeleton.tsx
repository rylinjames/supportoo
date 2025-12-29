import { Skeleton } from "@/components/ui/skeleton";

interface MessageSkeletonProps {
  align?: "left" | "right";
}

export function MessageSkeleton({ align = "left" }: MessageSkeletonProps) {
  const isRight = align === "right";

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"} mb-4`}>
      <div className="max-w-[80%] space-y-2">
        {/* Avatar/Label row (only for left-aligned) */}
        {!isRight && (
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl ${isRight ? "bg-secondary" : "bg-primary/5"} px-4 py-2.5`}
        >
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>

        {/* Timestamp */}
        <Skeleton className={`h-2 w-12 ${isRight ? "ml-auto" : ""}`} />
      </div>
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      <MessageSkeleton align="right" />
      <MessageSkeleton align="left" />
      <MessageSkeleton align="right" />
      <MessageSkeleton align="left" />
      <MessageSkeleton align="left" />
      <MessageSkeleton align="right" />
      <MessageSkeleton align="left" />
      <MessageSkeleton align="right" />
    </div>
  );
}
