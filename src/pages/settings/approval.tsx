// @ts-nocheck
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckSquare, CheckCircle, XCircle, Clock, User, Users,
  ArrowRight, RefreshCw, Layers, AlertTriangle, Shield,
  GitBranch, BarChart3, Search, ChevronDown, ChevronUp,
  Building2, Briefcase, Mail, Link2, UserCheck, UserX,
  TrendingUp, Activity, Zap, Eye, Filter, Download,
  Star, Circle, MoreHorizontal, Edit3, Save, X, Plus,
  History, Network, Award, Target
} from 'lucide-react';

/* ─────────────────── helpers ─────────────────── */
const DLM_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any; glow: string }> = {
  PENDING_DLM:  { label: 'Pending DLM',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: Clock,        glow: 'shadow-amber-100' },
  DLM_APPROVED: { label: 'DLM Approved', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle,  glow: 'shadow-emerald-100' },
  DLM_REJECTED: { label: 'DLM Rejected', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',        icon: XCircle,      glow: 'shadow-red-100' },
};

const PRIORITY_META: Record<string, { color: string; dot: string }> = {
  CRITICAL: { color: 'text-red-600 bg-red-50',      dot: 'bg-red-500' },
  HIGH:     { color: 'text-orange-600 bg-orange-50', dot: 'bg-orange-500' },
  MEDIUM:   { color: 'text-amber-600 bg-amber-50',   dot: 'bg-amber-400' },
  LOW:      { color: 'text-blue-600 bg-blue-50',     dot: 'bg-blue-400' },
};

const ENTITY_META: Record<string, { color: string; icon: any }> = {
  TICKET:   { color: 'text-violet-700 bg-violet-50 border-violet-200', icon: CheckSquare },
  BORROW:   { color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: GitBranch },
  DISPOSAL: { color: 'text-red-700 bg-red-50 border-red-200',          icon: XCircle },
  TRANSFER: { color: 'text-teal-700 bg-teal-50 border-teal-200',       icon: ArrowRight },
};

function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['from-violet-500 to-purple-600', 'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600',
                  'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600', 'from-cyan-500 to-sky-600'];
  const colorIdx = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, trend }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all group`}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${color} opacity-5`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span className="text-emerald-600 font-medium">{trend}</span>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children, color = 'text-violet-600' }: any) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{children}</span>
    </div>
  );
}

/* ─────────────────── main page ─────────────────── */
const TABS = [
  { id: 'overview',   label: 'Overview',        icon: BarChart3,  color: 'violet' },
  { id: 'pending',    label: 'Pending',          icon: Clock,      color: 'amber' },
  { id: 'dlm',        label: 'DLM Assignment',   icon: UserCheck,  color: 'blue' },
  { id: 'directory',  label: 'User Directory',   icon: Network,    color: 'teal' },
  { id: 'history',    label: 'Approval History', icon: History,    color: 'slate' },
  { id: 'chains',     label: 'Chains',           icon: Layers,     color: 'indigo' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function ApprovalManagementPage() {
  const { toast } = useToast();

  /* ── data state ── */
  const [tab, setTab] = useState<TabId>('overview');
  const [chains,   setChains]   = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [dlmUsers, setDlmUsers] = useState<any[]>([]);
  const [history,  setHistory]  = useState<any[]>([]);
  const [historyStats, setHistoryStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<string | null>(null);

  /* ── search / filter ── */
  const [userSearch,   setUserSearch]   = useState('');
  const [histFilter,   setHistFilter]   = useState('ALL');
  const [dirSearch,    setDirSearch]    = useState('');
  const [dirDeptFilter, setDirDeptFilter] = useState('ALL');

  /* ── DLM assignment UI ── */
  const [assigningId,  setAssigningId]  = useState<string | null>(null);
  const [managerSearch,setManagerSearch]= useState('');
  const [savingDlm,    setSavingDlm]    = useState(false);

  /* ── chain form ── */
  const [showNew,  setShowNew]  = useState(false);
  const [form,     setForm]     = useState({ name: '', description: '', entityType: 'TICKET', steps: [] as any[] });
  const [stepRole, setStepRole] = useState('MANAGER');

  /* ─── fetch ─── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, u, h] = await Promise.all([
        fetch('/api/approval/chains').then(x => x.json()).catch(() => []),
        fetch('/api/approval/requests?pendingFor=me').then(x => x.json()).catch(() => []),
        fetch('/api/dlm/users').then(x => x.json()).catch(() => ({ users: [] })),
        fetch('/api/dlm/history').then(x => x.json()).catch(() => ({ tickets: [], stats: {} })),
      ]);
      setChains(Array.isArray(c) ? c : []);
      setRequests(Array.isArray(r) ? r : []);
      setDlmUsers(Array.isArray(u?.users) ? u.users : []);
      setHistory(Array.isArray(h?.tickets) ? h.tickets : []);
      setHistoryStats(h?.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── decisions ─── */
  const decide = async (requestId: string, stepId: string, decision: 'APPROVED' | 'REJECTED') => {
    const reason = decision === 'REJECTED' ? window.prompt('Rejection reason (optional):') : undefined;
    setDeciding(stepId);
    const res = await fetch(`/api/approval/requests/${requestId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, decision, comment: reason }),
    });
    setDeciding(null);
    if (res.ok) { toast({ title: `Request ${decision.toLowerCase()}` }); fetchAll(); }
    else toast({ variant: 'destructive', title: 'Failed to decide' });
  };

  /* ─── DLM assign ─── */
  const assignDlm = async (userId: string, managerId: string | null) => {
    setSavingDlm(true);
    const res = await fetch('/api/dlm/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, managerId }),
    });
    setSavingDlm(false);
    if (res.ok) {
      toast({ title: 'DLM assigned successfully' });
      setAssigningId(null);
      setManagerSearch('');
      fetchAll();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: err.error || 'Failed to assign DLM' });
    }
  };

  /* ─── create chain ─── */
  const createChain = async () => {
    if (!form.name) { toast({ variant: 'destructive', title: 'Name required' }); return; }
    const res = await fetch('/api/approval/chains', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: 'Approval chain created' }); setShowNew(false); fetchAll(); }
  };

  /* ─── derived / memos ─── */
  const departments = useMemo(() => {
    const s = new Set<string>();
    dlmUsers.forEach(u => { if (u.department) s.add(u.department); });
    return ['ALL', ...Array.from(s).sort()];
  }, [dlmUsers]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return dlmUsers.filter(u =>
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.jobTitle?.toLowerCase().includes(q)
    );
  }, [dlmUsers, userSearch]);

  const filteredDir = useMemo(() => {
    const q = dirSearch.toLowerCase();
    return dlmUsers.filter(u => {
      const matchDept = dirDeptFilter === 'ALL' || u.department === dirDeptFilter;
      const matchSearch = !q ||
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.jobTitle?.toLowerCase().includes(q);
      return matchDept && matchSearch;
    });
  }, [dlmUsers, dirSearch, dirDeptFilter]);

  const filteredHistory = useMemo(() => {
    if (histFilter === 'ALL') return history;
    return history.filter(t => t.dlmApprovalStatus === histFilter);
  }, [history, histFilter]);

  const managerCandidates = useMemo(() => {
    const q = managerSearch.toLowerCase();
    return dlmUsers.filter(u =>
      u.id !== assigningId &&
      (!q || u.email?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [dlmUsers, managerSearch, assigningId]);

  /* ─────────────────── RENDER ─────────────────── */
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">

        {/* ══ HERO HEADER ══ */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-indigo-900 to-purple-900 px-6 pt-8 pb-6">
          {/* decorative blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-20 w-48 h-48 bg-indigo-400/15 rounded-full blur-2xl translate-y-1/2 pointer-events-none" />

          <div className="relative max-w-7xl mx-auto">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-white tracking-tight">Approval Management</h1>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-xs text-white/80 font-medium">
                      Enterprise
                    </span>
                  </div>
                  <p className="text-sm text-white/60 mt-0.5">
                    Multi-level approvals · DLM hierarchy · Dynamics 365 org-chart integration
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAll}
                className="border-white/20 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* hero stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Total DLM Tickets', value: historyStats.total,    icon: Activity,     color: 'text-white' },
                { label: 'Pending DLM',        value: historyStats.pending,  icon: Clock,        color: 'text-amber-300' },
                { label: 'DLM Approved',       value: historyStats.approved, icon: CheckCircle,  color: 'text-emerald-300' },
                { label: 'DLM Rejected',       value: historyStats.rejected, icon: XCircle,      color: 'text-red-300' },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                    <span className="text-xs text-white/50 font-medium">{s.label}</span>
                  </div>
                  <p className="text-2xl font-black text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* pending alert bar */}
        {requests.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 flex items-center gap-2 shadow">
            <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
            <p className="text-sm text-white font-medium">
              You have <strong>{requests.length}</strong> pending approval request{requests.length !== 1 ? 's' : ''} awaiting your decision.
            </p>
            <button onClick={() => setTab('pending')} className="ml-auto text-xs underline text-white/90 hover:text-white">
              View now →
            </button>
          </div>
        )}

        {/* ══ TABS ══ */}
        <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-6">
          <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              const badge = t.id === 'pending' && requests.length > 0 ? requests.length : null;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                    active
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {badge && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* ══════════════ OVERVIEW ══════════════ */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users}       label="Total Users"      value={dlmUsers.length}            color="from-violet-500 to-purple-600" sub="Across all departments" />
                <StatCard icon={UserCheck}   label="Users with DLM"   value={dlmUsers.filter(u => u.managerId).length} color="from-blue-500 to-indigo-600"  sub="DLM assignments active" />
                <StatCard icon={Layers}      label="Approval Chains"  value={chains.length}              color="from-teal-500 to-emerald-600"  sub="Configured workflows" />
                <StatCard icon={Clock}       label="Pending Requests" value={requests.length}            color="from-amber-500 to-orange-600"  sub="Awaiting your decision" />
              </div>

              {/* DLM coverage by dept */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <SectionTitle icon={Building2} color="text-indigo-600">DLM Coverage by Department</SectionTitle>
                  <div className="mt-4 space-y-2.5">
                    {departments.filter(d => d !== 'ALL').slice(0, 8).map(dept => {
                      const deptUsers = dlmUsers.filter(u => u.department === dept);
                      const withDlm = deptUsers.filter(u => u.managerId).length;
                      const pct = deptUsers.length ? Math.round((withDlm / deptUsers.length) * 100) : 0;
                      return (
                        <div key={dept}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700 truncate">{dept}</span>
                            <span className="text-gray-400 ml-2 flex-shrink-0">{withDlm}/{deptUsers.length} · {pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {departments.filter(d => d !== 'ALL').length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">No departments configured yet.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <SectionTitle icon={History} color="text-violet-600">Recent DLM Decisions</SectionTitle>
                  <div className="mt-4 space-y-2">
                    {history.filter(t => t.dlmApprovalStatus !== 'PENDING_DLM').slice(0, 5).map(t => {
                      const meta = DLM_STATUS_META[t.dlmApprovalStatus] || {};
                      const Icon = meta.icon || Circle;
                      return (
                        <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                          <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{t.title || t.displayId}</p>
                            <p className="text-xs text-gray-400">{t.user?.displayName || t.user?.email} → {t.dlm?.displayName || t.dlm?.email}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>{meta.label}</span>
                        </div>
                      );
                    })}
                    {history.filter(t => t.dlmApprovalStatus !== 'PENDING_DLM').length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-8">No decisions yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* users without DLM alert */}
              {dlmUsers.filter(u => !u.managerId).length > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {dlmUsers.filter(u => !u.managerId).length} user{dlmUsers.filter(u => !u.managerId).length !== 1 ? 's' : ''} without a DLM assigned
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      IT tickets from these users will not route through DLM approval. Assign DLMs in the <button onClick={() => setTab('dlm')} className="underline font-medium">DLM Assignment</button> tab.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ PENDING APPROVALS ══════════════ */}
          {tab === 'pending' && (
            <div className="space-y-4">
              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-violet-400 mb-3" />
                  <p className="text-sm text-gray-400">Loading approvals…</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-lg font-bold text-gray-700">All caught up!</p>
                  <p className="text-sm text-gray-400 mt-1">No pending approval requests for you right now.</p>
                </div>
              ) : (
                requests.map(req => {
                  const myStep = req.steps?.find((s: any) => s.status === 'PENDING');
                  const entityMeta = ENTITY_META[req.entityType] || ENTITY_META.TICKET;
                  const EntityIcon = entityMeta.icon;
                  return (
                    <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                        <EntityIcon className="w-4 h-4 text-amber-600" />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${entityMeta.color}`}>{req.entityType}</span>
                        <span className="text-xs text-gray-500 font-mono">{req.entityId?.slice(0, 12)}…</span>
                        <span className="ml-auto text-xs text-amber-600 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Awaiting your approval
                        </span>
                      </div>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Avatar name={req.requestedBy?.email} size="sm" />
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {req.requestedBy?.email}
                                </p>
                                <p className="text-xs text-gray-400">Submitted a {req.chain?.name || req.entityType} request</p>
                              </div>
                            </div>
                            {req.notes && (
                              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 italic mb-3">
                                "{req.notes}"
                              </div>
                            )}
                            {/* step progress */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {req.steps?.map((s: any, i: number) => {
                                const done = s.status === 'APPROVED';
                                const rejected = s.status === 'REJECTED';
                                const active = s.status === 'PENDING';
                                return (
                                  <React.Fragment key={s.id}>
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                      done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                      rejected ? 'bg-red-50 border-red-200 text-red-700' :
                                      active ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm shadow-amber-100' :
                                      'bg-gray-50 border-gray-200 text-gray-400'
                                    }`}>
                                      {done ? <CheckCircle className="w-3 h-3" /> : rejected ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                      <span>Step {s.stepOrder + 1}</span>
                                      <span className="opacity-70">· {s.assignedTo?.email?.split('@')[0]}</span>
                                    </div>
                                    {i < req.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                          {myStep && (
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                                disabled={deciding === myStep.id}
                                onClick={() => decide(req.id, myStep.id, 'APPROVED')}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                disabled={deciding === myStep.id}
                                onClick={() => decide(req.id, myStep.id, 'REJECTED')}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1.5" />Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══════════════ DLM ASSIGNMENT ══════════════ */}
          {tab === 'dlm' && (
            <div className="space-y-5">
              {/* search */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, department…"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  />
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {filteredUsers.length} of {dlmUsers.length} users
                </div>
              </div>

              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-violet-400 mb-3" />
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map(u => {
                    const isAssigning = assigningId === u.id;
                    const isMsLinked = !!u.azureAdId;
                    return (
                      <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar name={u.displayName || u.email} size="md" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 text-sm truncate">
                                  {u.displayName || u.email}
                                </span>
                                {isMsLinked && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 font-medium flex items-center gap-1">
                                    <Link2 className="w-2.5 h-2.5" />Dynamics 365
                                  </span>
                                )}
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{u.role}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>
                                {u.jobTitle && <span className="text-xs text-gray-400 flex items-center gap-1"><Briefcase className="w-3 h-3" />{u.jobTitle}</span>}
                                {u.department && <span className="text-xs text-gray-400 flex items-center gap-1"><Building2 className="w-3 h-3" />{u.department}</span>}
                              </div>
                            </div>

                            {/* current DLM */}
                            <div className="flex-shrink-0 text-right">
                              {u.manager ? (
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="text-right">
                                    <p className="text-xs font-semibold text-gray-700">{u.manager.displayName || u.manager.email}</p>
                                    <p className="text-xs text-gray-400">Current DLM</p>
                                  </div>
                                  <Avatar name={u.manager.displayName || u.manager.email} size="sm" />
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-200 px-2 py-1 rounded-lg">No DLM</span>
                              )}
                            </div>

                            {/* action button */}
                            <button
                              onClick={() => {
                                setAssigningId(isAssigning ? null : u.id);
                                setManagerSearch('');
                              }}
                              className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                isAssigning ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-400 hover:bg-violet-50 hover:text-violet-600'
                              }`}
                            >
                              {isAssigning ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* DLM picker (expanded) */}
                          {isAssigning && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assign Direct Line Manager (DLM)</p>
                              <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search for a manager…"
                                  value={managerSearch}
                                  onChange={e => setManagerSearch(e.target.value)}
                                  className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                                />
                              </div>
                              <div className="space-y-1 max-h-56 overflow-y-auto">
                                {/* clear option */}
                                {u.managerId && (
                                  <button
                                    onClick={() => assignDlm(u.id, null)}
                                    disabled={savingDlm}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <UserX className="w-4 h-4" />
                                    <span>Remove DLM assignment</span>
                                  </button>
                                )}
                                {managerCandidates.map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => assignDlm(u.id, m.id)}
                                    disabled={savingDlm}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-violet-50 rounded-lg transition-colors text-left"
                                  >
                                    <Avatar name={m.displayName || m.email} size="sm" />
                                    <div className="min-w-0">
                                      <p className="font-medium text-gray-800 truncate">{m.displayName || m.email}</p>
                                      <p className="text-xs text-gray-400 truncate">{m.jobTitle}{m.department ? ` · ${m.department}` : ''}</p>
                                    </div>
                                    {m.id === u.managerId && (
                                      <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0" />
                                    )}
                                  </button>
                                ))}
                                {managerCandidates.length === 0 && (
                                  <p className="text-xs text-gray-400 text-center py-4">No users found.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
                      <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                      <p className="text-sm text-gray-400">No users match your search.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ USER DIRECTORY ══════════════ */}
          {tab === 'directory' && (
            <div className="space-y-4">
              {/* filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name, email, job title…"
                    value={dirSearch}
                    onChange={e => setDirSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  />
                </div>
                <select
                  value={dirDeptFilter}
                  onChange={e => setDirDeptFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                >
                  {departments.map(d => <option key={d} value={d}>{d === 'ALL' ? 'All Departments' : d}</option>)}
                </select>
                <span className="text-xs text-gray-400">{filteredDir.length} users</span>
              </div>

              {/* table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Department</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Direct Line Manager</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">DLM Tickets</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Integration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredDir.map(u => {
                        const dlmTicketCount = u.dlmApprovalTickets?.length || 0;
                        const pendingCount = u.dlmApprovalTickets?.filter((t: any) => t.dlmApprovalStatus === 'PENDING_DLM').length || 0;
                        return (
                          <tr key={u.id} className="hover:bg-violet-50/30 transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={u.displayName || u.email} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 truncate">{u.displayName || '—'}</p>
                                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                {u.department && <p className="font-medium text-gray-700">{u.department}</p>}
                                {u.jobTitle && <p className="text-xs text-gray-400">{u.jobTitle}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {u.manager ? (
                                <div className="flex items-center gap-2">
                                  <Avatar name={u.manager.displayName || u.manager.email} size="sm" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{u.manager.displayName || u.manager.email}</p>
                                    {u.manager.jobTitle && <p className="text-xs text-gray-400 truncate">{u.manager.jobTitle}</p>}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />Not assigned
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {dlmTicketCount > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-gray-800">{dlmTicketCount}</span>
                                  {pendingCount > 0 && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{pendingCount} pending</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {u.azureAdId ? (
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium flex items-center gap-1 w-fit">
                                  <Link2 className="w-3 h-3" />Dynamics 365
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">Local only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredDir.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">No users found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ APPROVAL HISTORY ══════════════ */}
          {tab === 'history' && (
            <div className="space-y-4">
              {/* filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {['ALL', 'PENDING_DLM', 'DLM_APPROVED', 'DLM_REJECTED'].map(f => (
                  <button
                    key={f}
                    onClick={() => setHistFilter(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      histFilter === f
                        ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                    }`}
                  >
                    {f === 'ALL' ? `All (${history.length})` :
                     f === 'PENDING_DLM' ? `Pending (${historyStats.pending})` :
                     f === 'DLM_APPROVED' ? `Approved (${historyStats.approved})` :
                     `Rejected (${historyStats.rejected})`}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-violet-400 mb-3" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
                  <History className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-400">No approval history found.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Requester</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">DLM</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">DLM Status</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Comment</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredHistory.map(t => {
                          const meta = DLM_STATUS_META[t.dlmApprovalStatus] || {};
                          const StatusIcon = meta.icon || Circle;
                          const priMeta = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM;
                          return (
                            <tr key={t.id} className="hover:bg-violet-50/30 transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <a href={`/tickets/${t.id}`} className="font-bold text-violet-700 hover:underline">
                                    {t.displayId || t.id?.slice(0, 8)}
                                  </a>
                                  <p className="text-xs text-gray-500 truncate max-w-[160px]">{t.title}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Avatar name={t.user?.displayName || t.user?.email} size="sm" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{t.user?.displayName || t.user?.email}</p>
                                    {t.user?.department && <p className="text-xs text-gray-400">{t.user.department}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {t.dlm ? (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar name={t.dlm?.displayName || t.dlm?.email} size="sm" />
                                    <p className="font-medium text-gray-800 truncate">{t.dlm.displayName || t.dlm.email}</p>
                                  </div>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.bg} ${meta.color}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {meta.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md">{t.category || '—'}</span>
                              </td>
                              <td className="px-4 py-3">
                                {t.dlmComment ? (
                                  <span className="text-xs text-gray-600 italic truncate max-w-[140px] block">{t.dlmComment}</span>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {t.dlmDecidedAt
                                    ? new Date(t.dlmDecidedAt).toLocaleDateString()
                                    : new Date(t.createdAt).toLocaleDateString()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ CHAINS ══════════════ */}
          {tab === 'chains' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setShowNew(p => !p)} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" />New Chain
                </Button>
              </div>

              {showNew && (
                <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Create Approval Chain</h3>
                      <p className="text-xs text-gray-400">Define multi-step approval workflows</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Chain Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Asset Disposal Approval"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Entity Type</label>
                      <select
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                        value={form.entityType}
                        onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}
                      >
                        {['TICKET', 'BORROW', 'DISPOSAL', 'TRANSFER'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Approval Steps</label>
                    <div className="flex gap-2 mb-3">
                      <select
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white flex-1 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                        value={stepRole}
                        onChange={e => setStepRole(e.target.value)}
                      >
                        {['ADMIN', 'MANAGER', 'STAFF'].map(r => <option key={r}>{r}</option>)}
                      </select>
                      <Button size="sm" variant="outline" onClick={() => setForm(f => ({ ...f, steps: [...f.steps, { role: stepRole, order: f.steps.length }] }))}>
                        <Plus className="w-3.5 h-3.5 mr-1.5" />Add Step
                      </Button>
                    </div>
                    {form.steps.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {form.steps.map((s, i) => (
                          <React.Fragment key={i}>
                            <span className="text-xs px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 font-medium">
                              Step {i + 1}: {s.role}
                            </span>
                            {i < form.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Button onClick={createChain} className="bg-violet-600 hover:bg-violet-700">Create Chain</Button>
                    <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {chains.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
                  <Layers className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">No approval chains yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Create one to enable multi-step workflows.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chains.map(chain => {
                    const entityMeta = ENTITY_META[chain.entityType] || ENTITY_META.TICKET;
                    const EntityIcon = entityMeta.icon;
                    return (
                      <div key={chain.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${entityMeta.color}`}>
                              <EntityIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900">{chain.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${chain.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                  {chain.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              {chain.description && <p className="text-xs text-gray-400 mt-0.5">{chain.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                              {chain._count?.requests || 0} requests
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${entityMeta.color}`}>{chain.entityType}</span>
                          </div>
                        </div>
                        {Array.isArray(chain.steps) && chain.steps.length > 0 && (
                          <div className="mt-4 flex items-center gap-2 flex-wrap">
                            {chain.steps.map((s: any, i: number) => (
                              <React.Fragment key={i}>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
                                  <User className="w-3 h-3" />
                                  Step {s.order + 1}: {s.role}
                                </div>
                                {i < chain.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
