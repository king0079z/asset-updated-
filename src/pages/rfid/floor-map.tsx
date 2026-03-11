// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const RFID_ZONES_KEY = "/api/rfid/zones";
const RFID_ZONES_TTL = 30_000;
import { useRouter } from 'next/router';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  Package, MapPin, Wifi, AlertTriangle, Battery, BatteryLow,
  RefreshCw, ChevronLeft, Layers, Activity, CheckCircle2,
  Shield, Building2, Loader2, ArrowLeft, Eye, Zap, Clock,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface Zone {
  id: string; name: string; floorNumber?: string; building?: string;
  mapX?: number; mapY?: number; isRestricted: boolean;
  tags?: Tag[];
}
interface Tag {
  id: string; tagId: string; status: string; batteryLevel?: number;
  lastRssi?: number; lastSeenAt?: string;
  asset?: { id: string; name: string; type: string; status: string } | null;
  lastZone?: { id: string; name: string } | null;
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */
// Isometric projection parameters
const ISO = {
  scale: 0.68,
  cos30: Math.cos(Math.PI / 6),
  sin30: 0.5,
  offsetX: 490,
  offsetY: 530,
  roomW: 200,   // world units per room column
  roomD: 150,   // world units per room row
  floorH: 80,   // world units floor slab height
  floorGap: 70, // world units gap between floors
};

function toIso(wx: number, wy: number, wz: number) {
  return {
    x: (wx - wy) * ISO.cos30 * ISO.scale + ISO.offsetX,
    y: (wx + wy) * ISO.sin30 * ISO.scale - wz * ISO.scale + ISO.offsetY,
  };
}

function ptStr(wx: number, wy: number, wz: number) {
  const p = toIso(wx, wy, wz);
  return `${p.x},${p.y}`;
}

function floorZ(floor: number) { // floor 1-3 → world Z of top face
  return (floor - 1) * (ISO.floorH + ISO.floorGap) + ISO.floorH;
}

const FLOOR_W = ISO.roomW * 3; // 600
const FLOOR_D = ISO.roomD * 2; // 300

/* ─── Zone colour scheme ─────────────────────────────────────────────────────── */
const ZONE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  'Main Reception':     { fill: '#1e3a5f', stroke: '#3b82f6', label: '#93c5fd' },
  'IT Operations':      { fill: '#162844', stroke: '#2563eb', label: '#60a5fa' },
  'Help Desk':          { fill: '#163344', stroke: '#0891b2', label: '#67e8f9' },
  'Server Room':        { fill: '#3b0d0d', stroke: '#ef4444', label: '#fca5a5' },
  'Printer Hub':        { fill: '#0d2b1e', stroke: '#16a34a', label: '#86efac' },
  'Storage Room':       { fill: '#2b2204', stroke: '#ca8a04', label: '#fde68a' },
  'Executive Lobby':    { fill: '#1e1040', stroke: '#7c3aed', label: '#c4b5fd' },
  'Boardroom':          { fill: '#0d2b20', stroke: '#059669', label: '#6ee7b7' },
  'Finance Dept':       { fill: '#1a1060', stroke: '#4f46e5', label: '#a5b4fc' },
  'CEO Office':         { fill: '#3b0d1a', stroke: '#e11d48', label: '#fda4af' },
  'HR Department':      { fill: '#2b0d29', stroke: '#c026d3', label: '#f0abfc' },
  'Legal & Compliance': { fill: '#1f2024', stroke: '#64748b', label: '#cbd5e1' },
  'Dev Lab Alpha':      { fill: '#0d2244', stroke: '#0284c7', label: '#7dd3fc' },
  'Dev Lab Beta':       { fill: '#0d2040', stroke: '#1d4ed8', label: '#93c5fd' },
  'QA Testing':         { fill: '#1a0d44', stroke: '#7c3aed', label: '#c4b5fd' },
  'Design Studio':      { fill: '#2b0d2b', stroke: '#db2777', label: '#f9a8d4' },
  'Open Workspace':     { fill: '#1a2204', stroke: '#65a30d', label: '#bef264' },
  'Innovation Lab':     { fill: '#0d2440', stroke: '#0e7490', label: '#67e8f9' },
};

function zoneColor(name: string, restricted: boolean) {
  if (restricted) return { fill: '#3b0d0d', stroke: '#ef4444', label: '#fca5a5' };
  return ZONE_COLORS[name] ?? { fill: '#162030', stroke: '#334155', label: '#94a3b8' };
}

/* ─── Status colours ─────────────────────────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:      '#22c55e',
  LOW_BATTERY: '#f59e0b',
  MISSING:     '#ef4444',
  INACTIVE:    '#6b7280',
  UNASSIGNED:  '#8b5cf6',
};

/* ─── Time helper ────────────────────────────────────────────────────────────── */
function timeAgo(ts?: string | null) {
  if (!ts) return 'N/A';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ─── Floor Room layout: 3 cols × 2 rows = 6 zones per floor ────────────────── */
const FLOOR_DEFS = [
  { number: 1, label: 'Ground Floor', sublabel: 'Operations Center',  wallFill: '#0c1f33', wallFill2: '#0a1a2b' },
  { number: 2, label: 'Level 2',      sublabel: 'Executive Suite',    wallFill: '#120c2b', wallFill2: '#0e0824' },
  { number: 3, label: 'Level 3',      sublabel: 'Engineering Hub',    wallFill: '#0c1f1a', wallFill2: '#0a1916' },
];

/* ──────────────────────────────────────────────────────────────────────────────
 * IsometricBuilding — pure SVG
 * ────────────────────────────────────────────────────────────────────────────── */
function IsometricBuilding({
  zonesByFloor, selectedFloor, onFloorClick, selectedAsset, onAssetClick,
}: {
  zonesByFloor: Record<number, Zone[]>;
  selectedFloor: number | null;
  onFloorClick: (f: number) => void;
  selectedAsset: Tag | null;
  onAssetClick: (tag: Tag) => void;
}) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Pulse tick for animations
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const floors = [3, 2, 1]; // draw back-to-front

  return (
    <svg viewBox="0 0 1000 900" style={{ width: '100%', height: '100%', maxHeight: 720 }}>
      <defs>
        <filter id="glow-green">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="glow-red">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="glow-amber">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <radialGradient id="ground-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#0a0f1e" stopOpacity="0"/>
        </radialGradient>
        {FLOOR_DEFS.map(fd => (
          <linearGradient key={fd.number} id={`wall-grad-${fd.number}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fd.wallFill}/>
            <stop offset="100%" stopColor={fd.wallFill2}/>
          </linearGradient>
        ))}
      </defs>

      {/* Ground shadow */}
      <ellipse cx="490" cy="865" rx="330" ry="28" fill="url(#ground-grad)" opacity="0.6"/>

      {/* Draw floors back-to-front */}
      {floors.map(fNum => {
        const z      = floorZ(fNum);
        const zBot   = z - ISO.floorH;
        const zones  = zonesByFloor[fNum] ?? [];
        const isSelected = selectedFloor === fNum;
        const fDef   = FLOOR_DEFS.find(f => f.number === fNum)!;

        // Outer floor corners (top face)
        const TL = toIso(0,        0,        z);
        const TR = toIso(FLOOR_W,  0,        z);
        const BR = toIso(FLOOR_W,  FLOOR_D,  z);
        const BL = toIso(0,        FLOOR_D,  z);
        // Bottom face corners
        const TLb = toIso(0,        0,        zBot);
        const BLb = toIso(0,        FLOOR_D,  zBot);
        const BRb = toIso(FLOOR_W,  FLOOR_D,  zBot);

        const topPts  = `${TL.x},${TL.y} ${TR.x},${TR.y} ${BR.x},${BR.y} ${BL.x},${BL.y}`;
        const leftPts = `${TL.x},${TL.y} ${BL.x},${BL.y} ${BLb.x},${BLb.y} ${TLb.x},${TLb.y}`;
        const frontPts= `${BL.x},${BL.y} ${BR.x},${BR.y} ${BRb.x},${BRb.y} ${BLb.x},${BLb.y}`;

        return (
          <g key={fNum} style={{ cursor: 'pointer' }} onClick={() => onFloorClick(fNum)}>
            {/* Left wall */}
            <polygon points={leftPts} fill={`url(#wall-grad-${fNum})`} stroke={isSelected ? '#818cf8' : '#1e293b'} strokeWidth={isSelected ? 1.5 : 1}/>
            {/* Front wall */}
            <polygon points={frontPts} fill={`url(#wall-grad-${fNum})`} stroke={isSelected ? '#818cf8' : '#0f172a'} strokeWidth={isSelected ? 1.5 : 1}/>

            {/* Floor number label on left wall */}
            <text
              x={(TL.x + BLb.x) / 2 - 6}
              y={(TL.y + BLb.y) / 2}
              fill={isSelected ? '#a5b4fc' : '#475569'}
              fontSize="11" fontWeight="800" fontFamily="monospace"
              style={{ userSelect: 'none' }}
            >F{fNum}</text>

            {/* Room polygons */}
            {[0, 1, 2].map(col => [0, 1].map(row => {
              const wx  = col * ISO.roomW;
              const wy  = row * ISO.roomD;
              const rTL = toIso(wx,               wy,               z);
              const rTR = toIso(wx + ISO.roomW,   wy,               z);
              const rBR = toIso(wx + ISO.roomW,   wy + ISO.roomD,   z);
              const rBL = toIso(wx,               wy + ISO.roomD,   z);

              // Find zone for this col/row
              const zone = zones.find(z => Math.round(z.mapX ?? -1) === col && Math.round(z.mapY ?? -1) === row);
              const cPal = zone ? zoneColor(zone.name, zone.isRestricted) : { fill: '#111827', stroke: '#1e293b', label: '#4b5563' };
              const isHovered = hoveredZone === zone?.id;

              const pts = `${rTL.x},${rTL.y} ${rTR.x},${rTR.y} ${rBR.x},${rBR.y} ${rBL.x},${rBL.y}`;
              const midX = (rTL.x + rTR.x + rBR.x + rBL.x) / 4;
              const midY = (rTL.y + rTR.y + rBR.y + rBL.y) / 4;

              const tags = zone?.tags ?? [];

              return (
                <g key={`${col}-${row}`}
                  onMouseEnter={() => zone && setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}>
                  <polygon points={pts}
                    fill={cPal.fill}
                    stroke={isHovered ? '#ffffff' : cPal.stroke}
                    strokeWidth={isHovered ? 1.5 : 0.8}
                    opacity={isSelected || selectedFloor === null ? 1 : 0.45}
                  />

                  {/* Zone restricted overlay */}
                  {zone?.isRestricted && (
                    <polygon points={pts} fill="rgba(239,68,68,0.08)" stroke="none"/>
                  )}

                  {/* Zone name label */}
                  {zone && (isSelected || selectedFloor === null) && (
                    <text x={midX} y={midY - 10} fill={cPal.label} fontSize="8.5" fontWeight="700"
                      textAnchor="middle" fontFamily="system-ui" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      {zone.name.length > 14 ? zone.name.slice(0, 13) + '…' : zone.name}
                    </text>
                  )}

                  {/* Asset dots */}
                  {tags.map((tag, ti) => {
                    if (!tag) return null;
                    const dotCount = tags.length;
                    const cols = Math.ceil(Math.sqrt(dotCount));
                    const dc = ti % cols;
                    const dr = Math.floor(ti / cols);
                    const spacing = 18;
                    const startX = midX - ((cols - 1) * spacing) / 2;
                    const dx = startX + dc * spacing;
                    const dy = midY + 6 + dr * spacing;
                    const color = STATUS_COLOR[tag.status] ?? '#6b7280';
                    const isMissing = tag.status === 'MISSING';
                    const isLowBat  = tag.status === 'LOW_BATTERY';
                    const isSelected2 = selectedAsset?.id === tag.id;

                    return (
                      <g key={tag.id} style={{ cursor: 'pointer' }}
                        onClick={e => { e.stopPropagation(); onAssetClick(tag); }}>
                        {/* Pulse ring for missing/critical */}
                        {(isMissing || isLowBat) && (
                          <circle cx={dx} cy={dy} r={isSelected2 ? 12 : 9}
                            fill="none" stroke={color} strokeWidth="1.5"
                            opacity={tick % 2 === 0 ? 0.6 : 0.1}/>
                        )}
                        {/* Outer glow for selected */}
                        {isSelected2 && (
                          <circle cx={dx} cy={dy} r={11} fill={color} opacity="0.25"/>
                        )}
                        {/* Main dot */}
                        <circle cx={dx} cy={dy} r={isSelected2 ? 6 : 5} fill={color}
                          filter={isMissing ? 'url(#glow-red)' : isLowBat ? 'url(#glow-amber)' : 'url(#glow-green)'}/>
                        {/* White center */}
                        <circle cx={dx} cy={dy} r={2} fill="white" opacity="0.8"/>

                        {/* Tooltip on hover (inline title) */}
                        <title>{tag.asset?.name ?? tag.tagId} — {tag.status} {tag.batteryLevel ? `(${tag.batteryLevel}%)` : ''}</title>
                      </g>
                    );
                  })}
                </g>
              );
            }))}

            {/* Divider grid lines on top face */}
            {[1, 2].map(c => {
              const a = toIso(c * ISO.roomW, 0, z);
              const b = toIso(c * ISO.roomW, FLOOR_D, z);
              return <line key={c} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8"/>;
            })}
            {[1].map(r => {
              const a = toIso(0, r * ISO.roomD, z);
              const b = toIso(FLOOR_W, r * ISO.roomD, z);
              return <line key={r} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8"/>;
            })}

            {/* Floor label above TL corner */}
            {(isSelected || selectedFloor === null) && (
              <text x={TL.x - 6} y={TL.y - 8} fill={isSelected ? '#a5b4fc' : '#334155'}
                fontSize="9" fontWeight="800" textAnchor="end" fontFamily="system-ui">
                {fDef.sublabel.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}

      {/* Elevation connector lines (elevator shafts) */}
      {[1, 2].map(seg => {
        const zTop = floorZ(seg + 1);
        const zBot = floorZ(seg) - ISO.floorH;
        const pt1 = toIso(0, 0, zTop);
        const pt2 = toIso(0, 0, zBot);
        return <line key={seg} x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
          stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" strokeDasharray="4 3"/>;
      })}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Main page
 * ────────────────────────────────────────────────────────────────────────────── */
export default function RFIDFloorMapPage() {
  const router = useRouter();
  const [zones,          setZones]          = useState<Zone[]>(() => getFromCache<any>(RFID_ZONES_KEY, RFID_ZONES_TTL)?.zones ?? []);
  const [loading,        setLoading]        = useState(() => !getFromCache(RFID_ZONES_KEY, RFID_ZONES_TTL));
  const [seeding,        setSeeding]        = useState(false);
  const [seedMsg,        setSeedMsg]        = useState('');
  const [selectedFloor,  setSelectedFloor]  = useState<number | null>(null);
  const [selectedAsset,  setSelectedAsset]  = useState<Tag | null>(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const [lastRefresh,    setLastRefresh]    = useState<Date | null>(null);
  const intervalRef = useRef<any>(null);

  const fetchZones = useCallback(async (background = false) => {
    try {
      const d = await fetchWithCache<any>(RFID_ZONES_KEY, { maxAge: RFID_ZONES_TTL });
      if (d?.zones) { setZones(d.zones); setLastRefresh(new Date()); }
      if (!background) setLoading(false);
    } catch { if (!background) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!getFromCache(RFID_ZONES_KEY, RFID_ZONES_TTL)) {
      fetchZones(false);
    }
    // Poll every 30s for live RFID zone updates
    intervalRef.current = setInterval(() => fetchZones(true), 30_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchZones]);

  const refresh = async () => {
    setRefreshing(true);
    await fetchZones();
    setRefreshing(false);
  };

  const seedDemo = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const r = await fetch('/api/demo/seed', { method: 'POST' });
      const d = await r.json();
      if (r.status === 409) { setSeedMsg('⚠️ Already seeded. Showing existing data.'); }
      else if (!r.ok) { setSeedMsg(`❌ ${d.error}`); }
      else { setSeedMsg(`✅ ${d.message}`); await fetchZones(); }
    } catch { setSeedMsg('❌ Network error'); }
    setSeeding(false);
  };

  // Group zones by floor
  const zonesByFloor: Record<number, Zone[]> = {};
  for (const z of zones) {
    const f = parseInt(z.floorNumber ?? '0');
    if (!zonesByFloor[f]) zonesByFloor[f] = [];
    zonesByFloor[f].push(z);
  }

  // Stats
  const allTags  = zones.flatMap(z => z.tags ?? []);
  const active   = allTags.filter(t => t.status === 'ACTIVE').length;
  const lowBat   = allTags.filter(t => t.status === 'LOW_BATTERY').length;
  const missing  = allTags.filter(t => t.status === 'MISSING').length;
  const total    = allTags.length;

  const floorZones = selectedFloor ? (zonesByFloor[selectedFloor] ?? []) : [];
  const floorAssets = floorZones.flatMap(z => z.tags ?? []);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <style>{`
          @keyframes pulseRing { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:.1;transform:scale(1.6)} }
          @keyframes scanBeam  { 0%{opacity:0;transform:translateX(-100%)} 50%{opacity:.3} 100%{opacity:0;transform:translateX(100%)} }
          @keyframes fadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
          .fade-up { animation: fadeUp .4s ease both; }
          .scan-beam { animation: scanBeam 3s ease-in-out infinite; }
        `}</style>

        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#050c1a 0%,#0a1228 50%,#050c14 100%)', padding: '0 0 40px' }}>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => router.push('/rfid')}
                style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowLeft style={{ width: 16, height: 16 }}/>
              </button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <Building2 style={{ width: 18, height: 18, color: '#818cf8' }}/>
                  <h1 style={{ color: 'white', fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px' }}>3D Live Asset Map</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 999, padding: '2px 9px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }}/>
                    <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 700 }}>LIVE</span>
                  </div>
                </div>
                <p style={{ color: '#475569', fontSize: 12 }}>
                  Meridian Technologies Group — HQ Building · {lastRefresh ? `Updated ${timeAgo(lastRefresh.toISOString())}` : 'Loading…'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Seed button */}
              <button onClick={seedDemo} disabled={seeding}
                style={{ height: 36, padding: '0 16px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: 'white', fontSize: 12, fontWeight: 700, cursor: seeding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: seeding ? 0.7 : 1 }}>
                {seeding ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }}/> : <Zap style={{ width: 14, height: 14 }}/>}
                {seeding ? 'Seeding…' : 'Load Demo Data'}
              </button>
              <button onClick={refresh} disabled={refreshing}
                style={{ height: 36, padding: '0 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                <RefreshCw style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
                Refresh
              </button>
            </div>
          </div>

          {/* Seed message */}
          {seedMsg && (
            <div style={{ margin: '10px 28px 0', padding: '10px 16px', borderRadius: 10, background: seedMsg.startsWith('✅') ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${seedMsg.startsWith('✅') ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`, color: seedMsg.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: 13, fontWeight: 600 }}>
              {seedMsg}
            </div>
          )}

          {/* ── KPI strip ──────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '16px 28px 0' }}>
            {[
              { label: 'Total Tagged Assets', value: total,   icon: Package,       color: '#818cf8' },
              { label: 'Active',              value: active,  icon: CheckCircle2,  color: '#4ade80' },
              { label: 'Low Battery',         value: lowBat,  icon: BatteryLow,    color: '#f59e0b' },
              { label: 'Missing',             value: missing, icon: AlertTriangle, color: '#ef4444' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="fade-up" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 18, height: 18, color }}/>
                </div>
                <div>
                  <p style={{ color: 'white', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{loading ? '—' : value}</p>
                  <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginTop: 2 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main Content ────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, padding: '16px 28px 0', alignItems: 'start' }}>

            {/* SVG Building */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '20px 12px', position: 'relative', overflow: 'hidden' }}>
              {/* Scan beam decoration */}
              <div className="scan-beam" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#818cf8,transparent)', pointerEvents: 'none' }}/>

              {/* Floor selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
                <button onClick={() => setSelectedFloor(null)}
                  style={{ padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: selectedFloor === null ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.05)', color: selectedFloor === null ? '#a5b4fc' : '#4b5563', transition: 'all .15s' }}>
                  All Floors
                </button>
                {[1, 2, 3].map(f => (
                  <button key={f} onClick={e => { e.stopPropagation(); setSelectedFloor(f === selectedFloor ? null : f); }}
                    style={{ padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: selectedFloor === f ? FLOOR_DEFS[f-1].wallFill : 'rgba(255,255,255,0.05)', color: selectedFloor === f ? '#e2e8f0' : '#4b5563', transition: 'all .15s', borderWidth: 1, borderStyle: 'solid', borderColor: selectedFloor === f ? '#818cf8' : 'transparent' }}>
                    Floor {f}
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, gap: 10, color: '#475569' }}>
                  <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }}/>
                  <span style={{ fontSize: 14 }}>Loading floor map…</span>
                </div>
              ) : total === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 14 }}>
                  <Building2 style={{ width: 56, height: 56, color: '#1e3a5f' }}/>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No RFID Assets Found</p>
                    <p style={{ color: '#475569', fontSize: 13, marginBottom: 16 }}>Click "Load Demo Data" to populate the floor map with Meridian Technologies Group's asset tracking data.</p>
                  </div>
                </div>
              ) : (
                <IsometricBuilding
                  zonesByFloor={zonesByFloor}
                  selectedFloor={selectedFloor}
                  onFloorClick={f => setSelectedFloor(prev => prev === f ? null : f)}
                  selectedAsset={selectedAsset}
                  onAssetClick={setSelectedAsset}
                />
              )}

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                {[
                  { color: '#22c55e', label: 'Active' },
                  { color: '#f59e0b', label: 'Low Battery' },
                  { color: '#ef4444', label: 'Missing' },
                  { color: '#6b7280', label: 'Inactive' },
                  { color: '#fca5a5', stroke: true, label: 'Restricted Zone' },
                ].map(({ color, label, stroke }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {stroke
                      ? <div style={{ width: 14, height: 14, borderRadius: 4, background: '#3b0d0d', border: `2px solid ${color}` }}/>
                      : <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }}/>
                    }
                    <span style={{ color: '#475569', fontSize: 11, fontWeight: 600 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right sidebar ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Selected asset card */}
              {selectedAsset ? (
                <div className="fade-up" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(129,140,248,0.4)', borderRadius: 18, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>SELECTED ASSET</span>
                    <button onClick={() => setSelectedAsset(null)} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${STATUS_COLOR[selectedAsset.status]}20`, border: `1px solid ${STATUS_COLOR[selectedAsset.status]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package style={{ width: 18, height: 18, color: STATUS_COLOR[selectedAsset.status] }}/>
                    </div>
                    <div>
                      <p style={{ color: 'white', fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{selectedAsset.asset?.name ?? 'Unknown Asset'}</p>
                      <p style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{selectedAsset.asset?.type} · {selectedAsset.tagId}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Status',      value: selectedAsset.status, color: STATUS_COLOR[selectedAsset.status] },
                      { label: 'Zone',        value: selectedAsset.lastZone?.name ?? 'Unknown', color: '#94a3b8' },
                      { label: 'Battery',     value: selectedAsset.batteryLevel != null ? `${selectedAsset.batteryLevel}%` : 'N/A', color: (selectedAsset.batteryLevel ?? 100) <= 20 ? '#ef4444' : '#4ade80' },
                      { label: 'Signal',      value: selectedAsset.lastRssi != null ? `${selectedAsset.lastRssi} dBm` : 'N/A', color: '#94a3b8' },
                      { label: 'Last Seen',   value: timeAgo(selectedAsset.lastSeenAt), color: '#94a3b8' },
                      { label: 'Tag Type',    value: 'BLE', color: '#94a3b8' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{label}</p>
                        <p style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '18px 20px' }}>
                  <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>
                    Click an asset dot on the map to view details
                  </p>
                </div>
              )}

              {/* Floor detail panel */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Layers style={{ width: 14, height: 14, color: '#818cf8' }}/>
                  <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>
                    {selectedFloor ? `FLOOR ${selectedFloor} — ${FLOOR_DEFS[selectedFloor - 1]?.sublabel?.toUpperCase()}` : 'ALL FLOORS'}
                  </span>
                </div>

                {/* Floor tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {[null, 1, 2, 3].map(f => (
                    <button key={String(f)} onClick={() => setSelectedFloor(f)}
                      style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: selectedFloor === f ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.04)',
                        color: selectedFloor === f ? '#a5b4fc' : '#4b5563' }}>
                      {f === null ? 'All' : `F${f}`}
                    </button>
                  ))}
                </div>

                {/* Asset list */}
                <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(selectedFloor ? floorAssets : allTags).length === 0 ? (
                    <p style={{ color: '#1e3a5f', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>No assets on this floor</p>
                  ) : (selectedFloor ? floorAssets : allTags).slice(0, 30).map(tag => {
                    const color = STATUS_COLOR[tag.status] ?? '#6b7280';
                    const isLowBat = tag.status === 'LOW_BATTERY';
                    const isMissing = tag.status === 'MISSING';
                    return (
                      <button key={tag.id} onClick={() => setSelectedAsset(tag)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: selectedAsset?.id === tag.id ? `${color}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedAsset?.id === tag.id ? `${color}40` : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all .15s' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tag.asset?.name ?? tag.tagId}</p>
                          <p style={{ color: '#475569', fontSize: 10, marginTop: 1 }}>{tag.lastZone?.name ?? 'No zone'}</p>
                        </div>
                        {(isLowBat || isMissing) && (
                          <div style={{ background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>
                            <span style={{ color, fontSize: 9, fontWeight: 800 }}>{isMissing ? 'MISSING' : `${tag.batteryLevel}%`}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zone list */}
              {(selectedFloor ? floorZones : zones.filter(z => z.floorNumber)).length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '18px 20px' }}>
                  <p style={{ color: '#475569', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 12 }}>ZONES / ACCESS POINTS</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(selectedFloor ? floorZones : zones).slice(0, 8).map(zone => {
                      const cPal = zoneColor(zone.name, zone.isRestricted);
                      const tagCount = zone.tags?.length ?? 0;
                      return (
                        <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: cPal.fill, border: `1.5px solid ${cPal.stroke}`, flexShrink: 0 }}/>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>{zone.name}</p>
                            <p style={{ color: '#334155', fontSize: 10 }}>Floor {zone.floorNumber} · {zone.apMacAddress ?? 'No AP'}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {zone.isRestricted && <Shield style={{ width: 10, height: 10, color: '#ef4444' }}/>}
                            <span style={{ color: '#475569', fontSize: 11, fontWeight: 700 }}>{tagCount} assets</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
