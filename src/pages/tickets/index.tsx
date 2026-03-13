// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { toast } from "@/components/ui/use-toast";
import TicketBarcodeScanner from "@/components/TicketBarcodeScanner";
import { Input } from "@/components/ui/input";
import PrintTicketsReportButton from "@/components/PrintTicketsReportButton";
import { TicketStatus, TicketPriority } from "@prisma/client";
import {
  PlusCircle, BarChart2, Search, LayoutList, LayoutGrid, CheckCircle, Loader2,
  AlertTriangle, HelpCircle, Inbox, FileText, Clock, CheckCircle2, Circle,
  ChevronRight, ArrowUp, Minus, ArrowDown, User, MapPin, Phone, RefreshCw,
  Zap, Ticket, Eye, Users, TrendingUp, TrendingDown, Award, AlertCircle,
  Brain, Lightbulb, Target, Activity, BarChart3, Sparkles, Shield,
  Star, Cpu,
} from "lucide-react";
import TicketCardView from "@/components/TicketCardView";
import TicketListView from "@/components/TicketListView";

const TICKETS_KEY = "/api/tickets";
const TICKETS_TTL = 60_000;

/* ── Types ── */
interface MgmtTicket {
  id: string; displayId: string | null; title: string; description: string;
  status: TicketStatus; priority: TicketPriority;
  assetId: string | null; source?: string | null; assignedToId?: string | null;
  ticketType?: string; category?: string; subcategory?: string;
  location?: string; contactDetails?: string; requesterName?: string;
  asset: { id: string; name: string; assetId: string } | null;
  user?: { id: string; email: string } | null;
  assignedTo?: { id: string; email: string } | null;
  createdAt: string; updatedAt: string;
}

interface StaffMember {
  id: string; email: string; name: string; role: string; activeTicketCount: number;
}

interface StaffStat {
  id: string; email: string; name: string; role: string;
  stats: { total: number; open: number; inProgress: number; resolved: number; active: number; critical: number; high: number };
  avgResolutionFormatted: string; workloadScore: number;
  activeTickets: { id: string; displayId: string | null; title: string; status: string; priority: string; ticketType?: string; subcategory?: string; createdAt: string }[];
}

interface AiBulkSummary {
  summary: { total: number; slaBreached: number; unassigned: number; critical: number };
  recommendations: string[];
  slaBreachedTickets: { id: string; title: string; priority: string }[];
}

/* ── Configs ── */
const PRIORITY_CFG = {
  CRITICAL: { label: "Critical", color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500",     icon: <ArrowUp className="h-3 w-3" /> },
  HIGH:     { label: "High",     color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  dot: "bg-orange-500",  icon: <ArrowUp className="h-3 w-3" /> },
  MEDIUM:   { label: "Medium",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   icon: <Minus className="h-3 w-3" /> },
  LOW:      { label: "Low",      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", icon: <ArrowDown className="h-3 w-3" /> },
};
const STATUS_CFG = {
  OPEN:        { label: "Open",        color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500"    },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500"   },
  RESOLVED:    { label: "Resolved",    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  CLOSED:      { label: "Closed",      color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   dot: "bg-slate-400"   },
};
const TICKET_TYPE_CFG = {
  ISSUE:      { label: "Issue",     icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200" },
  REQUEST:    { label: "Request",   icon: Inbox,         color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200" },
  INQUIRY:    { label: "Inquiry",   icon: HelpCircle,    color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  MANAGEMENT: { label: "Mgmt",      icon: FileText,      color: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-200" },
};

/* ── Helpers ── */
function PBadge({ p }: { p: string }) {
  const c = PRIORITY_CFG[p] || PRIORITY_CFG.MEDIUM;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.color} ${c.bg} ${c.border}`}>{c.icon}{c.label}</span>;
}
function SBadge({ s }: { s: string }) {
  const c = STATUS_CFG[s] || STATUS_CFG.OPEN;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.color} ${c.bg} ${c.border}`}><span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}</span>;
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Staff Assignment Select ── */
function StaffSelect({ value, staffMembers, disabled, onChange }: {
  value: string; staffMembers: StaffMember[]; disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors disabled:opacity-50 pr-8 cursor-pointer"
      >
        <option value="">⊘ Unassigned</option>
        {staffMembers.map(s => (
          <option key={s.id} value={s.id}>
            {s.name || s.email.split("@")[0]} — {s.activeTicketCount} active
          </option>
        ))}
      </select>
      {disabled && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
    </div>
  );
}

/* ── Portal Ticket Card ── */
function PortalTicketCard({ t, staffMembers, updatingId, onAssign, onApprove }: {
  t: MgmtTicket; staffMembers: StaffMember[]; updatingId: string | null;
  onAssign: (id: string, uid: string | null) => void; onApprove: (id: string) => void;
}) {
  const tc = TICKET_TYPE_CFG[t.ticketType as keyof typeof TICKET_TYPE_CFG] || TICKET_TYPE_CFG.ISSUE;
  const TypeIcon = tc.icon;
  const isUpdating = updatingId === t.id;

  const actionsByType: Record<string, { label: string; statusTo: TicketStatus; color: string }[]> = {
    ISSUE:      [{ label: "Investigate", statusTo: TicketStatus.IN_PROGRESS, color: "bg-orange-600 hover:bg-orange-700" }, { label: "Resolve", statusTo: TicketStatus.RESOLVED, color: "bg-emerald-600 hover:bg-emerald-700" }],
    REQUEST:    [{ label: "Fulfill",     statusTo: TicketStatus.IN_PROGRESS, color: "bg-blue-600 hover:bg-blue-700" },    { label: "Complete", statusTo: TicketStatus.RESOLVED, color: "bg-emerald-600 hover:bg-emerald-700" }],
    INQUIRY:    [{ label: "Respond",     statusTo: TicketStatus.IN_PROGRESS, color: "bg-purple-600 hover:bg-purple-700"}, { label: "Close",    statusTo: TicketStatus.CLOSED,   color: "bg-slate-600 hover:bg-slate-700" }],
    MANAGEMENT: [{ label: "Process",     statusTo: TicketStatus.IN_PROGRESS, color: "bg-slate-700 hover:bg-slate-800" },  { label: "Complete", statusTo: TicketStatus.RESOLVED, color: "bg-emerald-600 hover:bg-emerald-700" }],
  };
  const actions = (actionsByType[t.ticketType || "ISSUE"] || actionsByType.ISSUE)
    .filter(a => t.status !== a.statusTo && t.status !== TicketStatus.CLOSED && t.status !== TicketStatus.RESOLVED);

  const assignedStaff = staffMembers.find(s => s.id === t.assignedToId);

  return (
    <div className="group rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 transition-all overflow-hidden">
      <div className={`h-1 w-full ${PRIORITY_CFG[t.priority]?.dot || "bg-slate-200"}`} />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tc.bg} ${tc.border}`}>
              <TypeIcon className={`h-5 w-5 ${tc.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="font-mono text-[11px] font-bold text-slate-400">{t.displayId || "#" + t.id.slice(0, 8)}</span>
                <SBadge s={t.status} />
              </div>
              <Link href={`/tickets/${t.id}`} className="font-semibold text-slate-900 hover:text-blue-600 line-clamp-1 transition-colors">{t.title}</Link>
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{t.description}</p>
            </div>
          </div>
          <PBadge p={t.priority} />
        </div>

        {/* Requester */}
        <div className="mb-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted by</p>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-bold text-white">
                {(t.user?.email || t.requesterName || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{t.requesterName || t.user?.email?.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Unknown"}</p>
                <p className="text-[10px] text-slate-400">{t.user?.email}</p>
              </div>
            </div>
            {t.location && <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-slate-400" />{t.location}</span>}
            {t.contactDetails && <span className="flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3.5 w-3.5 text-slate-400" />{t.contactDetails}</span>}
          </div>
        </div>

        {(t.category || t.subcategory) && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {t.category && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t.category.replace(/_/g, " ")}</span>}
            {t.subcategory && <span className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-600">{t.subcategory}</span>}
          </div>
        )}

        {/* Assign */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assign to Staff</p>
            {assignedStaff && (
              <span className="text-[10px] text-amber-600 font-semibold">{assignedStaff.activeTicketCount} active tickets</span>
            )}
          </div>
          <StaffSelect
            value={t.assignedToId || ""}
            staffMembers={staffMembers}
            disabled={isUpdating}
            onChange={v => onAssign(t.id, v || null)}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Link href={`/tickets/${t.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
          {t.status === TicketStatus.OPEN && (
            <button onClick={() => onApprove(t.id)} disabled={isUpdating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Approve
            </button>
          )}
          {actions.map(a => (
            <button key={a.label} disabled={isUpdating}
              onClick={async () => {
                try {
                  const r = await fetch(`/api/tickets/${t.id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: a.statusTo, comment: `Ticket ${a.label.toLowerCase()}d by support team` }),
                  });
                  if (!r.ok) throw new Error();
                  toast({ title: `Ticket ${a.label.toLowerCase()}d` });
                  onApprove(t.id);
                } catch { toast({ variant: "destructive", title: "Failed to update ticket" }); }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors ${a.color}`}>
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">{timeAgo(t.createdAt)}</p>
      </div>
    </div>
  );
}

/* ── Staff Workload Tab ── */
function StaffWorkloadTab({ staffStats, loading }: { staffStats: StaffStat[]; loading: boolean }) {
  const [selected, setSelected] = useState<StaffStat | null>(null);

  if (loading) {
    return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  if (staffStats.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white py-16 text-center">
        <Users className="h-12 w-12 text-slate-300" />
        <p className="font-semibold text-slate-700">No staff data available</p>
        <p className="text-sm text-slate-400">Staff members with assigned tickets will appear here</p>
      </div>
    );
  }

  const maxWorkload = Math.max(...staffStats.map(s => s.workloadScore), 1);

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Staff",    value: staffStats.length,                                                    color: "text-slate-700",   bg: "from-slate-50" },
          { label: "Active Tickets", value: staffStats.reduce((a, s) => a + s.stats.active, 0),                  color: "text-amber-700",   bg: "from-amber-50" },
          { label: "Critical Open",  value: staffStats.reduce((a, s) => a + s.stats.critical, 0),                color: "text-red-700",     bg: "from-red-50" },
          { label: "Resolved Today", value: staffStats.reduce((a, s) => a + s.stats.resolved, 0),               color: "text-emerald-700", bg: "from-emerald-50" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.bg} to-white border border-slate-100 p-4`}>
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Staff cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staffStats.map(s => {
          const workloadPct = maxWorkload > 0 ? Math.round((s.workloadScore / maxWorkload) * 100) : 0;
          const workloadColor = workloadPct > 75 ? "bg-red-500" : workloadPct > 50 ? "bg-amber-500" : workloadPct > 25 ? "bg-blue-500" : "bg-emerald-500";
          const workloadText = workloadPct > 75 ? "text-red-600" : workloadPct > 50 ? "text-amber-600" : workloadPct > 25 ? "text-blue-600" : "text-emerald-600";
          const workloadLabel = workloadPct > 75 ? "Overloaded" : workloadPct > 50 ? "Busy" : workloadPct > 25 ? "Active" : "Available";

          return (
            <button key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)}
              className={`rounded-2xl border text-left transition-all hover:shadow-md ${selected?.id === s.id ? "border-slate-400 shadow-md" : "border-slate-100 bg-white shadow-sm hover:border-slate-200"}`}>
              <div className="p-5">
                {/* Staff header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="relative shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-black text-white shadow">
                      {s.name[0].toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${workloadColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 line-clamp-1">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                    <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${workloadText} bg-current/10`} style={{ backgroundColor: "transparent" }}>
                      <span className={workloadText}>{workloadLabel}</span>
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-2xl font-black ${workloadText}`}>{s.stats.active}</p>
                    <p className="text-[10px] text-slate-400">active</p>
                  </div>
                </div>

                {/* Workload bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workload</span>
                    <span className={`text-[10px] font-bold ${workloadText}`}>{workloadPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${workloadColor}`} style={{ width: `${workloadPct}%` }} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  {[
                    { label: "Open",      value: s.stats.open,       color: "text-blue-600",    bg: "bg-blue-50" },
                    { label: "Active",    value: s.stats.inProgress,  color: "text-amber-600",   bg: "bg-amber-50" },
                    { label: "Done",      value: s.stats.resolved,   color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Critical",  value: s.stats.critical,   color: "text-red-600",     bg: "bg-red-50" },
                  ].map(st => (
                    <div key={st.label} className={`rounded-xl ${st.bg} p-2 text-center`}>
                      <p className={`text-base font-black ${st.color}`}>{st.value}</p>
                      <p className="text-[9px] font-semibold text-slate-500">{st.label}</p>
                    </div>
                  ))}
                </div>

                {/* Avg resolution */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">Avg Resolution</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{s.avgResolutionFormatted}</span>
                </div>
              </div>

              {/* Expanded active tickets */}
              {selected?.id === s.id && s.activeTickets.length > 0 && (
                <div className="border-t border-slate-100 px-5 pb-4 pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Tickets</p>
                  <div className="space-y-2">
                    {s.activeTickets.map(t => (
                      <Link key={t.id} href={`/tickets/${t.id}`}
                        className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 hover:bg-slate-100 transition-colors">
                        <div className={`h-2 w-2 rounded-full ${PRIORITY_CFG[t.priority]?.dot || "bg-slate-400"} shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700 line-clamp-1">{t.title}</p>
                          <p className="text-[10px] text-slate-400">{t.displayId || "#" + t.id.slice(0, 8)} · {timeAgo(t.createdAt)}</p>
                        </div>
                        <SBadge s={t.status} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── AI Intelligence Panel ── */
function AiIntelligencePanel({ aiSummary, loadingAi, onRefresh }: {
  aiSummary: AiBulkSummary | null; loadingAi: boolean; onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-900 to-slate-900 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
            <Brain className="h-4 w-4 text-violet-300" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">AI Intelligence Centre</p>
            <p className="text-[10px] text-violet-300">Real-time ticket analysis & insights</p>
          </div>
        </div>
        <button onClick={onRefresh} disabled={loadingAi}
          className="rounded-lg p-1.5 text-violet-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50">
          {loadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      <div className="p-5">
        {loadingAi ? (
          <div className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 animate-pulse">
              <Cpu className="h-5 w-5 text-violet-400" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="h-3 rounded-full bg-violet-100 animate-pulse" />
              <div className="h-3 w-3/4 rounded-full bg-violet-100 animate-pulse" />
            </div>
          </div>
        ) : aiSummary ? (
          <div className="space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Active",     value: aiSummary.summary.total,       icon: Activity,     color: "text-slate-700",   bg: "bg-slate-100" },
                { label: "SLA Risk",   value: aiSummary.summary.slaBreached, icon: AlertCircle,  color: "text-red-600",     bg: "bg-red-50" },
                { label: "Unassigned", value: aiSummary.summary.unassigned,  icon: User,         color: "text-amber-600",   bg: "bg-amber-50" },
                { label: "Critical",   value: aiSummary.summary.critical,    icon: Zap,          color: "text-violet-700",  bg: "bg-violet-50" },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className={`rounded-xl ${s.bg} p-3 text-center`}>
                    <Icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Recommendations */}
            {aiSummary.recommendations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-600">AI Recommendations</p>
                {aiSummary.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl bg-white border border-violet-100 px-3 py-2.5">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                    <p className="text-sm text-slate-700">{r}</p>
                  </div>
                ))}
              </div>
            )}

            {/* SLA breached tickets */}
            {aiSummary.slaBreachedTickets.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-500">SLA Breached — Immediate Action</p>
                <div className="space-y-1.5">
                  {aiSummary.slaBreachedTickets.map(t => (
                    <Link key={t.id} href={`/tickets/${t.id}`}
                      className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/50 px-3 py-2 hover:bg-red-50 transition-colors">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="flex-1 text-sm font-medium text-slate-700 line-clamp-1">{t.title}</span>
                      <PBadge p={t.priority} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Brain className="h-8 w-8 text-violet-200" />
            <p className="text-sm text-slate-500">Click refresh to run AI analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function TicketsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TicketsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function TicketsContent() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<MgmtTicket[]>(() => getFromCache<MgmtTicket[]>(TICKETS_KEY, TICKETS_TTL) ?? []);
  const [isLoading, setIsLoading] = useState(() => !getFromCache(TICKETS_KEY, TICKETS_TTL));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "open" | "in-progress" | "resolved" | "portal" | "critical" | "staff" | "ai">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "priority">("newest");
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [staffStatsLoading, setStaffStatsLoading] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [aiSummary, setAiSummary] = useState<AiBulkSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const normalizeTickets = (data: any[]): MgmtTicket[] =>
    data.map(ticket => ({
      id: ticket.id || "",
      displayId: ticket.displayId || null,
      title: ticket.title || "Untitled",
      description: ticket.description || "",
      status: Object.values(TicketStatus).includes(ticket.status) ? ticket.status : TicketStatus.OPEN,
      priority: Object.values(TicketPriority).includes(ticket.priority) ? ticket.priority : TicketPriority.MEDIUM,
      assetId: ticket.assetId || null,
      source: ticket.source ?? null,
      assignedToId: ticket.assignedToId ?? null,
      ticketType: ticket.ticketType || null,
      category: ticket.category || null,
      subcategory: ticket.subcategory || null,
      location: ticket.location || null,
      contactDetails: ticket.contactDetails || null,
      requesterName: ticket.requesterName || null,
      asset: ticket.asset || null,
      user: ticket.user || null,
      assignedTo: ticket.assignedTo || null,
      createdAt: ticket.createdAt || new Date().toISOString(),
      updatedAt: ticket.updatedAt || new Date().toISOString(),
    }));

  const fetchTickets = useCallback(async (background = false) => {
    if (!user) return;
    if (!background) setIsLoading(true);
    try {
      const data = await fetchWithCache<any[]>(TICKETS_KEY, { maxAge: TICKETS_TTL });
      if (Array.isArray(data)) setTickets(normalizeTickets(data));
    } catch {
      if (!background) {
        toast({ title: "Error", description: "Could not load tickets.", variant: "destructive" });
        setTickets([]);
      }
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cached = getFromCache<any[]>(TICKETS_KEY, TICKETS_TTL);
    if (cached) {
      setTickets(normalizeTickets(cached));
      setIsLoading(false);
      setTimeout(() => fetchTickets(true), 300);
    } else {
      fetchTickets(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => fetchTickets(true), 120_000);
    return () => clearInterval(id);
  }, [user, fetchTickets]);

  // Fetch staff members with ticket counts
  const fetchStaffMembers = useCallback(async () => {
    try {
      const r = await fetch("/api/planner/users");
      if (!r.ok) return;
      const data = await r.json();
      const list = (data?.users ?? []).map((u: any) => ({
        id: u.id || "",
        email: u.email || "",
        name: u.name || u.email?.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "",
        role: u.role || "STAFF",
        activeTicketCount: u.activeTicketCount ?? 0,
      })).filter((u: StaffMember) => u.id);
      setStaffMembers(list);
    } catch {}
  }, []);

  useEffect(() => { if (user) fetchStaffMembers(); }, [user, fetchStaffMembers]);

  // Fetch staff stats when staff tab is active
  const fetchStaffStats = useCallback(async () => {
    setStaffStatsLoading(true);
    try {
      const r = await fetch("/api/tickets/staff-stats");
      if (!r.ok) return;
      const data = await r.json();
      setStaffStats(data.staff || []);
    } catch {} finally { setStaffStatsLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "staff" && staffStats.length === 0) fetchStaffStats(); }, [activeTab]);

  // Fetch AI analysis
  const fetchAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    try {
      const r = await fetch("/api/tickets/ai-assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk-analyze" }),
      });
      if (!r.ok) return;
      const data = await r.json();
      setAiSummary(data);
    } catch {} finally { setAiLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "ai") fetchAiAnalysis(); }, [activeTab]);

  const handleAssign = async (ticketId: string, assignedToId: string | null) => {
    setUpdatingTicketId(ticketId);
    try {
      const r = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assignedToId || null }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Assigned", description: "Ticket assigned successfully." });
      fetchTickets(true);
      fetchStaffMembers(); // Refresh counts
    } catch { toast({ variant: "destructive", title: "Could not assign ticket" }); }
    finally { setUpdatingTicketId(null); }
  };

  const handleApprove = async (ticketId: string) => {
    setUpdatingTicketId(ticketId);
    try {
      const r = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: TicketStatus.IN_PROGRESS }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Approved" });
      fetchTickets(true);
    } catch { toast({ variant: "destructive", title: "Could not approve ticket" }); }
    finally { setUpdatingTicketId(null); }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === TicketStatus.OPEN).length,
    inProgress: tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
    resolved: tickets.filter(t => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED).length,
    critical: tickets.filter(t => t.priority === TicketPriority.CRITICAL).length,
    portal: tickets.filter(t => t.source === "PORTAL").length,
  };

  const portalTickets = tickets.filter(t => t.source === "PORTAL");

  const filteredTickets = tickets.filter(t => {
    if (activeTab === "open") return t.status === TicketStatus.OPEN;
    if (activeTab === "in-progress") return t.status === TicketStatus.IN_PROGRESS;
    if (activeTab === "resolved") return t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED;
    if (activeTab === "critical") return t.priority === TicketPriority.CRITICAL;
    return true;
  }).filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  }).sort((a, b) => {
    if (sortOrder === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortOrder === "priority") {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const filteredPortalTickets = portalTickets.filter(t =>
    (!searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!priorityFilter || t.priority === priorityFilter)
  );

  const tabItems = [
    { key: "all",         label: "All",          count: stats.total },
    { key: "open",        label: "Open",         count: stats.open,       dot: "bg-blue-500" },
    { key: "in-progress", label: "In Progress",  count: stats.inProgress, dot: "bg-amber-500" },
    { key: "resolved",    label: "Resolved",     count: stats.resolved,   dot: "bg-emerald-500" },
    { key: "critical",    label: "Critical",     count: stats.critical,   dot: "bg-red-500" },
    { key: "portal",      label: "Portal",       count: stats.portal },
    { key: "staff",       label: "Staff",        icon: Users },
    { key: "ai",          label: "AI Intel",     icon: Brain },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Ticket Management</h1>
          <p className="mt-1 text-slate-500">Manage, assign and action all support tickets</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild><Link href="/tickets/dashboard"><BarChart2 className="mr-2 h-4 w-4" />Analytics</Link></Button>
          <TicketBarcodeScanner />
          <PrintTicketsReportButton variant="outline" />
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" /> New Ticket
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total",       value: stats.total,      from: "from-slate-50",   text: "text-slate-700" },
          { label: "Open",        value: stats.open,       from: "from-blue-50",    text: "text-blue-700" },
          { label: "In Progress", value: stats.inProgress, from: "from-amber-50",   text: "text-amber-700" },
          { label: "Resolved",    value: stats.resolved,   from: "from-emerald-50", text: "text-emerald-700" },
          { label: "Critical",    value: stats.critical,   from: "from-red-50",     text: "text-red-700" },
          { label: "Portal",      value: stats.portal,     from: "from-violet-50",  text: "text-violet-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.from} to-white border border-slate-100 p-4`}>
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-black ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {!["staff", "ai"].includes(activeTab) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search tickets…" className="pl-10 rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none">
            <option value="">All Priorities</option>
            {Object.entries(PRIORITY_CFG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priority">By Priority</option>
          </select>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            <button onClick={() => setViewMode("list")} className={`p-2 transition-colors ${viewMode === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode("card")} className={`p-2 transition-colors ${viewMode === "card" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={() => fetchTickets(false)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {tabItems.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {tab.dot && <span className={`h-2 w-2 rounded-full ${tab.dot}`} />}
                {Icon && <Icon className="h-4 w-4" />}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PORTAL TAB ── */}
      {activeTab === "portal" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">User Portal Tickets</h2>
              <p className="text-sm text-slate-500">Review, approve and assign tickets submitted by users</p>
            </div>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1,2,3].map(i => <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : filteredPortalTickets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white py-16 text-center">
              <Ticket className="h-12 w-12 text-slate-300" />
              <p className="font-semibold text-slate-700">No portal tickets found</p>
              <p className="text-sm text-slate-400">Portal tickets raised by users will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPortalTickets.map(t => (
                <PortalTicketCard key={t.id} t={t} staffMembers={staffMembers} updatingId={updatingTicketId} onAssign={handleAssign} onApprove={handleApprove} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STAFF TAB ── */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Staff Workload Overview</h2>
              <p className="text-sm text-slate-500">Monitor ticket assignments, workload balance and resolution times</p>
            </div>
            <button onClick={fetchStaffStats} disabled={staffStatsLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {staffStatsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
          <StaffWorkloadTab staffStats={staffStats} loading={staffStatsLoading} />
        </div>
      )}

      {/* ── AI TAB ── */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">AI Intelligence Centre</h2>
            <p className="text-sm text-slate-500">AI-powered insights, SLA monitoring, and workload recommendations</p>
          </div>
          <AiIntelligencePanel aiSummary={aiSummary} loadingAi={aiLoading} onRefresh={fetchAiAnalysis} />

          {/* Per-ticket AI insights preview */}
          {!aiLoading && tickets.filter(t => t.status === TicketStatus.OPEN && !t.assignedToId).length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-violet-600" />
                <p className="font-bold text-slate-900">Unassigned Open Tickets — Needs Immediate Routing</p>
              </div>
              <div className="space-y-2">
                {tickets.filter(t => t.status === TicketStatus.OPEN && !t.assignedToId).slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_CFG[t.priority]?.dot || "bg-slate-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 line-clamp-1">{t.title}</p>
                      <p className="text-xs text-slate-400">{t.displayId || "#" + t.id.slice(0, 8)} · {t.subcategory || t.category || "General"}</p>
                    </div>
                    <PBadge p={t.priority} />
                    <div className="shrink-0 min-w-[160px]">
                      <StaffSelect value="" staffMembers={staffMembers} onChange={v => handleAssign(t.id, v || null)} />
                    </div>
                    <Link href={`/tickets/${t.id}`} className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OTHER TABS ── */}
      {!["portal", "staff", "ai"].includes(activeTab) && (
        isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
        ) : viewMode === "card" ? (
          <TicketCardView tickets={filteredTickets as any} isLoading={isLoading} />
        ) : (
          <TicketListView tickets={filteredTickets as any} isLoading={isLoading} />
        )
      )}

      <CreateTicketDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onTicketCreated={() => fetchTickets()} />
    </div>
  );
}
