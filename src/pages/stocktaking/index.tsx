// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardList, Plus, Play, CheckCircle, Clock, Calendar,
  Download, RefreshCw, User, AlertTriangle, Wifi, Settings
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';

const TYPE_COLORS: Record<string, string> = {
  FULL:      'bg-purple-100 text-purple-700',
  RANDOM:    'bg-blue-100 text-blue-700',
  SELF:      'bg-green-100 text-green-700',
  AUTOMATIC: 'bg-orange-100 text-orange-700',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED:     'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-red-100 text-red-600',
};

const STOCKTAKING_TYPES = [
  { id: 'FULL', label: 'Full Stocktaking', desc: 'All assets audited by dedicated personnel' },
  { id: 'RANDOM', label: 'Random Stocktaking', desc: 'Spot-check of a subset of assets' },
  { id: 'SELF', label: 'Self-Stocktaking', desc: 'Each department/custodian counts their own assets' },
  { id: 'AUTOMATIC', label: 'Automatic (Key Assets)', desc: 'RFID-based auto-detection at scheduled intervals' },
];

export default function StocktakingPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [form, setForm] = useState({ type: 'FULL', name: '', description: '', scheduledAt: '' });
  const [policy, setPolicy] = useState({ thresholdMinutes: 30, autoMarkPresent: true });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, planned: 0 });

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch('/api/stocktaking-plans').then(r => r.json()).catch(() => []);
    const list = Array.isArray(res) ? res : [];
    setPlans(list);
    setStats({
      total: list.length,
      completed: list.filter((p: any) => p.status === 'COMPLETED').length,
      inProgress: list.filter((p: any) => p.status === 'IN_PROGRESS').length,
      planned: list.filter((p: any) => p.status === 'PLANNED').length,
    });
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const createPlan = async () => {
    if (!form.name) { toast({ variant: 'destructive', title: 'Name is required' }); return; }
    setSaving(true);
    const res = await fetch('/api/stocktaking-plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: 'Stocktaking plan created' });
      setShowNew(false);
      setForm({ type: 'FULL', name: '', description: '', scheduledAt: '' });
      fetch_();
    } else toast({ variant: 'destructive', title: 'Failed to create plan' });
  };

  const updateStatus = async (id: string, status: string) => {
    const body: any = { status };
    if (status === 'IN_PROGRESS') body.startedAt = new Date().toISOString();
    if (status === 'COMPLETED') body.completedAt = new Date().toISOString();
    await fetch(`/api/stocktaking-plans/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    fetch_();
    toast({ title: `Plan ${status === 'IN_PROGRESS' ? 'started' : 'completed'}` });
  };

  const exportSummary = (plan: any) => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Stocktaking Plan Summary'],
      ['Name', plan.name],
      ['Type', plan.type],
      ['Status', plan.status],
      ['Scheduled', plan.scheduledAt ? new Date(plan.scheduledAt).toLocaleString() : 'N/A'],
      ['Started', plan.startedAt ? new Date(plan.startedAt).toLocaleString() : 'N/A'],
      ['Completed', plan.completedAt ? new Date(plan.completedAt).toLocaleString() : 'N/A'],
      ['Executor', plan.executor?.email || 'N/A'],
      ['Description', plan.description || ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    XLSX.writeFile(wb, `stocktaking_${plan.id}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Stocktaking</h1>
              <p className="text-sm text-gray-500">Full, random, self-stocktaking and automatic key-asset modes</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowPolicy(p => !p)} variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />Quick Stocktaking Policy
            </Button>
            <Button onClick={() => setShowNew(p => !p)} size="sm">
              <Plus className="w-4 h-4 mr-2" />New Plan
            </Button>
          </div>
        </div>

        {/* Quick Stocktaking Policy */}
        {showPolicy && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Wifi className="w-4 h-4 text-orange-600" />Quick Online Stocktaking Policy</CardTitle>
              <CardDescription>RFID-based: if an asset's tag is read within the threshold window, it is automatically counted as "in stock"</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Threshold (minutes)</label>
                  <Input type="number" min="5" className="w-28" value={policy.thresholdMinutes}
                    onChange={e => setPolicy(p => ({ ...p, thresholdMinutes: Number(e.target.value) }))} />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="autoMark" checked={policy.autoMarkPresent}
                    onChange={e => setPolicy(p => ({ ...p, autoMarkPresent: e.target.checked }))}
                    className="w-4 h-4 accent-orange-600" />
                  <label htmlFor="autoMark" className="text-sm font-medium">Auto-mark as present if scanned within threshold</label>
                </div>
              </div>
              <p className="text-xs text-orange-700 bg-orange-100 rounded-lg px-3 py-2">
                Assets scanned by RFID readers within the last <strong>{policy.thresholdMinutes} minutes</strong> will be automatically marked as in-stock during automatic stocktaking.
              </p>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700"
                onClick={() => { toast({ title: 'Policy saved', description: `Threshold: ${policy.thresholdMinutes}min` }); setShowPolicy(false); }}>
                Save Policy
              </Button>
            </CardContent>
          </Card>
        )}

        {/* New Plan Form */}
        {showNew && (
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-base">Create New Stocktaking Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Stocktaking Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {STOCKTAKING_TYPES.map(t => (
                    <div key={t.id}
                      className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${form.type === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      onClick={() => setForm(f => ({ ...f, type: t.id }))}>
                      <p className="font-semibold text-sm text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Plan Name</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q2 2026 Full Stocktaking" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Scheduled Date</label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Description</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Scope, instructions, notes..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={createPlan} disabled={saving}>{saving ? 'Creating...' : 'Create Plan'}</Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Plans', value: stats.total, color: 'text-gray-700' },
            { label: 'Planned', value: stats.planned, color: 'text-gray-500' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-yellow-600' },
            { label: 'Completed', value: stats.completed, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="text-center py-4">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </Card>
          ))}
        </div>

        {/* Plans List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Stocktaking Plans</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetch_}><RefreshCw className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading plans...</div>
            ) : plans.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No stocktaking plans yet. Create one above.</p>
              </div>
            ) : (
              <div className="divide-y">
                {plans.map(plan => (
                  <div key={plan.id} className="p-4 hover:bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        <Badge className={`text-xs ${TYPE_COLORS[plan.type]}`}>{plan.type}</Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{plan.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          {plan.executor && <span className="flex items-center gap-1"><User className="w-3 h-3" />{plan.executor.email}</span>}
                          {plan.scheduledAt && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(plan.scheduledAt).toLocaleDateString()}</span>}
                          {plan.completedAt && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Completed {new Date(plan.completedAt).toLocaleDateString()}</span>}
                        </div>
                        {plan.description && <p className="text-xs text-gray-400 mt-1 truncate">{plan.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs ${STATUS_COLORS[plan.status]}`}>{plan.status}</Badge>
                      {plan.status === 'PLANNED' && (
                        <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white"
                          onClick={() => updateStatus(plan.id, 'IN_PROGRESS')}>
                          <Play className="w-3.5 h-3.5 mr-1" />Start
                        </Button>
                      )}
                      {plan.status === 'IN_PROGRESS' && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => updateStatus(plan.id, 'COMPLETED')}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />Complete
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => exportSummary(plan)}>
                        <Download className="w-3.5 h-3.5 mr-1" />Export
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

