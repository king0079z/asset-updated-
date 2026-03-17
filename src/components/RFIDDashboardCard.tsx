// @ts-nocheck
/**
 * RFIDDashboardCard — Compact RFID movement status widget for the main dashboard.
 * Shows live tag counts, recent movements, and enterprise exit warnings.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowRight, Battery, CheckCircle2,
  Clock, DoorOpen, LogOut, MapPin, Package, Radio, RefreshCw,
  Shield, TrendingUp, Wifi, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RFIDStatus {
  tags: { total: number; active: number; lowBattery: number; missing: number };
  movements: { total: number; exitEvents: number; assetsOutside: number; scans24h: number };
  recentExits: Array<{
    assetName: string; zoneName?: string; minutesAgo: number;
  }>;
  recentMovements: Array<{
    assetName: string; fromZone?: string; toZone?: string; timestamp: string;
  }>;
  meta: { generatedAt: string };
}

function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function RFIDDashboardCard() {
  const [status, setStatus] = useState<RFIDStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async (force = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    if (force) setRefreshing(true);

    try {
      // Fetch both dashboard and movement-history in parallel
      const [dashRes, mvRes] = await Promise.all([
        fetch('/api/rfid/dashboard', { signal: abortRef.current.signal, credentials: 'same-origin' }),
        fetch('/api/rfid/movement-history?hours=24&limit=50', { signal: abortRef.current.signal, credentials: 'same-origin' }),
      ]);

      const dash = dashRes.ok ? await dashRes.json() : null;
      const mv   = mvRes.ok  ? await mvRes.json()   : null;

      if (dash || mv) {
        setStatus({
          tags: {
            total:      dash?.stats?.totalTags  ?? 0,
            active:     dash?.stats?.activeTags ?? 0,
            lowBattery: dash?.stats?.lowBattery ?? 0,
            missing:    dash?.stats?.missing    ?? 0,
          },
          movements: {
            total:          mv?.summary?.totalMovements       ?? 0,
            exitEvents:     mv?.summary?.exitEvents           ?? 0,
            assetsOutside:  mv?.summary?.assetsCurrentlyOutside ?? 0,
            scans24h:       dash?.stats?.scans24h             ?? 0,
          },
          recentExits: (mv?.exitedAssets ?? []).slice(0, 3).map((a: any) => ({
            assetName:  a.assetName,
            zoneName:   a.lastZone?.name,
            minutesAgo: a.minutesOutside ?? 0,
          })),
          recentMovements: (mv?.movements ?? [])
            .filter((m: any) => m.eventType === 'ZONE_MOVE' || m.eventType === 'ZONE_ENTRY')
            .slice(0, 4)
            .map((m: any) => ({
              assetName: m.assetName,
              fromZone:  m.fromZoneName,
              toZone:    m.toZoneName,
              timestamp: m.timestamp,
            })),
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

  const hasExits = (status?.movements.assetsOutside ?? 0) > 0;
  const hasMissing = (status?.tags.missing ?? 0) > 0;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
        <div className="p-5 space-y-4 animate-pulse">
          <div className="h-5 w-40 bg-muted rounded-lg" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl" />)}
          </div>
          <div className="h-24 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border bg-card overflow-hidden transition-all ${
      hasExits ? 'border-red-300 dark:border-red-800 shadow-red-500/10 shadow-lg' : 'border-border'
    }`}>
      {/* Top accent bar */}
      <div className={`h-1 w-full ${hasExits ? 'bg-gradient-to-r from-red-500 via-orange-500 to-amber-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
              hasExits ? 'bg-red-100 dark:bg-red-950/40' : 'bg-indigo-100 dark:bg-indigo-950/40'
            }`}>
              <Radio className={`h-4.5 w-4.5 h-[18px] w-[18px] ${hasExits ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
            </div>
            <div>
              <h3 className="font-bold text-sm">RFID Asset Tracking</h3>
              <p className="text-[10px] text-muted-foreground">Huawei AirEngine BLE · Live</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasExits && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 px-2 py-0.5 rounded-full animate-pulse">
                <LogOut className="h-2.5 w-2.5" />
                EXIT ALERT
              </span>
            )}
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              label: 'Active', value: status?.tags.active ?? 0,
              icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-50 dark:bg-emerald-950/20',
            },
            {
              label: 'Missing', value: status?.tags.missing ?? 0,
              icon: AlertTriangle, color: status?.tags.missing ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
              bg: status?.tags.missing ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/30',
            },
            {
              label: 'Exits', value: status?.movements.exitEvents ?? 0,
              icon: LogOut, color: status?.movements.exitEvents ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
              bg: status?.movements.exitEvents ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-muted/30',
            },
            {
              label: '24h Scans', value: status?.movements.scans24h ?? 0,
              icon: Activity, color: 'text-violet-600 dark:text-violet-400',
              bg: 'bg-violet-50 dark:bg-violet-950/20',
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl ${bg}`}>
              <Icon className={`h-4 w-4 ${color} mb-1`} />
              <p className={`text-lg font-black tabular-nums leading-tight ${color}`}>{value}</p>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Exit alerts */}
        {status?.recentExits && status.recentExits.length > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
            <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-1">
              <DoorOpen className="h-3 w-3" /> Assets Outside Enterprise
            </p>
            {status.recentExits.map((exit, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <p className="text-xs font-semibold text-red-800 dark:text-red-200 flex-1 truncate">{exit.assetName}</p>
                {exit.zoneName && (
                  <span className="text-[10px] text-red-600 dark:text-red-400 flex-shrink-0 flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />{exit.zoneName}
                  </span>
                )}
                <span className="text-[10px] text-red-500 flex-shrink-0 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />{exit.minutesAgo}m
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recent movements */}
        {!hasExits && status?.recentMovements && status.recentMovements.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Recent Movements</p>
            {status.recentMovements.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="font-semibold text-foreground truncate max-w-[100px]">{m.assetName}</span>
                {m.fromZone && (
                  <>
                    <span className="truncate max-w-[70px] text-muted-foreground/70">{m.fromZone}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                  </>
                )}
                <span className="truncate max-w-[70px]">{m.toZone ?? '—'}</span>
                <span className="ml-auto flex-shrink-0 text-[10px]">{timeAgo(m.timestamp)}</span>
              </div>
            ))}
          </div>
        )}

        {/* No data state */}
        {!hasExits && (!status?.recentMovements || status.recentMovements.length === 0) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <span>All assets within premises · No anomalies detected</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground">
            Updated {timeAgo(status?.meta.generatedAt ?? new Date().toISOString())} ago
          </p>
          <Link href="/rfid" className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Full RFID Dashboard <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RFIDDashboardCard;
