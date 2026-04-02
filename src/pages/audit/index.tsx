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
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, AlertTriangle, CheckCircle2, Package, Search, RefreshCw,
  Filter, Eye, TicketIcon, Calendar, Clock, MapPin, User, ChevronDown,
  ChevronUp, Loader2, ShieldAlert, ShieldCheck, FileText, PlusCircle,
  Info, BarChart3, Zap, AlertCircle, ArrowRight, Hash, ScanLine,
  X, Download, Brain, TrendingUp, TrendingDown, Star, Activity,
  Building2, Users, Award, Lightbulb, Target, CheckSquare, XCircle,
  Printer, CheckCheck, Archive, LayoutList,
  Smartphone, Battery, BatteryLow, BatteryWarning, Wifi, Radio,
  Signal, Gauge, Scan, Ticket,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

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
  id: string; displayId: string | null; title: string;
  status: string; priority: string; createdAt: string;
  updatedAt?: string; _count?: { history?: number };
}
interface Report {
  id: string; timestamp: string; userId?: string; severity: "INFO"|"WARNING"|"ERROR";
  details: ReportDetails|null; submitter?: { id?: string; name?: string; email?: string; role?: string; imageUrl?: string; }|null;
  linkedTickets: LinkedTicket[]; verified?: boolean; verifiedAt?: string; verifiedBy?: string; completedBy?: string;
}
interface StaffUser { id: string; name?: string; email: string; role?: string; }
interface StaffPerf {
  staffUser: { name?: string; email?: string; role?: string }; userId: string;
  totalScans: number; totalScanned: number; totalInSystem: number;
  totalMissing: number; totalExtra: number; totalWrongLocation: number;
  avgCoverage: number; avgMissingPerScan: number; avgDurationMs: number; alertCount: number;
  locationBreakdown: { location: string; scans: number; missing: number; scanned: number; inSystem: number; coveragePct: number }[];
  topMissingItems: { name: string; barcode: string; count: number }[];
  timeline: { date: string; missing: number; scanned: number; coverage: number }[];
  insights: string[];
}

/* ── Helpers ── */
const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDuration = (ms?: number) => { if (!ms) return '—'; const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60); if(h>0)return`${h}h ${m%60}m`; if(m>0)return`${m}m ${s%60}s`; return`${s}s`; };
const initials = (name?: string, email?: string) => (name||email||'?').split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2);
const pct = (a: number, b: number) => b > 0 ? Math.round((a/b)*100) : 0;

function getSevConfig(s: string) {
  if (s==='WARNING') return { stripe:'from-amber-400 to-orange-400', card:'border-amber-200 dark:border-amber-800/60', badge:'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800', dot:'bg-amber-400', Icon:AlertTriangle, iconCol:'text-amber-500' };
  if (s==='ERROR')   return { stripe:'from-red-400 to-rose-400', card:'border-red-200 dark:border-red-900/50', badge:'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900', dot:'bg-red-500', Icon:XCircle, iconCol:'text-red-500' };
  return { stripe:'from-emerald-400 to-teal-400', card:'border-slate-100 dark:border-slate-700', badge:'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800', dot:'bg-emerald-400', Icon:CheckCircle2, iconCol:'text-emerald-500' };
}
function statusCls(s: string) {
  if (s==='OPEN') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s==='IN_PROGRESS') return 'bg-purple-100 text-purple-700 border-purple-200';
  if (s==='RESOLVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}
function prioCls(p: string) {
  if (p==='CRITICAL') return 'bg-red-100 text-red-700'; if (p==='HIGH') return 'bg-orange-100 text-orange-700';
  if (p==='MEDIUM') return 'bg-amber-100 text-amber-700'; return 'bg-slate-100 text-slate-600';
}
const coverageColor = (c: number) => c>=90 ? 'text-emerald-600' : c>=70 ? 'text-amber-600' : 'text-red-600';
const coverageBarColor = (c: number) => c>=90 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : c>=70 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-rose-500';
const downloadPdf = (url: string) => { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.click(); };

/* ── Battery helpers ── */
const getBatteryColor = (level: number) => {
  if (level <= 10) return 'text-red-600 bg-red-100 border-red-200';
  if (level <= 20) return 'text-orange-600 bg-orange-100 border-orange-200';
  return 'text-yellow-600 bg-yellow-100 border-yellow-200';
};
const getBatteryIcon = (level: number) => level <= 10 ? BatteryWarning : BatteryLow;
const getBatteryBg = (level: number) => level <= 10 ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : level <= 20 ? 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20' : 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20';

/* ── Asset List Modal ── */
function AssetListModal({ open, onClose, report }: { open: boolean; onClose: ()=>void; report: Report|null }) {
  const [tab, setTab] = useState<'available'|'missing'|'wrong'|'extra'>('available');
  const [search, setSearch] = useState('');
  const d = report?.details;
  const tabs = [
    { key:'available', label:'Available', items:d?.correctInRoomItems||[], color:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-200', Icon:CheckCircle2 },
    { key:'missing', label:'Missing', items:d?.missingItems||[], color:'text-red-600', bg:'bg-red-50', border:'border-red-200', Icon:AlertTriangle },
    { key:'wrong', label:'Wrong Location', items:d?.wrongLocationItems||[], color:'text-amber-600', bg:'bg-amber-50', border:'border-amber-200', Icon:MapPin },
    { key:'extra', label:'Extra/Unknown', items:d?.extraItems||[], color:'text-blue-600', bg:'bg-blue-50', border:'border-blue-200', Icon:Info },
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
            {tabs.map(t => <div key={t.key} className="bg-white/15 rounded-full px-3 py-1 text-xs font-medium">{t.items.length} {t.label}</div>)}
          </div>
        </div>
        <div className="flex border-b border-slate-100 dark:border-slate-800 flex-shrink-0 bg-background">
          {tabs.map(t => { const Icon=t.Icon; const isActive=tab===t.key; return (
            <button key={t.key} onClick={() => { setTab(t.key as any); setSearch(''); }}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-all',
                isActive ? `border-indigo-600 ${t.color}` : 'border-transparent text-slate-400 hover:text-slate-600')}>
              <Icon className="h-4 w-4"/>
              <span className="hidden sm:block">{t.label}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold', isActive ? `${t.bg} ${t.color}` : 'bg-slate-100 text-slate-400')}>{t.items.length}</span>
            </button>
          );})}
        </div>
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
            <Input placeholder="Search name or barcode…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-9 text-sm"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 bg-slate-50/50 dark:bg-slate-950/50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-slate-400"><Package className="h-10 w-10 mb-2 opacity-30"/><p className="font-medium text-sm">{search ? 'No matches' : 'No items here'}</p></div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item: AssetItem, i: number) => (
                <motion.div key={item.id||item.barcode||i} initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.015}}
                  className={cn('flex items-center gap-3 p-3 rounded-xl border bg-card shadow-sm', active.border)}>
                  <div className={cn('p-2 rounded-lg flex-shrink-0', active.bg)}><Package className={cn('h-4 w-4', active.color)}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name||'Unnamed'}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {item.barcode && <span className="text-xs text-slate-400 font-mono">{item.barcode}</span>}
                      {(item.floorNumber||item.roomNumber) && <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3"/>{[item.floorNumber,item.roomNumber].filter(Boolean).join('·')}</span>}
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

/* ── Create Ticket Modal ── */
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
    setDescription([`**Inventory Reconciliation Report**`,`Report ID: ${report.id}`,`Submitted by: ${d?.submittedByName||d?.submittedByEmail||report.submitter?.name||report.submitter?.email||'Staff'}`,`Date: ${fmtDate(d?.submittedAt||report.timestamp)}`,`Location: ${locationStr}`,``,`**Scan Summary**`,`• Total scanned: ${d?.totalScanned??0}`,`• Expected in system: ${d?.totalInSystem??0}`,`• Missing: ${d?.missingCount??0}`,`• Extra/Unknown: ${d?.extraCount??0}`,`• Wrong location: ${d?.wrongLocationCount??0}`,d?.reasonCode?`• Reason code: ${d.reasonCode}`:'',d?.note?`\n**Staff Note:**\n${d.note}`:'',`\n_Audit log ref: ${report.id}_`].filter(l=>l!==undefined).join('\n').trim());
    setPriority('HIGH'); setAssignedToId('__none__');
  }, [open, report?.id]);

  const handleSubmit = async () => {
    if (!title.trim()||!description.trim()) { toast({title:'Required fields missing',variant:'destructive'}); return; }
    setSubmitting(true);
    try {
      const body: any = { title: title.trim(), description: description.trim(), priority, source: 'INTERNAL', ticketType: 'MANAGEMENT', category: 'INVENTORY', ...(report?.id ? { inventoryAuditLogId: report.id } : {}) };
      if (assignedToId && assignedToId!=='__none__') body.assignedToId = assignedToId;
      const res = await fetch('/api/tickets',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ticket = data.ticket||data;
      toast({title:'Ticket created',description:`${ticket.displayId||'Ticket'} has been created.`});
      onCreated({ id: ticket.id, displayId: ticket.displayId || null, title: ticket.title, status: ticket.status || 'OPEN', priority: ticket.priority || priority, createdAt: ticket.createdAt || new Date().toISOString(), updatedAt: ticket.updatedAt || ticket.createdAt || new Date().toISOString(), _count: { history: 0 } });
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
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5"><label className="text-sm font-semibold">Ticket Title *</label><Input value={title} onChange={e=>setTitle(e.target.value)} className="h-10"/></div>
          <div className="space-y-1.5"><label className="text-sm font-semibold">Description *</label><Textarea value={description} onChange={e=>setDescription(e.target.value)} rows={9} className="text-sm font-mono resize-none"/></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className="text-sm font-semibold">Priority</label>
              <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><label className="text-sm font-semibold">Assign To</label>
              <Select value={assignedToId} onValueChange={setAssignedToId}><SelectTrigger><SelectValue placeholder="— Unassigned —"/></SelectTrigger><SelectContent><SelectItem value="__none__">— Unassigned —</SelectItem>{staffUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name||u.email}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6 gap-3">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <TicketIcon className="h-4 w-4 mr-2"/>}{submitting ? 'Creating…' : 'Create Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Staff Performance Dialog ── */
function StaffPerformanceDialog({ open, onClose, userId, staffName, staffEmail }: { open: boolean; onClose: ()=>void; userId?: string; staffName?: string; staffEmail?: string; }) {
  const [data, setData] = useState<StaffPerf|null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setData(null); setLoading(true);
    fetch(`/api/audit/staff-performance?userId=${encodeURIComponent(userId)}`, { credentials:'include' }).then(r => r.ok ? r.json() : Promise.reject(r.statusText)).then(d => setData(d)).catch(() => toast({ title:'Failed to load performance data', variant:'destructive' })).finally(() => setLoading(false));
  }, [open, userId]);

  const perf = data;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border bg-card">
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 p-6 text-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-4 border-white/30 shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-indigo-300 to-purple-500 text-white text-xl font-bold">{initials(staffName, staffEmail)}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl font-bold text-white">{staffName||staffEmail||'Staff Member'}</DialogTitle>
                <p className="text-indigo-200 text-sm">{staffEmail}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => { setPdfLoading(true); downloadPdf(`/api/audit/staff-performance?userId=${encodeURIComponent(userId!)}&pdf=1`); setTimeout(()=>setPdfLoading(false),2000); }} disabled={pdfLoading||loading} className="bg-white/15 hover:bg-white/25 text-white border-white/20 gap-2">
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>} PDF
            </Button>
          </div>
          {perf && (<div className="grid grid-cols-5 gap-2 mt-5">{[{label:'Total Scans',value:perf.totalScans,icon:ScanLine},{label:'Total Missing',value:perf.totalMissing,icon:AlertTriangle},{label:'Avg Coverage',value:`${perf.avgCoverage}%`,icon:Target},{label:'Avg Missing/Scan',value:perf.avgMissingPerScan,icon:TrendingDown},{label:'Alert Sessions',value:perf.alertCount,icon:ShieldAlert}].map(k=>{const Icon=k.icon;return(<div key={k.label} className="bg-white/15 rounded-xl p-3 text-center"><Icon className="h-4 w-4 mx-auto mb-1 text-indigo-200"/><p className="text-xl font-extrabold text-white">{k.value}</p><p className="text-xs text-indigo-300 leading-tight">{k.label}</p></div>);})}</div>)}
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          {loading ? (<div className="flex flex-col items-center justify-center py-20 text-slate-400"><div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin mb-4"/><p className="font-medium">Analysing performance data…</p></div>) : !perf ? null : (
            <div className="p-5 space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-3"><div className="p-1.5 bg-indigo-100 rounded-lg"><Brain className="h-4 w-4 text-indigo-600"/></div><h3 className="font-bold">AI Performance Insights</h3><Badge className="bg-indigo-100 text-indigo-700 text-xs">AI Generated</Badge></div>
                <div className="space-y-2">{perf.insights.map((ins, i) => (<motion.div key={i} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}} className="flex gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">{i+1}</div><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{ins}</p></motion.div>))}{perf.insights.length===0&&<p className="text-sm text-slate-400 text-center py-4">No insights yet — more scan data needed.</p>}</div>
              </section>
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2"><span className="font-semibold text-sm">Average Scan Coverage</span><span className={cn('text-2xl font-extrabold', coverageColor(perf.avgCoverage))}>{perf.avgCoverage}%</span></div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${Math.min(100,perf.avgCoverage)}%`}} transition={{duration:1.2,ease:'easeOut'}} className={cn('h-full rounded-full', coverageBarColor(perf.avgCoverage))}/></div>
              </section>
              {perf.timeline.length > 0 && (<section><h3 className="font-bold mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-500"/> Recent Scan History</h3><div className="space-y-2">{perf.timeline.map((t, i) => (<div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><div className="text-xs text-slate-400 w-24 flex-shrink-0">{t.date}</div><div className="flex-1"><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={cn('h-full rounded-full',coverageBarColor(t.coverage))} style={{width:`${Math.min(100,t.coverage)}%`}}/></div></div><div className="flex items-center gap-3 text-xs flex-shrink-0"><span className="text-indigo-600 font-medium">{t.scanned} scanned</span>{t.missing>0?<span className="text-red-600 font-medium">{t.missing} missing</span>:<span className="text-emerald-600 font-medium">Clear</span>}<span className={cn('font-bold',coverageColor(t.coverage))}>{t.coverage}%</span></div></div>))}</div></section>)}
            </div>
          )}
        </div>
        <DialogFooter className="px-5 py-3.5 bg-background border-t border-slate-100 flex-shrink-0"><Button variant="outline" onClick={onClose} size="sm">Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Report Card ── */
function ReportCard({ report, onViewAssets, onCreateTicket, onViewStaff, onComplete, onReopen }: {
  report: Report; onViewAssets: (r: Report)=>void; onCreateTicket: (r: Report)=>void;
  onViewStaff: (r: Report)=>void; onComplete?: (r: Report)=>void; onReopen?: (r: Report)=>void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const isCompleted = !!report.verified;
  const d = report.details || {} as ReportDetails;
  const sev = getSevConfig(report.severity);
  const SevIcon = sev.Icon;
  const location = [d.floorNumber&&`Floor ${d.floorNumber}`, d.roomNumber&&`Room ${d.roomNumber}`].filter(Boolean).join(' · ')||'All locations';
  const covPct = pct(d.totalScanned, d.totalInSystem);
  const staffName = report.submitter?.email || report.submitter?.name || d.submittedByEmail || d.submittedByName || 'Unknown Staff';
  const staffEmail = report.submitter?.email || d.submittedByEmail || '';

  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.3}}
      className={cn('rounded-2xl border-2 bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden', isCompleted ? 'border-emerald-200 dark:border-emerald-800/60' : sev.card)}>
      <div className={cn('h-1.5 w-full bg-gradient-to-r', isCompleted ? 'from-emerald-400 to-teal-500' : sev.stripe)}/>
      {isCompleted && (<div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 flex items-center gap-2"><CheckCheck className="h-4 w-4 text-emerald-600 flex-shrink-0"/><span className="text-sm font-semibold text-emerald-700">Report Completed</span>{report.verifiedAt && <span className="text-xs text-emerald-500 ml-1">· {fmtDate(report.verifiedAt)}</span>}</div>)}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0 cursor-pointer group" onClick={()=>onViewStaff(report)}>
            <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-indigo-300 transition-all">
              <AvatarImage src={report.submitter?.imageUrl}/>
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold">{initials(report.submitter?.name, staffEmail)}</AvatarFallback>
            </Avatar>
            <span className={cn('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white', isCompleted ? 'bg-emerald-400' : sev.dot)}/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={()=>onViewStaff(report)} className="font-bold hover:text-indigo-600 transition-colors text-left hover:underline">{staffName}</button>
              {report.submitter?.role && <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-200 bg-indigo-50">{report.submitter.role}</Badge>}
              <Badge variant="outline" className={cn('text-xs font-semibold border', isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : sev.badge)}>
                {isCompleted ? <CheckCheck className="h-3 w-3 mr-1 text-emerald-500"/> : <SevIcon className={cn('h-3 w-3 mr-1', sev.iconCol)}/>}
                {isCompleted ? 'COMPLETED' : report.severity}
              </Badge>
            </div>
            {staffEmail && staffEmail !== staffName && <p className="text-xs text-slate-500 mt-0.5">{staffEmail}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{location}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{fmtDuration(d.sessionDurationMs)}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3"/>{fmtDate(d.submittedAt||report.timestamp)}</span>
            </div>
          </div>
          <button onClick={()=>setExpanded(v=>!v)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors flex-shrink-0">
            {expanded ? <ChevronUp className="h-5 w-5"/> : <ChevronDown className="h-5 w-5"/>}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label:'Scanned', value:d.totalScanned, Icon:ScanLine, col:'text-indigo-600', bg:'bg-indigo-50' },
            { label:'In System', value:d.totalInSystem, Icon:Package, col:'text-slate-600', bg:'bg-slate-100' },
            { label:'Missing', value:d.missingCount, Icon:AlertTriangle, col:d.missingCount>0?'text-red-600':'text-slate-400', bg:d.missingCount>0?'bg-red-50':'bg-slate-50' },
            { label:'Wrong Loc.', value:d.wrongLocationCount, Icon:MapPin, col:d.wrongLocationCount>0?'text-amber-600':'text-slate-400', bg:d.wrongLocationCount>0?'bg-amber-50':'bg-slate-50' },
          ].map(s => { const Icon=s.Icon; return (<div key={s.label} className={cn('rounded-xl p-3 flex items-center gap-2.5', s.bg)}><Icon className={cn('h-4 w-4 flex-shrink-0', s.col)}/><div><p className={cn('text-xl font-extrabold leading-none', s.col)}>{s.value}</p><p className="text-xs text-slate-500 mt-0.5">{s.label}</p></div></div>); })}
        </div>
        {d.totalInSystem > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-400"><span>Scan coverage</span><span className={cn('font-bold', coverageColor(covPct))}>{covPct}%</span></div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${Math.min(100,covPct)}%`}} transition={{duration:1,ease:'easeOut'}} className={cn('h-full rounded-full', coverageBarColor(covPct))}/></div>
          </div>
        )}
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                {(d.reasonCode||d.note) && (<div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 space-y-2">{d.reasonCode && <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-amber-500"/><span className="text-xs font-semibold text-amber-700">Reason:</span><Badge variant="outline" className="text-xs border-amber-200 text-amber-700">{d.reasonCode}</Badge></div>}{d.note && <p className="text-sm text-slate-700 italic bg-white rounded-lg px-3 py-2 border border-amber-100">"{d.note}"</p>}</div>)}
                {report.linkedTickets.length > 0 && (<div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><TicketIcon className="h-3.5 w-3.5"/> Linked tickets ({report.linkedTickets.length})</p><div className="space-y-1.5">{report.linkedTickets.map(t => (<a key={t.id} href={`/tickets/${t.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-card hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"><TicketIcon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0"/><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.title}</p><p className="text-xs text-slate-400">{t.displayId||t.id.slice(0,8)}</p></div><Badge variant="outline" className={cn('text-xs border', statusCls(t.status))}>{t.status.replace('_',' ')}</Badge><ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500"/></a>))}</div></div>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={()=>onViewAssets(report)}><Eye className="h-3.5 w-3.5"/> View Assets</Button>
          {!isCompleted && (<Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm" onClick={()=>onCreateTicket(report)}><TicketIcon className="h-3.5 w-3.5"/> Create Ticket</Button>)}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setPdfLoading(true); downloadPdf(`/api/audit/report-pdf?id=${report.id}`); setTimeout(()=>setPdfLoading(false),2000); }} disabled={pdfLoading}>{pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Download className="h-3.5 w-3.5"/>} PDF</Button>
          {!isCompleted && onComplete && (<Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm ml-auto" onClick={()=>onComplete(report)}><CheckCheck className="h-3.5 w-3.5"/> Mark Complete</Button>)}
          {isCompleted && onReopen && (<Button size="sm" variant="outline" className="gap-1.5 text-xs border-amber-200 text-amber-600 hover:bg-amber-50 ml-auto" onClick={()=>onReopen(report)}><Archive className="h-3.5 w-3.5"/> Reopen</Button>)}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Battery indicator ── */
function BatteryBar({ level, className }: { level: number | null; className?: string }) {
  if (level == null) return <span className="text-xs text-slate-400">—</span>;
  const color = level > 50 ? 'bg-green-500' : level > 20 ? 'bg-amber-400' : 'bg-red-500';
  const BIcon = level <= 10 ? BatteryWarning : level <= 30 ? BatteryLow : Battery;
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <BIcon className={cn('h-3.5 w-3.5', level > 50 ? 'text-green-500' : level > 20 ? 'text-amber-500' : 'text-red-500')}/>
      <div className="relative w-12 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{width:`${Math.min(100,level)}%`}}/>
      </div>
      <span className={cn('text-xs font-bold', level > 50 ? 'text-green-600' : level > 20 ? 'text-amber-600' : 'text-red-600')}>{level}%</span>
    </div>
  );
}

/* ── Format duration ── */
function fmtMs(ms: number | null): string {
  if (!ms || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ── Session Timeline Card ── */
function SessionTimelineCard({ session, idx }: { session: any; idx: number }) {
  const isActive = !session.endedAt;
  const scanVelocity = session.durationMs && session.scanCount > 0
    ? Math.round(session.scanCount / (session.durationMs / 3_600_000))
    : null;
  return (
    <motion.div initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:idx*0.04}}
      className={cn('relative pl-8 pb-5 last:pb-0',
        isActive ? 'border-l-2 border-teal-400 ml-3' : 'border-l-2 border-slate-200 dark:border-slate-700 ml-3')}>
      {/* Timeline dot */}
      <div className={cn('absolute -left-[9px] top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center',
        isActive ? 'bg-teal-500 border-teal-300 shadow-lg shadow-teal-200' : 'bg-slate-300 dark:bg-slate-600 border-white dark:border-slate-800')}/>

      <div className={cn('rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md',
        isActive ? 'border-teal-200 bg-teal-50/40 dark:bg-teal-950/20' : 'border-slate-100 dark:border-slate-800 bg-card')}>

        {/* Header row */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs font-bold', isActive ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-600 border-slate-200')}>
              {isActive ? '● Live' : `Session #${idx + 1}`}
            </Badge>
            {session.platform && <Badge className="text-xs bg-indigo-100 text-indigo-700 capitalize">{session.platform}</Badge>}
            {session.deviceName && <span className="text-xs text-slate-400 truncate max-w-[120px]">{session.deviceName.slice(0,40)}</span>}
          </div>
          <span className={cn('text-sm font-bold', isActive ? 'text-teal-600' : 'text-slate-600')}>{fmtMs(session.durationMs)}</span>
        </div>

        {/* Time range */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"/>
            <span className="font-medium">Login:</span>
            <span>{new Date(session.startedAt).toLocaleString(undefined, {dateStyle:'short',timeStyle:'short'})}</span>
          </div>
          {session.endedAt ? (
            <>
              <span className="text-slate-300">→</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400"/>
                <span className="font-medium">Logout:</span>
                <span>{new Date(session.endedAt).toLocaleString(undefined, {dateStyle:'short',timeStyle:'short'})}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1 text-teal-600">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"/>
              <span className="font-medium">Still active</span>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-2.5 text-center">
            <Scan className="h-3.5 w-3.5 text-blue-500 mx-auto mb-1"/>
            <p className="text-lg font-black text-blue-600">{session.scanCount || 0}</p>
            <p className="text-[10px] text-blue-400">Scans</p>
          </div>
          <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 p-2.5 text-center">
            <Ticket className="h-3.5 w-3.5 text-purple-500 mx-auto mb-1"/>
            <p className="text-lg font-black text-purple-600">{session.ticketsCreated || 0}</p>
            <p className="text-[10px] text-purple-400">Tickets</p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 text-center">
            <Clock className="h-3.5 w-3.5 text-slate-500 mx-auto mb-1"/>
            <p className="text-lg font-black text-slate-600">{fmtMs(session.durationMs)}</p>
            <p className="text-[10px] text-slate-400">Duration</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-2.5 text-center">
            <Gauge className="h-3.5 w-3.5 text-amber-500 mx-auto mb-1"/>
            <p className="text-lg font-black text-amber-600">{scanVelocity ?? '—'}{scanVelocity ? '/h' : ''}</p>
            <p className="text-[10px] text-amber-400">Scan rate</p>
          </div>
        </div>

        {/* Battery row */}
        {(session.batteryStart != null || session.batteryEnd != null) && (
          <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Battery start:</span>
              <BatteryBar level={session.batteryStart}/>
            </div>
            {session.batteryEnd != null && (
              <>
                <span className="text-slate-300">→</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">End:</span>
                  <BatteryBar level={session.batteryEnd}/>
                </div>
                {session.batteryDrain != null && session.batteryDrain > 0 && (
                  <Badge className="text-xs bg-red-50 text-red-600 border-red-100">
                    -{session.batteryDrain}% drain
                  </Badge>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── User Card (collapsed) ── */
function UserCard({ userData, onClick, isExpanded }: { userData: any; onClick: () => void; isExpanded: boolean }) {
  const score = userData.productivityScore || 0;
  const scoreColor = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-500';
  const scoreBg   = score >= 70 ? 'bg-green-50 border-green-200' : score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const initials  = (userData.email || '?').split('@')[0].slice(0,2).toUpperCase();
  const activeSessions = (userData.sessions || []).filter((s: any) => !s.endedAt).length;

  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
      onClick={onClick} className="cursor-pointer group">
      <div className={cn('rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.005]',
        isExpanded ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-lg shadow-indigo-100/50' :
          activeSessions > 0 ? 'border-teal-300 bg-teal-50/30 dark:bg-teal-950/20 hover:border-teal-400' :
          'border-slate-200 dark:border-slate-700 bg-card hover:border-indigo-300')}>

        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-md',
              activeSessions > 0 ? 'bg-gradient-to-br from-teal-500 to-emerald-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600')}>
              {initials}
            </div>
            {activeSessions > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-teal-400 border-2 border-white animate-pulse"/>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{userData.email}</p>
              {activeSessions > 0 && (
                <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200">● Online now</Badge>
              )}
              <div className={cn('text-xs font-bold px-2 py-0.5 rounded-full border ml-auto', scoreBg, scoreColor)}>
                AI Score: {score}
              </div>
            </div>

            {/* Stat chips */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { icon: Activity, val: `${userData.sessionCount} session${userData.sessionCount !== 1 ? 's' : ''}`, color: 'text-indigo-600 bg-indigo-50' },
                { icon: Scan, val: `${userData.totalScans} scans`, color: 'text-blue-600 bg-blue-50' },
                { icon: Ticket, val: `${userData.totalTickets} tickets`, color: 'text-purple-600 bg-purple-50' },
                { icon: Clock, val: fmtMs(userData.totalDurationMs), color: 'text-slate-600 bg-slate-100' },
              ].map(({ icon: Icon, val, color }) => (
                <div key={val} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold', color)}>
                  <Icon className="h-3 w-3"/>{val}
                </div>
              ))}
              {userData.avgBatteryDrain != null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-600 bg-amber-50">
                  <BatteryLow className="h-3 w-3"/>-{userData.avgBatteryDrain}% avg drain
                </div>
              )}
              {userData.scansPerHour != null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-teal-600 bg-teal-50">
                  <Gauge className="h-3 w-3"/>{userData.scansPerHour}/h rate
                </div>
              )}
            </div>

            {/* Last active */}
            <p className="text-xs text-slate-400 mt-2">
              Last active: {userData.lastActiveAt ? new Date(userData.lastActiveAt).toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'}) : '—'}
            </p>
          </div>

          {/* Expand chevron */}
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
            isExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500')}>
            <ChevronDown className="h-4 w-4"/>
          </div>
        </div>

        {/* AI insight preview */}
        {userData.sessionCount > 0 && !isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Brain className="h-3.5 w-3.5 text-indigo-400"/>
              <span className="italic">
                {score >= 70 ? `High performer — ${userData.totalScans} assets tracked across ${userData.sessionCount} sessions`
                  : score >= 40 ? `Active technician — avg ${fmtMs(userData.avgDurationMs)} per session`
                  : `${userData.sessionCount} session${userData.sessionCount !== 1 ? 's' : ''} recorded — encourage more field activity`}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Battery Tag Row ── */
function BatteryTagRow({ tag }: { tag: any }) {
  const level = tag.batteryLevel ?? 0;
  const BIcon = getBatteryIcon(level);
  return (
    <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
      className={cn('flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-sm', getBatteryBg(level))}>
      <div className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border min-w-[72px] justify-center flex-shrink-0', getBatteryColor(level))}>
        <BIcon className="h-4 w-4"/>
        {level}%
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{tag.asset?.name || 'Unassigned Tag'}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-slate-400">
          <span className="font-mono">{tag.tagId}</span>
          {tag.asset?.assetId && <span>{tag.asset.assetId}</span>}
          {tag.lastZone?.name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{tag.lastZone.name}</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-slate-400">{tag.lastSeenAt ? new Date(tag.lastSeenAt).toLocaleString() : 'Never seen'}</p>
        <Badge className="text-xs mt-1 bg-red-100 text-red-700 border-red-200 cursor-pointer hover:bg-red-200">Schedule Replacement</Badge>
      </div>
    </motion.div>
  );
}

/* ── Confirm Complete ── */
function ConfirmCompleteDialog({ open, onClose, report, onConfirm, loading: busy }: { open: boolean; onClose: ()=>void; report: Report|null; onConfirm: ()=>void; loading: boolean; }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-card p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-center gap-3"><div className="p-2.5 bg-white/20 rounded-xl"><CheckCheck className="h-5 w-5"/></div><div><DialogTitle className="text-lg font-bold text-white">Mark Report Complete</DialogTitle><DialogDescription className="text-emerald-100 text-sm mt-0.5">Moves the report to the Completed tab.</DialogDescription></div></div>
        </div>
        <div className="p-6"><p className="text-sm">Are you sure you want to mark this inventory report as <strong>complete</strong>?</p></div>
        <DialogFooter className="px-6 pb-6 gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy} className="flex-1">Cancel</Button>
          <Button onClick={onConfirm} disabled={busy} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <CheckCheck className="h-4 w-4 mr-2"/>}{busy ? 'Completing…' : 'Yes, Complete'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════
   ── Main Page ─────────────────────────────────────────
══════════════════════════════════════════════════════════ */
function HandheldAuditPage() {
  /* Audit state */
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('__all__');
  const [activeTab, setActiveTab] = useState<'active'|'completed'|'sessions'|'battery'>('active');
  const [search, setSearch] = useState('');
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [assetModal, setAssetModal] = useState<Report|null>(null);
  const [ticketModal, setTicketModal] = useState<Report|null>(null);
  const [staffDialog, setStaffDialog] = useState<{report: Report}|null>(null);
  const [completeTarget, setCompleteTarget] = useState<Report|null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);

  /* Handheld session state */
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  /* Battery state */
  const [lowBattery, setLowBattery] = useState<any[]>([]);
  const [batteryThreshold, setBatteryThreshold] = useState(20);
  const [batteryLoading, setBatteryLoading] = useState(false);

  /* ── Fetchers ── */
  const fetchReports = useCallback(async (p=1, sev=severityFilter, tab=activeTab, silent=false) => {
    if (tab === 'sessions' || tab === 'battery') return;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const params = new URLSearchParams({ page:String(p), limit:'12', status: tab as string });
      if (sev && sev!=='__all__') params.set('severity', sev);
      const res = await fetch(`/api/audit/inventory-reports?${params}`, { credentials:'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReports(data.reports||[]); setTotal(data.total||0); setCompletedCount(data.completedCount||0); setTotalPages(data.totalPages||1); setPage(p);
    } catch(e: any) { toast({title:'Failed to load reports',description:e.message,variant:'destructive'}); }
    finally { setLoading(false); setRefreshing(false); }
  }, [severityFilter, activeTab]);

  const fetchSessions = useCallback(async () => {
    try {
      const s = await fetch('/api/rfid/handheld-sessions').then(r => r.json()).catch(() => ({ sessions: [], stats: {}, users: [] }));
      setSessions(Array.isArray(s.sessions) ? s.sessions : []);
      setSessionStats(s.stats || {});
      setUsers(Array.isArray(s.users) ? s.users : []);
    } catch {}
  }, []);

  const fetchBattery = useCallback(async () => {
    setBatteryLoading(true);
    try {
      const b = await fetch(`/api/rfid/low-battery?threshold=${batteryThreshold}`).then(r => r.json()).catch(() => ({ tags: [], count: 0 }));
      setLowBattery(Array.isArray(b.tags) ? b.tags : []);
    } finally { setBatteryLoading(false); }
  }, [batteryThreshold]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials:'include' });
      if (!res.ok) return;
      const data = await res.json();
      setStaffUsers((data.users||data||[]).map((u: any) => ({ id:u.id, name:u.name, email:u.email, role:u.role })));
    } catch {}
  }, []);

  useEffect(() => { fetchReports(1, severityFilter, activeTab); fetchStaff(); fetchSessions(); fetchBattery(); }, []);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === 'sessions') fetchSessions();
    else if (tab === 'battery') fetchBattery();
    else fetchReports(1, severityFilter, tab);
  };

  const handleSevChange = (v: string) => { setSeverityFilter(v); fetchReports(1, v, activeTab); };

  const handleTicketCreated = (reportId: string, ticket: LinkedTicket) => {
    setReports(prev => prev.map(r => r.id===reportId ? {...r, linkedTickets:[...r.linkedTickets, ticket]} : r));
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    setCompleteLoading(true);
    try {
      const res = await fetch('/api/audit/inventory-reports', { method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: completeTarget.id, completed: true }) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Report marked as complete' });
      setCompleteTarget(null);
      fetchReports(1, severityFilter, activeTab, true);
      setCompletedCount(prev => prev+1);
    } catch(e: any) { toast({ title:'Failed', description:e.message, variant:'destructive' }); }
    finally { setCompleteLoading(false); }
  };

  const handleReopen = async (report: Report) => {
    setCompleteLoading(true);
    try {
      const res = await fetch('/api/audit/inventory-reports', { method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: report.id, completed: false }) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Report reopened' });
      fetchReports(1, severityFilter, activeTab, true);
      setCompletedCount(prev => Math.max(0, prev-1));
    } catch(e: any) { toast({ title:'Failed', description:e.message, variant:'destructive' }); }
    finally { setCompleteLoading(false); }
  };

  const exportSessions = () => {
    const wb = XLSX.utils.book_new();
    const data = [['Device ID','Device Name','User','Started','Ended','Scans','Tickets','Platform'], ...sessions.map(s => [s.deviceId, s.deviceName||'', s.user?.email||'', new Date(s.startedAt).toLocaleString(), s.endedAt ? new Date(s.endedAt).toLocaleString() : 'Active', s.scanCount, s.ticketsCreated, s.platform||''])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Handheld Sessions');
    XLSX.writeFile(wb, `handheld_sessions_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  /* Aggregated stats */
  const totalMissing = reports.reduce((s,r)=>s+(r.details?.missingCount||0),0);
  const totalScanned = reports.reduce((s,r)=>s+(r.details?.totalScanned||0),0);
  const warningCount = reports.filter(r=>r.severity==='WARNING').length;
  const totalLinkedTickets = reports.reduce((s,r)=>s+r.linkedTickets.length,0);
  const critBattery = lowBattery.filter(t => (t.batteryLevel||0) <= 10).length;

  const filtered = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    const d = r.details||{} as ReportDetails;
    return (r.submitter?.name||'').toLowerCase().includes(q)||(r.submitter?.email||d.submittedByEmail||'').toLowerCase().includes(q)||(d.floorNumber||'').toLowerCase().includes(q)||(d.roomNumber||'').toLowerCase().includes(q)||(d.note||'').toLowerCase().includes(q);
  });

  const TABS = [
    { key:'active',    label:'Audit Reports',       Icon:ClipboardList,  count:total,              color:'indigo' },
    { key:'completed', label:'Completed',            Icon:CheckCheck,     count:completedCount,     color:'emerald' },
    { key:'sessions',  label:'Handheld Sessions',   Icon:Smartphone,     count:sessionStats.totalSessions||0, color:'teal' },
    { key:'battery',   label:'Battery Alerts',      Icon:Battery,        count:lowBattery.length,  color:'red' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">

      {/* ════ HERO ════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-teal-900">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>
        {/* Glows */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"/>
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-teal-500/15 blur-3xl pointer-events-none"/>

        <div className="relative px-6 py-10 max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 shadow-xl">
                  <Smartphone className="h-7 w-7 text-white"/>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Handheld Audit</h1>
                    <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 text-xs">Live</Badge>
                  </div>
                  <p className="text-slate-300 text-sm mt-0.5">Inventory reconciliation · Device activity · RFID battery monitoring</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => { if(activeTab==='sessions') fetchSessions(); else if(activeTab==='battery') fetchBattery(); else fetchReports(page,severityFilter,activeTab,true); }} disabled={refreshing}
                className="border-white/20 text-white hover:bg-white/10 bg-white/5 backdrop-blur-sm gap-2">
                <RefreshCw className={cn('h-4 w-4', refreshing&&'animate-spin')}/> Refresh
              </Button>
              {activeTab === 'sessions' && (
                <Button variant="outline" size="sm" onClick={exportSessions} className="border-white/20 text-white hover:bg-white/10 bg-white/5 backdrop-blur-sm gap-2">
                  <Download className="h-4 w-4"/> Export Sessions
                </Button>
              )}
            </div>
          </div>

          {/* Hero stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label:'Audit Reports', value:total+completedCount, Icon:ClipboardList, grad:'from-indigo-500/20 to-indigo-500/5', border:'border-indigo-400/20', text:'text-indigo-200', sub:'text-indigo-400' },
              { label:'Alert Reports', value:warningCount, Icon:AlertTriangle, grad:'from-amber-500/20 to-amber-500/5', border:'border-amber-400/20', text:'text-amber-200', sub:'text-amber-400' },
              { label:'Items Scanned', value:totalScanned, Icon:ScanLine, grad:'from-blue-500/20 to-blue-500/5', border:'border-blue-400/20', text:'text-blue-200', sub:'text-blue-400' },
              { label:'Missing Items', value:totalMissing, Icon:ShieldAlert, grad:'from-red-500/20 to-red-500/5', border:'border-red-400/20', text:'text-red-200', sub:'text-red-400' },
              { label:'Handheld Sessions', value:sessionStats.totalSessions||0, Icon:Smartphone, grad:'from-teal-500/20 to-teal-500/5', border:'border-teal-400/20', text:'text-teal-200', sub:'text-teal-400' },
              { label:'Low Battery Tags', value:lowBattery.length, Icon:Battery, grad:'from-orange-500/20 to-orange-500/5', border:'border-orange-400/20', text:'text-orange-200', sub:'text-orange-400' },
            ].map(s => { const Icon=s.Icon; return (
              <motion.div key={s.label} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
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

      {/* ════ TOOLBAR ════ */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-background/90 backdrop-blur-md border-b border-slate-100 dark:border-border shadow-sm">
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 pt-3 flex items-center gap-1 overflow-x-auto">
          {TABS.map(t => { const Icon=t.Icon; const isActive=activeTab===t.key;
            const colors: Record<string, string> = { indigo:'border-indigo-600 text-indigo-700 bg-indigo-50', emerald:'border-emerald-600 text-emerald-700 bg-emerald-50', teal:'border-teal-600 text-teal-700 bg-teal-50', red:'border-red-500 text-red-700 bg-red-50' };
            const badgeColors: Record<string, string> = { indigo:'bg-indigo-100 text-indigo-700', emerald:'bg-emerald-100 text-emerald-700', teal:'bg-teal-100 text-teal-700', red:'bg-red-100 text-red-700' };
            return (
            <button key={t.key} onClick={()=>handleTabChange(t.key)}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold border border-b-0 transition-all whitespace-nowrap',
                isActive ? colors[t.color] : 'border-transparent text-slate-400 hover:text-slate-600 bg-transparent')}>
              <Icon className="h-4 w-4"/>
              {t.label}
              <span className={cn('ml-0.5 px-2 py-0.5 rounded-full text-xs font-bold', isActive ? badgeColors[t.color] : 'bg-slate-100 text-slate-400')}>
                {t.count}
              </span>
            </button>
          );})}
        </div>

        {/* Search/filter bar — only for audit tabs */}
        {(activeTab === 'active' || activeTab === 'completed') && (
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap border-t border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
              <Input placeholder="Search staff, location, note…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200"/>
            </div>
            <Select value={severityFilter} onValueChange={handleSevChange}>
              <SelectTrigger className="w-44 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400"/><SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Reports</SelectItem>
                <SelectItem value="WARNING">⚠ With Alerts</SelectItem>
                <SelectItem value="INFO">✓ All Clear</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1.5 text-xs text-slate-500 font-medium">
              <Activity className="h-3.5 w-3.5"/>{filtered.length} of {total} reports
            </div>
          </div>
        )}

        {/* Battery threshold bar */}
        {activeTab === 'battery' && (
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4 border-t border-slate-100">
            <span className="text-sm font-semibold text-slate-600">Alert threshold:</span>
            <Input type="number" min="5" max="50" value={batteryThreshold} onChange={e => setBatteryThreshold(Number(e.target.value))} className="w-20 h-8 text-sm"/>
            <span className="text-sm text-slate-400">%</span>
            <Button size="sm" variant="outline" onClick={fetchBattery} disabled={batteryLoading} className="gap-2 h-8">
              <RefreshCw className={cn('h-3.5 w-3.5', batteryLoading && 'animate-spin')}/> Apply
            </Button>
            {critBattery > 0 && <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="h-3 w-3 mr-1"/>{critBattery} critical (≤10%)</Badge>}
          </div>
        )}
      </div>

      {/* ════ CONTENT ════ */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Audit Reports Tabs ── */}
        {(activeTab === 'active' || activeTab === 'completed') && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                <div className="relative w-16 h-16 mb-4">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin"/>
                  <ClipboardList className="absolute inset-0 m-auto h-6 w-6 text-indigo-400"/>
                </div>
                <p className="font-semibold text-slate-500">Loading audit reports…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                <div className={cn('p-6 rounded-3xl mb-4', activeTab==='completed' ? 'bg-emerald-50' : 'bg-slate-100')}>
                  {activeTab==='completed' ? <CheckCheck className="h-14 w-14 text-emerald-300"/> : <ClipboardList className="h-14 w-14 text-slate-300"/>}
                </div>
                <p className="text-xl font-bold text-slate-500">{activeTab==='completed' ? 'No completed reports yet' : 'No active reports found'}</p>
                <p className="text-sm mt-1">{search ? 'Try a different search term.' : activeTab==='completed' ? 'Mark reports as complete to see them here.' : 'No inventory reconciliation reports submitted yet.'}</p>
                {search && <Button variant="ghost" size="sm" className="mt-3 gap-2" onClick={()=>setSearch('')}><X className="h-4 w-4"/> Clear search</Button>}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map(r => (
                  <ReportCard key={r.id} report={r}
                    onViewAssets={()=>setAssetModal(r)}
                    onCreateTicket={()=>setTicketModal(r)}
                    onViewStaff={()=>setStaffDialog({report:r})}
                    onComplete={activeTab==='active' ? (rep)=>setCompleteTarget(rep) : undefined}
                    onReopen={activeTab==='completed' ? (rep)=>handleReopen(rep) : undefined}
                  />
                ))}
              </div>
            )}
            {totalPages > 1 && !loading && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>fetchReports(page-1,severityFilter,activeTab)}>← Prev</Button>
                <div className="flex items-center gap-1">
                  {Array.from({length:Math.min(7,totalPages)},(_,i)=>i+1).map(p => (
                    <button key={p} onClick={()=>fetchReports(p,severityFilter,activeTab)}
                      className={cn('w-8 h-8 rounded-lg text-sm font-medium transition-all', p===page ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>{p}</button>
                  ))}
                </div>
                <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>fetchReports(page+1,severityFilter,activeTab)}>Next →</Button>
              </div>
            )}
          </>
        )}

        {/* ── Handheld Sessions Tab ── */}
        {activeTab === 'sessions' && (
          <>
            {/* Summary stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              {[
                { label:'Total Sessions', value:sessionStats.totalSessions||0, Icon:Activity, col:'text-slate-700', bg:'bg-slate-50 border-slate-200', sub:null },
                { label:'Active Users', value:sessionStats.uniqueUsers||0, Icon:Users, col:'text-indigo-600', bg:'bg-indigo-50 border-indigo-200', sub:null },
                { label:'Total Scans', value:sessionStats.totalScans||0, Icon:Scan, col:'text-blue-600', bg:'bg-blue-50 border-blue-200', sub:null },
                { label:'Tickets Created', value:sessionStats.totalTickets||0, Icon:Ticket, col:'text-purple-600', bg:'bg-purple-50 border-purple-200', sub:null },
                { label:'Unique Devices', value:sessionStats.uniqueDevices||0, Icon:Smartphone, col:'text-teal-600', bg:'bg-teal-50 border-teal-200', sub:null },
              ].map(({ label, value, Icon, col, bg }) => (
                <motion.div key={label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                  className={cn('rounded-2xl border p-4 flex items-center gap-3', bg)}>
                  <div className="p-2 rounded-xl bg-white shadow-sm flex-shrink-0"><Icon className={cn('h-4 w-4', col)}/></div>
                  <div><p className={cn('text-2xl font-extrabold', col)}>{value}</p><p className="text-xs text-slate-500 mt-0.5">{label}</p></div>
                </motion.div>
              ))}
            </div>

            {/* AI headline */}
            {users.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800 mb-5">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0">
                  <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400"/>
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-0.5">AI Field Activity Insights</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">
                    {users.length} active technician{users.length !== 1 ? 's' : ''} · {sessionStats.totalScans || 0} total scans · Top performer: <strong>{users[0]?.email?.split('@')[0]}</strong> ({users[0]?.totalScans || 0} scans, AI score {users[0]?.productivityScore || 0}).
                    Click any user card to view their full session history.
                  </p>
                </div>
              </div>
            )}

            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                <div className="p-6 rounded-3xl bg-slate-100 mb-4"><Smartphone className="h-14 w-14 text-slate-300"/></div>
                <p className="text-xl font-bold text-slate-500">No handheld sessions yet</p>
                <p className="text-sm mt-1">Sessions are recorded automatically when technicians open the handheld app.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((userData) => (
                  <div key={userData.userId}>
                    <UserCard
                      userData={userData}
                      isExpanded={expandedUserId === userData.userId}
                      onClick={() => setExpandedUserId(prev => prev === userData.userId ? null : userData.userId)}
                    />
                    <AnimatePresence>
                      {expandedUserId === userData.userId && (
                        <motion.div
                          initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                          transition={{duration:0.25}} className="overflow-hidden">
                          <div className="mt-3 ml-4">
                            {/* User aggregate bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                              {[
                                { label:'Total Duration', value:fmtMs(userData.totalDurationMs), Icon:Clock, col:'text-indigo-600' },
                                { label:'Avg Session', value:fmtMs(userData.avgDurationMs), Icon:Activity, col:'text-blue-600' },
                                { label:'Scan Rate', value:userData.scansPerHour ? `${userData.scansPerHour}/h` : '—', Icon:Gauge, col:'text-teal-600' },
                                { label:'Avg Battery Drain', value:userData.avgBatteryDrain != null ? `-${userData.avgBatteryDrain}%` : '—', Icon:BatteryLow, col:'text-amber-600' },
                              ].map(({ label, value, Icon, col }) => (
                                <div key={label} className="flex items-center gap-2">
                                  <Icon className={cn('h-4 w-4 flex-shrink-0', col)}/>
                                  <div><p className={cn('text-sm font-bold', col)}>{value}</p><p className="text-xs text-slate-400">{label}</p></div>
                                </div>
                              ))}
                            </div>

                            {/* Session timeline */}
                            <div className="relative">
                              {userData.sessions.map((session: any, idx: number) => (
                                <SessionTimelineCard key={session.id} session={session} idx={idx}/>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Battery Alerts Tab ── */}
        {activeTab === 'battery' && (
          <>
            {/* Battery tier cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label:'Critical (≤10%)', count:lowBattery.filter(t=>(t.batteryLevel||0)<=10).length, col:'text-red-600', bg:'bg-red-50 border-red-200', Icon:BatteryWarning },
                { label:`Warning (11–20%)`, count:lowBattery.filter(t=>(t.batteryLevel||0)>10&&(t.batteryLevel||0)<=20).length, col:'text-orange-600', bg:'bg-orange-50 border-orange-200', Icon:BatteryLow },
                { label:`Low (21–${batteryThreshold}%)`, count:lowBattery.filter(t=>(t.batteryLevel||0)>20).length, col:'text-yellow-600', bg:'bg-yellow-50 border-yellow-200', Icon:Battery },
              ].map(({ label, count, col, bg, Icon }) => (
                <motion.div key={label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                  className={cn('rounded-2xl border p-5 flex items-center gap-4', bg)}>
                  <div className="p-2.5 rounded-xl bg-white shadow-sm"><Icon className={cn('h-5 w-5', col)}/></div>
                  <div><p className={cn('text-3xl font-extrabold', col)}>{count}</p><p className="text-xs text-slate-500 mt-0.5">{label}</p></div>
                </motion.div>
              ))}
            </div>

            {batteryLoading ? (
              <div className="flex flex-col items-center py-24 text-slate-400">
                <div className="w-12 h-12 rounded-full border-4 border-orange-100 border-t-orange-500 animate-spin mb-4"/>
                <p>Loading battery data…</p>
              </div>
            ) : lowBattery.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="p-6 rounded-3xl bg-green-50 mb-4"><Battery className="h-14 w-14 text-green-400"/></div>
                <p className="text-xl font-bold text-green-700">All tags have sufficient battery</p>
                <p className="text-sm text-slate-400 mt-1">No tags below {batteryThreshold}%</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lowBattery.map(tag => <BatteryTagRow key={tag.id} tag={tag}/>)}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      <AssetListModal open={!!assetModal} onClose={()=>setAssetModal(null)} report={assetModal}/>
      <CreateTicketModal open={!!ticketModal} onClose={()=>setTicketModal(null)} report={ticketModal} staffUsers={staffUsers} onCreated={ticket => { if(ticketModal) handleTicketCreated(ticketModal.id, ticket); }}/>
      <StaffPerformanceDialog open={!!staffDialog} onClose={()=>setStaffDialog(null)} userId={staffDialog?.report?.submitter?.id||staffDialog?.report?.userId} staffName={staffDialog?.report?.submitter?.name||staffDialog?.report?.details?.submittedByName} staffEmail={staffDialog?.report?.submitter?.email||staffDialog?.report?.details?.submittedByEmail}/>
      <ConfirmCompleteDialog open={!!completeTarget} onClose={()=>setCompleteTarget(null)} report={completeTarget} loading={completeLoading} onConfirm={handleComplete}/>
    </div>
  );
}

export default function HandheldAuditWrapper() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <HandheldAuditPage/>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
