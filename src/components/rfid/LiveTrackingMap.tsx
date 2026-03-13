'use client';
// @ts-nocheck
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FloorPlan { id: string; name: string; building?: string | null; floorNumber?: number | null; imageUrl: string; }
interface Zone { id: string; name: string; mapX?: number | null; mapY?: number | null; mapWidth?: number | null; mapHeight?: number | null; isRestricted: boolean; floorPlanId?: string | null; apMacAddress?: string | null; _count?: { tags: number; scans: number }; }
interface AssetLoc {
  tagId: string; tagMac: string; tagType: string; status: string;
  batteryLevel?: number | null; lastRssi?: number | null; lastSeenAt?: string | null;
  manufacturer?: string | null; model?: string | null;
  asset?: { id: string; name: string; type: string } | null;
  zone?: { id: string; name: string; mapX?: number | null; mapY?: number | null; mapWidth?: number | null; mapHeight?: number | null; floorPlanId?: string | null; isRestricted?: boolean } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const REFRESH_MS = 12_000;

const STATUS: Record<string, { color: string; ring: string; label: string; pulse: string }> = {
  ACTIVE:      { color: '#10b981', ring: 'rgba(16,185,129,0.3)',  label: 'Active',      pulse: 'pulse-active'   },
  LOW_BATTERY: { color: '#f59e0b', ring: 'rgba(245,158,11,0.3)', label: 'Low Battery', pulse: 'pulse-lowbat'   },
  MISSING:     { color: '#ef4444', ring: 'rgba(239,68,68,0.4)',  label: 'Missing',     pulse: 'pulse-missing'  },
  INACTIVE:    { color: '#64748b', ring: 'rgba(100,116,139,0.2)',label: 'Inactive',    pulse: ''               },
  UNASSIGNED:  { color: '#a78bfa', ring: 'rgba(167,139,250,0.2)',label: 'Unassigned',  pulse: ''               },
};

function timeAgo(ts?: string | null) {
  if (!ts) return 'Never';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ASSET_CSS = `
  @keyframes pulse-active  { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1}50%{transform:translate(-50%,-50%) scale(1.18);opacity:.85} }
  @keyframes pulse-missing  { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,.7)}60%{transform:translate(-50%,-50%) scale(1.1);opacity:.9;box-shadow:0 0 0 10px rgba(239,68,68,0)} }
  @keyframes pulse-lowbat   { 0%,100%{transform:translate(-50%,-50%) scale(1)}70%{transform:translate(-50%,-50%) scale(1.08)} }
  @keyframes dash-move      { to { stroke-dashoffset: -20 } }
  .pulse-active  { animation: pulse-active  2.4s ease-in-out infinite }
  .pulse-missing { animation: pulse-missing 1.1s ease-in-out infinite }
  .pulse-lowbat  { animation: pulse-lowbat  2.8s ease-in-out infinite }
  .dash-restricted { animation: dash-move 1.5s linear infinite }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveTrackingMap() {
  const [floorPlans,    setFloorPlans]    = useState<FloorPlan[]>([]);
  const [zones,         setZones]         = useState<Zone[]>([]);
  const [locations,     setLocations]     = useState<AssetLoc[]>([]);
  const [selectedPlan,  setSelectedPlan]  = useState<FloorPlan | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [lastRefresh,   setLastRefresh]   = useState(new Date());
  const [tooltip,       setTooltip]       = useState<{ tag: AssetLoc; x: number; y: number } | null>(null);
  const [hoveredZone,   setHoveredZone]   = useState<string | null>(null);
  const [imgLoaded,     setImgLoaded]     = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);

  const fetchData = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/rfid/map-data${force ? '?refresh=true' : ''}`);
      if (!res.ok) return;
      const d = await res.json();
      setFloorPlans(d.floorPlans ?? []);
      setZones(d.zones ?? []);
      setLocations(d.locations ?? []);
      setLastRefresh(new Date());
      if ((d.floorPlans ?? []).length > 0) {
        setSelectedPlan(prev => prev ?? d.floorPlans[0]);
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(() => fetchData(), REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(true); };

  // ── Derived data ──────────────────────────────────────────────────────────────
  const planZones = useMemo(() =>
    zones.filter(z => z.floorPlanId === selectedPlan?.id && z.mapX != null),
    [zones, selectedPlan]
  );

  const zoneAssets = useMemo(() => {
    const map: Record<string, AssetLoc[]> = {};
    locations.forEach(l => {
      const zid = l.zone?.floorPlanId === selectedPlan?.id ? l.zone?.id : null;
      if (!zid) return;
      if (!map[zid]) map[zid] = [];
      map[zid].push(l);
    });
    return map;
  }, [locations, selectedPlan]);

  const floorStats = useMemo(() => {
    const fpId = selectedPlan?.id;
    const inPlan = locations.filter(l => l.zone?.floorPlanId === fpId);
    return {
      total:   inPlan.length,
      active:  inPlan.filter(l => l.status === 'ACTIVE').length,
      low:     inPlan.filter(l => l.status === 'LOW_BATTERY').length,
      missing: inPlan.filter(l => l.status === 'MISSING').length,
    };
  }, [locations, selectedPlan]);

  // ── Dot click ─────────────────────────────────────────────────────────────────
  const handleDotClick = (e: React.MouseEvent, tag: AssetLoc) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => prev?.tag.tagId === tag.tagId ? null : {
      tag, x: e.clientX - rect.left, y: e.clientY - rect.top,
    });
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 animate-pulse">
      <div className="h-14 bg-slate-800/80" />
      <div className="h-[500px] bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-600">
          <svg className="w-12 h-12 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
            <path d="M12 2a10 10 0 0110 10" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-semibold">Loading floor maps…</p>
        </div>
      </div>
    </div>
  );

  // ── No floor plans ────────────────────────────────────────────────────────────
  if (!selectedPlan) return (
    <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="font-bold text-slate-300 text-lg">No floor plans yet</p>
        <p className="text-slate-500 text-sm mt-1">Click <strong>Load Demo Data</strong> above to populate the map, or switch to Edit Zones to upload a floor plan</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-0 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950" onClick={() => setTooltip(null)}>
      <style>{ASSET_CSS}</style>

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-col gap-2">
        {/* Top row: floor tabs + action */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-0.5 bg-slate-800/60 rounded-xl">
            {floorPlans.map(fp => {
              const fpAssets = locations.filter(l => l.zone?.floorPlanId === fp.id);
              const hasMissing = fpAssets.some(l => l.status === 'MISSING');
              const isActive = fp.id === selectedPlan?.id;
              return (
                <button key={fp.id}
                  onClick={e => { e.stopPropagation(); setSelectedPlan(fp); setImgLoaded(false); setTooltip(null); }}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  <span className={`text-[10px] font-black tracking-wider ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                    FL{fp.floorNumber}
                  </span>
                  <span className="hidden sm:block truncate max-w-[120px]">
                    {fp.name.split('—')[1]?.trim() ?? fp.name}
                  </span>
                  {fpAssets.length > 0 && (
                    <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black ${
                      isActive ? 'bg-indigo-400/30 text-indigo-100' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {fpAssets.length}
                    </span>
                  )}
                  {hasMissing && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Stats + refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {floorStats.active > 0  && <StatChip n={floorStats.active}  color="#10b981" label="Active"      />}
            {floorStats.low > 0     && <StatChip n={floorStats.low}     color="#f59e0b" label="Low Bat"     />}
            {floorStats.missing > 0 && <StatChip n={floorStats.missing} color="#ef4444" label="Missing"     />}
            <button
              onClick={e => { e.stopPropagation(); handleRefresh(); }}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all border border-slate-700"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Floor info sub-row */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="font-semibold text-slate-400">{selectedPlan.name}</span>
          {selectedPlan.building && <><span>·</span><span>{selectedPlan.building}</span></>}
          <span className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
            Live · refreshes every {REFRESH_MS / 1000}s · last {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ── Map area ───────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden bg-slate-900"
        style={{ minHeight: 400 }}
      >
        {/* Floor plan image */}
        <img
          ref={imgRef}
          key={selectedPlan.id}
          src={selectedPlan.imageUrl}
          alt={selectedPlan.name}
          className={`w-full h-auto block transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          draggable={false}
          onLoad={() => setImgLoaded(true)}
        />

        {/* Image loading overlay */}
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-3 text-slate-600">
              <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                <path d="M12 2a10 10 0 0110 10" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-xs font-semibold">Loading floor plan…</p>
            </div>
          </div>
        )}

        {/* SVG overlay — zones */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="zone-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="0.4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="label-shadow" x="-5%" y="-5%" width="110%" height="140%">
              <feDropShadow dx="0" dy="0.3" stdDeviation="0.4" floodColor="#000" floodOpacity="0.8"/>
            </filter>
          </defs>

          {planZones.map(zone => {
            const x = zone.mapX!; const y = zone.mapY!;
            const w = zone.mapWidth!; const h = zone.mapHeight!;
            const cx = x + w / 2;
            const cy = y + h / 2;
            const isHovered  = hoveredZone === zone.id;
            const assetCount = (zoneAssets[zone.id] ?? []).length;
            const hasMissing = (zoneAssets[zone.id] ?? []).some(a => a.status === 'MISSING');
            const hasLowBat  = (zoneAssets[zone.id] ?? []).some(a => a.status === 'LOW_BATTERY');

            // Vivid fills that pop on the dark background
            const fillNormal     = isHovered ? 'rgba(99,102,241,0.28)' : 'rgba(99,102,241,0.14)';
            const fillRestricted = hasMissing
              ? (isHovered ? 'rgba(239,68,68,0.38)' : 'rgba(239,68,68,0.22)')
              : (isHovered ? 'rgba(239,68,68,0.28)' : 'rgba(239,68,68,0.16)');
            const zFill   = zone.isRestricted ? fillRestricted : fillNormal;
            const zStroke = zone.isRestricted
              ? (hasMissing ? '#ef4444' : 'rgba(239,68,68,0.7)')
              : (isHovered  ? 'rgba(129,140,248,0.9)' : 'rgba(99,102,241,0.5)');
            const zSW     = isHovered ? '0.6' : '0.4';

            // Label pill dimensions
            const labelText  = zone.name.length > 20 ? zone.name.slice(0,19) + '…' : zone.name;
            const pillW      = Math.min(labelText.length * 1.18 + 2, 32);
            const pillX      = cx - pillW / 2;
            const pillY      = y + 1.2;

            return (
              <g key={zone.id} className="pointer-events-auto" style={{ cursor: 'default' }}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
              >
                {/* Zone fill */}
                <rect x={x} y={y} width={w} height={h} rx="0.6"
                  fill={zFill} style={{ transition: 'fill 0.18s' }}
                />

                {/* Zone border */}
                {zone.isRestricted ? (
                  <rect x={x} y={y} width={w} height={h} rx="0.6" fill="none"
                    stroke={zStroke} strokeWidth={zSW}
                    strokeDasharray="3 2" className="dash-restricted"
                  />
                ) : (
                  <rect x={x} y={y} width={w} height={h} rx="0.6" fill="none"
                    stroke={zStroke} strokeWidth={zSW}
                    style={{ transition: 'stroke 0.18s, stroke-width 0.18s' }}
                  />
                )}

                {/* Accent top bar */}
                <rect x={x} y={y} width={w} height="0.5"
                  fill={zone.isRestricted ? '#ef4444' : '#818cf8'} opacity="0.7"/>

                {/* Zone name label pill */}
                <rect x={pillX} y={pillY} width={pillW} height="3.6" rx="0.7"
                  fill={zone.isRestricted ? 'rgba(80,7,7,0.92)' : 'rgba(15,12,60,0.92)'}
                />
                <text x={cx} y={pillY + 2.65} textAnchor="middle"
                  fontSize="2.2" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="800"
                  fill={zone.isRestricted ? '#fca5a5' : '#c7d2fe'}>
                  {labelText}
                </text>

                {/* Restricted warning badge */}
                {zone.isRestricted && (
                  <g>
                    <rect x={cx - 8.5} y={y + 5.5} width="17" height="3.2" rx="0.6"
                      fill="rgba(80,7,7,0.85)"/>
                    <text x={cx} y={y + 8} textAnchor="middle"
                      fontSize="1.9" fontWeight="800" fill="#f87171" fontFamily="system-ui,sans-serif">
                      ⚠ RESTRICTED
                    </text>
                  </g>
                )}

                {/* Alert pulsing overlay for MISSING assets */}
                {hasMissing && (
                  <rect x={x+0.3} y={y+0.3} width={w-0.6} height={h-0.6} rx="0.5"
                    fill="none" stroke="#ef4444" strokeWidth="0.8"
                    className="dash-restricted" opacity="0.9"
                  />
                )}

                {/* Asset count badge — bottom right */}
                {assetCount > 0 && (
                  <g>
                    <rect x={x+w-7} y={y+h-4.8} width="6.5" height="4" rx="0.7"
                      fill={hasMissing ? 'rgba(80,7,7,0.92)' : hasLowBat ? 'rgba(60,32,3,0.92)' : 'rgba(15,12,60,0.92)'}/>
                    <text x={x+w-3.75} y={y+h-1.8} textAnchor="middle"
                      fontSize="2.2" fontWeight="900"
                      fill={hasMissing ? '#fca5a5' : hasLowBat ? '#fcd34d' : '#c7d2fe'}
                      fontFamily="system-ui,sans-serif">
                      {assetCount}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML asset dots */}
        {planZones.map(zone => {
          const assets  = zoneAssets[zone.id] ?? [];
          const cx      = (zone.mapX ?? 0) + (zone.mapWidth ?? 0) / 2;
          const cy      = (zone.mapY ?? 0) + (zone.mapHeight ?? 0) / 2;
          const spread  = 3.2;

          return assets.map((tag, i) => {
            const offset = assets.length > 1 ? (i - (assets.length - 1) / 2) * spread : 0;
            const s      = STATUS[tag.status] ?? STATUS.INACTIVE;
            return (
              <button
                key={tag.tagId}
                className={`absolute focus:outline-none z-10 ${s.pulse}`}
                style={{
                  left:   `${cx + offset}%`,
                  top:    `${cy}%`,
                  transform: 'translate(-50%, -50%)',
                  width:  24, height: 24,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 35%, ${s.color}ee, ${s.color})`,
                  border: '2px solid rgba(255,255,255,0.85)',
                  boxShadow: `0 0 0 4px ${s.ring}, 0 0 12px ${s.color}66, 0 2px 8px rgba(0,0,0,0.6)`,
                }}
                onClick={e => handleDotClick(e, tag)}
                title={tag.asset?.name ?? tag.tagMac}
              />
            );
          });
        })}

        {/* Tooltip */}
        {tooltip && (() => {
          const { tag, x, y } = tooltip;
          const s = STATUS[tag.status] ?? STATUS.INACTIVE;
          const bw = containerRef.current?.clientWidth ?? 600;
          const bh = containerRef.current?.clientHeight ?? 400;
          const tw = 230; const th = 210;
          const tx = Math.min(Math.max(x + 14, 8), bw - tw - 8);
          const ty = Math.min(Math.max(y - th / 2, 8), bh - th - 8);

          return (
            <div
              className="absolute z-30 rounded-2xl overflow-hidden shadow-2xl"
              style={{ left: tx, top: ty, width: tw, background: 'rgba(2,6,23,0.96)', border: `1px solid ${s.color}40`, backdropFilter: 'blur(16px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Status stripe */}
              <div className="h-1 w-full" style={{ background: s.color }}/>

              <div className="p-3.5 space-y-2.5">
                {/* Asset name + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm leading-tight truncate">
                      {tag.asset?.name ?? tag.tagMac}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{tag.tagMac}</p>
                  </div>
                  <span className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: s.color + '25', color: s.color, border: `1px solid ${s.color}40` }}>
                    {s.label}
                  </span>
                </div>

                {/* Zone */}
                <div className="flex items-center gap-2 text-xs">
                  <svg className="w-3 h-3 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  </svg>
                  <span className="text-slate-300 font-medium truncate">{tag.zone?.name ?? '—'}</span>
                  {tag.zone?.isRestricted && <span className="text-[9px] text-red-400 font-bold ml-auto flex-shrink-0">RESTRICTED</span>}
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Battery */}
                  {tag.batteryLevel != null && (
                    <div className="bg-slate-800/70 rounded-xl p-2">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Battery</p>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mb-1">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${tag.batteryLevel}%`, background: tag.batteryLevel <= 20 ? '#ef4444' : tag.batteryLevel <= 40 ? '#f59e0b' : '#10b981' }}/>
                      </div>
                      <p className="text-xs font-bold" style={{ color: tag.batteryLevel <= 20 ? '#ef4444' : tag.batteryLevel <= 40 ? '#f59e0b' : '#10b981' }}>
                        {tag.batteryLevel}%
                      </p>
                    </div>
                  )}

                  {/* Signal */}
                  {tag.lastRssi != null && (
                    <div className="bg-slate-800/70 rounded-xl p-2">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Signal</p>
                      <p className="text-xs font-bold text-slate-200">{tag.lastRssi} dBm</p>
                      <p className="text-[9px] text-slate-500">
                        {tag.lastRssi >= -60 ? 'Excellent' : tag.lastRssi >= -75 ? 'Good' : tag.lastRssi >= -90 ? 'Fair' : 'Weak'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Tag info */}
                {(tag.manufacturer || tag.model) && (
                  <div className="text-[10px] text-slate-500">
                    {tag.manufacturer} {tag.model}
                  </div>
                )}

                {/* Last seen */}
                <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] text-slate-500">
                  <span>Last seen</span>
                  <span className="font-semibold text-slate-400">{timeAgo(tag.lastSeenAt)}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Footer legend ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {Object.entries(STATUS).slice(0, 4).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }}/>
            <span className="text-[11px] text-slate-500 font-medium">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2.5 rounded border border-red-500/60 bg-red-500/10"/>
          <span className="text-[11px] text-slate-500 font-medium">Restricted Zone</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-600">
          <span>Click any asset dot to inspect</span>
          <span className="text-slate-700">·</span>
          <span>{floorStats.total} assets tracked</span>
        </div>
      </div>
    </div>
  );
}

// ── StatChip helper ────────────────────────────────────────────────────────────
function StatChip({ n, color, label }: { n: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold"
      style={{ background: color + '18', color, border: `1px solid ${color}35` }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }}/>
      {n} {label}
    </div>
  );
}
