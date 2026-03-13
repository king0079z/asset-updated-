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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterTickets, sortTickets } from "@/util/ticketUtils";
import { TicketStatus, TicketPriority } from "@prisma/client";
import {
  PlusCircle, AlertCircle, BarChart2, Search, ArrowUpDown, Calendar,
  Tag, LayoutList, LayoutGrid, UserPlus, CheckCircle, Loader2,
  Kanban, AlertTriangle, HelpCircle, Inbox, FileText, Package,
  Monitor, Clock, CheckCircle2, Circle, ChevronRight, ArrowUp,
  Minus, ArrowDown, User, MapPin, Phone, RefreshCw, Filter,
  Zap, Ticket, TrendingUp, Eye, X, Star, Building,
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
  user?: { id: string; email: string; name?: string } | null;
  assignedTo?: { id: string; email: string } | null;
  createdAt: string; updatedAt: string;
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
function TBadge({ tt }: { tt?: string }) {
  if (!tt) return null;
  const c = TICKET_TYPE_CFG[tt as keyof typeof TICKET_TYPE_CFG] || TICKET_TYPE_CFG.ISSUE;
  const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.color} ${c.bg} ${c.border}`}><Icon className="h-3 w-3" />{c.label}</span>;
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

/* ── Portal ticket card (management view) ── */
function PortalTicketCard({
  t, staffMembers, updatingId, onAssign, onApprove, onView,
}: {
  t: MgmtTicket; staffMembers: { id: string; email: string }[];
  updatingId: string | null; onAssign: (id: string, uid: string | null) => void;
  onApprove: (id: string) => void; onView: (t: MgmtTicket) => void;
}) {
  const tc = TICKET_TYPE_CFG[t.ticketType as keyof typeof TICKET_TYPE_CFG] || TICKET_TYPE_CFG.ISSUE;
  const TypeIcon = tc.icon;
  const isUpdating = updatingId === t.id;

  const actionsByType: Record<string, { label: string; statusTo: TicketStatus; color: string }[]> = {
    ISSUE:      [{ label: "Investigate", statusTo: TicketStatus.IN_PROGRESS, color: "bg-orange-600 hover:bg-orange-700" }, { label: "Resolve", statusTo: TicketStatus.RESOLVED, color: "bg-emerald-600 hover:bg-emerald-700" }],
    REQUEST:    [{ label: "Fulfill",     statusTo: TicketStatus.IN_PROGRESS, color: "bg-blue-600 hover:bg-blue-700" },    { label: "Complete",  statusTo: TicketStatus.RESOLVED, color: "bg-emerald-600 hover:bg-emerald-700" }],
    INQUIRY:    [{ label: "Respond",     statusTo: TicketStatus.IN_PROGRESS, color: "bg-purple-600 hover:bg-purple-700"}, { label: "Close",     statusTo: TicketStatus.CLOSED,   color: "bg-slate-600 hover:bg-slate-700" }],
    MANAGEMENT: [{ label: "Process",     statusTo: TicketStatus.IN_PROGRESS, color: "bg-slate-700 hover:bg-slate-800" },  { label: "Complete",  statusTo: TicketStatus.RESOLVED, color: "bg-emerald-600 hover:bg-emerald-700" }],
  };
  const actions = actionsByType[t.ticketType || "ISSUE"] || actionsByType.ISSUE;
  const availableActions = actions.filter(a => {
    if (t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED) return false;
    if (t.status === TicketStatus.IN_PROGRESS && a.statusTo === TicketStatus.IN_PROGRESS) return false;
    return true;
  });

  return (
    <div className="group rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 transition-all overflow-hidden">
      {/* Priority bar */}
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
                <TBadge tt={t.ticketType} />
              </div>
              <Link href={`/tickets/${t.id}`} className="font-semibold text-slate-900 hover:text-blue-600 line-clamp-1 transition-colors">{t.title}</Link>
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{t.description}</p>
            </div>
          </div>
          <PBadge p={t.priority} />
        </div>

        {/* Requester info */}
        <div className="mb-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted by</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-bold text-white">
                {(t.user?.email || t.requesterName || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{t.requesterName || t.user?.email?.split("@")[0] || "Unknown"}</p>
                <p className="text-[10px] text-slate-400">{t.user?.email || "No email"}</p>
              </div>
            </div>
            {t.location && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />{t.location}
              </div>
            )}
            {t.contactDetails && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="h-3.5 w-3.5 text-slate-400" />{t.contactDetails}
              </div>
            )}
          </div>
        </div>

        {/* Category info */}
        {(t.category || t.subcategory) && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {t.category && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t.category.replace("_", " ")}</span>}
            {t.subcategory && <span className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-600">{t.subcategory}</span>}
          </div>
        )}

        {/* Assign */}
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Assign to Staff</p>
          <div className="relative">
            <select
              value={t.assignedToId || ""}
              onChange={e => onAssign(t.id, e.target.value || null)}
              disabled={isUpdating}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors disabled:opacity-50 pr-8"
            >
              <option value="">⊘ Unassigned</option>
              {staffMembers.map(s => <option key={s.id} value={s.id}>{s.email}</option>)}
            </select>
            {isUpdating && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Link href={`/tickets/${t.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <Eye className="h-3.5 w-3.5" /> View Details
          </Link>
          {t.status === TicketStatus.OPEN && (
            <button onClick={() => onApprove(t.id)} disabled={isUpdating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Approve
            </button>
          )}
          {availableActions.map(a => (
            <button key={a.label} disabled={isUpdating}
              onClick={async () => {
                try {
                  const r = await fetch(`/api/tickets/${t.id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: a.statusTo, comment: `Status changed to ${a.statusTo.replace("_", " ")} by support team` }),
                  });
                  if (!r.ok) throw new Error();
                  toast({ title: `Ticket ${a.label.toLowerCase()}d` });
                  onApprove(t.id); // trigger refresh
                } catch { toast({ variant: "destructive", title: "Failed to update ticket" }); }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors ${a.color}`}>
              {a.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {timeAgo(t.createdAt)}
          {t.assignedTo?.email && <><span className="mx-1">·</span><User className="h-3 w-3" />{t.assignedTo.email.split("@")[0]}</>}
        </p>
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
  const [activeTab, setActiveTab] = useState<"all" | "open" | "in-progress" | "resolved" | "portal" | "critical">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "priority">("newest");
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [staffMembers, setStaffMembers] = useState<{ id: string; email: string }[]>([]);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>("");

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
    } catch (error) {
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

  // Fetch staff
  useEffect(() => {
    if (!user) return;
    fetch("/api/planner/users", { headers: { "Cache-Control": "no-cache" } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list = (data?.users ?? Array.isArray(data) ? data : [])
          .map((u: any) => ({ id: u.id || "", email: u.email || "" }))
          .filter((u: { id: string }) => u.id);
        setStaffMembers(list);
      })
      .catch(() => {});
  }, [user]);

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
      toast({ title: "Approved", description: "Ticket is now in progress." });
      fetchTickets(true);
    } catch { toast({ variant: "destructive", title: "Could not approve ticket" }); }
    finally { setUpdatingTicketId(null); }
  };

  // Stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === TicketStatus.OPEN).length,
    inProgress: tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
    resolved: tickets.filter(t => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED).length,
    critical: tickets.filter(t => t.priority === TicketPriority.CRITICAL).length,
    portal: tickets.filter(t => t.source === "PORTAL").length,
  };

  const portalTickets = tickets.filter(t => t.source === "PORTAL");

  // Filter + sort for general views
  const filteredTickets = tickets.filter(t => {
    let base: MgmtTicket[] = [...tickets];
    // status
    if (activeTab === "open") return t.status === TicketStatus.OPEN;
    if (activeTab === "in-progress") return t.status === TicketStatus.IN_PROGRESS;
    if (activeTab === "resolved") return t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED;
    if (activeTab === "critical") return t.priority === TicketPriority.CRITICAL;
    return true;
  }).filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedTypes.length > 0 && !selectedTypes.includes(t.ticketType || "ISSUE")) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  const sortedTickets = filteredTickets.sort((a, b) => {
    if (sortOrder === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortOrder === "priority") {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const filteredPortalTickets = portalTickets.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedTypes.length > 0 && !selectedTypes.includes(t.ticketType || "ISSUE")) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  const tabItems = [
    { key: "all",         label: "All Tickets",  count: stats.total },
    { key: "open",        label: "Open",          count: stats.open, dotColor: "bg-blue-500" },
    { key: "in-progress", label: "In Progress",   count: stats.inProgress, dotColor: "bg-amber-500" },
    { key: "resolved",    label: "Resolved",      count: stats.resolved, dotColor: "bg-emerald-500" },
    { key: "critical",    label: "Critical",      count: stats.critical, dotColor: "bg-red-500" },
    { key: "portal",      label: "Portal Tickets",count: stats.portal },
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
          <Button variant="outline" asChild>
            <Link href="/tickets/dashboard"><BarChart2 className="mr-2 h-4 w-4" />Analytics</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tickets/kanban"><Kanban className="mr-2 h-4 w-4" />Kanban</Link>
          </Button>
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

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search tickets by title, description…" className="pl-10 rounded-xl"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200">
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CFG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
        </select>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="priority">By Priority</option>
        </select>
        <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden">
          <button onClick={() => setViewMode("list")} className={`p-2 transition-colors ${viewMode === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}><LayoutList className="h-4 w-4" /></button>
          <button onClick={() => setViewMode("card")} className={`p-2 transition-colors ${viewMode === "card" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}><LayoutGrid className="h-4 w-4" /></button>
        </div>
        <button onClick={() => fetchTickets(false)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {tabItems.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {tab.dotColor && <span className={`h-2 w-2 rounded-full ${tab.dotColor}`} />}
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
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
            {/* Type filter */}
            <div className="flex gap-1.5">
              {["ISSUE", "REQUEST", "INQUIRY", "MANAGEMENT"].map(type => {
                const tc = TICKET_TYPE_CFG[type as keyof typeof TICKET_TYPE_CFG];
                const Icon = tc.icon;
                const active = selectedTypes.includes(type);
                return (
                  <button key={type} onClick={() => setSelectedTypes(prev => active ? prev.filter(t => t !== type) : [...prev, type])}
                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${active ? `${tc.bg} ${tc.border} ${tc.color}` : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                    <Icon className="h-3 w-3" />{tc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1,2,3].map(i => <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : filteredPortalTickets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Ticket className="h-8 w-8 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700">No portal tickets found</p>
              <p className="text-sm text-slate-400">Portal tickets raised by users will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPortalTickets.map(t => (
                <PortalTicketCard
                  key={t.id} t={t}
                  staffMembers={staffMembers}
                  updatingId={updatingTicketId}
                  onAssign={handleAssign}
                  onApprove={handleApprove}
                  onView={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OTHER TABS ── */}
      {activeTab !== "portal" && (
        isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : viewMode === "card" ? (
          <TicketCardView tickets={sortedTickets as any} isLoading={isLoading} />
        ) : (
          <TicketListView tickets={sortedTickets as any} isLoading={isLoading} />
        )
      )}

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTicketCreated={() => fetchTickets()}
      />
    </div>
  );
}
