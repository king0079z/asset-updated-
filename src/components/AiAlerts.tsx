import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  AlertTriangle, TrendingUp, TrendingDown, Info, Brain, Sparkles,
  RefreshCcw, ArrowRight, CheckCircle2, Clock, Activity, Minus,
  Package, Utensils, Car, DollarSign, Wrench, ShieldAlert,
  ChevronRight, Zap, BarChart3, Users,
} from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

interface InsightAlert {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  metric?: { value: number | string; label: string; trend?: 'up' | 'down' | 'stable' };
  action?: { label: string; href: string };
}

interface InsightsSummary {
  totalAssets: number;
  activeAssets: number;
  maintenanceAssets: number;
  assetHealthPct: number;
  totalPortfolioValue: number;
  openTickets: number;
  lowStockItems: number;
  activeVehicles: number;
  newAssignmentsLast30d: number;
}

interface InsightsData {
  alerts: InsightAlert[];
  summary: InsightsSummary | null;
  meta: { generatedAt: string; cached?: boolean };
  _error?: boolean;
}

interface AiAlertsProps {
  className?: string;
}

const CACHE_KEY = 'ai_insights_cache';
const CACHE_TTL = 3 * 60 * 1000;

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `QAR ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `QAR ${(v / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR', maximumFractionDigits: 0 }).format(v);
}

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function SeverityBadge({ severity }: { severity: InsightAlert['severity'] }) {
  const map = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-sky-100 text-sky-700 border-sky-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  const labels = { critical: 'Critical', warning: 'Warning', info: 'Info', success: 'Healthy' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[severity]}`}>
      {labels[severity]}
    </span>
  );
}

function TrendIcon({ trend, size = 3 }: { trend?: 'up' | 'down' | 'stable'; size?: number }) {
  if (trend === 'up') return <TrendingUp className={`h-${size} w-${size} text-rose-500`} />;
  if (trend === 'down') return <TrendingDown className={`h-${size} w-${size} text-emerald-500`} />;
  return <Minus className={`h-${size} w-${size} text-slate-400`} />;
}

function getCategoryIcon(cat: string) {
  const lower = cat.toLowerCase();
  if (lower.includes('asset')) return Package;
  if (lower.includes('ticket')) return Activity;
  if (lower.includes('supply') || lower.includes('food')) return Utensils;
  if (lower.includes('vehicle')) return Car;
  if (lower.includes('financial') || lower.includes('budget')) return DollarSign;
  if (lower.includes('maintenance')) return Wrench;
  if (lower.includes('deployment')) return Users;
  if (lower.includes('lifecycle') || lower.includes('health')) return ShieldAlert;
  return Brain;
}

function getCardStyle(severity: InsightAlert['severity']) {
  return {
    critical: {
      border: 'border-red-200 hover:border-red-300',
      bg: 'bg-gradient-to-br from-red-50/80 to-rose-50/60',
      iconBg: 'bg-red-100 text-red-600',
      metricColor: 'text-red-700',
      pulse: 'bg-red-500',
    },
    warning: {
      border: 'border-amber-200 hover:border-amber-300',
      bg: 'bg-gradient-to-br from-amber-50/80 to-yellow-50/60',
      iconBg: 'bg-amber-100 text-amber-600',
      metricColor: 'text-amber-700',
      pulse: 'bg-amber-500',
    },
    info: {
      border: 'border-sky-200 hover:border-sky-300',
      bg: 'bg-gradient-to-br from-sky-50/80 to-blue-50/60',
      iconBg: 'bg-sky-100 text-sky-600',
      metricColor: 'text-sky-700',
      pulse: null,
    },
    success: {
      border: 'border-emerald-200 hover:border-emerald-300',
      bg: 'bg-gradient-to-br from-emerald-50/80 to-teal-50/60',
      iconBg: 'bg-emerald-100 text-emerald-600',
      metricColor: 'text-emerald-700',
      pulse: null,
    },
  }[severity];
}

// ── Skeleton shimmer ─────────────────────────────────────────────────────────
function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => <Shimmer key={i} className="h-16 rounded-xl" />)}
      </div>
      {/* Alert cards */}
      {[...Array(3)].map((_, i) => <Shimmer key={i} className="h-20 rounded-xl" />)}
    </div>
  );
}

// ── Summary stat pill ────────────────────────────────────────────────────────
function StatPill({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`flex flex-col items-center rounded-xl p-2.5 text-center ${color}`}>
      <span className="text-xl font-black leading-none">{value}</span>
      <span className="mt-0.5 text-[10px] font-semibold leading-tight opacity-80">{label}</span>
      {sub && <span className="text-[9px] opacity-60 leading-tight">{sub}</span>}
    </div>
  );
}

export function AiAlerts({ className }: AiAlertsProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const { dir } = useTranslation();

  const fetchInsights = useCallback(async (force = false) => {
    // Check in-memory cache first
    if (!force && data && lastFetched) {
      const age = Date.now() - new Date(lastFetched).getTime();
      if (age < CACHE_TTL) return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const res = await fetch('/api/ai-analysis/insights', {
        signal: abortRef.current.signal,
        credentials: 'same-origin',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: InsightsData = await res.json();
      setData(json);
      setLastFetched(new Date().toISOString());
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      // On error, show empty graceful state (don't crash)
      setData({ alerts: [], summary: null, _error: true, meta: { generatedAt: new Date().toISOString() } });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data, lastFetched]);

  useEffect(() => {
    fetchInsights();
    return () => { abortRef.current?.abort(); };
  }, []);

  const filtered = data?.alerts.filter(a => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'critical') return a.severity === 'critical';
    if (activeFilter === 'warning') return a.severity === 'warning';
    if (activeFilter === 'info') return a.severity === 'info' || a.severity === 'success';
    return true;
  }) ?? [];

  const counts = {
    critical: data?.alerts.filter(a => a.severity === 'critical').length ?? 0,
    warning: data?.alerts.filter(a => a.severity === 'warning').length ?? 0,
    info: (data?.alerts.filter(a => a.severity === 'info').length ?? 0) + (data?.alerts.filter(a => a.severity === 'success').length ?? 0),
  };

  const s = data?.summary;

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md hover:shadow-lg transition-shadow ${className}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-5 py-4">
        {/* Decorative mesh */}
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 10% 30%, white 1px, transparent 1px), radial-gradient(circle at 90% 70%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">AI Insights & Alerts</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white/90">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  LIVE
                </span>
              </div>
              {lastFetched && (
                <p className="text-[11px] text-white/60 flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" /> Updated {fmtTime(lastFetched)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchInsights(true)}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => router.push('/ai-analysis')}
              className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
            >
              Full Analysis <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Alert count pills */}
        {!loading && (counts.critical > 0 || counts.warning > 0) && (
          <div className="relative mt-3 flex items-center gap-2">
            {counts.critical > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                <AlertTriangle className="h-3 w-3" /> {counts.critical} Critical
              </span>
            )}
            {counts.warning > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                <Zap className="h-3 w-3" /> {counts.warning} Warning
              </span>
            )}
          </div>
            )}
          </div>
          
      {/* ── Summary stats ──────────────────────────────────────────────────── */}
      {!loading && s && (
        <div className="grid grid-cols-4 gap-1 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5">
          <StatPill label="Active Assets" value={s.activeAssets.toLocaleString()} color="bg-indigo-50 text-indigo-700" />
          <StatPill label="Health Rate" value={`${s.assetHealthPct}%`} color={s.assetHealthPct >= 85 ? 'bg-emerald-50 text-emerald-700' : s.assetHealthPct >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'} />
          <StatPill label="Open Tickets" value={s.openTickets} color="bg-sky-50 text-sky-700" />
          <StatPill label="Portfolio" value={fmtCurrency(s.totalPortfolioValue)} color="bg-violet-50 text-violet-700" />
        </div>
      )}

      {/* ── Filter tabs ────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center gap-1 border-b border-slate-100 bg-white px-4 py-2">
          {([
            { key: 'all', label: 'All', count: data?.alerts.length ?? 0 },
            { key: 'critical', label: 'Critical', count: counts.critical },
            { key: 'warning', label: 'Warnings', count: counts.warning },
            { key: 'info', label: 'Info', count: counts.info },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeFilter === tab.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
      </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '320px' }}>
        {loading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {activeFilter === 'all' ? 'All Systems Normal' : 'No items in this category'}
              </p>
              <p className="mt-0.5 text-sm text-slate-400">
                {activeFilter === 'all' ? 'No issues detected. Your operations are running smoothly.' : 'Try a different filter.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {filtered.map(alert => {
              const style = getCardStyle(alert.severity);
              const Icon = getCategoryIcon(alert.category);
              return (
                <div
                  key={alert.id}
                  className={`group relative rounded-xl border p-3.5 transition-all hover:shadow-sm ${style.border} ${style.bg}`}
                >
                  {/* Pulse dot for critical */}
                  {alert.severity === 'critical' && style.pulse && (
                    <span className="absolute right-3 top-3 flex h-2.5 w-2.5">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.pulse}`} />
                      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${style.pulse}`} />
                    </span>
                  )}

                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title row */}
                        <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-[11px] font-semibold text-slate-500">{alert.category}</span>
                        </div>
                      <h4 className="mt-1 text-sm font-bold text-slate-900 leading-snug">{alert.title}</h4>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600 line-clamp-2">{alert.message}</p>

                      {/* Metric + action row */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {alert.metric && (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-base font-black ${style.metricColor}`}>{alert.metric.value}</span>
                            <span className="text-[10px] text-slate-400">{alert.metric.label}</span>
                            <TrendIcon trend={alert.metric.trend} size={3} />
                          </div>
                        )}
                        {alert.action && (
                          <button
                            onClick={() => router.push(alert.action!.href)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors group-hover:underline"
                          >
                            {alert.action.label}
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span>Powered by AI · Rule-based engine</span>
        </div>
        <button
          onClick={() => router.push('/ai-analysis')}
          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <BarChart3 className="h-3 w-3" /> Deep Analysis
        </button>
      </div>
    </div>
  );
}
