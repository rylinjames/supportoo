"use client";

import { useUser } from "@/app/contexts/user-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Building2 } from "lucide-react";

export function CompanySwitcher() {
  const { userData, switchCompany, getCurrentRole } = useUser();

  if (!userData || userData.userCompanies.length <= 1) {
    return null; // Don't show switcher if user only has one company
  }

  const currentRole = getCurrentRole();
  const currentCompany = userData.userCompanies.find(
    (uc) => uc.companyId === userData.currentCompanyId
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">
              {currentCompany?.companyName || "Unknown"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {userData.userCompanies.map((company) => (
          <DropdownMenuItem
            key={company.companyId}
            onClick={() => switchCompany(company.companyId)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">{company.companyName}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {company.role}
              </span>
            </div>
            {company.companyId === userData.currentCompanyId && (
              <div className="h-2 w-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
