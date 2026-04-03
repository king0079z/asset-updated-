// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Route, Plus, CheckCircle2, Clock, User, Calendar, Play, RefreshCw,
  TrendingUp, BarChart2, AlertTriangle, Search, ClipboardCheck, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

type UserRow = { id: string; email: string };
type AssetRow = { id: string; name: string };

export function RfidInspectionRoutesPanel() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    periodDays: 30,
    assignedToId: '',
  });
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inspection-routes');
      const data = res.ok ? await res.json() : [];
      setRoutes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsersAndAssets = useCallback(async () => {
    const [uRes, aRes] = await Promise.all([fetch('/api/users'), fetch('/api/assets')]);
    let uData = uRes.ok ? await uRes.json() : [];
    if (!Array.isArray(uData) && uData?.users) uData = uData.users;
    setUsers(Array.isArray(uData) ? uData.map((x: any) => ({ id: x.id, email: x.email })) : []);

    let aData = aRes.ok ? await aRes.json() : [];
    const list = Array.isArray(aData) ? aData : aData.assets ?? [];
    setAssets(list.map((a: any) => ({ id: a.id, name: a.name || a.assetId || 'Asset' })));
  }, []);

  useEffect(() => {
    fetchRoutes();
    fetchUsersAndAssets();
  }, [fetchRoutes, fetchUsersAndAssets]);

  const filteredAssets = useMemo(() => {
    const q = assetSearch.toLowerCase();
    return assets.filter((a) => !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)).slice(0, 80);
  }, [assets, assetSearch]);

  const create = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Route name required' });
      return;
    }
    const res = await fetch('/api/inspection-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description || undefined,
        periodDays: form.periodDays || 30,
        assignedToId: form.assignedToId || undefined,
        assetIds: selectedAssetIds,
      }),
    });
    if (res.ok) {
      toast({ title: 'Inspection route created', description: form.name });
      setShowNew(false);
      setForm({ name: '', description: '', periodDays: 30, assignedToId: '' });
      setSelectedAssetIds([]);
      setAssetSearch('');
      fetchRoutes();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'Failed', description: err.error });
    }
  };

  const complete = async (route: any) => {
    setCompleting(route.id);
    try {
      const res = await fetch(`/api/inspection-routes/${route.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isOnTime: route.nextDueAt ? new Date() <= new Date(route.nextDueAt) : true,
          isSuccessful: true,
        }),
      });
      if (res.ok) {
        toast({ title: 'Inspection completed', description: route.name });
        fetchRoutes();
      } else {
        toast({ variant: 'destructive', title: 'Could not complete' });
      }
    } finally {
      setCompleting(null);
    }
  };

  const isOverdue = (route: any) => route.nextDueAt && new Date(route.nextDueAt) < new Date();

  const dueSoon = routes.filter((r) => r.nextDueAt && new Date(r.nextDueAt) <= new Date() && !isOverdue(r)).length;
  const overdueCount = routes.filter(isOverdue).length;

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/60 dark:border-teal-900/50 bg-gradient-to-br from-teal-950 via-slate-900 to-cyan-950 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(45,212,191,0.15),transparent_50%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/15 backdrop-blur">
              <ClipboardCheck className="h-7 w-7 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">Inspection routes</h2>
                <Badge className="bg-white/15 text-white border-white/20 text-[10px] uppercase tracking-widest">Workflow</Badge>
              </div>
              <p className="mt-1.5 text-sm text-teal-100/80 max-w-xl">
                Define recurring RFID / asset inspection rounds with cadence, assignee, and scoped assets. Completions roll up into on-time and success rates.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 border border-white/10 px-3 py-1">
                  <Clock className="h-3.5 w-3.5 text-teal-300" />
                  {routes.length} route{routes.length !== 1 ? 's' : ''}
                </span>
                {overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/30 border border-red-400/40 px-3 py-1 text-red-100">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {overdueCount} overdue
                  </span>
                )}
                {dueSoon > 0 && overdueCount === 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-amber-100">
                    {dueSoon} due now
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              onClick={() => fetchRoutes()}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-white shadow-lg" onClick={() => setShowNew((p) => !p)}>
              <Plus className="h-4 w-4 mr-2" />
              New route
            </Button>
          </div>
        </div>
      </div>

      {showNew && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-card shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4 text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div>
              <h3 className="font-bold">Create inspection route</h3>
              <p className="text-sm text-white/85">Set cadence, owner, and optional asset scope for handheld verification.</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Route name *</label>
                <Input className="rounded-xl" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Cold chain monthly sweep" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Period (days)</label>
                <Input type="number" min={1} className="rounded-xl" value={form.periodDays} onChange={(e) => setForm((f) => ({ ...f, periodDays: Number(e.target.value) || 30 }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Assign to</label>
                <select
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  value={form.assignedToId}
                  onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
                >
                  <option value="">— Current user (default) —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Description / instructions</label>
                <Input className="rounded-xl" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What to verify, which zones, safety notes…" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Route className="h-4 w-4 text-teal-600" />
                  Asset scope (optional)
                </p>
                <Badge variant="secondary" className="text-[10px]">{selectedAssetIds.length} selected</Badge>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 rounded-xl" placeholder="Search assets…" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background divide-y divide-border">
                {filteredAssets.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No assets match.</p>
                ) : (
                  filteredAssets.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.includes(a.id)}
                        onChange={() => toggleAsset(a.id)}
                        className="h-4 w-4 rounded border-input accent-teal-600"
                      />
                      <span className="truncate">{a.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => { setShowNew(false); setSelectedAssetIds([]); }}>Cancel</Button>
              <Button className="rounded-xl bg-teal-600 hover:bg-teal-500" onClick={create}>Create route</Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Loading routes…</div>
      ) : routes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 py-16 text-center">
          <Route className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-muted-foreground">No inspection routes yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create a route to tie recurring checks to your RFID program.</p>
          <Button className="rounded-xl" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-2" />New route</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {routes.map((route) => {
            const overdue = isOverdue(route);
            const ids = Array.isArray(route.assetIds) ? route.assetIds : [];
            const scopeCount = ids.filter((x: unknown) => typeof x === 'string').length;
            return (
              <div
                key={route.id}
                className={cn(
                  'rounded-2xl border bg-card overflow-hidden shadow-sm transition-all hover:shadow-md',
                  overdue ? 'border-red-300 dark:border-red-900' : 'border-border',
                )}
              >
                <div className={cn('h-1 w-full', overdue ? 'bg-red-500' : 'bg-gradient-to-r from-teal-500 to-cyan-500')} />
                <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-start gap-5">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg">{route.name}</h3>
                      {overdue && <Badge className="bg-red-600 hover:bg-red-600">Overdue</Badge>}
                      {scopeCount > 0 && (
                        <Badge variant="outline" className="text-[10px]">{scopeCount} assets in scope</Badge>
                      )}
                    </div>
                    {route.description && <p className="text-sm text-muted-foreground">{route.description}</p>}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Period', value: `${route.periodDays} days`, icon: Clock },
                        { label: 'Assigned', value: route.assignedTo?.email || 'Default owner', icon: User },
                        { label: 'Next due', value: route.nextDueAt ? new Date(route.nextDueAt).toLocaleDateString() : '—', icon: Calendar },
                        { label: 'Last done', value: route.lastCompletedAt ? new Date(route.lastCompletedAt).toLocaleDateString() : 'Never', icon: CheckCircle2 },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="rounded-xl bg-muted/30 border border-border/60 px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-0.5">
                            <Icon className="h-3 w-3" /> {label}
                          </p>
                          <p className="text-sm font-semibold truncate">{value}</p>
                        </div>
                      ))}
                    </div>
                    {(route.deliveryRate != null || route.successRate != null) && (
                      <div className="flex flex-col sm:flex-row gap-4 pt-1">
                        {route.deliveryRate != null && (
                          <div className="flex-1">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> On-time rate</span>
                              <span className="font-bold">{Math.round(route.deliveryRate)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, route.deliveryRate)}%` }} />
                            </div>
                          </div>
                        )}
                        {route.successRate != null && (
                          <div className="flex-1">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span className="flex items-center gap-1"><BarChart2 className="h-3 w-3" /> Success rate</span>
                              <span className="font-bold">{Math.round(route.successRate)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, route.successRate)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {route.completions?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Recent completions</p>
                        <div className="flex flex-wrap gap-2">
                          {route.completions.slice(0, 5).map((c: any) => (
                            <Badge
                              key={c.id}
                              variant="secondary"
                              className={cn('text-[10px]', c.isSuccessful ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-800')}
                            >
                              {new Date(c.completedAt).toLocaleDateString()} {c.isOnTime ? '✓' : '⏰'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    size="lg"
                    className={cn(
                      'rounded-xl shrink-0 w-full lg:w-auto',
                      overdue ? 'bg-red-600 hover:bg-red-500' : 'bg-teal-600 hover:bg-teal-500',
                    )}
                    disabled={completing === route.id}
                    onClick={() => complete(route)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {completing === route.id ? 'Recording…' : 'Mark complete'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
