// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { toast } from "@/components/ui/use-toast";
import { formatTicketId } from "@/util/ticketFormat";
import {
  AlertCircle, Clock, CheckCircle2, XCircle, ArrowLeft,
  Calendar, Tag, Info, Loader2, MessageSquare, History, Activity,
  User, MapPin, Phone, Send, RefreshCw, ChevronRight, Zap,
  AlertTriangle, HelpCircle, Inbox, FileText, CheckCircle, Circle,
  ArrowUp, Minus, ArrowDown, Package, Settings, Brain, Sparkles,
  Target, Shield, TrendingUp, Cpu, Flame, Edit3, Hash,
} from "lucide-react";
import Link from "next/link";
import TicketBarcodeDisplay from "@/components/TicketBarcodeDisplay";
import PrintTicketButton from "@/components/PrintTicketButton";
import TicketHistory from "@/components/TicketHistory";

/* ── Types ── */
enum TicketStatus { OPEN = "OPEN", IN_PROGRESS = "IN_PROGRESS", RESOLVED = "RESOLVED", CLOSED = "CLOSED" }
enum TicketPriority { LOW = "LOW", MEDIUM = "MEDIUM", HIGH = "HIGH", CRITICAL = "CRITICAL" }

interface Ticket {
  id: string; displayId: string | null; title: string; description: string;
  status: TicketStatus; priority: TicketPriority;
  barcode: string | null; assetId: string | null; source?: string | null;
  assignedToId: string | null; requesterName?: string | null;
  ticketType?: string | null; category?: string | null; subcategory?: string | null;
  location?: string | null; contactDetails?: string | null;
  asset: { id: string; name: string; assetId: string } | null;
  assignedTo: { id: string; email: string } | null;
  user?: { id: string; email: string } | null;
  createdAt: string; updatedAt: string;
}

/* ── Config ── */
const PRIORITY_CFG = {
  CRITICAL: { label: "Critical", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/60", border: "border-red-200 dark:border-red-800", dot: "bg-red-500", barColor: "bg-red-500", gradient: "from-red-600 via-red-700 to-rose-800", icon: <Flame className="h-3.5 w-3.5" /> },
  HIGH:     { label: "High",     color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/60", border: "border-orange-200 dark:border-orange-800", dot: "bg-orange-500", barColor: "bg-orange-500", gradient: "from-orange-600 via-orange-700 to-amber-700", icon: <ArrowUp className="h-3.5 w-3.5" /> },
  MEDIUM:   { label: "Medium",   color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/60", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", barColor: "bg-amber-500", gradient: "from-amber-600 via-amber-700 to-yellow-700", icon: <Minus className="h-3.5 w-3.5" /> },
  LOW:      { label: "Low",      color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/60", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", barColor: "bg-emerald-500", gradient: "from-emerald-600 via-emerald-700 to-teal-700", icon: <ArrowDown className="h-3.5 w-3.5" /> },
};
const STATUS_CFG = {
  OPEN:        { label: "Open",        color: "text-blue-700 dark:text-blue-300",    bg: "bg-blue-50 dark:bg-blue-950/60",    border: "border-blue-200 dark:border-blue-800",  dot: "bg-blue-500",    icon: <Circle className="h-4 w-4 text-blue-500" />,      pulse: true },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-700 dark:text-amber-300",  bg: "bg-amber-50 dark:bg-amber-950/60",  border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500",   icon: <Clock className="h-4 w-4 text-amber-500" />,      pulse: true },
  RESOLVED:    { label: "Resolved",    color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/60", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, pulse: false },
  CLOSED:      { label: "Closed",      color: "text-slate-600 dark:text-slate-400",  bg: "bg-slate-100 dark:bg-slate-800/80", border: "border-slate-200 dark:border-slate-600", dot: "bg-slate-400",   icon: <XCircle className="h-4 w-4 text-slate-500" />,    pulse: false },
};
const TYPE_CFG = {
  ISSUE:      { label: "Issue",   icon: AlertTriangle, color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/60",    border: "border-red-200 dark:border-red-800",    hBg: "from-red-600 to-rose-700" },
  REQUEST:    { label: "Request", icon: Inbox,         color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/60",   border: "border-blue-200 dark:border-blue-800",   hBg: "from-blue-600 to-indigo-700" },
  INQUIRY:    { label: "Inquiry", icon: HelpCircle,    color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/60", border: "border-purple-200 dark:border-purple-800", hBg: "from-purple-600 to-violet-700" },
  MANAGEMENT: { label: "Mgmt",    icon: FileText,      color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800/80", border: "border-slate-200 dark:border-slate-600", hBg: "from-slate-700 to-slate-800" },
};
const ACTIONS_BY_TYPE = {
  ISSUE:      [{ label: "Start Investigation", to: "IN_PROGRESS", color: "bg-orange-500 hover:bg-orange-600", icon: Activity }, { label: "Mark Resolved", to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
  REQUEST:    [{ label: "Start Fulfillment",   to: "IN_PROGRESS", color: "bg-blue-500 hover:bg-blue-600",     icon: Zap },      { label: "Mark Complete",  to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
  INQUIRY:    [{ label: "Start Response",      to: "IN_PROGRESS", color: "bg-purple-500 hover:bg-purple-600", icon: MessageSquare }, { label: "Mark Answered",  to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
  MANAGEMENT: [{ label: "Start Processing",    to: "IN_PROGRESS", color: "bg-slate-600 hover:bg-slate-700",   icon: Settings }, { label: "Mark Complete",  to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
};

/* ── Helpers ── */
function PBadge({ p }: { p: string }) {
  const c = PRIORITY_CFG[p] || PRIORITY_CFG.MEDIUM;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.color} ${c.bg} ${c.border}`}>{c.icon}{c.label}</span>;
}
function SBadge({ s }: { s: string }) {
  const c = STATUS_CFG[s] || STATUS_CFG.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.color} ${c.bg} ${c.border}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`} />{c.label}
    </span>
  );
}
const safeFormatDate = (d: string | null | undefined) => {
  if (!d) return "Unknown";
  try { return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }).format(new Date(d)); }
  catch { return "Invalid date"; }
};
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "Just now"; if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`;
}
function Sk({ className = "" }) { return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />; }

/* ── Page wrapper ── */
export default function TicketDetailsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TicketDetailsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function TicketDetailsContent() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<TicketStatus>(TicketStatus.OPEN);
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
  const [comment, setComment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [staffMembers, setStaffMembers] = useState<{ id: string; email: string; name?: string; activeTicketCount?: number }[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "history" | "barcode" | "ai">("details");
  const isUpdatingRef = React.useRef(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [assignStartOpen, setAssignStartOpen] = useState(false);
  const [assignStartAssigneeId, setAssignStartAssigneeId] = useState("");
  const [assignStartActionLabel, setAssignStartActionLabel] = useState("");

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetchTicket(id);
    const interval = setInterval(() => { if (!isUpdatingRef.current) silentRefresh(id); }, 60000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    const handle = () => { if (document.visibilityState === "visible" && id && typeof id === "string") silentRefresh(id as string); };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [id]);

  useEffect(() => { isUpdatingRef.current = isUpdating; }, [isUpdating]);

  useEffect(() => {
    fetch("/api/planner/users").then(r => r.ok ? r.json() : null).then(data => {
      const list = (data?.users ?? []).map((u: any) => ({
        id: u.id || "", email: u.email || "",
        name: u.name || u.email?.split("@")[0].replace(/[._]/g," ").replace(/\b\w/g,(c:string) => c.toUpperCase()) || "",
        activeTicketCount: u.activeTicketCount ?? 0,
      })).filter((u: { id: string }) => u.id);
      setStaffMembers(list);
    }).catch(() => {});
  }, []);

  const fetchAiInsights = async (ticketId: string) => {
    setAiLoading(true);
    try {
      const r = await fetch("/api/tickets/ai-assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "insights", ticketId }) });
      if (r.ok) setAiInsights(await r.json());
    } catch {} finally { setAiLoading(false); }
  };

  useEffect(() => { if (activeTab === "ai" && ticket?.id && !aiInsights) fetchAiInsights(ticket.id); }, [activeTab, ticket?.id]);

  const loadTicketData = async (ticketId: string) => {
    const r = await fetch(`/api/tickets/${ticketId}`, { headers: { "Cache-Control": "no-cache" } });
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || "Failed to fetch ticket"); }
    const data = await r.json();
    if (!data || typeof data !== "object") throw new Error("Invalid response");
    return data;
  };

  const applyTicketData = (data: any, ticketId: string) => {
    const t = {
      id: data.id || ticketId, title: data.title || "Untitled Ticket", description: data.description || "",
      status: Object.values(TicketStatus).includes(data.status) ? data.status : TicketStatus.OPEN,
      priority: Object.values(TicketPriority).includes(data.priority) ? data.priority : TicketPriority.MEDIUM,
      barcode: data.barcode || null, assetId: data.assetId || null, source: data.source || null,
      assignedToId: data.assignedToId || null, assignedTo: data.assignedTo || null,
      requesterName: data.requesterName || null, displayId: data.displayId || null,
      ticketType: data.ticketType || null, category: data.category || null, subcategory: data.subcategory || null,
      location: data.location || null, contactDetails: data.contactDetails || null,
      asset: data.asset || null, user: data.user || null,
      createdAt: data.createdAt || new Date().toISOString(), updatedAt: data.updatedAt || new Date().toISOString(),
    };
    setTicket(t); setStatus(t.status); setPriority(t.priority); setAssignedToId(t.assignedToId || "");
  };

  const fetchTicket = async (ticketId: string) => {
    setIsLoading(true);
    try { const data = await loadTicketData(ticketId); applyTicketData(data, ticketId); }
    catch (error) { toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fetch ticket", variant: "destructive" }); setTicket(null); }
    finally { setIsLoading(false); }
  };

  const silentRefresh = async (ticketId: string) => {
    try { const data = await loadTicketData(ticketId); applyTicketData(data, ticketId); } catch {}
  };

  const updateTicket = async () => {
    if (!ticket || !id || typeof id !== "string") return;
    const isStatusChanged = status !== ticket.status, isPriorityChanged = priority !== ticket.priority;
    if ((isStatusChanged || isPriorityChanged) && !comment.trim()) {
      toast({ title: "Comment Required", description: "Please add a comment explaining your changes.", variant: "destructive" });
      return;
    }
    setIsUpdating(true);
    try {
      const body: any = { title: ticket.title, description: ticket.description, status, priority };
      if (comment.trim()) body.comment = comment.trim();
      if (assignedToId !== (ticket.assignedToId || "")) body.assignedToId = assignedToId || null;
      const r = await fetch(`/api/tickets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || "Failed to update ticket"); }
      applyTicketData(await r.json(), id as string);
      toast({ title: "Ticket updated successfully" });
      setComment(""); setActiveTab("history");
      setTimeout(() => { if (typeof id === "string") silentRefresh(id); }, 500);
    } catch (error) { toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update", variant: "destructive" }); }
    finally { setIsUpdating(false); }
  };

  const quickAction = async (toStatus: TicketStatus, label: string) => {
    if (!id || typeof id !== "string") return;
    if (toStatus === TicketStatus.IN_PROGRESS) { setAssignStartActionLabel(label); setAssignStartAssigneeId(assignedToId || ""); setAssignStartOpen(true); return; }
    setIsUpdating(true);
    try {
      const r = await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: toStatus, comment: `${label} — updated by support team` }) });
      if (!r.ok) throw new Error();
      applyTicketData(await r.json(), id as string);
      toast({ title: `Ticket ${label.toLowerCase()}` });
      setActiveTab("history");
    } catch { toast({ variant: "destructive", title: "Failed to update ticket" }); }
    finally { setIsUpdating(false); }
  };

  const confirmAssignAndStart = async () => {
    if (!assignStartAssigneeId.trim() || !id || typeof id !== "string") {
      toast({ variant: "destructive", title: "Please select a staff member." }); return;
    }
    setIsUpdating(true);
    try {
      const r = await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: TicketStatus.IN_PROGRESS, assignedToId: assignStartAssigneeId, comment: `${assignStartActionLabel} — assigned to staff. The requester will be notified.` }) });
      if (!r.ok) throw new Error();
      applyTicketData(await r.json(), id as string);
      setAssignedToId(assignStartAssigneeId); setAssignStartOpen(false); setAssignStartAssigneeId("");
      setActiveTab("history");
      toast({ title: "Ticket in progress", description: "The user has been notified with the assignee's contact details." });
    } catch { toast({ variant: "destructive", title: "Failed to assign and start progress" }); }
    finally { setIsUpdating(false); }
  };

  const assignTicket = async (uid: string) => {
    if (!id || typeof id !== "string") return;
    setIsUpdating(true);
    try {
      const r = await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedToId: uid || null }) });
      if (!r.ok) throw new Error();
      applyTicketData(await r.json(), id as string);
      setAssignedToId(uid);
      toast({ title: uid ? "Ticket assigned" : "Assignment removed" });
    } catch { toast({ variant: "destructive", title: "Failed to assign ticket" }); }
    finally { setIsUpdating(false); }
  };

  /* ── Loading skeleton ── */
  if (isLoading) return (
    <div className="space-y-5">
      <Sk className="h-48 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">{[1,2,3].map(i => <Sk key={i} className="h-40 rounded-2xl" />)}</div>
        <div className="space-y-4">{[1,2,3].map(i => <Sk key={i} className="h-32 rounded-2xl" />)}</div>
      </div>
    </div>
  );

  if (!ticket) return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted"><AlertCircle className="h-8 w-8 text-muted-foreground/40" /></div>
      <div><p className="font-bold text-lg">Ticket not found</p><p className="mt-1 text-sm text-muted-foreground">This ticket doesn't exist or you don't have access.</p></div>
      <Link href="/tickets" className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity">
        <ArrowLeft className="h-4 w-4" /> Back to Tickets
      </Link>
    </div>
  );

  const tc = TYPE_CFG[ticket.ticketType as keyof typeof TYPE_CFG] || TYPE_CFG.ISSUE;
  const pc = PRIORITY_CFG[ticket.priority] || PRIORITY_CFG.MEDIUM;
  const sc = STATUS_CFG[ticket.status] || STATUS_CFG.OPEN;
  const TypeIcon = tc.icon;
  const availableActions = (ACTIONS_BY_TYPE[ticket.ticketType as keyof typeof ACTIONS_BY_TYPE] || ACTIONS_BY_TYPE.ISSUE)
    .filter(a => ticket.status !== TicketStatus.CLOSED && ticket.status !== a.to);

  const STEPS = [
    { key: "OPEN", label: "Open", dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
    { key: "IN_PROGRESS", label: "In Progress", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
    { key: "RESOLVED", label: "Resolved", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    { key: "CLOSED", label: "Closed", dot: "bg-slate-400", text: "text-muted-foreground" },
  ];
  const stepIdx = STEPS.findIndex(s => s.key === ticket.status);

  return (
    <div className="space-y-5">
      {/* ── Hero header ── */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tc.hBg} shadow-xl`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.3),transparent_60%)]" />
        <div className={`absolute inset-x-0 bottom-0 h-1 ${pc.barColor}`} />

        <div className="relative z-10 p-6">
          {/* Top row: back + actions */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/tickets"
              className="flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 backdrop-blur px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Tickets
            </Link>
            <div className="flex items-center gap-2">
              <button onClick={() => { if (typeof id === "string") silentRefresh(id as string); }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-white hover:bg-white/25 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
              <PrintTicketButton ticket={ticket} variant="outline" size="default" className="bg-white/15 border-white/20 text-white hover:bg-white/25" />
            </div>
          </div>

          {/* Ticket info */}
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* Type badge */}
                <span className="flex items-center gap-1.5 rounded-xl bg-white/20 border border-white/25 px-3 py-1 text-xs font-bold text-white">
                  <TypeIcon className="h-3.5 w-3.5" />{tc.label}
                </span>
                <span className="font-mono text-xs font-bold text-white/60">{formatTicketId(ticket.displayId, ticket.id)}</span>
                {ticket.source === "PORTAL" && <span className="rounded-full bg-violet-400/30 border border-violet-300/40 px-2.5 py-0.5 text-[10px] font-bold text-white">Portal</span>}
                {ticket.source === "OUTLOOK" && <span className="rounded-full bg-sky-400/30 border border-sky-300/40 px-2.5 py-0.5 text-[10px] font-bold text-white">Outlook</span>}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight line-clamp-2">{ticket.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className={`flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-bold text-white`}>
                  <span className={`h-2 w-2 rounded-full ${sc.dot} ${sc.pulse ? "animate-pulse" : ""}`} />
                  {sc.label}
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  {pc.icon}{pc.label}
                </div>
                <span className="text-xs text-white/60"><Calendar className="inline h-3 w-3 mr-1" />{safeFormatDate(ticket.createdAt)}</span>
                <span className="text-xs text-white/60">Updated {timeAgo(ticket.updatedAt)}</span>
              </div>
            </div>

            {/* Quick actions */}
            {availableActions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {availableActions.map(a => {
                  const Icon = a.icon;
                  return (
                    <button key={a.label} onClick={() => quickAction(a.to as TicketStatus, a.label)} disabled={isUpdating}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50 shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all ${a.color}`}>
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                      {a.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress track ── */}
      <div className="rounded-2xl border border-border bg-card px-6 py-4 shadow-sm">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isDone = i <= stepIdx, isActive = i === stepIdx, isLast = i === STEPS.length - 1;
            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    isActive ? `${step.dot} border-transparent shadow-lg` :
                    isDone ? `${step.dot} border-transparent opacity-70` :
                    "border-border bg-muted"
                  }`}>
                    {isActive ? (
                      <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
                    ) : isDone ? (
                      <CheckCircle className="h-4 w-4 text-white" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className={`text-[10px] font-bold whitespace-nowrap ${isActive ? step.text : isDone ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                    {step.label}
                  </span>
                </div>
                {!isLast && (
                  <div className="flex-1 mx-2 mb-5">
                    <div className={`h-0.5 w-full transition-all duration-700 ${i < stepIdx ? step.dot : "bg-border"}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Assign & Start Modal ── */}
      {assignStartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssignStartOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className={`flex items-center gap-3 px-5 py-4 bg-gradient-to-r ${tc.hBg}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20"><TypeIcon className="h-5 w-5 text-white" /></div>
              <div>
                <h3 className="font-bold text-white">Assign & start progress</h3>
                <p className="text-xs text-white/70">The requester will be notified with the assignee's contact details.</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2 italic">"{ticket.title}"</p>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Assign to (required)</label>
                <select value={assignStartAssigneeId} onChange={e => setAssignStartAssigneeId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="">Select staff member…</option>
                  {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name || s.email.split("@")[0]} — {s.activeTicketCount ?? 0} active · {s.email}</option>)}
                </select>
                <p className="mt-1.5 text-[10px] text-muted-foreground">The user will see this person's name and email in their notification.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
              <button onClick={() => setAssignStartOpen(false)} className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
              <button onClick={confirmAssignAndStart} disabled={isUpdating || !assignStartAssigneeId}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {isUpdating ? "Starting…" : `${assignStartActionLabel} & notify`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main 2-col layout ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── LEFT: Main content ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 rounded-2xl border border-border bg-muted/40 p-1.5">
            {[
              { key: "details",  label: "Details",  icon: Info },
              { key: "history",  label: "Activity", icon: History },
              { key: "ai",       label: "AI Intel",  icon: Brain },
              ...(ticket.barcode ? [{ key: "barcode", label: "Barcode", icon: Tag }] : []),
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    isActive ? "bg-card shadow-sm text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                  }`}>
                  <Icon className={`h-4 w-4 ${isActive && tab.key === "ai" ? "text-violet-600 dark:text-violet-400" : isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Details tab */}
          {activeTab === "details" && (
            <div className="space-y-4">
              {/* Description */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border/50 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {ticket.description || <span className="italic text-muted-foreground">No description provided.</span>}
                </div>
              </div>

              {/* Metadata */}
              {(ticket.location || ticket.contactDetails || ticket.category || ticket.subcategory) && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Request Details</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {ticket.category && (
                      <div className="flex items-start gap-3 rounded-xl bg-muted/40 border border-border/50 p-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Tag className="h-4 w-4 text-muted-foreground" /></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</p><p className="text-sm font-semibold">{ticket.category.replace("_"," ")}</p></div>
                      </div>
                    )}
                    {ticket.subcategory && (
                      <div className="flex items-start gap-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 p-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50"><Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">Service Type</p><p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{ticket.subcategory}</p></div>
                      </div>
                    )}
                    {ticket.location && (
                      <div className="flex items-start gap-3 rounded-xl bg-muted/40 border border-border/50 p-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><MapPin className="h-4 w-4 text-muted-foreground" /></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</p><p className="text-sm font-semibold">{ticket.location}</p></div>
                      </div>
                    )}
                    {ticket.contactDetails && (
                      <div className="flex items-start gap-3 rounded-xl bg-muted/40 border border-border/50 p-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Phone className="h-4 w-4 text-muted-foreground" /></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact</p><p className="text-sm font-semibold">{ticket.contactDetails}</p></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Asset */}
              {ticket.asset && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Related Asset</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-muted/40 border border-border/50 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{ticket.asset.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{ticket.asset.assetId}</p>
                    </div>
                    <Link href={`/assets/${ticket.asset.id}`}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-colors shrink-0">
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <TicketHistory ticketId={ticket.id} />
            </div>
          )}

          {/* Barcode tab */}
          {activeTab === "barcode" && ticket.barcode && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <TicketBarcodeDisplay key={`barcode-${ticket.id}`} ticketId={ticket.id} ticketTitle={ticket.title} barcode={ticket.barcode} displayId={ticket.displayId} />
            </div>
          )}

          {/* AI tab */}
          {activeTab === "ai" && (
            <div className="relative overflow-hidden rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-950 via-purple-900 to-slate-900">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.4),transparent_60%)]" />
              <div className="relative z-10">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Brain className="h-5 w-5 text-violet-300" /></div>
                    <div><p className="font-bold text-white">AI Intelligence Report</p><p className="text-xs text-violet-300">Real-time analysis for this ticket</p></div>
                  </div>
                  <button onClick={() => { setAiInsights(null); fetchAiInsights(ticket.id); }} disabled={aiLoading}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-violet-300 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-50">
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {aiLoading ? (
                    <div className="flex items-center justify-center gap-3 py-10">
                      <Cpu className="h-6 w-6 text-violet-400 animate-pulse" />
                      <p className="text-sm font-medium text-violet-300">Analysing ticket with AI…</p>
                    </div>
                  ) : aiInsights ? (
                    <>
                      {/* SLA */}
                      <div className={`rounded-2xl border p-4 ${aiInsights.sla?.breached ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Shield className={`h-4 w-4 ${aiInsights.sla?.breached ? "text-red-400" : "text-emerald-400"}`} />
                            <p className={`text-sm font-bold ${aiInsights.sla?.breached ? "text-red-300" : "text-emerald-300"}`}>
                              SLA: {aiInsights.sla?.breached ? "⚠ Breached" : "✓ On Track"} — {aiInsights.sla?.target}
                            </p>
                          </div>
                          <span className={`text-sm font-black ${aiInsights.sla?.breached ? "text-red-300" : "text-emerald-300"}`}>{aiInsights.sla?.progressPct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${aiInsights.sla?.breached ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(aiInsights.sla?.progressPct || 0, 100)}%` }} />
                        </div>
                      </div>

                      {/* Sentiment */}
                      {aiInsights.sentiment && (
                        <div className="flex items-center gap-3 rounded-xl bg-white/8 border border-white/10 px-4 py-3">
                          <span className="text-2xl">{aiInsights.sentiment.emoji}</span>
                          <div>
                            <p className="text-sm font-bold text-white">Requester Sentiment: {aiInsights.sentiment.sentiment}</p>
                            <p className="text-xs text-white/60">Detected from ticket description</p>
                          </div>
                        </div>
                      )}

                      {/* Insights */}
                      {aiInsights.insights?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-violet-400">AI Insights</p>
                          {aiInsights.insights.map((ins: string, i: number) => (
                            <div key={i} className="flex items-start gap-2.5 rounded-xl bg-white/8 border border-white/10 px-3.5 py-2.5">
                              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-violet-400 shrink-0" />
                              <p className="text-sm text-white/90">{ins}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suggested Assignee */}
                      {aiInsights.suggestedAssignee && (
                        <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="h-4 w-4 text-blue-300" />
                            <p className="text-sm font-bold text-blue-300">AI Suggested Assignee</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white shrink-0">{aiInsights.suggestedAssignee.name[0]}</div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-white">{aiInsights.suggestedAssignee.name}</p>
                              <p className="text-xs text-white/60">{aiInsights.suggestedAssignee.email} · {aiInsights.suggestedAssignee.activeTickets} active</p>
                              <p className="text-xs text-blue-300">{aiInsights.suggestedAssignee.reason}</p>
                            </div>
                            <button onClick={() => assignTicket(aiInsights.suggestedAssignee.id)}
                              className="rounded-xl bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-400 transition-colors shrink-0">
                              Assign Now
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Benchmark */}
                      {aiInsights.benchmark && (
                        <div className="flex items-center justify-between rounded-xl bg-white/8 border border-white/10 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-white/60" />
                            <p className="text-sm text-white/80">Similar ticket avg. resolution</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-black text-white">{aiInsights.benchmark.avgResolutionFormatted}</p>
                            <p className="text-[10px] text-white/50">{aiInsights.benchmark.sampleSize} tickets</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center"><Brain className="h-7 w-7 text-violet-400" /></div>
                      <p className="text-sm text-white/60">Click refresh to run AI analysis on this ticket</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Comment / Update form ── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {(status !== ticket.status || priority !== ticket.priority) ? "Update Ticket — Comment required" : "Add Comment or Note"}
              </p>
              {(status !== ticket.status || priority !== ticket.priority) && (
                <span className="ml-auto text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5">Changes pending</span>
              )}
            </div>

            {(status !== ticket.status || priority !== ticket.priority) && (
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {status !== ticket.status && (
                  <div className="flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-1 font-semibold text-blue-700 dark:text-blue-300">
                    <span className="text-blue-400">Status:</span> {ticket.status} → {status}
                  </div>
                )}
                {priority !== ticket.priority && (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1 font-semibold text-amber-700 dark:text-amber-300">
                    <span className="text-amber-400">Priority:</span> {ticket.priority} → {priority}
                  </div>
                )}
              </div>
            )}

            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4}
              placeholder={status !== ticket.status || priority !== ticket.priority ? "Required: explain the changes you're making…" : "Add a comment, note or internal update…"}
              className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-400 dark:focus:border-indigo-600 focus:bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors" />

            <div className="mt-3 flex items-center justify-end">
              <button onClick={updateTicket}
                disabled={isUpdating || (status === ticket.status && priority === ticket.priority && !comment.trim() && assignedToId === (ticket.assignedToId || ""))}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isUpdating ? "Updating…" : "Update Ticket"}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-4">
          {/* Status control */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className={`h-1 w-full ${sc.dot}`} />
            <div className="p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</p>
              <div className="mb-3 flex items-center gap-2">{sc.icon}<SBadge s={ticket.status} /></div>
              <div className="space-y-1.5">
                {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                  <button key={key} onClick={() => setStatus(key as TicketStatus)}
                    className={`w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all ${
                      status === key ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "border-border bg-background hover:bg-muted text-muted-foreground"
                    }`}>
                    <span className={`h-2 w-2 rounded-full ${cfg.dot} ${cfg.pulse && status === key ? "animate-pulse" : ""}`} />
                    {cfg.label}
                    {status === key && <CheckCircle className="ml-auto h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Priority control */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority</p>
            <div className="mb-3"><PBadge p={ticket.priority} /></div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PRIORITY_CFG).map(([key, cfg]) => (
                <button key={key} onClick={() => setPriority(key as TicketPriority)}
                  className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 text-xs font-bold transition-all ${
                    priority === key ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted"
                  }`}>
                  {cfg.icon}{cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned To</p>
            {ticket.assignedTo ? (
              <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shrink-0">
                  {ticket.assignedTo.email[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate">{ticket.assignedTo.email.split("@")[0]}</p>
                  <p className="text-[10px] text-indigo-400 truncate">{ticket.assignedTo.email}</p>
                </div>
              </div>
            ) : (
              <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                Unassigned — needs routing
              </div>
            )}
            <div className="relative">
              <select value={assignedToId} onChange={e => assignTicket(e.target.value)} disabled={isUpdating}
                className="w-full appearance-none rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 cursor-pointer">
                <option value="">⊘ Unassigned</option>
                {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name || s.email.split("@")[0]} — {s.activeTicketCount ?? 0} active</option>)}
              </select>
              {isUpdating && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* Requester info */}
          {(ticket.user || ticket.requesterName) && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Submitted By</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-bold text-white shrink-0">
                  {(ticket.user?.email || ticket.requesterName || "U")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{ticket.requesterName || ticket.user?.email?.split("@")[0] || "Unknown User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{ticket.user?.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                {ticket.location && <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-muted/40 px-3 py-2"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{ticket.location}</span></div>}
                {ticket.contactDetails && <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-muted/40 px-3 py-2"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{ticket.contactDetails}</span></div>}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Timeline</p>
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
              {[
                { icon: Circle, label: "Created", value: safeFormatDate(ticket.createdAt), dot: "bg-blue-500" },
                { icon: RefreshCw, label: "Last Updated", value: timeAgo(ticket.updatedAt), dot: "bg-indigo-500" },
                { icon: sc.icon?.type || Clock, label: "Current Status", value: sc.label, dot: sc.dot },
              ].map((item, i) => (
                <div key={i} className="relative mb-4 last:mb-0">
                  <div className={`absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${item.dot} border-2 border-background`} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
