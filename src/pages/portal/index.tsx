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
  Package,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Support Portal</h1>
              <p className="text-xs text-slate-500">Raise and track tickets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!accessLoading && hasDashboardAccess && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                onClick={() => router.push("/dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            )}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-full"
                onClick={() => setNotifOpen((o) => !o)}
              >
                <Bell className="h-5 w-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                      <h3 className="font-semibold text-slate-800">Notifications</h3>
                      <p className="text-xs text-slate-500">Updates on your tickets</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
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
                            <span className={`text-sm font-medium ${n.readAt ? "text-slate-600" : "text-slate-900"}`}>
                              {n.title}
                            </span>
                            <span className="text-xs text-slate-500 line-clamp-2">{n.message}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600"
              onClick={() => signOut().then(() => router.push("/login"))}
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Support Portal</h2>
            <p className="mt-1 text-sm text-slate-500">Tickets assigned to you and ones you created</p>
          </div>
          <Button
            size="lg"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700"
            onClick={() => setCreateOpen(true)}
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Raise a ticket
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Assigned to me — world-class hero section for staff */}
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <UserCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Assigned to you</h3>
                    <p className="text-sm text-white/90">Tickets for you to action</p>
                  </div>
                  {assignedToMe.length > 0 && (
                    <span className="ml-auto rounded-full bg-white/25 px-3 py-1 text-sm font-semibold text-white">
                      {assignedToMe.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {assignedToMe.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Inbox className="h-12 w-12 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-600">No tickets assigned to you yet</p>
                    <p className="mt-1 text-xs text-slate-500">When management assigns you a ticket, it will appear here.</p>
                  </div>
                ) : (
                  <ul className="grid gap-3">
                    {assignedToMe.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          onClick={() => router.push(`/tickets/${t.id}`)}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                            {t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED ? (
                              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            ) : t.status === TicketStatus.IN_PROGRESS ? (
                              <Clock className="h-6 w-6 text-amber-500" />
                            ) : (
                              <AlertCircle className="h-6 w-6 text-indigo-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-slate-500">{t.displayId || t.id.slice(0, 8)}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  t.priority === TicketPriority.CRITICAL
                                    ? "bg-rose-100 text-rose-700"
                                    : t.priority === TicketPriority.HIGH
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {priorityLabel[t.priority] || t.priority}
                              </span>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                                {statusLabel[t.status] || t.status}
                              </span>
                            </div>
                            <h3 className="mt-1 font-semibold text-slate-900 line-clamp-1">{t.title}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {new Date(t.createdAt).toLocaleDateString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">
                            Action
                          </span>
                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* My tickets — created by me */}
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <h3 className="text-base font-semibold text-slate-800">My tickets</h3>
                <p className="text-xs text-slate-500">Tickets you raised</p>
              </div>
              <div className="p-4">
                {myTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare className="h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-600">No tickets yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 rounded-xl"
                      onClick={() => setCreateOpen(true)}
                    >
                      <PlusCircle className="mr-1.5 h-4 w-4" />
                      Raise your first ticket
                    </Button>
                  </div>
                ) : (
                  <ul className="grid gap-3">
                    {myTickets.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          onClick={() => router.push(`/tickets/${t.id}`)}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                            {t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED ? (
                              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            ) : t.status === TicketStatus.IN_PROGRESS ? (
                              <Clock className="h-6 w-6 text-amber-500" />
                            ) : (
                              <AlertCircle className="h-6 w-6 text-indigo-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-slate-500">{t.displayId || t.id.slice(0, 8)}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  t.priority === TicketPriority.CRITICAL
                                    ? "bg-rose-100 text-rose-700"
                                    : t.priority === TicketPriority.HIGH
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {priorityLabel[t.priority] || t.priority}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {statusLabel[t.status] || t.status}
                              </span>
                            </div>
                            <h3 className="mt-1 font-semibold text-slate-900 line-clamp-1">{t.title}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {new Date(t.createdAt).toLocaleDateString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {!hasDashboardAccess && !accessLoading && (
              <p className="text-center text-xs text-slate-400">
                Need access to the full app? Ask your administrator to assign you dashboard access.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Create ticket dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl border-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise a ticket</DialogTitle>
            <p className="text-sm text-slate-500">We’ll review and assign it to the right team.</p>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="portal-title">Title</Label>
                <Input
                  id="portal-title"
                  placeholder="Short summary"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="portal-desc">Description</Label>
                <Textarea
                  id="portal-desc"
                  placeholder="Describe your issue or request in detail..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={4}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={createPriority}
                  onValueChange={(v) => setCreatePriority(v as TicketPriority)}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabel).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit ticket"
                )}
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
