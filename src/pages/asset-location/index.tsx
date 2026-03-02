// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import {
  MapPin, Building, DollarSign, Info,
  Search, Filter, List, Map as MapIcon,
  Eye, History, MoreHorizontal,
  Activity, AlertCircle, Box, Truck,
  CheckCircle2, Clock, AlertTriangle, XCircle, MoveHorizontal,
  ExternalLink, RefreshCw, Zap, Package, Star, Wrench,
  ArrowUpRight, X, Navigation, Target, Crosshair, Plus,
  Check, Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AssetLocationDetailsDialog } from "@/components/AssetLocationDetailsDialog";
import { AssetMoveDialog } from "@/components/AssetMoveDialog";
import { AssetBulkActionsDialog } from "@/components/AssetBulkActionsDialog";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Asset {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type?: string;
  hasGps: boolean;
  location?: {
    id: string;
    latitude: number;
    longitude: number;
    address: string | null;
    accuracy?: number | null;
    source?: string | null;
    updatedAt?: string;
  } | null;
  floorNumber: string | null;
  roomNumber: string | null;
  purchaseAmount: number | null;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string | null;
  assetId?: string | null;
}

// ─── Status Config (matches Prisma AssetStatus enum) ─────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; ring: string; dot: string; icon: any }> = {
  ACTIVE:      { label: "Active",      bg: "bg-emerald-500", ring: "ring-emerald-500/40", dot: "bg-emerald-400", icon: CheckCircle2 },
  IN_TRANSIT:  { label: "In Transit",  bg: "bg-blue-500",    ring: "ring-blue-500/40",    dot: "bg-blue-400",    icon: Truck },
  MAINTENANCE: { label: "Maintenance", bg: "bg-amber-500",   ring: "ring-amber-500/40",   dot: "bg-amber-400",   icon: Wrench },
  DISPOSED:    { label: "Disposed",    bg: "bg-red-500",     ring: "ring-red-500/40",     dot: "bg-red-400",     icon: XCircle },
  DAMAGED:     { label: "Damaged",     bg: "bg-orange-500",  ring: "ring-orange-500/40",  dot: "bg-orange-400",  icon: AlertTriangle },
  CRITICAL:    { label: "Critical",    bg: "bg-rose-500",    ring: "ring-rose-500/40",    dot: "bg-rose-400",    icon: AlertCircle },
  LIKE_NEW:    { label: "Like New",    bg: "bg-teal-500",    ring: "ring-teal-500/40",    dot: "bg-teal-400",    icon: Star },
};
const getStatusCfg = (s: string) => STATUS_CONFIG[s] || { label: s, bg: "bg-slate-500", ring: "ring-slate-500/40", dot: "bg-slate-400", icon: Box };

const statusLabels: Record<string, string> = Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label]));
const statusColors: Record<string, string> = Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.bg]));

// ─── Set Location Dialog ──────────────────────────────────────────────────────
function SetLocationDialog({ asset, open, onOpenChange, onSaved, mapboxToken }: {
  asset: Asset | null; open: boolean; onOpenChange: (v: boolean) => void;
  onSaved: () => void; mapboxToken: string;
}) {
  const { toast } = useToast();
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [mapClickMode, setMapClickMode] = useState(false);
  const [previewState, setPreviewState] = useState({ latitude: 25.2867, longitude: 51.5333, zoom: 10 });
  const [pinPos, setPinPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!open) { setLat(""); setLng(""); setAddress(""); setPinPos(null); setMapClickMode(false); }
    if (open && asset?.location) {
      setLat(String(asset.location.latitude));
      setLng(String(asset.location.longitude));
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
        setLat(latitude.toFixed(6));
        setLng(longitude.toFixed(6));
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
    setLat(lngLat.lat.toFixed(6));
    setLng(lngLat.lng.toFixed(6));
    setPinPos({ lat: lngLat.lat, lng: lngLat.lng });
    setMapClickMode(false);
  };

  const handleSave = async () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      toast({ title: "Invalid coordinates", description: "Enter valid latitude and longitude.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset?.id}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, address: address || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast({ title: "Location saved", description: `${asset?.name} pinned to map.` });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!asset) return null;
  const cfg = getStatusCfg(asset.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-0" style={{ background: "#0f172a" }}>
        <div className="px-6 pt-6 pb-4 border-b border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center text-white text-xs font-bold`}>
                {asset.name[0]?.toUpperCase()}
              </div>
              Set GPS Location — {asset.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Pin this asset on the map by detecting your GPS, clicking on the map, or entering coordinates manually.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* GPS buttons row */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={detectGps}
              disabled={detecting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {detecting ? "Detecting GPS..." : "Use My GPS Location"}
            </button>
            {mapboxToken && (
              <button
                onClick={() => setMapClickMode(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${mapClickMode ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
              >
                <Crosshair className="h-4 w-4" />
                {mapClickMode ? "Click on map to pin..." : "Click Map to Set"}
              </button>
            )}
          </div>

          {/* Mini map for visual feedback */}
          {mapboxToken && (
            <div className="rounded-xl overflow-hidden border border-slate-700" style={{ height: "220px" }}>
              <Map
                {...previewState}
                onMove={evt => setPreviewState(evt.viewState)}
                mapboxAccessToken={mapboxToken}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                cursor={mapClickMode ? "crosshair" : "grab"}
                onClick={handleMapClick}
                dragRotate={false}
              >
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

          {/* Manual input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 block">Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={e => { setLat(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) { setPinPos(p => p ? { ...p, lat: v } : { lat: v, lng: parseFloat(lng) || 0 }); setPreviewState(s => ({ ...s, latitude: v })); } }}
                placeholder="e.g. 25.2867"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 block">Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={e => { setLng(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) { setPinPos(p => p ? { ...p, lng: v } : { lat: parseFloat(lat) || 0, lng: v }); setPreviewState(s => ({ ...s, longitude: v })); } }}
                placeholder="e.g. 51.5333"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 block">Address / Location Note (optional)</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. Main Office, Floor 3"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !lat || !lng}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Location"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AssetLocation() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();
  const hasMapboxToken = mapboxToken.length > 0;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [gpsFilter, setGpsFilter] = useState<"all" | "pinned" | "unpinned">("all");
  const [viewState, setViewState] = useState({ latitude: 25.2867, longitude: 51.5333, zoom: 9 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [moveAssetOpen, setMoveAssetOpen] = useState(false);
  const [assetToMove, setAssetToMove] = useState<Asset | null>(null);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [assetToReport, setAssetToReport] = useState<Asset | null>(null);
  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [selectedAssetForDialog, setSelectedAssetForDialog] = useState<Asset | null>(null);
  const [setLocationOpen, setSetLocationOpen] = useState(false);
  const [assetForLocation, setAssetForLocation] = useState<Asset | null>(null);
  const [activeView, setActiveView] = useState<"map" | "list">("map");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();

  // Stats
  const stats = useMemo(() => {
    const pinned = assets.filter(a => a.hasGps).length;
    const bystatus: Record<string, number> = {};
    for (const a of assets) bystatus[a.status] = (bystatus[a.status] || 0) + 1;
    return { total: assets.length, pinned, unpinned: assets.length - pinned, bystatus };
  }, [assets]);

  // Filtered
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) || a.location?.address?.toLowerCase().includes(q) || a.assetId?.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || a.status === statusFilter;
      const matchesGps = gpsFilter === "all" || (gpsFilter === "pinned" && a.hasGps) || (gpsFilter === "unpinned" && !a.hasGps);
      return matchesSearch && matchesStatus && matchesGps;
    });
  }, [assets, searchQuery, statusFilter, gpsFilter]);

  // Assets with GPS (shown on map)
  const mappedAssets = useMemo(() => filteredAssets.filter(a => a.hasGps), [filteredAssets]);

  const fetchAssets = useCallback(async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else { setIsLoading(true); setError(null); }
      const res = await fetch("/api/assets/locations");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to fetch");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      setAssets(data);

      // Auto-center map on assets that have GPS
      if (!silent) {
        const gpsAssets = data.filter((a: Asset) => a.hasGps);
        if (gpsAssets.length > 0) {
          const lats = gpsAssets.map((a: Asset) => a.location!.latitude);
          const lngs = gpsAssets.map((a: Asset) => a.location!.longitude);
          setViewState({
            latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
            longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
            zoom: gpsAssets.length === 1 ? 14 : 10,
          });
        }
      }
      if (silent) toast({ title: "Refreshed", description: `${data.length} assets loaded.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (silent) toast({ title: "Refresh failed", description: msg, variant: "destructive" });
      else setError(msg);
    } finally { setIsLoading(false); setIsRefreshing(false); }
  }, [toast]);

  useEffect(() => { fetchAssets(); }, []);

  const focusOnAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowPopup(true);
    if (asset.hasGps && asset.location) {
      setViewState(prev => ({ ...prev, latitude: asset.location!.latitude, longitude: asset.location!.longitude, zoom: 15 }));
    }
    if (isMobile) setActiveView("map");
  };

  const openSetLocation = (asset: Asset) => {
    setAssetForLocation(asset);
    setSetLocationOpen(true);
  };

  const handleViewDetails = (assetId: string) => {
    const a = assets.find(x => x.id === assetId);
    if (a) { setSelectedAssetForDialog(a); setAssetDetailsOpen(true); }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <DashboardLayout>
      <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
        <div className="p-6 space-y-4">
          <div className="h-32 rounded-2xl bg-slate-800/60 animate-pulse border border-slate-700" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-800/60 animate-pulse rounded-2xl border border-slate-700" />)}
          </div>
          <div className="h-[500px] rounded-2xl bg-slate-800/60 animate-pulse border border-slate-700" />
        </div>
      </div>
    </DashboardLayout>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) return (
    <DashboardLayout>
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Failed to Load Assets</h3>
          <p className="text-red-300 text-sm mb-6">{error}</p>
          <Button onClick={() => fetchAssets()} className="bg-red-500 hover:bg-red-600 gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <AssetLocationDetailsDialog asset={selectedAssetForDialog} open={assetDetailsOpen} onOpenChange={setAssetDetailsOpen} statusLabels={statusLabels} statusColors={statusColors} />
      {assetToMove && (
        <AssetMoveDialog
          asset={{ id: assetToMove.id, name: assetToMove.name, floorNumber: assetToMove.floorNumber, roomNumber: assetToMove.roomNumber }}
          open={moveAssetOpen} onOpenChange={setMoveAssetOpen}
          onAssetMoved={() => { fetchAssets(true); setMoveAssetOpen(false); setAssetToMove(null); }}
        />
      )}
      <AssetBulkActionsDialog assets={assets} selectedAssets={selectedAssets} open={bulkActionsOpen} onOpenChange={setBulkActionsOpen} onActionComplete={() => { fetchAssets(true); setSelectedAssets([]); setBulkActionsOpen(false); }} />
      <CreateTicketDialog open={reportIssueOpen} onOpenChange={setReportIssueOpen} onTicketCreated={() => { setReportIssueOpen(false); setAssetToReport(null); }} assetId={assetToReport?.id} />
      <SetLocationDialog asset={assetForLocation} open={setLocationOpen} onOpenChange={setSetLocationOpen} onSaved={() => fetchAssets(true)} mapboxToken={mapboxToken} />

      <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)" }}>

        {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 70%, #1e40af 100%)" }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #a78bfa, transparent 70%)" }} />
            <div className="absolute -bottom-12 -left-12 w-72 h-72 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #60a5fa, transparent 70%)" }} />
          </div>
          <div className="relative z-10 px-6 py-10 max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                    <MapPin className="h-6 w-6 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest">Operations Center</p>
                    <h1 className="text-3xl font-black text-white">Asset Location</h1>
                  </div>
                </div>
                <p className="text-indigo-200/80 text-sm max-w-lg">
                  Real-time visibility across your entire asset fleet. Pin assets to the map, track their locations, and monitor status with precision.
                </p>
              </div>
              {/* Stat tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                {[
                  { label: "Total Assets", value: stats.total, sub: "in system", border: "border-indigo-500/30" },
                  { label: "On Map", value: stats.pinned, sub: "GPS pinned", border: "border-emerald-500/30" },
                  { label: "Not Pinned", value: stats.unpinned, sub: "needs location", border: "border-amber-500/30" },
                  { label: "Showing", value: filteredAssets.length, sub: "after filters", border: "border-blue-500/30" },
                ].map(tile => (
                  <div key={tile.label} className={`rounded-2xl p-4 border ${tile.border} bg-slate-900/50 backdrop-blur-sm`}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">{tile.label}</p>
                    <p className="text-3xl font-black text-white">{tile.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{tile.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-2 mt-5">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = stats.bystatus[key] || 0;
                if (count === 0) return null;
                const StatusIcon = cfg.icon;
                return (
                  <button key={key} onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${statusFilter === key ? `${cfg.bg} text-white border-transparent` : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20'}`}>
                    <StatusIcon className="h-3 w-3" /> {cfg.label}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full ${statusFilter === key ? 'bg-white/30' : 'bg-white/10'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 border-b border-slate-800" style={{ background: "rgba(15,23,42,0.97)", backdropFilter: "blur(16px)" }}>
          <div className="px-4 py-3 max-w-7xl mx-auto flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search assets, addresses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
            </div>

            {/* GPS filter */}
            <div className="flex rounded-xl border border-slate-700 overflow-hidden text-xs font-semibold">
              {(["all", "pinned", "unpinned"] as const).map(f => (
                <button key={f} onClick={() => setGpsFilter(f)} className={`px-3 py-2 transition-colors capitalize ${gpsFilter === f ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                  {f === "all" ? "All" : f === "pinned" ? "On Map" : "Not Pinned"}
                </button>
              ))}
            </div>

            {/* Map/List toggle */}
            <div className="flex rounded-xl border border-slate-700 overflow-hidden text-xs font-semibold">
              <button onClick={() => setActiveView("map")} className={`px-3 py-2 flex items-center gap-1.5 transition-colors ${activeView === "map" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                <MapIcon className="h-3.5 w-3.5" /> Map
              </button>
              <button onClick={() => setActiveView("list")} className={`px-3 py-2 flex items-center gap-1.5 transition-colors ${activeView === "list" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>

            {selectedAssets.length > 0 && (
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setBulkActionsOpen(true)}>
                Bulk ({selectedAssets.length})
              </Button>
            )}

            <Button size="sm" variant="outline" className="gap-1.5 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => fetchAssets(true)} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto p-4 pb-10">

          {/* ── Empty state (no assets at all) ─────────────────────────────────── */}
          {assets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
                <Box className="h-10 w-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">No Assets Found</h3>
              <p className="text-slate-500 text-sm max-w-sm mb-6">No assets found in your organization. Create assets first, then pin their locations here.</p>
              <Button onClick={() => router.push('/assets')} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <ArrowUpRight className="h-4 w-4" /> Go to Assets
              </Button>
            </div>
          )}

          {/* ── Notice when assets exist but none have GPS ──────────────────────── */}
          {assets.length > 0 && mappedAssets.length === 0 && activeView === "map" && gpsFilter !== "unpinned" && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Target className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-bold text-amber-300 mb-1">No Assets Pinned to Map Yet</h3>
                <p className="text-amber-400/70 text-sm">
                  You have <strong className="text-amber-300">{assets.length} asset{assets.length !== 1 ? "s" : ""}</strong> but none have GPS coordinates set.
                  Use the <strong>"Pin to Map"</strong> button on any asset to add its location.
                </p>
              </div>
              <Button onClick={() => setGpsFilter("unpinned")} className="bg-amber-500 hover:bg-amber-600 text-white shrink-0 gap-2">
                <Plus className="h-4 w-4" /> Pin Assets
              </Button>
            </div>
          )}

          {assets.length > 0 && (
            activeView === "list" ? (
              // ── List View ──────────────────────────────────────────────────────
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAssets.map(asset => {
                  const cfg = getStatusCfg(asset.status);
                  return (
                    <div key={asset.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-hidden hover:border-indigo-500/50 transition-all group">
                      <div className={`h-1.5 ${cfg.bg}`} />
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                            {asset.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {asset.hasGps ? (
                              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <MapPin className="h-2.5 w-2.5" /> Pinned
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                <X className="h-2.5 w-2.5" /> Not Pinned
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-200 truncate">{asset.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} text-white`}>{cfg.label}</span>
                        </div>
                        {asset.location?.address && (
                          <p className="text-xs text-slate-500 flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{asset.location.address}</span>
                          </p>
                        )}
                        {(asset.floorNumber || asset.roomNumber) && (
                          <p className="text-xs text-slate-600 flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {asset.floorNumber && `Floor ${asset.floorNumber}`}
                            {asset.floorNumber && asset.roomNumber && " · "}
                            {asset.roomNumber && `Room ${asset.roomNumber}`}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button onClick={() => openSetLocation(asset)}
                            className={`py-2 rounded-xl text-xs font-semibold transition-colors ${asset.hasGps ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {asset.hasGps ? "Update GPS" : "Pin to Map"}
                          </button>
                          <button onClick={() => handleViewDetails(asset.id)}
                            className="py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
                            <Eye className="h-3 w-3 inline mr-1" /> Details
                          </button>
                        </div>
                        {asset.hasGps && (
                          <button onClick={() => { focusOnAsset(asset); setActiveView("map"); }}
                            className="w-full py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 transition-colors">
                            <MapIcon className="h-3 w-3 inline mr-1" /> Show on Map
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredAssets.length === 0 && (
                  <div className="col-span-full text-center py-16 text-slate-500">
                    <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No assets match your filters</p>
                  </div>
                )}
              </div>
            ) : (
              // ── Map View ────────────────────────────────────────────────────────
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: isMobile ? "auto" : "calc(100vh - 320px)", minHeight: "520px" }}>

                {/* Sidebar */}
                <div className="lg:col-span-1 order-2 lg:order-1 flex flex-col rounded-2xl border border-slate-700 bg-slate-900/80 overflow-hidden" style={{ maxHeight: isMobile ? "280px" : "100%" }}>
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
                    <p className="text-sm font-bold text-slate-200">Assets</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-400 font-semibold">{mappedAssets.length} on map</span>
                      {stats.unpinned > 0 && <span className="text-xs text-amber-400">{stats.unpinned} not pinned</span>}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredAssets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-sm">
                        <Search className="h-6 w-6 mb-2" /> No assets found
                      </div>
                    ) : filteredAssets.map(asset => {
                      const cfg = getStatusCfg(asset.status);
                      return (
                        <div key={asset.id}
                          className={`rounded-xl border p-3 transition-all duration-150 ${selectedAsset?.id === asset.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                              {asset.name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-200 text-sm truncate">{asset.name}</p>
                              <p className={`text-xs font-medium ${asset.hasGps ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {asset.hasGps ? "📍 On map" : "⚠ Not pinned"}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {asset.hasGps ? (
                              <button onClick={() => focusOnAsset(asset)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors">
                                Focus
                              </button>
                            ) : (
                              <button onClick={() => openSetLocation(asset)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/80 hover:bg-amber-500 text-white transition-colors">
                                Pin to Map
                              </button>
                            )}
                            <button onClick={() => handleViewDetails(asset.id)} className="px-2 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                              <Eye className="h-3 w-3" />
                            </button>
                            <button onClick={() => openSetLocation(asset)} className="px-2 py-1.5 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                              <MapPin className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Map */}
                <div className="lg:col-span-3 order-1 lg:order-2 rounded-2xl overflow-hidden border border-slate-700" style={{ height: isMobile ? "360px" : "100%" }}>
                  {hasMapboxToken ? (
                    <Map
                      {...viewState}
                      onMove={evt => setViewState(evt.viewState)}
                      mapboxAccessToken={mapboxToken}
                      style={{ width: "100%", height: "100%" }}
                      mapStyle="mapbox://styles/mapbox/dark-v11"
                      touchZoomRotate={true}
                      dragRotate={false}
                    >
                      <NavigationControl position="top-right" />

                      {mappedAssets.map(asset => {
                        const cfg = getStatusCfg(asset.status);
                        return (
                          <Marker
                            key={asset.id}
                            latitude={asset.location!.latitude}
                            longitude={asset.location!.longitude}
                            onClick={e => { e.originalEvent.stopPropagation(); focusOnAsset(asset); }}
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`relative w-10 h-10 ${cfg.bg} rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xl border-2 cursor-pointer transition-all duration-200 hover:scale-110 ${selectedAsset?.id === asset.id ? 'border-white scale-125' : 'border-transparent'}`}>
                                    {asset.name[0]?.toUpperCase()}
                                    {(asset.status === 'CRITICAL' || asset.status === 'DAMAGED') && (
                                      <span className="absolute inset-0 rounded-full animate-ping opacity-50 bg-rose-500" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-slate-800 text-slate-200 border-slate-700">
                                  <p className="font-semibold">{asset.name}</p>
                                  <p className="text-xs">{cfg.label}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Marker>
                        );
                      })}

                      {selectedAsset && showPopup && selectedAsset.hasGps && selectedAsset.location && (
                        <Popup
                          latitude={selectedAsset.location.latitude}
                          longitude={selectedAsset.location.longitude}
                          onClose={() => setShowPopup(false)}
                          closeButton={true}
                          closeOnClick={false}
                          maxWidth="300px"
                          className="asset-popup"
                        >
                          <div className="p-4 min-w-56" style={{ background: "#0f172a" }}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg ${getStatusCfg(selectedAsset.status).bg} flex items-center justify-center text-white text-xs font-bold`}>
                                  {selectedAsset.name[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-white text-sm">{selectedAsset.name}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${getStatusCfg(selectedAsset.status).bg} text-white`}>
                                    {getStatusCfg(selectedAsset.status).label}
                                  </span>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="text-slate-400 hover:text-white p-1"><MoreHorizontal className="h-4 w-4" /></button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                  <DropdownMenuItem className="text-slate-200 hover:bg-slate-700" onClick={() => handleViewDetails(selectedAsset.id)}>
                                    <Eye className="h-4 w-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-slate-200 hover:bg-slate-700" onClick={() => openSetLocation(selectedAsset)}>
                                    <MapPin className="h-4 w-4 mr-2" /> Update Location
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-slate-200 hover:bg-slate-700"
                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedAsset.location!.latitude},${selectedAsset.location!.longitude}`, '_blank')}>
                                    <ExternalLink className="h-4 w-4 mr-2" /> Google Maps
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-700" />
                                  <DropdownMenuItem className="text-red-400 hover:bg-slate-700" onClick={() => { setAssetToReport(selectedAsset); setReportIssueOpen(true); setShowPopup(false); }}>
                                    <AlertCircle className="h-4 w-4 mr-2" /> Report Issue
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {selectedAsset.location.address && (
                              <p className="text-xs text-slate-400 flex items-start gap-1.5 mb-2">
                                <MapPin className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                                {selectedAsset.location.address}
                              </p>
                            )}
                            {(selectedAsset.floorNumber || selectedAsset.roomNumber) && (
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-2">
                                <Building className="h-3.5 w-3.5 shrink-0" />
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
                      <Button size="sm" variant="outline" className="border-slate-700 text-slate-300" onClick={() => setActiveView("list")}>
                        <List className="h-4 w-4 mr-2" /> Switch to List View
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Legend */}
          {activeView === "map" && mappedAssets.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 px-1">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />
                  {cfg.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .asset-popup .mapboxgl-popup-content {
          background: transparent;
          padding: 0;
          box-shadow: 0 25px 50px rgba(0,0,0,0.6);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.15);
        }
        .asset-popup .mapboxgl-popup-close-button {
          color: #94a3b8;
          font-size: 18px;
          padding: 4px 8px;
          background: transparent;
        }
        .asset-popup .mapboxgl-popup-close-button:hover { color: white; }
        .asset-popup .mapboxgl-popup-tip { border-top-color: #0f172a; }
      `}</style>
    </DashboardLayout>
  );
}
