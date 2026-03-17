// @ts-nocheck
/**
 * Handheld audit: RFID location popup with actual 2D floor plan + zones
 * and 3D building map (same as main app).
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Layers, Radio, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const FloorMap3D = dynamic(
  () => import('@/components/rfid/FloorMap3D').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center bg-slate-900 rounded-xl"><Loader2 className="h-10 w-10 animate-spin text-violet-500" /></div> }
);

type Zone = {
  id?: string;
  name: string;
  floorNumber?: string | null;
  roomNumber?: string | null;
  building?: string | null;
  mapX?: number | null;
  mapY?: number | null;
  mapWidth?: number | null;
  mapHeight?: number | null;
  floorPlanId?: string | null;
};

type Asset = {
  id: string;
  name: string;
  rfidTag?: { lastZone?: Zone | null } | null;
};

function AuditRfidMapDialog({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset | null;
}) {
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [mapData, setMapData] = useState<{ floorPlans: any[]; zones: any[] } | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const zone = asset?.rfidTag?.lastZone;

  const fetchMapData = useCallback(async () => {
    if (!zone?.floorPlanId) return;
    setMapLoading(true);
    try {
      const r = await fetch('/api/rfid/map-data', { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setMapData({ floorPlans: d.floorPlans ?? [], zones: d.zones ?? [] });
      } else {
        setMapData(null);
      }
    } catch {
      setMapData(null);
    } finally {
      setMapLoading(false);
    }
  }, [zone?.floorPlanId]);

  useEffect(() => {
    if (open && zone?.floorPlanId) fetchMapData();
    if (!open) setMapData(null);
  }, [open, zone?.floorPlanId, fetchMapData]);

  const floorPlan = useMemo(() => {
    if (!mapData?.floorPlans?.length || !zone?.floorPlanId) return null;
    return mapData.floorPlans.find((fp: any) => fp.id === zone.floorPlanId) ?? mapData.floorPlans[0];
  }, [mapData, zone?.floorPlanId]);

  const planZones = useMemo(() => {
    if (!mapData?.zones?.length || !floorPlan) return [];
    return mapData.zones.filter((z: any) => z.floorPlanId === floorPlan.id && z.mapX != null && z.mapY != null);
  }, [mapData, floorPlan]);

  const highlightZoneId = zone?.id ?? null;

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Radio className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <DialogTitle className="text-base">RFID location</DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{asset.name}</p>
            </div>
          </div>
        </DialogHeader>

        {zone ? (
          <>
            <div className="px-4 py-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 flex-shrink-0">
              <MapPin className="h-4 w-4 text-violet-500 shrink-0" />
              <span>{[zone.name, zone.floorNumber, zone.roomNumber].filter(Boolean).join(' · ')}</span>
            </div>

            <Tabs value={view} onValueChange={(v) => setView(v as '2d' | '3d')} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                <TabsTrigger value="2d" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:bg-transparent">
                  <Layers className="h-4 w-4" /> 2D floor map
                </TabsTrigger>
                <TabsTrigger value="3d" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:bg-transparent">
                  <MapPin className="h-4 w-4" /> 3D building
                </TabsTrigger>
              </TabsList>

              <TabsContent value="2d" className="mt-0 flex-1 min-h-0 p-0 bg-slate-900 data-[state=inactive]:hidden flex flex-col">
                {mapLoading ? (
                  <div className="flex-1 flex items-center justify-center min-h-[280px]">
                    <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                  </div>
                ) : floorPlan?.imageUrl ? (
                  <div className="relative flex-1 min-h-[280px] overflow-hidden">
                    <img
                      src={floorPlan.imageUrl}
                      alt={floorPlan.name}
                      className="w-full h-auto block min-h-[280px] object-contain bg-slate-900"
                    />
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <filter id="audit-zone-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="0.5" result="blur" />
                          <feFlood floodColor="#8b5cf6" floodOpacity="0.5" />
                          <feComposite in2="blur" operator="in" result="glow" />
                          <feMerge>
                            <feMergeNode in="glow" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      {planZones.map((z: any) => {
                        const x = z.mapX ?? 0;
                        const y = z.mapY ?? 0;
                        const w = z.mapWidth ?? 10;
                        const h = z.mapHeight ?? 10;
                        const isHighlight = highlightZoneId && z.id === highlightZoneId;
                        return (
                          <g key={z.id}>
                            <rect
                              x={x}
                              y={y}
                              width={w}
                              height={h}
                              rx="0.6"
                              fill={isHighlight ? 'rgba(139, 92, 246, 0.35)' : 'rgba(99, 102, 241, 0.12)'}
                              stroke={isHighlight ? '#a78bfa' : 'rgba(99, 102, 241, 0.4)'}
                              strokeWidth={isHighlight ? '0.8' : '0.4'}
                              filter={isHighlight ? 'url(#audit-zone-glow)' : undefined}
                            />
                            {isHighlight && (
                              <circle
                                cx={x + w / 2}
                                cy={y + h / 2}
                                r="2.5"
                                fill="#c4b5fd"
                                className="animate-pulse"
                                filter="url(#audit-zone-glow)"
                              />
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[280px] text-slate-500 px-4">
                    <MapPin className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-sm font-medium">No floor plan for this zone</p>
                    <p className="text-xs mt-1">Upload a floor plan in RFID settings to see the 2D map.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="3d" className="mt-0 flex-1 min-h-0 p-0 data-[state=inactive]:hidden overflow-auto">
                <div className="min-h-[400px] bg-slate-950">
                  <FloorMap3D />
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="p-6 text-center text-slate-500 dark:text-slate-400">
            <Radio className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No RFID zone data</p>
            <p className="text-xs mt-1">This asset has no recent RFID location.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AuditRfidMapDialog;
