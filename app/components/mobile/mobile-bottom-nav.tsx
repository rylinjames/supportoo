"use client";

import { MessageSquare, Settings as SettingsIcon, Eye, FolderOpen } from "lucide-react";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useUser } from "@/app/contexts/user-context";

interface MobileBottomNavProps {
  userType: "customer" | "support" | "admin";
  user?: any; // Current user data from Convex - will be replaced by context
}

export function MobileBottomNav({ userType, user }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const experienceId = params?.experienceId as string;
  const { userData } = useUser();

  // TEMPORARILY: Show nav for all users
  // Customer has no bottom nav - they use the 3-dots menu in chat header
  // if (userType === "customer") {
  //   return null;
  // }

  // Support navigation items
  const supportNavItems = [
    {
      id: "support",
      icon: MessageSquare,
      label: "Support",
      route: "/",
    },
    {
      id: "settings",
      icon: SettingsIcon,
      label: "Settings",
      route: "/settings",
    },
  ];

  // Admin navigation items
  const adminNavItems = [
    {
      id: "support",
      icon: MessageSquare,
      label: "Support",
      route: "/",
    },
    {
      id: "workspace",
      icon: FolderOpen,
      label: "Workspace",
      route: "/workspace",
    },
    {
      id: "customer-test",
      icon: Eye,
      label: "Test",
      route: "/customer-test",
    },
    {
      id: "settings",
      icon: SettingsIcon,
      label: "Settings",
      route: "/settings",
    },
  ];

  const navItems = userType === "admin" ? adminNavItems : supportNavItems;

  // Helper function to check if a route is active (same as sidebar)
  const isActiveRoute = (route: string) => {
    const pathParts = pathname.split("/");
    const experienceIndex = pathParts.findIndex((part) =>
      part.startsWith("exp_")
    );
    if (experienceIndex === -1) return false;

    const routeAfterExperience =
      "/" + pathParts.slice(experienceIndex + 1).join("/");

    // Handle default route case
    if (routeAfterExperience === "/" && route === "/") {
      return true;
    }

    return routeAfterExperience === route;
  };

  // Helper function to build full href
  const buildFullHref = (route: string) => {
    return `/experiences/${experienceId}${route}`;
  };

  const handleNavigation = (route: string) => {
    router.push(buildFullHref(route));
  };

  return (
    <nav className="border-t border-border bg-card safe-area-inset-bottom">
      <div className="flex items-center justify-around px-4 py-3">
        {/* Navigation Items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(item.route);

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.route)}
              className={`
                flex flex-col items-center justify-center gap-1.5 px-4 py-1 rounded-lg
                transition-colors
                ${isActive ? "text-primary" : "text-muted-foreground"}
              `}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
