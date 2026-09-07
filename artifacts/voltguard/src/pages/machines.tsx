import { useState } from "react";
import {
  useListMotors,
  useCreateMotor,
  useUpdateMotor,
  useDeleteMotor,
  getListMotorsQueryKey,
  getListFaultsQueryKey,
  getGetSystemSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MotorStatusBadge, HealthScoreBadge } from "@/components/ui/badges";
import { Progress } from "@/components/ui/progress";
import { Search, Plus, MoreVertical, Edit2, Trash2, MapPin, Cpu, Zap, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiErrorState } from "@/components/api-error-state";

export function Machines() {
  const { data: motors, isLoading, isError: isMotorsError } = useListMotors({
    query: { refetchInterval: 30000, queryKey: getListMotorsQueryKey() },
  });
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateMotor();
  const updateMutation = useUpdateMotor();
  const deleteMutation = useDeleteMotor();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [selectedMotorId, setSelectedMotorId] = useState<number | null>(null);
  const [selectedMotorIds, setSelectedMotorIds] = useState<Set<number>>(new Set());

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    motorType: "Induction",
    status: "running" as const
  });

  const motorRecords = Array.isArray(motors) ? motors : [];
  const filteredMotors = motorRecords.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.location.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const visibleMotorIds = filteredMotors?.map((motor) => motor.id) ?? [];
  const allVisibleMotorsSelected =
    visibleMotorIds.length > 0 && visibleMotorIds.every((id) => selectedMotorIds.has(id));

  const toggleMotorSelection = (motorId: number) => {
    setSelectedMotorIds((current) => {
      const next = new Set(current);
      if (next.has(motorId)) {
        next.delete(motorId);
      } else {
        next.add(motorId);
      }
      return next;
    });
  };

  const toggleAllVisibleMotors = () => {
    setSelectedMotorIds((current) => {
      const next = new Set(current);
      if (allVisibleMotorsSelected) {
        visibleMotorIds.forEach((id) => next.delete(id));
      } else {
        visibleMotorIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleOpenCreate = () => {
    setSelectedMotorId(null);
    setFormData({ name: "", location: "", motorType: "Induction", status: "running" });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (motor: any) => {
    setSelectedMotorId(motor.id);
    setFormData({
      name: motor.name,
      location: motor.location,
      motorType: motor.motorType,
      status: motor.status
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const name = formData.name.trim();
    const location = formData.location.trim();
    const motorType = formData.motorType.trim();

    if (!name || !location || !motorType) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    try {
      if (selectedMotorId !== null) {
        const updatedMotor = await updateMutation.mutateAsync({
          id: selectedMotorId,
          data: { name, location, motorType, status: formData.status },
        });

        queryClient.setQueryData(getListMotorsQueryKey(), (current: unknown) => {
          if (!Array.isArray(current)) return [updatedMotor];
          return current.map((motor) => motor?.id === updatedMotor.id ? updatedMotor : motor);
        });
        void queryClient.invalidateQueries({ queryKey: getListMotorsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetSystemSummaryQueryKey() });
        setIsFormOpen(false);
        toast({ title: "Motor Updated", description: "Machine details saved successfully." });
        return;
      }

      const createdMotor = await createMutation.mutateAsync({
        data: { name, location, motorType, status: formData.status },
      });

      queryClient.setQueryData(getListMotorsQueryKey(), (current: unknown) => {
        const currentMotors = Array.isArray(current) ? current : [];
        return [createdMotor, ...currentMotors.filter((motor) => motor?.id !== createdMotor.id)];
      });
      void queryClient.invalidateQueries({ queryKey: getListMotorsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetSystemSummaryQueryKey() });
      setIsFormOpen(false);
      toast({ title: "Motor Registered", description: "New machine added to the grid." });
    } catch (error) {
      toast({
        title: selectedMotorId !== null ? "Motor Update Failed" : "Motor Registration Failed",
        description: error instanceof Error ? error.message : "Unable to save the motor right now. Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = () => {
    if (selectedMotorId === null) return;
    deleteMutation.mutate(
      { id: selectedMotorId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMotorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListFaultsQueryKey() });
          setIsDeleteDialogOpen(false);
          setSelectedMotorIds((current) => {
            const next = new Set(current);
            next.delete(selectedMotorId);
            return next;
          });
          toast({ title: "Motor Removed", description: "Machine has been removed from the registry." });
        }
      }
    );
  };

  const confirmBulkDelete = async () => {
    const idsToDelete = Array.from(selectedMotorIds);
    if (idsToDelete.length === 0) return;

    const results = await Promise.allSettled(
      idsToDelete.map((id) => deleteMutation.mutateAsync({ id })),
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;
    const deletedIds = idsToDelete.filter((_, index) => results[index].status === "fulfilled");

    queryClient.invalidateQueries({ queryKey: getListMotorsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListFaultsQueryKey() });
    setSelectedMotorIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    setIsBulkDeleteDialogOpen(false);

    if (failedCount > 0) {
      toast({
        title: "Some machines could not be removed",
        description: `${deletedIds.length} removed, ${failedCount} failed. Please try again.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Machines Removed",
        description: `${deletedIds.length} machine${deletedIds.length === 1 ? "" : "s"} removed from the registry.`,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Cpu className="h-8 w-8 text-primary" />
            Machine Registry
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage monitored assets and industrial motors.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search machines..." 
              className="pl-9 bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {selectedMotorIds.size > 0 && (
            <Button
              variant="destructive"
              size="icon"
              title={`Delete ${selectedMotorIds.size} selected machine${selectedMotorIds.size === 1 ? "" : "s"}`}
              aria-label={`Delete ${selectedMotorIds.size} selected machine${selectedMotorIds.size === 1 ? "" : "s"}`}
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[0_0_15px_rgba(26,214,104,0.3)]">
            <Plus className="h-4 w-4 mr-2" />
            Register Motor
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card overflow-hidden shadow-lg flex-1 min-h-0 flex flex-col">
        <CardContent className="p-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : isMotorsError ? (
            <ApiErrorState message="Unable to load the motor registry." />
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-black/40 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-medium">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allVisibleMotorsSelected}
                        onCheckedChange={toggleAllVisibleMotors}
                        aria-label="Select all visible machines"
                        disabled={visibleMotorIds.length === 0}
                      />
                      <span>Machine ID & Name</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Health & Risk</th>
                  <th className="px-6 py-4 font-medium">Telemetry (THD / dB)</th>
                  <th className="px-6 py-4 font-medium">Installed</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredMotors.map((motor) => (
                  <tr key={motor.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <Checkbox
                           checked={selectedMotorIds.has(motor.id)}
                           onCheckedChange={() => toggleMotorSelection(motor.id)}
                           aria-label={`Select ${motor.name}`}
                         />
                        <div className="h-10 w-10 rounded bg-black/50 border border-border flex items-center justify-center shrink-0">
                          <Cpu className={`h-5 w-5 ${motor.status === 'stopped' ? 'text-destructive' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{motor.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">ID: MTR-{motor.id.toString().padStart(4, '0')} | {motor.motorType}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {motor.location}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <MotorStatusBadge status={motor.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 w-32">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Health: <HealthScoreBadge score={motor.healthScore} /></span>
                        </div>
                        <Progress 
                          value={motor.healthScore} 
                          className="h-1.5"
                          indicatorColor={motor.healthScore < 50 ? 'bg-destructive' : motor.healthScore < 80 ? 'bg-[hsl(var(--chart-2))]' : 'bg-primary'}
                        />
                        <div className="text-[10px] text-muted-foreground mt-1">
                          RUL unavailable pending Survival Model
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs font-mono">
                        <div className="flex items-center justify-between w-24">
                          <span className="text-muted-foreground">THD:</span>
                          <span className={motor.currentThd > 5 ? "text-[hsl(var(--chart-2))]" : "text-foreground"}>
                            {typeof motor.currentThd === "number" ? `${motor.currentThd.toFixed(1)}%` : "Unavailable"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between w-24">
                          <span className="text-muted-foreground">VIB:</span>
                          <span className={motor.currentDb > 85 ? "text-destructive" : "text-foreground"}>
                            {typeof motor.currentDb === "number" ? `${motor.currentDb.toFixed(1)}dB` : "Unavailable"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {format(new Date(motor.installedAt), "MMM yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem onClick={() => handleOpenEdit(motor)} className="cursor-pointer">
                            <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => { setSelectedMotorId(motor.id); setIsDeleteDialogOpen(true); }}
                            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Motor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {motorRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No machines are registered yet. Use “Register Motor” to add the first machine.
                    </td>
                  </tr>
                )}
                {motorRecords.length > 0 && filteredMotors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No machines found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>{selectedMotorId ? 'Edit Motor' : 'Register New Motor'}</DialogTitle>
            <DialogDescription>
              {selectedMotorId ? 'Update configuration for this machine.' : 'Add a new asset to the monitoring grid.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Machine Name</Label>
              <Input 
                id="name" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-background border-border" 
                placeholder="e.g. Main Conveyor Drive" 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location / Zone</Label>
              <Input 
                id="location" 
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="bg-background border-border" 
                placeholder="e.g. Line A, Sector 4" 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Motor Type</Label>
              <Input 
                id="type" 
                value={formData.motorType}
                onChange={(e) => setFormData({...formData, motorType: e.target.value})}
                className="bg-background border-border" 
                placeholder="e.g. 3-Phase Induction" 
              />
            </div>
            {selectedMotorId && (
              <div className="grid gap-2">
                <Label htmlFor="status">Override Status</Label>
                <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="running">Running (Normal)</SelectItem>
                    <SelectItem value="warning">Warning (Maintenance Required)</SelectItem>
                    <SelectItem value="stopped">Stopped (Offline/Fault)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="border-border">Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirm Removal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this motor from the system? All historical telemetry and fault logs associated with this ID will be orphaned. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-border">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Removing..." : "Yes, Remove Motor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Selected Machines
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMotorIds.size} selected machine{selectedMotorIds.size === 1 ? "" : "s"}? Their historical telemetry and fault logs will be orphaned. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)} className="border-border">Cancel</Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Removing..." : "Yes, Remove Selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
