'use client';
// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ── Isometric projection constants ────────────────────────────────────────────
// Building footprint on SVG canvas (900×580)
const ORIGIN   = { x: 390, y: 478 };   // front-left anchor of Floor 1 top face
const AB       = { x: 290, y: -154 };  // vector: left → right on floor
const AD       = { x: -185, y: -103 }; // vector: front → back on floor
const FLOOR_H  = 62;  // vertical rise per floor level (SVG px)
const SLAB_H   = 13;  // thickness of slab face (SVG px)

function iso(px: number, py: number, level: number): [number, number] {
  const oy = ORIGIN.y - level * FLOOR_H;
  return [
    ORIGIN.x + px * AB.x + py * AD.x,
    oy       + px * AB.y + py * AD.y,
  ];
}

function pts(...coords: [number, number][]): string {
  return coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

// Zone percentage coords (0-100) → 4 parallelogram corners on a floor level
function zonePoly(zx: number, zy: number, zw: number, zh: number, level: number) {
  const [x1, y1] = [zx / 100, zy / 100];
  const [x2, y2] = [(zx + zw) / 100, zy / 100];
  const [x3, y3] = [(zx + zw) / 100, (zy + zh) / 100];
  const [x4, y4] = [zx / 100, (zy + zh) / 100];
  return pts(iso(x1, y1, level), iso(x2, y2, level), iso(x3, y3, level), iso(x4, y4, level));
}

// Centroid of zone in SVG coords
function zoneCentroid(zx: number, zy: number, zw: number, zh: number, level: number): [number, number] {
  return iso((zx + zw / 2) / 100, (zy + zh / 2) / 100, level);
}

// ── Static floor zone definitions (matches seed-demo.ts) ─────────────────────
const STATIC_ZONES: Record<number, Array<{
  name: string; x: number; y: number; w: number; h: number; restricted: boolean;
}>> = {
  1: [
    { name: 'Pharmacy Store',       x: 1,  y: 8,  w: 15, h: 40, restricted: true  },
    { name: 'Emergency Reception',  x: 17, y: 8,  w: 43, h: 40, restricted: false },
    { name: 'Trauma Bay A',         x: 62, y: 8,  w: 36, h: 40, restricted: true  },
    { name: 'Radiology Suite',      x: 1,  y: 52, w: 59, h: 43, restricted: false },
    { name: 'Trauma Bay B',         x: 62, y: 52, w: 36, h: 43, restricted: true  },
  ],
  2: [
    { name: 'ICU Unit A',       x: 1,  y: 8,  w: 31, h: 40, restricted: false },
    { name: 'ICU Unit B',       x: 34, y: 8,  w: 31, h: 40, restricted: false },
    { name: 'Recovery Suite',   x: 67, y: 8,  w: 31, h: 40, restricted: false },
    { name: 'Operating Room 1', x: 1,  y: 52, w: 47, h: 43, restricted: true  },
    { name: 'Operating Room 2', x: 50, y: 52, w: 48, h: 43, restricted: true  },
  ],
  3: [
    { name: 'Ward A — General',      x: 1,  y: 8,  w: 31, h: 40, restricted: false },
    { name: 'Ward B — Private',      x: 34, y: 8,  w: 31, h: 40, restricted: false },
    { name: 'Nursing Station',       x: 67, y: 8,  w: 31, h: 40, restricted: false },
    { name: 'Medical Supplies Store',x: 1,  y: 52, w: 50, h: 43, restricted: true  },
    { name: 'Administration Office', x: 53, y: 52, w: 45, h: 43, restricted: false },
  ],
};

const FLOOR_ACCENT = { 1: '#6366f1', 2: '#a855f7', 3: '#14b8a6' };
const FLOOR_LABEL  = {
  1: 'Emergency & Diagnostic',
  2: 'ICU & Critical Care',
  3: 'Patient Wards & Admin',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:      '#10b981',
  LOW_BATTERY: '#f59e0b',
  MISSING:     '#ef4444',
  INACTIVE:    '#94a3b8',
  UNASSIGNED:  '#c084fc',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface AssetLoc {
  tagId: string; tagMac: string; status: string;
  batteryLevel?: number | null; lastRssi?: number | null; lastSeenAt?: string | null;
  zone?: { id: string; name: string; mapX?: number | null; mapY?: number | null; floorPlanId?: string | null } | null;
  asset?: { id: string; name: string } | null;
}

interface FloorPlan { id: string; name: string; floorNumber?: number | null; }
interface RFIDZone { id: string; name: string; floorPlanId?: string | null; }

interface Tooltip { asset: AssetLoc; svgX: number; svgY: number; }

// ── Component ─────────────────────────────────────────────────────────────────
export default function FloorMap3D() {
  const [floorPlans,   setFloorPlans]   = useState<FloorPlan[]>([]);
  const [zones,        setZones]        = useState<RFIDZone[]>([]);
  const [locations,    setLocations]    = useState<AssetLoc[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedFloor,setSelectedFloor]= useState<number | null>(null); // null = show all
  const [tooltip,      setTooltip]      = useState<Tooltip | null>(null);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());
  const [rotation,     setRotation]     = useState(0); // subtle rotation anim counter

  const fetchData = useCallback(async () => {
    try {
      const [pRes, zRes, lRes] = await Promise.all([
        fetch('/api/rfid/floor-plans'),
        fetch('/api/rfid/zones'),
        fetch('/api/rfid/locations'),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setFloorPlans(d.plans ?? []); }
      if (zRes.ok) { const d = await zRes.json(); setZones(d.zones ?? []); }
      if (lRes.ok) { const d = await lRes.json(); setLocations(d.locations ?? []); }
      setLastRefresh(new Date());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 12000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Build floorNumber → floorPlanId map
  const floorPlanByNumber: Record<number, string> = {};
  floorPlans.forEach(fp => { if (fp.floorNumber) floorPlanByNumber[fp.floorNumber] = fp.id; });

  // Build zoneId → floorNumber map
  const zoneFloor: Record<string, number> = {};
  zones.forEach(z => {
    const fp = floorPlans.find(f => f.id === z.floorPlanId);
    if (fp?.floorNumber) zoneFloor[z.id] = fp.floorNumber;
  });

  // Assets per floor number
  function assetsOnFloor(floorNum: number) {
    const fpId = floorPlanByNumber[floorNum];
    return locations.filter(l => l.zone?.floorPlanId === fpId);
  }

  // Stats
  const stats = {
    total:   locations.length,
    active:  locations.filter(l => l.status === 'ACTIVE').length,
    low:     locations.filter(l => l.status === 'LOW_BATTERY').length,
    missing: locations.filter(l => l.status === 'MISSING').length,
  };

  function handleAssetClick(e: React.MouseEvent<SVGCircleElement>, asset: AssetLoc, svgX: number, svgY: number) {
    e.stopPropagation();
    setTooltip(prev => prev?.asset.tagId === asset.tagId ? null : { asset, svgX, svgY });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[500px] w-full rounded-2xl" />
      </div>
    );
  }

  // Building corner points (for walls)
  const fl1FrontLeft  = iso(0, 0, 0);
  const fl1FrontRight = iso(1, 0, 0);
  const fl1BackLeft   = iso(0, 1, 0);
  const fl1BackRight  = iso(1, 1, 0);
  const fl3FrontLeft  = iso(0, 0, 2);
  const fl3FrontRight = iso(1, 0, 2);
  const fl3BackLeft   = iso(0, 1, 2);

  // Slab bottom points
  const fl1FrontLeftB  : [number, number] = [fl1FrontLeft[0],  fl1FrontLeft[1]  + SLAB_H];
  const fl1FrontRightB : [number, number] = [fl1FrontRight[0], fl1FrontRight[1] + SLAB_H];
  const fl1BackLeftB   : [number, number] = [fl1BackLeft[0],   fl1BackLeft[1]   + SLAB_H];

  return (
    <div className="space-y-4" onClick={() => setTooltip(null)}>
      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl">
          <button
            onClick={() => setSelectedFloor(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${!selectedFloor ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All Floors
          </button>
          {[1, 2, 3].map(f => (
            <button key={f}
              onClick={() => setSelectedFloor(selectedFloor === f ? null : f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${selectedFloor === f ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Floor {f}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto flex-wrap items-center">
          {stats.active  > 0 && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0">{stats.active} Active</Badge>}
          {stats.low     > 0 && <Badge className="bg-amber-100  text-amber-700  dark:bg-amber-900  dark:text-amber-300  border-0">{stats.low} Low Battery</Badge>}
          {stats.missing > 0 && <Badge className="bg-red-100    text-red-700    dark:bg-red-900    dark:text-red-300    border-0">{stats.missing} Missing</Badge>}
          <Button variant="outline" size="sm" onClick={fetchData} className="h-7 text-xs rounded-lg">
            ↻ Refresh
          </Button>
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">

        {/* ── 3-D Building SVG ─────────────────────────────────────────── */}
        <div className="relative rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 overflow-hidden shadow-2xl">
          {/* Grid background */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.5) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.5) 40px)' }}
          />

          <svg viewBox="0 0 880 570" className="w-full h-auto relative z-10" onClick={() => setTooltip(null)}>
            <defs>
              {/* Gradients */}
              <linearGradient id="leftWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#374151"/>
                <stop offset="100%" stopColor="#1f2937"/>
              </linearGradient>
              <linearGradient id="frontWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#4b5563"/>
                <stop offset="100%" stopColor="#374151"/>
              </linearGradient>
              <linearGradient id="fl1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#e0e7ff"/>
                <stop offset="100%" stopColor="#c7d2fe"/>
              </linearGradient>
              <linearGradient id="fl2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#f3e8ff"/>
                <stop offset="100%" stopColor="#e9d5ff"/>
              </linearGradient>
              <linearGradient id="fl3Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#ccfbf1"/>
                <stop offset="100%" stopColor="#99f6e4"/>
              </linearGradient>
              <radialGradient id="assetGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="white" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="white" stopOpacity="0"/>
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <style>{`
                @keyframes assetPulse {
                  0%, 100% { r: 5px; opacity: 1; }
                  50% { r: 7px; opacity: 0.85; }
                }
                @keyframes assetPulseRed {
                  0%, 100% { r: 5px; opacity: 1; }
                  50% { r: 9px; opacity: 0.7; }
                }
                .pulse-active { animation: assetPulse 2.5s ease-in-out infinite; }
                .pulse-missing { animation: assetPulseRed 1.2s ease-in-out infinite; }
              `}</style>
            </defs>

            {/* ── Building label (top) ─────────────────────────────────── */}
            <text x="440" y="28" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="700" fill="white">Apex Medical Center — AMC Main Building</text>
            <text x="440" y="44" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="10" fill="#64748b">Huawei AirEngine 6776-58TI · BLE 5.0 · Real-time RFID Asset Tracking</text>

            {/* ── Left wall (full building height) ────────────────────── */}
            <polygon
              points={pts(fl3FrontLeft, fl3BackLeft, fl1BackLeftB, fl1FrontLeftB)}
              fill="url(#leftWallGrad)" stroke="#1e293b" strokeWidth="1"
            />
            {/* Floor division lines on left wall */}
            <line x1={fl1FrontLeft[0]} y1={fl1FrontLeft[1]} x2={fl1BackLeft[0]} y2={fl1BackLeft[1]} stroke="#374151" strokeWidth="1" strokeDasharray="4,3"/>
            <line x1={iso(0,0,1)[0]} y1={iso(0,0,1)[1]} x2={iso(0,1,1)[0]} y2={iso(0,1,1)[1]} stroke="#374151" strokeWidth="1" strokeDasharray="4,3"/>

            {/* ── Front wall (full building height) ───────────────────── */}
            <polygon
              points={pts(fl3FrontLeft, fl3FrontRight, fl1FrontRightB, fl1FrontLeftB)}
              fill="url(#frontWallGrad)" stroke="#1e293b" strokeWidth="1"
            />
            {/* Floor division lines on front wall */}
            <line x1={fl1FrontLeft[0]} y1={fl1FrontLeft[1]} x2={fl1FrontRight[0]} y2={fl1FrontRight[1]} stroke="#374151" strokeWidth="1" strokeDasharray="4,3"/>
            <line x1={iso(0,0,1)[0]} y1={iso(0,0,1)[1]} x2={iso(1,0,1)[0]} y2={iso(1,0,1)[1]} stroke="#374151" strokeWidth="1" strokeDasharray="4,3"/>
            {/* Window rows on front wall */}
            {[0, 1].map(level => {
              const wy = (iso(0,0,level)[1] + iso(0,0,level+1)[1]) / 2;
              return [0.15, 0.35, 0.55, 0.75].map((wx, wi) => {
                const wl = iso(wx, 0, level);
                const wr = iso(wx + 0.10, 0, level);
                const midX = (wl[0] + wr[0]) / 2;
                return (
                  <rect key={`win-${level}-${wi}`}
                    x={midX - 12} y={wy - 9} width={24} height={14}
                    rx="2" fill="#1e3a5f" stroke="#2563eb" strokeWidth="0.5" opacity="0.6"
                  />
                );
              });
            })}

            {/* ── Floor slabs (bottom to top, painter's algorithm) ───── */}
            {[1, 2, 3].map(floorNum => {
              const level     = floorNum - 1; // 0=F1, 1=F2, 2=F3
              const accent    = FLOOR_ACCENT[floorNum];
              const floorFace = `fl${floorNum}Grad`;
              const staticZones = STATIC_ZONES[floorNum] ?? [];
              const isSelected  = selectedFloor === floorNum;
              const isDimmed    = selectedFloor !== null && !isSelected;
              const fpId        = floorPlanByNumber[floorNum];
              const floorAssets = locations.filter(l => l.zone?.floorPlanId === fpId);

              // Build zone → asset map
              const zoneAssetMap: Record<string, AssetLoc[]> = {};
              floorAssets.forEach(a => {
                if (!a.zone?.name) return;
                if (!zoneAssetMap[a.zone.name]) zoneAssetMap[a.zone.name] = [];
                zoneAssetMap[a.zone.name].push(a);
              });

              return (
                <g key={floorNum} opacity={isDimmed ? 0.35 : 1}
                  style={{ cursor: 'pointer', transition: 'opacity 0.3s' }}
                  onClick={e => { e.stopPropagation(); setSelectedFloor(isSelected ? null : floorNum); }}
                >
                  {/* Floor top face */}
                  <polygon
                    points={pts(iso(0,0,level), iso(1,0,level), iso(1,1,level), iso(0,1,level))}
                    fill={`url(#${floorFace})`}
                    stroke={isSelected ? accent : '#94a3b8'}
                    strokeWidth={isSelected ? 1.5 : 0.8}
                    opacity={isDimmed ? 0.5 : 0.95}
                  />

                  {/* Floor label on the left face */}
                  <text
                    x={(iso(0,0,level)[0] + iso(0,1,level)[0]) / 2 - 20}
                    y={(iso(0,0,level)[1] + iso(0,1,level)[1]) / 2 + 5}
                    textAnchor="middle"
                    fontFamily="system-ui,sans-serif"
                    fontSize="8"
                    fontWeight="600"
                    fill={isDimmed ? '#4b5563' : '#e2e8f0'}
                    transform={`rotate(-25 ${(iso(0,0,level)[0] + iso(0,1,level)[0]) / 2 - 20} ${(iso(0,0,level)[1] + iso(0,1,level)[1]) / 2 + 5})`}
                  >
                    F{floorNum}
                  </text>

                  {/* Zone polygons */}
                  {staticZones.map(z => {
                    const poly    = zonePoly(z.x, z.y, z.w, z.h, level);
                    const zoneFill= z.restricted ? 'rgba(239,68,68,0.18)' : `${accent}20`;
                    const zoneStk = z.restricted ? 'rgba(239,68,68,0.6)' : `${accent}80`;
                    const assets  = zoneAssetMap[z.name] ?? [];
                    const [cx, cy]= zoneCentroid(z.x, z.y, z.w, z.h, level);

                    return (
                      <g key={z.name}>
                        <polygon points={poly} fill={zoneFill} stroke={zoneStk} strokeWidth="0.7" strokeDasharray={z.restricted ? '3,2' : 'none'}/>

                        {/* Zone label (only if selected floor or all floors) */}
                        {(isSelected || !selectedFloor) && (
                          <text x={cx} y={cy - 3}
                            textAnchor="middle"
                            fontFamily="system-ui,sans-serif"
                            fontSize={isSelected ? 7 : 5.5}
                            fontWeight="600"
                            fill={z.restricted ? '#ef4444' : accent}
                            style={{ pointerEvents: 'none' }}
                          >
                            {z.name.split(' — ')[0]}
                          </text>
                        )}

                        {/* Asset count badge */}
                        {assets.length > 0 && (
                          <g>
                            <circle cx={cx + 16} cy={cy - 10} r="6" fill={accent}/>
                            <text x={cx + 16} y={cy - 7}
                              textAnchor="middle"
                              fontFamily="system-ui,sans-serif"
                              fontSize="5.5"
                              fontWeight="700"
                              fill="white"
                              style={{ pointerEvents: 'none' }}
                            >
                              {assets.length}
                            </text>
                          </g>
                        )}

                        {/* Asset dots */}
                        {assets.map((a, idx) => {
                          const spread = assets.length > 1 ? (idx - (assets.length - 1) / 2) * 7 : 0;
                          const [ax, ay] = zoneCentroid(z.x, z.y + (z.h * 0.25), z.w, z.h * 0.5, level);
                          const color = STATUS_COLOR[a.status] ?? STATUS_COLOR.UNASSIGNED;
                          const pulseClass =
                            a.status === 'MISSING'     ? 'pulse-missing' :
                            a.status === 'ACTIVE'      ? 'pulse-active'  : '';

                          return (
                            <g key={a.tagId}>
                              {/* Glow ring */}
                              <circle
                                cx={ax + spread} cy={ay}
                                r="9" fill={color} opacity="0.2"
                                filter="url(#glow)"
                                style={{ pointerEvents: 'none' }}
                              />
                              {/* Main dot */}
                              <circle
                                cx={ax + spread} cy={ay}
                                r="5" fill={color} stroke="white" strokeWidth="1.5"
                                className={pulseClass}
                                onClick={(e) => handleAssetClick(e, a, ax + spread, ay)}
                                style={{ cursor: 'pointer' }}
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Floor accent bar on front-left edge */}
                  <polygon
                    points={pts(
                      iso(0,0,level),
                      [iso(0,0,level)[0], iso(0,0,level)[1] + SLAB_H],
                      [iso(0,1,level)[0], iso(0,1,level)[1] + SLAB_H],
                      iso(0,1,level),
                    )}
                    fill={accent} opacity="0.3"
                  />
                  {/* Floor number label on slab face */}
                  <text
                    x={iso(0, 0.5, level)[0] - 12}
                    y={iso(0, 0.5, level)[1] + 8}
                    textAnchor="middle"
                    fontFamily="system-ui,sans-serif"
                    fontSize="6"
                    fontWeight="700"
                    fill={accent}
                  >
                    FL{floorNum}
                  </text>
                </g>
              );
            })}

            {/* ── Tooltip ──────────────────────────────────────────────── */}
            {tooltip && (() => {
              const { asset, svgX, svgY } = tooltip;
              const tx = svgX > 600 ? svgX - 165 : svgX + 12;
              const ty = Math.max(svgY - 80, 55);
              const color = STATUS_COLOR[asset.status] ?? '#94a3b8';
              const timeAgo = asset.lastSeenAt
                ? (() => {
                    const s = Math.floor((Date.now() - new Date(asset.lastSeenAt).getTime()) / 1000);
                    if (s < 60) return `${s}s ago`;
                    if (s < 3600) return `${Math.floor(s/60)}m ago`;
                    return `${Math.floor(s/3600)}h ago`;
                  })()
                : 'Unknown';
              return (
                <g onClick={e => e.stopPropagation()}>
                  <rect x={tx} y={ty} width="155" height={asset.batteryLevel != null ? 92 : 78} rx="8"
                    fill="#0f172a" stroke={color} strokeWidth="1.5" opacity="0.97"
                  />
                  <circle cx={tx + 14} cy={ty + 16} r="5" fill={color}/>
                  <text x={tx + 24} y={ty + 20} fontFamily="system-ui,sans-serif" fontSize="9" fontWeight="700" fill="white">
                    {(asset.asset?.name ?? asset.tagMac).substring(0, 22)}
                  </text>
                  <text x={tx + 10} y={ty + 34} fontFamily="monospace,sans-serif" fontSize="7" fill="#64748b">{asset.tagMac}</text>
                  <text x={tx + 10} y={ty + 47} fontFamily="system-ui,sans-serif" fontSize="8" fill="#94a3b8">Status: <tspan fill={color} fontWeight="700">{asset.status.replace('_', ' ')}</tspan></text>
                  <text x={tx + 10} y={ty + 59} fontFamily="system-ui,sans-serif" fontSize="8" fill="#94a3b8">Zone: <tspan fill="white">{asset.zone?.name ?? '—'}</tspan></text>
                  {asset.batteryLevel != null && (
                    <text x={tx + 10} y={ty + 71} fontFamily="system-ui,sans-serif" fontSize="8" fill="#94a3b8">Battery: <tspan fill={asset.batteryLevel <= 20 ? '#f59e0b' : '#10b981'} fontWeight="700">{asset.batteryLevel}%</tspan></text>
                  )}
                  <text x={tx + 10} y={ty + (asset.batteryLevel != null ? 83 : 71)} fontFamily="system-ui,sans-serif" fontSize="8" fill="#94a3b8">Seen: <tspan fill="white">{timeAgo}</tspan></text>
                </g>
              );
            })()}

            {/* ── Legend ───────────────────────────────────────────────── */}
            {Object.entries(STATUS_COLOR).slice(0, 4).map(([status, color], i) => (
              <g key={status} transform={`translate(${12 + i * 105}, 548)`}>
                <circle cx="5" cy="5" r="5" fill={color}/>
                <text x="14" y="9" fontFamily="system-ui,sans-serif" fontSize="8.5" fill="#94a3b8">
                  {status.replace('_', ' ')}
                </text>
              </g>
            ))}
            <text x="870" y="553" textAnchor="end" fontFamily="system-ui,sans-serif" fontSize="7.5" fill="#4b5563">
              Auto-refresh 12s · {lastRefresh.toLocaleTimeString()}
            </text>
          </svg>

          {/* ── Building name overlay ─────────────────────────────────── */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            <div className="flex gap-1">
              {[1, 2, 3].map(f => (
                <div key={f} className="w-2.5 h-2.5 rounded-sm" style={{ background: FLOOR_ACCENT[f] }} />
              ))}
            </div>
            <span className="text-[10px] text-slate-500">3 Floors · 15 Zones</span>
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Building stats card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Building Overview</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Live</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total Assets',  value: stats.total,   color: 'text-foreground'    },
                { label: 'Active',        value: stats.active,  color: 'text-emerald-500'   },
                { label: 'Low Battery',   value: stats.low,     color: 'text-amber-500'     },
                { label: 'Missing',       value: stats.missing, color: 'text-red-500'       },
              ].map(s => (
                <div key={s.label} className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-floor breakdown */}
          {[1, 2, 3].map(floorNum => {
            const fpId     = floorPlanByNumber[floorNum];
            const assets   = locations.filter(l => l.zone?.floorPlanId === fpId);
            const active   = assets.filter(a => a.status === 'ACTIVE').length;
            const missing  = assets.filter(a => a.status === 'MISSING').length;
            const lowBat   = assets.filter(a => a.status === 'LOW_BATTERY').length;
            const accent   = FLOOR_ACCENT[floorNum];
            const isSelected = selectedFloor === floorNum;

            return (
              <button key={floorNum}
                onClick={() => setSelectedFloor(isSelected ? null : floorNum)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-2 bg-card shadow-md'
                    : 'border-border bg-card/50 hover:bg-card'
                }`}
                style={{ borderColor: isSelected ? accent : undefined }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: accent }}/>
                    <span className="text-xs font-bold">Floor {floorNum}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{assets.length} assets</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">{FLOOR_LABEL[floorNum]}</p>
                <div className="flex gap-2">
                  {active  > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">{active} active</span>}
                  {lowBat  > 0 && <span className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">{lowBat} low bat</span>}
                  {missing > 0 && <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">{missing} missing</span>}
                </div>
              </button>
            );
          })}

          {/* Click hint */}
          <p className="text-[10px] text-muted-foreground text-center">
            Click a floor to focus · Click asset dot to inspect
          </p>
        </div>
      </div>

      {/* ── Asset list for selected floor ─────────────────────────────── */}
      {selectedFloor && (() => {
        const fpId = floorPlanByNumber[selectedFloor];
        const floorAssets = locations.filter(l => l.zone?.floorPlanId === fpId);
        if (!floorAssets.length) return null;

        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
              <p className="text-sm font-semibold">
                Floor {selectedFloor} Assets
                <span className="ml-2 text-xs text-muted-foreground">({floorAssets.length} tracked)</span>
              </p>
            </div>
            <div className="divide-y divide-border max-h-72 overflow-auto">
              {floorAssets.map(a => {
                const color  = STATUS_COLOR[a.status] ?? '#94a3b8';
                const timeAgo = a.lastSeenAt
                  ? (() => { const s = Math.floor((Date.now() - new Date(a.lastSeenAt).getTime()) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s/60)}m ago` : `${Math.floor(s/3600)}h ago`; })()
                  : '—';
                return (
                  <div key={a.tagId} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.asset?.name ?? a.tagMac}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.zone?.name ?? '—'} · {timeAgo}</p>
                    </div>
                    {a.batteryLevel != null && (
                      <span className={`text-xs font-bold ${a.batteryLevel <= 20 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {a.batteryLevel}%
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full`}
                      style={{ background: color + '20', color }}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
