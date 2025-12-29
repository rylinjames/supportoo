"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

type TeamMember = Doc<"users">;

export function TeamTab() {
  const { userData, isLoading, getCurrentRole } = useUser();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "support">(
    "support"
  );
  const [addMethod, setAddMethod] = useState<"existing" | "username">(
    "username" // Default to username since support is the default role
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
  const addMember = useMutation(api.users.team_mutations.addTeamMember);
  const removeMember = useMutation(api.users.team_mutations.removeTeamMember);
  const changeUserRole = useMutation(api.users.team_mutations.changeUserRole);

  // Actions
  const addMemberWithVerification = useAction(api.users.team_actions.addTeamMemberWithVerification);
  const sendTeamInvitationNotificationByUserId = useAction(
    api.notifications.whop.sendTeamInvitationNotificationByUserId
  );

  // Get available users (mock for now - in real implementation, this would be a query)
  const availableUsers =
    teamMembers?.filter((member: any) => member.role === "support") || [];

  const handleAddMember = async () => {
    try {
      // Check if user is admin
      if (!isAdmin) {
        toast.error("Only admins can add team members");
        return;
      }
      
      // Check if user data is available
      console.log("userData:", userData);
      console.log("whopUserId:", userData?.user?.whopUserId);
      console.log("currentRole:", currentUserRole);
      
      if (!userData?.user?.whopUserId) {
        toast.error("User not authenticated. Please refresh the page and try again.");
        return;
      }
      
      const actualRole = selectedRole; // Now only admin/support are available
      
      if (addMethod === "existing" && selectedUserId) {
        const user = availableUsers.find((u: any) => u._id === selectedUserId);
        if (user) {
          // Use the action with verification for existing users too
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
        // Use the new action with Whop verification
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
        callerWhopUserId: userData?.user.whopUserId || "", // NEW
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

  // Show loading state if user data is not ready
  if (isLoading || !userData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading team members...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Actions */}
      <div className="flex items-center justify-between max-w-[700px]">
        <h2 className="text-body-sm text-muted-foreground">
          Team Members ({teamMembers?.length || 0})
        </h2>
        {isAdmin ? (
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add Team Member
          </Button>
        ) : (
          <div className="text-caption text-muted-foreground">
            Only admins can add team members
          </div>
        )}
      </div>

      {/* Team Members List - Clean table */}
      <div className="max-w-[700px]">
        <div className="border border-border rounded-md overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[3fr_1.5fr_auto] gap-4 px-4 py-2 bg-secondary border-b border-border">
            <div className="text-caption text-muted-foreground">Name</div>
            <div className="text-caption text-muted-foreground">Added</div>
            <div className="w-10"></div>
          </div>

          {/* Table Rows */}
          {teamMembers?.map((member: any, index: number) => {
            const isPending = member.whopUserId?.startsWith("pending_");
            const isOwner = member._id === owner?._id;

            return (
              <div
                key={member._id}
                className={`grid grid-cols-[3fr_1.5fr_auto] gap-4 px-4 py-3 hover:bg-secondary/50 transition-colors ${
                  index !== teamMembers.length - 1
                    ? "border-b border-border"
                    : ""
                }`}
              >
                {/* Name */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-body-sm text-foreground truncate">
                      {member.displayName}
                    </p>
                    {isOwner && (
                      <span className="text-caption text-primary shrink-0">
                        Owner
                      </span>
                    )}
                    <span className="text-caption text-muted-foreground shrink-0">
                      {member.role === "admin" ? "Admin" : 
                       member.role === "manager" ? "Manager" :
                       member.role === "viewer" ? "Viewer" : "Support"}
                    </span>
                    {isPending && (
                      <span className="text-caption text-warning shrink-0">
                        Pending Invite
                      </span>
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground truncate">
                    @{member.whopUsername}
                  </p>
                </div>

                {/* Date Added */}
                <div className="min-w-0 flex items-center">
                  <p className="text-body-sm text-muted-foreground truncate">
                    {formatDate(member.joinedAt || member._creationTime)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                  {member._id !== owner?._id && isAdmin && (
                    <>
                      {member.role === "support" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePromoteToAdmin(member)}
                          className="h-8 text-body-sm"
                        >
                          Promote to Admin
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(member)}
                        className="h-8 text-body-sm text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </>
                  )}
                  {(member._id === owner?._id || !isAdmin) && <div className="w-8"></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                  // Auto-switch to username input for non-admin roles
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

            {/* Method Selection - Only show for Admin role */}
            {selectedRole === "admin" && (
              <RadioGroup
                value={addMethod}
                onValueChange={(v) =>
                  setAddMethod(v as "existing" | "username")
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label
                    htmlFor="existing"
                    className="text-body-sm cursor-pointer"
                  >
                    Promote existing support user
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="username" id="username" />
                  <Label
                    htmlFor="username"
                    className="text-body-sm cursor-pointer"
                  >
                    Enter Whop username
                  </Label>
                </div>
              </RadioGroup>
            )}

            {/* Existing User Selection - Only for Admin role */}
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
                      <div className="px-2 py-6 text-center text-body-sm text-muted-foreground">
                        No available users
                      </div>
                    ) : (
                      availableUsers.map((user: any) => (
                        <SelectItem key={user._id} value={user._id}>
                          <div className="flex flex-col">
                            <span>{user.displayName}</span>
                            <span className="text-caption text-muted-foreground">
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

            {/* Manual Username Entry - For Support or when username method selected */}
            {(selectedRole === "support" || addMethod === "username") && (
              <div className="space-y-2">
                <Label htmlFor="username-input">Whop Username</Label>
                <Input
                  id="username-input"
                  placeholder="Enter username..."
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                />
                <p className="text-caption text-muted-foreground">
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
