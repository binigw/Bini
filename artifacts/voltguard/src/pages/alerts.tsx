import { useState, useMemo } from "react";
import { useListAlerts, useAcknowledgeAlert, getListAlertsQueryKey, getGetLiveAlertsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Bell, CheckCircle2, Clock, Filter, Loader2, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { SeverityBadge } from "@/components/ui/badges";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiErrorState } from "@/components/api-error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-url";

export function Alerts() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showAcknowledged, setShowAcknowledged] = useState<boolean>(false);
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<number>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Use a stable params object for the query
  const queryParams = useMemo(() => {
    const params: any = {};
    if (severityFilter !== "all") params.severity = severityFilter;
    if (!showAcknowledged) params.acknowledged = false;
    return params;
  }, [severityFilter, showAcknowledged]);

  const { data: alerts, isLoading, isError: isAlertsError } = useListAlerts(queryParams, {
    query: { refetchInterval: 30000, queryKey: getListAlertsQueryKey(queryParams) }
  });
  
  const queryClient = useQueryClient();
  const ackMutation = useAcknowledgeAlert();
  const { toast } = useToast();
  const visibleAlerts = Array.isArray(alerts)
    ? alerts.filter((alert) => Boolean(alert) && typeof alert === "object" && typeof alert.id === "number")
    : [];
  const visibleAlertIds = visibleAlerts.map((alert) => alert.id);
  const selectedVisibleCount = visibleAlertIds.filter((id) => selectedAlertIds.has(id)).length;
  const allVisibleSelected = visibleAlertIds.length > 0 && selectedVisibleCount === visibleAlertIds.length;

  const handleAcknowledge = (id: number) => {
    ackMutation.mutate(
      { id },
      {
        onSuccess: (data) => {
          // Optimistically update list
          queryClient.setQueryData(getListAlertsQueryKey(queryParams), (old: any) => {
            if (!old) return old;
            if (!showAcknowledged) {
              return old.filter((a: any) => a.id !== id);
            }
            return old.map((a: any) => a.id === id ? data : a);
          });
          queryClient.invalidateQueries({ queryKey: getGetLiveAlertsQueryKey() });
        }
      }
    );
  };

  const toggleSelection = (id: number) => {
    setSelectedAlertIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedAlertIds((current) => {
      if (allVisibleSelected) return new Set();
      return new Set(visibleAlertIds);
    });
  };

  const confirmBulkDelete = async () => {
    const ids = [...selectedAlertIds];
    if (ids.length === 0) return;

    setIsDeleting(true);
    const results = await Promise.allSettled(
      ids.map((id) =>
        apiFetch(`/api/alerts/${id}`, {
          method: "DELETE",
          headers: { Accept: "application/json" },
        }).then((response) => {
          if (!response.ok) throw new Error(`Delete failed (${response.status})`);
          return id;
        }),
      ),
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;
    const deletedIds = ids.filter((_, index) => results[index].status === "fulfilled");

    queryClient.setQueryData(getListAlertsQueryKey(queryParams), (current: unknown) => {
      if (!Array.isArray(current)) return current;
      return current.filter((alert: { id: number }) => !deletedIds.includes(alert.id));
    });
    await queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey(queryParams) });
    await queryClient.invalidateQueries({ queryKey: getGetLiveAlertsQueryKey() });
    setSelectedAlertIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    setIsBulkDeleteDialogOpen(false);
    setIsDeleting(false);

    if (failedCount > 0) {
      toast({
        title: "Some alerts could not be removed",
        description: `${deletedIds.length} removed, ${failedCount} failed. Please try again.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Alerts Removed",
        description: `${deletedIds.length} alert${deletedIds.length === 1 ? "" : "s"} deleted.`,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Alerts & Notifications
          </h1>
          <p className="text-muted-foreground mt-2">
            Real-time critical warnings and maintenance notifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 bg-card p-2 rounded-lg border border-border">
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all alerts"
              disabled={visibleAlerts.length === 0}
            />
            <span className="text-sm font-medium text-muted-foreground">Select all</span>
          </div>
          {selectedAlertIds.size > 0 && (
            <Button
              size="icon"
              variant="destructive"
              aria-label={`Delete ${selectedAlertIds.size} selected alert${selectedAlertIds.size === 1 ? "" : "s"}`}
              title={`Delete ${selectedAlertIds.size} selected alert${selectedAlertIds.size === 1 ? "" : "s"}`}
              disabled={isDeleting}
              onClick={() => setIsBulkDeleteDialogOpen(true)}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
          <div className="flex items-center gap-2 px-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={severityFilter} onValueChange={(value) => {
              setSeverityFilter(value);
              setSelectedAlertIds(new Set());
            }}>
              <SelectTrigger className="w-[140px] h-8 bg-transparent border-none focus:ring-0 shadow-none">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-6 w-px bg-border"></div>
          <div className="flex items-center gap-2 px-3">
            <Checkbox 
              id="show-ack" 
              checked={showAcknowledged} 
              onCheckedChange={(c) => {
                setShowAcknowledged(!!c);
                setSelectedAlertIds(new Set());
              }}
              className="border-muted-foreground"
            />
            <label htmlFor="show-ack" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground">
              Show Acknowledged
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-12">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : isAlertsError ? (
          <ApiErrorState message="Unable to load alerts." />
          ) : visibleAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg border border-dashed border-border">
            <CheckCircle2 className="h-16 w-16 text-primary mb-4 opacity-50" />
            <h3 className="text-xl font-medium">All Clear</h3>
            <p className="text-muted-foreground">No alerts match your current filters.</p>
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <Card key={alert.id} className={`overflow-hidden transition-all duration-200 border-l-4 hover:bg-muted/30 ${
              alert.severity === 'high' ? 'border-l-destructive shadow-[0_0_15px_rgba(255,42,42,0.1)]' :
              alert.severity === 'medium' ? 'border-l-[hsl(var(--chart-2))]' : 'border-l-blue-500'
            } ${alert.acknowledged ? 'opacity-60 grayscale-[50%]' : ''}`}>
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4">
                  <Checkbox
                    checked={selectedAlertIds.has(alert.id)}
                    onCheckedChange={() => toggleSelection(alert.id)}
                    aria-label={`Select ${alert.faultType} alert for ${alert.motorName}`}
                    className="mt-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <SeverityBadge severity={alert.severity} />
                      <span className="font-mono text-xs text-muted-foreground px-2 py-0.5 bg-black/40 rounded border border-border">
                        {alert.motorName}
                      </span>
                      <span className="font-bold text-foreground truncate">
                        {alert.faultType}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {alert.message}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4 sm:gap-2">
                    <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                       {formatAlertDate(alert.createdAt)}
                       <span className="hidden sm:inline">({formatAlertTime(alert.createdAt)})</span>
                    </div>
                    
                    {!alert.acknowledged ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-primary/10 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={ackMutation.isPending && ackMutation.variables?.id === alert.id}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Acknowledge
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground bg-transparent">
                         Ack'd {alert.acknowledgedAt && formatAlertAcknowledgedAt(alert.acknowledgedAt)}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Selected Alerts
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedAlertIds.size} selected alert{selectedAlertIds.size === 1 ? "" : "s"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              className="border-border"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Yes, Delete Selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatAlertDate(value: string | undefined): string {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime())
    ? formatDistanceToNow(date, { addSuffix: true })
    : "Time unavailable";
}

function formatAlertTime(value: string | undefined): string {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? format(date, "HH:mm") : "—";
}

function formatAlertAcknowledgedAt(value: string | undefined): string {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? format(date, "MMM d, HH:mm") : "time unavailable";
}
