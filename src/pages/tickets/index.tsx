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
  Star, Cpu, Package, Filter, SlidersHorizontal, ArrowUpDown, X,
  Flame, MessageSquare, Tag, Calendar, Hash, ChevronDown,
} from "lucide-react";
import TicketCardView from "@/components/TicketCardView";
import TicketListView from "@/components/TicketListView";
import { isUserSubmittedTicketSource } from "@/lib/ticketScope";

const TICKETS_KEY = "/api/tickets";
const TICKETS_TTL = 60_000;

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
interface StaffMember { id: string; email: string; name: string; role: string; activeTicketCount: number; }
interface StaffStat {
  id: string; email: string; name: string; role: string;
  stats: { total: number; open: number; inProgress: number; resolved: number; active: number; critical: number; high: number };
  avgResolutionFormatted: string; workloadScore: number;
  activeTickets: { id: string; displayId: string | null; title: string; status: string; priority: string; createdAt: string }[];
}
interface AiBulkSummary {
  summary: { total: number; slaBreached: number; unassigned: number; critical: number };
  recommendations: string[];
  slaBreachedTickets: { id: string; title: string; priority: string }[];
}

const PRIORITY_CFG = {
  CRITICAL: { label: "Critical", color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/60",    border: "border-red-200 dark:border-red-800",   dot: "bg-red-500",   icon: <Flame className="h-3 w-3" /> },
  HIGH:     { label: "High",     color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/60", border: "border-orange-200 dark:border-orange-800", dot: "bg-orange-500", icon: <ArrowUp className="h-3 w-3" /> },
  MEDIUM:   { label: "Medium",   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/60",  border: "border-amber-200 dark:border-amber-800",  dot: "bg-amber-500",  icon: <Minus className="h-3 w-3" /> },
  LOW:      { label: "Low",      color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/60", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", icon: <ArrowDown className="h-3 w-3" /> },
};
const STATUS_CFG = {
  OPEN:        { label: "Open",        color: "text-blue-700 dark:text-blue-300",    bg: "bg-blue-50 dark:bg-blue-950/60",    border: "border-blue-200 dark:border-blue-800",  dot: "bg-blue-500",    pulse: true },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-700 dark:text-amber-300",  bg: "bg-amber-50 dark:bg-amber-950/60",  border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500",   pulse: true },
  RESOLVED:    { label: "Resolved",    color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/60", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", pulse: false },
  CLOSED:      { label: "Closed",      color: "text-slate-600 dark:text-slate-400",  bg: "bg-slate-100 dark:bg-slate-800/80", border: "border-slate-200 dark:border-slate-600",  dot: "bg-slate-400",   pulse: false },
};
const TYPE_CFG = {
  ISSUE:      { label: "Issue",   icon: AlertTriangle, color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/60",    border: "border-red-200 dark:border-red-800" },
  REQUEST:    { label: "Request", icon: Inbox,         color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/60",   border: "border-blue-200 dark:border-blue-800" },
  INQUIRY:    { label: "Inquiry", icon: HelpCircle,    color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/60", border: "border-purple-200 dark:border-purple-800" },
  MANAGEMENT: { label: "Mgmt",    icon: FileText,      color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800/80", border: "border-slate-200 dark:border-slate-600" },
};

function PBadge({ p }: { p: string }) {
  const c = PRIORITY_CFG[p] || PRIORITY_CFG.MEDIUM;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${c.color} ${c.bg} ${c.border}`}>{c.icon}{c.label}</span>;
}
function SBadge({ s }: { s: string }) {
  const c = STATUS_CFG[s] || STATUS_CFG.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${c.color} ${c.bg} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`} />{c.label}
    </span>
  );
}
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Premium Ticket Row ─────────────────────────────────────────────────────
function TicketRow({ t, onAssign, staffMembers, updatingId }: { t: MgmtTicket; onAssign: (id: string, uid: string | null) => void; staffMembers: StaffMember[]; updatingId: string | null }) {
  const tc = TYPE_CFG[t.ticketType] || TYPE_CFG.ISSUE;
  const TypeIcon = tc.icon;
  const pc = PRIORITY_CFG[t.priority] || PRIORITY_CFG.MEDIUM;
  const sc = STATUS_CFG[t.status] || STATUS_CFG.OPEN;

  return (
    <div className={`group relative flex gap-0 overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5 ${
      t.priority === "CRITICAL" ? "border-red-200 dark:border-red-900 shadow-red-100/50 dark:shadow-red-950/50" :
      t.priority === "HIGH" ? "border-orange-200 dark:border-orange-900" : "border-border"
    }`}>
      {/* Priority rail */}
      <div className={`w-1 shrink-0 rounded-l-2xl ${pc.dot}`} />

      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Type icon */}
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tc.bg} ${tc.border}`}>
              <TypeIcon className={`h-4 w-4 ${tc.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="font-mono text-[10px] font-bold text-muted-foreground/70">{t.displayId || "#" + t.id.slice(0,8)}</span>
                <SBadge s={t.status} />
                <PBadge p={t.priority} />
                {t.category && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.category.replace(/_/g," ")}</span>}
              </div>
              <Link href={`/tickets/${t.id}`} className="block font-bold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1 text-sm">
                {t.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{t.description}</p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">{timeAgo(t.createdAt)}</span>
              <Link href={`/tickets/${t.id}`}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-all">
                <Eye className="h-3.5 w-3.5" /> View
              </Link>
            </div>
            {/* Assignee */}
            {t.assignedToId ? (
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[9px] font-bold text-white">
                  {(staffMembers.find(s => s.id === t.assignedToId)?.name || "?")[0]?.toUpperCase()}
                </div>
                <span className="text-[11px] text-muted-foreground">{staffMembers.find(s => s.id === t.assignedToId)?.name?.split(" ")[0] || "Assigned"}</span>
              </div>
            ) : (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">Unassigned</span>
            )}
          </div>
        </div>

        {/* Asset tag */}
        {t.asset && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 border border-border px-2 py-0.5">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">{t.asset.name}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portal Ticket Card ─────────────────────────────────────────────────────
function PortalTicketCard({ t, staffMembers, updatingId, onAssign, onApprove }: {
  t: MgmtTicket; staffMembers: StaffMember[]; updatingId: string | null;
  onAssign: (id: string, uid: string | null) => void; onApprove: (id: string) => void;
}) {
  const tc = TYPE_CFG[t.ticketType] || TYPE_CFG.ISSUE;
  const TypeIcon = tc.icon;
  const pc = PRIORITY_CFG[t.priority] || PRIORITY_CFG.MEDIUM;
  const isUpdating = updatingId === t.id;
  const [assigneeId, setAssigneeId] = useState(t.assignedToId || "");

  const handleAssign = () => {
    if (assigneeId !== (t.assignedToId || "")) onAssign(t.id, assigneeId || null);
  };

  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-xl hover:-translate-y-0.5 ${
      t.priority === "CRITICAL" ? "border-red-200 dark:border-red-900" : "border-border"
    }`}>
      {/* Top gradient strip */}
      <div className={`h-1 w-full ${pc.dot}`} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${tc.bg} ${tc.border}`}>
              <TypeIcon className={`h-4 w-4 ${tc.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold text-muted-foreground">{t.displayId || "#" + t.id.slice(0,8)}</span>
                <SBadge s={t.status} />
              </div>
              <PBadge p={t.priority} />
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.createdAt)}</span>
        </div>

        {/* Title */}
        <div>
          <Link href={`/tickets/${t.id}`} className="font-bold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2 text-sm block">
            {t.title}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
        </div>

        {/* Requester */}
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-bold text-white shrink-0">
            {(t.requesterName || t.user?.email || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{t.requesterName || t.user?.email?.split("@")[0] || "Unknown"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{t.user?.email}</p>
          </div>
          {t.location && <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0"><MapPin className="h-3 w-3" />{t.location}</div>}
        </div>

        {/* Assign */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Assign to Staff</label>
          <div className="flex gap-2">
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} disabled={isUpdating}
              className="flex-1 appearance-none rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 cursor-pointer">
              <option value="">⊘ Unassigned</option>
              {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name || s.email.split("@")[0]} ({s.activeTicketCount} active)</option>)}
            </select>
            <Button size="sm" variant="outline" className="shrink-0 rounded-xl" onClick={handleAssign} disabled={isUpdating || assigneeId === (t.assignedToId || "")}>
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Link href={`/tickets/${t.id}`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors">
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
          {t.status === TicketStatus.OPEN && (
            <button onClick={() => onApprove(t.id)} disabled={isUpdating}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <CheckCircle className="h-3.5 w-3.5" /> Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Staff Workload Tab ─────────────────────────────────────────────────────
function StaffWorkloadTab({ staffStats, loading }: { staffStats: StaffStat[]; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const maxWorkload = Math.max(...staffStats.map(s => s.workloadScore), 1);

  if (loading) return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (!staffStats.length) return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-20 text-center">
      <Users className="h-12 w-12 text-muted-foreground/30" />
      <p className="font-semibold text-muted-foreground">No staff data available</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Staff", value: staffStats.length, color: "text-foreground", bg: "bg-muted/40" },
          { label: "Active Tickets", value: staffStats.reduce((a, s) => a + s.stats.active, 0), color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" },
          { label: "Critical Open", value: staffStats.reduce((a, s) => a + s.stats.critical, 0), color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/40" },
          { label: "Resolved", value: staffStats.reduce((a, s) => a + s.stats.resolved, 0), color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border border-border ${s.bg} p-4`}>
            <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staffStats.map(s => {
          const pct = Math.round((s.workloadScore / maxWorkload) * 100);
          const wColor = pct > 75 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : pct > 25 ? "bg-blue-500" : "bg-emerald-500";
          const wText = pct > 75 ? "text-red-600 dark:text-red-400" : pct > 50 ? "text-amber-600 dark:text-amber-400" : pct > 25 ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400";
          const wLabel = pct > 75 ? "Overloaded" : pct > 50 ? "Busy" : pct > 25 ? "Active" : "Available";

          return (
            <div key={s.id} className={`rounded-2xl border bg-card transition-all hover:shadow-lg cursor-pointer ${selected === s.id ? "border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400/30" : "border-border"}`}
              onClick={() => setSelected(selected === s.id ? null : s.id)}>
              <div className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-sm font-black text-white">
                      {s.name[0].toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background ${wColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    <span className={`text-[10px] font-bold ${wText}`}>{wLabel}</span>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${wText}`}>{s.stats.active}</p>
                    <p className="text-[10px] text-muted-foreground">active</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Workload</span>
                    <span className={`text-[10px] font-bold ${wText}`}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${wColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Open", value: s.stats.open, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
                    { label: "Active", value: s.stats.inProgress, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
                    { label: "Done", value: s.stats.resolved, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
                    { label: "Critical", value: s.stats.critical, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
                  ].map(st => (
                    <div key={st.label} className={`rounded-xl ${st.bg} p-2 text-center`}>
                      <p className={`text-base font-black ${st.color}`}>{st.value}</p>
                      <p className="text-[9px] font-semibold text-muted-foreground">{st.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Avg Resolution</div>
                  <span className="text-sm font-bold">{s.avgResolutionFormatted}</span>
                </div>
              </div>

              <div className="border-t border-border px-5 py-3">
                <Link href={`/staff/${s.id}`} onClick={e => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 transition-all">
                  <Package className="h-4 w-4" /> View Assigned Assets
                </Link>
              </div>

              {selected === s.id && s.activeTickets.length > 0 && (
                <div className="border-t border-border px-5 py-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Tickets</p>
                  <div className="space-y-1.5">
                    {s.activeTickets.map(t => (
                      <Link key={t.id} href={`/tickets/${t.id}`}
                        className="flex items-center gap-2 rounded-xl bg-muted/40 border border-border px-3 py-2 hover:bg-muted transition-colors">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_CFG[t.priority]?.dot || "bg-slate-400"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold line-clamp-1">{t.title}</p>
                          <p className="text-[10px] text-muted-foreground">{t.displayId || "#" + t.id.slice(0,8)} · {timeAgo(t.createdAt)}</p>
                        </div>
                        <SBadge s={t.status} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AI Intelligence Panel ──────────────────────────────────────────────────
function AiPanel({ aiSummary, loading, onRefresh, tickets, staffMembers, onAssign }: {
  aiSummary: AiBulkSummary | null; loading: boolean; onRefresh: () => void;
  tickets: MgmtTicket[]; staffMembers: StaffMember[]; onAssign: (id: string, uid: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-950 via-purple-900 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.3),transparent_60%)]" />
        <div className="relative z-10 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                <Brain className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <p className="font-bold text-white">AI Intelligence Centre</p>
                <p className="text-xs text-violet-300">Real-time ticket analysis & recommendations</p>
              </div>
            </div>
            <button onClick={onRefresh} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-violet-300 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse" style={{ width: i === 2 ? "70%" : "100%" }} />)}
            </div>
          ) : aiSummary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Active", value: aiSummary.summary.total, color: "text-white", bg: "bg-white/10" },
                  { label: "SLA Risk", value: aiSummary.summary.slaBreached, color: "text-red-300", bg: "bg-red-500/20" },
                  { label: "Unassigned", value: aiSummary.summary.unassigned, color: "text-amber-300", bg: "bg-amber-500/20" },
                  { label: "Critical", value: aiSummary.summary.critical, color: "text-violet-300", bg: "bg-violet-500/20" },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl ${s.bg} p-2.5 text-center`}>
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] font-semibold text-white/60">{s.label}</p>
                  </div>
                ))}
              </div>

              {aiSummary.recommendations.length > 0 && (
                <div className="space-y-2">
                  {aiSummary.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl bg-white/8 border border-white/10 px-3 py-2.5">
                      <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-white/90">{r}</p>
                    </div>
                  ))}
                </div>
              )}

              {aiSummary.slaBreachedTickets.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">SLA Breach — Immediate Action Required</p>
                  <div className="space-y-1.5">
                    {aiSummary.slaBreachedTickets.map(t => (
                      <Link key={t.id} href={`/tickets/${t.id}`}
                        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 hover:bg-red-500/20 transition-colors">
                        <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span className="flex-1 text-xs font-medium text-white/90 line-clamp-1">{t.title}</span>
                        <PBadge p={t.priority} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <Brain className="h-6 w-6 text-violet-400" />
              </div>
              <p className="text-sm text-white/60">Click refresh to run AI analysis on all open tickets</p>
            </div>
          )}
        </div>
      </div>

      {/* Unassigned tickets quick-routing */}
      {!loading && tickets.filter(t => t.status === TicketStatus.OPEN && !t.assignedToId).length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5 bg-muted/30">
            <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="font-bold text-sm">Unassigned Tickets — Needs Routing</p>
            <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-bold px-2 py-0.5">
              {tickets.filter(t => t.status === TicketStatus.OPEN && !t.assignedToId).length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {tickets.filter(t => t.status === TicketStatus.OPEN && !t.assignedToId).slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_CFG[t.priority]?.dot || "bg-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold line-clamp-1">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.displayId || "#" + t.id.slice(0,8)}</p>
                </div>
                <PBadge p={t.priority} />
                <select onChange={e => onAssign(t.id, e.target.value || null)}
                  className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-w-[140px]">
                  <option value="">Assign to…</option>
                  {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.activeTicketCount})</option>)}
                </select>
                <Link href={`/tickets/${t.id}`} className="flex items-center justify-center h-8 w-8 rounded-xl border border-border hover:bg-muted transition-colors">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<"all" | "open" | "in-progress" | "resolved" | "portal" | "critical" | "staff" | "ai" | "dlm">("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "priority">("newest");
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [aiSummary, setAiSummary] = useState<AiBulkSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [dlmQueue, setDlmQueue] = useState<any[]>([]);
  const [dlmQueueLoading, setDlmQueueLoading] = useState(false);

  const normalize = (data: any[]): MgmtTicket[] => data.map(d => ({
    id: d.id || "", displayId: d.displayId || null, title: d.title || "Untitled", description: d.description || "",
    status: Object.values(TicketStatus).includes(d.status) ? d.status : TicketStatus.OPEN,
    priority: Object.values(TicketPriority).includes(d.priority) ? d.priority : TicketPriority.MEDIUM,
    assetId: d.assetId || null, source: d.source ?? null, assignedToId: d.assignedToId ?? null,
    ticketType: d.ticketType || null, category: d.category || null, subcategory: d.subcategory || null,
    location: d.location || null, contactDetails: d.contactDetails || null, requesterName: d.requesterName || null,
    asset: d.asset || null, user: d.user || null, assignedTo: d.assignedTo || null,
    createdAt: d.createdAt || new Date().toISOString(), updatedAt: d.updatedAt || new Date().toISOString(),
  }));

  const fetchTickets = useCallback(async (bg = false) => {
    if (!user) return;
    if (!bg) setIsLoading(true);
    try {
      const data = await fetchWithCache<any[]>(TICKETS_KEY, { maxAge: TICKETS_TTL });
      if (Array.isArray(data)) { const t = normalize(data); setTickets(t); setLiveCount(t.filter(x => x.status === TicketStatus.OPEN || x.status === TicketStatus.IN_PROGRESS).length); }
    } catch { if (!bg) toast({ title: "Error", description: "Could not load tickets.", variant: "destructive" }); }
    finally { if (!bg) setIsLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cached = getFromCache<any[]>(TICKETS_KEY, TICKETS_TTL);
    if (cached) { const t = normalize(cached); setTickets(t); setLiveCount(t.filter(x => x.status === TicketStatus.OPEN || x.status === TicketStatus.IN_PROGRESS).length); setIsLoading(false); setTimeout(() => fetchTickets(true), 300); }
    else fetchTickets(false);
  }, [user]);

  useEffect(() => { if (!user) return; const id = setInterval(() => fetchTickets(true), 120_000); return () => clearInterval(id); }, [user, fetchTickets]);

  const fetchStaff = useCallback(async () => {
    try {
      const r = await fetch("/api/planner/users"); if (!r.ok) return;
      const data = await r.json();
      setStaffMembers((data?.users ?? []).map((u: any) => ({ id: u.id || "", email: u.email || "", name: u.name || u.email?.split("@")[0].replace(/[._]/g," ").replace(/\b\w/g,(c:string) => c.toUpperCase()) || "", role: u.role || "STAFF", activeTicketCount: u.activeTicketCount ?? 0 })).filter((u: StaffMember) => u.id));
    } catch {}
  }, []);

  useEffect(() => { if (user) fetchStaff(); }, [user, fetchStaff]);

  const fetchStaffStats = useCallback(async () => {
    setStaffLoading(true);
    try { const r = await fetch("/api/tickets/staff-stats"); if (!r.ok) return; const d = await r.json(); setStaffStats(d.staff || []); }
    catch {} finally { setStaffLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "staff" && !staffStats.length) fetchStaffStats(); }, [activeTab]);

  const fetchAi = useCallback(async () => {
    setAiLoading(true);
    try { const r = await fetch("/api/tickets/ai-assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulk-analyze" }) }); if (!r.ok) return; setAiSummary(await r.json()); }
    catch {} finally { setAiLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "ai") fetchAi(); }, [activeTab]);

  const fetchDlmQueue = useCallback(async () => {
    setDlmQueueLoading(true);
    try {
      const r = await fetch("/api/tickets/dlm-queue");
      if (!r.ok) return;
      const d = await r.json();
      setDlmQueue(d.tickets || []);
    } catch {} finally { setDlmQueueLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "dlm") fetchDlmQueue(); }, [activeTab]);

  const handleAssign = async (ticketId: string, uid: string | null) => {
    setUpdatingId(ticketId);
    try {
      const r = await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedToId: uid || null }) });
      if (!r.ok) throw new Error();
      toast({ title: "Ticket assigned" }); fetchTickets(true); fetchStaff();
    } catch { toast({ variant: "destructive", title: "Could not assign ticket" }); }
    finally { setUpdatingId(null); }
  };

  const handleApprove = async (ticketId: string) => {
    setUpdatingId(ticketId);
    try {
      const r = await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: TicketStatus.IN_PROGRESS }) });
      if (!r.ok) throw new Error();
      toast({ title: "Ticket approved" }); fetchTickets(true);
    } catch { toast({ variant: "destructive", title: "Could not approve" }); }
    finally { setUpdatingId(null); }
  };

  const stats = {
    total: tickets.length, open: tickets.filter(t => t.status === TicketStatus.OPEN).length,
    inProgress: tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
    resolved: tickets.filter(t => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED).length,
    critical: tickets.filter(t => t.priority === TicketPriority.CRITICAL).length,
    portal: tickets.filter(t => isUserSubmittedTicketSource(t.source)).length,
  };

  const filtered = tickets.filter(t => {
    if (activeTab === "open") return t.status === TicketStatus.OPEN;
    if (activeTab === "in-progress") return t.status === TicketStatus.IN_PROGRESS;
    if (activeTab === "resolved") return t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED;
    if (activeTab === "critical") return t.priority === TicketPriority.CRITICAL;
    return true;
  }).filter(t => {
    if (search && !(t.title || "").toLowerCase().includes(search.toLowerCase()) && !(t.displayId || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  }).sort((a, b) => {
    if (sortOrder === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortOrder === "priority") return (["CRITICAL","HIGH","MEDIUM","LOW"].indexOf(a.priority)) - (["CRITICAL","HIGH","MEDIUM","LOW"].indexOf(b.priority));
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const portalFiltered = tickets.filter(t => isUserSubmittedTicketSource(t.source) && (!search || t.title.toLowerCase().includes(search.toLowerCase())) && (!priorityFilter || t.priority === priorityFilter));

  const tabs = [
    { key: "all",         label: "All",            count: stats.total,      dot: null },
    { key: "open",        label: "Open",           count: stats.open,       dot: "bg-blue-500" },
    { key: "in-progress", label: "In Progress",    count: stats.inProgress, dot: "bg-amber-500" },
    { key: "resolved",    label: "Resolved",       count: stats.resolved,   dot: "bg-emerald-500" },
    { key: "critical",    label: "Critical",       count: stats.critical,   dot: "bg-red-500", urgent: stats.critical > 0 },
    { key: "portal",      label: "User Requests",  count: stats.portal,     dot: "bg-violet-500" },
    { key: "staff",       label: "Staff",          count: null,             icon: Users },
    { key: "ai",          label: "AI Intel",       count: null,             icon: Brain },
    { key: "dlm",         label: "DLM Approvals",  count: dlmQueue.filter(t => t.dlmApprovalStatus === "PENDING_DLM").length || null, icon: Shield, urgent: dlmQueue.filter(t => t.dlmApprovalStatus === "PENDING_DLM").length > 0 },
  ];

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.4),transparent_60%)]" />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/3 -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-violet-500/10 translate-y-1/2 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-white/80 tracking-widest uppercase">{liveCount} Live</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Support & Requests</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Ticket Command Centre</h1>
            <p className="mt-1.5 text-sm text-white/60">Manage, triage and action all support tickets in real time</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/tickets/dashboard"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors">
              <BarChart2 className="h-4 w-4" /> Analytics
            </Link>
            <span className="inline-flex shrink-0"><TicketBarcodeScanner /></span>
            <PrintTicketsReportButton variant="outline" className="bg-white/10 border-white/15 text-white hover:bg-white/20" />
            <button onClick={() => setCreateDialogOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-white text-indigo-700 px-4 py-2 text-sm font-bold hover:bg-white/95 shadow-lg transition-all hover:shadow-xl">
              <PlusCircle className="h-4 w-4" /> New Ticket
            </button>
          </div>
        </div>

        {/* Live stats strip */}
        <div className="relative z-10 mt-5 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: stats.total, icon: Ticket, color: "text-white" },
            { label: "Open", value: stats.open, icon: AlertCircle, color: "text-blue-300" },
            { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-amber-300" },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "text-emerald-300" },
            { label: "Critical", value: stats.critical, icon: Zap, color: "text-red-300" },
            { label: "User Requests", value: stats.portal, icon: Users, color: "text-violet-300" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white/8 backdrop-blur border border-white/10 rounded-xl p-3 text-center">
                <Icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-white/50 font-medium">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-muted/50 to-muted/20 p-1.5 shadow-sm">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                  isActive ? "bg-background text-foreground shadow-md ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}>
                {tab.dot && <span className={`h-2 w-2 rounded-full ${isActive ? tab.dot : tab.dot} ${tab.urgent && !isActive ? "animate-pulse" : ""}`} />}
                {Icon && <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />}
                {tab.label}
                {tab.count !== undefined && tab.count !== null && tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black min-w-[1.2rem] text-center ${
                    isActive ? "bg-indigo-600 text-white" : tab.urgent ? "bg-red-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                  }`}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      {!["staff","ai","dlm"].includes(activeTab) && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by title, ticket ID…" className="pl-9 rounded-xl border-border/60 bg-muted/30 focus:bg-background h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            </div>

            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              className="h-9 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer">
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_CFG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
            </select>

            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}
              className="h-9 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">By Priority</option>
            </select>

            {activeTab !== "portal" && (
              <div className="flex rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
                <button onClick={() => setViewMode("list")} className={`p-2 transition-colors ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-muted"}`} title="List view"><LayoutList className="h-4 w-4" /></button>
                <button onClick={() => setViewMode("card")} className={`p-2 transition-colors ${viewMode === "card" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-muted"}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
              </div>
            )}

            <button onClick={() => fetchTickets(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Active filter pills */}
          {(search || priorityFilter) && (
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-xs text-muted-foreground">Filters:</span>
              {search && <span className="flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{search}<button onClick={() => setSearch("")}><X className="h-3 w-3 ml-1" /></button></span>}
              {priorityFilter && <span className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">{priorityFilter}<button onClick={() => setPriorityFilter("")}><X className="h-3 w-3 ml-1" /></button></span>}
              <button onClick={() => { setSearch(""); setPriorityFilter(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab content ── */}

      {/* PORTAL */}
      {activeTab === "portal" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold">User-submitted tickets</h2>
              <p className="text-sm text-muted-foreground">Portal, Outlook and other user-raised requests — review, approve and assign</p>
            </div>
            <span className="rounded-full bg-violet-100 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm font-bold px-3 py-1">{portalFiltered.length} tickets</span>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />)}</div>
          ) : portalFiltered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center"><Ticket className="h-8 w-8 text-muted-foreground/40" /></div>
              <p className="font-semibold text-muted-foreground">No user-submitted tickets found</p>
              <p className="text-sm text-muted-foreground/70">Tickets from the portal or Outlook add-in will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {portalFiltered.map(t => <PortalTicketCard key={t.id} t={t} staffMembers={staffMembers} updatingId={updatingId} onAssign={handleAssign} onApprove={handleApprove} />)}
            </div>
          )}
        </div>
      )}

      {/* STAFF */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold">Staff Workload Overview</h2><p className="text-sm text-muted-foreground">Monitor ticket assignments, workload balance and resolution times</p></div>
            <button onClick={fetchStaffStats} disabled={staffLoading}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50">
              {staffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </button>
          </div>
          <StaffWorkloadTab staffStats={staffStats} loading={staffLoading} />
        </div>
      )}

      {/* AI */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div><h2 className="font-bold">AI Intelligence Centre</h2><p className="text-sm text-muted-foreground">AI-powered insights, unassigned routing and priority recommendations</p></div>
          <AiPanel aiSummary={aiSummary} loading={aiLoading} onRefresh={fetchAi} tickets={tickets} staffMembers={staffMembers} onAssign={handleAssign} />
        </div>
      )}

      {/* DLM APPROVALS */}
      {activeTab === "dlm" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">DLM Approval Queue</h2>
              <p className="text-sm text-muted-foreground">IT tickets awaiting DLM approval, approved, or rejected — full audit trail</p>
            </div>
            <button onClick={fetchDlmQueue} disabled={dlmQueueLoading} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50">
              {dlmQueueLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </button>
          </div>

          {/* Status sub-filters */}
          {!dlmQueueLoading && dlmQueue.length > 0 && (() => {
            const pending = dlmQueue.filter(t => t.dlmApprovalStatus === "PENDING_DLM");
            const approved = dlmQueue.filter(t => t.dlmApprovalStatus === "DLM_APPROVED");
            const rejected = dlmQueue.filter(t => t.dlmApprovalStatus === "DLM_REJECTED");
            return (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Pending DLM Approval", value: pending.length, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-400 animate-pulse" },
                  { label: "DLM Approved", value: approved.length, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
                  { label: "DLM Rejected", value: rejected.length, color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/50", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4`}>
                    <div className="flex items-center gap-2 mb-1"><div className={`h-2 w-2 rounded-full ${s.dot}`} /><p className="text-xs font-semibold text-muted-foreground">{s.label}</p></div>
                    <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {dlmQueueLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : dlmQueue.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center"><Shield className="h-8 w-8 text-muted-foreground/40" /></div>
              <p className="font-semibold text-muted-foreground">No DLM-gated tickets found</p>
              <p className="text-sm text-muted-foreground/70">IT-category tickets requiring DLM approval will appear here</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="divide-y divide-border">
                {dlmQueue.map((t: any) => {
                  const statusCfg: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
                    PENDING_DLM:  { label: "Pending DLM", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-400 animate-pulse" },
                    DLM_APPROVED: { label: "DLM Approved", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
                    DLM_REJECTED: { label: "DLM Rejected", color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/50", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
                  };
                  const sc = statusCfg[t.dlmApprovalStatus] || statusCfg.PENDING_DLM;
                  const pc = PRIORITY_CFG[t.priority] || PRIORITY_CFG.MEDIUM;
                  const timeAgoStr = (() => { const s2 = Math.floor((Date.now() - new Date(t.createdAt).getTime())/1000); if (s2<60) return "Just now"; if (s2<3600) return `${Math.floor(s2/60)}m ago`; if (s2<86400) return `${Math.floor(s2/3600)}h ago`; return `${Math.floor(s2/86400)}d ago`; })();
                  return (
                    <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
                      <div className={`flex h-2 w-2 rounded-full shrink-0 ${sc.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground">{t.displayId || "#" + t.id.slice(0,8)}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
                          <PBadge p={t.priority} />
                          {t.category && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.category}</span>}
                        </div>
                        <p className="text-sm font-semibold truncate">{t.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                          <span>By: {t.user?.displayName || t.user?.email?.split("@")[0] || "Unknown"}</span>
                          {t.dlm && <span>DLM: {t.dlm?.displayName || t.dlm?.email?.split("@")[0]}</span>}
                          <span>{timeAgoStr}</span>
                          {t.dlmComment && <span className="italic">"{t.dlmComment}"</span>}
                        </div>
                      </div>
                      <Link href={`/tickets/${t.id}`} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-all shrink-0">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TICKET LIST / CARD */}
      {!["portal","staff","ai","dlm"].includes(activeTab) && (
        <div>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center"><Ticket className="h-8 w-8 text-muted-foreground/40" /></div>
              <p className="font-semibold text-muted-foreground">No tickets found</p>
              {search && <p className="text-sm text-muted-foreground/70">Try adjusting your search or filters</p>}
              <button onClick={() => setCreateDialogOpen(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
                <PlusCircle className="h-4 w-4" /> Create Ticket
              </button>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-2.5">
              {filtered.map(t => <TicketRow key={t.id} t={t} onAssign={handleAssign} staffMembers={staffMembers} updatingId={updatingId} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm p-4">
              <TicketCardView tickets={filtered as any} isLoading={false} />
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-3">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-bold text-foreground">{filtered.length}</span> of <span className="font-bold text-foreground">{tickets.length}</span> tickets
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Auto-refreshes every 2 minutes
              </div>
            </div>
          )}
        </div>
      )}

      <CreateTicketDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onTicketCreated={() => fetchTickets()} />
    </div>
  );
}
