"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/app/contexts/user-context";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DepartmentsTab() {
  const { userData, isLoading: userLoading } = useUser();
  const companyId = userData?.currentCompanyId as Id<"companies"> | undefined;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const company = useQuery(
    api.companies.queries.getCompanyById,
    companyId ? { companyId } : "skip"
  );

  const departments = useQuery(
    api.departments.queries.listDepartments,
    companyId ? { companyId } : "skip"
  );

  const teamMembers = useQuery(
    api.users.team_queries.getTeamMembers,
    companyId ? { companyId } : "skip"
  );

  const createDepartment = useMutation(api.departments.mutations.createDepartment);
  const updateDepartment = useMutation(api.departments.mutations.updateDepartment);
  const deleteDepartment = useMutation(api.departments.mutations.deleteDepartment);
  const toggleEnabled = useMutation(api.departments.mutations.toggleDepartmentsEnabled);
  const assignAgent = useMutation(api.departments.mutations.assignAgentToDepartment);
  const removeAgent = useMutation(api.departments.mutations.removeAgentFromDepartment);

  const handleCreate = async () => {
    if (!companyId || !userData?.user?._id || !name.trim()) return;
    try {
      await createDepartment({
        companyId,
        name: name.trim(),
        description: description.trim() || undefined,
        createdBy: userData.user._id as Id<"users">,
      });
      toast.success(`Department "${name}" created`);
      setIsCreateOpen(false);
      setName("");
      setDescription("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create department");
    }
  };

  const handleEdit = async () => {
    if (!selectedDept || !name.trim()) return;
    try {
      await updateDepartment({
        departmentId: selectedDept._id,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Department updated");
      setIsEditOpen(false);
      setSelectedDept(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  const handleDelete = async () => {
    if (!selectedDept) return;
    try {
      await deleteDepartment({ departmentId: selectedDept._id });
      toast.success("Department deleted");
      setIsDeleteOpen(false);
      setSelectedDept(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const handleToggleActive = async (dept: any) => {
    try {
      await updateDepartment({
        departmentId: dept._id,
        isActive: !dept.isActive,
      });
      toast.success(dept.isActive ? "Department deactivated" : "Department activated");
    } catch (error) {
      toast.error("Failed to update department");
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!companyId) return;
    try {
      await toggleEnabled({ companyId, enabled });
      toast.success(enabled ? "Department routing enabled" : "Department routing disabled");
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  const handleAssignAgent = async () => {
    if (!selectedDept || !selectedAgentId || !companyId) return;
    try {
      await assignAgent({
        userId: selectedAgentId as Id<"users">,
        companyId,
        departmentId: selectedDept._id,
      });
      toast.success("Agent assigned to department");
      setSelectedAgentId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign");
    }
  };

  const handleRemoveAgent = async (agentId: string) => {
    if (!selectedDept || !companyId) return;
    try {
      await removeAgent({
        userId: agentId as Id<"users">,
        companyId,
        departmentId: selectedDept._id,
      });
      toast.success("Agent removed from department");
    } catch (error) {
      toast.error("Failed to remove agent");
    }
  };

  const openEditDialog = (dept: any) => {
    setSelectedDept(dept);
    setName(dept.name);
    setDescription(dept.description || "");
    setIsEditOpen(true);
  };

  const openDeleteDialog = (dept: any) => {
    setSelectedDept(dept);
    setIsDeleteOpen(true);
  };

  const openAssignDialog = (dept: any) => {
    setSelectedDept(dept);
    setSelectedAgentId("");
    setIsAssignOpen(true);
  };

  // Get agents assigned to a department
  const getAssignedAgents = (deptId: string) => {
    if (!teamMembers) return [];
    return teamMembers.filter(
      (m: any) => m.departmentIds?.includes(deptId)
    );
  };

  // Get agents NOT assigned to a department (for the assign dropdown)
  const getUnassignedAgents = (deptId: string) => {
    if (!teamMembers) return [];
    return teamMembers.filter(
      (m: any) =>
        (m.role === "admin" || m.role === "support") &&
        !m.departmentIds?.includes(deptId)
    );
  };

  if (userLoading || !userData) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const isEnabled = company?.departmentsEnabled ?? false;

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
        <div>
          <h3 className="text-sm font-medium text-foreground">Department Routing</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            When enabled, the bot asks customers to choose a department before handing off to your team
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggleEnabled}
        />
      </div>

      {!isEnabled && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Enable department routing above to set up departments for your team.
        </div>
      )}

      {isEnabled && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {departments?.length || 0} departments
              </span>
            </div>
            <Button
              onClick={() => {
                setName("");
                setDescription("");
                setIsCreateOpen(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Department
            </Button>
          </div>

          {/* Departments List */}
          <div className="grid gap-3">
            {departments?.map((dept: any) => {
              const assignedAgents = getAssignedAgents(dept._id);
              return (
                <div
                  key={dept._id}
                  className="p-4 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{dept.name}</span>
                        <Badge
                          className={cn(
                            "text-xs",
                            dept.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                          )}
                        >
                          {dept.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {dept.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {dept.description}
                        </p>
                      )}

                      {/* Assigned Agents */}
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {assignedAgents.length === 0
                            ? "No agents assigned"
                            : `${assignedAgents.length} agent${assignedAgents.length > 1 ? "s" : ""}: ${assignedAgents.map((a: any) => a.displayName.split(" ")[0]).join(", ")}`}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openAssignDialog(dept)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Manage Agents
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(dept)}>
                          <Building2 className="h-4 w-4 mr-2" />
                          {dept.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(dept)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => openDeleteDialog(dept)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          {departments?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-secondary mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No departments yet
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Create departments so the bot can route customers to the right team
              </p>
              <Button
                onClick={() => {
                  setName("");
                  setDescription("");
                  setIsCreateOpen(true);
                }}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Department
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Department</DialogTitle>
            <DialogDescription>
              Add a department that customers can choose during handoff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Billing, Technical Support"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g. Payment issues, refunds, pricing questions"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedDept?.name}&quot;? This will
              unassign all agents and remove the department from any active conversations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Agents Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Manage Agents - {selectedDept?.name}
            </DialogTitle>
            <DialogDescription>
              Assign team members to this department. They will receive notifications
              when conversations are routed here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add agent */}
            <div className="flex gap-2">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedDept &&
                    getUnassignedAgents(selectedDept._id).map((agent: any) => (
                      <SelectItem key={agent._id} value={agent._id}>
                        {agent.displayName} (@{agent.whopUsername})
                      </SelectItem>
                    ))}
                  {selectedDept &&
                    getUnassignedAgents(selectedDept._id).length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        All agents are already assigned
                      </div>
                    )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAssignAgent}
                disabled={!selectedAgentId}
                size="sm"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {/* Current agents */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Assigned Agents
              </Label>
              {selectedDept &&
                getAssignedAgents(selectedDept._id).map((agent: any) => (
                  <div
                    key={agent._id}
                    className="flex items-center justify-between p-2 rounded border border-border"
                  >
                    <div>
                      <span className="text-sm font-medium">
                        {agent.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        @{agent.whopUsername}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveAgent(agent._id)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              {selectedDept &&
                getAssignedAgents(selectedDept._id).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No agents assigned yet. All team agents will receive
                    notifications for this department.
                  </p>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAssignOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
