"use client";

import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerUsername: string;
  customerAvatar?: string;
}

export function CustomerProfileModal({
  isOpen,
  onClose,
  customerName,
  customerUsername,
  customerAvatar,
}: CustomerProfileModalProps) {
  const initials = customerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleGoToWhop = () => {
    window.open(`https://whop.com/@${customerUsername}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] p-0">
        {/* Header with Avatar and Info */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          <Avatar className="h-20 w-20 mb-4">
            {customerAvatar ? (
              <img src={customerAvatar} alt={customerName} />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground text-h2">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>

          <DialogHeader className="sr-only">
            <DialogTitle>Customer Profile</DialogTitle>
          </DialogHeader>

          {/* Name and Username centered under avatar */}
          <div className="text-center">
            <p className="text-body-sm text-foreground font-medium mb-1">
              {customerName}
            </p>
            <p className="text-caption text-muted-foreground">
              @{customerUsername}
            </p>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleGoToWhop} className="flex-1">
            <ExternalLink className="h-4 w-4 mr-2" />
            Go to Whop Profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
