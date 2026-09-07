import { useState } from "react";
import { Activity } from "lucide-react";
import { useListPersonnel, useCreatePersonnel, useUpdatePersonnel, useDeletePersonnel, useListMotors, getListPersonnelQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Phone, Mail, MessageSquare, MoreVertical, Edit2, Trash2, HardHat } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiErrorState } from "@/components/api-error-state";

export function Personnel() {
  const { data: personnel, isLoading: personnelLoading, isError: isPersonnelError } = useListPersonnel();
  const { data: motors, isLoading: motorsLoading, isError: isMotorsError } = useListMotors();
  const personnelRecords = Array.isArray(personnel)
    ? personnel.filter((person) => Boolean(person) && typeof person === "object")
    : [];
  const motorRecords = Array.isArray(motors)
    ? motors.filter((motor) => Boolean(motor) && typeof motor === "object")
    : [];
  const isLoading = personnelLoading || motorsLoading;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreatePersonnel();
  const updateMutation = useUpdatePersonnel();
  const deleteMutation = useDeletePersonnel();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    role: "Technician",
    teamName: "Maintenance Shift A",
    contact: "",
    telegramId: "",
    assignedMotorIds: [] as number[],
  });

  const handleOpenCreate = () => {
    setSelectedId(null);
    setFormData({
      name: "",
      role: "Technician",
      teamName: "Maintenance Shift A",
      contact: "",
      telegramId: "",
      assignedMotorIds: [],
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (person: any) => {
    setSelectedId(person.id);
    setFormData({
      name: person.name,
      role: person.role,
      teamName: person.teamName,
      contact: person.contact,
      telegramId: person.telegramId || "",
      assignedMotorIds: Array.isArray(person.assignedMotorIds) ? person.assignedMotorIds : [],
    });
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.contact) {
      toast({ title: "Validation Error", description: "Name and contact are required", variant: "destructive" });
      return;
    }

    const payload = {
      data: {
        name: formData.name,
        role: formData.role,
        teamName: formData.teamName,
        contact: formData.contact,
        telegramId: formData.telegramId || undefined,
        assignedMotorIds: formData.assignedMotorIds,
      }
    };

    if (selectedId) {
      updateMutation.mutate(
        { id: selectedId, data: payload.data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPersonnelQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Personnel Updated" });
          }
        }
      );
    } else {
      createMutation.mutate(
        payload,
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPersonnelQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Personnel Added" });
          }
        }
      );
    }
  };

  const confirmDelete = () => {
    if (!selectedId) return;
    deleteMutation.mutate(
      { id: selectedId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPersonnelQueryKey() });
          setIsDeleteDialogOpen(false);
          toast({ title: "Personnel Removed" });
        }
      }
    );
  };

  // Helper to get motor names by id
  const getAssignedMotorNames = (ids?: number[]) => {
    if (motorRecords.length === 0 || !Array.isArray(ids) || ids.length === 0) return "No specific assignments";
    return ids.map(id => motorRecords.find(m => m.id === id)?.name || `ID:${id}`).join(", ");
  };

  const toggleMotorAssignment = (motorId: number, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      assignedMotorIds: checked
        ? [...current.assignedMotorIds, motorId]
        : current.assignedMotorIds.filter((id) => id !== motorId),
    }));
  };

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Maintenance Personnel
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage engineering teams and alert routing targets.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[0_0_15px_rgba(26,214,104,0.3)]">
          <Plus className="h-4 w-4 mr-2" />
          Add Personnel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : isPersonnelError ? (
          <div className="col-span-full">
            <ApiErrorState message="Unable to load maintenance personnel." />
          </div>
        ) : personnelRecords.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 bg-card rounded-lg border border-dashed border-border text-muted-foreground">
            <HardHat className="h-12 w-12 mb-4 opacity-20" />
            <p>No personnel records found.</p>
          </div>
        ) : (
          personnelRecords.map((person) => (
            <Card key={person.id} className="border-border bg-card hover:bg-muted/10 transition-colors group relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent opacity-50"></div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-center mb-4">
                    <Avatar className="h-12 w-12 border border-border">
                      <AvatarFallback className="bg-black text-primary font-bold">
                        {String(person.name ?? "").split(" ").filter(Boolean).map(n => n[0]).join("").substring(0, 2).toUpperCase() || "—"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{person.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border bg-background">
                          {person.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {person.teamName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(person)} className="cursor-pointer">
                        <Edit2 className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedId(person.id); setIsDeleteDialogOpen(true); }} className="cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mt-2 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-3 text-sm text-foreground/80">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{person.contact}</span>
                  </div>
                  {person.telegramId && (
                    <div className="flex items-center gap-3 text-sm text-foreground/80">
                      <MessageSquare className="h-4 w-4 text-[#0088cc] shrink-0" />
                      <span className="truncate">@{person.telegramId}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3 text-sm text-foreground/80 mt-2 pt-2 border-t border-border/20">
                    <Activity className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground leading-tight">
                      <span className="font-semibold text-foreground/80 block mb-0.5">Assigned to:</span>
                      {getAssignedMotorNames(person.assignedMotorIds)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{selectedId ? 'Edit Personnel' : 'Add Personnel'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-background border-border" 
                placeholder="Abebe Kebede" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Input 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="bg-background border-border" 
                />
              </div>
              <div className="grid gap-2">
                <Label>Team</Label>
                <Input 
                  value={formData.teamName}
                  onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                  className="bg-background border-border" 
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Phone / Email</Label>
              <Input 
                value={formData.contact}
                onChange={(e) => setFormData({...formData, contact: e.target.value})}
                className="bg-background border-border" 
                placeholder="+251 911 000000" 
              />
            </div>
            <div className="grid gap-2">
              <Label>Telegram Handle (for alert bot)</Label>
              <Input 
                value={formData.telegramId}
                onChange={(e) => setFormData({...formData, telegramId: e.target.value})}
                className="bg-background border-border" 
                placeholder="abebe_k" 
              />
            </div>
            <div className="grid gap-2">
              <Label>Assigned Motors</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
                {isMotorsError ? (
                  <p className="text-xs text-destructive">Motor assignments are temporarily unavailable.</p>
                ) : motorRecords.length > 0 ? (
                  motorRecords.map((motor) => (
                  <label key={motor.id} className="flex cursor-pointer items-center gap-3 text-sm">
                    <Checkbox
                      checked={formData.assignedMotorIds.includes(motor.id)}
                      onCheckedChange={(checked) => toggleMotorAssignment(motor.id, checked === true)}
                    />
                    <span className="truncate">{motor.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">MTR-{motor.id.toString().padStart(4, "0")}</span>
                  </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No motors are registered yet.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Alert routing and technician coverage will use these motor assignments.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="border-border">Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-card border-destructive sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove Personnel</DialogTitle>
            <DialogDescription>
              Remove this person from the active roster? Alert routing to their Telegram will be stopped immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-border">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              Yes, Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
