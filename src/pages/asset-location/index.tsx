// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import Map, { Marker, NavigationControl, Popup, ScaleControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/router";
import { useToast } from "@/components/ui/use-toast";
import { AssetLocationDetailsDialog } from "@/components/AssetLocationDetailsDialog";
import { AssetMoveDialog } from "@/components/AssetMoveDialog";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import {
  MapPin, Building2, Search, List, Map as MapIcon,
  Eye, RefreshCw, Package, AlertTriangle, X, Navigation,
  Crosshair, Check, Loader2, Activity, Wifi, WifiOff,
  Battery, BatteryLow, Radio, Zap, Shield, Clock, ExternalLink,
  MoreHorizontal, AlertCircle, Target, ArrowUpRight, Plus,
  CheckCircle2, Truck, Wrench, Star, Box, XCircle, Filter,
  BarChart3, Layers, Signal, SatelliteDish, TrendingUp, Globe,
  Share2, Download, ChevronRight, Info,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Asset {
  id: string; name: string; description: string | null;
  status: string; type?: string; hasGps: boolean;
  location?: { id: string; latitude: number; longitude: number; address: string | null; accuracy?: number | null; source?: string | null; updatedAt?: string; } | null;
  floorNumber: string | null; roomNumber: string | null;
  purchaseAmount: number | null; createdAt: string; updatedAt?: string;
  imageUrl?: string | null; assetId?: string | null;
}

interface RFIDAsset {
  tagId: string; tagMac: string; tagType: string; status: string;
  batteryLevel: number | null; lastRssi: number | null; lastSeenAt: string | null;
  asset: { id: string; name: string; type: string; status: string; imageUrl: string | null } | null;
  zone: { id: string; name: string; mapX?: number | null; mapY?: number | null; floorPlanId?: string | null; building?: string; floorNumber?: string; roomNumber?: string } | null;
  trail: Array<{ zone: string; rssi: number | null; timestamp: string }>;
}

/* ─── Status Config ─────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; bg: string; dot: string; icon: any }> = {
  ACTIVE:      { label: "Active",      bg: "bg-emerald-500", dot: "bg-emerald-400", icon: CheckCircle2 },
  IN_TRANSIT:  { label: "In Transit",  bg: "bg-blue-500",    dot: "bg-blue-400",    icon: Truck },
  MAINTENANCE: { label: "Maintenance", bg: "bg-amber-500",   dot: "bg-amber-400",   icon: Wrench },
  DISPOSED:    { label: "Disposed",    bg: "bg-red-500",     dot: "bg-red-400",     icon: XCircle },
  DAMAGED:     { label: "Damaged",     bg: "bg-orange-500",  dot: "bg-orange-400",  icon: AlertTriangle },
  CRITICAL:    { label: "Critical",    bg: "bg-rose-500",    dot: "bg-rose-400",    icon: AlertCircle },
  LIKE_NEW:    { label: "Like New",    bg: "bg-teal-500",    dot: "bg-teal-400",    icon: Star },
};
const getCfg = (s: string) => STATUS_CFG[s] || { label: s, bg: "bg-slate-500", dot: "bg-slate-400", icon: Box };

/* ─── RFID Status Config ────────────────────────────────────────────────────── */
const RFID_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  ACTIVE:      { label: "Active",      color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: Wifi },
  LOW_BATTERY: { label: "Low Battery", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",   icon: BatteryLow },
  MISSING:     { label: "Missing",     color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",       icon: AlertCircle },
  INACTIVE:    { label: "Inactive",    color: "text-slate-400",   bg: "bg-slate-500/15 border-slate-500/30",   icon: WifiOff },
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
const fmtAgo = (ts: string | null) => {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const isFresh = (ts: string | null) => ts && (Date.now() - new Date(ts).getTime()) < 5 * 60 * 1000;

/* ─── Set Location Dialog ───────────────────────────────────────────────────── */
function SetLocationDialog({ asset, open, onOpenChange, onSaved, mapboxToken }: {
  asset: Asset | null; open: boolean; onOpenChange: (v: boolean) => void;
  onSaved: () => void; mapboxToken: string;
}) {
  const { toast } = useToast();
  const [lat, setLat] = useState(""); const [lng, setLng] = useState("");
  const [address, setAddress] = useState(""); const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false); const [mapClickMode, setMapClickMode] = useState(false);
  const [previewState, setPreviewState] = useState({ latitude: 25.2867, longitude: 51.5333, zoom: 10 });
  const [pinPos, setPinPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!open) { setLat(""); setLng(""); setAddress(""); setPinPos(null); setMapClickMode(false); }
    if (open && asset?.location) {
      setLat(String(asset.location.latitude)); setLng(String(asset.location.longitude));
      setAddress(asset.location.address || "");
      setPinPos({ lat: asset.location.latitude, lng: asset.location.longitude });
      setPreviewState({ latitude: asset.location.latitude, longitude: asset.location.longitude, zoom: 14 });
    }
  }, [open, asset]);

  const detectGps = () => {
    if (!navigator.geolocation) { toast({ title: "GPS not supported", variant: "destructive" }); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude.toFixed(6)); setLng(longitude.toFixed(6));
        setPinPos({ lat: latitude, lng: longitude });
        setPreviewState({ latitude, longitude, zoom: 15 });
        setDetecting(false);
        toast({ title: "GPS detected", description: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
      },
      err => { setDetecting(false); toast({ title: "GPS error", description: err.message, variant: "destructive" }); },
      { timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMapClick = (evt: any) => {
    if (!mapClickMode) return;
    const { lngLat } = evt;
    setLat(lngLat.lat.toFixed(6)); setLng(lngLat.lng.toFixed(6));
    setPinPos({ lat: lngLat.lat, lng: lngLat.lng }); setMapClickMode(false);
  };

  const handleSave = async () => {
    const latitude = parseFloat(lat); const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) { toast({ title: "Invalid coordinates", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset?.id}/location`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, address: address || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast({ title: "Location saved", description: `${asset?.name} pinned to map.` });
      onSaved(); onOpenChange(false);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!asset) return null;
  const cfg = getCfg(asset.status);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-0" style={{ background: "#0f172a" }}>
        <div className="px-6 pt-6 pb-4 border-b border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center text-white text-xs font-bold`}>{asset.name[0]?.toUpperCase()}</div>
              Set GPS Location — {asset.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">Pin this asset on the map by detecting GPS, clicking the map, or entering coordinates.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={detectGps} disabled={detecting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {detecting ? "Detecting…" : "Use My GPS"}
            </button>
            {mapboxToken && (
              <button onClick={() => setMapClickMode(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${mapClickMode ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                <Crosshair className="h-4 w-4" />{mapClickMode ? "Click on map to pin…" : "Click Map to Set"}
              </button>
            )}
          </div>
          {mapboxToken && (
            <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ height: "220px" }}>
              <Map {...previewState} onMove={evt => setPreviewState(evt.viewState)}
                mapboxAccessToken={mapboxToken} style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/dark-v11" cursor={mapClickMode ? "crosshair" : "grab"}
                onClick={handleMapClick} dragRotate={false}>
                <NavigationControl position="top-right" showCompass={false} />
                {pinPos && (
                  <Marker latitude={pinPos.lat} longitude={pinPos.lng}>
                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-lg">
                      <MapPin className="h-4 w-4" />
                    </div>
                  </Marker>
                )}
              </Map>
              {mapClickMode && (
                <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 text-white text-xs text-center py-1.5 font-semibold">
                  Click anywhere on the map to place the pin
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 block">Latitude</label>
              <input type="number" step="any" value={lat}
                onChange={e => { setLat(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) { setPinPos(p => p ? { ...p, lat: v } : { lat: v, lng: parseFloat(lng) || 0 }); setPreviewState(s => ({ ...s, latitude: v })); } }}
                placeholder="e.g. 25.2867" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 block">Longitude</label>
              <input type="number" step="any" value={lng}
                onChange={e => { setLng(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) { setPinPos(p => p ? { ...p, lng: v } : { lat: parseFloat(lat) || 0, lng: v }); setPreviewState(s => ({ ...s, longitude: v })); } }}
                placeholder="e.g. 51.5333" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 block">Address / Note (optional)</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="e.g. Main Office, Floor 3"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !lat || !lng}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Location"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── RFID Tag Card ─────────────────────────────────────────────────────────── */
function RFIDTagCard({ tag, onViewAsset }: { tag: RFIDAsset; onViewAsset: (id: string) => void }) {
  const rfidCfg = RFID_STATUS[tag.status] || RFID_STATUS.INACTIVE;
  const RFIDIcon = rfidCfg.icon;
  const fresh = isFresh(tag.lastSeenAt);
  const bat = tag.batteryLevel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 transition-all hover:border-indigo-500/50 ${rfidCfg.bg}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${tag.status === 'ACTIVE' ? 'bg-emerald-500/20' : tag.status === 'MISSING' ? 'bg-red-500/20' : tag.status === 'LOW_BATTERY' ? 'bg-amber-500/20' : 'bg-slate-500/20'}`}>
            <Radio className={`h-4 w-4 ${rfidCfg.color}`} />
          </div>
          <div>
            <p className="font-bold text-sm text-slate-200 truncate max-w-[140px]">
              {tag.asset?.name || "Unassigned Tag"}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">{tag.tagMac}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${rfidCfg.bg} ${rfidCfg.color}`}>
          {fresh && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          <RFIDIcon className="h-2.5 w-2.5" />
          {rfidCfg.label}
        </div>
      </div>

      {tag.zone && (
        <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 rounded-lg bg-slate-800/50">
          <Building2 className="h-3 w-3 text-indigo-400 shrink-0" />
          <span className="text-xs text-slate-300 font-medium">{tag.zone.name}</span>
          {tag.zone.floorNumber && <span className="text-[10px] text-slate-500 ml-auto">F{tag.zone.floorNumber}</span>}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {bat !== null && (
            <div className="flex items-center gap-1">
              <BatteryLow className={`h-3 w-3 ${bat < 20 ? 'text-red-400' : bat < 50 ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span className={`text-[11px] font-semibold ${bat < 20 ? 'text-red-400' : bat < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{bat}%</span>
            </div>
          )}
          {tag.lastRssi !== null && (
            <div className="flex items-center gap-1">
              <Signal className="h-3 w-3 text-slate-500" />
              <span className="text-[11px] text-slate-500">{tag.lastRssi} dBm</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-slate-600" />
          <span className="text-[10px] text-slate-500">{fmtAgo(tag.lastSeenAt)}</span>
        </div>
      </div>

      {tag.asset && (
        <button onClick={() => onViewAsset(tag.asset!.id)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors">
          <Eye className="h-3 w-3" /> View Asset
        </button>
      )}
    </motion.div>
  );
}

/* ─── Asset List Row ────────────────────────────────────────────────────────── */
function AssetListRow({ asset, rfidMap, onFocus, onPin, onDetails }: {
  asset: Asset; rfidMap: Map<string, RFIDAsset>;
  onFocus: (a: Asset) => void; onPin: (a: Asset) => void; onDetails: (id: string) => void;
}) {
  const cfg = getCfg(asset.status);
  const rfid = rfidMap.get(asset.id);
  const rfidStatus = rfid ? RFID_STATUS[rfid.status] || RFID_STATUS.INACTIVE : null;

  const locationType = asset.hasGps ? "gps" : rfid ? "rfid" : (asset.floorNumber || asset.roomNumber) ? "manual" : "none";
  const locationColors = {
    gps: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rfid: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    manual: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    none: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  };
  const locationLabels = {
    gps: "GPS Pinned",
    rfid: "RFID Zone",
    manual: "Floor/Room",
    none: "No Location",
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all group">
      <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow`}>
        {asset.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-200 text-sm truncate">{asset.name}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${locationColors[locationType]}`}>
            {locationLabels[locationType]}
          </span>
          {rfid && rfidStatus && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${rfidStatus.bg} ${rfidStatus.color}`}>
              <Radio className="h-2.5 w-2.5 inline mr-0.5" />RFID
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {asset.hasGps && asset.location && (
            <span className="text-[11px] text-slate-500 font-mono">
              {asset.location.latitude.toFixed(4)}, {asset.location.longitude.toFixed(4)}
            </span>
          )}
          {rfid?.zone && (
            <span className="text-[11px] text-cyan-500 flex items-center gap-0.5">
              <Radio className="h-2.5 w-2.5" />{rfid.zone.name}
            </span>
          )}
          {(asset.floorNumber || asset.roomNumber) && (
            <span className="text-[11px] text-slate-600 flex items-center gap-0.5">
              <Building2 className="h-2.5 w-2.5" />
              {asset.floorNumber && `F${asset.floorNumber}`}{asset.floorNumber && asset.roomNumber && "·"}{asset.roomNumber && `R${asset.roomNumber}`}
            </span>
          )}
          {asset.location?.address && (
            <span className="text-[11px] text-slate-500 truncate max-w-48">{asset.location.address}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {asset.hasGps && (
          <button onClick={() => onFocus(asset)} className="p-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors" title="Show on map">
            <MapPin className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => onPin(asset)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors" title={asset.hasGps ? "Update GPS" : "Pin to map"}>
          <Target className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDetails(asset.id)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors" title="View details">
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function AssetLocationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();

  /* State */
  const [assets, setAssets] = useState<Asset[]>([]);
  const [rfidAssets, setRfidAssets] = useState<RFIDAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rfidLoading, setRfidLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "rfid" | "list">("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [gpsFilter, setGpsFilter] = useState<"all" | "pinned" | "unpinned">("all");
  const [rfidFilter, setRfidFilter] = useState<string>("all");
  const [viewState, setViewState] = useState({ latitude: 25.2867, longitude: 51.5333, zoom: 9 });
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [assetForLocation, setAssetForLocation] = useState<Asset | null>(null);
  const [setLocationOpen, setSetLocationOpen] = useState(false);
  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [selectedAssetForDialog, setSelectedAssetForDialog] = useState<Asset | null>(null);
  const [moveAssetOpen, setMoveAssetOpen] = useState(false);
  const [assetToMove, setAssetToMove] = useState<Asset | null>(null);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [assetToReport, setAssetToReport] = useState<Asset | null>(null);
  const [showLayers, setShowLayers] = useState({ gps: true, rfid: true });
  const rfidPollRef = useRef<NodeJS.Timeout | null>(null);
  const [rfidLastRefresh, setRfidLastRefresh] = useState<Date | null>(null);

  /* RFID map keyed by asset.id */
  const rfidMap = useMemo(() => {
    const m = new Map<string, RFIDAsset>();
    for (const tag of rfidAssets) {
      if (tag.asset?.id) m.set(tag.asset.id, tag);
    }
    return m;
  }, [rfidAssets]);

  /* Stats */
  const stats = useMemo(() => {
    const pinned = assets.filter(a => a.hasGps).length;
    const rfidTracked = rfidAssets.filter(t => t.asset).length;
    const rfidMissing = rfidAssets.filter(t => t.status === 'MISSING').length;
    const rfidLowBat = rfidAssets.filter(t => t.status === 'LOW_BATTERY').length;
    const noLocation = assets.filter(a => !a.hasGps && !rfidMap.has(a.id) && !a.floorNumber && !a.roomNumber).length;
    const bystatus: Record<string, number> = {};
    for (const a of assets) bystatus[a.status] = (bystatus[a.status] || 0) + 1;
    const locationPct = assets.length ? Math.round(((pinned + rfidTracked) / assets.length) * 100) : 0;
    return { total: assets.length, pinned, rfidTracked, rfidMissing, rfidLowBat, noLocation, bystatus, locationPct };
  }, [assets, rfidAssets, rfidMap]);

  /* Filtered assets */
  const filteredAssets = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return assets.filter(a => {
      const rfid = rfidMap.get(a.id);
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) ||
        a.location?.address?.toLowerCase().includes(q) || a.assetId?.toLowerCase().includes(q) ||
        rfid?.zone?.name?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || a.status === statusFilter;
      const matchGps = gpsFilter === "all" || (gpsFilter === "pinned" && a.hasGps) || (gpsFilter === "unpinned" && !a.hasGps);
      return matchSearch && matchStatus && matchGps;
    });
  }, [assets, rfidMap, searchQuery, statusFilter, gpsFilter]);

  const filteredRfid = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rfidAssets.filter(t => {
      const matchSearch = !q || t.asset?.name?.toLowerCase().includes(q) || t.tagMac?.toLowerCase().includes(q) || t.zone?.name?.toLowerCase().includes(q);
      const matchFilter = rfidFilter === "all" || t.status === rfidFilter.toUpperCase();
      return matchSearch && matchFilter;
    });
  }, [rfidAssets, searchQuery, rfidFilter]);

  const mappedAssets = useMemo(() => filteredAssets.filter(a => a.hasGps && showLayers.gps), [filteredAssets, showLayers.gps]);

  /* Fetch GPS assets */
  const fetchAssets = useCallback(async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true); else { setIsLoading(true); setError(null); }
      const res = await fetch("/api/assets/locations");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to fetch");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      setAssets(data);
      if (!silent) {
        const gpsAssets = data.filter((a: Asset) => a.hasGps);
        if (gpsAssets.length > 0) {
          const lats = gpsAssets.map((a: Asset) => a.location!.latitude);
          const lngs = gpsAssets.map((a: Asset) => a.location!.longitude);
          setViewState({ latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2, zoom: gpsAssets.length === 1 ? 14 : 10 });
        }
      }
      if (silent) toast({ title: "Refreshed", description: `${data.length} assets loaded.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (silent) toast({ title: "Refresh failed", description: msg, variant: "destructive" }); else setError(msg);
    } finally { setIsLoading(false); setIsRefreshing(false); }
  }, [toast]);

  /* Fetch RFID locations */
  const fetchRfid = useCallback(async () => {
    try {
      setRfidLoading(true);
      const res = await fetch("/api/rfid/locations");
      if (res.ok) {
        const data = await res.json();
        setRfidAssets(data.locations || []);
        setRfidLastRefresh(new Date());
      }
    } catch {} finally { setRfidLoading(false); }
  }, []);

  useEffect(() => { fetchAssets(); fetchRfid(); }, []);

  /* RFID auto-refresh every 30s */
  useEffect(() => {
    rfidPollRef.current = setInterval(() => fetchRfid(), 30000);
    return () => { if (rfidPollRef.current) clearInterval(rfidPollRef.current); };
  }, [fetchRfid]);

  const focusOnAsset = (asset: Asset) => {
    setSelectedAsset(asset); setShowPopup(true);
    if (asset.hasGps && asset.location) {
      setViewState(prev => ({ ...prev, latitude: asset.location!.latitude, longitude: asset.location!.longitude, zoom: 15 }));
    }
    if (isMobile) setActiveTab("map");
  };

  const handleViewDetails = (assetId: string) => {
    const a = assets.find(x => x.id === assetId);
    if (a) { setSelectedAssetForDialog(a); setAssetDetailsOpen(true); }
  };

  const openSetLocation = (asset: Asset) => { setAssetForLocation(asset); setSetLocationOpen(true); };

  if (isLoading) return (
    <DashboardLayout>
      <div className="min-h-screen p-6 space-y-4" style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)" }}>
        <Skeleton className="h-40 rounded-3xl bg-slate-800/60" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl bg-slate-800/60" />)}
        </div>
        <Skeleton className="h-[500px] rounded-2xl bg-slate-800/60" />
      </div>
    </DashboardLayout>
  );

  if (error) return (
    <DashboardLayout>
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)" }}>
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Failed to Load</h3>
          <p className="text-red-300 text-sm mb-6">{error}</p>
          <Button onClick={() => fetchAssets()} className="bg-red-500 hover:bg-red-600 gap-2"><RefreshCw className="h-4 w-4" /> Try Again</Button>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      {/* Dialogs */}
      <AssetLocationDetailsDialog asset={selectedAssetForDialog} open={assetDetailsOpen} onOpenChange={setAssetDetailsOpen} statusLabels={Object.fromEntries(Object.entries(STATUS_CFG).map(([k, v]) => [k, v.label]))} statusColors={Object.fromEntries(Object.entries(STATUS_CFG).map(([k, v]) => [k, v.bg]))} />
      {assetToMove && (
        <AssetMoveDialog asset={{ id: assetToMove.id, name: assetToMove.name, floorNumber: assetToMove.floorNumber, roomNumber: assetToMove.roomNumber }}
          open={moveAssetOpen} onOpenChange={setMoveAssetOpen}
          onAssetMoved={() => { fetchAssets(true); setMoveAssetOpen(false); setAssetToMove(null); }} />
      )}
      <CreateTicketDialog open={reportIssueOpen} onOpenChange={setReportIssueOpen}
        onTicketCreated={() => { setReportIssueOpen(false); setAssetToReport(null); }} assetId={assetToReport?.id} />
      <SetLocationDialog asset={assetForLocation} open={setLocationOpen} onOpenChange={setSetLocationOpen}
        onSaved={() => fetchAssets(true)} mapboxToken={mapboxToken} />

      <div className="min-h-screen" style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#0f172a 100%)" }}>

        {/* ── Hero ── */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#1e40af 80%,#0f172a 100%)" }}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#a78bfa,transparent 70%)" }} />
            <div className="absolute -bottom-12 -left-12 w-72 h-72 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#38bdf8,transparent 70%)" }} />
          </div>
          <div className="relative z-10 px-6 py-8 max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                    <Globe className="h-6 w-6 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest">Location Intelligence</p>
                    <h1 className="text-3xl font-black text-white">Asset Location Center</h1>
                  </div>
                </div>
                <p className="text-indigo-200/70 text-sm max-w-lg">
                  Unified GPS tracking, RFID zone monitoring, and building location across your entire asset fleet.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {stats.rfidMissing > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-semibold">
                    <AlertCircle className="h-4 w-4 animate-pulse" />
                    {stats.rfidMissing} missing
                  </div>
                )}
                {stats.rfidLowBat > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-semibold">
                    <BatteryLow className="h-4 w-4" />
                    {stats.rfidLowBat} low bat
                  </div>
                )}
                <Button variant="outline" size="sm" className="border-white/25 bg-white/10 text-white hover:bg-white/20 gap-2"
                  onClick={() => { fetchAssets(true); fetchRfid(); }} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: "Total Assets", value: stats.total, sub: "in system", border: "border-white/20", icon: Package },
                { label: "GPS Pinned", value: stats.pinned, sub: "on map", border: "border-emerald-500/40", icon: MapPin, color: "text-emerald-400" },
                { label: "RFID Tracked", value: stats.rfidTracked, sub: "in zones", border: "border-cyan-500/40", icon: Radio, color: "text-cyan-400" },
                { label: "Missing/Alert", value: stats.rfidMissing + (stats.bystatus.CRITICAL || 0), sub: "needs attention", border: stats.rfidMissing > 0 ? "border-red-500/40" : "border-white/20", icon: AlertTriangle, color: stats.rfidMissing > 0 ? "text-red-400" : "text-slate-400" },
                { label: "No Location", value: stats.noLocation, sub: "untracked", border: stats.noLocation > 0 ? "border-amber-500/40" : "border-white/20", icon: Target, color: stats.noLocation > 0 ? "text-amber-400" : "text-slate-400" },
              ].map(({ label, value, sub, border, icon: Icon, color }, i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`rounded-2xl p-4 border ${border} bg-slate-900/50 backdrop-blur-sm`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${color || "text-slate-400"}`} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                  </div>
                  <p className={`text-3xl font-black ${color || "text-white"}`}>{value}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Location coverage bar */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-slate-400 shrink-0">Location coverage</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                  initial={{ width: 0 }} animate={{ width: `${stats.locationPct}%` }} transition={{ duration: 1, ease: "easeOut" }} />
              </div>
              <span className="text-xs font-bold text-emerald-400 shrink-0">{stats.locationPct}%</span>
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                const count = stats.bystatus[key] || 0;
                if (count === 0) return null;
                const StatusIcon = cfg.icon;
                return (
                  <button key={key} onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${statusFilter === key ? `${cfg.bg} text-white border-transparent` : 'bg-white/8 text-slate-300 border-white/15 hover:bg-white/15'}`}>
                    <StatusIcon className="h-3 w-3" />{cfg.label}
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full ${statusFilter === key ? 'bg-white/30' : 'bg-white/10'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="sticky top-0 z-30 border-b border-slate-800/80" style={{ background: "rgba(15,23,42,0.97)", backdropFilter: "blur(16px)" }}>
          <div className="px-4 py-2.5 max-w-7xl mx-auto flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 min-w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search assets, zones, addresses…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-xl border border-slate-700 overflow-hidden text-xs font-semibold">
              {([
                { key: "map", icon: MapIcon, label: "Map" },
                { key: "rfid", icon: Radio, label: `RFID${rfidAssets.length > 0 ? ` (${rfidAssets.length})` : ""}` },
                { key: "list", icon: List, label: "All Assets" },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-3 py-2 flex items-center gap-1.5 transition-colors ${activeTab === key ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {/* GPS filter (map/list tabs) */}
            {activeTab !== "rfid" && (
              <div className="flex rounded-xl border border-slate-700 overflow-hidden text-xs font-semibold">
                {(["all", "pinned", "unpinned"] as const).map(f => (
                  <button key={f} onClick={() => setGpsFilter(f)}
                    className={`px-3 py-2 transition-colors capitalize ${gpsFilter === f ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                    {f === "all" ? "All" : f === "pinned" ? "GPS Only" : "Not Pinned"}
                  </button>
                ))}
              </div>
            )}

            {/* RFID status filter */}
            {activeTab === "rfid" && (
              <div className="flex rounded-xl border border-slate-700 overflow-hidden text-xs font-semibold">
                {["all", "ACTIVE", "LOW_BATTERY", "MISSING"].map(f => (
                  <button key={f} onClick={() => setRfidFilter(f === "all" ? "all" : f.toLowerCase())}
                    className={`px-3 py-2 transition-colors capitalize ${rfidFilter === (f === "all" ? "all" : f.toLowerCase()) ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                    {f === "all" ? "All" : f === "ACTIVE" ? "Active" : f === "LOW_BATTERY" ? "Low Bat" : "Missing"}
                  </button>
                ))}
              </div>
            )}

            {/* Layer toggles for map */}
            {activeTab === "map" && mapboxToken && (
              <div className="flex items-center gap-1.5 text-xs">
                <button onClick={() => setShowLayers(l => ({ ...l, gps: !l.gps }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${showLayers.gps ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                  <MapPin className="h-3 w-3" />GPS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto p-4 pb-10">

          {/* ══════════════ MAP TAB ══════════════ */}
          {activeTab === "map" && (
            <div className="mt-2">
              {assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
                    <Box className="h-10 w-10 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-300 mb-2">No Assets Found</h3>
                  <p className="text-slate-500 text-sm max-w-sm mb-6">Create assets first, then pin their locations here.</p>
                  <Button onClick={() => router.push('/assets')} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <ArrowUpRight className="h-4 w-4" /> Go to Assets
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: isMobile ? "auto" : "calc(100vh - 330px)", minHeight: "540px" }}>

                  {/* Sidebar */}
                  <div className="lg:col-span-1 order-2 lg:order-1 flex flex-col rounded-2xl border border-slate-700 bg-slate-900/80 overflow-hidden" style={{ maxHeight: isMobile ? "280px" : "100%" }}>
                    <div className="px-4 py-3 border-b border-slate-700/60 shrink-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-200">Asset Panel</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-emerald-400 font-semibold">{mappedAssets.length} GPS</span>
                          {rfidAssets.filter(t => t.asset).length > 0 && (
                            <span className="text-cyan-400 font-semibold">{rfidAssets.filter(t => t.asset).length} RFID</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                      {filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-sm">
                          <Search className="h-6 w-6 mb-2" />No results
                        </div>
                      ) : filteredAssets.map(asset => {
                        const cfg = getCfg(asset.status);
                        const rfid = rfidMap.get(asset.id);
                        const rfidCfg = rfid ? RFID_STATUS[rfid.status] || RFID_STATUS.INACTIVE : null;
                        return (
                          <div key={asset.id}
                            className={`rounded-xl border p-3 transition-all duration-150 cursor-pointer ${selectedAsset?.id === asset.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800'}`}
                            onClick={() => asset.hasGps ? focusOnAsset(asset) : openSetLocation(asset)}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                {asset.name[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-200 text-sm truncate">{asset.name}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {asset.hasGps && (
                                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-0.5">
                                      <MapPin className="h-2.5 w-2.5" />GPS
                                    </span>
                                  )}
                                  {rfid && rfidCfg && (
                                    <span className={`text-[10px] font-semibold ${rfidCfg.color} flex items-center gap-0.5`}>
                                      <Radio className="h-2.5 w-2.5" />
                                      {rfid.zone?.name || "RFID"}
                                    </span>
                                  )}
                                  {!asset.hasGps && !rfid && (
                                    <span className="text-[10px] font-semibold text-amber-400">Not pinned</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              {asset.hasGps ? (
                                <button onClick={e => { e.stopPropagation(); focusOnAsset(asset); }}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors">
                                  Focus
                                </button>
                              ) : (
                                <button onClick={e => { e.stopPropagation(); openSetLocation(asset); }}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/80 hover:bg-amber-500 text-white transition-colors">
                                  Pin to Map
                                </button>
                              )}
                              <button onClick={e => { e.stopPropagation(); openSetLocation(asset); }}
                                className="px-2 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                                <MapPin className="h-3 w-3" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); handleViewDetails(asset.id); }}
                                className="px-2 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                                <Eye className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* RFID mini-alerts */}
                    {(stats.rfidMissing > 0 || stats.rfidLowBat > 0) && (
                      <div className="border-t border-slate-700/60 p-3 space-y-2 shrink-0">
                        {stats.rfidMissing > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="h-3.5 w-3.5 text-red-400 animate-pulse shrink-0" />
                            <span className="text-xs text-red-300 font-semibold">{stats.rfidMissing} missing asset{stats.rfidMissing !== 1 ? "s" : ""}</span>
                            <button onClick={() => setActiveTab("rfid")} className="ml-auto text-[10px] text-red-400 hover:text-red-300 font-bold">
                              View →
                            </button>
                          </div>
                        )}
                        {stats.rfidLowBat > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <BatteryLow className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-300 font-semibold">{stats.rfidLowBat} low battery</span>
                            <button onClick={() => setActiveTab("rfid")} className="ml-auto text-[10px] text-amber-400 hover:text-amber-300 font-bold">
                              View →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Map */}
                  <div className="lg:col-span-3 order-1 lg:order-2 rounded-2xl overflow-hidden border border-slate-700" style={{ height: isMobile ? "380px" : "100%" }}>
                    {mapboxToken ? (
                      <Map {...viewState} onMove={evt => setViewState(evt.viewState)}
                        mapboxAccessToken={mapboxToken} style={{ width: "100%", height: "100%" }}
                        mapStyle="mapbox://styles/mapbox/dark-v11" touchZoomRotate dragRotate={false}>
                        <NavigationControl position="top-right" />
                        <ScaleControl position="bottom-left" unit="metric" />

                        {/* GPS markers */}
                        {mappedAssets.map(asset => {
                          const cfg = getCfg(asset.status);
                          const rfid = rfidMap.get(asset.id);
                          const isSelected = selectedAsset?.id === asset.id;
                          return (
                            <Marker key={asset.id} latitude={asset.location!.latitude} longitude={asset.location!.longitude}
                              onClick={e => { e.originalEvent.stopPropagation(); focusOnAsset(asset); }}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`relative cursor-pointer transition-all duration-200 hover:scale-110 ${isSelected ? 'scale-125' : ''}`}>
                                      <div className={`w-10 h-10 ${cfg.bg} rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xl border-2 ${isSelected ? 'border-white' : 'border-transparent'}`}>
                                        {asset.name[0]?.toUpperCase()}
                                      </div>
                                      {/* RFID indicator dot */}
                                      {rfid && (
                                        <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${rfid.status === 'ACTIVE' ? 'bg-cyan-500' : rfid.status === 'LOW_BATTERY' ? 'bg-amber-500' : rfid.status === 'MISSING' ? 'bg-red-500' : 'bg-slate-500'}`}>
                                          <Radio className="h-2 w-2 text-white" />
                                        </div>
                                      )}
                                      {(asset.status === 'CRITICAL' || asset.status === 'DAMAGED') && (
                                        <span className="absolute inset-0 rounded-full animate-ping opacity-40 bg-rose-500" />
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="bg-slate-800 text-slate-200 border-slate-700">
                                    <p className="font-semibold">{asset.name}</p>
                                    <p className="text-xs text-slate-400">{cfg.label}{rfid ? ` · RFID ${rfid.zone?.name || ''}` : ''}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Marker>
                          );
                        })}

                        {/* Popup */}
                        {selectedAsset && showPopup && selectedAsset.hasGps && selectedAsset.location && (
                          <Popup latitude={selectedAsset.location.latitude} longitude={selectedAsset.location.longitude}
                            onClose={() => setShowPopup(false)} closeButton closeOnClick={false} maxWidth="320px" className="asset-popup">
                            <div className="p-4 min-w-60" style={{ background: "#0f172a" }}>
                              {/* Header */}
                              <div className="flex items-start gap-2 mb-3">
                                <div className={`w-9 h-9 rounded-xl ${getCfg(selectedAsset.status).bg} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                                  {selectedAsset.name[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-white text-sm truncate">{selectedAsset.name}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCfg(selectedAsset.status).bg} text-white`}>
                                    {getCfg(selectedAsset.status).label}
                                  </span>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="text-slate-400 hover:text-white p-1 shrink-0"><MoreHorizontal className="h-4 w-4" /></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                    <DropdownMenuItem className="text-slate-200 hover:bg-slate-700" onClick={() => handleViewDetails(selectedAsset.id)}>
                                      <Eye className="h-4 w-4 mr-2" />View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-slate-200 hover:bg-slate-700" onClick={() => openSetLocation(selectedAsset)}>
                                      <MapPin className="h-4 w-4 mr-2" />Update GPS
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-slate-200 hover:bg-slate-700"
                                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedAsset.location!.latitude},${selectedAsset.location!.longitude}`, '_blank')}>
                                      <ExternalLink className="h-4 w-4 mr-2" />Google Maps
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-slate-200 hover:bg-slate-700"
                                      onClick={() => { navigator.clipboard.writeText(`${selectedAsset.location!.latitude},${selectedAsset.location!.longitude}`); toast({ title: "Coordinates copied" }); }}>
                                      <Share2 className="h-4 w-4 mr-2" />Copy Coords
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-slate-700" />
                                    <DropdownMenuItem className="text-red-400 hover:bg-slate-700"
                                      onClick={() => { setAssetToReport(selectedAsset); setReportIssueOpen(true); setShowPopup(false); }}>
                                      <AlertCircle className="h-4 w-4 mr-2" />Report Issue
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* RFID zone info */}
                              {rfidMap.has(selectedAsset.id) && (() => {
                                const rfid = rfidMap.get(selectedAsset.id)!;
                                const rfidCfg = RFID_STATUS[rfid.status] || RFID_STATUS.INACTIVE;
                                return (
                                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 border ${rfidCfg.bg}`}>
                                    <Radio className={`h-3.5 w-3.5 ${rfidCfg.color} shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-bold ${rfidCfg.color}`}>RFID · {rfidCfg.label}</p>
                                      <p className="text-[11px] text-slate-400 truncate">{rfid.zone?.name || "No zone"} · {fmtAgo(rfid.lastSeenAt)}</p>
                                    </div>
                                    {rfid.batteryLevel !== null && (
                                      <span className={`text-xs font-bold ${rfid.batteryLevel < 20 ? 'text-red-400' : rfid.batteryLevel < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{rfid.batteryLevel}%</span>
                                    )}
                                  </div>
                                );
                              })()}

                              {selectedAsset.location?.address && (
                                <p className="text-xs text-slate-400 flex items-start gap-1.5 mb-2">
                                  <MapPin className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                                  {selectedAsset.location.address}
                                </p>
                              )}
                              {(selectedAsset.floorNumber || selectedAsset.roomNumber) && (
                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-2">
                                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                                  {selectedAsset.floorNumber && `Floor ${selectedAsset.floorNumber}`}
                                  {selectedAsset.floorNumber && selectedAsset.roomNumber && " · "}
                                  {selectedAsset.roomNumber && `Room ${selectedAsset.roomNumber}`}
                                </p>
                              )}
                              <p className="text-xs text-slate-600 font-mono mb-3">
                                {selectedAsset.location.latitude.toFixed(5)}, {selectedAsset.location.longitude.toFixed(5)}
                              </p>
                              <div className="flex gap-2">
                                <button onClick={() => handleViewDetails(selectedAsset.id)}
                                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                                  View Details
                                </button>
                                <button onClick={() => openSetLocation(selectedAsset)}
                                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                                  Update GPS
                                </button>
                              </div>
                            </div>
                          </Popup>
                        )}
                      </Map>
                    ) : (
                      <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
                        <MapIcon className="h-12 w-12 text-amber-400 mb-4" />
                        <h3 className="text-lg font-bold text-slate-200 mb-2">Map Unavailable</h3>
                        <p className="text-slate-500 text-sm mb-4">Missing <code className="text-amber-400">NEXT_PUBLIC_MAPBOX_TOKEN</code></p>
                        <Button size="sm" variant="outline" className="border-slate-700 text-slate-300" onClick={() => setActiveTab("list")}>
                          <List className="h-4 w-4 mr-2" />Switch to List View
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Legend */}
              {mappedAssets.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />{cfg.label}
                      </div>
                    ))}
                  </div>
                  {rfidAssets.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-cyan-400 ml-auto">
                      <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 flex items-center justify-center"><Radio className="h-2 w-2 text-white" /></div>
                      = RFID tracked asset
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ RFID LIVE TAB ══════════════ */}
          {activeTab === "rfid" && (
            <div className="mt-4 space-y-4">
              {/* RFID header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <Radio className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-200">RFID Live Tracking</h2>
                    <p className="text-xs text-slate-500">
                      {rfidLastRefresh ? `Last updated ${fmtAgo(rfidLastRefresh.toISOString())}` : "Fetching…"}
                      <span className="ml-2 text-cyan-400">· Auto-refresh every 30s</span>
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 gap-2" onClick={fetchRfid} disabled={rfidLoading}>
                  <RefreshCw className={`h-4 w-4 ${rfidLoading ? "animate-spin" : ""}`} />
                  Refresh Now
                </Button>
              </div>

              {/* RFID stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Tags", value: rfidAssets.length, color: "text-white", icon: Radio },
                  { label: "Active", value: rfidAssets.filter(t => t.status === 'ACTIVE').length, color: "text-emerald-400", icon: Wifi },
                  { label: "Low Battery", value: stats.rfidLowBat, color: "text-amber-400", icon: BatteryLow },
                  { label: "Missing", value: stats.rfidMissing, color: "text-red-400", icon: AlertCircle },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                    </div>
                    <p className={`text-3xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tags grid */}
              {rfidLoading && filteredRfid.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl bg-slate-800/60" />)}
                </div>
              ) : filteredRfid.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-6 rounded-3xl bg-slate-800 border border-slate-700 mb-5">
                    <Radio className="h-12 w-12 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-300 mb-2">No RFID Tags Found</h3>
                  <p className="text-slate-500 text-sm max-w-sm mb-5">
                    {rfidAssets.length === 0
                      ? "No RFID tags are currently registered. Set up tags in the RFID system."
                      : "No tags match your current filters."}
                  </p>
                  <Button onClick={() => router.push('/rfid')} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
                    <Radio className="h-4 w-4" />Go to RFID System
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredRfid.map(tag => (
                    <RFIDTagCard key={tag.tagId} tag={tag} onViewAsset={handleViewDetails} />
                  ))}
                </div>
              )}

              {/* Link to RFID page */}
              <div className="flex justify-center pt-4">
                <Button variant="outline" className="border-slate-700 text-slate-300 gap-2" onClick={() => router.push('/rfid')}>
                  <ExternalLink className="h-4 w-4" />Open Full RFID Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════ ALL ASSETS LIST TAB ══════════════ */}
          {activeTab === "list" && (
            <div className="mt-4 space-y-3">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Showing <span className="font-bold text-white">{filteredAssets.length}</span> of {assets.length} assets
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> GPS</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> RFID</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Floor/Room</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> None</span>
                </div>
              </div>

              {filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Search className="h-12 w-12 text-slate-600 mb-4" />
                  <p className="text-slate-400 font-semibold">No assets match your filters</p>
                  <button onClick={() => { setSearchQuery(""); setStatusFilter(null); setGpsFilter("all"); }} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">Clear filters</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAssets.map(asset => (
                    <AssetListRow key={asset.id} asset={asset} rfidMap={rfidMap}
                      onFocus={a => { setActiveTab("map"); focusOnAsset(a); }}
                      onPin={openSetLocation}
                      onDetails={handleViewDetails} />
                  ))}
                </div>
              )}

              {/* Untracked assets section */}
              {stats.noLocation > 0 && gpsFilter === "all" && (
                <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-300 text-sm">{stats.noLocation} asset{stats.noLocation !== 1 ? "s" : ""} with no location data</h3>
                      <p className="text-xs text-amber-400/70">These assets have no GPS, RFID, or floor/room assigned.</p>
                    </div>
                    <Button size="sm" className="ml-auto bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shrink-0"
                      onClick={() => setGpsFilter("unpinned")}>
                      <Plus className="h-3.5 w-3.5" />Pin Assets
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .asset-popup .mapboxgl-popup-content { background: transparent; padding: 0; box-shadow: 0 25px 50px rgba(0,0,0,0.7); border-radius: 16px; overflow: hidden; border: 1px solid rgba(148,163,184,0.12); }
        .asset-popup .mapboxgl-popup-close-button { color: #94a3b8; font-size: 18px; padding: 4px 8px; background: transparent; }
        .asset-popup .mapboxgl-popup-close-button:hover { color: white; }
        .asset-popup .mapboxgl-popup-tip { border-top-color: #0f172a; }
      `}</style>
    </DashboardLayout>
  );
}
