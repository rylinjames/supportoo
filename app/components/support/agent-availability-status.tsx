"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Circle, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type AvailabilityStatus = "available" | "busy" | "offline";

export function AgentAvailabilityStatus() {
  const settings = useQuery(api.agentSettings.getSettings);
  const updateAvailability = useMutation(api.agentSettings.updateAvailability);
  const [status, setStatus] = useState<AvailabilityStatus>("available");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (settings) {
      setStatus(settings.availabilityStatus);
    }
  }, [settings]);

  const handleStatusChange = async (newStatus: AvailabilityStatus) => {
    if (newStatus === status) return;

    setIsUpdating(true);
    try {
      await updateAvailability({ status: newStatus });
      setStatus(newStatus);
      toast.success(`Status updated to ${getStatusLabel(newStatus)}`);
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: AvailabilityStatus) => {
    switch (status) {
      case "available":
        return "text-green-500";
      case "busy":
        return "text-yellow-500";
      case "offline":
        return "text-gray-500";
    }
  };

  const getStatusLabel = (status: AvailabilityStatus) => {
    switch (status) {
      case "available":
        return "Available";
      case "busy":
        return "Busy";
      case "offline":
        return "Offline";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isUpdating}
          className="gap-2"
        >
          <Circle className={`h-2 w-2 fill-current ${getStatusColor(status)}`} />
          <span>{getStatusLabel(status)}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleStatusChange("available")}
          className="gap-2"
        >
          <Circle className="h-2 w-2 fill-current text-green-500" />
          Available
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStatusChange("busy")}
          className="gap-2"
        >
          <Circle className="h-2 w-2 fill-current text-yellow-500" />
          Busy
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStatusChange("offline")}
          className="gap-2"
        >
          <Circle className="h-2 w-2 fill-current text-gray-500" />
          Offline
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}