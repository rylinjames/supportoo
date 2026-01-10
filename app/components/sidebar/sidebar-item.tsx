import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  isCollapsed: boolean;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
  href?: string;
}

export function SidebarItem({
  icon: Icon,
  label,
  isCollapsed,
  active = false,
  onClick,
  badge,
  href,
}: SidebarItemProps) {
  const pathname = usePathname();

  // Build the full href with experience ID
  const fullHref = href
    ? `${pathname.split("/").slice(0, 3).join("/")}${href}`
    : undefined;

  const baseClasses = cn(
    "group relative flex items-center gap-3 w-full rounded-lg px-3 py-2.5",
    "transition-all duration-200 ease-out",
    isCollapsed && "justify-center px-2"
  );

  const stateClasses = cn(
    active
      ? "bg-muted text-foreground font-medium"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  );

  const content = href ? (
    <Link href={fullHref!} className={cn(baseClasses, stateClasses)}>
      <div className="relative flex-shrink-0">
        <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <span className="text-[13px] truncate leading-none">{label}</span>
      )}
    </Link>
  ) : (
    <button onClick={onClick} className={cn(baseClasses, stateClasses)}>
      <div className="relative flex-shrink-0">
        <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <span className="text-[13px] truncate leading-none">{label}</span>
      )}
    </button>
  );

  // When collapsed, show tooltip
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p className="text-[13px] font-medium">{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
