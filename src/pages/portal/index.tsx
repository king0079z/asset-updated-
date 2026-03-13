// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  PlusCircle, Bell, LogOut, Loader2, MessageSquare, Clock,
  CheckCircle2, AlertCircle, ChevronRight, LayoutDashboard,
  UserCheck, Inbox, Search, X, Send, Activity,
  ArrowUp, Minus, ArrowDown, RefreshCw, TicketX, Circle,
  SlidersHorizontal,
} from "lucide-react";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { createClient as createSSRClient } from "@/util/supabase/server-props";
import { getUserRoleData } from "@/util/roleCheck";
import prisma from "@/lib/prisma";
import type { GetServerSideProps } from "next";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Ticket {
  id: string; displayId: string | null; title: string; description: string;
  status: string; priority: string;
  userId?: string; assignedToId?: string | null;
  createdAt: string; updatedAt: string; source?: string | null;
}
interface HistoryEntry {
  id: string; status: string | null; priority: string | null;
  comment: string; createdAt: string;
  user: { id: string; email: string };
}
interface NotificationRow {
  id: string; ticketId: string | null; type: string;
  title: string; message: string; readAt: string | null; createdAt: string;
}
interface PortalProps {
  initialTickets: Ticket[];
  initialNotifications: NotificationRow[];
  hasDashboardAccess: boolean;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const PRIORITY_CONFIG: Record<string, any> = {
  CRITICAL: { label: "Critical", color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     icon: <ArrowUp className="h-3 w-3" /> },
  HIGH:     { label: "High",     color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  icon: <ArrowUp className="h-3 w-3" /> },
  MEDIUM:   { label: "Medium",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   icon: <Minus className="h-3 w-3" /> },
  LOW:      { label: "Low",      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: <ArrowDown className="h-3 w-3" /> },
};
const STATUS_CONFIG: Record<string, any> = {
  OPEN:        { label: "Open",        color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500"    },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500"   },
  RESOLVED:    { label: "Resolved",    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  CLOSED:      { label: "Closed",      color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   dot: "bg-slate-400"   },
};

/* ── Small helpers ──────────────────────────────────────────────────────── */
function PBadge({ p }: { p: string }) {
  const c = PRIORITY_CONFIG[p] || PRIORITY_CONFIG.MEDIUM;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.color} ${c.bg} ${c.border}`}>
      {c.icon}{c.label}
    </span>
  );
}
function SBadge({ s }: { s: string }) {
  const c = STATUS_CONFIG[s] || STATUS_CONFIG.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.color} ${c.bg} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
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

/* ── Ticket drawer ──────────────────────────────────────────────────────── */
function TicketDrawer({ ticket, onClose, onRefresh }: {
  ticket: Ticket; onClose: () => void; onRefresh: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/history`);
      if (res.ok) setHistory(await res.json() || []);
    } finally { setHistoryLoading(false); }
  }, [ticket.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      if (!res.ok) throw new Error();
      setComment("");
      await loadHistory();
      onRefresh();
      toast({ title: "Comment added" });
    } catch {
      toast({ variant: "destructive", title: "Failed to post comment" });
    } finally { setPosting(false); }
  };

  const steps = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const stepIdx = steps.indexOf(ticket.status);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" style={{ animation: "slideIn .22s cubic-bezier(.22,1,.36,1)" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-400">{ticket.displayId || ticket.id.slice(0, 8)}</span>
            <SBadge s={ticket.status} />
            <PBadge p={ticket.priority} />
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">{ticket.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{ticket.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
              <span>Created {timeAgo(ticket.createdAt)}</span>
              <span>Updated {timeAgo(ticket.updatedAt)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Progress</p>
            <div className="flex items-center gap-1">
              {steps.map((step, i) => {
                const sc = STATUS_CONFIG[step];
                const done = i <= stepIdx;
                return (
                  <div key={step} className="flex flex-1 flex-col items-center gap-1">
                    <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${done ? sc.dot : "bg-slate-200"}`} />
                    <span className={`text-[10px] font-medium ${done ? sc.color : "text-slate-400"}`}>{sc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity timeline */}
          <div className="px-5 py-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Activity</p>
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : history.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No activity yet.</p>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute bottom-2 left-4 top-2 w-px bg-slate-100" aria-hidden />
                {[...history].reverse().map(h => (
                  <div key={h.id} className="relative flex gap-3 pb-5">
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white">
                      <Activity className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{h.user.email}</span>
                        <span>·</span><span>{timeAgo(h.createdAt)}</span>
                        {h.status && <><span>·</span><SBadge s={h.status} /></>}
                        {h.priority && <><span>·</span><PBadge p={h.priority} /></>}
                      </div>
                      <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">{h.comment}</p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>

        {/* Comment box */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          <form onSubmit={postComment} className="flex flex-col gap-2">
            <Textarea
              placeholder="Add a comment or update…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border-slate-200 bg-white text-sm"
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(e as any); }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Ctrl+Enter to submit</span>
              <Button size="sm" disabled={posting || !comment.trim()} className="rounded-lg bg-slate-900 hover:bg-slate-800">
                {posting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Post
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Ticket card ────────────────────────────────────────────────────────── */
function TicketCard({ t, onClick, assigned }: { t: Ticket; onClick: () => void; assigned?: boolean }) {
  const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.OPEN;
  return (
    <li>
      <button type="button" onClick={onClick}
        className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400/30 ${
          assigned ? "border-violet-200/80 bg-gradient-to-r from-violet-50/80 to-white hover:border-violet-300"
                   : "border-slate-200/70 bg-white hover:border-slate-300"
        }`}>
        <div className={`absolute bottom-0 left-0 top-0 w-1 rounded-l-xl ${sc.dot}`} />
        <div className="flex items-center gap-4 p-4 pl-5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sc.bg} border ${sc.border}`}>
            {(t.status === "RESOLVED" || t.status === "CLOSED")
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              : t.status === "IN_PROGRESS"
              ? <Clock className="h-5 w-5 text-amber-600" />
              : <Circle className="h-5 w-5 text-blue-500" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] font-semibold text-slate-400">{t.displayId || t.id.slice(0, 8)}</span>
              <PBadge p={t.priority} /><SBadge s={t.status} />
            </div>
            <h3 className="font-medium leading-snug text-slate-900 line-clamp-1">{t.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{t.description}</p>
            <p className="mt-1 text-[11px] text-slate-400">{timeAgo(t.updatedAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {assigned && <span className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">Action →</span>}
            <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
          </div>
        </div>
      </button>
    </li>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
function PortalContent({ initialTickets, initialNotifications, hasDashboardAccess }: PortalProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Data state — seeded from SSR props, no loading needed
  const [tickets, setTickets]             = useState<Ticket[]>(initialTickets);
  const [notifications, setNotifications] = useState<NotificationRow[]>(initialNotifications);
  const [refreshing, setRefreshing]       = useState(false);

  // UI state
  const [createOpen, setCreateOpen]       = useState(false);
  const [createTitle, setCreateTitle]     = useState("");
  const [createDesc, setCreateDesc]       = useState("");
  const [createPriority, setCreatePriority] = useState<string>(TicketPriority.MEDIUM);
  const [submitting, setSubmitting]       = useState(false);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [activeView, setActiveView]       = useState<"assigned" | "mine" | "all">("assigned");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterOpen, setFilterOpen]       = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && (e.target as any)?.tagName !== "INPUT" && (e.target as any)?.tagName !== "TEXTAREA") { e.preventDefault(); setCreateOpen(true); }
      if (e.key === "Escape") { setSelectedTicket(null); setNotifOpen(false); setFilterOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Background refresh — no full-page loading spinner */
  const doRefresh = useCallback(async (bustCache = false) => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/portal/data", bustCache ? { headers: { "Cache-Control": "no-cache" } } : {});
      if (!res.ok) return;
      const { tickets: tkts, notifications: notifs } = await res.json();
      setTickets(tkts || []);
      setNotifications(notifs || []);
      if (selectedTicket) {
        const upd = (tkts || []).find((t: Ticket) => t.id === selectedTicket.id);
        if (upd) setSelectedTicket(upd);
      }
    } catch {} finally { setRefreshing(false); }
  }, [selectedTicket]);

  /* Notifications */
  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch {}
  };

  /* Create ticket */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || createDesc.trim().length < 10) {
      toast({ variant: "destructive", title: "Please fill in all fields", description: "Description must be at least 10 characters." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createTitle.trim(), description: createDesc.trim(), priority: createPriority, source: "PORTAL" }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error || "Failed"); }
      toast({ title: "✓ Ticket created", description: "Our team will review it shortly." });
      setCreateOpen(false); setCreateTitle(""); setCreateDesc(""); setCreatePriority(TicketPriority.MEDIUM);
      doRefresh(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Could not create ticket" });
    } finally { setSubmitting(false); }
  };

  /* Filtering */
  const unreadCount = notifications.filter(n => !n.readAt).length;
  const assignedToMe = tickets.filter(t => t.assignedToId === user?.id);
  const myTickets    = tickets.filter(t => t.userId === user?.id);
  const baseList     = activeView === "assigned" ? assignedToMe : activeView === "mine" ? myTickets : tickets;
  const filtered     = baseList.filter(t => {
    const q = search.toLowerCase();
    return (!q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || (t.displayId || "").toLowerCase().includes(q))
      && (statusFilter === "ALL" || t.status === statusFilter)
      && (priorityFilter === "ALL" || t.priority === priorityFilter);
  });

  const stats = {
    open:       myTickets.filter(t => t.status === "OPEN").length,
    inProgress: myTickets.filter(t => t.status === "IN_PROGRESS").length,
    resolved:   myTickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length,
    assigned:   assignedToMe.length,
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] antialiased">
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <Toaster />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/98 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <TicketX className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">Support Portal</span>
          </div>

          <div className="relative hidden max-w-xs flex-1 sm:flex lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} type="text" placeholder="Search tickets… (⌘K)" value={search} onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400/30" />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {hasDashboardAccess && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600 hover:bg-slate-100" onClick={() => router.push("/dashboard")}>
                <LayoutDashboard className="h-4 w-4" /><span className="hidden md:inline">Dashboard</span>
              </Button>
            )}
            {/* Bell */}
            <div className="relative">
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg" onClick={() => setNotifOpen(o => !o)}>
                <Bell className="h-4 w-4 text-slate-600" />
                {unreadCount > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
              </Button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" aria-hidden onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div><h3 className="text-sm font-semibold text-slate-800">Notifications</h3><p className="text-xs text-slate-500">{unreadCount} unread</p></div>
                      <button onClick={() => setNotifOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8"><Bell className="h-8 w-8 text-slate-200" /><p className="mt-2 text-sm text-slate-500">No notifications</p></div>
                      ) : notifications.map(n => (
                        <button key={n.id} type="button" onClick={() => { markRead(n.id); if (n.ticketId) { const t = tickets.find(tk => tk.id === n.ticketId); if (t) setSelectedTicket(t); } setNotifOpen(false); }}
                          className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50">
                          <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-slate-300" : "bg-violet-500"}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${n.readAt ? "text-slate-500" : "text-slate-900"}`}>{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.createdAt)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-slate-500 hover:bg-slate-100" onClick={() => signOut().then(() => router.push("/login"))}>
              <LogOut className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">My Tickets</h1>
            <p className="mt-0.5 text-sm text-slate-500">Track, comment and manage your support requests</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => doRefresh(true)} disabled={refreshing} className="gap-1.5 rounded-lg">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" className="rounded-lg bg-slate-900 px-4 hover:bg-slate-800" onClick={() => setCreateOpen(true)}>
              <PlusCircle className="mr-1.5 h-4 w-4" />New ticket
              <kbd className="ml-2 hidden rounded bg-white/20 px-1 py-0.5 font-mono text-[10px] sm:inline">N</kbd>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Assigned to me", value: stats.assigned,   dot: "bg-violet-500", click: () => setActiveView("assigned") },
            { label: "Open",           value: stats.open,       dot: "bg-blue-500",   click: () => { setActiveView("mine"); setStatusFilter("OPEN"); } },
            { label: "In Progress",    value: stats.inProgress, dot: "bg-amber-500",  click: () => { setActiveView("mine"); setStatusFilter("IN_PROGRESS"); } },
            { label: "Resolved",       value: stats.resolved,   dot: "bg-emerald-500",click: () => { setActiveView("mine"); setStatusFilter("RESOLVED"); } },
          ].map(s => (
            <button key={s.label} onClick={s.click} className="flex flex-col gap-1 rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-none">
              <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} /><span className="text-xs font-medium text-slate-500">{s.label}</span></div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{s.value}</span>
            </button>
          ))}
        </div>

        {/* Tabs + filters */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {[
              { key: "assigned", label: "Assigned to me", count: assignedToMe.length },
              { key: "mine",     label: "My tickets",     count: myTickets.length },
              { key: "all",      label: "All",            count: tickets.length },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveView(tab.key as any)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  activeView === tab.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}>
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${activeView === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative sm:hidden">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                className="h-8 w-36 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-xs focus:border-slate-400 focus:outline-none" />
            </div>
            <div className="relative">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={() => setFilterOpen(o => !o)}>
                <SlidersHorizontal className="h-3.5 w-3.5" />Filter
                {(statusFilter !== "ALL" || priorityFilter !== "ALL") && <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">!</span>}
              </Button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-30" aria-hidden onClick={() => setFilterOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700">Filters</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All statuses</SelectItem>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                          <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All priorities</SelectItem>
                            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="outline" className="w-full rounded-lg text-xs" onClick={() => { setStatusFilter("ALL"); setPriorityFilter("ALL"); }}>Clear filters</Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ticket list — no loading spinner, data is SSR */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
            <Inbox className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-700">
              {search || statusFilter !== "ALL" || priorityFilter !== "ALL" ? "No matching tickets" : "No tickets yet"}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              {search ? `No tickets match "${search}".` : "Create your first ticket to get started."}
            </p>
            {!search && (
              <Button className="mt-4 rounded-lg bg-slate-900 hover:bg-slate-800" onClick={() => setCreateOpen(true)}>
                <PlusCircle className="mr-1.5 h-4 w-4" />Create ticket
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(t => (
              <TicketCard key={t.id} t={t} onClick={() => setSelectedTicket(t)} assigned={t.assignedToId === user?.id} />
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono">N</kbd> new ticket ·{" "}
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono">⌘K</kbd> search ·{" "}
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono">Esc</kbd> close
        </p>
      </div>

      {/* Drawer */}
      {selectedTicket && (
        <TicketDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onRefresh={() => doRefresh(true)} />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl border-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Create a new ticket</DialogTitle>
            <p className="text-sm text-slate-500">Our support team will review and respond shortly.</p>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="pt" className="text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></Label>
                <Input id="pt" placeholder="Brief summary of the issue" value={createTitle} onChange={e => setCreateTitle(e.target.value)} className="mt-1.5 rounded-lg border-slate-200" autoFocus />
              </div>
              <div>
                <Label htmlFor="pd" className="text-sm font-medium text-slate-700">Description <span className="text-red-500">*</span></Label>
                <Textarea id="pd" placeholder="Describe your issue in detail…" value={createDesc} onChange={e => setCreateDesc(e.target.value)} rows={5} className="mt-1.5 resize-none rounded-lg border-slate-200" />
                <p className="mt-1 text-xs text-slate-400">{createDesc.length} chars (min 10)</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Priority</Label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {(Object.entries(PRIORITY_CONFIG) as [string, any][]).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setCreatePriority(k)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${
                        createPriority === k ? `${v.bg} ${v.border} ${v.color} shadow-sm` : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}>
                      <span className={createPriority === k ? v.color : "text-slate-400"}>{v.icon}</span>
                      <span className="text-[11px] font-medium">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">Cancel</Button>
              <Button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 hover:bg-slate-800">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : <><Send className="mr-2 h-4 w-4" />Submit ticket</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── getServerSideProps — runs on the server, zero client loading ────────── */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  try {
    // Auth via cookie — no network call to Supabase, reads from request headers
    const supabase = createSSRClient(ctx);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { redirect: { destination: "/login", permanent: false } };
    }
    const userId = session.user.id;

    // Role + tickets + notifications all in parallel — one DB round-trip each
    const [roleData, rawTickets, rawNotifications] = await Promise.all([
      getUserRoleData(userId),
      (async () => {
        const isAdminOrManager = await (async () => {
          const rd = await getUserRoleData(userId);
          return rd?.role === "ADMIN" || rd?.role === "MANAGER";
        })();
        // getUserRoleData is cached so calling twice is free
        const rd2 = await getUserRoleData(userId);
        const orgId = rd2?.organizationId ?? null;
        const where = isAdminOrManager && orgId
          ? { organizationId: orgId }
          : isAdminOrManager
          ? { OR: [{ organizationId: null }, { userId }] }
          : { OR: [{ userId }, { assignedToId: userId }] };

        return prisma.ticket.findMany({
          where,
          select: { id: true, displayId: true, title: true, description: true, status: true, priority: true, userId: true, assignedToId: true, source: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
      })(),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const hasDashboardAccess = !!(
      roleData?.isAdmin ||
      roleData?.role === "ADMIN" ||
      roleData?.role === "MANAGER" ||
      (roleData?.pageAccess as any)?.["/dashboard"]
    );

    return {
      props: {
        initialTickets: rawTickets.map(t => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        initialNotifications: rawNotifications.map(n => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
          readAt: n.readAt?.toISOString() ?? null,
        })),
        hasDashboardAccess,
      },
    };
  } catch (err) {
    console.error("[Portal SSR]", err);
    return { redirect: { destination: "/login", permanent: false } };
  }
};

/* ── Default export ─────────────────────────────────────────────────────── */
export default function PortalPage(props: PortalProps) {
  return <PortalContent {...props} />;
}
