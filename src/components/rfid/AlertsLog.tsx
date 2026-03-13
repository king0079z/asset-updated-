'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Alert {
  id: string;
  message: string;
  severity: string;
  assetName?: string | null;
  assetId?: string | null;
  zoneName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  rule: { type: string; name: string };
}

interface AlertsLogProps {
  onUnresolvedCountChange?: (count: number) => void;
}

const SEVERITY_CONFIG: Record<string, { label: string; class: string }> = {
  CRITICAL: { label: 'CRITICAL', class: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200' },
  WARNING:  { label: 'WARNING',  class: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-200' },
  INFO:     { label: 'INFO',     class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200' },
};

const TYPE_LABELS: Record<string, string> = {
  ZONE_BREACH:     'Zone Breach',
  RESTRICTED_ZONE: 'Restricted Zone',
  MISSING:         'Missing Asset',
  LOW_BATTERY:     'Low Battery',
};

const POLL_INTERVAL = 30000;

export default function AlertsLog({ onUnresolvedCountChange }: AlertsLogProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), page: String(page) });
    if (filter === 'unresolved') params.set('resolved', 'false');
    if (filter === 'all') {} // no filter
    if (typeFilter !== 'all') params.set('type', typeFilter);

    const res = await fetch(`/api/rfid/alerts?${params}`);
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.alerts ?? []);
      setTotal(data.total ?? 0);
      onUnresolvedCountChange?.(data.unresolved ?? 0);
    }
    if (!silent) setLoading(false);
  }, [filter, typeFilter, page, onUnresolvedCountChange]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const resolveAlert = async (id: string) => {
    setResolving(id);
    try {
      const res = await fetch(`/api/rfid/alerts/${id}/resolve`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Alert resolved');
      await fetchAlerts(true);
    } catch { toast.error('Failed to resolve alert'); } finally { setResolving(null); }
  };

  const checkMissing = async () => {
    try {
      const res = await fetch('/api/rfid/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-missing' }),
      });
      if (res.ok) {
        const { created } = await res.json();
        toast.success(created > 0 ? `${created} new missing-asset alert(s) created` : 'No missing assets detected');
        await fetchAlerts(true);
      }
    } catch { toast.error('Check failed'); }
  };

  const filtered = alerts.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.message.toLowerCase().includes(q) ||
      (a.assetName ?? '').toLowerCase().includes(q) ||
      (a.zoneName ?? '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['unresolved', 'all'] as const).map(f => (
            <button
              key={f}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-white dark:bg-slate-700 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f === 'unresolved' ? 'Unresolved' : 'All Alerts'}
            </button>
          ))}
        </div>

        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search alerts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-48"
        />

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={checkMissing}>
            Check Missing Assets
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => fetchAlerts()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-medium text-sm">No alerts found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === 'unresolved' ? 'All clear — no unresolved alerts' : 'No alerts match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
            const isResolved = !!alert.resolvedAt;
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  isResolved
                    ? 'opacity-60 bg-slate-50 dark:bg-slate-900'
                    : 'bg-white dark:bg-slate-900 shadow-sm hover:shadow'
                }`}
              >
                {/* Severity indicator */}
                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                  alert.severity === 'CRITICAL' ? 'bg-red-500' :
                  alert.severity === 'WARNING'  ? 'bg-amber-500' : 'bg-blue-500'
                } ${!isResolved && alert.severity === 'CRITICAL' ? 'animate-pulse' : ''}`} />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] h-4 px-1.5 border ${sev.class}`}>
                      {sev.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {TYPE_LABELS[alert.rule.type] ?? alert.rule.type}
                    </Badge>
                    {isResolved && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-600 border-emerald-200">
                        RESOLVED
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-snug">{alert.message}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    {alert.zoneName && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {alert.zoneName}
                      </span>
                    )}
                    {isResolved && alert.resolvedAt && (
                      <span className="text-emerald-600">Resolved {new Date(alert.resolvedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {!isResolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 h-7 text-xs"
                    onClick={() => resolveAlert(alert.id)}
                    disabled={resolving === alert.id}
                  >
                    {resolving === alert.id ? '...' : 'Resolve'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>{total} total alerts</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Prev
            </Button>
            <span className="h-7 flex items-center px-2 font-medium text-foreground">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
