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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  ClipboardList, AlertTriangle, CheckCircle2, Package, Search, RefreshCw,
  Filter, Eye, TicketIcon, Calendar, Clock, MapPin, User, ChevronDown,
  ChevronUp, Loader2, ShieldAlert, ShieldCheck, FileText, PlusCircle,
  Info, BarChart3, Zap, AlertCircle, ArrowRight, Hash, ScanLine,
  X, Download, Brain, TrendingUp, TrendingDown, Star, Activity,
  Building2, Users, Award, Lightbulb, Target, CheckSquare, XCircle,
  Printer, CheckCheck, Archive, LayoutList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface ReportDetails {
  floorNumber?: string; roomNumber?: string;
  sessionStartTime?: string; sessionDurationMs?: number;
  totalScanned: number; totalInSystem: number;
  missingCount: number; extraCount: number;
  wrongLocationCount: number; rosterNotReadCount?: number;
  reasonCode?: string; note?: string;
  missingItems?: AssetItem[]; wrongLocationItems?: AssetItem[];
  correctInRoomItems?: AssetItem[]; extraItems?: AssetItem[];
  submittedByName?: string; submittedByEmail?: string; submittedAt?: string;
}
interface AssetItem { id?: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string; source?: string; }
interface LinkedTicket {
  id: string;
  displayId: string | null;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt?: string;
  _count?: { history?: number };
}
interface Report {
  id: string; timestamp: string; userId?: string; severity: "INFO"|"WARNING"|"ERROR";
  details: ReportDetails|null;
  submitter?: { id?: string; name?: string; email?: string; role?: string; imageUrl?: string; }|null;
  linkedTickets: LinkedTicket[];
  verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  completedBy?: string;
}
interface StaffUser { id: string; name?: string; email: string; role?: string; }
interface StaffPerf {
  staffUser: { name?: string; email?: string; role?: string };
  userId: string;
  totalScans: number; totalScanned: number; totalInSystem: number;
  totalMissing: number; totalExtra: number; totalWrongLocation: number;
  avgCoverage: number; avgMissingPerScan: number; avgDurationMs: number; alertCount: number;
  locationBreakdown: { location: string; scans: number; missing: number; scanned: number; inSystem: number; coveragePct: number }[];
  topMissingItems: { name: string; barcode: string; count: number }[];
  timeline: { date: string; missing: number; scanned: number; coverage: number }[];
  insights: string[];
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDateShort = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDuration = (ms?: number) => { if (!ms) return '—'; const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60); if(h>0)return`${h}h ${m%60}m`; if(m>0)return`${m}m ${s%60}s`; return`${s}s`; };
const initials = (name?: string, email?: string) => (name||email||'?').split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2);
const pct = (a: number, b: number) => b > 0 ? Math.round((a/b)*100) : 0;

function getSevConfig(s: string) {
  if (s==='WARNING') return { stripe:'from-amber-400 to-orange-400', card:'border-amber-200 dark:border-amber-800/60', badge:'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800', dot:'bg-amber-400', Icon:AlertTriangle, iconCol:'text-amber-500 dark:text-amber-400' };
  if (s==='ERROR')   return { stripe:'from-red-400 to-rose-400', card:'border-red-200 dark:border-red-900/50', badge:'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900', dot:'bg-red-500', Icon:XCircle, iconCol:'text-red-500 dark:text-red-400' };
  return { stripe:'from-emerald-400 to-teal-400', card:'border-slate-100 dark:border-slate-700', badge:'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800', dot:'bg-emerald-400', Icon:CheckCircle2, iconCol:'text-emerald-500 dark:text-emerald-400' };
}
function statusCls(s: string) {
  if (s==='OPEN') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
  if (s==='IN_PROGRESS') return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
  if (s==='RESOLVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
}
function prioCls(p: string) {
  if (p==='CRITICAL') return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'; if (p==='HIGH') return 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300';
  if (p==='MEDIUM') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'; return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}
const coverageColor = (c: number) => c>=90 ? 'text-emerald-600 dark:text-emerald-400' : c>=70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
const coverageBarColor = (c: number) => c>=90 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : c>=70 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-rose-500';

function downloadPdf(url: string) {
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.click();
}

/* ── Asset List Modal ──────────────────────────────────────────────────── */
function AssetListModal({ open, onClose, report }: { open: boolean; onClose: ()=>void; report: Report|null }) {
  const [tab, setTab] = useState<'available'|'missing'|'wrong'|'extra'>('available');
  const [search, setSearch] = useState('');
  const d = report?.details;
  const tabs = [
    { key:'available', label:'Available',     items:d?.correctInRoomItems||[], color:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-200', Icon:CheckCircle2 },
    { key:'missing',   label:'Missing',       items:d?.missingItems||[],       color:'text-red-600',     bg:'bg-red-50',     border:'border-red-200',     Icon:AlertTriangle },
    { key:'wrong',     label:'Wrong Location',items:d?.wrongLocationItems||[], color:'text-amber-600',   bg:'bg-amber-50',   border:'border-amber-200',   Icon:MapPin },
    { key:'extra',     label:'Extra/Unknown', items:d?.extraItems||[],          color:'text-blue-600',    bg:'bg-blue-50',    border:'border-blue-200',    Icon:Info },
  ] as const;
  const active = tabs.find(t=>t.key===tab)!;
  const filtered = active.items.filter((item: AssetItem) => !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.barcode?.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border bg-card">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-white/20 rounded-xl"><ScanLine className="h-5 w-5"/></div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">Asset Inventory Detail</DialogTitle>
              <p className="text-indigo-200 text-sm">{d?.floorNumber||d?.roomNumber ? `Floor ${d?.floorNumber||'?'} · Room ${d?.roomNumber||'?'}` : 'All locations'} · {fmtDate(d?.submittedAt||report?.timestamp)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {tabs.map(t => <div key={t.key} className="bg-white/15 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/60"/>{t.items.length} {t.label}</div>)}
          </div>
        </div>
        <div className="flex border-b border-slate-100 dark:border-slate-800 flex-shrink-0 bg-background">
          {tabs.map(t => { const Icon=t.Icon; const isActive=tab===t.key; return (
            <button key={t.key} onClick={() => { setTab(t.key as any); setSearch(''); }}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-all',
                isActive ? `border-indigo-600 dark:border-indigo-400 ${t.color}` : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')}>
              <Icon className="h-4 w-4"/>
              <span className="hidden sm:block">{t.label}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold', isActive ? `${t.bg} dark:bg-opacity-20 ${t.color}` : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}>{t.items.length}</span>
            </button>
          );})}
        </div>
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
            <Input placeholder="Search name or barcode…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 bg-slate-50/50 dark:bg-slate-950/50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-slate-400 dark:text-slate-500"><Package className="h-10 w-10 mb-2 opacity-30"/><p className="font-medium text-sm">{search ? 'No matches' : 'No items here'}</p></div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item: AssetItem, i: number) => (
                <motion.div key={item.id||item.barcode||i} initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.015}}
                  className={cn('flex items-center gap-3 p-3 rounded-xl border bg-card shadow-sm dark:border-slate-700', active.border)}>
                  <div className={cn('p-2 rounded-lg flex-shrink-0 dark:bg-opacity-30', active.bg)}><Package className={cn('h-4 w-4', active.color)}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{item.name||'Unnamed'}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {item.barcode && <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{item.barcode}</span>}
                      {(item.floorNumber||item.roomNumber) && <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3"/>{[item.floorNumber,item.roomNumber].filter(Boolean).join('·')}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-xs border flex-shrink-0', active.border, active.color)}>{active.label}</Badge>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="px-4 py-3 bg-background border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Create Ticket Modal ───────────────────────────────────────────────── */
function CreateTicketModal({ open, onClose, report, staffUsers, onCreated }: {
  open: boolean; onClose: ()=>void; report: Report|null; staffUsers: StaffUser[]; onCreated: (t: LinkedTicket)=>void;
}) {
  const d = report?.details;
  const locationStr = [d?.floorNumber&&`Floor ${d.floorNumber}`, d?.roomNumber&&`Room ${d.roomNumber}`].filter(Boolean).join(', ')||'Unknown location';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('HIGH');
  const [assignedToId, setAssignedToId] = useState('__none__');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !report) return;
    setTitle(`Inventory Discrepancy — ${locationStr}`);
    setDescription([
      `**Inventory Reconciliation Report**`,`Report ID: ${report.id}`,
      `Submitted by: ${d?.submittedByName||d?.submittedByEmail||report.submitter?.name||report.submitter?.email||'Staff'}`,
      `Date: ${fmtDate(d?.submittedAt||report.timestamp)}`,`Location: ${locationStr}`,``,
      `**Scan Summary**`,`• Total scanned: ${d?.totalScanned??0}`,`• Expected in system: ${d?.totalInSystem??0}`,
      `• Missing: ${d?.missingCount??0}`,`• Extra/Unknown: ${d?.extraCount??0}`,`• Wrong location: ${d?.wrongLocationCount??0}`,
      d?.reasonCode?`• Reason code: ${d.reasonCode}`:'',d?.note?`\n**Staff Note:**\n${d.note}`:'',
      `\n_Audit log ref: ${report.id}_`,
    ].filter(l=>l!==undefined).join('\n').trim());
    setPriority('HIGH'); setAssignedToId('__none__');
  }, [open, report?.id]);

  const handleSubmit = async () => {
    if (!title.trim()||!description.trim()) { toast({title:'Required fields missing',variant:'destructive'}); return; }
    setSubmitting(true);
    try {
      const body: any = {
        title: title.trim(),
        description: description.trim(),
        priority,
        source: 'INTERNAL',
        ticketType: 'MANAGEMENT',
        category: 'INVENTORY',
        ...(report?.id ? { inventoryAuditLogId: report.id } : {}),
      };
      if (assignedToId && assignedToId!=='__none__') body.assignedToId = assignedToId;
      const res = await fetch('/api/tickets',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ticket = data.ticket||data;
      toast({title:'Ticket created',description:`${ticket.displayId||'Ticket'} has been created.`});
      onCreated({
        id: ticket.id,
        displayId: ticket.displayId || null,
        title: ticket.title,
        status: ticket.status || 'OPEN',
        priority: ticket.priority || priority,
        createdAt: ticket.createdAt || new Date().toISOString(),
        updatedAt: ticket.updatedAt || ticket.createdAt || new Date().toISOString(),
        _count: { history: 0 },
      });
      onClose();
    } catch(e: any) { toast({title:'Failed',description:e.message,variant:'destructive'}); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 border-border bg-card">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl"><TicketIcon className="h-5 w-5"/></div>
            <div><DialogTitle className="text-xl font-bold text-white">Create Ticket from Report</DialogTitle><p className="text-indigo-200 text-sm mt-0.5">Raise an action ticket for this inventory discrepancy</p></div>
          </div>
          {d && <div className="flex flex-wrap gap-2 mt-4">
            <div className="bg-white/15 rounded-full px-3 py-1 text-xs flex items-center gap-1.5"><ScanLine className="h-3 w-3"/> {d.totalScanned} scanned</div>
            <div className="bg-red-300/30 rounded-full px-3 py-1 text-xs flex items-center gap-1.5"><AlertTriangle className="h-3 w-3"/> {d.missingCount} missing</div>
            <div className="bg-white/15 rounded-full px-3 py-1 text-xs flex items-center gap-1.5"><MapPin className="h-3 w-3"/> {locationStr}</div>
          </div>}
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ticket Title *</label>
            <Input value={title} onChange={e=>setTitle(e.target.value)} className="h-10"/>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Description *</label>
            <Textarea value={description} onChange={e=>setDescription(e.target.value)} rows={9} className="text-sm font-mono resize-none"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Assign To</label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger><SelectValue placeholder="— Unassigned —"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {staffUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name||u.email} {u.role?`(${u.role})`:''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6 gap-3">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <TicketIcon className="h-4 w-4 mr-2"/>}
            {submitting ? 'Creating…' : 'Create Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Staff Performance Dialog ──────────────────────────────────────────── */
function StaffPerformanceDialog({ open, onClose, userId, staffName, staffEmail }: {
  open: boolean; onClose: ()=>void; userId?: string; staffName?: string; staffEmail?: string;
}) {
  const [data, setData] = useState<StaffPerf|null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setData(null); setLoading(true);
    fetch(`/api/audit/staff-performance?userId=${encodeURIComponent(userId)}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => setData(d))
      .catch(() => toast({ title:'Failed to load performance data', variant:'destructive' }))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const downloadStaffPdf = async () => {
    setPdfLoading(true);
    try { downloadPdf(`/api/audit/staff-performance?userId=${encodeURIComponent(userId!)}&pdf=1`); }
    finally { setTimeout(() => setPdfLoading(false), 2000); }
  };

  const perf = data;
  const rateColor = (v: number, good: number, bad: number) => v <= good ? 'text-emerald-600' : v <= bad ? 'text-amber-600' : 'text-red-600';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border bg-card">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 p-6 text-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-4 border-white/30 shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-indigo-300 to-purple-500 text-white text-xl font-bold">
                  {initials(staffName, staffEmail)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DialogTitle className="text-xl font-bold text-white">{staffName||staffEmail||'Staff Member'}</DialogTitle>
                  {perf?.staffUser?.role && <Badge className="bg-white/20 text-white border-white/20 text-xs">{perf.staffUser.role}</Badge>}
                </div>
                <p className="text-indigo-200 text-sm">{staffEmail}</p>
                <p className="text-indigo-300 text-xs mt-0.5">Inventory Performance Analysis</p>
              </div>
            </div>
            <Button size="sm" onClick={downloadStaffPdf} disabled={pdfLoading||loading}
              className="bg-white/15 hover:bg-white/25 text-white border-white/20 gap-2 flex-shrink-0">
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
              PDF Report
            </Button>
          </div>

          {/* KPI row */}
          {perf && (
            <div className="grid grid-cols-5 gap-2 mt-5">
              {[
                { label:'Total Scans', value:perf.totalScans, icon:ScanLine },
                { label:'Total Missing', value:perf.totalMissing, icon:AlertTriangle },
                { label:'Avg Coverage', value:`${perf.avgCoverage}%`, icon:Target },
                { label:'Avg Missing/Scan', value:perf.avgMissingPerScan, icon:TrendingDown },
                { label:'Alert Sessions', value:perf.alertCount, icon:ShieldAlert },
              ].map(k => { const Icon=k.icon; return (
                <div key={k.label} className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
                  <Icon className="h-4 w-4 mx-auto mb-1 text-indigo-200"/>
                  <p className="text-xl font-extrabold text-white">{k.value}</p>
                  <p className="text-xs text-indigo-300 leading-tight">{k.label}</p>
                </div>
              );})}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-500 animate-spin mb-4"/>
              <p className="font-medium">Analysing performance data…</p>
            </div>
          ) : !perf ? null : (
            <div className="p-5 space-y-6">

              {/* AI Insights */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950 rounded-lg"><Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400"/></div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">AI Performance Insights</h3>
                  <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs">AI Generated</Badge>
                </div>
                <div className="space-y-2">
                  {perf.insights.map((ins, i) => (
                    <motion.div key={i} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                      className="flex gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i+1}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{ins}</p>
                    </motion.div>
                  ))}
                  {perf.insights.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No insights yet — more scan data needed.</p>}
                </div>
              </section>

              {/* Coverage bar */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Average Scan Coverage</span>
                  <span className={cn('text-2xl font-extrabold', coverageColor(perf.avgCoverage))}>{perf.avgCoverage}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div initial={{width:0}} animate={{width:`${Math.min(100,perf.avgCoverage)}%`}} transition={{duration:1.2,ease:'easeOut'}}
                    className={cn('h-full rounded-full', coverageBarColor(perf.avgCoverage))}/>
                </div>
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  <span>0%</span><span className="text-amber-500 dark:text-amber-400">≥70% Good</span><span className="text-emerald-500 dark:text-emerald-400">≥90% Excellent</span><span>100%</span>
                </div>
              </section>

              {/* Timeline */}
              {perf.timeline.length > 0 && (
                <section>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-500 dark:text-indigo-400"/> Recent Scan History</h3>
                  <div className="space-y-2">
                    {perf.timeline.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="text-xs text-slate-400 dark:text-slate-500 w-24 flex-shrink-0">{t.date}</div>
                        <div className="flex-1">
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', coverageBarColor(t.coverage))} style={{width:`${Math.min(100,t.coverage)}%`}}/>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-shrink-0">
                          <span className="text-indigo-600 font-medium">{t.scanned} scanned</span>
                          {t.missing > 0 ? <span className="text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> {t.missing} missing</span>
                            : <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> Clear</span>}
                          <span className={cn('font-bold', coverageColor(t.coverage))}>{t.coverage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Location breakdown */}
              {perf.locationBreakdown.length > 0 && (
                <section>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500 dark:text-indigo-400"/> Location Breakdown</h3>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Location</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Scans</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Scanned</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">In System</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Missing</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perf.locationBreakdown.slice(0,15).map((loc, i) => (
                          <tr key={i} className={cn('border-b border-slate-50 dark:border-slate-800', loc.missing > 5 ? 'bg-red-50/50 dark:bg-red-950/20' : i%2===0?'bg-white dark:bg-slate-900':'bg-slate-50/30 dark:bg-slate-950/50')}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {loc.missing > 5 && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0"/>}
                                <span className="font-medium text-slate-700 dark:text-slate-200">{loc.location}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{loc.scans}</td>
                            <td className="px-3 py-2.5 text-center text-indigo-600 dark:text-indigo-400 font-medium">{loc.scanned}</td>
                            <td className="px-3 py-2.5 text-center text-slate-500 dark:text-slate-400">{loc.inSystem}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn('font-bold', loc.missing>0?'text-red-600':'text-emerald-600')}>{loc.missing}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn('font-bold text-xs', coverageColor(loc.coveragePct))}>{loc.coveragePct}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Top missing items */}
              {perf.topMissingItems.length > 0 && (
                <section>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500"/> Frequently Missing Assets</h3>
                  <div className="space-y-2">
                    {perf.topMissingItems.map((item, i) => (
                      <div key={i} className={cn('flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-slate-900',
                        item.count>=3?'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/30':item.count>=2?'border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/30':'border-slate-100 dark:border-slate-800')}>
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                          item.count>=3?'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400':item.count>=2?'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400':'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300')}>
                          {i+1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{item.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{item.barcode}</p>
                        </div>
                        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold flex-shrink-0',
                          item.count>=3?'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400':item.count>=2?'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400':'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300')}>
                          <AlertTriangle className="h-3.5 w-3.5"/>
                          {item.count}×
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3.5 bg-background border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <Button variant="outline" onClick={onClose} size="sm">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Report Card ───────────────────────────────────────────────────────── */
function ReportCard({ report, onViewAssets, onCreateTicket, onDownloadPdf, onViewStaff, onComplete, onReopen }: {
  report: Report; onViewAssets: (r: Report)=>void; onCreateTicket: (r: Report)=>void;
  onDownloadPdf: (id: string)=>void; onViewStaff: (r: Report)=>void;
  onComplete?: (r: Report)=>void; onReopen?: (r: Report)=>void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const isCompleted = !!report.verified;
  const d = report.details || {} as ReportDetails;
  const sev = getSevConfig(report.severity);
  const SevIcon = sev.Icon;
  const location = [d.floorNumber&&`Floor ${d.floorNumber}`, d.roomNumber&&`Room ${d.roomNumber}`].filter(Boolean).join(' · ')||'All locations';
  const covPct = pct(d.totalScanned, d.totalInSystem);
  // User model has no `name` field — email is the identifier; fall through all sources
  const staffName = report.submitter?.email || report.submitter?.name || d.submittedByEmail || d.submittedByName || (report as any).userEmail || 'Unknown Staff';
  const staffEmail = report.submitter?.email || d.submittedByEmail || '';

  const handlePdf = async () => {
    setPdfLoading(true);
    try { downloadPdf(`/api/audit/report-pdf?id=${report.id}`); }
    finally { setTimeout(()=>setPdfLoading(false), 2000); }
  };

  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.3}}
      className={cn('rounded-2xl border-2 bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden',
        isCompleted ? 'border-emerald-200 dark:border-emerald-800/60' : sev.card)}>
      <div className={cn('h-1 w-full bg-gradient-to-r', isCompleted ? 'from-emerald-400 to-teal-500' : sev.stripe)}/>
      {isCompleted && (
        <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900 flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0"/>
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Report Completed</span>
          {report.verifiedAt && <span className="text-xs text-emerald-500 dark:text-emerald-500 ml-1">· {fmtDate(report.verifiedAt)}</span>}
          {report.completedBy && <span className="text-xs text-emerald-500 dark:text-emerald-500">· by {report.completedBy}</span>}
        </div>
      )}
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0 cursor-pointer group" onClick={()=>onViewStaff(report)}>
            <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-700 shadow-sm ring-2 ring-transparent group-hover:ring-indigo-300 transition-all">
              <AvatarImage src={report.submitter?.imageUrl}/>
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold">
                {initials(report.submitter?.name, staffEmail)}
              </AvatarFallback>
            </Avatar>
            <span className={cn('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800', isCompleted ? 'bg-emerald-400' : sev.dot)}/>
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/5 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <User className="h-3.5 w-3.5 text-indigo-600"/>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={()=>onViewStaff(report)}
                className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors text-left leading-tight underline-offset-2 hover:underline">
                {staffName}
              </button>
              {report.submitter?.role && <Badge variant="outline" className="text-xs font-medium text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300">{report.submitter.role}</Badge>}
              <Badge variant="outline" className={cn('text-xs font-semibold border', isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : sev.badge)}>
                {isCompleted ? <CheckCheck className="h-3 w-3 mr-1 text-emerald-500"/> : <SevIcon className={cn('h-3 w-3 mr-1', sev.iconCol)}/>}
                {isCompleted ? 'COMPLETED' : report.severity}
              </Badge>
            </div>
            {staffEmail && staffEmail !== staffName && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{staffEmail}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{location}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{fmtDuration(d.sessionDurationMs)}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3"/>{fmtDate(d.submittedAt||report.timestamp)}</span>
            </div>
          </div>
          <button onClick={()=>setExpanded(v=>!v)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors flex-shrink-0">
            {expanded ? <ChevronUp className="h-5 w-5"/> : <ChevronDown className="h-5 w-5"/>}
          </button>
        </div>

        {/* Stat tiles */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label:'Scanned', value:d.totalScanned, Icon:ScanLine, col:'text-indigo-600 dark:text-indigo-400', bg:'bg-indigo-50 dark:bg-indigo-950/40' },
            { label:'In System', value:d.totalInSystem, Icon:Package, col:'text-slate-600 dark:text-slate-300', bg:'bg-slate-100 dark:bg-slate-800/80' },
            { label:'Missing', value:d.missingCount, Icon:AlertTriangle, col:d.missingCount>0?'text-red-600 dark:text-red-400':'text-slate-400', bg:d.missingCount>0?'bg-red-50 dark:bg-red-950/30':'bg-slate-50 dark:bg-slate-900/50' },
            { label:'Wrong Loc.', value:d.wrongLocationCount, Icon:MapPin, col:d.wrongLocationCount>0?'text-amber-600 dark:text-amber-400':'text-slate-400', bg:d.wrongLocationCount>0?'bg-amber-50 dark:bg-amber-950/30':'bg-slate-50 dark:bg-slate-900/50' },
          ].map(s => { const Icon=s.Icon; return (
            <div key={s.label} className={cn('rounded-xl p-3 flex items-center gap-2.5', s.bg)}>
              <Icon className={cn('h-4 w-4 flex-shrink-0', s.col)}/>
              <div><p className={cn('text-xl font-extrabold leading-none', s.col)}>{s.value}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p></div>
            </div>
          );})}
        </div>

        {/* Coverage bar */}
        {d.totalInSystem > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>Scan coverage</span>
              <span className={cn('font-bold', coverageColor(covPct))}>{covPct}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div initial={{width:0}} animate={{width:`${Math.min(100,covPct)}%`}} transition={{duration:1,ease:'easeOut'}}
                className={cn('h-full rounded-full', coverageBarColor(covPct))}/>
            </div>
          </div>
        )}

        {/* Expanded */}
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.2}} className="overflow-hidden">
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                {(d.reasonCode||d.note) && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3.5 space-y-2">
                    {d.reasonCode && <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-amber-500"/><span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Reason Code:</span><Badge variant="outline" className="text-xs border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">{d.reasonCode}</Badge></div>}
                    {d.note && <p className="text-sm text-slate-700 dark:text-slate-200 italic bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-900">"{d.note}"</p>}
                  </div>
                )}
                {(d.extraCount > 0 || (d.rosterNotReadCount||0) > 0) && (
                  <div className="flex gap-2">
                    {d.extraCount > 0 && <div className="flex-1 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-3 text-center"><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{d.extraCount}</p><p className="text-xs text-blue-500 dark:text-blue-400">Extra/Unknown</p></div>}
                    {(d.rosterNotReadCount||0) > 0 && <div className="flex-1 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 p-3 text-center"><p className="text-xl font-bold text-purple-600 dark:text-purple-400">{d.rosterNotReadCount}</p><p className="text-xs text-purple-500 dark:text-purple-400">Not Read</p></div>}
                  </div>
                )}
                {report.linkedTickets.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><TicketIcon className="h-3.5 w-3.5"/> Linked tickets ({report.linkedTickets.length})</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">All tickets raised for this inventory report. You get in-app notifications when a linked ticket is updated (if you submitted the report or own the ticket).</p>
                    <div className="space-y-1.5">
                      {report.linkedTickets.map(t => {
                        const hasActivity =
                          (t._count?.history ?? 0) > 0 ||
                          Boolean(
                            t.updatedAt &&
                              t.createdAt &&
                              new Date(t.updatedAt).getTime() > new Date(t.createdAt).getTime() + 60_000,
                          );
                        return (
                        <a key={t.id} href={`/tickets/${t.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-card hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 transition-all group">
                          <TicketIcon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{t.title}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{t.displayId||t.id.slice(0,8)}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Updated {fmtDate(t.updatedAt || t.createdAt)}
                              {(t._count?.history ?? 0) > 0 && (
                                <span className="ml-1.5">· {(t._count?.history ?? 0)} timeline entr{(t._count?.history ?? 0) === 1 ? 'y' : 'ies'}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {hasActivity && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border-amber-200 dark:border-amber-800">Activity</Badge>
                            )}
                            <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={cn('text-xs border', statusCls(t.status))}>{t.status.replace('_',' ')}</Badge>
                            <Badge className={cn('text-xs', prioCls(t.priority))}>{t.priority}</Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors"/>
                            </div>
                          </div>
                        </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action row */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/40" onClick={()=>onViewAssets(report)}>
            <Eye className="h-3.5 w-3.5"/> View Assets
          </Button>
          {!isCompleted && (
            <Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm" onClick={()=>onCreateTicket(report)}>
              <TicketIcon className="h-3.5 w-3.5"/> Create Ticket
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={handlePdf} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Download className="h-3.5 w-3.5"/>}
            PDF
          </Button>
          {!isCompleted && onComplete && (
            <Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm ml-auto" onClick={()=>onComplete(report)}>
              <CheckCheck className="h-3.5 w-3.5"/> Report Complete
            </Button>
          )}
          {isCompleted && onReopen && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40 ml-auto" onClick={()=>onReopen(report)}>
              <Archive className="h-3.5 w-3.5"/> Reopen
            </Button>
          )}
          {!expanded && report.linkedTickets.length > 0 && !onComplete && (
            <button onClick={()=>setExpanded(true)} className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 ml-auto transition-colors">
              <TicketIcon className="h-3 w-3"/> {report.linkedTickets.length} ticket{report.linkedTickets.length!==1?'s':''}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Confirm Complete Dialog ───────────────────────────────────────────── */
function ConfirmCompleteDialog({ open, onClose, report, onConfirm, loading: busy }: {
  open: boolean; onClose: ()=>void; report: Report|null; onConfirm: ()=>void; loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-card p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl"><CheckCheck className="h-5 w-5"/></div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">Mark Report Complete</DialogTitle>
              <DialogDescription className="text-emerald-100 text-sm mt-0.5">This action moves the report to the Completed tab.</DialogDescription>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Are you sure you want to mark this inventory report as <strong>complete</strong>? Management has reviewed and approved the findings.
          </p>
          {report && (
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Report Summary</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{[report.details?.floorNumber&&`Floor ${report.details.floorNumber}`, report.details?.roomNumber&&`Room ${report.details.roomNumber}`].filter(Boolean).join(' · ')||'All locations'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(report.details?.submittedAt||report.timestamp)} · {report.details?.missingCount||0} missing items</p>
            </div>
          )}
        </div>
        <DialogFooter className="px-6 pb-6 gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy} className="flex-1">Cancel</Button>
          <Button onClick={onConfirm} disabled={busy} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <CheckCheck className="h-4 w-4 mr-2"/>}
            {busy ? 'Completing…' : 'Yes, Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Print Report Dialog ───────────────────────────────────────────────── */
function PrintReportDialog({ open, onClose, reports, completedCount, totalCount }: {
  open: boolean; onClose: ()=>void; reports: Report[]; completedCount: number; totalCount: number;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [printMode, setPrintMode] = useState<'all'|'active'|'completed'>('all');

  const filtered = printMode === 'all' ? reports : printMode === 'completed' ? reports.filter(r=>r.verified) : reports.filter(r=>!r.verified);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) return;
    const style = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        body { background: white; color: #1e293b; padding: 32px; }
        .page-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 3px solid #4f46e5; margin-bottom: 28px; }
        .page-header h1 { font-size: 26px; font-weight: 800; color: #1e293b; }
        .page-header p { font-size: 13px; color: #64748b; margin-top: 4px; }
        .logo-badge { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 10px 18px; border-radius: 12px; font-weight: 700; font-size: 15px; }
        .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
        .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center; }
        .stat-card .val { font-size: 24px; font-weight: 800; color: #1e293b; }
        .stat-card .lbl { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .report-card { border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
        .report-header { padding: 16px 18px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-bottom: 1px solid #e2e8f0; display: flex; align-items: flex-start; justify-content: space-between; }
        .report-title { font-size: 15px; font-weight: 700; color: #1e293b; }
        .report-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
        .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid; }
        .badge-info { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
        .badge-warning { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .badge-error { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .badge-complete { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
        .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 14px 18px; }
        .stat-cell { text-align: center; background: white; border: 1px solid #f1f5f9; border-radius: 8px; padding: 10px 6px; }
        .stat-cell .val { font-size: 20px; font-weight: 800; }
        .stat-cell .lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .tickets-section { padding: 12px 18px; background: #fafafa; border-top: 1px solid #f1f5f9; }
        .tickets-title { font-size: 11px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .ticket-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 6px; }
        .ticket-title { font-size: 13px; font-weight: 600; color: #1e293b; flex: 1; }
        .ticket-id { font-size: 11px; color: #94a3b8; }
        .note-section { padding: 10px 18px 14px; }
        .note-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #78350f; font-style: italic; }
        .completed-banner { background: #d1fae5; padding: 8px 18px; font-size: 12px; color: #065f46; font-weight: 600; border-bottom: 1px solid #a7f3d0; }
        .page-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
        @media print { .report-card { page-break-inside: avoid; } body { padding: 16px; } }
      </style>
    `;
    const now = new Date().toLocaleString();
    const allMissing = filtered.reduce((s,r)=>s+(r.details?.missingCount||0),0);
    const allScanned = filtered.reduce((s,r)=>s+(r.details?.totalScanned||0),0);
    const allTickets = filtered.reduce((s,r)=>s+r.linkedTickets.length,0);
    const alerts = filtered.filter(r=>r.severity!=='INFO').length;
    const completed = filtered.filter(r=>r.verified).length;

    const reportHTML = filtered.map(r => {
      const d = r.details || {};
      const name = r.submitter?.email || r.submitter?.name || d.submittedByEmail || d.submittedByName || 'Unknown Staff';
      const loc = [d.floorNumber&&`Floor ${d.floorNumber}`, d.roomNumber&&`Room ${d.roomNumber}`].filter(Boolean).join(' · ')||'All locations';
      const covPct = d.totalInSystem > 0 ? Math.round((d.totalScanned/d.totalInSystem)*100) : 0;
      const sev = r.severity;
      const sevClass = sev==='WARNING'?'badge-warning':sev==='ERROR'?'badge-error':'badge-info';
      const tickets = r.linkedTickets.map(t =>
        `<div class="ticket-row">
          <div class="ticket-title">${t.title}</div>
          <span class="ticket-id">${t.displayId||t.id.slice(0,8)}</span>
          <span class="badge ${t.status==='RESOLVED'?'badge-info':'badge-warning'}" style="font-size:10px;">${t.status.replace('_',' ')}</span>
          <span style="font-size:10px;color:#94a3b8;">${t.priority}</span>
        </div>`
      ).join('');
      return `
        <div class="report-card">
          ${r.verified ? `<div class="completed-banner">✓ COMPLETED · ${r.verifiedAt ? new Date(r.verifiedAt).toLocaleString() : ''} ${r.completedBy ? `· by ${r.completedBy}` : ''}</div>` : ''}
          <div class="report-header">
            <div>
              <div class="report-title">${name}</div>
              <div class="report-meta">${loc} · ${new Date(d.submittedAt||r.timestamp).toLocaleString()} · ${d.sessionDurationMs ? Math.round(d.sessionDurationMs/60000)+'m session' : ''}</div>
            </div>
            <div style="display:flex;gap:8px;flex-direction:column;align-items:flex-end;">
              <span class="badge ${sevClass}">${sev}</span>
              <span style="font-size:11px;color:#64748b;">Coverage: <strong>${covPct}%</strong></span>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat-cell"><div class="val" style="color:#4f46e5;">${d.totalScanned||0}</div><div class="lbl">Scanned</div></div>
            <div class="stat-cell"><div class="val" style="color:#64748b;">${d.totalInSystem||0}</div><div class="lbl">In System</div></div>
            <div class="stat-cell"><div class="val" style="color:${(d.missingCount||0)>0?'#dc2626':'#16a34a'};">${d.missingCount||0}</div><div class="lbl">Missing</div></div>
            <div class="stat-cell"><div class="val" style="color:#d97706;">${d.wrongLocationCount||0}</div><div class="lbl">Wrong Loc.</div></div>
          </div>
          ${(d.reasonCode||d.note) ? `<div class="note-section">${d.reasonCode ? `<div style="font-size:12px;color:#64748b;margin-bottom:6px;">Reason code: <strong>${d.reasonCode}</strong></div>` : ''}${d.note ? `<div class="note-box">"${d.note}"</div>` : ''}</div>` : ''}
          ${r.linkedTickets.length > 0 ? `<div class="tickets-section"><div class="tickets-title">🎫 Linked Tickets (${r.linkedTickets.length})</div>${tickets}</div>` : ''}
        </div>
      `;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Inventory Audit Report</title>${style}</head><body>
      <div class="page-header">
        <div>
          <h1>Inventory Audit Center — Full Report</h1>
          <p>Generated ${now} · Showing ${filtered.length} ${printMode === 'all' ? 'all' : printMode} reports</p>
        </div>
        <div class="logo-badge">Asset AI</div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="val">${filtered.length}</div><div class="lbl">Reports</div></div>
        <div class="stat-card"><div class="val">${alerts}</div><div class="lbl">Alerts</div></div>
        <div class="stat-card"><div class="val">${allScanned}</div><div class="lbl">Scanned</div></div>
        <div class="stat-card"><div class="val">${allMissing}</div><div class="lbl">Missing</div></div>
        <div class="stat-card"><div class="val">${allTickets}</div><div class="lbl">Tickets</div></div>
      </div>
      ${reportHTML}
      <div class="page-footer">Asset AI · Inventory Audit Center · Confidential · Generated ${now}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl rounded-2xl border-border bg-card p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl"><Printer className="h-5 w-5"/></div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">Print Inventory Audit Report</DialogTitle>
              <DialogDescription className="text-slate-300 text-sm mt-0.5">World-class comprehensive report with all details and tickets</DialogDescription>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Which reports to include?</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key:'all', label:'All Reports', Icon:LayoutList, desc:`${totalCount} total` },
                { key:'active', label:'Active Only', Icon:Activity, desc:`${totalCount - completedCount} active` },
                { key:'completed', label:'Completed Only', Icon:CheckCheck, desc:`${completedCount} done` },
              ].map(opt => { const Icon=opt.Icon; return (
                <button key={opt.key} onClick={()=>setPrintMode(opt.key as any)}
                  className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center',
                    printMode===opt.key ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600')}>
                  <Icon className="h-4 w-4"/>
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              );})}
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5 flex gap-2.5 items-start">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              The report includes all fields: submitter, location, scan counts, missing items, notes, linked tickets, and completion status. Currently loaded reports will be printed ({reports.length} shown).
            </p>
          </div>
        </div>
        <div ref={printRef} className="hidden"/>
        <DialogFooter className="px-6 pb-6 gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handlePrint} className="flex-1 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white gap-2">
            <Printer className="h-4 w-4"/> Open Print Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────── */
function AuditPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('__all__');
  const [activeTab, setActiveTab] = useState<'active'|'completed'>('active');
  const [search, setSearch] = useState('');
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

  const [assetModal, setAssetModal] = useState<Report|null>(null);
  const [ticketModal, setTicketModal] = useState<Report|null>(null);
  const [staffDialog, setStaffDialog] = useState<{report: Report}|null>(null);
  const [completeTarget, setCompleteTarget] = useState<Report|null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const fetchReports = useCallback(async (p=1, sev=severityFilter, tab=activeTab, silent=false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const params = new URLSearchParams({ page:String(p), limit:'12', status: tab });
      if (sev && sev!=='__all__') params.set('severity', sev);
      const res = await fetch(`/api/audit/inventory-reports?${params}`, { credentials:'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReports(data.reports||[]);
      setTotal(data.total||0);
      setCompletedCount(data.completedCount||0);
      setTotalPages(data.totalPages||1);
      setPage(p);
    } catch(e: any) { toast({title:'Failed to load reports',description:e.message,variant:'destructive'}); }
    finally { setLoading(false); setRefreshing(false); }
  }, [severityFilter, activeTab]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials:'include' });
      if (!res.ok) return;
      const data = await res.json();
      setStaffUsers((data.users||data||[]).map((u: any) => ({ id:u.id, name:u.name, email:u.email, role:u.role })));
    } catch {}
  }, []);

  useEffect(() => { fetchReports(1, severityFilter, activeTab); fetchStaff(); }, []);

  const handleTabChange = (tab: 'active'|'completed') => {
    setActiveTab(tab);
    setPage(1);
    fetchReports(1, severityFilter, tab);
  };

  const handleSevChange = (v: string) => { setSeverityFilter(v); fetchReports(1, v, activeTab); };

  const handleTicketCreated = (reportId: string, ticket: LinkedTicket) => {
    setReports(prev => prev.map(r => r.id===reportId ? {...r, linkedTickets:[...r.linkedTickets, ticket]} : r));
  };

  const handleComplete = async (confirmed: boolean) => {
    if (!completeTarget) return;
    setCompleteLoading(true);
    try {
      const res = await fetch('/api/audit/inventory-reports', {
        method: 'PATCH', credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: completeTarget.id, completed: confirmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: confirmed ? 'Report marked as complete' : 'Report reopened', description: confirmed ? 'Moved to Completed Reports tab.' : 'Report is now active again.' });
      setCompleteTarget(null);
      fetchReports(1, severityFilter, activeTab, true);
      setCompletedCount(prev => confirmed ? prev+1 : Math.max(0, prev-1));
    } catch(e: any) { toast({ title:'Failed', description:e.message, variant:'destructive' }); }
    finally { setCompleteLoading(false); }
  };

  const handleReopen = async (report: Report) => {
    setCompleteLoading(true);
    try {
      const res = await fetch('/api/audit/inventory-reports', {
        method: 'PATCH', credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: report.id, completed: false }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Report reopened', description: 'Report moved back to Active Reports.' });
      fetchReports(1, severityFilter, activeTab, true);
      setCompletedCount(prev => Math.max(0, prev-1));
    } catch(e: any) { toast({ title:'Failed', description:e.message, variant:'destructive' }); }
    finally { setCompleteLoading(false); }
  };

  // Aggregated stats (from current page)
  const totalMissing = reports.reduce((s,r)=>s+(r.details?.missingCount||0),0);
  const totalScanned = reports.reduce((s,r)=>s+(r.details?.totalScanned||0),0);
  const warningCount = reports.filter(r=>r.severity==='WARNING').length;
  const clearCount = reports.filter(r=>r.severity==='INFO').length;
  const totalLinkedTickets = reports.reduce((s,r)=>s+r.linkedTickets.length,0);
  // Total counts: active = total - completedCount (from API)
  const activeCount = Math.max(0, (total + completedCount) - completedCount);

  const filtered = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    const d = r.details||{} as ReportDetails;
    const name = r.submitter?.name||d.submittedByName||'';
    const email = r.submitter?.email||d.submittedByEmail||'';
    return name.toLowerCase().includes(q)||email.toLowerCase().includes(q)||d.floorNumber?.toLowerCase().includes(q)||d.roomNumber?.toLowerCase().includes(q)||d.note?.toLowerCase().includes(q);
  });

  const statCards = [
    { label:'Total Reports', value:total + completedCount, Icon:FileText, grad:'from-indigo-500/20 to-indigo-500/5', border:'border-indigo-400/20', text:'text-indigo-200', sub:'text-indigo-300' },
    { label:'Alert Reports', value:warningCount, Icon:AlertTriangle, grad:'from-amber-500/20 to-amber-500/5', border:'border-amber-400/20', text:'text-amber-200', sub:'text-amber-400' },
    { label:'Items Scanned', value:totalScanned, Icon:ScanLine, grad:'from-blue-500/20 to-blue-500/5', border:'border-blue-400/20', text:'text-blue-200', sub:'text-blue-400' },
    { label:'Missing Items', value:totalMissing, Icon:ShieldAlert, grad:'from-red-500/20 to-red-500/5', border:'border-red-400/20', text:'text-red-200', sub:'text-red-400' },
    { label:'Linked Tickets', value:totalLinkedTickets, Icon:TicketIcon, grad:'from-purple-500/20 to-purple-500/5', border:'border-purple-400/20', text:'text-purple-200', sub:'text-purple-400' },
    { label:'Completed', value:completedCount, Icon:CheckCheck, grad:'from-emerald-500/20 to-emerald-500/5', border:'border-emerald-400/20', text:'text-emerald-200', sub:'text-emerald-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-foreground">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"/>
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl"/>
          <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>
        </div>
        <div className="relative px-6 py-10 max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-sm border border-white/10 shadow-lg">
                  <ClipboardList className="h-7 w-7 text-white"/>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Inventory Audit Center</h1>
                    <Badge className="bg-white/15 text-white border-white/20 text-xs">Live</Badge>
                  </div>
                  <p className="text-indigo-300 text-sm mt-0.5">Field reconciliation reports · Asset accountability · Discrepancy management</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={()=>setPrintOpen(true)}
                className="border-white/20 text-white hover:bg-white/10 bg-white/5 backdrop-blur-sm gap-2">
                <Printer className="h-4 w-4"/> Print Report
              </Button>
              <Button variant="outline" size="sm" onClick={()=>fetchReports(page,severityFilter,activeTab,true)} disabled={refreshing}
                className="border-white/20 text-white hover:bg-white/10 bg-white/5 backdrop-blur-sm gap-2">
                <RefreshCw className={cn('h-4 w-4', refreshing&&'animate-spin')}/> Refresh
              </Button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {statCards.map(s => { const Icon=s.Icon; return (
              <motion.div key={s.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                className={cn('rounded-2xl border backdrop-blur-sm bg-gradient-to-br p-4', s.grad, s.border)}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl"><Icon className={cn('h-4 w-4', s.text)}/></div>
                  <div><p className={cn('text-2xl font-extrabold', s.text)}>{s.value}</p><p className={cn('text-xs', s.sub)}>{s.label}</p></div>
                </div>
              </motion.div>
            );})}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-background/90 backdrop-blur-md border-b border-slate-100 dark:border-border shadow-sm">
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 pt-3 flex items-center gap-1">
          {([
            { key:'active', label:'Active Reports', Icon:LayoutList, count:total },
            { key:'completed', label:'Completed Reports', Icon:CheckCheck, count:completedCount },
          ] as const).map(t => { const Icon=t.Icon; return (
            <button key={t.key} onClick={()=>handleTabChange(t.key)}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-semibold border border-b-0 transition-all',
                activeTab===t.key
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent')}>
              <Icon className="h-4 w-4"/>
              {t.label}
              <span className={cn('ml-1 px-2 py-0.5 rounded-full text-xs font-bold',
                activeTab===t.key
                  ? t.key==='completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500')}>
                {t.count}
              </span>
            </button>
          );})}
        </div>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"/>
            <Input placeholder="Search staff, location, note…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"/>
          </div>
          <Select value={severityFilter} onValueChange={handleSevChange}>
            <SelectTrigger className="w-44 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400"/><SelectValue/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Reports</SelectItem>
              <SelectItem value="WARNING">⚠ With Alerts</SelectItem>
              <SelectItem value="INFO">✓ All Clear</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Activity className="h-3.5 w-3.5"/>{filtered.length} of {total} {activeTab} reports
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 dark:text-slate-500">
            <div className="relative w-16 h-16 mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-500 animate-spin"/>
              <ClipboardList className="absolute inset-0 m-auto h-6 w-6 text-indigo-400"/>
            </div>
            <p className="font-semibold text-slate-500 dark:text-slate-400">Loading audit reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 dark:text-slate-500">
            <div className={cn('p-6 rounded-3xl mb-4', activeTab==='completed' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-slate-100 dark:bg-slate-800')}>
              {activeTab==='completed' ? <CheckCheck className="h-14 w-14 text-emerald-300 dark:text-emerald-700"/> : <ClipboardList className="h-14 w-14 text-slate-300 dark:text-slate-600"/>}
            </div>
            <p className="text-xl font-bold text-slate-500 dark:text-slate-300">
              {activeTab==='completed' ? 'No completed reports yet' : 'No active reports found'}
            </p>
            <p className="text-sm mt-1">{search ? 'Try a different search term.' : activeTab==='completed' ? 'Mark reports as complete to see them here.' : 'No inventory reconciliation reports submitted yet.'}</p>
            {search && <Button variant="ghost" size="sm" className="mt-3 gap-2" onClick={()=>setSearch('')}><X className="h-4 w-4"/> Clear search</Button>}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(r => (
              <ReportCard key={r.id} report={r}
                onViewAssets={()=>setAssetModal(r)}
                onCreateTicket={()=>setTicketModal(r)}
                onDownloadPdf={()=>downloadPdf(`/api/audit/report-pdf?id=${r.id}`)}
                onViewStaff={()=>setStaffDialog({report:r})}
                onComplete={activeTab==='active' ? (rep)=>setCompleteTarget(rep) : undefined}
                onReopen={activeTab==='completed' ? (rep)=>handleReopen(rep) : undefined}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>fetchReports(page-1,severityFilter,activeTab)}>← Previous</Button>
            <div className="flex items-center gap-1">
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{const p=i+1;return(
                <button key={p} onClick={()=>fetchReports(p,severityFilter,activeTab)}
                  className={cn('w-8 h-8 rounded-lg text-sm font-medium transition-all', p===page?'bg-indigo-600 text-white':'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800')}>
                  {p}
                </button>);
              })}
            </div>
            <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>fetchReports(page+1,severityFilter,activeTab)}>Next →</Button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AssetListModal open={!!assetModal} onClose={()=>setAssetModal(null)} report={assetModal}/>
      <CreateTicketModal open={!!ticketModal} onClose={()=>setTicketModal(null)} report={ticketModal} staffUsers={staffUsers}
        onCreated={ticket => { if(ticketModal) handleTicketCreated(ticketModal.id, ticket); }}/>
      <StaffPerformanceDialog
        open={!!staffDialog} onClose={()=>setStaffDialog(null)}
        userId={staffDialog?.report?.submitter?.id||staffDialog?.report?.userId}
        staffName={staffDialog?.report?.submitter?.name||staffDialog?.report?.details?.submittedByName}
        staffEmail={staffDialog?.report?.submitter?.email||staffDialog?.report?.details?.submittedByEmail}
      />
      <ConfirmCompleteDialog
        open={!!completeTarget} onClose={()=>setCompleteTarget(null)}
        report={completeTarget} loading={completeLoading}
        onConfirm={()=>handleComplete(true)}
      />
      <PrintReportDialog
        open={printOpen} onClose={()=>setPrintOpen(false)}
        reports={reports} completedCount={completedCount} totalCount={total+completedCount}
      />
    </div>
  );
}

export default function AuditPageWrapper() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <AuditPage/>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
