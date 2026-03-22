// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Package,
  Users,
  Search,
  RefreshCw,
  Filter,
  Eye,
  TicketIcon,
  Calendar,
  Clock,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  FileText,
  PlusCircle,
  XCircle,
  Info,
  BarChart3,
  Zap,
  CheckSquare,
  AlertCircle,
  ArrowRight,
  Building2,
  Hash,
  ScanLine,
  ListChecks,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────── types ──────────────────────────────── */
interface ReportDetails {
  floorNumber?: string;
  roomNumber?: string;
  sessionStartTime?: string;
  sessionDurationMs?: number;
  totalScanned: number;
  totalInSystem: number;
  missingCount: number;
  extraCount: number;
  wrongLocationCount: number;
  rosterNotReadCount?: number;
  reasonCode?: string;
  note?: string;
  missingItems?: AssetItem[];
  wrongLocationItems?: AssetItem[];
  correctInRoomItems?: AssetItem[];
  extraItems?: AssetItem[];
  submittedByName?: string;
  submittedByEmail?: string;
  submittedAt?: string;
}

interface AssetItem {
  id?: string;
  name?: string;
  barcode?: string;
  floorNumber?: string;
  roomNumber?: string;
  source?: string;
}

interface LinkedTicket {
  id: string;
  displayId: string | null;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface Report {
  id: string;
  timestamp: string;
  userId?: string;
  severity: "INFO" | "WARNING" | "ERROR";
  details: ReportDetails | null;
  submitter?: {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    imageUrl?: string;
  } | null;
  linkedTickets: LinkedTicket[];
}

interface StaffUser {
  id: string;
  name?: string;
  email: string;
  role?: string;
}

/* ─────────────────────────────────── helpers ────────────────────────────── */
function formatDuration(ms?: number) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getSeverityConfig(s: string) {
  if (s === "WARNING") return {
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    dot: "bg-amber-400",
  };
  if (s === "ERROR") return {
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
    iconColor: "text-red-500",
    dot: "bg-red-400",
  };
  return {
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    dot: "bg-emerald-400",
  };
}

function getStatusConfig(status: string) {
  switch (status) {
    case "OPEN": return "bg-blue-100 text-blue-700 border-blue-200";
    case "IN_PROGRESS": return "bg-purple-100 text-purple-700 border-purple-200";
    case "RESOLVED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "CLOSED": return "bg-slate-100 text-slate-600 border-slate-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function getPriorityConfig(priority: string) {
  switch (priority) {
    case "CRITICAL": return "bg-red-100 text-red-700";
    case "HIGH": return "bg-orange-100 text-orange-700";
    case "MEDIUM": return "bg-amber-100 text-amber-700";
    case "LOW": return "bg-slate-100 text-slate-600";
    default: return "bg-slate-100 text-slate-600";
  }
}

function initials(name?: string, email?: string) {
  const n = name || email || "?";
  return n.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/* ─────────────────────────── Asset List Modal ───────────────────────────── */
function AssetListModal({
  open,
  onClose,
  report,
}: {
  open: boolean;
  onClose: () => void;
  report: Report | null;
}) {
  const [tab, setTab] = useState<"available" | "missing" | "wrong" | "extra">("available");
  const [search, setSearch] = useState("");

  const d = report?.details;
  const available = d?.correctInRoomItems || [];
  const missing = d?.missingItems || [];
  const wrong = d?.wrongLocationItems || [];
  const extra = d?.extraItems || [];

  const tabs = [
    { key: "available", label: "Available", items: available, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2 },
    { key: "missing", label: "Missing", items: missing, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle },
    { key: "wrong", label: "Wrong Location", items: wrong, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: MapPin },
    { key: "extra", label: "Extra / Unknown", items: extra, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: Info },
  ] as const;

  const activeTab = tabs.find((t) => t.key === tab)!;
  const filtered = activeTab.items.filter((item: AssetItem) => {
    const q = search.toLowerCase();
    return !q || (item.name?.toLowerCase().includes(q) || item.barcode?.toLowerCase().includes(q));
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-white/20 rounded-xl">
              <ScanLine className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold">Asset Inventory Detail</h2>
          </div>
          <p className="text-indigo-200 text-sm">
            {d?.floorNumber || d?.roomNumber
              ? `Floor ${d.floorNumber || "?"} · Room ${d.roomNumber || "?"}`
              : "All locations"}{" "}
            · {fmtDate(d?.submittedAt || report?.timestamp)}
          </p>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            {tabs.map((t) => (
              <div key={t.key} className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-white/70" />
                {t.items.length} {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 flex-shrink-0 bg-white">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key as any); setSearch(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium border-b-2 transition-all",
                  active
                    ? `border-indigo-600 ${t.color} bg-indigo-50/40`
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:block">{t.label}</span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-bold",
                  active ? `${t.bg} ${t.color}` : "bg-slate-100 text-slate-500"
                )}>
                  {t.items.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 bg-slate-50/50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No items</p>
              <p className="text-sm">{search ? "Try a different search" : "No data for this category"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item: AssetItem, i: number) => (
                <motion.div
                  key={item.id || item.barcode || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm",
                    activeTab.border
                  )}
                >
                  <div className={cn("p-2 rounded-lg flex-shrink-0", activeTab.bg)}>
                    <Package className={cn("h-4 w-4", activeTab.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{item.name || "Unnamed asset"}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {item.barcode && (
                        <span className="text-xs text-slate-400 font-mono">{item.barcode}</span>
                      )}
                      {(item.floorNumber || item.roomNumber) && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[item.floorNumber, item.roomNumber].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs flex-shrink-0 border", activeTab.badge || activeTab.border, activeTab.color)}
                  >
                    {activeTab.label}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-4 bg-white border-t border-slate-100 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Create Ticket Modal ────────────────────────── */
function CreateTicketModal({
  open,
  onClose,
  report,
  staffUsers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  report: Report | null;
  staffUsers: StaffUser[];
  onCreated: (ticket: LinkedTicket) => void;
}) {
  const d = report?.details;
  const locationStr = [d?.floorNumber && `Floor ${d.floorNumber}`, d?.roomNumber && `Room ${d.roomNumber}`]
    .filter(Boolean).join(", ") || "Unknown location";

  const defaultTitle = `Inventory Discrepancy — ${locationStr}`;
  const defaultDesc = [
    `**Inventory Reconciliation Report**`,
    `Report ID: ${report?.id || "—"}`,
    `Submitted by: ${d?.submittedByName || d?.submittedByEmail || "Staff"}`,
    `Date: ${fmtDate(d?.submittedAt || report?.timestamp)}`,
    `Location: ${locationStr}`,
    ``,
    `**Scan Summary**`,
    `• Total scanned: ${d?.totalScanned ?? 0}`,
    `• Expected in system: ${d?.totalInSystem ?? 0}`,
    `• Missing: ${d?.missingCount ?? 0}`,
    `• Extra/Unknown: ${d?.extraCount ?? 0}`,
    `• Wrong location: ${d?.wrongLocationCount ?? 0}`,
    d?.reasonCode ? `• Reason code: ${d.reasonCode}` : "",
    d?.note ? `\n**Staff Note:**\n${d.note}` : "",
    `\n_Audit log ref: ${report?.id}_`,
  ].filter((l) => l !== undefined).join("\n").trim();

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDesc);
  const [priority, setPriority] = useState("HIGH");
  const [assignedToId, setAssignedToId] = useState("__none__");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription(defaultDesc);
      setPriority("HIGH");
      setAssignedToId("__none__");
    }
  }, [open, report?.id]);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: any = {
        title: title.trim(),
        description: description.trim(),
        priority,
        source: "INTERNAL",
        ticketType: "MANAGEMENT",
        category: "INVENTORY",
      };
      if (assignedToId && assignedToId !== "__none__") {
        body.assignedToId = assignedToId;
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ticket = data.ticket || data;
      toast({ title: "Ticket created", description: `${ticket.displayId || "Ticket"} has been created.` });
      onCreated({
        id: ticket.id,
        displayId: ticket.displayId || null,
        title: ticket.title,
        status: ticket.status || "OPEN",
        priority: ticket.priority || priority,
        createdAt: ticket.createdAt || new Date().toISOString(),
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Failed to create ticket", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <TicketIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Create Ticket from Report</h2>
              <p className="text-indigo-200 text-sm mt-0.5">Raise an action ticket for this inventory discrepancy</p>
            </div>
          </div>

          {/* Report summary chips */}
          {d && (
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="bg-white/15 rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                <ScanLine className="h-3 w-3" /> {d.totalScanned} scanned
              </div>
              <div className="bg-red-300/30 rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> {d.missingCount} missing
              </div>
              <div className="bg-white/15 rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> {locationStr}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Ticket Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10"
              placeholder="Describe the inventory issue…"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Description *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              className="text-sm font-mono resize-none leading-relaxed"
            />
          </div>

          {/* Priority + Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Assign To (optional)</label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger>
                  <SelectValue placeholder="— Unassigned —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email} {u.role ? `(${u.role})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TicketIcon className="h-4 w-4 mr-2" />}
            {submitting ? "Creating…" : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Report Card ────────────────────────────────── */
function ReportCard({
  report,
  onViewAssets,
  onCreateTicket,
  onTicketAdded,
}: {
  report: Report;
  onViewAssets: (r: Report) => void;
  onCreateTicket: (r: Report) => void;
  onTicketAdded?: (reportId: string, ticket: LinkedTicket) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const d = report.details || {} as ReportDetails;
  const sev = getSeverityConfig(report.severity);
  const SevIcon = sev.icon;
  const location = [d.floorNumber && `Floor ${d.floorNumber}`, d.roomNumber && `Room ${d.roomNumber}`]
    .filter(Boolean).join(" · ") || "All locations";

  const scannedPct = d.totalInSystem > 0 ? Math.round((d.totalScanned / d.totalInSystem) * 100) : 0;
  const missingPct = d.totalInSystem > 0 ? Math.round((d.missingCount / d.totalInSystem) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "rounded-2xl border-2 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden",
        report.severity === "WARNING" ? "border-amber-200" : report.severity === "ERROR" ? "border-red-200" : "border-slate-100"
      )}
    >
      {/* Severity stripe */}
      <div className={cn(
        "h-1 w-full",
        report.severity === "WARNING" ? "bg-gradient-to-r from-amber-400 to-orange-400"
          : report.severity === "ERROR" ? "bg-gradient-to-r from-red-400 to-rose-400"
          : "bg-gradient-to-r from-emerald-400 to-teal-400"
      )} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start gap-4">
          {/* Staff Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
              <AvatarImage src={report.submitter?.imageUrl} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold">
                {initials(report.submitter?.name, report.submitter?.email)}
              </AvatarFallback>
            </Avatar>
            <span className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white", sev.dot)} />
          </div>

          {/* Staff info + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">
                {report.submitter?.name || report.submitter?.email || "Unknown Staff"}
              </span>
              {report.submitter?.role && (
                <Badge variant="outline" className="text-xs font-medium text-indigo-600 border-indigo-200 bg-indigo-50">
                  {report.submitter.role}
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-xs font-semibold border", sev.badge)}>
                <SevIcon className={cn("h-3 w-3 mr-1", sev.iconColor)} />
                {report.severity}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{report.submitter?.email}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatDuration(d.sessionDurationMs)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {fmtDate(d.submittedAt || report.timestamp)}
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {/* Stat meters */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Scanned", value: d.totalScanned, icon: ScanLine, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "In System", value: d.totalInSystem, icon: Package, color: "text-slate-600", bg: "bg-slate-100" },
            { label: "Missing", value: d.missingCount, icon: AlertTriangle, color: d.missingCount > 0 ? "text-red-600" : "text-slate-400", bg: d.missingCount > 0 ? "bg-red-50" : "bg-slate-50" },
            { label: "Wrong Location", value: d.wrongLocationCount, icon: MapPin, color: d.wrongLocationCount > 0 ? "text-amber-600" : "text-slate-400", bg: d.wrongLocationCount > 0 ? "bg-amber-50" : "bg-slate-50" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={cn("rounded-xl p-3 flex items-center gap-2.5", stat.bg)}>
                <Icon className={cn("h-4 w-4 flex-shrink-0", stat.color)} />
                <div>
                  <p className={cn("text-lg font-bold leading-none", stat.color)}>{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {d.totalInSystem > 0 && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Scan coverage</span>
              <span className={cn("font-semibold", scannedPct >= 90 ? "text-emerald-600" : scannedPct >= 70 ? "text-amber-600" : "text-red-600")}>
                {scannedPct}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, scannedPct)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  scannedPct >= 90 ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : scannedPct >= 70 ? "bg-gradient-to-r from-amber-400 to-orange-500"
                    : "bg-gradient-to-r from-red-400 to-rose-500"
                )}
              />
            </div>
          </div>
        )}

        {/* Expanded section */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                {/* Reason & Note */}
                {(d.reasonCode || d.note) && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
                    {d.reasonCode && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">Reason Code:</span>
                        <Badge variant="outline" className="text-xs">{d.reasonCode}</Badge>
                      </div>
                    )}
                    {d.note && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Staff Note:</p>
                        <p className="text-sm text-slate-700 italic bg-white rounded-lg px-3 py-2 border border-slate-100">
                          "{d.note}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Linked tickets */}
                {report.linkedTickets.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <TicketIcon className="h-3.5 w-3.5" /> Linked Tickets ({report.linkedTickets.length})
                    </p>
                    <div className="space-y-2">
                      {report.linkedTickets.map((t) => (
                        <a
                          key={t.id}
                          href={`/tickets/${t.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-indigo-200 transition-all group"
                        >
                          <div className="p-1.5 bg-indigo-50 rounded-lg">
                            <TicketIcon className="h-3.5 w-3.5 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                            <p className="text-xs text-slate-400">{t.displayId || t.id.slice(0, 8)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-xs border", getStatusConfig(t.status))}>
                              {t.status.replace("_", " ")}
                            </Badge>
                            <Badge className={cn("text-xs", getPriorityConfig(t.priority))}>
                              {t.priority}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra stats row */}
                {(d.extraCount > 0 || d.rosterNotReadCount > 0) && (
                  <div className="flex gap-3">
                    {d.extraCount > 0 && (
                      <div className="flex-1 rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
                        <p className="text-xl font-bold text-blue-600">{d.extraCount}</p>
                        <p className="text-xs text-blue-500">Extra / Unknown</p>
                      </div>
                    )}
                    {d.rosterNotReadCount > 0 && (
                      <div className="flex-1 rounded-xl bg-purple-50 border border-purple-100 p-3 text-center">
                        <p className="text-xl font-bold text-purple-600">{d.rosterNotReadCount}</p>
                        <p className="text-xs text-purple-500">Not Read</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            onClick={() => onViewAssets(report)}
          >
            <Eye className="h-3.5 w-3.5" /> View All Assets
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm"
            onClick={() => onCreateTicket(report)}
          >
            <TicketIcon className="h-3.5 w-3.5" /> Create Ticket
          </Button>
          {!expanded && report.linkedTickets.length > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 ml-auto transition-colors"
            >
              <TicketIcon className="h-3 w-3" /> {report.linkedTickets.length} linked ticket{report.linkedTickets.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── Main Page ──────────────────────────────────── */
function AuditPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

  const [assetModal, setAssetModal] = useState<Report | null>(null);
  const [ticketModal, setTicketModal] = useState<Report | null>(null);

  const fetchReports = useCallback(async (p = 1, sev = severityFilter, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "15" });
      if (sev && sev !== "__all__") params.set("severity", sev);
      const res = await fetch(`/api/audit/inventory-reports?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      setReports(data.reports || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (e: any) {
      toast({ title: "Failed to load reports", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severityFilter]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setStaffUsers((data.users || data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      })));
    } catch {}
  }, []);

  useEffect(() => {
    fetchReports(1, severityFilter);
    fetchStaff();
  }, []);

  const handleSeverityChange = (v: string) => {
    setSeverityFilter(v);
    fetchReports(1, v);
  };

  const handleTicketCreated = (reportId: string, ticket: LinkedTicket) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, linkedTickets: [...r.linkedTickets, ticket] } : r
      )
    );
  };

  /* Derived stats from current page */
  const totalMissing = reports.reduce((s, r) => s + (r.details?.missingCount || 0), 0);
  const totalScanned = reports.reduce((s, r) => s + (r.details?.totalScanned || 0), 0);
  const warningCount = reports.filter((r) => r.severity === "WARNING").length;
  const clearCount = reports.filter((r) => r.severity === "INFO").length;

  /* Client-side text search */
  const filtered = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const d = r.details || {} as ReportDetails;
    return (
      r.submitter?.name?.toLowerCase().includes(q) ||
      r.submitter?.email?.toLowerCase().includes(q) ||
      d.floorNumber?.toLowerCase().includes(q) ||
      d.roomNumber?.toLowerCase().includes(q) ||
      d.note?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50">
      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900">
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/10 blur-3xl" />
        </div>
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)", backgroundSize: "32px 32px" }}
        />

        <div className="relative px-6 py-10 max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-sm border border-white/10">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">
                    Inventory Audit Center
                  </h1>
                  <p className="text-indigo-300 text-sm mt-0.5">
                    Field reconciliation reports · Asset accountability · Discrepancy management
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchReports(page, severityFilter, true)}
                disabled={refreshing}
                className="border-white/20 text-white hover:bg-white/10 bg-white/5 backdrop-blur-sm gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
            {[
              {
                label: "Total Reports",
                value: total,
                icon: FileText,
                gradient: "from-white/10 to-white/5",
                border: "border-white/10",
                text: "text-white",
                sub: "text-indigo-300",
              },
              {
                label: "Alerts (Missing)",
                value: warningCount,
                icon: AlertTriangle,
                gradient: "from-amber-500/20 to-amber-500/5",
                border: "border-amber-400/20",
                text: "text-amber-200",
                sub: "text-amber-400",
              },
              {
                label: "Items Scanned",
                value: totalScanned,
                icon: ScanLine,
                gradient: "from-blue-500/20 to-blue-500/5",
                border: "border-blue-400/20",
                text: "text-blue-200",
                sub: "text-blue-400",
              },
              {
                label: "Missing Items",
                value: totalMissing,
                icon: ShieldAlert,
                gradient: "from-red-500/20 to-red-500/5",
                border: "border-red-400/20",
                text: "text-red-200",
                sub: "text-red-400",
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-2xl border backdrop-blur-sm bg-gradient-to-br p-4",
                    stat.gradient,
                    stat.border
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-white/10 rounded-xl">
                      <Icon className={cn("h-4 w-4", stat.text)} />
                    </div>
                    <div>
                      <p className={cn("text-2xl font-extrabold", stat.text)}>{stat.value}</p>
                      <p className={cn("text-xs", stat.sub)}>{stat.label}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by staff name, location, note…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
            />
          </div>

          <Select value={severityFilter} onValueChange={handleSeverityChange}>
            <SelectTrigger className="w-44 h-9 text-sm bg-slate-50 border-slate-200">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Reports</SelectItem>
              <SelectItem value="WARNING">⚠ With Alerts</SelectItem>
              <SelectItem value="INFO">✓ All Clear</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-xs text-slate-400 whitespace-nowrap">
            {filtered.length} of {total} report{total !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ── Report List ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
              <ClipboardList className="absolute inset-0 m-auto h-6 w-6 text-indigo-400" />
            </div>
            <p className="mt-4 font-medium text-slate-500">Loading audit reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="p-6 bg-slate-100 rounded-3xl mb-4">
              <ClipboardList className="h-14 w-14 text-slate-300" />
            </div>
            <p className="text-xl font-bold text-slate-500">No reports found</p>
            <p className="text-sm mt-1">
              {search ? "Try a different search term" : "No inventory reconciliation reports have been submitted yet."}
            </p>
            {search && (
              <Button variant="ghost" size="sm" className="mt-3 gap-2" onClick={() => setSearch("")}>
                <X className="h-4 w-4" /> Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onViewAssets={() => setAssetModal(report)}
                onCreateTicket={() => setTicketModal(report)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => fetchReports(page - 1, severityFilter)}
              className="gap-1.5"
            >
              ← Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => fetchReports(p, severityFilter)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-medium transition-all",
                      p === page
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => fetchReports(page + 1, severityFilter)}
              className="gap-1.5"
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AssetListModal
        open={!!assetModal}
        onClose={() => setAssetModal(null)}
        report={assetModal}
      />

      <CreateTicketModal
        open={!!ticketModal}
        onClose={() => setTicketModal(null)}
        report={ticketModal}
        staffUsers={staffUsers}
        onCreated={(ticket) => {
          if (ticketModal) handleTicketCreated(ticketModal.id, ticket);
        }}
      />
    </div>
  );
}

/* ─────────────────────────── Export ─────────────────────────────────────── */
export default function AuditPageWrapper() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <AuditPage />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
