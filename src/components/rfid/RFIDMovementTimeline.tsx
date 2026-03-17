// @ts-nocheck
/**
 * RFIDMovementTimeline — World-class RFID movement history display.
 * Shows zone-to-zone transitions with AI insights, exit alerts, and live stats.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle, ArrowRight, Battery, BatteryLow, Brain, CheckCircle2,
  Clock, DoorOpen, Filter, LogOut, MapPin, Package, Radio, RefreshCw,
  Search, Shield, ShieldAlert, Signal, TrendingUp, X, Zap, Building2,
  Eye, ChevronDown, ChevronUp, Activity, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface MovementEvent {
  id: string;
  eventType: 'ENTERPRISE_EXIT' | 'EXIT_ZONE_DETECTED' | 'ZONE_MOVE' | 'ZONE_ENTRY' | 'SIGNAL_LOST';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  tagMac: string;
  assetId?: string;
  assetName: string;
  assetType?: string;
  assetImageUrl?: string;
  fromZoneName?: string;
  fromZoneFloor?: string;
  toZoneName?: string;
  toZoneFloor?: string;
  toZoneIsExit: boolean;
  toZoneIsRestricted: boolean;
  durationInPreviousZone: number;
  rssi?: number;
  battery?: number;
  timestamp: string;
}

interface ExitedAsset {
  tagId: string;
  assetId?: string;
  assetName: string;
  assetType?: string;
  assetImageUrl?: string;
  lastSeenAt?: string;
  lastZone?: { name: string; floorNumber?: string };
  batteryLevel?: number;
  minutesOutside?: number;
}

interface AiInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  icon: string;
}

interface MovementData {
  movements: MovementEvent[];
  exitEvents: MovementEvent[];
  exitedAssets: ExitedAsset[];
  aiInsights: AiInsight[];
  mostActiveAssets: Array<{ assetId?: string; assetName: string; movements: number }>;
  summary: {
    totalMovements: number;
    exitEvents: number;
    assetsCurrentlyOutside: number;
    totalScans: number;
    timeRange: string;
    trackedAssets: number;
  };
  meta: { generatedAt: string; hours: number };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function timeAgo(ts?: string | null): string {
  if (!ts) return 'Never';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const EVENT_CONFIG: Record<string, {
  label: string; bg: string; border: string; text: string;
  dot: string; icon: any; darkBg: string;
}> = {
  ENTERPRISE_EXIT: {
    label: 'Enterprise Exit',
    bg: 'bg-red-50', darkBg: 'dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    icon: LogOut,
  },
  EXIT_ZONE_DETECTED: {
    label: 'Exit Zone',
    bg: 'bg-orange-50', darkBg: 'dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800/50',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
    icon: DoorOpen,
  },
  ZONE_MOVE: {
    label: 'Zone Move',
    bg: 'bg-blue-50', darkBg: 'dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800/40',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    icon: ArrowRight,
  },
  ZONE_ENTRY: {
    label: 'Zone Entry',
    bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    icon: MapPin,
  },
  SIGNAL_LOST: {
    label: 'Signal Lost',
    bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800/30',
    border: 'border-slate-200 dark:border-slate-700/50',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    icon: Wifi,
  },
};

const getEventConfig = (type: string) => EVENT_CONFIG[type] ?? EVENT_CONFIG.ZONE_MOVE;

const INSIGHT_ICON_MAP: Record<string, any> = {
  exit: LogOut, warning: ShieldAlert, restricted: Shield, missing: AlertTriangle,
  battery: BatteryLow, ok: CheckCircle2,
};

/* ── Sub-components ────────────────────────────────────────────────────── */
function AiInsightCard({ insight }: { insight: AiInsight }) {
  const Icon = INSIGHT_ICON_MAP[insight.icon] ?? Zap;
  const styles = {
    critical: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50 text-red-800 dark:text-red-300',
    warning:  'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50 text-amber-800 dark:text-amber-300',
    info:     'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/40 text-blue-800 dark:text-blue-300',
    success:  'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300',
  };
  const iconStyles = {
    critical: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40',
    warning:  'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
    info:     'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40',
    success:  'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
  };
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${styles[insight.severity]}`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconStyles[insight.severity]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm leading-tight">{insight.title}</p>
        <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{insight.message}</p>
      </div>
    </div>
  );
}

function ExitedAssetCard({ asset }: { asset: ExitedAsset }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
      <div className="relative flex-shrink-0">
        <div className="h-10 w-10 rounded-xl overflow-hidden bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/40 flex items-center justify-center">
          {asset.assetImageUrl ? (
            <img src={asset.assetImageUrl} alt={asset.assetName} className="h-full w-full object-cover" />
          ) : (
            <Package className="h-5 w-5 text-red-500" />
          )}
        </div>
        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-900 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-red-800 dark:text-red-200 truncate">{asset.assetName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {asset.lastZone && (
            <span className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <DoorOpen className="h-2.5 w-2.5" />
              {asset.lastZone.name}
              {asset.lastZone.floorNumber && ` · Fl.${asset.lastZone.floorNumber}`}
            </span>
          )}
          {asset.minutesOutside != null && (
            <span className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {asset.minutesOutside}m outside
            </span>
          )}
          {asset.batteryLevel != null && (
            <span className="text-[10px] text-red-500 flex items-center gap-0.5">
              <Battery className="h-2.5 w-2.5" />
              {asset.batteryLevel}%
            </span>
          )}
        </div>
      </div>
      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700/40 px-2 py-0.5 rounded-full flex-shrink-0">
        OUTSIDE
      </span>
    </div>
  );
}

function MovementRow({ event, showAsset }: { event: MovementEvent; showAsset?: boolean }) {
  const cfg = getEventConfig(event.eventType);
  const Icon = cfg.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`relative pl-8 pb-4 last:pb-0 cursor-pointer select-none`}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Timeline line */}
      <div className="absolute left-3 top-4 bottom-0 w-px bg-border/50 last:hidden" />
      {/* Timeline dot */}
      <div className={`absolute left-1.5 top-2 h-3 w-3 rounded-full border-2 border-background ${cfg.dot} ring-2 ring-offset-1 ${
        event.eventType === 'ENTERPRISE_EXIT' ? 'ring-red-300 dark:ring-red-800 animate-pulse' : 'ring-transparent'
      }`} />

      <div className={`group rounded-xl border px-3 py-2.5 hover:shadow-sm transition-all duration-150 ${cfg.bg} ${cfg.darkBg} ${cfg.border}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
              event.eventType === 'ENTERPRISE_EXIT' ? 'bg-red-200 dark:bg-red-800/50'
              : event.eventType === 'EXIT_ZONE_DETECTED' ? 'bg-orange-200 dark:bg-orange-800/50'
              : event.toZoneIsRestricted ? 'bg-amber-200 dark:bg-amber-800/50'
              : 'bg-white/60 dark:bg-white/10'
            }`}>
              <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
            </div>
            <div className="min-w-0">
              {showAsset && (
                <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text} opacity-70`}>
                  {event.assetName}
                </span>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                {event.fromZoneName && (
                  <span className={`text-xs font-medium ${cfg.text} opacity-80`}>{event.fromZoneName}</span>
                )}
                {event.fromZoneName && event.toZoneName && (
                  <ArrowRight className={`h-3 w-3 ${cfg.text} opacity-60 flex-shrink-0`} />
                )}
                <span className={`text-xs font-bold ${cfg.text}`}>
                  {event.toZoneName ?? (event.eventType === 'SIGNAL_LOST' ? 'No Signal' : 'Unknown')}
                </span>
                {event.toZoneIsRestricted && (
                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700/40 px-1 rounded">RESTRICTED</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.text} ${cfg.bg} ${cfg.darkBg} ${cfg.border}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{fmtTime(event.timestamp)}</span>
            {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="mt-2.5 pt-2.5 border-t border-current/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {event.toZoneFloor && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">Floor</p>
                <p className={`text-xs font-bold ${cfg.text}`}>{event.toZoneFloor}</p>
              </div>
            )}
            {event.rssi != null && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">RSSI</p>
                <p className={`text-xs font-bold ${cfg.text}`}>{event.rssi} dBm</p>
              </div>
            )}
            {event.battery != null && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">Battery</p>
                <p className={`text-xs font-bold ${event.battery <= 20 ? 'text-red-600' : cfg.text}`}>{event.battery}%</p>
              </div>
            )}
            {event.durationInPreviousZone > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">Time in prev.</p>
                <p className={`text-xs font-bold ${cfg.text}`}>{fmtDuration(event.durationInPreviousZone)}</p>
              </div>
            )}
            <div className="col-span-2 sm:col-span-4">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">Tag MAC</p>
              <p className="text-[10px] font-mono text-foreground/60">{event.tagMac}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
interface RFIDMovementTimelineProps {
  assetId?: string;   // Filter to a specific asset
  compact?: boolean;  // Compact mode (no AI insights, no summary stats)
  hours?: number;     // Time window
}

export function RFIDMovementTimeline({ assetId, compact = false, hours: defaultHours = 24 }: RFIDMovementTimelineProps) {
  const [data, setData] = useState<MovementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hours, setHours] = useState(defaultHours);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'exit' | 'move' | 'entry'>('all');
  const [groupByAsset, setGroupByAsset] = useState(!assetId);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ hours: String(hours), limit: '300' });
      if (assetId) params.set('assetId', assetId);
      const res = await fetch(`/api/rfid/movement-history?${params}`, {
        signal: abortRef.current.signal,
        credentials: 'same-origin',
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assetId, hours]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const filteredMovements = (data?.movements ?? []).filter(m => {
    const matchSearch = !search ||
      m.assetName.toLowerCase().includes(search.toLowerCase()) ||
      (m.toZoneName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.fromZoneName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType =
      filterType === 'all' ? true
      : filterType === 'exit' ? (m.eventType === 'ENTERPRISE_EXIT' || m.eventType === 'EXIT_ZONE_DETECTED')
      : filterType === 'move' ? m.eventType === 'ZONE_MOVE'
      : filterType === 'entry' ? m.eventType === 'ZONE_ENTRY'
      : true;
    return matchSearch && matchType;
  });

  // Group movements by date
  const grouped = new Map<string, MovementEvent[]>();
  for (const m of filteredMovements) {
    const dateKey = fmtDate(m.timestamp);
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(m);
  }

  // Group by asset if in global view
  const byAsset = new Map<string, MovementEvent[]>();
  if (groupByAsset && !assetId) {
    for (const m of filteredMovements) {
      const key = m.assetId ?? m.tagMac;
      if (!byAsset.has(key)) byAsset.set(key, []);
      byAsset.get(key)!.push(m);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse" style={{ opacity: 1 - i * 0.25 }}>
            <div className="h-10 w-10 rounded-xl bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded-lg w-48" />
              <div className="h-3 bg-muted/60 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="space-y-4">
      {/* ── AI Insights (full mode only) ──────────────────────────────── */}
      {!compact && data?.aiInsights && data.aiInsights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">AI Movement Analysis</span>
          </div>
          {data.aiInsights.map(ins => <AiInsightCard key={ins.id} insight={ins} />)}
        </div>
      )}

      {/* ── Assets Currently Outside ─────────────────────────────────── */}
      {(data?.exitedAssets?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <LogOut className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">
              Assets Outside Premises ({data!.exitedAssets.length})
            </span>
          </div>
          <div className="space-y-2">
            {data!.exitedAssets.map(a => (
              <ExitedAssetCard key={a.tagId} asset={a} />
            ))}
          </div>
        </div>
      )}

      {/* ── Summary Stats ────────────────────────────────────────────── */}
      {!compact && s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Movements', value: s.totalMovements, icon: Activity, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20' },
            { label: 'Exit Events', value: s.exitEvents, icon: LogOut, color: s.exitEvents > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400', bg: s.exitEvents > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20' },
            { label: 'Outside Now', value: s.assetsCurrentlyOutside, icon: Building2, color: s.assetsCurrentlyOutside > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400', bg: s.assetsCurrentlyOutside > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20' },
            { label: 'Total Scans', value: s.totalScans, icon: Radio, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/20' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 ${bg}`}>
              <div className={`h-8 w-8 rounded-lg bg-white/60 dark:bg-white/5 flex items-center justify-center flex-shrink-0`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
                <p className={`text-xl font-black tabular-nums ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search asset or zone…"
            className="pl-9 h-9 text-sm rounded-xl"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'exit', 'move', 'entry'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                filterType === f
                  ? f === 'exit' ? 'bg-red-600 text-white border-red-600'
                  : 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 text-muted-foreground hover:bg-muted'
              }`}>
              {f === 'all' ? 'All' : f === 'exit' ? 'Exits' : f === 'move' ? 'Moves' : 'Entries'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[24, 48, 168].map(h => (
            <button key={h} onClick={() => setHours(h)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                hours === h ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:bg-muted'
              }`}>
              {h === 168 ? '7d' : `${h}h`}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="h-9 w-9 p-0 rounded-lg">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Last refreshed ───────────────────────────────────────────── */}
      {data?.meta.generatedAt && (
        <p className="text-[10px] text-muted-foreground text-right">
          Updated {timeAgo(data.meta.generatedAt)}
          {refreshing && <span className="ml-1 text-primary">· Refreshing…</span>}
        </p>
      )}

      {/* ── Timeline / Group view ─────────────────────────────────────── */}
      {filteredMovements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">No movement events</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {search ? `No movements matching "${search}"` : `No zone transitions detected in the last ${hours}h`}
          </p>
        </div>
      ) : groupByAsset && !assetId ? (
        /* Asset-grouped view */
        <div className="space-y-3">
          {[...byAsset.entries()].map(([assetKey, events]) => {
            const sample = events[0];
            const isOpen = expandedAsset === assetKey;
            const hasExit = events.some(e => e.eventType === 'ENTERPRISE_EXIT' || e.eventType === 'EXIT_ZONE_DETECTED');
            return (
              <div key={assetKey} className={`rounded-xl border overflow-hidden ${
                hasExit ? 'border-red-200 dark:border-red-800/50' : 'border-border/60'
              }`}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${
                    hasExit ? 'bg-red-50/50 dark:bg-red-950/20' : 'bg-card'
                  }`}
                  onClick={() => setExpandedAsset(isOpen ? null : assetKey)}
                >
                  <div className="h-9 w-9 rounded-xl bg-muted border border-border/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {sample.assetImageUrl ? (
                      <img src={sample.assetImageUrl} alt={sample.assetName} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4.5 w-4.5 text-muted-foreground h-[18px] w-[18px]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{sample.assetName}</p>
                    <p className="text-[10px] text-muted-foreground">{events.length} movement{events.length !== 1 ? 's' : ''} in {hours}h</p>
                  </div>
                  {hasExit && (
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700/40 px-2 py-0.5 rounded-full">EXIT</span>
                  )}
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-border/40 p-4 bg-background/50">
                    {events.map(e => <MovementRow key={e.id} event={e} showAsset={false} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Chronological timeline view */
        <div className="space-y-4">
          {[...grouped.entries()].map(([dateKey, events]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{dateKey}</span>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] text-muted-foreground">{events.length} event{events.length !== 1 ? 's' : ''}</span>
              </div>
              <div>
                {events.map(e => <MovementRow key={e.id} event={e} showAsset={!assetId} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RFIDMovementTimeline;
