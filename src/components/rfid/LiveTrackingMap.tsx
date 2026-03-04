'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface FloorPlan {
  id: string;
  name: string;
  building?: string | null;
  floorNumber?: number | null;
  imageUrl: string;
}

interface Zone {
  id: string;
  name: string;
  mapX?: number | null;
  mapY?: number | null;
  mapWidth?: number | null;
  mapHeight?: number | null;
  isRestricted: boolean;
  floorPlanId?: string | null;
}

interface AssetLocation {
  tagId: string;
  assetId?: string | null;
  assetName?: string | null;
  status: string;
  batteryLevel?: number | null;
  lastSeenAt?: string | null;
  lastZoneId?: string | null;
  zoneName?: string | null;
}

interface TooltipState {
  tag: AssetLocation;
  x: number;
  y: number;
}

const REFRESH_INTERVAL = 10000;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:      'rgb(16,185,129)',
  LOW_BATTERY: 'rgb(245,158,11)',
  MISSING:     'rgb(239,68,68)',
  UNASSIGNED:  'rgb(156,163,175)',
};

const ZONE_FILL: Record<string, string> = {
  normal:     'rgba(59,130,246,0.15)',
  restricted: 'rgba(239,68,68,0.15)',
};

export default function LiveTrackingMap() {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLocations = useCallback(async () => {
    const res = await fetch('/api/rfid/locations');
    if (res.ok) {
      const data = await res.json();
      setLocations(data.locations ?? data.tags ?? []);
      setLastRefresh(new Date());
    }
  }, []);

  const fetchBase = useCallback(async () => {
    setLoading(true);
    const [plansRes, zonesRes] = await Promise.all([
      fetch('/api/rfid/floor-plans'),
      fetch('/api/rfid/zones'),
    ]);
    if (plansRes.ok) {
      const { plans } = await plansRes.json();
      setFloorPlans(plans ?? []);
      if (plans?.length > 0) setSelectedPlan(plans[0]);
    }
    if (zonesRes.ok) {
      const { zones: z } = await zonesRes.json();
      setZones(z ?? []);
    }
    await fetchLocations();
    setLoading(false);
  }, [fetchLocations]);

  useEffect(() => {
    fetchBase();
    const interval = setInterval(fetchLocations, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchBase, fetchLocations]);

  const planZones = zones.filter(z => z.floorPlanId === selectedPlan?.id && z.mapX != null);

  const getZoneAssets = (zoneId: string) =>
    locations.filter(l => l.lastZoneId === zoneId);

  const getZoneCentroid = (zone: Zone) => ({
    x: (zone.mapX ?? 0) + (zone.mapWidth ?? 0) / 2,
    y: (zone.mapY ?? 0) + (zone.mapHeight ?? 0) / 2,
  });

  const handleDotClick = (e: React.MouseEvent, tag: AssetLocation) => {
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    setTooltip({ tag, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Assets in zones on this floor plan
  const planZoneIds = new Set(planZones.map(z => z.id));
  const assetsInPlan = locations.filter(l => l.lastZoneId && planZoneIds.has(l.lastZoneId));

  // Stats
  const active   = assetsInPlan.filter(l => l.status === 'ACTIVE').length;
  const lowBat   = assetsInPlan.filter(l => l.status === 'LOW_BATTERY').length;
  const missing  = assetsInPlan.filter(l => l.status === 'MISSING').length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (!selectedPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Floor Plans</h3>
        <p className="text-sm text-muted-foreground">Upload a floor plan in the Zone Editor tab to enable live tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" onClick={() => setTooltip(null)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {floorPlans.length > 1 && (
          <Select
            value={selectedPlan.id}
            onValueChange={id => setSelectedPlan(floorPlans.find(p => p.id === id) ?? null)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {floorPlans.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.building ? ` — ${p.building}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Live stats */}
        <div className="flex gap-2 ml-auto">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0">
            {active} Active
          </Badge>
          {lowBat > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0">
              {lowBat} Low Battery
            </Badge>
          )}
          {missing > 0 && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-0">
              {missing} Missing
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchLocations} className="h-7 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl border shadow-sm"
      >
        <img
          src={selectedPlan.imageUrl}
          alt={selectedPlan.name}
          className="w-full h-auto block"
          draggable={false}
        />

        {/* SVG Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Zone rectangles */}
          {planZones.map(zone => (
            <g key={zone.id}>
              <rect
                x={zone.mapX!} y={zone.mapY!}
                width={zone.mapWidth!} height={zone.mapHeight!}
                fill={zone.isRestricted ? ZONE_FILL.restricted : ZONE_FILL.normal}
                stroke={zone.isRestricted ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.4)'}
                strokeWidth="0.3"
                rx="0.5"
              />
              {/* Zone label */}
              <text
                x={zone.mapX! + zone.mapWidth! / 2}
                y={zone.mapY! + 3}
                textAnchor="middle"
                fontSize="2.2"
                fill={zone.isRestricted ? 'rgb(239,68,68)' : 'rgb(59,130,246)'}
                fontWeight="600"
              >
                {zone.name}
              </text>
              {/* Asset count badge in zone */}
              {getZoneAssets(zone.id).length > 0 && (
                <g>
                  <circle
                    cx={zone.mapX! + zone.mapWidth! - 3}
                    cy={zone.mapY! + 3}
                    r="2.5"
                    fill="rgb(99,102,241)"
                  />
                  <text
                    x={zone.mapX! + zone.mapWidth! - 3}
                    y={zone.mapY! + 3}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="2"
                    fill="white"
                    fontWeight="700"
                  >
                    {getZoneAssets(zone.id).length}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* Asset dots (HTML, positioned with %) */}
        {planZones.map(zone => {
          const assets = getZoneAssets(zone.id);
          const centroid = getZoneCentroid(zone);
          return assets.map((tag, i) => {
            const spread = assets.length > 1 ? (i - (assets.length - 1) / 2) * 2.5 : 0;
            const left   = `${centroid.x + spread}%`;
            const top    = `${centroid.y}%`;
            return (
              <button
                key={tag.tagId}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-125 focus:outline-none z-10"
                style={{
                  left, top,
                  width: 18, height: 18,
                  background: STATUS_COLOR[tag.status] ?? STATUS_COLOR.UNASSIGNED,
                  animation: tag.status === 'ACTIVE' ? 'pulse 2s infinite' : 'none',
                }}
                onClick={e => handleDotClick(e, tag)}
                title={tag.assetName ?? tag.tagId}
              />
            );
          });
        })}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-20 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border p-3 w-52 text-xs"
            style={{ left: Math.min(tooltip.x + 10, (containerRef.current?.clientWidth ?? 400) - 220), top: Math.max(tooltip.y - 80, 8) }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[tooltip.tag.status] }} />
              <p className="font-semibold truncate">{tooltip.tag.assetName ?? tooltip.tag.tagId}</p>
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Status</span>
                <span className="font-medium text-foreground">{tooltip.tag.status.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Zone</span>
                <span className="font-medium text-foreground truncate">{tooltip.tag.zoneName ?? '—'}</span>
              </div>
              {tooltip.tag.batteryLevel != null && (
                <div className="flex justify-between">
                  <span>Battery</span>
                  <span className={`font-medium ${tooltip.tag.batteryLevel <= 20 ? 'text-amber-500' : 'text-foreground'}`}>
                    {tooltip.tag.batteryLevel}%
                  </span>
                </div>
              )}
              {tooltip.tag.lastSeenAt && (
                <div className="flex justify-between">
                  <span>Last seen</span>
                  <span className="font-medium text-foreground">
                    {new Date(tooltip.tag.lastSeenAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span>{status.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded" style={{ background: ZONE_FILL.restricted, border: '1px solid rgba(239,68,68,0.6)' }} />
          <span>Restricted Zone</span>
        </div>
        <span className="ml-auto">Auto-refreshes every 10s · Last: {lastRefresh.toLocaleTimeString()}</span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
      `}</style>
    </div>
  );
}
