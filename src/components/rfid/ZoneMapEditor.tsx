'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface FloorPlan {
  id: string;
  name: string;
  building?: string | null;
  floorNumber?: number | null;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

interface RFIDZone {
  id: string;
  name: string;
  mapX?: number | null;
  mapY?: number | null;
  mapWidth?: number | null;
  mapHeight?: number | null;
  floorPlanId?: string | null;
  isRestricted: boolean;
  apMacAddress?: string | null;
  description?: string | null;
}

interface DrawRect { x: number; y: number; w: number; h: number }

interface ZoneMapEditorProps {
  organizationId?: string;
  onZoneUpdated?: () => void;
}

const ZONE_COLORS = [
  'rgba(59,130,246,0.35)',   // blue
  'rgba(16,185,129,0.35)',   // green
  'rgba(245,158,11,0.35)',   // amber
  'rgba(168,85,247,0.35)',   // purple
  'rgba(236,72,153,0.35)',   // pink
  'rgba(20,184,166,0.35)',   // teal
];
const RESTRICTED_COLOR = 'rgba(239,68,68,0.35)';

export default function ZoneMapEditor({ organizationId, onZoneUpdated }: ZoneMapEditorProps) {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [zones, setZones] = useState<RFIDZone[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const [editingZone, setEditingZone] = useState<RFIDZone | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRestricted, setNewZoneRestricted] = useState(false);
  const [newZoneApMac, setNewZoneApMac] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanBuilding, setNewPlanBuilding] = useState('');
  const [newPlanFloor, setNewPlanFloor] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const [plansRes, zonesRes] = await Promise.all([
      fetch('/api/rfid/floor-plans'),
      fetch('/api/rfid/zones'),
    ]);
    if (plansRes.ok) {
      const { plans } = await plansRes.json();
      setFloorPlans(plans ?? []);
      if (plans?.length > 0 && !selectedPlan) setSelectedPlan(plans[0]);
    }
    if (zonesRes.ok) {
      const { zones: z } = await zonesRes.json();
      setZones(z ?? []);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getPct = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!selectedPlan || editingZone) return;
    e.preventDefault();
    const pos = getPct(e);
    setDrawStart(pos);
    setDrawing(true);
    setDrawRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !drawStart) return;
    const pos = getPct(e);
    setDrawRect({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x),
      h: Math.abs(pos.y - drawStart.y),
    });
  };

  const onMouseUp = () => {
    if (!drawing || !drawRect) return;
    setDrawing(false);
    if (drawRect.w < 2 || drawRect.h < 2) { setDrawRect(null); return; }
    // Prompt user to name the new zone
    setNewZoneName('');
    setNewZoneRestricted(false);
    setNewZoneApMac('');
    setEditingZone({ id: '__new__', name: '', mapX: drawRect.x, mapY: drawRect.y, mapWidth: drawRect.w, mapHeight: drawRect.h, floorPlanId: selectedPlan?.id, isRestricted: false });
  };

  const saveNewZone = async () => {
    if (!newZoneName.trim() || !editingZone || !selectedPlan) return;
    setSaving(true);
    try {
      const isNew = editingZone.id === '__new__';
      const url  = isNew ? '/api/rfid/zones' : `/api/rfid/zones/${editingZone.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         newZoneName.trim(),
          floorPlanId:  selectedPlan.id,
          mapX:         editingZone.mapX,
          mapY:         editingZone.mapY,
          mapWidth:     editingZone.mapWidth,
          mapHeight:    editingZone.mapHeight,
          isRestricted: newZoneRestricted,
          apMacAddress: newZoneApMac || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success(isNew ? 'Zone created' : 'Zone updated');
      setEditingZone(null);
      setDrawRect(null);
      await fetchData();
      onZoneUpdated?.();
    } catch {
      toast.error('Failed to save zone');
    } finally {
      setSaving(false);
    }
  };

  const deleteZone = async (zoneId: string) => {
    if (!confirm('Delete this zone?')) return;
    try {
      await fetch(`/api/rfid/zones/${zoneId}`, { method: 'DELETE' });
      toast.success('Zone deleted');
      await fetchData();
      onZoneUpdated?.();
    } catch { toast.error('Delete failed'); }
  };

  const handleEditZone = (zone: RFIDZone) => {
    setEditingZone(zone);
    setNewZoneName(zone.name);
    setNewZoneRestricted(zone.isRestricted);
    setNewZoneApMac(zone.apMacAddress ?? '');
  };

  const uploadFloorPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !newPlanName.trim()) { toast.error('Enter a plan name first'); return; }
    setUploading(true);
    try {
      // Upload image to Supabase via dedicated upload endpoint
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'rfid-floor-plans');

      // Use asset-documents upload pattern
      const uploadRes = await fetch('/api/rfid/upload-floor-plan', {
        method: 'POST',
        body: formData,
      });
      let imageUrl = '';
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        imageUrl = data.url;
      } else {
        // Fallback: create object URL (local preview only)
        imageUrl = URL.createObjectURL(file);
      }

      const img = new Image();
      img.onload = async () => {
        const createRes = await fetch('/api/rfid/floor-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:        newPlanName.trim(),
            building:    newPlanBuilding || null,
            floorNumber: newPlanFloor ? Number(newPlanFloor) : null,
            imageUrl,
            imageWidth:  img.naturalWidth  || 1000,
            imageHeight: img.naturalHeight || 700,
          }),
        });
        if (createRes.ok) {
          const { plan } = await createRes.json();
          toast.success('Floor plan uploaded');
          setNewPlanName('');
          setNewPlanBuilding('');
          setNewPlanFloor('');
          await fetchData();
          setSelectedPlan(plan);
        } else {
          toast.error('Failed to create floor plan record');
        }
      };
      img.src = imageUrl;
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const planZones = zones.filter(z => z.floorPlanId === selectedPlan?.id);

  return (
    <div className="flex flex-col gap-4">
      {/* Floor Plan Selector + Upload */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Floor Plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {floorPlans.length > 0 && (
            <Select
              value={selectedPlan?.id ?? ''}
              onValueChange={id => setSelectedPlan(floorPlans.find(p => p.id === id) ?? null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select floor plan" />
              </SelectTrigger>
              <SelectContent>
                {floorPlans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.building ? ` — ${p.building}` : ''}{p.floorNumber != null ? ` (Floor ${p.floorNumber})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Upload new floor plan */}
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Plan name *" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} />
            <Input placeholder="Building" value={newPlanBuilding} onChange={e => setNewPlanBuilding(e.target.value)} />
            <Input placeholder="Floor #" type="number" value={newPlanFloor} onChange={e => setNewPlanFloor(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !newPlanName.trim()}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : '+ Upload Floor Plan Image'}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadFloorPlan} />
          </div>
        </CardContent>
      </Card>

      {/* Map Canvas */}
      {selectedPlan ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Click and drag on the map to draw a new zone. Click an existing zone to edit.
            </p>
            <Badge variant="outline" className="text-xs">
              {planZones.length} zone{planZones.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-800 cursor-crosshair select-none"
            style={{ userSelect: 'none' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { if (drawing) { setDrawing(false); setDrawRect(null); } }}
          >
            {/* Floor plan image */}
            <img
              ref={imgRef}
              src={selectedPlan.imageUrl}
              alt={selectedPlan.name}
              className="w-full h-auto block"
              draggable={false}
            />

            {/* SVG Zone Overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {planZones.map((zone, i) => {
                if (zone.mapX == null) return null;
                const color = zone.isRestricted ? RESTRICTED_COLOR : ZONE_COLORS[i % ZONE_COLORS.length];
                return (
                  <g key={zone.id}>
                    <rect
                      x={zone.mapX} y={zone.mapY!}
                      width={zone.mapWidth!} height={zone.mapHeight!}
                      fill={color}
                      stroke={zone.isRestricted ? 'rgb(239,68,68)' : 'rgb(59,130,246)'}
                      strokeWidth="0.4"
                      rx="0.5"
                      style={{ pointerEvents: 'none' }}
                    />
                    <text
                      x={zone.mapX! + zone.mapWidth! / 2}
                      y={zone.mapY! + zone.mapHeight! / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="3"
                      fill="white"
                      fontWeight="600"
                      style={{ pointerEvents: 'none' }}
                    >
                      {zone.name}
                    </text>
                  </g>
                );
              })}

              {/* Drawing rect preview */}
              {drawRect && (
                <rect
                  x={drawRect.x} y={drawRect.y}
                  width={drawRect.w} height={drawRect.h}
                  fill="rgba(99,102,241,0.25)"
                  stroke="rgb(99,102,241)"
                  strokeWidth="0.5"
                  strokeDasharray="2,1"
                  rx="0.5"
                />
              )}
            </svg>
          </div>

          {/* Zone click targets (positioned absolutely via CSS %) */}
          <div className="relative w-full" style={{ display: 'none' }}>
            {/* Actual click handling done via onMouseDown on SVG / container */}
          </div>

          {/* Zone list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {planZones.map((zone, i) => (
              <div
                key={zone.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: zone.isRestricted ? 'rgb(239,68,68)' : ZONE_COLORS[i % ZONE_COLORS.length].replace('0.35', '1') }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{zone.name}</p>
                    {zone.isRestricted && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1">RESTRICTED</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleEditZone(zone)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => deleteZone(zone.id)}>
                    Del
                  </Button>
                </div>
              </div>
            ))}
            {planZones.length === 0 && (
              <p className="col-span-2 text-center text-sm text-muted-foreground py-4">
                No zones on this floor plan yet. Drag on the map above to add one.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">No Floor Plan</h3>
          <p className="text-sm text-muted-foreground mb-4">Upload a floor plan image to start drawing RFID zones</p>
        </div>
      )}

      {/* Zone Edit/Create Modal */}
      {editingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">
              {editingZone.id === '__new__' ? 'New Zone' : `Edit: ${editingZone.name}`}
            </h3>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Zone Name *</Label>
                <Input
                  autoFocus
                  placeholder="e.g. Server Room A"
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">AP MAC Address (optional)</Label>
                <Input
                  placeholder="AC:CE:8D:12:34:56"
                  value={newZoneApMac}
                  onChange={e => setNewZoneApMac(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <div>
                  <Label className="text-sm font-medium text-red-700 dark:text-red-300">Restricted Zone</Label>
                  <p className="text-xs text-red-500 mt-0.5">Triggers CRITICAL alert when any asset enters</p>
                </div>
                <Switch
                  checked={newZoneRestricted}
                  onCheckedChange={setNewZoneRestricted}
                />
              </div>
              {editingZone.mapX != null && (
                <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800 rounded p-2">
                  Map area: x={editingZone.mapX?.toFixed(1)}% y={editingZone.mapY?.toFixed(1)}%
                  &nbsp;({editingZone.mapWidth?.toFixed(1)}% × {editingZone.mapHeight?.toFixed(1)}%)
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setEditingZone(null); setDrawRect(null); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveNewZone} disabled={!newZoneName.trim() || saving}>
                {saving ? 'Saving...' : 'Save Zone'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
