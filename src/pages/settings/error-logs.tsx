import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertTriangle, CheckCircle, Clock, Info, RefreshCw, XCircle,
  Zap, Bug, ShieldAlert, Activity, Cpu, ChevronLeft, ChevronRight as ChevRight,
} from "lucide-react";

type ErrorLog = {
  id: string;
  message: string;
  stack?: string;
  context?: any;
  url?: string;
  userAgent?: string;
  userId?: string;
  userEmail?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "NEW" | "INVESTIGATING" | "RESOLVED" | "IGNORED";
  solution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  occurrences: number;
  lastOccurredAt: string;
  createdAt: string;
};

type PaginationInfo = { total: number; page: number; pageSize: number; pageCount: number };

const STATUS_CONFIG = {
  NEW:          { label: "New",          icon: Info,         class: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800", dot: "bg-blue-500" },
  INVESTIGATING:{ label: "Investigating", icon: Clock,        class: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800", dot: "bg-amber-500" },
  RESOLVED:     { label: "Resolved",     icon: CheckCircle,  class: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800", dot: "bg-emerald-500" },
  IGNORED:      { label: "Ignored",      icon: XCircle,      class: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700", dot: "bg-slate-400" },
} as const;

const SEVERITY_CONFIG = {
  LOW:      { label: "Low",      class: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",     bar: "bg-blue-500",    leftBar: "border-l-blue-400" },
  MEDIUM:   { label: "Medium",   class: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800", bar: "bg-amber-500",   leftBar: "border-l-amber-400" },
  HIGH:     { label: "High",     class: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", bar: "bg-orange-500", leftBar: "border-l-orange-400" },
  CRITICAL: { label: "Critical", class: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",            bar: "bg-red-500",     leftBar: "border-l-red-500" },
} as const;

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NEW;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.class}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.LOW;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.class}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.bar}`} />
      {cfg.label}
    </span>
  );
};

const StatusFilterBtn = ({ value, active, count, onClick }: { value: string; active: boolean; count?: number; onClick: () => void }) => {
  const cfg = value === "ALL"
    ? { label: "All", class: "bg-slate-900 text-white" }
    : STATUS_CONFIG[value as keyof typeof STATUS_CONFIG] ?? { label: value, class: "" };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
        active
          ? "border-transparent shadow-sm " + (value === "ALL" ? "bg-slate-900 text-white" : cfg.class)
          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
      }`}
    >
      {cfg.label}
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
          {count}
        </span>
      )}
    </button>
  );
};

const SeverityFilterBtn = ({ value, active, onClick }: { value: string; active: boolean; onClick: () => void }) => {
  const label = value === "ALL" ? "All Severities" : SEVERITY_CONFIG[value as keyof typeof SEVERITY_CONFIG]?.label ?? value;
  const bar = value !== "ALL" ? SEVERITY_CONFIG[value as keyof typeof SEVERITY_CONFIG]?.bar : undefined;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        active
          ? "border-transparent bg-slate-800 text-white shadow-sm"
          : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
      }`}
    >
      {bar && <span className={`w-2 h-2 rounded-full ${bar}`} />}
      {label}
    </button>
  );
};

export default function ErrorLogsPage() {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [solution, setSolution] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("NEW");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, pageSize: 10, pageCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadErrorLogs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.append("status", statusFilter);
      if (severityFilter && severityFilter !== "ALL") params.append("severity", severityFilter);
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.pageSize.toString());

      const res = await fetch(`/api/admin/error-logs?${params}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        if (res.status === 401) { toast({ title: "Auth Error", description: "Please log in", variant: "destructive" }); return; }
        if (res.status === 403) { toast({ title: "Access Denied", description: "Admin access required", variant: "destructive" }); return; }
        throw new Error();
      }
      const data = await res.json();
      setErrorLogs(data.data);
      setPagination(data.pagination);
    } catch {
      toast({ title: "Error", description: "Failed to load error logs", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadErrorLogs(); }, [statusFilter, severityFilter, pagination.page]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/error-logs?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Updated", description: "Status updated successfully" });
      loadErrorLogs();
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleSaveSolution = async () => {
    if (!selectedError) return;
    try {
      const res = await fetch(`/api/admin/error-logs?id=${selectedError.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution, status: "RESOLVED" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Resolved", description: "Solution saved successfully" });
      setIsDialogOpen(false);
      loadErrorLogs();
    } catch {
      toast({ title: "Error", description: "Failed to save solution", variant: "destructive" });
    }
  };

  const handleAnalyzeError = async () => {
    if (!selectedError) return;
    try {
      setIsAnalyzing(true);
      const res = await fetch("/api/admin/error-logs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorId: selectedError.id }),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSolution(data.solution);
      toast({ title: "Analysis Complete", description: "AI has suggested a solution" });
    } catch {
      toast({ title: "Error", description: "Failed to analyze error", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const truncate = (msg: string, max = 100) => msg.length > max ? msg.slice(0, max) + "…" : msg;

  const criticalCount = errorLogs.filter(e => e.severity === "CRITICAL").length;
  const newCount = errorLogs.filter(e => e.status === "NEW").length;
  const resolvedCount = errorLogs.filter(e => e.status === "RESOLVED").length;

  const STATUSES = ["ALL", "NEW", "INVESTIGATING", "RESOLVED", "IGNORED"];
  const SEVERITIES = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-rose-600 to-pink-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.12),transparent_55%)]" />
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 px-8 py-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                <Bug className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Error Logs</h1>
                <p className="text-rose-100 text-sm mt-0.5">Monitor, diagnose and resolve application errors</p>
              </div>
            </div>
            <Button onClick={loadErrorLogs} variant="ghost" className="text-white/80 hover:text-white hover:bg-white/15 gap-2 self-start lg:self-auto">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="relative z-10 px-8 pb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Errors", value: pagination.total, icon: Bug },
              { label: "New Issues", value: newCount, icon: Info },
              { label: "Critical", value: criticalCount, icon: ShieldAlert },
              { label: "Resolved", value: resolvedCount, icon: CheckCircle },
            ].map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur border border-white/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-rose-100 font-medium">{s.label}</span>
                  <s.icon className="h-4 w-4 text-white/60" />
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
            {STATUSES.map(s => (
              <StatusFilterBtn
                key={s}
                value={s}
                active={statusFilter === s}
                onClick={() => { setStatusFilter(s); setPagination(p => ({ ...p, page: 1 })); }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Severity:</span>
            {SEVERITIES.map(s => (
              <SeverityFilterBtn
                key={s}
                value={s}
                active={severityFilter === s}
                onClick={() => { setSeverityFilter(s); setPagination(p => ({ ...p, page: 1 })); }}
              />
            ))}
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-lg font-bold">Application Errors</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{pagination.total} total errors</p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-500 border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading error logs...</p>
            </div>
          ) : errorLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="font-semibold text-muted-foreground">No errors found for these filters</p>
              <p className="text-sm text-muted-foreground mt-1">The system is running cleanly.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {errorLogs.map(error => {
                const sevCfg = SEVERITY_CONFIG[error.severity] ?? SEVERITY_CONFIG.LOW;
                return (
                  <div key={error.id} className={`flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors border-l-4 ${sevCfg.leftBar} group`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <SeverityBadge severity={error.severity} />
                        <StatusBadge status={error.status} />
                        {error.occurrences > 1 && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {error.occurrences}× occurred
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground line-clamp-1 mb-1">{truncate(error.message)}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{error.userEmail ?? "Unknown user"}</span>
                        <span>·</span>
                        <span>Last: {formatDate(error.lastOccurredAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => { setSelectedError(error); setSolution(error.solution ?? ""); setIsDialogOpen(true); }}
                    >
                      View Details
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {pagination.pageCount > 1 && (
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.pageCount} · {pagination.total} total
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      className={pagination.page <= 1 ? "pointer-events-none opacity-40" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: pagination.pageCount }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pagination.pageCount || Math.abs(p - pagination.page) <= 1)
                    .map((page, idx, arr) => {
                      if (idx > 0 && page - arr[idx - 1] > 1) {
                        return <PaginationItem key={`e${page}`}><span className="px-3 py-2 text-sm">…</span></PaginationItem>;
                      }
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink isActive={page === pagination.page}
                            onClick={() => setPagination(p => ({ ...p, page }))}>
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pageCount, p.page + 1) }))}
                      className={pagination.page >= pagination.pageCount ? "pointer-events-none opacity-40" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Dialog ──────────────────────────────────────────────── */}
      {selectedError && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <SeverityBadge severity={selectedError.severity} />
                <StatusBadge status={selectedError.status} />
              </div>
              <DialogTitle className="text-xl">Error Details</DialogTitle>
              <DialogDescription>
                {selectedError.occurrences} occurrence{selectedError.occurrences !== 1 ? "s" : ""} ·
                First: {formatDate(selectedError.createdAt)} ·
                Last: {formatDate(selectedError.lastOccurredAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-2">
              {/* Error Message */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error Message</p>
                </div>
                <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30">
                  <p className="text-sm text-red-800 dark:text-red-300 font-mono">{selectedError.message}</p>
                </div>
              </div>

              {/* Stack Trace */}
              {selectedError.stack && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2 bg-muted/50 border-b border-border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stack Trace</p>
                  </div>
                  <pre className="px-4 py-3 overflow-x-auto text-xs font-mono text-muted-foreground bg-muted/20 max-h-40">
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Metadata</p>
                  {[
                    ["Severity", selectedError.severity],
                    ["Occurrences", selectedError.occurrences],
                    ["User", selectedError.userEmail ?? "Unknown"],
                    ["URL", selectedError.url ?? "Unknown"],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
                {selectedError.context && (
                  <div className="rounded-xl border border-border p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Component</p>
                    {[
                      ["Component", selectedError.context.componentName ?? "Unknown"],
                      ["Function", selectedError.context.functionName ?? "Unknown"],
                      ["Last Action", selectedError.context.userAction ?? "—"],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium text-right max-w-[60%] truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Context Tabs */}
              {selectedError.context && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2 bg-muted/50 border-b border-border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Context Details</p>
                  </div>
                  <div className="p-4">
                    <Tabs defaultValue="overview">
                      <TabsList className="mb-4 flex-wrap h-auto gap-1">
                        {["overview", "component", "device", "user", "sensors", "performance", "raw"].map(t => (
                          <TabsTrigger key={t} value={t} className="capitalize text-xs">{t}</TabsTrigger>
                        ))}
                      </TabsList>

                      <TabsContent value="overview">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p><span className="text-muted-foreground">Component:</span> {selectedError.context.componentName ?? "Unknown"}</p>
                            <p><span className="text-muted-foreground">Function:</span> {selectedError.context.functionName ?? "Unknown"}</p>
                            {selectedError.context.userAction && <p><span className="text-muted-foreground">Last Action:</span> {selectedError.context.userAction}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedError.context.additionalInfo?.consoleError && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Console Error</Badge>}
                            {selectedError.context.additionalInfo?.unhandledRejection && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Unhandled Rejection</Badge>}
                            {selectedError.context.additionalInfo?.errorType && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{selectedError.context.additionalInfo.errorType}</Badge>}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="component">
                        <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                          <p><span className="text-muted-foreground">Name:</span> {selectedError.context.componentName ?? "Unknown"}</p>
                          <p><span className="text-muted-foreground">Function:</span> {selectedError.context.functionName ?? "Unknown"}</p>
                          {selectedError.context.params && (
                            <pre className="mt-2 text-xs bg-background p-2 rounded border overflow-x-auto">
                              {JSON.stringify(selectedError.context.params, null, 2)}
                            </pre>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="device">
                        {selectedError.context.deviceInfo ? (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {[
                              ["Platform", selectedError.context.deviceInfo.platform],
                              ["Screen", selectedError.context.deviceInfo.screenSize],
                              ["Orientation", selectedError.context.deviceInfo.orientation],
                              ["Memory", selectedError.context.deviceInfo.memoryInfo],
                              ["Connection", selectedError.context.deviceInfo.connectionType],
                            ].map(([k, v]) => v && (
                              <div key={String(k)}>
                                <span className="text-muted-foreground">{k}: </span>
                                <span>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-sm text-muted-foreground">No device information available</p>}
                      </TabsContent>

                      <TabsContent value="user">
                        <div className="space-y-3 text-sm">
                          {selectedError.context.userAction && (
                            <div className="rounded-lg bg-muted/30 p-3"><p>{selectedError.context.userAction}</p></div>
                          )}
                          {selectedError.context.additionalInfo?.recentUserActions?.length > 0 && (
                            <ol className="list-decimal pl-5 space-y-1">
                              {selectedError.context.additionalInfo.recentUserActions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                            </ol>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="sensors">
                        {selectedError.context.sensorData ? (
                          <div className="space-y-2 text-sm">
                            {[
                              ["Accelerometer", selectedError.context.sensorData.accelerometer],
                              ["Gyroscope", selectedError.context.sensorData.gyroscope],
                              ["Magnetometer", selectedError.context.sensorData.magnetometer],
                            ].map(([name, available]) => (
                              <div key={String(name)} className="flex items-center justify-between">
                                <span className="text-muted-foreground">{name}</span>
                                <Badge className={available ? "bg-emerald-500 text-white border-0" : "bg-slate-300 dark:bg-slate-700 text-foreground border-0"}>
                                  {available ? "Available" : "Not Available"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-sm text-muted-foreground">No sensor data available</p>}
                      </TabsContent>

                      <TabsContent value="performance">
                        {selectedError.context.performanceMetrics ? (
                          <div className="space-y-3 text-sm">
                            {selectedError.context.performanceMetrics.memoryUsage !== undefined && (
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-muted-foreground">Memory Usage</span>
                                  <span className="font-medium">{(selectedError.context.performanceMetrics.memoryUsage * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-500 transition-all"
                                    style={{ width: `${(selectedError.context.performanceMetrics.memoryUsage * 100).toFixed(0)}%` }} />
                                </div>
                              </div>
                            )}
                            {selectedError.context.performanceMetrics.loadTime !== undefined && (
                              <p><span className="text-muted-foreground">Load Time:</span> {(selectedError.context.performanceMetrics.loadTime / 1000).toFixed(2)}s</p>
                            )}
                            {selectedError.context.performanceMetrics.networkLatency !== undefined && (
                              <p><span className="text-muted-foreground">Network Latency:</span> {selectedError.context.performanceMetrics.networkLatency.toFixed(0)}ms</p>
                            )}
                          </div>
                        ) : <p className="text-sm text-muted-foreground">No performance metrics available</p>}
                      </TabsContent>

                      <TabsContent value="raw">
                        <pre className="text-xs font-mono bg-muted/30 rounded-lg p-3 overflow-x-auto max-h-60">
                          {JSON.stringify(selectedError.context, null, 2)}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}

              {/* Solution */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solution / Notes</p>
                  <Button variant="outline" size="sm" onClick={handleAnalyzeError} disabled={isAnalyzing} className="gap-2 rounded-lg text-xs">
                    {isAnalyzing ? <><RefreshCw className="h-3 w-3 animate-spin" /> Analyzing…</> : <><Zap className="h-3 w-3" /> AI Analyze</>}
                  </Button>
                </div>
                <div className="p-4">
                  <Textarea
                    placeholder="Enter a solution or click 'AI Analyze' for AI suggestions…"
                    value={solution}
                    onChange={e => setSolution(e.target.value)}
                    rows={4}
                    className="resize-none rounded-xl"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2 flex-col sm:flex-row gap-2 sm:justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl"
                  onClick={() => handleUpdateStatus(selectedError.id, "INVESTIGATING")}
                  disabled={selectedError.status === "INVESTIGATING"}>
                  <Clock className="h-4 w-4 mr-2" /> Investigating
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl"
                  onClick={() => handleUpdateStatus(selectedError.id, "IGNORED")}
                  disabled={selectedError.status === "IGNORED"}>
                  <XCircle className="h-4 w-4 mr-2" /> Ignore
                </Button>
              </div>
              <Button onClick={handleSaveSolution} className="rounded-xl gap-2">
                <CheckCircle className="h-4 w-4" /> Save & Resolve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
