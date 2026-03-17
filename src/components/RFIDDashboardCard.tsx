// @ts-nocheck
/**
 * RFIDDashboardCard — World-class RFID movement status widget for the main dashboard.
 * Live asset tracking, exit alerts, movement feed, and AI security status.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowRight, Battery, BatteryLow, Bell,
  Building2, CheckCircle2, ChevronRight, Clock, DoorOpen, LogOut,
  MapPin, Package, Radio, RefreshCw, Shield, ShieldAlert, ShieldCheck,
  TrendingUp, Wifi, Zap, Eye,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface RFIDStatus {
  tags: { total: number; active: number; lowBattery: number; missing: number };
  movements: { total: number; exitEvents: number; assetsOutside: number; scans24h: number };
  recentExits: Array<{ assetName: string; zoneName?: string; minutesAgo: number }>;
  recentMovements: Array<{ assetName: string; fromZone?: string; toZone?: string; timestamp: string }>;
  aiInsights: Array<{ severity: string; title: string; message: string }>;
  meta: { generatedAt: string };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* ── Loading Skeleton ───────────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-muted/60 animate-pulse rounded-lg ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-indigo-500/30 animate-pulse" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

/* ── Security Status Indicator ──────────────────────────────────────────── */
function SecurityBadge({ level }: { level: 'secure' | 'warning' | 'critical' }) {
  const configs = {
    secure: {
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      icon: ShieldCheck,
      label: 'Secure',
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      dot: 'bg-amber-500',
      icon: Shield,
      label: 'Alert',
    },
    critical: {
      bg: 'bg-red-500/10 border-red-500/20',
      text: 'text-red-600 dark:text-red-400',
      dot: 'bg-red-500 animate-ping',
      icon: ShieldAlert,
      label: 'Critical',
    },
  };
  const c = configs[level];
  const Icon = c.icon;
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${c.bg} ${c.text}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${c.dot}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${c.dot.replace(' animate-ping', '')}`} />
      </span>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

/* ── Stat Tile ──────────────────────────────────────────────────────────── */
function StatTile({
  label, value, icon: Icon, color, bg, pulse = false,
}: {
  label: string; value: number | string; icon: any;
  color: string; bg: string; pulse?: boolean;
}) {
  return (
    <div className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border border-transparent overflow-hidden ${bg}`}>
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, currentColor 0%, transparent 70%)',
      }} />
      <Icon className={`h-4 w-4 ${color} mb-1.5 relative z-10`} />
      <p className={`text-xl font-black tabular-nums leading-tight ${color} relative z-10`}>
        {value}
        {pulse && <span className={`absolute -top-0.5 -right-2 h-2 w-2 rounded-full ${color.replace('text-', 'bg-').split(' ')[0]} animate-pulse`} />}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5 relative z-10">{label}</p>
    </div>
  );
}

/* ── Movement Row ───────────────────────────────────────────────────────── */
function MovementRow({ m }: { m: { assetName: string; fromZone?: string; toZone?: string; timestamp: string } }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors group">
      <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
        <ArrowRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate">{m.assetName}</p>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {m.fromZone && <span className="truncate max-w-[60px]">{m.fromZone}</span>}
          {m.fromZone && m.toZone && <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />}
          {m.toZone && <span className="truncate max-w-[60px] font-medium text-foreground/70">{m.toZone}</span>}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">{fmtTime(m.timestamp)}</span>
    </div>
  );
}

/* ── Exit Alert Row ─────────────────────────────────────────────────────── */
function ExitAlertRow({ exit }: { exit: { assetName: string; zoneName?: string; minutesAgo: number } }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/25 border border-red-200/60 dark:border-red-800/30">
      <div className="relative flex-shrink-0">
        <div className="h-7 w-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
          <DoorOpen className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        </div>
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-white dark:border-slate-900 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-red-800 dark:text-red-200 truncate">{exit.assetName}</p>
        {exit.zoneName && (
          <p className="text-[10px] text-red-600/80 dark:text-red-400/80 flex items-center gap-0.5 truncate">
            <MapPin className="h-2.5 w-2.5 flex-shrink-0" />{exit.zoneName}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-md border border-red-200/60 dark:border-red-800/30">
          OUTSIDE
        </span>
        <span className="text-[9px] text-red-500 flex items-center gap-0.5 tabular-nums">
          <Clock className="h-2.5 w-2.5" />{exit.minutesAgo}m
        </span>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export function RFIDDashboardCard() {
  const [status, setStatus] = useState<RFIDStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<'movements' | 'exits'>('movements');
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async (force = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    if (force) setRefreshing(true);

    try {
      const [dashRes, mvRes] = await Promise.all([
        fetch('/api/rfid/dashboard', { signal: abortRef.current.signal, credentials: 'same-origin' }),
        fetch('/api/rfid/movement-history?hours=24&limit=60', { signal: abortRef.current.signal, credentials: 'same-origin' }),
      ]);

      const dash = dashRes.ok ? await dashRes.json() : null;
      const mv = mvRes.ok ? await mvRes.json() : null;

      if (dash || mv) {
        setStatus({
          tags: {
            total:      dash?.stats?.totalTags  ?? 0,
            active:     dash?.stats?.activeTags ?? 0,
            lowBattery: dash?.stats?.lowBattery ?? 0,
            missing:    dash?.stats?.missing    ?? 0,
          },
          movements: {
            total:         mv?.summary?.totalMovements        ?? 0,
            exitEvents:    mv?.summary?.exitEvents            ?? 0,
            assetsOutside: mv?.summary?.assetsCurrentlyOutside ?? 0,
            scans24h:      dash?.stats?.scans24h              ?? 0,
          },
          recentExits: (mv?.exitedAssets ?? []).slice(0, 5).map((a: any) => ({
            assetName:  a.assetName,
            zoneName:   a.lastZone?.name,
            minutesAgo: a.minutesOutside ?? 0,
          })),
          recentMovements: (mv?.movements ?? [])
            .filter((m: any) => m.eventType === 'ZONE_MOVE' || m.eventType === 'ZONE_ENTRY')
            .slice(0, 5)
            .map((m: any) => ({
              assetName: m.assetName,
              fromZone:  m.fromZoneName,
              toZone:    m.toZoneName,
              timestamp: m.timestamp,
            })),
          aiInsights: (mv?.aiInsights ?? []).slice(0, 2),
          meta: { generatedAt: mv?.meta?.generatedAt ?? new Date().toISOString() },
        });
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('[RFIDDashboardCard]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    const t = setInterval(() => fetchStatus(true), 60_000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  if (loading) return <LoadingSkeleton />;

  const hasExits = (status?.movements.assetsOutside ?? 0) > 0;
  const hasMissing = (status?.tags.missing ?? 0) > 0;
  const securityLevel: 'secure' | 'warning' | 'critical' =
    hasExits ? 'critical' : hasMissing ? 'warning' : 'secure';

  const showExits = (status?.recentExits?.length ?? 0) > 0;

  return (
    <div className={`rounded-2xl border bg-card overflow-hidden transition-all duration-300 ${
      hasExits
        ? 'border-red-200/80 dark:border-red-800/50 shadow-[0_0_0_1px_rgba(239,68,68,0.1),0_8px_32px_rgba(239,68,68,0.08)]'
        : 'border-border/60 shadow-sm hover:shadow-md'
    }`}>

      {/* ── Top gradient bar ──────────────────────────────────────────── */}
      <div className={`h-1.5 w-full ${
        hasExits
          ? 'bg-gradient-to-r from-red-600 via-orange-500 to-red-500'
          : hasMissing
          ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500'
          : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400'
      }`} />

      <div className="p-5 space-y-5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className={`relative h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              hasExits
                ? 'bg-red-100 dark:bg-red-950/40'
                : 'bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/50 dark:to-violet-950/50'
            }`}>
              <Radio className={`h-5 w-5 ${hasExits ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
              {(status?.tags.active ?? 0) > 0 && !hasExits && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
              )}
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">RFID Asset Tracking</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                Huawei AirEngine BLE · {status?.movements.scans24h ?? 0} scans today
              </p>
            </div>
          </div>

          {/* Right: security badge + refresh */}
          <div className="flex items-center gap-2">
            <SecurityBadge level={securityLevel} />
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <RefreshCw className={`h-3 w-3 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Stat tiles ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          <StatTile
            label="Active" value={status?.tags.active ?? 0}
            icon={CheckCircle2}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-50 dark:bg-emerald-950/20"
          />
          <StatTile
            label="Missing" value={status?.tags.missing ?? 0}
            icon={AlertTriangle}
            color={hasMissing ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}
            bg={hasMissing ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/30'}
            pulse={hasMissing}
          />
          <StatTile
            label="Exits 24h" value={status?.movements.exitEvents ?? 0}
            icon={LogOut}
            color={hasExits ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}
            bg={hasExits ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-muted/30'}
            pulse={hasExits}
          />
          <StatTile
            label="Movements" value={status?.movements.total ?? 0}
            icon={Activity}
            color="text-violet-600 dark:text-violet-400"
            bg="bg-violet-50 dark:bg-violet-950/20"
          />
        </div>

        {/* ── AI Security Insights ─────────────────────────────────────── */}
        {status?.aiInsights && status.aiInsights.length > 0 && (
          <div className="space-y-1.5">
            {status.aiInsights.map((ins, i) => {
              const isAlert = ins.severity === 'critical' || ins.severity === 'warning';
              return (
                <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-xs ${
                  ins.severity === 'critical'
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/30 text-red-700 dark:text-red-300'
                    : ins.severity === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/30 text-amber-700 dark:text-amber-300'
                    : ins.severity === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {isAlert
                    ? <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    : ins.severity === 'success'
                    ? <ShieldCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    : <Zap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">{ins.title}</p>
                    <p className="opacity-80 leading-snug mt-0.5 text-[10px]">{ins.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab switcher (only if exits) ──────────────────────────── */}
        {showExits && (
          <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
            {(['movements', 'exits'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all uppercase tracking-wide ${
                  activeView === v
                    ? v === 'exits'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'exits' ? `🚨 Exits (${status?.recentExits.length ?? 0})` : 'Movements'}
              </button>
            ))}
          </div>
        )}

        {/* ── Feed content ────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          {(showExits && activeView === 'exits') ? (
            /* Exit alerts feed */
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <DoorOpen className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">
                  Assets Outside Premises
                </span>
              </div>
              {status!.recentExits.map((exit, i) => (
                <ExitAlertRow key={i} exit={exit} />
              ))}
            </>
          ) : status?.recentMovements && status.recentMovements.length > 0 ? (
            /* Movements feed */
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Recent Zone Transitions
                </span>
              </div>
              {status.recentMovements.map((m, i) => (
                <MovementRow key={i} m={m} />
              ))}
            </>
          ) : (
            /* Empty state */
            <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">All assets secure</p>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                  No exits or anomalies in the last 24h · {status?.tags.active ?? 0} tags active
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {timeAgo(status?.meta.generatedAt ?? new Date().toISOString())}
              {refreshing && <span className="ml-1 text-indigo-500">· Refreshing…</span>}
            </p>
          </div>
          <Link
            href="/rfid?tab=movements"
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2 transition-colors"
          >
            Full Tracking Dashboard <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RFIDDashboardCard;
