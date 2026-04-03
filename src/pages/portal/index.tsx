// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  Bell, LogOut, LayoutDashboard, Search, X, Send, Loader2,
  ArrowUp, Minus, ArrowDown, ChevronRight, Plus, Filter,
  CheckCircle2, Clock, Circle, Activity, RefreshCw, ArrowLeft,
  Monitor, Laptop, Printer, Smartphone, Tv, Phone, Settings,
  Package, Shield, Code, Database, Server, Wifi, Lock, Key,
  AlertTriangle, HelpCircle, Inbox, FileText, RotateCcw,
  Wrench, Truck, MapPin, Users, BarChart3, Ticket, Zap,
  Star, TrendingUp, ChevronDown, Upload, Paperclip, Eye,
  MessageSquare, Hash, Calendar, Tag, User, Building, Boxes,
  XCircle,
} from "lucide-react";
import Head from "next/head";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface PortalTicket {
  id: string; displayId: string | null; title: string; description: string;
  status: string; priority: string; ticketType?: string; category?: string;
  subcategory?: string; location?: string; contactDetails?: string;
  userId?: string; assignedToId?: string | null;
  assignedTo?: { email: string } | null;
  createdAt: string; updatedAt: string; source?: string | null;
}
interface HistoryEntry {
  id: string; status: string | null; priority: string | null;
  comment: string; createdAt: string;
  user: { id: string; email: string };
}
interface NotifRow {
  id: string; ticketId: string | null; type: string;
  title: string; message: string; readAt: string | null; createdAt: string;
}

/* ── Configs ─────────────────────────────────────────────────────────────── */
const PRIORITY_CFG = {
  CRITICAL: { label: "Critical", color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     icon: <ArrowUp className="h-3 w-3" /> },
  HIGH:     { label: "High",     color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  icon: <ArrowUp className="h-3 w-3" /> },
  MEDIUM:   { label: "Medium",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   icon: <Minus className="h-3 w-3" /> },
  LOW:      { label: "Low",      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: <ArrowDown className="h-3 w-3" /> },
};
const STATUS_CFG = {
  OPEN:        { label: "Open",        color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500"    },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500"   },
  RESOLVED:    { label: "Resolved",    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  CLOSED:      { label: "Closed",      color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   dot: "bg-slate-400"   },
};

const TICKET_TYPES = {
  ISSUE:      { label: "Report an Issue",  icon: AlertTriangle, color: "bg-red-600",    desc: "Report a technical problem or malfunction" },
  REQUEST:    { label: "Need a Request",   icon: Inbox,         color: "bg-blue-600",   desc: "Request new equipment, access or services" },
  INQUIRY:    { label: "Submit an Inquiry",icon: HelpCircle,    color: "bg-purple-600", desc: "Ask a question or get information" },
  MANAGEMENT: { label: "Manage my Stuff",  icon: FileText,      color: "bg-slate-700",  desc: "Manage existing items and assets" },
};

const CATEGORIES = {
  DEVICES: {
    label: "Devices", icon: Monitor,
    items: [
      { key: "Desktop Computer",     icon: Monitor,   label: "Desktop Computer" },
      { key: "Laptop",               icon: Laptop,    label: "Laptop" },
      { key: "Computer Peripherals", icon: Settings,  label: "Computer Peripherals (Accessories)" },
      { key: "Change Printer Toner", icon: Printer,   label: "Change Printer Toner" },
      { key: "Device Movement",      icon: Truck,     label: "Device Movement" },
      { key: "Maintenance",          icon: Wrench,    label: "Maintenance" },
      { key: "Monitor",              icon: Monitor,   label: "Monitor" },
      { key: "Mobile Devices",       icon: Smartphone,label: "Mobile Devices" },
      { key: "Printer",              icon: Printer,   label: "Printer" },
      { key: "TV & IP TV STB",       icon: Tv,        label: "TV & IP TV STB" },
      { key: "Events",               icon: Calendar,  label: "Events" },
      { key: "PAM Secure Access",    icon: Shield,    label: "PAM Secure Access" },
      { key: "Return an Asset",      icon: RotateCcw, label: "Return an Asset" },
      { key: "Report Lost/Stolen",   icon: AlertTriangle, label: "Report Lost/Stolen/Confiscated Assets" },
      { key: "IP Phone",             icon: Phone,     label: "IP Phone" },
    ],
  },
  ACCESS: {
    label: "Access", icon: Key,
    items: [
      { key: "VPN Access",           icon: Lock,      label: "VPN Access" },
      { key: "System Access",        icon: Key,       label: "System Access Request" },
      { key: "Email Account",        icon: Inbox,     label: "Email Account" },
      { key: "Application Access",   icon: Code,      label: "Application Access" },
      { key: "Network Access",       icon: Wifi,      label: "Network Access" },
      { key: "Remote Access",        icon: Server,    label: "Remote Access" },
    ],
  },
  DIGITAL_REQUEST: {
    label: "Digital Request", icon: Code,
    items: [
      { key: "Software Installation",icon: Code,      label: "Software Installation" },
      { key: "Cloud Storage",        icon: Database,  label: "Cloud Storage" },
      { key: "Digital Certificate",  icon: Shield,    label: "Digital Certificate" },
      { key: "Website Request",      icon: Wifi,      label: "Website Request" },
    ],
  },
  NG_DEPLOYMENTS: {
    label: "NG Deployments", icon: Server,
    items: [
      { key: "Server Deployment",    icon: Server,    label: "Server Deployment" },
      { key: "Network Configuration",icon: Wifi,      label: "Network Configuration" },
      { key: "Infrastructure",       icon: Building,  label: "Infrastructure Request" },
    ],
  },
  SERVICE_DESK: {
    label: "Service Desk", icon: HelpCircle,
    items: [
      { key: "Feedback",             icon: MessageSquare, label: "Feedback" },
      { key: "Inquiry",              icon: HelpCircle, label: "Inquiry" },
      { key: "Report an Issue",      icon: AlertTriangle, label: "Report an issue" },
      { key: "Return an Asset",      icon: RotateCcw, label: "Return an Asset" },
      { key: "Report Lost/Stolen",   icon: AlertTriangle, label: "Report Lost/Stolen/Confiscated Assets" },
    ],
  },
  SOFTWARE: {
    label: "Software", icon: Code,
    items: [
      { key: "License Request",      icon: FileText,  label: "License Request" },
      { key: "Software Bug",         icon: AlertTriangle, label: "Software Bug Report" },
      { key: "Feature Request",      icon: Star,      label: "Feature Request" },
      { key: "Software Upgrade",     icon: TrendingUp, label: "Software Upgrade" },
    ],
  },
  ASSET_MANAGEMENT: {
    label: "Asset Management", icon: Package,
    items: [
      { key: "Asset Request",        icon: Package,   label: "Asset Request" },
      { key: "Not My Asset",         icon: X,         label: "Not My Asset" },
      { key: "Report Lost/Stolen",   icon: AlertTriangle, label: "Report Lost/Stolen/Confiscated Assets" },
      { key: "Return an Asset",      icon: RotateCcw, label: "Return an Asset" },
      { key: "Project Status Report",icon: BarChart3, label: "Project Status Report (Assets)" },
    ],
  },
  SAP: {
    label: "SAP", icon: Database,
    items: [
      { key: "SAP Access",           icon: Key,       label: "SAP System Access" },
      { key: "SAP Report",           icon: BarChart3, label: "SAP Report Request" },
      { key: "SAP Issue",            icon: AlertTriangle, label: "SAP Issue" },
      { key: "SAP Training",         icon: Users,     label: "SAP Training" },
    ],
  },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
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

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function Sk({ className = "" }) { return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`} />; }

/* ── Ticket Drawer ──────────────────────────────────────────────────────── */
function TicketDrawer({ ticket, onClose, onRefresh }: { ticket: PortalTicket; onClose: () => void; onRefresh: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/tickets/${ticket.id}/history`);
      if (r.ok) setHistory(await r.json() || []);
    } finally { setLoading(false); }
  }, [ticket.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      if (!r.ok) throw new Error();
      setComment(""); await loadHistory(); onRefresh();
      toast({ title: "Comment added" });
    } catch { toast({ variant: "destructive", title: "Failed to post comment" }); }
    finally { setPosting(false); }
  };

  const steps = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const stepIdx = steps.indexOf(ticket.status);
  const tc = TICKET_TYPES[ticket.ticketType as keyof typeof TICKET_TYPES] || TICKET_TYPES.ISSUE;
  const TypeIcon = tc.icon;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white dark:bg-card shadow-2xl border-l dark:border-border" style={{ animation: "slideIn .22s cubic-bezier(.22,1,.36,1)" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tc.color}`}>
              <TypeIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-500 dark:text-slate-400">{ticket.displayId || "#" + ticket.id.slice(0, 8)}</span>
                <SBadge s={ticket.status} /><PBadge p={ticket.priority} />
              </div>
              {ticket.category && <p className="text-xs text-slate-400 dark:text-slate-500">{ticket.category} {ticket.subcategory ? `· ${ticket.subcategory}` : ""}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-muted hover:text-slate-600 dark:hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Details */}
          <div className="border-b dark:border-border px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-foreground">{ticket.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted-foreground">{ticket.description}</p>
            
            {/* Meta grid */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ticket.location && (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-muted/60 p-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Location</p><p className="text-sm font-medium text-slate-700 dark:text-foreground">{ticket.location}</p></div>
                </div>
              )}
              {ticket.contactDetails && (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-muted/60 p-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Contact</p><p className="text-sm font-medium text-slate-700 dark:text-foreground">{ticket.contactDetails}</p></div>
                </div>
              )}
              {ticket.assignedTo?.email && (
                <div className="flex items-start gap-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 p-3 col-span-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  <div><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Assigned To</p><p className="text-sm font-medium text-violet-700 dark:text-violet-300">{ticket.assignedTo.email}</p></div>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Created {timeAgo(ticket.createdAt)}</span>
              <span className="flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Updated {timeAgo(ticket.updatedAt)}</span>
            </div>
          </div>

          {/* Progress tracker */}
          <div className="border-b dark:border-border px-6 py-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Ticket Progress</p>
            <div className="flex items-start gap-1">
              {steps.map((step, i) => {
                const sc = STATUS_CFG[step]; const done = i <= stepIdx; const active = i === stepIdx;
                return (
                  <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className={`h-2 w-full rounded-full transition-all duration-700 ${done ? sc.dot : "bg-slate-100 dark:bg-slate-800"} ${active ? "ring-2 ring-offset-1 ring-current dark:ring-offset-background" : ""}`} />
                    <span className={`text-center text-[10px] font-semibold leading-tight ${done ? sc.color : "text-slate-300 dark:text-slate-600"}`}>{sc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity timeline */}
          <div className="px-6 py-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Activity Timeline</p>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Activity className="h-8 w-8 text-slate-200 dark:text-slate-600" />
                <p className="text-sm text-slate-400 dark:text-muted-foreground">No activity yet. Comments from the support team will appear here.</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute bottom-2 left-4 top-2 w-px bg-slate-100 dark:bg-border" />
                {[...history].reverse().map(h => (
                  <div key={h.id} className="relative flex gap-3 pb-5 last:pb-0">
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 ring-2 ring-white dark:ring-card shadow-sm">
                      <Activity className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-muted-foreground">
                        <span className="font-semibold text-slate-700 dark:text-foreground">{h.user.email.split("@")[0]}</span>
                        <span className="text-slate-300">·</span>
                        <span>{timeAgo(h.createdAt)}</span>
                        {h.status && <><span className="text-slate-300">·</span><SBadge s={h.status} /></>}
                        {h.priority && <><span className="text-slate-300">·</span><PBadge p={h.priority} /></>}
                      </div>
                      <div className="mt-1.5 rounded-xl border border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/50 px-3.5 py-2.5 text-sm text-slate-700 dark:text-foreground">{h.comment}</div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>

        {/* Comment box */}
        <div className="border-t dark:border-border bg-slate-50/80 dark:bg-muted/30 px-6 py-4">
          <form onSubmit={postComment} className="flex flex-col gap-2.5">
            <textarea
              placeholder="Add a comment or provide additional information…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-background px-3.5 py-2.5 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-slate-400 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-primary/30"
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(e as any); }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-muted-foreground">Ctrl + Enter to submit</span>
              <button type="submit" disabled={posting || !comment.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-primary/90 disabled:opacity-40 transition-colors">
                {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Post Comment
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Create Ticket Dialog ──────────────────────────────────────────────────── */
function CreateTicketDialog({ prefill, onClose, onSuccess }: {
  prefill?: { type?: string; category?: string; subcategory?: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(prefill ? 2 : 1);
  const [selectedType, setSelectedType] = useState(prefill?.type || "ISSUE");
  const [selectedCat, setSelectedCat] = useState(prefill?.category || "");
  const [selectedSub, setSelectedSub] = useState(prefill?.subcategory || "");
  const [activeCatTab, setActiveCatTab] = useState(prefill?.category || Object.keys(CATEGORIES)[0]);
  const [form, setForm] = useState({
    title: prefill?.subcategory || "",
    description: "",
    priority: "MEDIUM",
    location: "",
    contactDetails: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast({ variant: "destructive", title: "Please fill in required fields" }); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          source: "PORTAL",
          ticketType: selectedType,
          category: selectedCat || activeCatTab,
          subcategory: selectedSub,
          location: form.location.trim(),
          contactDetails: form.contactDetails.trim(),
        }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Ticket submitted successfully!", description: "Our team will review your request shortly." });
      onSuccess(); onClose();
    } catch { toast({ variant: "destructive", title: "Failed to submit ticket. Please try again." }); }
    finally { setSubmitting(false); }
  };

  const priorityOpts = [
    { v: "LOW", label: "Low", desc: "Non-urgent, can wait" },
    { v: "MEDIUM", label: "Medium", desc: "Normal priority" },
    { v: "HIGH", label: "High", desc: "Needs attention soon" },
    { v: "CRITICAL", label: "Critical", desc: "Business impacting" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col bg-white dark:bg-card rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] border dark:border-border" style={{ animation: "fadeUp .2s ease-out" }}>
        {/* Dialog header */}
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <Ticket className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">
                {step === 1 ? "Select Request Type" : "Create New Ticket"}
              </h2>
              {step === 2 && selectedType && (
                <p className="text-xs text-white/60">{TICKET_TYPES[selectedType as keyof typeof TICKET_TYPES]?.label}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5">
              {[1,2].map(s => (
                <div key={s} className={`h-2 rounded-full transition-all ${s === step ? "w-6 bg-white" : s < step ? "w-2 bg-white/60" : "w-2 bg-white/20"}`} />
              ))}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 1 ? (
            /* Step 1: Select type */
            <div className="p-6">
              <p className="mb-5 text-sm text-slate-500 dark:text-muted-foreground">What type of request are you submitting?</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TICKET_TYPES).map(([key, tc]) => {
                  const Icon = tc.icon;
                  return (
                    <button key={key} onClick={() => { setSelectedType(key); setStep(2); }}
                      className="group flex items-start gap-3.5 rounded-2xl border-2 border-transparent bg-slate-50 dark:bg-muted/50 p-4 text-left transition-all hover:border-slate-300 dark:hover:border-border hover:bg-white dark:hover:bg-card hover:shadow-md">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tc.color} shadow-sm`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-foreground">{tc.label}</p>
                        <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-muted-foreground">{tc.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Category quick select */}
              <div className="mt-6">
                <p className="mb-3 text-sm font-semibold text-slate-600 dark:text-foreground">Or browse by category:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORIES).map(([key, cat]) => {
                    const Icon = cat.icon;
                    return (
                      <button key={key} onClick={() => { setActiveCatTab(key); setSelectedCat(key); setStep(2); }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted hover:border-slate-300 transition-colors">
                        <Icon className="h-3.5 w-3.5" />{cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Form */
            <form onSubmit={submit} className="divide-y dark:divide-border">
              {/* Category & subcategory selector */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <button type="button" onClick={() => setStep(1)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-foreground flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <span className="text-xs text-slate-300 dark:text-slate-600">/</span>
                  <span className="text-xs text-slate-500 dark:text-muted-foreground font-medium">Request Details</span>
                </div>

                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Category</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  {Object.entries(CATEGORIES).map(([key, cat]) => {
                    const Icon = cat.icon;
                    return (
                      <button key={key} type="button"
                        onClick={() => { setActiveCatTab(key); setSelectedCat(key); setSelectedSub(""); }}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${activeCatTab === key ? "bg-slate-900 dark:bg-primary text-white dark:text-primary-foreground" : "bg-slate-100 dark:bg-muted text-slate-600 dark:text-foreground hover:bg-slate-200 dark:hover:bg-muted/80"}`}>
                        <Icon className="h-3.5 w-3.5" />{cat.label}
                      </button>
                    );
                  })}
                </div>

                {activeCatTab && (
                  <>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Service Type</p>
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                      {CATEGORIES[activeCatTab as keyof typeof CATEGORIES]?.items.map(item => {
                        const Icon = item.icon;
                        return (
                          <button key={item.key} type="button"
                            onClick={() => { setSelectedSub(item.key); setForm(f => ({ ...f, title: item.label })); }}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-center transition-all ${selectedSub === item.key ? "border-slate-900 dark:border-primary bg-slate-900 dark:bg-primary text-white" : "border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/50 text-slate-600 dark:text-foreground hover:border-slate-200 dark:hover:border-border hover:bg-white dark:hover:bg-card"}`}>
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${selectedSub === item.key ? "bg-white/20" : "bg-slate-200/60 dark:bg-slate-600/60"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Required fields */}
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                    Summary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Brief description of your request…"
                    className="w-full rounded-xl border border-slate-200 dark:border-border bg-slate-50 dark:bg-background px-3.5 py-2.5 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-slate-400 dark:focus:border-primary focus:bg-white dark:focus:bg-background focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-primary/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                    Description <span className="text-red-500">*</span>
                  </label>
                  {/* Formatting toolbar */}
                  <div className="flex items-center gap-1 rounded-t-xl border border-b-0 border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 px-2 py-1.5">
                    {["Aa", "B", "I", "·"].map(tool => (
                      <button key={tool} type="button" className="rounded px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-muted transition-colors">{tool}</button>
                    ))}
                    <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-border" />
                    {["≡", "→", "<>", "❝"].map(tool => (
                      <button key={tool} type="button" className="rounded px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-muted transition-colors">{tool}</button>
                    ))}
                  </div>
                  <textarea
                    required
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={4}
                    placeholder="Describe the issue or request in detail…"
                    className="w-full resize-none rounded-b-xl border border-slate-200 dark:border-border bg-white dark:bg-background px-3.5 py-2.5 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-slate-400 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-primary/30 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="Your current location"
                        className="w-full rounded-xl border border-slate-200 dark:border-border bg-slate-50 dark:bg-background pl-9 pr-3.5 py-2.5 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-slate-400 dark:focus:border-primary focus:bg-white dark:focus:bg-background focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-muted-foreground">Your current Location</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                      Contact Details <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={form.contactDetails}
                        onChange={e => setForm(f => ({ ...f, contactDetails: e.target.value }))}
                        placeholder="Phone & extension"
                        className="w-full rounded-xl border border-slate-200 dark:border-border bg-slate-50 dark:bg-background pl-9 pr-3.5 py-2.5 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-slate-400 dark:focus:border-primary focus:bg-white dark:focus:bg-background focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-muted-foreground">Your phone and extension</p>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Priority</label>
                  <div className="grid grid-cols-4 gap-2">
                    {priorityOpts.map(opt => {
                      const pc = PRIORITY_CFG[opt.v];
                      return (
                        <button key={opt.v} type="button"
                          onClick={() => setForm(f => ({ ...f, priority: opt.v }))}
                          className={`rounded-xl border-2 p-2 text-center transition-all ${form.priority === opt.v ? `${pc.bg} ${pc.border} ${pc.color}` : "border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/50 text-slate-500 dark:text-muted-foreground hover:border-slate-200 dark:hover:border-border"}`}>
                          <div className="flex justify-center mb-0.5">{pc.icon}</div>
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className="text-[9px] leading-tight">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Attachment */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Attachment</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-all ${dragging ? "border-slate-400 dark:border-primary bg-slate-50 dark:bg-muted/50" : "border-slate-200 dark:border-border hover:border-slate-300 dark:hover:border-muted-foreground/40 hover:bg-slate-50 dark:hover:bg-muted/30"}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted">
                      <Paperclip className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600 dark:text-foreground">Drag and drop files, paste screenshots, or <span className="text-blue-600 dark:text-blue-400 underline cursor-pointer">browse</span></p>
                      <p className="text-xs text-slate-400 dark:text-muted-foreground mt-0.5">PNG, JPG, PDF up to 10MB</p>
                    </div>
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                  </div>
                  {files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-muted/50 px-3 py-1.5">
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          <span className="flex-1 text-xs text-slate-600 dark:text-foreground truncate">{f.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className="flex items-center justify-between border-t dark:border-border bg-slate-50 dark:bg-muted/30 px-6 py-4">
            <button type="button" className="text-sm text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground transition-colors">
              Formatting Help
            </button>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-4 py-2 text-sm font-semibold text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !form.title.trim() || !form.description.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-primary dark:text-primary-foreground px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-primary/90 disabled:opacity-40 transition-colors">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Ticket row ──────────────────────────────────────────────────────────── */
function TicketRow({ t, onClick, assigned, unreadCount = 0 }: { t: PortalTicket; onClick: () => void; assigned?: boolean; unreadCount?: number }) {
  const sc = STATUS_CFG[t.status] || STATUS_CFG.OPEN;
  const tc = TICKET_TYPES[t.ticketType as keyof typeof TICKET_TYPES];
  const TypeIcon = tc?.icon || Ticket;
  const hasUpdate = unreadCount > 0;
  return (
    <button type="button" onClick={onClick}
      className={`group w-full text-left rounded-2xl border transition-all hover:shadow-md ${hasUpdate ? "border-blue-300 dark:border-blue-700 bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/40 dark:to-card hover:border-blue-400 shadow-sm" : assigned ? "border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-white dark:from-violet-950/30 dark:to-card hover:border-violet-300" : "border-slate-100 dark:border-border bg-white dark:bg-card hover:border-slate-200 dark:hover:border-border"}`}>
      <div className="flex items-center gap-3.5 p-4">
        <div className="relative shrink-0">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${sc.bg} border ${sc.border}`}>
            {t.status === "RESOLVED" || t.status === "CLOSED" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              : t.status === "IN_PROGRESS" ? <Clock className="h-5 w-5 text-amber-600" />
              : <Circle className="h-5 w-5 text-blue-500" />}
          </div>
          {hasUpdate && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500">{t.displayId || "#" + t.id.slice(0, 8)}</span>
            <SBadge s={t.status} />
            <PBadge p={t.priority} />
            {t.subcategory && <span className="rounded-md bg-slate-100 dark:bg-muted px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-muted-foreground">{t.subcategory}</span>}
            {hasUpdate && <span className="rounded-md bg-blue-100 dark:bg-blue-950/50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">New update</span>}
          </div>
          <h3 className="font-semibold leading-snug text-slate-900 dark:text-foreground line-clamp-1">{t.title}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-muted-foreground line-clamp-1">{t.description}</p>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
            <span>{timeAgo(t.updatedAt)}</span>
            {t.assignedTo?.email && <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.assignedTo.email.split("@")[0]}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {assigned && <span className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white">Action →</span>}
          <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

/* ── Portal page ────────────────────────────────────────────────────────── */
export default function PortalPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [canDash, setCanDash] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showNotif, setShowNotif] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ type?: string; category?: string; subcategory?: string } | undefined>();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [activeCatTab, setActiveCatTab] = useState<string>(Object.keys(CATEGORIES)[0]);
  const [view, setView] = useState<"portal" | "my-tickets" | "my-assets" | "approvals">("portal");
  const [myAssets, setMyAssets] = useState<any[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [dlmPending, setDlmPending] = useState<any[]>([]);
  const [dlmLoading, setDlmLoading] = useState(false);
  const [isDlm, setIsDlm] = useState(false);
  const [dlmDeciding, setDlmDeciding] = useState<string | null>(null);
  const [dlmComment, setDlmComment] = useState<Record<string, string>>({});

  const unread = notifications.filter(n => !n.readAt).length;

  // Per-ticket unread map: ticketId → count of unread notifications for that ticket
  const ticketUnreads = notifications
    .filter(n => !n.readAt && n.ticketId)
    .reduce((acc, n) => { acc[n.ticketId!] = (acc[n.ticketId!] || 0) + 1; return acc; }, {} as Record<string, number>);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/portal/data", {
        credentials: "same-origin",
        headers: forceRefresh ? { "Cache-Control": "no-cache" } : {},
      });
      if (r.status === 401) { router.replace("/login"); return; }
      if (!r.ok) throw new Error();
      const d = await r.json();
      setTickets(d.tickets || []);
      setNotifications(d.notifications || []);
      setCanDash(!!(d.permissions?.canAccessDashboard));
      setIsStaff(!!(d.permissions?.isStaff || d.permissions?.role === "STAFF"));
    } catch { toast({ variant: "destructive", title: "Failed to load data" }); }
    finally { setLoading(false); }
  }, [user, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDlmPending = useCallback(async () => {
    if (!user) return;
    setDlmLoading(true);
    try {
      const r = await fetch("/api/dlm/pending", { credentials: "same-origin" });
      if (r.ok) {
        const d = await r.json();
        setDlmPending(d.tickets || []);
        setIsDlm((d.tickets || []).length >= 0); // DLM tab visible if endpoint accessible
      }
    } catch {}
    finally { setDlmLoading(false); }
  }, [user]);

  useEffect(() => { loadDlmPending(); }, [loadDlmPending]);
  useEffect(() => { if (view === "approvals") loadDlmPending(); }, [view]);

  const handleDlmDecide = async (ticketId: string, action: "approve" | "reject") => {
    setDlmDeciding(ticketId);
    try {
      const r = await fetch(`/api/dlm/${ticketId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, comment: dlmComment[ticketId] || "" }),
      });
      if (!r.ok) throw new Error();
      toast({ title: action === "approve" ? "✅ Ticket approved" : "❌ Ticket rejected", description: action === "approve" ? "The ticket is now with the IT support team." : "The ticket has been rejected." });
      setDlmComment(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
      loadDlmPending();
    } catch {
      toast({ variant: "destructive", title: "Failed to process decision" });
    } finally { setDlmDeciding(null); }
  };

  const markRead = async () => {
    const ids = notifications.filter(n => !n.readAt).map(n => n.id);
    if (!ids.length) return;
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  };

  // Mark all unread notifications for a specific ticket as read
  const markTicketRead = async (ticketId: string) => {
    const ids = notifications.filter(n => !n.readAt && n.ticketId === ticketId).map(n => n.id);
    if (!ids.length) return;
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    setNotifications(prev => prev.map(n => n.ticketId === ticketId ? { ...n, readAt: n.readAt || new Date().toISOString() } : n));
  };

  const handleSignOut = async () => { await signOut(); router.replace("/login"); };

  const assignedTickets = tickets.filter(t => t.assignedToId === user?.id);
  const myTickets = tickets.filter(t => t.userId === user?.id || t.assignedToId === user?.id);
  // Number of my tickets that have at least one unread notification (for the tab badge)
  const myTicketsWithUpdates = myTickets.filter(t => ticketUnreads[t.id] > 0).length;

  const filteredMyTickets = myTickets.filter(t => {
    if (search && !(t.title || '').toLowerCase().includes(search.toLowerCase()) && !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (activeFilter === "open") return t.status === "OPEN";
    if (activeFilter === "in_progress") return t.status === "IN_PROGRESS";
    if (activeFilter === "resolved") return t.status === "RESOLVED" || t.status === "CLOSED";
    return true;
  });

  const stats = {
    total: myTickets.length,
    open: myTickets.filter(t => t.status === "OPEN").length,
    inProgress: myTickets.filter(t => t.status === "IN_PROGRESS").length,
    resolved: myTickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length,
  };

  const openCreate = (prefill?: typeof createPrefill) => {
    setCreatePrefill(prefill);
    setCreateOpen(true);
  };

  const loadMyAssets = useCallback(async () => {
    if (!user?.id) return;
    setAssetsLoading(true);
    try {
      const r = await fetch(`/api/assets/by-user?userId=${encodeURIComponent(user.id)}`, { credentials: "same-origin" });
      if (r.ok) { const d = await r.json(); setMyAssets(d.assets || []); }
      else { toast({ variant: "destructive", title: "Failed to load assets" }); }
    } catch { toast({ variant: "destructive", title: "Failed to load assets" }); }
    finally { setAssetsLoading(false); }
  }, [user?.id]);

  useEffect(() => { if (view === "my-assets") loadMyAssets(); }, [view, loadMyAssets]);

  return (
    <>
      <Head><title>Service Portal</title></Head>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <Toaster />

      <div className="min-h-screen bg-gray-50 dark:bg-background text-foreground transition-colors">
        {/* ── TOP NAV ── */}
        <nav className="sticky top-0 z-40 border-b border-slate-200 dark:border-border bg-white/95 dark:bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-card/80 shadow-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 shadow">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 dark:text-foreground">Service Portal</span>
                <span className="ml-2 hidden text-xs font-medium text-slate-400 dark:text-muted-foreground sm:inline">IT Support & Requests</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {view === "my-tickets" && (
                <button onClick={() => openCreate()}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
                  <Plus className="h-4 w-4" /> New Ticket
                </button>
              )}
              {canDash && (
                <button onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm font-semibold text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted transition-colors">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              )}
              <div className="rounded-lg border border-slate-200/80 dark:border-border bg-slate-50/80 dark:bg-muted/50 p-0.5">
                <ThemeToggle />
              </div>
              <div className="relative">
                <button
                  onClick={() => { setShowNotif(!showNotif); if (!showNotif) markRead(); }}
                  className="relative rounded-xl p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-muted hover:text-slate-700 dark:hover:text-foreground transition-colors">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {showNotif && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card shadow-xl" style={{ animation: "fadeUp .15s ease-out" }}>
                    <div className="flex items-center justify-between border-b dark:border-border px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-foreground">Notifications</p>
                      <button onClick={() => setShowNotif(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <Bell className="h-8 w-8 text-slate-200 dark:text-slate-600" />
                          <p className="text-sm text-slate-400 dark:text-muted-foreground">No notifications yet</p>
                        </div>
                      ) : notifications.slice(0, 10).map(n => (
                        <div key={n.id} className={`border-b border-slate-50 dark:border-border px-4 py-3 transition-colors ${!n.readAt ? "bg-blue-50/50 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-muted/50"}`}>
                          <div className="flex items-start gap-2.5">
                            {!n.readAt && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                            {n.readAt && <div className="mt-1.5 h-2 w-2 shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 dark:text-foreground">{n.title}</p>
                              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">{n.message}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{timeAgo(n.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-bold text-white shadow">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <button onClick={handleSignOut} className="rounded-xl p-2.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </nav>

        {/* ── VIEW TABS ── */}
        <div className="border-b border-slate-200 dark:border-border bg-white dark:bg-card/50">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex gap-0">
              {[
                { key: "portal",     label: "Service Catalog", icon: Zap },
                { key: "my-tickets", label: "My Tickets",      icon: Ticket },
                { key: "my-assets",  label: "My Assets",       icon: Package },
                { key: "approvals",  label: "Approval Requests", icon: Shield },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.key} onClick={() => setView(tab.key as any)}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${view === tab.key ? "border-slate-900 dark:border-primary text-slate-900 dark:text-foreground" : "border-transparent text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground"}`}>
                    <Icon className="h-4 w-4" />{tab.label}
                    {tab.key === "my-tickets" && myTickets.length > 0 && (
                      <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-foreground">{myTickets.length}</span>
                    )}
                    {tab.key === "my-tickets" && myTicketsWithUpdates > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
                        {myTicketsWithUpdates}
                      </span>
                    )}
                    {tab.key === "approvals" && dlmPending.length > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white animate-pulse">
                        {dlmPending.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="mx-auto max-w-7xl px-4 py-6">

          {/* ── SERVICE CATALOG VIEW ── */}
          {view === "portal" && (
            <div className="space-y-6">
              {/* Hero */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 text-white shadow-lg">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
                <div className="relative z-10">
                  <h1 className="text-3xl font-bold">How can we help you today?</h1>
                  <p className="mt-2 text-slate-300">Browse our service catalog or search for what you need</p>
                  <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm max-w-xl">
                    <Search className="h-5 w-5 text-white/50 shrink-0" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search for a service, request or issue…"
                      className="flex-1 bg-transparent text-white placeholder:text-white/50 focus:outline-none text-sm"
                    />
                    {search && <button onClick={() => setSearch("")} className="text-white/50 hover:text-white"><X className="h-4 w-4" /></button>}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-muted-foreground">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {Object.entries(TICKET_TYPES).map(([key, tc]) => {
                    const Icon = tc.icon;
                    return (
                      <button key={key} onClick={() => openCreate({ type: key })}
                        className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card p-5 text-center shadow-sm transition-all hover:border-slate-200 dark:hover:border-border hover:shadow-md active:scale-[0.98]">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tc.color} shadow-md group-hover:scale-105 transition-transform`}>
                          <Icon className="h-7 w-7 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-foreground">{tc.label}</span>
                      </button>
                    );
                  })}
                  {/* View My Assets quick tile */}
                  <button onClick={() => setView("my-assets")}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-5 text-center shadow-sm transition-all hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md active:scale-[0.98]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md group-hover:scale-105 transition-transform">
                      <Package className="h-7 w-7 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">View My Assets</span>
                  </button>
                </div>
              </div>

              {/* Category tabs */}
              <div>
                <div className="mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-border pb-1 overflow-x-auto">
                  {Object.entries(CATEGORIES).map(([key, cat]) => {
                    const Icon = cat.icon;
                    return (
                      <button key={key} onClick={() => setActiveCatTab(key)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${activeCatTab === key ? "border-slate-900 dark:border-primary text-slate-900 dark:text-foreground" : "border-transparent text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground"}`}>
                        <Icon className="h-4 w-4" />{cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Service item grid */}
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {(CATEGORIES[activeCatTab as keyof typeof CATEGORIES]?.items || [])
                    .filter(item => !search || item.label.toLowerCase().includes(search.toLowerCase()))
                    .map(item => {
                      const Icon = item.icon;
                      return (
                        <button key={item.key}
                          onClick={() => openCreate({ type: "ISSUE", category: activeCatTab, subcategory: item.key })}
                          className="group flex flex-col items-center gap-2.5 rounded-2xl bg-white dark:bg-card border border-slate-100 dark:border-border p-4 text-center shadow-sm transition-all hover:border-slate-200 dark:hover:border-border hover:shadow-md active:scale-[0.97]">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 dark:bg-slate-700 shadow-md group-hover:bg-slate-700 dark:group-hover:bg-slate-600 group-hover:scale-105 transition-all">
                            <Icon className="h-7 w-7 text-white" />
                          </div>
                          <span className="text-xs font-semibold leading-snug text-slate-700 dark:text-foreground">{item.label}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Assigned to me (staff) */}
              {isStaff && assignedTickets.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      <Zap className="h-4 w-4" /> Assigned to You ({assignedTickets.length})
                    </h2>
                    <button onClick={() => setView("my-tickets")} className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300">View all →</button>
                  </div>
                  <div className="space-y-2">
                    {loading ? [1,2].map(i => <Sk key={i} className="h-20 rounded-2xl" />) :
                      assignedTickets.slice(0, 3).map(t => (
                        <TicketRow key={t.id} t={t} onClick={() => setSelectedTicket(t)} assigned />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MY TICKETS VIEW ── */}
          {view === "my-tickets" && (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Total",       value: stats.total,      color: "from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800",   text: "text-slate-700 dark:text-foreground",   badge: "bg-slate-200 text-slate-700" },
                  { label: "Open",        value: stats.open,       color: "from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30",     text: "text-blue-700 dark:text-blue-300",    badge: "bg-blue-200 text-blue-700" },
                  { label: "In Progress", value: stats.inProgress, color: "from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/20",   text: "text-amber-700 dark:text-amber-300",   badge: "bg-amber-200 text-amber-700" },
                  { label: "Resolved",    value: stats.resolved,   color: "from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/20",text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-200 text-emerald-700" },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.color} border border-slate-100 dark:border-border p-4`}>
                    <p className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">{s.label}</p>
                    <p className={`mt-1 text-3xl font-black ${s.text}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Filters + search */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2 rounded-xl bg-slate-100 dark:bg-muted p-1">
                  {[
                    { key: "all",         label: "All" },
                    { key: "open",        label: "Open" },
                    { key: "in_progress", label: "In Progress" },
                    { key: "resolved",    label: "Resolved" },
                  ].map(f => (
                    <button key={f.key} onClick={() => setActiveFilter(f.key as any)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${activeFilter === f.key ? "bg-white dark:bg-card shadow text-slate-900 dark:text-foreground" : "text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search tickets…"
                      className="w-full sm:w-56 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:border-slate-400 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-primary/30 transition-colors" />
                  </div>
                  <button onClick={() => loadData(true)} disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm font-semibold text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted disabled:opacity-50 transition-colors" title="Refresh tickets">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openCreate()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-primary dark:text-primary-foreground px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-primary/90 transition-colors whitespace-nowrap">
                    <Plus className="h-4 w-4" /> New
                  </button>
                </div>
              </div>

              {/* Ticket list */}
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Sk key={i} className="h-24 rounded-2xl" />)}</div>
              ) : filteredMyTickets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-muted">
                    <Ticket className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-foreground">No tickets found</p>
                    <p className="mt-1 text-sm text-slate-400 dark:text-muted-foreground">Create your first ticket to get started</p>
                  </div>
                  <button onClick={() => openCreate()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-primary/90 transition-colors">
                    <Plus className="h-4 w-4" /> Create Ticket
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMyTickets.map(t => (
                    <TicketRow key={t.id} t={t} onClick={() => { setSelectedTicket(t); markTicketRead(t.id); }} assigned={t.assignedToId === user?.id && t.userId !== user?.id} unreadCount={ticketUnreads[t.id] || 0} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MY ASSETS VIEW ── */}
          {view === "my-assets" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-foreground">My Assets</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-muted-foreground">Assets currently assigned to you</p>
                </div>
                <button onClick={loadMyAssets} disabled={assetsLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted disabled:opacity-50 transition-colors">
                  {assetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Total",       value: myAssets.length,                                         from: "from-slate-50 dark:from-slate-900",   to: "to-slate-100 dark:to-slate-800",   text: "text-slate-700 dark:text-foreground" },
                  { label: "Active",      value: myAssets.filter(a => a.status === "ACTIVE").length,      from: "from-emerald-50 dark:from-emerald-950/40", to: "to-emerald-100 dark:to-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300" },
                  { label: "Maintenance", value: myAssets.filter(a => a.status === "MAINTENANCE").length, from: "from-amber-50 dark:from-amber-950/40",   to: "to-amber-100 dark:to-amber-900/20",   text: "text-amber-700 dark:text-amber-300" },
                  { label: "Inactive",    value: myAssets.filter(a => a.status === "INACTIVE").length,    from: "from-slate-50 dark:from-slate-900",   to: "to-slate-100 dark:to-slate-800",   text: "text-slate-500 dark:text-muted-foreground" },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.from} ${s.to} border border-slate-100 dark:border-border p-4`}>
                    <p className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">{s.label}</p>
                    <p className={`mt-1 text-3xl font-black ${s.text}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {assetsLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1,2,3,4,5,6].map(i => <Sk key={i} className="h-52 rounded-2xl" />)}
                </div>
              ) : myAssets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
                    <Package className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-foreground">No assets assigned to you</p>
                  <p className="text-sm text-slate-400 dark:text-muted-foreground">Contact your IT department to get assets assigned</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myAssets.map((asset: any) => {
                    const statusCfg: Record<string, { label: string; color: string; bg: string; dot: string }> = {
                      ACTIVE:      { label: "Active",      color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
                      INACTIVE:    { label: "Inactive",    color: "text-slate-500",   bg: "bg-slate-50 border-slate-200",     dot: "bg-slate-400" },
                      MAINTENANCE: { label: "Maintenance", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     dot: "bg-amber-500" },
                      DISPOSED:    { label: "Disposed",    color: "text-red-600",     bg: "bg-red-50 border-red-200",         dot: "bg-red-500" },
                    };
                    const sc = statusCfg[asset.status] ?? statusCfg.INACTIVE;
                    return (
                      <div key={asset.id} className="group flex flex-col rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all overflow-hidden">
                        {/* Image */}
                        <div className="relative h-36 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
                          {asset.imageUrl
                            ? <img src={asset.imageUrl} alt={asset.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : <div className="flex h-full items-center justify-center"><Package className="h-12 w-12 text-slate-200 dark:text-slate-600" /></div>
                          }
                          <span className={`absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${sc.color} ${sc.bg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} /> {sc.label}
                          </span>
                          {asset.type && (
                            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-card/90 border border-slate-200 dark:border-border px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-foreground">
                              <Tag className="h-2.5 w-2.5" /> {asset.type}
                            </span>
                          )}
                        </div>
                        {/* Details */}
                        <div className="flex flex-1 flex-col p-4 gap-3">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-foreground line-clamp-1">{asset.name}</p>
                            <p className="text-xs text-slate-400 dark:text-muted-foreground font-mono mt-0.5">{asset.assetId || asset.id?.slice(0, 8)}</p>
                          </div>
                          <div className="space-y-1.5 mt-auto">
                            {(asset.floorNumber || asset.roomNumber) && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                Floor {asset.floorNumber}{asset.roomNumber ? ` · Room ${asset.roomNumber}` : ""}
                              </div>
                            )}
                            {asset.assignedAt && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                Assigned {timeAgo(asset.assignedAt)}
                              </div>
                            )}
                            {asset.vendor?.name && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-muted-foreground">
                                <User className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{asset.vendor.name}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => openCreate({ type: "REQUEST", category: "ASSET_MANAGEMENT", subcategory: "Report Lost/Stolen" })}
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted hover:border-slate-300 transition-colors">
                            Report Issue with this Asset
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── DLM APPROVAL REQUESTS TAB ── */}
          {view === "approvals" && (
            <div className="space-y-6">
              {/* Header */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 p-6 shadow-xl">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Shield className="h-5 w-5 text-white" /></div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/70">DLM Approval Queue</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Approval Requests</h1>
                    <p className="mt-1 text-sm text-white/70">Review and action IT service requests from your direct reports</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-white/15 border border-white/20 px-4 py-2.5 text-center">
                      <p className="text-2xl font-black text-white">{dlmPending.length}</p>
                      <p className="text-[10px] text-white/70 font-semibold">Pending</p>
                    </div>
                    <button onClick={loadDlmPending} disabled={dlmLoading}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-white hover:bg-white/25 transition-colors disabled:opacity-50">
                      {dlmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">You are the Direct Line Manager (DLM) for these requests</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">IT requests from your direct reports require your approval before reaching the IT support team. Review each request carefully before approving or rejecting.</p>
                </div>
              </div>

              {/* Ticket cards */}
              {dlmLoading ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
                </div>
              ) : dlmPending.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p className="font-bold text-slate-700 dark:text-foreground">All caught up!</p>
                  <p className="text-sm text-slate-400 dark:text-muted-foreground">No pending approval requests from your direct reports</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {dlmPending.map((t: any) => {
                    const pc = { CRITICAL: { color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/50", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" }, HIGH: { color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/50", border: "border-orange-200 dark:border-orange-800", dot: "bg-orange-500" }, MEDIUM: { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" }, LOW: { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" } }[t.priority] || { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" };
                    const isDeciding = dlmDeciding === t.id;
                    const requester = t.user;
                    const timeAgoStr = (() => { const diff = Date.now() - new Date(t.createdAt).getTime(); const m = Math.floor(diff/60000); if (m<1) return "Just now"; if (m<60) return `${m}m ago`; const h=Math.floor(m/60); if (h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; })();

                    return (
                      <div key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg transition-all">
                        {/* Priority rail */}
                        <div className={`h-1 w-full ${pc.dot}`} />
                        <div className="p-5 space-y-4">
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="font-mono text-[10px] font-bold text-muted-foreground">{t.displayId || "#" + t.id.slice(0,8)}</span>
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pc.color} ${pc.bg} ${pc.border}`}><span className={`h-1.5 w-1.5 rounded-full ${pc.dot}`} />{t.priority}</span>
                                {t.category && <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.category.replace(/_/g," ")}</span>}
                                {t.subcategory && <span className="rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-300">{t.subcategory}</span>}
                              </div>
                              <h3 className="font-bold text-foreground line-clamp-2">{t.title}</h3>
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">{timeAgoStr}</span>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/40 rounded-xl px-3 py-2">{t.description}</p>

                          {/* Requester info */}
                          <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border p-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-bold text-white shrink-0">
                              {(requester?.displayName || requester?.email || "U")[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{requester?.displayName || requester?.email?.split("@")[0] || "Unknown"}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{requester?.email}</p>
                              {requester?.jobTitle && <p className="text-[10px] text-muted-foreground truncate">{requester.jobTitle}{requester?.department ? ` · ${requester.department}` : ""}</p>}
                            </div>
                            <div className="ml-auto text-right shrink-0">
                              <p className="text-[10px] text-muted-foreground">Department</p>
                              <p className="text-xs font-semibold">{requester?.department || "—"}</p>
                            </div>
                          </div>

                          {/* Comment box */}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Your comment (optional for approval, required for rejection)</label>
                            <textarea rows={2}
                              value={dlmComment[t.id] || ""}
                              onChange={e => setDlmComment(prev => ({ ...prev, [t.id]: e.target.value }))}
                              placeholder="Add a note or reason…"
                              className="w-full resize-none rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400" />
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDlmDecide(t.id, "approve")} disabled={isDeciding}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all hover:shadow-md">
                              {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              Approve
                            </button>
                            <button onClick={() => handleDlmDecide(t.id, "reject")} disabled={isDeciding || !dlmComment[t.id]?.trim()}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 disabled:opacity-40 transition-all">
                              {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                              Reject
                            </button>
                          </div>
                          <p className="text-[10px] text-center text-muted-foreground">A comment is required to reject a request.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Dialogs */}
      {selectedTicket && <TicketDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onRefresh={loadData} />}
      {createOpen && <CreateTicketDialog prefill={createPrefill} onClose={() => { setCreateOpen(false); setCreatePrefill(undefined); }} onSuccess={loadData} />}
    </>
  );
}
