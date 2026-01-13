"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, MoreHorizontal, Shield, Trash2, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TeamMember = Doc<"users">;

// Role badge styling
const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "manager":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "support":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
};

// Get initials from display name
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function TeamTab() {
  const { userData, isLoading, getCurrentRole } = useUser();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "support">(
    "support"
  );
  const [addMethod, setAddMethod] = useState<"existing" | "username">(
    "username"
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [manualUsername, setManualUsername] = useState("");

  // Queries
  const teamMembers = useQuery(
    api.users.team_queries.getTeamMembers,
    userData?.currentCompanyId
      ? { companyId: userData.currentCompanyId as Id<"companies"> }
      : "skip"
  );

  // Mutations
  const removeMember = useMutation(api.users.team_mutations.removeTeamMember);
  const changeUserRole = useMutation(api.users.team_mutations.changeUserRole);

  // Actions
  const addMemberWithVerification = useAction(api.users.team_actions.addTeamMemberWithVerification);

  // Get available users for promotion
  const availableUsers =
    teamMembers?.filter((member: any) => member.role === "support") || [];

  const handleAddMember = async () => {
    try {
      if (!isAdmin) {
        toast.error("Only admins can add team members");
        return;
      }

      if (!userData?.user?.whopUserId) {
        toast.error("User not authenticated. Please refresh the page and try again.");
        return;
      }

      const actualRole = selectedRole;

      if (addMethod === "existing" && selectedUserId) {
        const user = availableUsers.find((u: any) => u._id === selectedUserId);
        if (user) {
          const result = await addMemberWithVerification({
            whopUsername: user.whopUsername,
            role: actualRole as "admin" | "support",
            companyId: userData.currentCompanyId as Id<"companies">,
            callerWhopUserId: userData.user.whopUserId,
          });

          if (result.notificationSent) {
            toast.success(
              `${result.displayName || user.displayName} added as ${actualRole} and notified!`
            );
          } else if (result.notificationError) {
            toast.warning(
              `${result.displayName || user.displayName} added to team. ${result.notificationError}`,
              { duration: 6000 }
            );
          } else {
            toast.success(`${result.displayName || user.displayName} added as ${actualRole}`);
          }
        }
      } else if (addMethod === "username" && manualUsername) {
        const result = await addMemberWithVerification({
          whopUsername: manualUsername,
          role: actualRole as "admin" | "support",
          companyId: userData.currentCompanyId as Id<"companies">,
          callerWhopUserId: userData.user.whopUserId,
        });

        const displayName = result.displayName || manualUsername;

        if (result.notificationSent) {
          toast.success(
            `@${displayName} added as ${actualRole} and notified!`
          );
        } else if (result.notificationError) {
          toast.warning(
            `@${displayName} added as ${actualRole}. ${result.notificationError}`,
            { duration: 6000 }
          );
        } else {
          toast.success(`@${displayName} added as ${actualRole}`);
        }
      }

      setIsAddDialogOpen(false);
      setSelectedUserId("");
      setManualUsername("");
      setAddMethod("existing");
      setSelectedRole("support");
    } catch (error) {
      console.error("Error adding team member:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add team member"
      );
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToDelete) return;

    try {
      await removeMember({
        userId: memberToDelete._id,
        companyId: userData?.currentCompanyId as Id<"companies">,
        callerWhopUserId: userData?.user.whopUserId || "",
      });
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      toast.success("Team member removed");
    } catch (error) {
      console.error("Error removing team member:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove team member"
      );
    }
  };

  const openDeleteDialog = (member: TeamMember) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handlePromoteToAdmin = async (member: TeamMember) => {
    try {
      await changeUserRole({
        userId: member._id,
        newRole: "admin",
        companyId: userData?.currentCompanyId as Id<"companies">,
        callerWhopUserId: userData?.user.whopUserId || "",
      });
      toast.success(`${member.displayName} promoted to admin`);
    } catch (error) {
      console.error("Error promoting user:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to promote user"
      );
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp));
  };

  // Determine owner (first admin by join time)
  const owner = teamMembers
    ?.filter((m: any) => m.role === "admin")
    .sort((a: any, b: any) => (a.joinedAt || a._creationTime) - (b.joinedAt || b._creationTime))[0];

  // Check if current user is admin
  const currentUserRole = getCurrentRole();
  const isAdmin = currentUserRole === "admin";

  // Loading state
  if (isLoading || !userData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {teamMembers?.length || 0} team members
          </span>
        </div>
        {isAdmin ? (
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add Member
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Only admins can manage team
          </span>
        )}
      </div>

      {/* Team Members Grid */}
      <div className="grid gap-3">
        {teamMembers?.map((member: any) => {
          const isPending = member.whopUserId?.startsWith("pending_");
          const isOwner = member._id === owner?._id;
          const canManage = isAdmin && !isOwner;

          return (
            <div
              key={member._id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
            >
              {/* Avatar & Info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(member.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {member.displayName}
                    </span>
                    {isOwner && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                        Owner
                      </Badge>
                    )}
                    {isPending && (
                      <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>@{member.whopUsername}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(member.joinedAt || member._creationTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Role & Actions */}
              <div className="flex items-center gap-3">
                <Badge className={cn("text-xs", getRoleBadgeStyle(member.role))}>
                  {member.role === "admin" ? "Admin" :
                   member.role === "manager" ? "Manager" :
                   member.role === "viewer" ? "Viewer" : "Support"}
                </Badge>

                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {member.role === "support" && (
                        <DropdownMenuItem onClick={() => handlePromoteToAdmin(member)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Promote to Admin
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => openDeleteDialog(member)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {teamMembers?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-full bg-secondary mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No team members yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Add team members to help manage your support workspace
          </p>
          {isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add First Member
            </Button>
          )}
        </div>
      )}

      {/* Add Team Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new team member to your workspace. They will have access
              based on their assigned role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role-select">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => {
                  const newRole = v as "admin" | "support";
                  setSelectedRole(newRole);
                  if (newRole !== "admin") {
                    setAddMethod("username");
                    setSelectedUserId("");
                  }
                }}
              >
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Choose a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full Access</SelectItem>
                  <SelectItem value="support">Support - Handle Tickets</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Method Selection - Segmented control for Admin role */}
            {selectedRole === "admin" && (
              <div className="space-y-2">
                <Label>Add Method</Label>
                <div className="inline-flex p-1 rounded-lg bg-secondary w-full">
                  <button
                    onClick={() => setAddMethod("existing")}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      addMethod === "existing"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Promote Existing
                  </button>
                  <button
                    onClick={() => setAddMethod("username")}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      addMethod === "username"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Enter Username
                  </button>
                </div>
              </div>
            )}

            {/* Existing User Selection */}
            {selectedRole === "admin" && addMethod === "existing" && (
              <div className="space-y-2">
                <Label htmlFor="user-select">Select User</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger id="user-select">
                    <SelectValue placeholder="Choose a support user to promote..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No support users to promote
                      </div>
                    ) : (
                      availableUsers.map((user: any) => (
                        <SelectItem key={user._id} value={user._id}>
                          <div className="flex flex-col">
                            <span>{user.displayName}</span>
                            <span className="text-xs text-muted-foreground">
                              @{user.whopUsername}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Manual Username Entry */}
            {(selectedRole === "support" || addMethod === "username") && (
              <div className="space-y-2">
                <Label htmlFor="username-input">Whop Username</Label>
                <Input
                  id="username-input"
                  placeholder="Enter username..."
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the exact Whop username of the person you want to add
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={
                (addMethod === "existing" && !selectedUserId) ||
                ((addMethod === "username" || selectedRole === "support") &&
                  !manualUsername.trim())
              }
            >
              Add Team Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove{" "}
              {memberToDelete?.role === "admin" ? "Admin" : "Support Agent"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToDelete?.displayName} (@
              {memberToDelete?.whopUsername}) as{" "}
              {memberToDelete?.role === "admin"
                ? "an admin"
                : "a support agent"}
              ? They will no longer have access to the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
