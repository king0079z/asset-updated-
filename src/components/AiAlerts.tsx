import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  AlertTriangle, TrendingUp, TrendingDown, Info, Brain, Sparkles,
  RefreshCcw, ArrowRight, CheckCircle2, Clock, Activity, Minus,
  Package, Utensils, Car, DollarSign, Wrench, ShieldAlert,
  ChevronRight, Zap, BarChart3, Users, TrendingFlat,
  BarChart2, PieChart, Target, Banknote, CircleDollarSign,
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
  isDepreciation?: boolean;
}

interface DepreciationByType {
  type: string;
  count: number;
  totalCost: number;
  totalBookValue: number;
  totalDepreciation: number;
  depreciationPercent: number;
}

interface DepreciationSummary {
  totalCost: number;
  totalCurrentValue: number;
  totalAccumulatedDepreciation: number;
  overallDepreciationPercent: number;
  byType: DepreciationByType[];
  criticalAssets: Array<{ name: string; depreciationPercent: number; bookValue: number }>;
  nearEndOfLifeCount: number;
  heavilyDepreciatedCount: number;
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
  depreciation?: DepreciationSummary;
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

const CACHE_TTL = 3 * 60 * 1000;

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `QAR ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `QAR ${(v / 1_000).toFixed(0)}K`;
  return `QAR ${v.toLocaleString()}`;
}

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function SeverityBadge({ severity, isDepreciation }: { severity: InsightAlert['severity']; isDepreciation?: boolean }) {
  const map = {
    critical: isDepreciation ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-red-100 text-red-700 border-red-200',
    warning: isDepreciation ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-amber-100 text-amber-700 border-amber-200',
    info: isDepreciation ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-sky-100 text-sky-700 border-sky-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  const labels = {
    critical: isDepreciation ? 'High Dep.' : 'Critical',
    warning: isDepreciation ? 'Attention' : 'Warning',
    info: isDepreciation ? 'Insight' : 'Info',
    success: 'Healthy',
  };
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

function getCategoryIcon(cat: string, isDepreciation?: boolean) {
  if (isDepreciation) return CircleDollarSign;
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

function getCardStyle(severity: InsightAlert['severity'], isDepreciation?: boolean) {
  if (isDepreciation) {
    return {
      critical: {
        border: 'border-violet-200 hover:border-violet-300',
        bg: 'bg-gradient-to-br from-violet-50/90 to-purple-50/70',
        iconBg: 'bg-violet-100 text-violet-600',
        metricColor: 'text-violet-700',
        pulse: 'bg-violet-500',
        accent: 'from-violet-500 to-purple-600',
      },
      warning: {
        border: 'border-purple-200 hover:border-purple-300',
        bg: 'bg-gradient-to-br from-purple-50/80 to-violet-50/60',
        iconBg: 'bg-purple-100 text-purple-600',
        metricColor: 'text-purple-700',
        pulse: 'bg-purple-500',
        accent: 'from-purple-500 to-violet-600',
      },
      info: {
        border: 'border-indigo-200 hover:border-indigo-300',
        bg: 'bg-gradient-to-br from-indigo-50/80 to-violet-50/50',
        iconBg: 'bg-indigo-100 text-indigo-600',
        metricColor: 'text-indigo-700',
        pulse: null,
        accent: 'from-indigo-500 to-violet-500',
      },
      success: {
        border: 'border-emerald-200 hover:border-emerald-300',
        bg: 'bg-gradient-to-br from-emerald-50/80 to-teal-50/60',
        iconBg: 'bg-emerald-100 text-emerald-600',
        metricColor: 'text-emerald-700',
        pulse: null,
        accent: 'from-emerald-500 to-teal-600',
      },
    }[severity];
  }
  return {
    critical: {
      border: 'border-red-200 hover:border-red-300',
      bg: 'bg-gradient-to-br from-red-50/80 to-rose-50/60',
      iconBg: 'bg-red-100 text-red-600',
      metricColor: 'text-red-700',
      pulse: 'bg-red-500',
      accent: 'from-red-500 to-rose-600',
    },
    warning: {
      border: 'border-amber-200 hover:border-amber-300',
      bg: 'bg-gradient-to-br from-amber-50/80 to-yellow-50/60',
      iconBg: 'bg-amber-100 text-amber-600',
      metricColor: 'text-amber-700',
      pulse: 'bg-amber-500',
      accent: 'from-amber-500 to-orange-500',
    },
    info: {
      border: 'border-sky-200 hover:border-sky-300',
      bg: 'bg-gradient-to-br from-sky-50/80 to-blue-50/60',
      iconBg: 'bg-sky-100 text-sky-600',
      metricColor: 'text-sky-700',
      pulse: null,
      accent: 'from-sky-500 to-blue-500',
    },
    success: {
      border: 'border-emerald-200 hover:border-emerald-300',
      bg: 'bg-gradient-to-br from-emerald-50/80 to-teal-50/60',
      iconBg: 'bg-emerald-100 text-emerald-600',
      metricColor: 'text-emerald-700',
      pulse: null,
      accent: 'from-emerald-500 to-teal-600',
    },
  }[severity];
}

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => <Shimmer key={i} className="h-16 rounded-xl" />)}
      </div>
      {[...Array(3)].map((_, i) => <Shimmer key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}

function StatPill({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`flex flex-col items-center rounded-xl p-2.5 text-center ${color}`}>
      <span className="text-xl font-black leading-none">{value}</span>
      <span className="mt-0.5 text-[10px] font-semibold leading-tight opacity-80">{label}</span>
      {sub && <span className="text-[9px] opacity-60 leading-tight">{sub}</span>}
    </div>
  );
}

// Mini horizontal bar for depreciation by type
function DepreciationBar({ type, depreciationPercent, totalCost, totalBookValue }: DepreciationByType) {
  const pct = Math.min(depreciationPercent, 100);
  const color = pct > 75 ? '#ef4444' : pct > 50 ? '#f97316' : pct > 30 ? '#8b5cf6' : '#6366f1';
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[100px]">{type.replace(/_/g, ' ')}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400">{fmtCurrency(totalBookValue)}</span>
          <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// Depreciation mini-panel shown inline when "Depreciation" tab is active and there's summary data
function DepreciationOverviewPanel({ dep }: { dep: DepreciationSummary }) {
  const pct = dep.overallDepreciationPercent;
  const retained = 100 - pct;
  const barColor = pct > 75 ? 'from-red-500 to-rose-600' : pct > 50 ? 'from-orange-500 to-red-500' : pct > 30 ? 'from-violet-500 to-purple-600' : 'from-indigo-500 to-violet-500';

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-700">
        <CircleDollarSign className="h-3.5 w-3.5 text-white" />
        <span className="text-[11px] font-bold text-white tracking-wide uppercase">Portfolio Depreciation Overview</span>
        <span className="ml-auto text-[10px] text-violet-200 font-bold">IAS 16 · AI Enhanced</span>
      </div>

      <div className="p-3 space-y-3">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Original Cost', val: fmtCurrency(dep.totalCost), colorClass: 'text-slate-700', bgClass: 'bg-slate-50 border-slate-200' },
            { label: 'Book Value', val: fmtCurrency(dep.totalCurrentValue), colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50 border-emerald-200' },
            { label: 'Accumulated Dep.', val: fmtCurrency(dep.totalAccumulatedDepreciation), colorClass: 'text-rose-700', bgClass: 'bg-rose-50 border-rose-200' },
          ].map(({ label, val, colorClass, bgClass }) => (
            <div key={label} className={`rounded-xl border p-2 text-center ${bgClass}`}>
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
              <p className={`text-[11px] font-black ${colorClass}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* Value decay bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-slate-500">Portfolio Value Retention</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-600">{retained.toFixed(1)}% retained</span>
              <span className="text-[10px] text-slate-300">|</span>
              <span className="text-[10px] font-bold text-rose-600">{pct.toFixed(1)}% depreciated</span>
            </div>
          </div>
          <div className="relative h-3 rounded-full bg-slate-200 overflow-hidden">
            {/* Retained portion */}
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-l-full transition-all duration-700"
              style={{ width: `${Math.min(retained, 100)}%` }}
            />
            {/* Depreciated portion */}
            <div
              className={`absolute top-0 h-full bg-gradient-to-r ${barColor} rounded-r-full transition-all duration-700`}
              style={{ left: `${Math.min(retained, 100)}%`, width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-emerald-600 font-semibold">Book Value: {fmtCurrency(dep.totalCurrentValue)}</span>
            <span className="text-[9px] text-rose-500 font-semibold">Lost: {fmtCurrency(dep.totalAccumulatedDepreciation)}</span>
          </div>
        </div>

        {/* Alert badges */}
        {(dep.nearEndOfLifeCount > 0 || dep.heavilyDepreciatedCount > 0) && (
          <div className="flex flex-wrap gap-2">
            {dep.nearEndOfLifeCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-700">
                <AlertTriangle className="h-3 w-3" /> {dep.nearEndOfLifeCount} Past Useful Life
              </span>
            )}
            {dep.heavilyDepreciatedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 border border-violet-200 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                <TrendingDown className="h-3 w-3" /> {dep.heavilyDepreciatedCount} &gt;75% Depreciated
              </span>
            )}
          </div>
        )}

        {/* By type mini bars */}
        {dep.byType && dep.byType.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">By Asset Type</p>
            {dep.byType.slice(0, 5).map(bt => (
              <DepreciationBar key={bt.type} {...bt} />
            ))}
          </div>
        )}

        {/* Critically depreciated assets */}
        {dep.criticalAssets && dep.criticalAssets.length > 0 && (
          <div className="rounded-xl bg-white/70 border border-violet-100 p-2.5 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Most Depreciated Assets
            </p>
            {dep.criticalAssets.slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 truncate max-w-[140px]">{a.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">{fmtCurrency(a.bookValue)}</span>
                  <span className="font-bold text-rose-600">{a.depreciationPercent.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AiAlerts({ className }: AiAlertsProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'depreciation'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const { dir } = useTranslation();

  const fetchInsights = useCallback(async (force = false) => {
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

  const depreciationAlerts = data?.alerts.filter(a => a.isDepreciation) ?? [];
  const operationalAlerts = data?.alerts.filter(a => !a.isDepreciation) ?? [];

  const filtered = (() => {
    if (!data) return [];
    if (activeFilter === 'depreciation') return depreciationAlerts;
    const base = data.alerts.filter(a => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'critical') return a.severity === 'critical';
      if (activeFilter === 'warning') return a.severity === 'warning';
      if (activeFilter === 'info') return a.severity === 'info' || a.severity === 'success';
      return true;
    });
    return base;
  })();

  const counts = {
    critical: data?.alerts.filter(a => a.severity === 'critical').length ?? 0,
    warning: data?.alerts.filter(a => a.severity === 'warning').length ?? 0,
    info: (data?.alerts.filter(a => a.severity === 'info' || a.severity === 'success').length ?? 0),
    depreciation: depreciationAlerts.length,
  };

  const s = data?.summary;
  const dep = s?.depreciation;
  const depPct = dep?.overallDepreciationPercent ?? 0;
  const depSeverity = depPct > 70 ? 'critical' : depPct > 45 ? 'warning' : 'info';

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md hover:shadow-xl transition-shadow duration-300 ${className}`}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-5 py-4">
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 10% 30%, white 1px, transparent 1px), radial-gradient(circle at 90% 70%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-violet-400/20 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
              <Brain className="h-4.5 w-4.5 text-white" />
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
              title="Refresh insights"
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
        {!loading && (counts.critical > 0 || counts.warning > 0 || counts.depreciation > 0) && (
          <div className="relative mt-3 flex items-center gap-2 flex-wrap">
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
            {counts.depreciation > 0 && dep && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                <CircleDollarSign className="h-3 w-3" /> {depPct.toFixed(1)}% Portfolio Dep.
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      {!loading && s && (
        <div className="grid grid-cols-4 gap-1 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5">
          <StatPill
            label="Active Assets"
            value={s.activeAssets.toLocaleString()}
            color="bg-indigo-50 text-indigo-700"
          />
          <StatPill
            label="Health Rate"
            value={`${s.assetHealthPct}%`}
            color={s.assetHealthPct >= 85 ? 'bg-emerald-50 text-emerald-700' : s.assetHealthPct >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}
          />
          <StatPill
            label="Open Tickets"
            value={s.openTickets}
            color="bg-sky-50 text-sky-700"
          />
          {dep && dep.totalCost > 0 ? (
            <StatPill
              label="Book Value"
              value={fmtCurrency(dep.totalCurrentValue)}
              sub={`${depPct.toFixed(0)}% dep.`}
              color={depPct > 70 ? 'bg-violet-50 text-violet-700' : depPct > 40 ? 'bg-purple-50 text-purple-700' : 'bg-violet-50 text-violet-700'}
            />
          ) : (
            <StatPill
              label="Portfolio"
              value={fmtCurrency(s.totalPortfolioValue)}
              color="bg-violet-50 text-violet-700"
            />
          )}
        </div>
      )}

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center gap-0.5 border-b border-slate-100 bg-white px-3 py-2 overflow-x-auto">
          {([
            { key: 'all', label: 'All', count: data?.alerts.length ?? 0, icon: null },
            { key: 'critical', label: 'Critical', count: counts.critical, icon: AlertTriangle },
            { key: 'warning', label: 'Warnings', count: counts.warning, icon: Zap },
            { key: 'info', label: 'Info', count: counts.info, icon: Info },
            { key: 'depreciation', label: 'Depreciation', count: counts.depreciation, icon: CircleDollarSign },
          ] as const).map(tab => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.key;
            const isDepTab = tab.key === 'depreciation';
            return (
              <button key={tab.key} onClick={() => setActiveFilter(tab.key as typeof activeFilter)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? isDepTab
                      ? 'bg-violet-700 text-white shadow-sm'
                      : 'bg-slate-900 text-white shadow-sm'
                    : isDepTab
                      ? 'text-violet-600 hover:bg-violet-50 hover:text-violet-700 border border-violet-200'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}>
                {Icon && <Icon className="h-3 w-3" />}
                {tab.label}
                {tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? isDepTab ? 'bg-violet-500/40 text-white' : 'bg-white/20 text-white'
                      : isDepTab ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '380px' }}>
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Depreciation overview panel (shown when depreciation tab active) */}
            {activeFilter === 'depreciation' && dep && dep.totalCost > 0 && (
              <div className="pt-3">
                <DepreciationOverviewPanel dep={dep} />
              </div>
            )}

            {/* Alert cards */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${activeFilter === 'depreciation' ? 'bg-violet-50' : 'bg-emerald-50'}`}>
                  {activeFilter === 'depreciation'
                    ? <CircleDollarSign className="h-7 w-7 text-violet-400" />
                    : <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  }
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    {activeFilter === 'all' ? 'All Systems Normal' : activeFilter === 'depreciation' ? 'No Depreciation Data' : 'No items in this category'}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {activeFilter === 'all' ? 'No issues detected. Your operations are running smoothly.' : 'Try a different filter or refresh.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {filtered.map(alert => {
                  const style = getCardStyle(alert.severity, alert.isDepreciation);
                  const Icon = getCategoryIcon(alert.category, alert.isDepreciation);
                  return (
                    <div
                      key={alert.id}
                      className={`group relative rounded-xl border p-3.5 transition-all hover:shadow-sm ${style.border} ${style.bg}`}
                    >
                      {/* Gradient left accent for depreciation alerts */}
                      {alert.isDepreciation && (
                        <div className={`absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b ${style.accent}`} />
                      )}

                      {/* Pulse dot for critical */}
                      {alert.severity === 'critical' && style.pulse && (
                        <span className="absolute right-3 top-3 flex h-2.5 w-2.5">
                          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.pulse}`} />
                          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${style.pulse}`} />
                        </span>
                      )}

                      <div className={`flex items-start gap-3 ${alert.isDepreciation ? 'pl-2' : ''}`}>
                        {/* Icon */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Title row */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <SeverityBadge severity={alert.severity} isDepreciation={alert.isDepreciation} />
                            <span className="text-[11px] font-semibold text-slate-500">{alert.category}</span>
                            {alert.isDepreciation && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 border border-violet-200 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 uppercase tracking-wide">
                                <Sparkles className="h-2.5 w-2.5" /> AI
                              </span>
                            )}
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
                                className={`flex items-center gap-1 text-[11px] font-semibold transition-colors group-hover:underline ${alert.isDepreciation ? 'text-violet-500 hover:text-violet-800' : 'text-slate-500 hover:text-slate-800'}`}
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
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span>Powered by AI · Depreciation + Operational Intelligence</span>
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
