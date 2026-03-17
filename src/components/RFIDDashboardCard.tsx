// @ts-nocheck
/**
 * RFIDDashboardCard — World-class RFID movement widget for the main dashboard.
 * Premium dark-gradient design with live tracking, exit alerts & AI insights.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowRight, ChevronRight, Clock,
  DoorOpen, LogOut, MapPin, Radio, RefreshCw, Shield,
  ShieldAlert, ShieldCheck, Zap,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────────── */
interface RFIDStatus {
  tags: { total: number; active: number; lowBattery: number; missing: number };
  movements: { total: number; exitEvents: number; assetsOutside: number; scans24h: number };
  recentExits: Array<{ assetName: string; zoneName?: string; minutesAgo: number }>;
  recentMovements: Array<{ assetName: string; fromZone?: string; toZone?: string; timestamp: string }>;
  aiInsights: Array<{ severity: string; title: string; message: string }>;
  meta: { generatedAt: string };
}

/* ── Helpers ──────────────────────────────────────────────────────────── */
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

/* ── Loading Skeleton ─────────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950" />
      <div className="relative z-10 p-6 space-y-5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-36 bg-white/10 rounded-lg" />
            <div className="h-3 w-24 bg-white/5 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */
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
            total:         mv?.summary?.totalMovements         ?? 0,
            exitEvents:    mv?.summary?.exitEvents             ?? 0,
            assetsOutside: mv?.summary?.assetsCurrentlyOutside ?? 0,
            scans24h:      dash?.stats?.scans24h               ?? 0,
          },
          recentExits: (mv?.exitedAssets ?? []).slice(0, 4).map((a: any) => ({
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

  const hasExits    = (status?.movements.assetsOutside ?? 0) > 0;
  const hasMissing  = (status?.tags.missing ?? 0) > 0;
  const hasAlerts   = hasExits || hasMissing;
  const showExits   = (status?.recentExits?.length ?? 0) > 0;

  // Derive gradient based on alert state
  const heroBg = hasExits
    ? 'from-red-950 via-slate-900 to-slate-950'
    : hasMissing
    ? 'from-amber-950 via-slate-900 to-slate-950'
    : 'from-indigo-950 via-slate-900 to-slate-950';

  const accentFrom = hasExits ? '#ef4444' : hasMissing ? '#f59e0b' : '#6366f1';
  const accentTo   = hasExits ? '#f97316' : hasMissing ? '#f97316' : '#8b5cf6';

  const stats = [
    {
      label: 'Active Tags',
      value: status?.tags.active ?? 0,
      sub: `of ${status?.tags.total ?? 0} total`,
      icon: '●',
      dotColor: '#10b981',
      textColor: '#34d399',
      barColor: 'bg-emerald-400',
      barPct: status?.tags.total ? Math.round(((status.tags.active) / status.tags.total) * 100) : 0,
    },
    {
      label: 'Missing',
      value: status?.tags.missing ?? 0,
      sub: hasMissing ? 'requires attention' : 'all accounted for',
      icon: '▲',
      dotColor: hasMissing ? '#ef4444' : '#6b7280',
      textColor: hasMissing ? '#f87171' : '#9ca3af',
      barColor: hasMissing ? 'bg-red-400' : 'bg-slate-600',
      barPct: hasMissing ? 100 : 0,
      pulse: hasMissing,
    },
    {
      label: 'Exits 24h',
      value: status?.movements.exitEvents ?? 0,
      sub: hasExits ? 'outside premises' : 'no exits detected',
      icon: '↗',
      dotColor: hasExits ? '#f97316' : '#6b7280',
      textColor: hasExits ? '#fb923c' : '#9ca3af',
      barColor: hasExits ? 'bg-orange-400' : 'bg-slate-600',
      barPct: hasExits ? 100 : 0,
      pulse: hasExits,
    },
    {
      label: 'Movements',
      value: status?.movements.total ?? 0,
      sub: `${status?.movements.scans24h ?? 0} scans`,
      icon: '→',
      dotColor: '#8b5cf6',
      textColor: '#a78bfa',
      barColor: 'bg-violet-400',
      barPct: Math.min(100, Math.round((status?.movements.total ?? 0) / 2)),
    },
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl">
      {/* ── Dark gradient background ─────────────────────────────────── */}
      <div className={`absolute inset-0 bg-gradient-to-br ${heroBg}`} />

      {/* ── Radial glow overlays ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 80% 0%, ${accentFrom}18 0%, transparent 55%),
                       radial-gradient(ellipse at 10% 100%, ${accentTo}10 0%, transparent 55%)`,
        }}
      />

      {/* ── Decorative signal rings (top-right) ─────────────────────── */}
      <div className="absolute -top-12 -right-12 w-48 h-48 opacity-10 pointer-events-none">
        {[1, 2, 3].map(i => (
          <div key={i} className="absolute inset-0 rounded-full border border-white/30"
            style={{ transform: `scale(${0.4 + i * 0.25})`, opacity: 1 - i * 0.25 }} />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <Radio className="h-8 w-8 text-white/20" />
        </div>
      </div>

      {/* ── Top accent line ──────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accentFrom}, ${accentTo}, transparent)` }}
      />

      <div className="relative z-10 p-6 space-y-5">

        {/* ── Header row ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {/* Icon badge */}
            <div
              className="relative h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${accentFrom}30, ${accentTo}20)`,
                border: `1px solid ${accentFrom}30`,
              }}
            >
              <Radio className="h-5 w-5" style={{ color: accentFrom }} />
              {/* Live dot */}
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${hasAlerts ? 'bg-red-400 animate-ping' : 'bg-emerald-400 animate-ping'}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${hasAlerts ? 'bg-red-500' : 'bg-emerald-500'} border border-slate-900`} />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white leading-tight">RFID Asset Tracking</h3>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10 uppercase tracking-widest">
                  BLE 5.0
                </span>
              </div>
              <p className="text-[10px] text-white/40 mt-0.5">Huawei AirEngine · {status?.movements.scans24h ?? 0} scans today</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Security status pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                hasExits
                  ? 'bg-red-500/15 border-red-500/30 text-red-300'
                  : hasMissing
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {hasExits
                ? <><ShieldAlert className="h-3 w-3" /> Alert</>
                : hasMissing
                ? <><Shield className="h-3 w-3" /> Warning</>
                : <><ShieldCheck className="h-3 w-3" /> Secure</>}
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-colors"
            >
              <RefreshCw className={`h-3 w-3 text-white/50 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="relative rounded-xl overflow-hidden p-3.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Subtle inner glow */}
              <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(ellipse at 50% -20%, ${s.dotColor}15, transparent 70%)` }} />

              <div className="relative z-10">
                {/* Value */}
                <div className="flex items-start justify-between mb-1">
                  <p className="text-2xl font-black tabular-nums leading-none" style={{ color: s.textColor }}>
                    {s.value.toLocaleString()}
                  </p>
                  {s.pulse && (
                    <span className="mt-1 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: s.dotColor }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: s.dotColor }} />
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${s.barColor}`}
                    style={{ width: `${s.barPct}%`, opacity: 0.8 }}
                  />
                </div>

                {/* Label */}
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 leading-tight">{s.label}</p>
                <p className="text-[9px] text-white/25 leading-tight mt-0.5 truncate">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── AI Insights ──────────────────────────────────────────────── */}
        {status?.aiInsights && status.aiInsights.length > 0 && (
          <div className="space-y-2">
            {status.aiInsights.map((ins, i) => {
              const isCrit = ins.severity === 'critical';
              const isWarn = ins.severity === 'warning';
              const isOk   = ins.severity === 'success';
              const dotC   = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : isOk ? '#10b981' : '#6366f1';
              const bgC    = isCrit ? 'rgba(239,68,68,0.08)' : isWarn ? 'rgba(245,158,11,0.08)' : isOk ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)';
              const borderC = isCrit ? 'rgba(239,68,68,0.2)' : isWarn ? 'rgba(245,158,11,0.2)' : isOk ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)';
              const Icon   = isCrit ? ShieldAlert : isWarn ? Shield : isOk ? ShieldCheck : Zap;
              return (
                <div key={i} className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                  style={{ background: bgC, border: `1px solid ${borderC}` }}>
                  <div className="h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${dotC}20` }}>
                    <Icon className="h-3 w-3" style={{ color: dotC }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight" style={{ color: dotC }}>{ins.title}</p>
                    <p className="text-[10px] text-white/40 leading-snug mt-0.5 line-clamp-1">{ins.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── View toggle (when exits exist) ───────────────────────────── */}
        {showExits && (
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['movements', 'exits'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all uppercase tracking-widest"
                style={activeView === v
                  ? v === 'exits'
                    ? { background: 'rgba(239,68,68,0.3)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }
                    : { background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
                  : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }
                }>
                {v === 'exits' ? `🚨 Exits (${status?.recentExits.length ?? 0})` : '⟶ Movements'}
              </button>
            ))}
          </div>
        )}

        {/* ── Feed ─────────────────────────────────────────────────────── */}
        <div>
          {(showExits && activeView === 'exits') ? (
            /* Exit alerts */
            <div className="space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-1.5 mb-2">
                <DoorOpen className="h-3 w-3 text-red-400" /> Assets Outside Premises
              </p>
              {status!.recentExits.map((exit, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <div className="relative flex-shrink-0">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.15)' }}>
                      <DoorOpen className="h-4 w-4 text-red-400" />
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-slate-900 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-200 truncate">{exit.assetName}</p>
                    {exit.zoneName && (
                      <p className="text-[10px] text-red-400/70 flex items-center gap-0.5 truncate">
                        <MapPin className="h-2.5 w-2.5" />{exit.zoneName}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-[9px] font-black text-red-400 bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded-md">OUTSIDE</span>
                    <p className="text-[9px] text-red-400/60 mt-0.5 flex items-center justify-end gap-0.5">
                      <Clock className="h-2.5 w-2.5" />{exit.minutesAgo}m
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : status?.recentMovements && status.recentMovements.length > 0 ? (
            /* Movement feed */
            <div className="space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-1.5 mb-2">
                <Activity className="h-3 w-3 text-indigo-400" /> Recent Zone Transitions
              </p>
              {status.recentMovements.map((m, i) => (
                <div key={i}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group cursor-default"
                  style={{ borderBottom: i < (status?.recentMovements?.length ?? 0) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  {/* Colored index dot */}
                  <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{
                    background: ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b'][i % 5],
                  }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/80 truncate group-hover:text-white transition-colors">{m.assetName}</p>
                    <div className="flex items-center gap-1 text-[10px] text-white/30">
                      {m.fromZone && <span className="truncate max-w-[70px]">{m.fromZone}</span>}
                      {m.fromZone && m.toZone && <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />}
                      {m.toZone && <span className="truncate max-w-[70px] text-white/50">{m.toZone}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-white/25 flex-shrink-0 tabular-nums font-mono">{fmtTime(m.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            /* All clear */
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.15)' }}>
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-300">All Assets Secure</p>
                <p className="text-[10px] text-emerald-400/50 mt-0.5">
                  No exits · {status?.tags.active ?? 0} active tags · {status?.movements.scans24h ?? 0} scans today
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <p className="text-[10px] text-white/25 tabular-nums">
              {timeAgo(status?.meta.generatedAt ?? new Date().toISOString())}
              {refreshing && <span className="text-indigo-400"> · Refreshing…</span>}
            </p>
          </div>
          <Link href="/rfid"
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-indigo-200 transition-colors">
            Full Tracking Dashboard <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RFIDDashboardCard;
