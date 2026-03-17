// @ts-nocheck
/**
 * Handheld audit: RFID location popup with 2D and 3D map views,
 * highlighting the scanned asset on the zone map (world-class UI).
 */
import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Layers, Package, Radio, X } from 'lucide-react';

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
};

type Asset = {
  id: string;
  name: string;
  rfidTag?: { lastZone?: Zone | null } | null;
};

const SVG_W = 320;
const SVG_H = 220;

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
  const zone = asset?.rfidTag?.lastZone;

  const hasCoords = useMemo(() => {
    if (!zone) return false;
    const x = zone.mapX ?? 0;
    const y = zone.mapY ?? 0;
    const w = (zone.mapWidth ?? 20);
    const h = (zone.mapHeight ?? 15);
    return typeof x === 'number' && typeof y === 'number' && w > 0 && h > 0;
  }, [zone]);

  const norm = useMemo(() => {
    if (!zone || !hasCoords) return null;
    const x = Number(zone.mapX) || 0;
    const y = Number(zone.mapY) || 0;
    const w = Math.max(Number(zone.mapWidth) || 20, 5);
    const h = Math.max(Number(zone.mapHeight) || 15, 5);
    const pad = 20;
    const max = Math.max(w, h, 80);
    const scale = Math.min((SVG_W - pad * 2) / max, (SVG_H - pad * 2) / max);
    const cx = SVG_W / 2;
    const cy = SVG_H / 2;
    const rx = cx + (x + w / 2 - max / 2) * scale;
    const ry = cy + (y + h / 2 - max / 2) * scale;
    const rw = w * scale;
    const rh = h * scale;
    return { zoneX: rx - rw / 2, zoneY: ry - rh / 2, zoneW: rw, zoneH: rh, centerX: rx, centerY: ry };
  }, [zone, hasCoords]);

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl">
        <DialogHeader className="p-4 pb-2 border-b border-slate-200 dark:border-slate-700">
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
            <div className="px-4 py-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <MapPin className="h-4 w-4 text-violet-500 shrink-0" />
              <span>{[zone.name, zone.floorNumber, zone.roomNumber].filter(Boolean).join(' · ')}</span>
            </div>

            <Tabs value={view} onValueChange={(v) => setView(v as '2d' | '3d')} className="w-full">
              <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <TabsTrigger value="2d" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:bg-transparent">
                  <Layers className="h-4 w-4" /> 2D Map
                </TabsTrigger>
                <TabsTrigger value="3d" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:bg-transparent">
                  <MapPin className="h-4 w-4" /> 3D View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="2d" className="mt-0 p-4 bg-slate-50 dark:bg-slate-900/50 min-h-[260px]">
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-inner">
                  <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block">
                    <defs>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feFlood floodColor="#8b5cf6" floodOpacity="0.4" result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="glow" />
                        <feMerge>
                          <feMergeNode in="glow" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                        <path d="M0,0 L10,5 L0,10 Z" fill="#6366f1" />
                      </marker>
                    </defs>
                    {hasCoords && norm ? (
                      <>
                        <rect
                          x={norm.zoneX}
                          y={norm.zoneY}
                          width={norm.zoneW}
                          height={norm.zoneH}
                          fill="rgba(99, 102, 241, 0.15)"
                          stroke="#6366f1"
                          strokeWidth="2"
                          rx="4"
                        />
                        <g filter="url(#glow)">
                          <circle
                            cx={norm.centerX}
                            cy={norm.centerY}
                            r="14"
                            fill="#6366f1"
                            opacity="0.9"
                            className="animate-pulse"
                          />
                          <path
                            d={`M${norm.centerX},${norm.centerY - 20} L${norm.centerX},${norm.centerY - 6}`}
                            stroke="#6366f1"
                            strokeWidth="3"
                            markerEnd="url(#arrow)"
                          />
                        </g>
                        <text
                          x={norm.centerX}
                          y={norm.centerY + norm.zoneH / 2 + 16}
                          textAnchor="middle"
                          className="fill-slate-600 dark:fill-slate-300 text-[10px] font-semibold"
                        >
                          {asset.name}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect x="40" y="30" width="240" height="160" rx="8" fill="rgba(99, 102, 241, 0.08)" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 4" />
                        <g filter="url(#glow)">
                          <circle cx="160" cy="110" r="18" fill="#6366f1" opacity="0.9" className="animate-pulse" />
                          <path d="M160,75 L160,92" stroke="#6366f1" strokeWidth="3" markerEnd="url(#arrow)" />
                        </g>
                        <text x="160" y="155" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-xs font-medium">{zone.name}</text>
                        <text x="160" y="172" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[10px]">{asset.name}</text>
                      </>
                    )}
                  </svg>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">Asset location in zone</p>
              </TabsContent>

              <TabsContent value="3d" className="mt-0 p-4 bg-slate-50 dark:bg-slate-900/50 min-h-[260px]">
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 flex items-center justify-center min-h-[220px]">
                  <div className="relative">
                    {/* Simple isometric zone box */}
                    <svg width="200" height="140" viewBox="0 0 200 140" className="drop-shadow-lg">
                      <defs>
                        <linearGradient id="zoneTop" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.7" />
                        </linearGradient>
                        <linearGradient id="zoneLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#3730a3" />
                        </linearGradient>
                        <linearGradient id="zoneRight" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#818cf8" />
                        </linearGradient>
                        <filter id="assetGlow3d">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feFlood floodColor="#a78bfa" floodOpacity="0.6" />
                          <feComposite in2="blur" operator="in" />
                          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      {/* Isometric box: top, left, right faces */}
                      <path d="M40 50 L120 20 L200 60 L120 90 Z" fill="url(#zoneTop)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                      <path d="M40 50 L40 110 L120 140 L120 90 Z" fill="url(#zoneLeft)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      <path d="M120 90 L120 140 L200 110 L200 60 Z" fill="url(#zoneRight)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                      {/* Asset indicator on top face */}
                      <g transform="translate(120, 55)" filter="url(#assetGlow3d)">
                        <circle r="10" fill="#c4b5fd" opacity="0.95" className="animate-pulse" />
                        <path d="M0,-8 L0,0 M-6,4 L6,4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                      </g>
                    </svg>
                    <div className="absolute bottom-0 left-0 right-0 text-center">
                      <p className="text-xs font-semibold text-white drop-shadow">{zone.name}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{asset.name}</p>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">3D zone view · asset highlighted</p>
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
