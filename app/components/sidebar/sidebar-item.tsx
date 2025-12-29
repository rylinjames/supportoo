import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  const className = `
    group relative flex items-center gap-3 w-full rounded-md px-3 py-2
    transition-colors duration-200
    ${isCollapsed ? "justify-center" : ""}
    ${
      active
        ? "bg-muted/50 text-foreground"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    }
  `;

  const content = href ? (
    <Link href={fullHref!} className={className}>
      <div className="relative flex-shrink-0">
        <Icon className="h-5 w-5" />
        {badge !== undefined && badge >= 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      {!isCollapsed && <span className="text-body-sm truncate">{label}</span>}
    </Link>
  ) : (
    <button onClick={onClick} className={className}>
      <div className="relative flex-shrink-0">
        <Icon className="h-5 w-5" />
        {badge !== undefined && badge >= 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      {!isCollapsed && <span className="text-body-sm truncate">{label}</span>}
    </button>
  );

  // When collapsed, show tooltip
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-body-sm">{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
