import { useState, useRef, useEffect } from "react";
import { useListFaults, useAnalyzeFault, useDeleteFault, useListMotors, getListMotorsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/ui/badges";
import { Activity, Cpu, AlertTriangle, Zap, Bot, ArrowRight, ShieldAlert, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getListFaultsQueryKey } from "@workspace/api-client-react";
import { ApiErrorState } from "@/components/api-error-state";
import { DecisionEngineStatus } from "@/components/decision-engine-status";
import { getDecisionAnalysis } from "@/lib/decision-analysis";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FaultLogs() {
  const { data: faults, isLoading, isError: isFaultsError } = useListFaults({
    query: { refetchInterval: 30000, queryKey: getListFaultsQueryKey() },
  });
  const { data: motors } = useListMotors({
    query: { refetchInterval: 30000, queryKey: getListMotorsQueryKey() },
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const analyzeMutation = useAnalyzeFault();
  const deleteMutation = useDeleteFault();
  const { toast } = useToast();
  const faultRecords = Array.isArray(faults)
    ? faults.filter((fault) => Boolean(fault) && typeof fault === "object" && typeof fault.id === "number")
    : [];
  const motorRecords = Array.isArray(motors)
    ? motors.filter((motor) => Boolean(motor) && typeof motor === "object" && typeof motor.id === "number")
    : [];
  const [selectedFaultIds, setSelectedFaultIds] = useState<Set<number>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [analysisFeedback, setAnalysisFeedback] = useState<{
    faultId: number;
    source: "deepseek" | "openai" | "fallback";
  } | null>(null);

  // Auto-select most recent fault
  useEffect(() => {
    if (faultRecords.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    if (selectedId === null || !faultRecords.some((fault) => fault.id === selectedId)) {
      setSelectedId(faultRecords[0].id);
    }
  }, [faultRecords, selectedId]);

  const selectedFault = faultRecords.find(f => f.id === selectedId);
  const selectedMotor = selectedFault
    ? motorRecords.find((motor) => motor.id === selectedFault.motorId)
    : undefined;
  const decisionAnalysis = getDecisionAnalysis(selectedMotor, selectedFault);
  const allFaultsSelected =
    faultRecords.length > 0 && faultRecords.every((fault) => selectedFaultIds.has(fault.id));

  const toggleFaultSelection = (faultId: number) => {
    setSelectedFaultIds((current) => {
      const next = new Set(current);
      if (next.has(faultId)) {
        next.delete(faultId);
      } else {
        next.add(faultId);
      }
      return next;
    });
  };

  const toggleAllFaults = () => {
    setSelectedFaultIds((current) => {
      if (allFaultsSelected) return new Set();
      return new Set(faultRecords.map((fault) => fault.id));
    });
  };

  const handleAnalyze = () => {
    if (selectedId === null || !selectedFault) return;
    setAnalysisFeedback(null);
    analyzeMutation.mutate(
      { id: selectedId },
      {
        onSuccess: (data) => {
          const source =
            data.explanationSource === "deepseek"
              ? "deepseek"
              : data.explanationSource === "openai"
                ? "openai"
                : "fallback";
          setAnalysisFeedback({ faultId: selectedId, source });
          // Update the cache locally with the new analysis
          queryClient.setQueryData(getListFaultsQueryKey(), (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map((f: any) => f.id === selectedId ? data : f);
          });
          toast({
            title: source === "fallback"
              ? "Fallback analysis updated"
              : `${source === "deepseek" ? "DeepSeek" : "OpenAI"} analysis updated`,
            description: source === "fallback"
              ? "DeepSeek was unavailable, so the verified deterministic explanation was saved."
              : "The fault explanation was generated from the verified telemetry snapshot.",
          });
        },
        onError: (error) => {
          toast({
            title: "Fault analysis failed",
            description: error instanceof Error ? error.message : "Unable to analyze this fault right now.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const confirmBulkDelete = async () => {
    const idsToDelete = Array.from(selectedFaultIds);
    if (idsToDelete.length === 0) return;

    const results = await Promise.allSettled(
      idsToDelete.map((id) => deleteMutation.mutateAsync({ id })),
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;
    const deletedIds = idsToDelete.filter((_, index) => results[index].status === "fulfilled");

    queryClient.setQueryData(getListFaultsQueryKey(), (current: unknown) => {
      if (!Array.isArray(current)) return current;
      return current.filter((fault: { id: number }) => !deletedIds.includes(fault.id));
    });
    queryClient.invalidateQueries({ queryKey: getListFaultsQueryKey() });
    setSelectedFaultIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    if (deletedIds.includes(selectedId ?? -1)) {
      const remainingFault = faultRecords.find((fault) => !deletedIds.includes(fault.id));
      setSelectedId(remainingFault?.id ?? null);
      setAnalysisFeedback(null);
    }
    setIsBulkDeleteDialogOpen(false);

    if (failedCount > 0) {
      toast({
        title: "Some fault logs could not be removed",
        description: `${deletedIds.length} removed, ${failedCount} failed. Please try again.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Fault Logs Removed",
        description: `${deletedIds.length} fault log${deletedIds.length === 1 ? "" : "s"} deleted.`,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <FileWarningIcon className="h-8 w-8 text-primary" />
          Historical Fault Logs
        </h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive log of all detected anomalies and system faults.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left column: List */}
        <Card className="col-span-1 border-border bg-card flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="py-4 border-b border-border bg-card/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allFaultsSelected}
                onCheckedChange={toggleAllFaults}
                aria-label="Select all fault logs"
                disabled={faultRecords.length === 0}
              />
              <CardTitle className="text-lg">Incident History</CardTitle>
            </div>
            {selectedFaultIds.size > 0 && (
              <Button
                variant="destructive"
                size="icon"
                title={`Delete ${selectedFaultIds.size} selected fault log${selectedFaultIds.size === 1 ? "" : "s"}`}
                aria-label={`Delete ${selectedFaultIds.size} selected fault log${selectedFaultIds.size === 1 ? "" : "s"}`}
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1,2,3,4,5].map(i => (
                  <Skeleton key={i} className="h-20 w-full rounded-md" />
                ))}
              </div>
            ) : isFaultsError ? (
              <ApiErrorState message="Unable to load fault logs." />
            ) : faultRecords.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No fault logs found.
              </div>
            ) : (
              <div className="divide-y divide-border">
                 {faultRecords.map((fault) => (
                   <div
                     key={fault.id}
                     className={`w-full flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors ${
                       selectedId === fault.id ? "bg-muted/80 border-l-2 border-primary" : "border-l-2 border-transparent"
                     }`}
                   >
                     <Checkbox
                       checked={selectedFaultIds.has(fault.id)}
                       onCheckedChange={() => toggleFaultSelection(fault.id)}
                       aria-label={`Select ${fault.faultType} fault log`}
                       className="mt-1"
                     />
                     <button
                       onClick={() => setSelectedId(fault.id)}
                       className="flex-1 min-w-0 text-left"
                     >
                       <div className="flex justify-between items-start mb-2">
                         <div className="font-medium text-foreground truncate pr-2">{fault.faultType}</div>
                         <SeverityBadge severity={fault.severity} />
                       </div>
                       <div className="text-xs text-muted-foreground flex justify-between">
                         <span>{fault.motorName}</span>
                          <span>{formatFaultDate(fault.detectedAt)}</span>
                       </div>
                     </button>
                   </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: AI Analysis */}
        <Card className="col-span-1 lg:col-span-2 border-border bg-[#0d0f14] shadow-xl flex flex-col min-h-0 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Bot className="h-64 w-64" />
          </div>
          
          <CardHeader className="py-4 border-b border-border/50 bg-[#131519]/80 backdrop-blur z-10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-primary flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Diagnostic Report
              </CardTitle>
              {selectedFault && (
                <CardDescription className="mt-1 font-mono text-xs">
                  Incident ID: FLT-{selectedFault.id.toString().padStart(4, '0')} | 
                   Time: {formatFaultTimestamp(selectedFault.detectedAt)}
                </CardDescription>
              )}
            </div>
            {faultRecords.length > 0 && (
              <Button 
                onClick={handleAnalyze} 
                disabled={analyzeMutation.isPending || !selectedFault}
                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                variant="outline"
              >
                {analyzeMutation.isPending ? "Analyzing..." : "Re-Analyze Data"}
              </Button>
            )}
             {analysisFeedback?.faultId === selectedFault?.id && (
               <div
                 role="status"
                 aria-live="polite"
                 className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                    analysisFeedback?.source !== "fallback"
                     ? "border-primary/30 bg-primary/10 text-primary"
                     : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                 }`}
               >
                  {analysisFeedback?.source === "deepseek"
                    ? "DeepSeek response received and the verified fault explanation was updated."
                    : analysisFeedback?.source === "openai"
                      ? "OpenAI response received and the verified fault explanation was updated."
                      : "DeepSeek did not return an answer. The verified deterministic fallback was updated instead."}
               </div>
             )}
          </CardHeader>

          <CardContent className="p-6 overflow-y-auto flex-1 z-10">
            {!selectedFault ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <ShieldAlert className="h-12 w-12 mb-4 opacity-20" />
                <p>Select a fault log to view its diagnostic analysis</p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Top Section: Motor Info & Description */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Visual rep */}
                  <div className="col-span-1 bg-black/40 rounded-lg p-6 border border-border flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50"></div>
                    <Cpu className={`h-16 w-16 mb-4 ${selectedFault.severity === 'critical' ? 'text-destructive animate-pulse' : 'text-primary'}`} />
                    <h3 className="font-bold text-lg">{selectedFault.motorName}</h3>
                    <div className="grid grid-cols-2 gap-3 w-full mt-4 text-center">
                      <div className="col-span-2 bg-primary/10 border border-primary/20 rounded py-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Health Score</div>
                        <div className="font-mono text-xl font-bold text-primary">{selectedFault.healthScore}%</div>
                      </div>
                      <div className="bg-black/50 rounded py-2 border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">THD</div>
                        <div className="font-mono text-sm text-[hsl(var(--chart-2))]">
                          {typeof selectedFault.thdAtFault === "number" ? `${selectedFault.thdAtFault.toFixed(1)}%` : "Unavailable"}
                        </div>
                      </div>
                      <div className="bg-black/50 rounded py-2 border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Vibration</div>
                        <div className="font-mono text-sm text-[hsl(var(--chart-2))]">
                          {typeof selectedFault.dbAtFault === "number" ? `${selectedFault.dbAtFault.toFixed(1)}dB` : "Unavailable"}
                        </div>
                      </div>
                      <div className="col-span-2 bg-black/50 rounded py-2 border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Isolation Forest anomaly score</div>
                        <div className="font-mono text-sm text-destructive">
                           {typeof selectedFault.ifAnomalyScore === "number" && Number.isFinite(selectedFault.ifAnomalyScore) ? `${(selectedFault.ifAnomalyScore * 100).toFixed(0)}%` : "Unavailable"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fault Details */}
                  <div className="col-span-1 md:col-span-2 flex flex-col">
                     <div className="flex items-center gap-3 mb-2">
                       {decisionAnalysis.faultLabel ? (
                         selectedFault.faultType === decisionAnalysis.faultLabel ? (
                           <SeverityBadge severity={selectedFault.severity} />
                         ) : (
                           <Badge variant="outline">Active decision</Badge>
                         )
                       ) : (
                         <Badge variant="outline">Decision unavailable</Badge>
                       )}
                       <h2 className="text-2xl font-bold tracking-tight text-white">
                         {decisionAnalysis.faultLabel ?? "Decision unavailable"}
                       </h2>
                    </div>
                    <div className="bg-black/20 p-4 rounded-md border-l-4 border-destructive text-sm text-muted-foreground leading-relaxed flex-1 mt-2">
                      <p className="text-foreground/90 font-medium mb-1">Incident Description:</p>
                       {decisionAnalysis.description}
                    </div>
                  </div>
                </div>

                 <DecisionEngineStatus motor={selectedMotor} />

                {/* AI Analysis Columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/50">
                  {/* Possible Causes */}
                  <div className="bg-card/30 border border-border rounded-lg p-4">
                    <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Possible Causes
                    </h4>
                    <ul className="space-y-2">
                       {decisionAnalysis.possibleCauses.map((cause, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{cause}</span>
                        </li>
                      ))}
                       {decisionAnalysis.possibleCauses.length === 0 && (
                        <li className="text-xs italic text-muted-foreground/50">No causes identified.</li>
                      )}
                    </ul>
                  </div>

                  {/* Risk if Ignored */}
                  <div className="bg-card/30 border border-border rounded-lg p-4">
                    <h4 className="text-sm font-bold text-destructive mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Risk if Ignored
                    </h4>
                    <ul className="space-y-2">
                       {decisionAnalysis.riskIfIgnored.map((risk, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-destructive mt-0.5">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                       {decisionAnalysis.riskIfIgnored.length === 0 && (
                        <li className="text-xs italic text-muted-foreground/50">No risks identified.</li>
                      )}
                    </ul>
                  </div>

                  {/* Recommended Action */}
                  <div className="bg-card/30 border border-primary/20 rounded-lg p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full pointer-events-none"></div>
                    <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Recommended Action
                    </h4>
                    <ul className="space-y-3">
                       {decisionAnalysis.recommendedActions.map((action, i) => (
                        <li key={i} className="text-xs text-foreground/90 flex items-start gap-2 bg-primary/5 p-2 rounded border border-primary/10">
                          <ArrowRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                          <span className="leading-snug">{action}</span>
                        </li>
                      ))}
                       {decisionAnalysis.recommendedActions.length === 0 && (
                        <li className="text-xs italic text-muted-foreground/50">No actions recommended.</li>
                      )}
                    </ul>
                  </div>
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Selected Fault Logs
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedFaultIds.size} selected fault log{selectedFaultIds.size === 1 ? "" : "s"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)} className="border-border">Cancel</Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Just an icon wrapper since FileWarning might conflict if imported wrong above
function FileWarningIcon(props: any) {
  return <AlertTriangle {...props} />;
}

function formatFaultDate(value: string | undefined): string {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime())
    ? formatDistanceToNow(date, { addSuffix: true })
    : "Time unavailable";
}

function formatFaultTimestamp(value: string | undefined): string {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? format(date, "yyyy-MM-dd HH:mm:ss") : "Time unavailable";
}
