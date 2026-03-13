import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { toast } from "@/components/ui/use-toast";
import {
  PlusCircle,
  Bell,
  LogOut,
  Loader2,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  LayoutDashboard,
  UserCheck,
  Inbox,
} from "lucide-react";
import { TicketStatus, TicketPriority } from "@prisma/client";

interface Ticket {
  id: string;
  displayId: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  userId?: string;
  assignedToId?: string | null;
  createdAt: string;
  updatedAt: string;
  source?: string | null;
}

interface NotificationRow {
  id: string;
  ticketId: string | null;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

const priorityLabel: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
const statusLabel: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

function TicketRow({
  ticket: t,
  onOpen,
  actionLabel,
  highlight,
}: {
  ticket: Ticket;
  onOpen: () => void;
  actionLabel?: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        className={`flex w-full items-center gap-4 rounded-xl p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-slate-400/30 ${
          highlight
            ? "bg-violet-50/60 hover:bg-violet-50 border border-violet-100/80"
            : "bg-slate-50/40 hover:bg-slate-100/60 border border-transparent"
        }`}
        onClick={onOpen}
      >
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${highlight ? "bg-violet-100" : "bg-slate-200/80"}`}>
          {t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : t.status === TicketStatus.IN_PROGRESS ? (
            <Clock className="h-5 w-5 text-amber-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-slate-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{t.displayId || t.id.slice(0, 8)}</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                t.priority === TicketPriority.CRITICAL ? "bg-red-100 text-red-700" :
                t.priority === TicketPriority.HIGH ? "bg-amber-100 text-amber-700" :
                "bg-slate-200 text-slate-600"
              }`}
            >
              {priorityLabel[t.priority] || t.priority}
            </span>
            <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {statusLabel[t.status] || t.status}
            </span>
          </div>
          <h3 className="mt-1 font-medium text-slate-900 line-clamp-1">{t.title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {new Date(t.createdAt).toLocaleDateString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        {actionLabel && (
          <span className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            {actionLabel}
          </span>
        )}
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
      </button>
    </li>
  );
}

function PortalContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPriority, setCreatePriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", { headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(
        (data || []).map((t: any) => ({
          ...t,
          status: Object.values(TicketStatus).includes(t.status) ? t.status : TicketStatus.OPEN,
          priority: Object.values(TicketPriority).includes(t.priority) ? t.priority : TicketPriority.MEDIUM,
        }))
      );
    } catch {
      toast({ variant: "destructive", title: "Could not load tickets" });
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications?unreadOnly=0&limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data || []);
    } finally {
      setNotifLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (notifOpen) fetchNotifications();
  }, [notifOpen, fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setAccessLoading(true);
    fetch("/api/users/permissions", { headers: { "Cache-Control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const isAdmin = data.isAdmin === true;
        const isManager = data.role === "MANAGER";
        const hasPage = data.pageAccess && data.pageAccess["/dashboard"] === true;
        setHasDashboardAccess(!!(isAdmin || isManager || hasPage));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const assignedToMe = tickets.filter((t) => t.assignedToId === user?.id);
  const myTickets = tickets.filter((t) => t.userId === user?.id);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createDesc.trim()) {
      toast({ variant: "destructive", title: "Title and description are required" });
      return;
    }
    if (createDesc.trim().length < 10) {
      toast({ variant: "destructive", title: "Description must be at least 10 characters" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDesc.trim(),
          priority: createPriority,
          source: "PORTAL",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create ticket");
      }
      toast({ title: "Ticket raised", description: "We’ll get back to you soon." });
      setCreateOpen(false);
      setCreateTitle("");
      setCreateDesc("");
      setCreatePriority(TicketPriority.MEDIUM);
      fetchTickets();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Could not create ticket",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Subtle background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]" aria-hidden />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_80%_50%,rgba(139,92,246,0.06),transparent)]" aria-hidden />

      {/* Header — minimal, no sidebar */}
      <div className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/95 backdrop-blur-md">
        <header className="relative">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-tight text-slate-900">Support</span>
                <span className="ml-1.5 text-sm font-medium text-slate-500">Portal</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!accessLoading && hasDashboardAccess && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => router.push("/dashboard")}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-lg"
                onClick={() => setNotifOpen((o) => !o)}
              >
                <Bell className="h-4 w-4 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => signOut().then(() => router.push("/login"))}
              >
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
          {/* Notifications dropdown — positioned under header */}
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden onClick={() => setNotifOpen(false)} />
              <div className="absolute right-4 top-full z-50 mt-2 w-[min(100vw-2rem,320px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:right-6">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              <p className="text-xs text-slate-500">Updates on your tickets</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">No notifications yet</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
                    onClick={() => {
                      markRead(n.id);
                      if (n.ticketId) router.push(`/tickets/${n.ticketId}`);
                      setNotifOpen(false);
                    }}
                  >
                    <span className={`text-sm font-medium ${n.readAt ? "text-slate-500" : "text-slate-900"}`}>{n.title}</span>
                    <span className="text-xs text-slate-500 line-clamp-2">{n.message}</span>
                  </button>
                ))
              )}
            </div>
          </div>
            </>
          )}
        </header>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* Hero + CTA */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Your support tickets
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              View tickets assigned to you and the ones you’ve raised.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full shrink-0 rounded-xl bg-slate-900 px-6 font-medium text-white hover:bg-slate-800 sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New ticket
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Assigned to you */}
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Assigned to you</h2>
                    <p className="text-xs text-slate-500">Tickets waiting on your action</p>
                  </div>
                </div>
                {assignedToMe.length > 0 && (
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {assignedToMe.length}
                  </span>
                )}
              </div>
              <div className="p-4">
                {assignedToMe.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Inbox className="h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-600">No tickets assigned yet</p>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">When someone assigns you a ticket, it will show here.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {assignedToMe.map((t) => (
                      <TicketRow key={t.id} ticket={t} onOpen={() => router.push(`/tickets/${t.id}`)} actionLabel="Open" highlight />
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* My tickets */}
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Inbox className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">My tickets</h2>
                  <p className="text-xs text-slate-500">Tickets you raised</p>
                </div>
              </div>
              <div className="p-4">
                {myTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-600">No tickets yet</p>
                    <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={() => setCreateOpen(true)}>
                      <PlusCircle className="mr-1.5 h-4 w-4" />
                      Create your first ticket
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {myTickets.map((t) => (
                      <TicketRow key={t.id} ticket={t} onOpen={() => router.push(`/tickets/${t.id}`)} />
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {!hasDashboardAccess && !accessLoading && (
              <p className="text-center text-xs text-slate-400">
                Need full app access? Ask your administrator for dashboard permissions.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Create ticket dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl border-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">New ticket</DialogTitle>
            <p className="text-sm text-slate-500">We’ll review and assign it to the right team.</p>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="portal-title" className="text-sm font-medium text-slate-700">Title</Label>
                <Input
                  id="portal-title"
                  placeholder="Brief summary"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="mt-1.5 rounded-lg border-slate-200"
                />
              </div>
              <div>
                <Label htmlFor="portal-desc" className="text-sm font-medium text-slate-700">Description</Label>
                <Textarea
                  id="portal-desc"
                  placeholder="Describe your issue or request..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={4}
                  className="mt-1.5 rounded-lg border-slate-200"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Priority</Label>
                <Select value={createPriority} onValueChange={(v) => setCreatePriority(v as TicketPriority)}>
                  <SelectTrigger className="mt-1.5 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabel).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 hover:bg-slate-800">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PortalPage() {
  return (
    <ProtectedRoute>
      <PortalContent />
    </ProtectedRoute>
  );
}
