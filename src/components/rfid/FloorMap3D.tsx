'use client';
// @ts-nocheck
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ── Isometric projection ──────────────────────────────────────────────────────
// Canvas: 960×580 SVG
const O  = { x: 420, y: 492 };  // front-left anchor of Floor 1 top face
const AB = { x: 310, y: -165 }; // right direction on floor
const AD = { x: -200, y: -112 };// depth direction on floor
const FH = 70;   // floor height (SVG px per level)
const SH = 14;   // slab thickness

function iso(px: number, py: number, lv: number): [number, number] {
  return [
    O.x + px * AB.x + py * AD.x,
    O.y - lv * FH + px * AB.y + py * AD.y,
  ];
}
function pts(...c: [number, number][]) {
  return c.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
function zonePoly(x: number, y: number, w: number, h: number, lv: number) {
  const [x1,y1] = [x/100, y/100];
  const [x2,y2] = [(x+w)/100, y/100];
  const [x3,y3] = [(x+w)/100, (y+h)/100];
  const [x4,y4] = [x/100, (y+h)/100];
  return pts(iso(x1,y1,lv), iso(x2,y2,lv), iso(x3,y3,lv), iso(x4,y4,lv));
}
function centroid(x: number, y: number, w: number, h: number, lv: number): [number,number] {
  return iso((x+w/2)/100, (y+h/2)/100, lv);
}

// ── Static zone layout (matches seed-demo.ts) ─────────────────────────────────
const STATIC: Record<number, Array<{name:string;x:number;y:number;w:number;h:number;restricted:boolean}>> = {
  1:[
    {name:'Pharmacy Store',      x:1, y:8, w:15,h:40,restricted:true },
    {name:'Emergency Reception', x:17,y:8, w:43,h:40,restricted:false},
    {name:'Trauma Bay A',        x:62,y:8, w:36,h:40,restricted:true },
    {name:'Radiology Suite',     x:1, y:52,w:59,h:43,restricted:false},
    {name:'Trauma Bay B',        x:62,y:52,w:36,h:43,restricted:true },
  ],
  2:[
    {name:'ICU Unit A',       x:1, y:8, w:31,h:40,restricted:false},
    {name:'ICU Unit B',       x:34,y:8, w:31,h:40,restricted:false},
    {name:'Recovery Suite',   x:67,y:8, w:31,h:40,restricted:false},
    {name:'Operating Room 1', x:1, y:52,w:47,h:43,restricted:true },
    {name:'Operating Room 2', x:50,y:52,w:48,h:43,restricted:true },
  ],
  3:[
    {name:'Ward A',              x:1, y:8, w:31,h:40,restricted:false},
    {name:'Ward B — Private',    x:34,y:8, w:31,h:40,restricted:false},
    {name:'Nursing Station',     x:67,y:8, w:31,h:40,restricted:false},
    {name:'Medical Supplies',    x:1, y:52,w:50,h:43,restricted:true },
    {name:'Administration',      x:53,y:52,w:45,h:43,restricted:false},
  ],
};

const ACCENT = {1:'#6366f1',2:'#a855f7',3:'#10b981'};
const FL_LABEL = {1:'Emergency & Diagnostic',2:'ICU & Critical Care',3:'Patient Wards & Admin'};
const SCOLOR: Record<string,string> = {
  ACTIVE:'#10b981', LOW_BATTERY:'#f59e0b', MISSING:'#ef4444',
  INACTIVE:'#64748b', UNASSIGNED:'#a78bfa',
};

function timeAgo(ts?: string|null) {
  if (!ts) return 'Never';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AssetLoc {
  tagId:string; tagMac:string; status:string;
  batteryLevel?:number|null; lastRssi?:number|null; lastSeenAt?:string|null;
  manufacturer?:string|null; model?:string|null;
  asset?:{id:string;name:string;type:string}|null;
  zone?:{id:string;name:string;mapX?:number|null;mapY?:number|null;mapWidth?:number|null;mapHeight?:number|null;floorPlanId?:string|null;isRestricted?:boolean}|null;
}
interface FP {id:string;name:string;floorNumber?:number|null;}

// ── Pre-compute all static SVG polygon strings once ───────────────────────────
const PRECOMPUTED = (() => {
  const out: Record<number, { polys: Record<string,[string,[number,number]]>; wallL: string; wallF: string }> = {};
  for (const lv of [0,1,2]) {
    const floorNum = lv + 1;
    const zones = STATIC[floorNum] ?? [];
    const polys: Record<string,[string,[number,number]]> = {};
    zones.forEach(z => {
      polys[z.name] = [zonePoly(z.x,z.y,z.w,z.h,lv), centroid(z.x,z.y,z.w,z.h,lv)];
    });
    // left-face wall for this slab
    const a = iso(0,0,lv), b = iso(0,1,lv);
    const wallL = pts(a, b, [b[0],b[1]+SH], [a[0],a[1]+SH]);
    // front-face wall
    const c = iso(1,0,lv);
    const wallF = pts(a, c, [c[0],c[1]+SH], [a[0],a[1]+SH]);
    out[floorNum] = { polys, wallL, wallF };
  }
  return out;
})();

// Building-wide corners (pre-computed)
const BC = {
  f1fl: iso(0,0,0), f1fr: iso(1,0,0), f1bl: iso(0,1,0),
  f3fl: iso(0,0,2), f3fr: iso(1,0,2), f3bl: iso(0,1,2),
};
const FULL_LEFT  = pts(BC.f3fl, BC.f3bl, [BC.f1bl[0],BC.f1bl[1]+SH], [BC.f1fl[0],BC.f1fl[1]+SH]);
const FULL_FRONT = pts(BC.f3fl, BC.f3fr, [BC.f1fr[0],BC.f1fr[1]+SH], [BC.f1fl[0],BC.f1fl[1]+SH]);
const DIV1 = `${iso(0,0,1)[0].toFixed(1)},${iso(0,0,1)[1].toFixed(1)} ${iso(1,0,1)[0].toFixed(1)},${iso(1,0,1)[1].toFixed(1)}`;
const DIV2 = `${iso(0,1,0)[0].toFixed(1)},${iso(0,1,0)[1].toFixed(1)} ${iso(0,0,0)[0].toFixed(1)},${iso(0,0,0)[1].toFixed(1)}`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function FloorMap3D() {
  const [fps,       setFps]       = useState<FP[]>([]);
  const [locations, setLocations] = useState<AssetLoc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<number|null>(null); // 1,2,3 or null=all
  const [tooltip,   setTooltip]   = useState<{a:AssetLoc;sx:number;sy:number}|null>(null);
  const [lastRef,   setLastRef]   = useState(new Date());
  const [tick,      setTick]      = useState(0); // force re-renders for animation

  const fetchData = useCallback(async (force=false) => {
    try {
      const r = await fetch(`/api/rfid/map-data${force?'?refresh=true':''}`);
      if (!r.ok) return;
      const d = await r.json();
      setFps(d.floorPlans ?? []);
      setLocations(d.locations ?? []);
      setLastRef(new Date());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const data = setInterval(() => fetchData(), 12000);
    const anim = setInterval(() => setTick(t => t+1), 2000); // animate pulsing
    return () => { clearInterval(data); clearInterval(anim); };
  }, [fetchData]);

  // floor plan ID → floor number
  const fpByNum = useMemo(() => {
    const m: Record<number,string> = {};
    fps.forEach(fp => { if (fp.floorNumber) m[fp.floorNumber] = fp.id; });
    return m;
  }, [fps]);

  // locations by floor
  const byFloor = useMemo(() => {
    const m: Record<number, AssetLoc[]> = {1:[],2:[],3:[]};
    [1,2,3].forEach(f => {
      const fpId = fpByNum[f];
      if (fpId) m[f] = locations.filter(l => l.zone?.floorPlanId === fpId);
    });
    return m;
  }, [locations, fpByNum]);

  // zone asset map per floor
  const zoneMap = useMemo(() => {
    const m: Record<number, Record<string, AssetLoc[]>> = {1:{},2:{},3:{}};
    [1,2,3].forEach(f => {
      byFloor[f].forEach(a => {
        const zn = a.zone?.name ?? '';
        if (!m[f][zn]) m[f][zn] = [];
        m[f][zn].push(a);
      });
    });
    return m;
  }, [byFloor]);

  const stats = useMemo(() => ({
    total:   locations.length,
    active:  locations.filter(l => l.status==='ACTIVE').length,
    low:     locations.filter(l => l.status==='LOW_BATTERY').length,
    missing: locations.filter(l => l.status==='MISSING').length,
  }), [locations]);

  function handleAsset(e: React.MouseEvent, a: AssetLoc, sx: number, sy: number) {
    e.stopPropagation();
    setTooltip(prev => prev?.a.tagId===a.tagId ? null : {a,sx,sy});
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="rounded-2xl bg-slate-950 border border-slate-800 h-[580px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-slate-600">
        <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.15"/>
          <path d="M12 2a10 10 0 0110 10" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <p className="text-sm font-semibold text-slate-500">Loading 3D building map…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3" onClick={() => setTooltip(null)}>
      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-0.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
          <button
            onClick={()=>setSelected(null)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${!selected?'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25':'text-slate-400 hover:text-slate-200'}`}
          >
            All Floors
          </button>
          {[1,2,3].map(f => (
            <button key={f}
              onClick={()=>setSelected(selected===f?null:f)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selected===f ? 'bg-background text-foreground shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-sm" style={{background: ACCENT[f]}}/>
              Floor {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {stats.active  > 0 && <Chip n={stats.active}  c="#10b981" label="Active"   />}
          {stats.low     > 0 && <Chip n={stats.low}     c="#f59e0b" label="Low Bat"  />}
          {stats.missing > 0 && <Chip n={stats.missing} c="#ef4444" label="Missing"  />}
          <button
            onClick={e=>{e.stopPropagation();setLoading(true);fetchData(true);}}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3">

        {/* ── 3D Building SVG ──────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          {/* Ambient grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{backgroundImage:'linear-gradient(rgba(99,102,241,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.8) 1px,transparent 1px)',backgroundSize:'40px 40px'}}/>

          <svg viewBox="0 0 960 580" className="w-full h-auto relative z-10" onClick={()=>setTooltip(null)}>
            <defs>
              <linearGradient id="wallL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a"/><stop offset="100%" stopColor="#020617"/>
              </linearGradient>
              <linearGradient id="wallF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b"/><stop offset="100%" stopColor="#0f172a"/>
              </linearGradient>
              <linearGradient id="fl1g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#312e81" stopOpacity="0.6"/>
              </linearGradient>
              <linearGradient id="fl2g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2e1065" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.6"/>
              </linearGradient>
              <linearGradient id="fl3g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#022c22" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#064e3b" stopOpacity="0.6"/>
              </linearGradient>
              <radialGradient id="glow-active" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.5"/>
                <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="glow-missing" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="glow-lowbat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5"/>
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
              </radialGradient>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000000" floodOpacity="0.6"/>
              </filter>
              <filter id="glow-filter">
                <feGaussianBlur stdDeviation="3" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <style>{`
                @keyframes ap3 {0%,100%{opacity:1;r:2.5}50%{opacity:.5;r:3.5}}
                @keyframes ms3 {0%,100%{opacity:1;r:4}60%{opacity:.5;r:6.5}}
                @keyframes lb3 {0%,100%{opacity:1}60%{opacity:.6}}
                @keyframes ac3 {0%,100%{opacity:1;r:4}50%{opacity:.8;r:5}}
                .anim-active  {animation:ac3 2.5s ease-in-out infinite}
                .anim-missing {animation:ms3 1.0s ease-in-out infinite}
                .anim-lowbat  {animation:lb3 2.8s ease-in-out infinite}
                .anim-ap      {animation:ap3 3s ease-in-out infinite}
              `}</style>
            </defs>

            {/* Building title */}
            <text x="480" y="28" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="700" fill="#e2e8f0" letterSpacing="0.5">
              Apex Medical Center — AMC Main Building
            </text>
            <text x="480" y="43" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="9" fill="#475569">
              Huawei AirEngine 6776-58TI · BLE 5.0 · Real-time RFID Asset Intelligence
            </text>

            {/* Ground shadow ellipse */}
            <ellipse cx={O.x + AB.x/2 + AD.x/2} cy={O.y + SH + 6}
              rx={200} ry={35} fill="rgba(0,0,0,0.45)" filter="url(#shadow)"/>

            {/* Full building left + front walls */}
            <polygon points={FULL_LEFT}  fill="url(#wallL)" stroke="#1e293b" strokeWidth="0.8"/>
            <polygon points={FULL_FRONT} fill="url(#wallF)" stroke="#1e293b" strokeWidth="0.8"/>

            {/* Window rows on front wall */}
            {[0,1].flatMap(lv => {
              const midY = (iso(0,0,lv)[1] + iso(0,0,lv+1)[1]) / 2;
              return [0.14,0.32,0.52,0.70].map((wx,wi) => {
                const wl = iso(wx,0,lv), wr = iso(wx+0.09,0,lv);
                const mx = (wl[0]+wr[0])/2;
                return (
                  <g key={`w-${lv}-${wi}`}>
                    <rect x={mx-12} y={midY-7} width={25} height={12} rx="2"
                      fill="#1e3a5f" stroke="#1d4ed8" strokeWidth="0.5" opacity="0.7"/>
                    <rect x={mx-10} y={midY-5} width={10} height={8} rx="1"
                      fill="rgba(59,130,246,0.15)"/>
                    <rect x={mx+1} y={midY-5} width={10} height={8} rx="1"
                      fill="rgba(59,130,246,0.1)"/>
                  </g>
                );
              });
            })}

            {/* Floor division lines on walls */}
            <polyline points={DIV1} fill="none" stroke="#334155" strokeWidth="0.7" strokeDasharray="4,3"/>
            <polyline points={`${iso(0,0,1)[0].toFixed(1)},${iso(0,0,1)[1].toFixed(1)} ${iso(0,1,1)[0].toFixed(1)},${iso(0,1,1)[1].toFixed(1)}`}
              fill="none" stroke="#334155" strokeWidth="0.7" strokeDasharray="4,3"/>
            <polyline points={DIV2} fill="none" stroke="#334155" strokeWidth="0.7" strokeDasharray="4,3"/>
            <polyline points={`${iso(0,0,0)[0].toFixed(1)},${iso(0,0,0)[1].toFixed(1)} ${iso(0,1,0)[0].toFixed(1)},${iso(0,1,0)[1].toFixed(1)}`}
              fill="none" stroke="#334155" strokeWidth="0.7" strokeDasharray="4,3"/>

            {/* ── Floors (bottom to top) ──────────────────────────────────── */}
            {[1,2,3].map(fn => {
              const lv     = fn - 1;
              const accent = ACCENT[fn];
              const pc     = PRECOMPUTED[fn];
              const isHigh = selected === fn;
              const isDim  = selected !== null && !isHigh;
              const zones  = STATIC[fn] ?? [];
              const zm     = zoneMap[fn] ?? {};

              // Floor top face corners
              const flPts = pts(iso(0,0,lv), iso(1,0,lv), iso(1,1,lv), iso(0,1,lv));

              return (
                <g key={fn}
                  opacity={isDim ? 0.22 : 1}
                  style={{cursor:'pointer', transition:'opacity 0.35s'}}
                  onClick={e=>{e.stopPropagation();setSelected(isHigh?null:fn);}}
                >
                  {/* Slab accent bar (left face) */}
                  <polygon points={pc.wallL} fill={accent} opacity="0.18"/>
                  <polygon points={pc.wallL} fill="none" stroke={accent} strokeWidth="0.5" opacity="0.5"/>

                  {/* Slab accent bar (front face) */}
                  <polygon points={pc.wallF} fill={accent} opacity="0.08"/>

                  {/* Floor top face */}
                  <polygon points={flPts}
                    fill={`url(#fl${fn}g)`}
                    stroke={isHigh ? accent : '#334155'}
                    strokeWidth={isHigh ? 1 : 0.5}
                    opacity="0.95"
                  />

                  {/* Subtle grid on floor face */}
                  {[0.25,0.5,0.75].map(t => (
                    <line key={t}
                      x1={iso(t,0,lv)[0]} y1={iso(t,0,lv)[1]}
                      x2={iso(t,1,lv)[0]} y2={iso(t,1,lv)[1]}
                      stroke={accent} strokeWidth="0.3" opacity="0.15"
                    />
                  ))}
                  {[0.25,0.5,0.75].map(t => (
                    <line key={t}
                      x1={iso(0,t,lv)[0]} y1={iso(0,t,lv)[1]}
                      x2={iso(1,t,lv)[0]} y2={iso(1,t,lv)[1]}
                      stroke={accent} strokeWidth="0.3" opacity="0.15"
                    />
                  ))}

                  {/* Zone polygons */}
                  {zones.map(z => {
                    const [poly, [cx,cy]] = pc.polys[z.name] ?? ['',iso(0.5,0.5,lv)];
                    const assets   = zm[z.name] ?? [];
                    const hasMiss  = assets.some(a => a.status==='MISSING');
                    const zoneFill = z.restricted
                      ? hasMiss ? 'rgba(239,68,68,0.28)' : 'rgba(239,68,68,0.14)'
                      : `${accent}22`;
                    const zoneStroke = z.restricted
                      ? hasMiss ? '#ef4444' : 'rgba(239,68,68,0.6)'
                      : `${accent}70`;

                    return (
                      <g key={z.name}>
                        <polygon points={poly} fill={zoneFill} stroke={zoneStroke}
                          strokeWidth="0.6"
                          strokeDasharray={z.restricted ? '3,2' : 'none'}
                        />

                        {/* Zone label */}
                        {(isHigh || !selected) && (
                          <text x={cx} y={cy-2}
                            textAnchor="middle"
                            fontFamily="system-ui,sans-serif"
                            fontSize={isHigh ? 7.5 : 5.5}
                            fontWeight="700"
                            fill={z.restricted ? '#fca5a5' : accent}
                            opacity="0.95"
                            style={{pointerEvents:'none'}}
                          >
                            {z.name.length > 18 ? z.name.slice(0,16)+'…' : z.name}
                          </text>
                        )}

                        {/* Asset count bubble */}
                        {assets.length > 0 && (
                          <g style={{pointerEvents:'none'}}>
                            <circle cx={cx+14} cy={cy-10} r="5.5" fill={hasMiss?'#7f1d1d':accent}/>
                            <text x={cx+14} y={cy-7} textAnchor="middle"
                              fontFamily="system-ui,sans-serif" fontSize="5" fontWeight="800" fill="white">
                              {assets.length}
                            </text>
                          </g>
                        )}

                        {/* Asset dots — positioned within zone */}
                        {assets.map((a,i) => {
                          const off   = assets.length > 1 ? (i-(assets.length-1)/2) * 9 : 0;
                          const color = SCOLOR[a.status] ?? '#94a3b8';
                          const glowId = a.status==='ACTIVE' ? 'glow-active' : a.status==='MISSING' ? 'glow-missing' : 'glow-lowbat';
                          const cls   = a.status==='ACTIVE' ? 'anim-active' : a.status==='MISSING' ? 'anim-missing' : a.status==='LOW_BATTERY' ? 'anim-lowbat' : '';

                          return (
                            <g key={a.tagId}>
                              {/* Glow aura */}
                              <circle cx={cx+off} cy={cy+4} r="11" fill={`url(#${glowId})`} style={{pointerEvents:'none'}}/>
                              {/* Shadow dot on floor */}
                              <ellipse cx={cx+off} cy={cy+8} rx="4" ry="1.5" fill="rgba(0,0,0,0.4)" style={{pointerEvents:'none'}}/>
                              {/* Outer ring */}
                              <circle cx={cx+off} cy={cy+2} r="6" fill={color} opacity="0.25" className={cls} style={{pointerEvents:'none'}}/>
                              {/* Main sphere */}
                              <circle cx={cx+off} cy={cy+2} r="4" fill={color} stroke="white" strokeWidth="1"
                                className={cls}
                                style={{cursor:'pointer', filter:`drop-shadow(0 1px 4px ${color}88)`}}
                                onClick={e=>handleAsset(e, a, cx+off, cy+2)}
                              />
                              {/* Sphere highlight */}
                              <circle cx={cx+off-1.2} cy={cy+0.5} r="1.3" fill="white" opacity="0.5" style={{pointerEvents:'none'}}/>
                            </g>
                          );
                        })}

                        {/* Restricted badge */}
                        {z.restricted && (isHigh || !selected) && (
                          <text x={cx} y={cy+6}
                            textAnchor="middle"
                            fontFamily="system-ui,sans-serif"
                            fontSize="4.5"
                            fill="#fca5a5"
                            opacity="0.8"
                            fontWeight="700"
                            style={{pointerEvents:'none'}}
                          >
                            RESTRICTED
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Floor number label on slab face */}
                  <text
                    x={iso(0,0.5,lv)[0] - 14}
                    y={iso(0,0.5,lv)[1] + 7}
                    textAnchor="middle"
                    fontFamily="system-ui,sans-serif"
                    fontSize="7"
                    fontWeight="800"
                    fill={accent}
                    opacity="0.9"
                    style={{pointerEvents:'none'}}
                  >
                    FL{fn}
                  </text>
                </g>
              );
            })}

            {/* ── Tooltip ────────────────────────────────────────────────── */}
            {tooltip && (() => {
              const {a, sx, sy} = tooltip;
              const color = SCOLOR[a.status] ?? '#94a3b8';
              const tx = sx > 550 ? sx - 175 : sx + 15;
              const ty = Math.max(sy - 90, 50);
              const hasBat = a.batteryLevel != null;

              return (
                <g onClick={e=>e.stopPropagation()}>
                  {/* Connection line */}
                  <line x1={sx} y1={sy} x2={tx+5} y2={ty+5}
                    stroke={color} strokeWidth="0.8" strokeDasharray="3,2" opacity="0.5"/>

                  <rect x={tx} y={ty} width={160} height={hasBat ? 108 : 92} rx="10"
                    fill="#020617" stroke={color} strokeWidth="1.2" opacity="0.97"/>
                  {/* Status stripe */}
                  <rect x={tx} y={ty} width={160} height="3" rx="2" fill={color}/>

                  {/* Status dot + name */}
                  <circle cx={tx+14} cy={ty+18} r="5" fill={color}/>
                  <text x={tx+24} y={ty+22} fontFamily="system-ui,sans-serif" fontSize="9" fontWeight="700" fill="white">
                    {(a.asset?.name ?? a.tagMac).slice(0,22)}
                  </text>
                  {a.asset?.name && a.asset.name.length > 22 && (
                    <text x={tx+24} y={ty+31} fontFamily="system-ui,sans-serif" fontSize="7" fill="#64748b">
                      {a.asset.name.slice(22,40)}
                    </text>
                  )}

                  {/* Tag MAC */}
                  <text x={tx+10} y={ty+43} fontFamily="monospace,sans-serif" fontSize="7" fill="#475569">{a.tagMac}</text>

                  {/* Status badge */}
                  <rect x={tx+10} y={ty+50} width={40} height={12} rx="4" fill={`${color}25`}/>
                  <text x={tx+30} y={ty+59} textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="7" fontWeight="800" fill={color}>
                    {a.status.replace('_',' ')}
                  </text>

                  {/* Zone */}
                  <text x={tx+10} y={ty+74} fontFamily="system-ui,sans-serif" fontSize="8" fill="#94a3b8">
                    Zone: <tspan fill="#e2e8f0" fontWeight="600">{a.zone?.name?.slice(0,18) ?? '—'}</tspan>
                  </text>

                  {/* Battery bar */}
                  {hasBat && (
                    <g>
                      <text x={tx+10} y={ty+87} fontFamily="system-ui,sans-serif" fontSize="8" fill="#94a3b8">Battery: <tspan fill={a.batteryLevel<=20?'#ef4444':a.batteryLevel<=40?'#f59e0b':'#10b981'} fontWeight="700">{a.batteryLevel}%</tspan></text>
                      <rect x={tx+10} y={ty+90} width={140} height="4" rx="2" fill="#1e293b"/>
                      <rect x={tx+10} y={ty+90} width={140*(a.batteryLevel/100)} height="4" rx="2"
                        fill={a.batteryLevel<=20?'#ef4444':a.batteryLevel<=40?'#f59e0b':'#10b981'}/>
                    </g>
                  )}

                  {/* Last seen */}
                  <text x={tx+10} y={ty+(hasBat?103:87)} fontFamily="system-ui,sans-serif" fontSize="7.5" fill="#475569">
                    Last seen: <tspan fill="#94a3b8">{timeAgo(a.lastSeenAt)}</tspan>
                  </text>
                </g>
              );
            })()}

            {/* ── Status legend ──────────────────────────────────────────── */}
            {Object.entries(SCOLOR).slice(0,4).map(([k,c],i) => (
              <g key={k} transform={`translate(${10 + i*115}, 555)`}>
                <circle cx="5" cy="5" r="4.5" fill={c} opacity="0.9"/>
                <text x="14" y="9" fontFamily="system-ui,sans-serif" fontSize="9" fill="#64748b">
                  {k.replace('_',' ')}
                </text>
              </g>
            ))}
            <text x="950" y="560" textAnchor="end" fontFamily="system-ui,sans-serif" fontSize="7.5" fill="#334155">
              Auto-refresh 12s · {lastRef.toLocaleTimeString()}
            </text>
          </svg>

          {/* Floor accent overlay pill */}
          {selected && (
            <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{background: ACCENT[selected]+'25', color: ACCENT[selected], border: `1px solid ${ACCENT[selected]}40`}}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:ACCENT[selected]}}/>
              Floor {selected} — {FL_LABEL[selected]}
            </div>
          )}
        </div>

        {/* ── Right panel ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Building stats */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Building Overview</span>
              <span className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                {label:'Total Assets', v:stats.total,   c:'text-slate-200'},
                {label:'Active',       v:stats.active,  c:'text-emerald-400'},
                {label:'Low Battery',  v:stats.low,     c:'text-amber-400'},
                {label:'Missing',      v:stats.missing, c:'text-red-400'},
              ].map(s=>(
                <div key={s.label} className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                  <p className={`text-xl font-black ${s.c}`}>{s.v}</p>
                  <p className="text-[9px] text-slate-500 font-semibold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-floor panels */}
          {[1,2,3].map(fn => {
            const accent  = ACCENT[fn];
            const assets  = byFloor[fn] ?? [];
            const active  = assets.filter(a=>a.status==='ACTIVE').length;
            const miss    = assets.filter(a=>a.status==='MISSING').length;
            const low     = assets.filter(a=>a.status==='LOW_BATTERY').length;
            const isSel   = selected === fn;

            return (
              <button key={fn}
                onClick={()=>setSelected(isSel?null:fn)}
                className={`w-full rounded-2xl border p-3.5 text-left transition-all group ${
                  isSel
                    ? 'border-2 bg-slate-900 shadow-lg'
                    : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700'
                }`}
                style={{borderColor: isSel ? accent : undefined}}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{background: accent}}/>
                  <span className="text-xs font-bold text-slate-200">Floor {fn}</span>
                  <span className="ml-auto text-[10px] text-slate-500 font-semibold">{assets.length} assets</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{FL_LABEL[fn]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {active > 0 && <MiniChip n={active} c="#10b981" label="active"/>}
                  {low    > 0 && <MiniChip n={low}    c="#f59e0b" label="low bat"/>}
                  {miss   > 0 && <MiniChip n={miss}   c="#ef4444" label="missing"/>}
                  {assets.length === 0 && <span className="text-[9px] text-slate-600">No tracked assets</span>}
                </div>
              </button>
            );
          })}

          <p className="text-[10px] text-slate-600 text-center px-2">
            Click a floor to isolate · Click asset sphere to inspect
          </p>
        </div>
      </div>

      {/* ── Selected floor asset list ─────────────────────────────────────── */}
      {selected && (byFloor[selected]?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between"
            style={{borderLeft: `3px solid ${ACCENT[selected]}`}}>
            <p className="text-sm font-bold text-slate-200">
              Floor {selected} — {FL_LABEL[selected]}
              <span className="ml-2 text-xs text-slate-500">({byFloor[selected].length} assets)</span>
            </p>
          </div>
          <div className="divide-y divide-slate-800/60 max-h-72 overflow-auto">
            {byFloor[selected].map(a => {
              const color = SCOLOR[a.status] ?? '#94a3b8';
              return (
                <div key={a.tagId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/40 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: color}}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{a.asset?.name ?? a.tagMac}</p>
                    <p className="text-[10px] text-slate-500 truncate">{a.zone?.name ?? '—'} · {timeAgo(a.lastSeenAt)}</p>
                  </div>
                  {a.batteryLevel != null && (
                    <span className="text-xs font-bold flex-shrink-0"
                      style={{color: a.batteryLevel<=20?'#ef4444':a.batteryLevel<=40?'#f59e0b':'#94a3b8'}}>
                      {a.batteryLevel}%
                    </span>
                  )}
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{background:color+'20', color}}>
                    {a.status.replace('_',' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({n,c,label}:{n:number;c:string;label:string}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold"
      style={{background:c+'18',color:c,border:`1px solid ${c}35`}}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:c}}/>
      {n} {label}
    </div>
  );
}
function MiniChip({n,c,label}:{n:number;c:string;label:string}) {
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
      style={{background:c+'22',color:c}}>
      {n} {label}
    </span>
  );
}
