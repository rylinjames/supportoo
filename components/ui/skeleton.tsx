import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted/50 animate-pulse",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
