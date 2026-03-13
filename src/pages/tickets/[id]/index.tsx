// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { toast } from "@/components/ui/use-toast";
import { formatTicketId } from "@/util/ticketFormat";
import {
  AlertCircle, Clock, CheckCircle2, XCircle, ArrowLeft, Printer,
  Calendar, Tag, Info, Loader2, MessageSquare, History, Activity,
  User, MapPin, Phone, Building, Send, RefreshCw, UserPlus,
  ChevronRight, Zap, AlertTriangle, HelpCircle, Inbox, FileText,
  CheckCircle, Circle, ArrowUp, Minus, ArrowDown, Eye, Ticket,
  BarChart3, X, Package, Settings, Star,
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
  CRITICAL: { label: "Critical", color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500",     barColor: "border-t-red-500",    icon: <ArrowUp className="h-3.5 w-3.5" /> },
  HIGH:     { label: "High",     color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  dot: "bg-orange-500",  barColor: "border-t-orange-500",  icon: <ArrowUp className="h-3.5 w-3.5" /> },
  MEDIUM:   { label: "Medium",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   barColor: "border-t-amber-500",   icon: <Minus className="h-3.5 w-3.5" /> },
  LOW:      { label: "Low",      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", barColor: "border-t-emerald-500", icon: <ArrowDown className="h-3.5 w-3.5" /> },
};
const STATUS_CFG = {
  OPEN:        { label: "Open",        color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500",    icon: <Circle className="h-4 w-4 text-blue-500" /> },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   icon: <Clock className="h-4 w-4 text-amber-500" /> },
  RESOLVED:    { label: "Resolved",    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
  CLOSED:      { label: "Closed",      color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   dot: "bg-slate-400",   icon: <XCircle className="h-4 w-4 text-slate-500" /> },
};
const TICKET_TYPE_CFG = {
  ISSUE:      { label: "Issue",     icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    headerBg: "from-red-600 to-red-700" },
  REQUEST:    { label: "Request",   icon: Inbox,         color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   headerBg: "from-blue-600 to-blue-700" },
  INQUIRY:    { label: "Inquiry",   icon: HelpCircle,    color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", headerBg: "from-purple-600 to-purple-700" },
  MANAGEMENT: { label: "Mgmt",      icon: FileText,      color: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-200",  headerBg: "from-slate-700 to-slate-800" },
};

const ACTIONS_BY_TYPE = {
  ISSUE:      [{ label: "Start Investigation", to: "IN_PROGRESS", color: "bg-orange-500 hover:bg-orange-600", icon: Activity }, { label: "Mark Resolved",     to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close Ticket", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
  REQUEST:    [{ label: "Start Fulfillment",   to: "IN_PROGRESS", color: "bg-blue-500 hover:bg-blue-600",     icon: Zap },      { label: "Mark Complete",     to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close Ticket", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
  INQUIRY:    [{ label: "Start Response",      to: "IN_PROGRESS", color: "bg-purple-500 hover:bg-purple-600", icon: MessageSquare }, { label: "Mark Answered", to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close Ticket", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
  MANAGEMENT: [{ label: "Start Processing",    to: "IN_PROGRESS", color: "bg-slate-600 hover:bg-slate-700",   icon: Settings }, { label: "Mark Complete",     to: "RESOLVED", color: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 }, { label: "Close Ticket", to: "CLOSED", color: "bg-slate-600 hover:bg-slate-700", icon: XCircle }],
};

/* ── Helpers ── */
function PBadge({ p }: { p: string }) {
  const c = PRIORITY_CFG[p] || PRIORITY_CFG.MEDIUM;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.color} ${c.bg} ${c.border}`}>{c.icon}{c.label}</span>;
}
function SBadge({ s }: { s: string }) {
  const c = STATUS_CFG[s] || STATUS_CFG.OPEN;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.color} ${c.bg} ${c.border}`}><span className={`h-2 w-2 rounded-full ${c.dot}`} />{c.label}</span>;
}
const safeFormatDate = (d: string | null | undefined) => {
  if (!d) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }).format(new Date(d));
  } catch { return "Invalid date"; }
};
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Skeleton ── */
function Sk({ className = "" }) { return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />; }

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

/* ── Content ── */
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
  const [staffMembers, setStaffMembers] = useState<{ id: string; email: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "history" | "barcode">("details");
  const isUpdatingRef = React.useRef(false);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetchTicket(id);
    const interval = setInterval(() => {
      if (!isUpdatingRef.current) silentRefresh(id);
    }, 60000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible" && id && typeof id === "string") silentRefresh(id as string);
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [id]);

  useEffect(() => { isUpdatingRef.current = isUpdating; }, [isUpdating]);

  // Fetch staff members
  useEffect(() => {
    fetch("/api/planner/users").then(r => r.ok ? r.json() : null).then(data => {
      const list = (data?.users ?? Array.isArray(data) ? data : [])
        .map((u: any) => ({ id: u.id || "", email: u.email || "" }))
        .filter((u: { id: string }) => u.id);
      setStaffMembers(list);
    }).catch(() => {});
  }, []);

  const fetchTicket = async (ticketId: string) => {
    setIsLoading(true);
    try {
      const data = await loadTicketData(ticketId);
      applyTicketData(data, ticketId);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fetch ticket", variant: "destructive" });
      setTicket(null);
    } finally { setIsLoading(false); }
  };

  const silentRefresh = async (ticketId: string) => {
    try {
      const data = await loadTicketData(ticketId);
      applyTicketData(data, ticketId);
    } catch {}
  };

  const loadTicketData = async (ticketId: string) => {
    const r = await fetch(`/api/tickets/${ticketId}`, { headers: { "Cache-Control": "no-cache" } });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || "Failed to fetch ticket");
    }
    const data = await r.json();
    if (!data || typeof data !== "object") throw new Error("Invalid response");
    return data;
  };

  const applyTicketData = (data: any, ticketId: string) => {
    const t = {
      id: data.id || ticketId,
      title: data.title || "Untitled Ticket",
      description: data.description || "",
      status: Object.values(TicketStatus).includes(data.status) ? data.status : TicketStatus.OPEN,
      priority: Object.values(TicketPriority).includes(data.priority) ? data.priority : TicketPriority.MEDIUM,
      barcode: data.barcode || null,
      assetId: data.assetId || null,
      source: data.source || null,
      assignedToId: data.assignedToId || null,
      assignedTo: data.assignedTo || null,
      requesterName: data.requesterName || null,
      displayId: data.displayId || null,
      ticketType: data.ticketType || null,
      category: data.category || null,
      subcategory: data.subcategory || null,
      location: data.location || null,
      contactDetails: data.contactDetails || null,
      asset: data.asset || null,
      user: data.user || null,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
    setTicket(t);
    setStatus(t.status);
    setPriority(t.priority);
    setAssignedToId(t.assignedToId || "");
  };

  const updateTicket = async () => {
    if (!ticket || !id || typeof id !== "string") return;
    const isStatusChanged = status !== ticket.status;
    const isPriorityChanged = priority !== ticket.priority;
    const isAssignChanged = assignedToId !== (ticket.assignedToId || "");
    if ((isStatusChanged || isPriorityChanged) && !comment.trim()) {
      toast({ title: "Comment Required", description: "Please add a comment explaining your changes.", variant: "destructive" });
      return;
    }
    setIsUpdating(true);
    try {
      const body: any = { title: ticket.title, description: ticket.description, status, priority };
      if (comment.trim()) body.comment = comment.trim();
      if (isAssignChanged) body.assignedToId = assignedToId || null;
      const r = await fetch(`/api/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update ticket");
      }
      const updated = await r.json();
      applyTicketData(updated, id as string);
      toast({ title: "Ticket updated successfully" });
      setComment("");
      setActiveTab("history");
      setTimeout(() => { if (typeof id === "string") silentRefresh(id); }, 500);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update", variant: "destructive" });
    } finally { setIsUpdating(false); }
  };

  const quickAction = async (toStatus: TicketStatus, label: string) => {
    if (!id || typeof id !== "string") return;
    setIsUpdating(true);
    try {
      const r = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus, comment: `${label} — updated by support team` }),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      applyTicketData(updated, id as string);
      toast({ title: `Ticket ${label.toLowerCase()}` });
      setActiveTab("history");
    } catch { toast({ variant: "destructive", title: "Failed to update ticket" }); }
    finally { setIsUpdating(false); }
  };

  const assignTicket = async (uid: string) => {
    if (!id || typeof id !== "string") return;
    setIsUpdating(true);
    try {
      const r = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: uid || null }),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      applyTicketData(updated, id as string);
      setAssignedToId(uid);
      toast({ title: uid ? "Ticket assigned" : "Assignment removed" });
    } catch { toast({ variant: "destructive", title: "Failed to assign ticket" }); }
    finally { setIsUpdating(false); }
  };

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Sk className="h-9 w-20" />
          <div className="space-y-2 flex-1"><Sk className="h-8 w-64" /><Sk className="h-4 w-40" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1,2,3].map(i => <Sk key={i} className="h-40 rounded-2xl" />)}
          </div>
          <div className="space-y-4">
            {[1,2,3].map(i => <Sk key={i} className="h-32 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <div><p className="font-bold text-slate-900">Ticket not found</p><p className="mt-1 text-sm text-slate-500">This ticket doesn't exist or you don't have access.</p></div>
        <Link href="/tickets" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Tickets
        </Link>
      </div>
    );
  }

  const tc = TICKET_TYPE_CFG[ticket.ticketType as keyof typeof TICKET_TYPE_CFG] || TICKET_TYPE_CFG.ISSUE;
  const pc = PRIORITY_CFG[ticket.priority] || PRIORITY_CFG.MEDIUM;
  const sc = STATUS_CFG[ticket.status] || STATUS_CFG.OPEN;
  const TypeIcon = tc.icon;
  const availableActions = (ACTIONS_BY_TYPE[ticket.ticketType as keyof typeof ACTIONS_BY_TYPE] || ACTIONS_BY_TYPE.ISSUE)
    .filter(a => {
      if (ticket.status === TicketStatus.CLOSED) return false;
      if (ticket.status === a.to) return false;
      return true;
    });

  const STEPS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const stepIdx = STEPS.indexOf(ticket.status);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/tickets"
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 line-clamp-2">{ticket.title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-400">{formatTicketId(ticket.displayId, ticket.id)}</span>
              <SBadge s={ticket.status} />
              <PBadge p={ticket.priority} />
              {ticket.source === "PORTAL" && <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">Portal</span>}
              {ticket.ticketType && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tc.color} ${tc.bg} ${tc.border}`}>
                  <TypeIcon className="h-3 w-3" />{tc.label}
                </span>
              )}
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5" /> Created {safeFormatDate(ticket.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { if (typeof id === "string") silentRefresh(id); }}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <PrintTicketButton ticket={ticket} variant="outline" size="default" />
        </div>
      </div>

      {/* ── Quick Action Buttons (type-specific) ── */}
      {availableActions.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-white p-4">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">
            <Zap className="h-3.5 w-3.5" /> Quick Actions
          </span>
          {availableActions.map(a => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={() => quickAction(a.to as TicketStatus, a.label)} disabled={isUpdating}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:scale-105 active:scale-100 ${a.color}`}>
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Status Progress ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Ticket Progress</p>
        <div className="flex items-start gap-1.5">
          {STEPS.map((step, i) => {
            const c = STATUS_CFG[step]; const done = i <= stepIdx; const active = i === stepIdx;
            return (
              <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
                <div className={`relative h-2.5 w-full overflow-hidden rounded-full transition-all duration-700 ${done ? c.dot : "bg-slate-100"}`}>
                  {active && <div className="absolute inset-0 animate-pulse opacity-60 bg-white" />}
                </div>
                <span className={`text-center text-[10px] font-bold leading-tight ${done ? c.color : "text-slate-300"}`}>{c.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main 2-col layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── LEFT: Main content ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-1">
            {[
              { key: "details",  label: "Details",  icon: Info },
              { key: "history",  label: "Activity", icon: History },
              ...(ticket.barcode ? [{ key: "barcode", label: "Barcode", icon: Tag }] : []),
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${activeTab === tab.key ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Icon className="h-4 w-4" />{tab.label}
                </button>
              );
            })}
          </div>

          {/* Details tab */}
          {activeTab === "details" && (
            <div className="space-y-4">
              {/* Description */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Description</p>
                <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {ticket.description}
                </div>
              </div>

              {/* Ticket metadata */}
              {(ticket.location || ticket.contactDetails || ticket.category || ticket.subcategory) && (
                <div className="rounded-2xl border border-slate-100 bg-white p-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Request Details</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {ticket.category && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</p><p className="text-sm font-semibold text-slate-700">{ticket.category.replace("_", " ")}</p></div>
                      </div>
                    )}
                    {ticket.subcategory && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 p-3">
                        <Settings className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Service Type</p><p className="text-sm font-semibold text-blue-700">{ticket.subcategory}</p></div>
                      </div>
                    )}
                    {ticket.location && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p><p className="text-sm font-semibold text-slate-700">{ticket.location}</p></div>
                      </div>
                    )}
                    {ticket.contactDetails && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact</p><p className="text-sm font-semibold text-slate-700">{ticket.contactDetails}</p></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Asset */}
              {ticket.asset && (
                <div className="rounded-2xl border border-slate-100 bg-white p-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Related Asset</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                      <Package className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{ticket.asset.name}</p>
                      <p className="font-mono text-xs text-slate-400">{ticket.asset.assetId}</p>
                    </div>
                    <Link href={`/assets/${ticket.asset.id}`}
                      className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                      View Asset <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <div className="rounded-2xl border border-slate-100 bg-white">
              <TicketHistory ticketId={ticket.id} />
            </div>
          )}

          {/* Barcode tab */}
          {activeTab === "barcode" && ticket.barcode && (
            <TicketBarcodeDisplay key={`barcode-${ticket.id}`} ticketId={ticket.id} ticketTitle={ticket.title} barcode={ticket.barcode} displayId={ticket.displayId} />
          )}

          {/* ── Update / Comment form ── */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              {(status !== ticket.status || priority !== ticket.priority) ? "Update Ticket (comment required)" : "Add Comment"}
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
              placeholder={`${status !== ticket.status || priority !== ticket.priority ? "Explain the changes you're making…" : "Add a comment or note…"}`}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                {status !== ticket.status && <span className="font-semibold text-amber-600">Status: {ticket.status} → {status}</span>}
                {priority !== ticket.priority && <span className="ml-2 font-semibold text-amber-600">Priority: {ticket.priority} → {priority}</span>}
              </p>
              <button onClick={updateTicket}
                disabled={isUpdating || (status === ticket.status && priority === ticket.priority && !comment.trim() && assignedToId === (ticket.assignedToId || ""))}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition-colors">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isUpdating ? "Updating…" : "Update Ticket"}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-4">
          {/* Status */}
          <div className={`rounded-2xl border-t-4 border-slate-100 bg-white p-5 ${pc.barColor}`}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Status</p>
            <div className="mb-3 flex items-center gap-2">{sc.icon}<SBadge s={ticket.status} /></div>
            <select value={status} onChange={e => setStatus(e.target.value as TicketStatus)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors">
              {Object.values(TicketStatus).map(s => <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>)}
            </select>
          </div>

          {/* Priority */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Priority</p>
            <div className="mb-3"><PBadge p={ticket.priority} /></div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PRIORITY_CFG).map(([key, cfg]) => (
                <button key={key} onClick={() => setPriority(key as TicketPriority)}
                  className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 text-xs font-semibold transition-all ${priority === key ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"}`}>
                  {cfg.icon}{cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Assigned To</p>
            {ticket.assignedTo ? (
              <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-violet-50 p-3 border border-violet-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white">
                  {ticket.assignedTo.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-violet-700">{ticket.assignedTo.email.split("@")[0]}</p>
                  <p className="text-[10px] text-violet-400">{ticket.assignedTo.email}</p>
                </div>
              </div>
            ) : (
              <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">Not assigned yet</p>
            )}
            <div className="relative">
              <select
                value={assignedToId}
                onChange={e => assignTicket(e.target.value)}
                disabled={isUpdating}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors disabled:opacity-50">
                <option value="">Unassigned</option>
                {staffMembers.map(s => <option key={s.id} value={s.id}>{s.email}</option>)}
              </select>
              {isUpdating && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
            </div>
          </div>

          {/* Requester info */}
          {(ticket.user || ticket.requesterName) && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Submitted By</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-bold text-white">
                  {(ticket.user?.email || ticket.requesterName || "U")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{ticket.requesterName || ticket.user?.email?.split("@")[0] || "Unknown User"}</p>
                  <p className="text-xs text-slate-500">{ticket.user?.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                {ticket.location && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{ticket.location}</span>
                  </div>
                )}
                {ticket.contactDetails && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{ticket.contactDetails}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dates & Meta */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Timeline</p>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Created</p>
                  <p className="text-sm font-medium text-slate-700">{safeFormatDate(ticket.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Updated</p>
                  <p className="text-sm font-medium text-slate-700">{timeAgo(ticket.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
