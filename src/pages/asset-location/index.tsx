// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import {
  MapPin, Navigation, Building, DollarSign,
  Calendar, Info, Search, Filter, List, Map as MapIcon,
  Edit, Eye, History, MoreHorizontal,
  Activity, AlertCircle, Box, Truck, Settings,
  CheckCircle2, Clock, AlertTriangle, XCircle, MoveHorizontal,
  CheckSquare, Square, LocateFixed, ExternalLink,
  ChevronUp, ChevronDown, RefreshCw, Layers, Zap,
  Package, Star, Wrench, Shield, ArrowUpRight,
  X, SlidersHorizontal
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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

// Qatar bounds
const QATAR_BOUNDS = {
  maxLat: 26.4,
  minLat: 24.4,
  maxLng: 52.0,
  minLng: 50.7
};

interface Asset {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type?: string;
  location: {
    id: string;
    latitude: number;
    longitude: number;
    address: string | null;
    accuracy?: number | null;
    source?: string | null;
    updatedAt?: string;
  };
  floorNumber: string | null;
  roomNumber: string | null;
  purchaseAmount: number | null;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string | null;
  assetId?: string | null;
}

// Correct AssetStatus enum from Prisma schema
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: any }> = {
  ACTIVE:       { label: "Active",       color: "text-emerald-400", bg: "bg-emerald-500",     dot: "bg-emerald-400", icon: CheckCircle2 },
  IN_TRANSIT:   { label: "In Transit",   color: "text-blue-400",    bg: "bg-blue-500",        dot: "bg-blue-400",    icon: Truck },
  MAINTENANCE:  { label: "Maintenance",  color: "text-amber-400",   bg: "bg-amber-500",       dot: "bg-amber-400",   icon: Wrench },
  DISPOSED:     { label: "Disposed",     color: "text-red-400",     bg: "bg-red-500",         dot: "bg-red-400",     icon: XCircle },
  DAMAGED:      { label: "Damaged",      color: "text-orange-400",  bg: "bg-orange-500",      dot: "bg-orange-400",  icon: AlertTriangle },
  CRITICAL:     { label: "Critical",     color: "text-rose-400",    bg: "bg-rose-500",        dot: "bg-rose-400",    icon: AlertCircle },
  LIKE_NEW:     { label: "Like New",     color: "text-teal-400",    bg: "bg-teal-500",        dot: "bg-teal-400",    icon: Star },
};

const getStatusCfg = (status: string) => STATUS_CONFIG[status] || { label: status, color: "text-slate-400", bg: "bg-slate-500", dot: "bg-slate-400", icon: Box };

const AssetTypeIcons: Record<string, any> = {
  FURNITURE: Box,
  VEHICLE: Truck,
  ELECTRONICS: Zap,
  EQUIPMENT: Settings,
  OTHER: Package,
};

// ─── Share Location Dialog ───────────────────────────────────────────────────
const ShareLocationDialog = ({ asset, open, onOpenChange }: { asset: Asset | null; open: boolean; onOpenChange: (open: boolean) => void }) => {
  if (!asset) return null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${asset.location.latitude},${asset.location.longitude}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-500" />
            Open in Google Maps
          </DialogTitle>
          <DialogDescription>View the location of <strong>{asset.name}</strong> in Google Maps.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm font-mono text-slate-600 dark:text-slate-300">
            {asset.location.latitude.toFixed(6)}, {asset.location.longitude.toFixed(6)}
          </div>
          {asset.location.address && (
            <p className="text-sm text-slate-500 flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              {asset.location.address}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => window.open(mapsUrl, '_blank')} className="gap-2">
            <ExternalLink className="h-4 w-4" /> Open in Google Maps
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Stat Tile ───────────────────────────────────────────────────────────────
const StatTile = ({ label, value, sublabel, accent }: { label: string; value: number | string; sublabel?: string; accent: string }) => (
  <div className={`rounded-2xl p-5 border ${accent} bg-slate-900/50 backdrop-blur-sm`}>
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
    <p className="text-3xl font-black text-white">{value}</p>
    {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
  </div>
);

// ─── Asset List Card ──────────────────────────────────────────────────────────
const AssetListCard = ({ asset, selected, onSelect, onFocus }: { asset: Asset; selected: boolean; onSelect: () => void; onFocus: () => void }) => {
  const cfg = getStatusCfg(asset.status);
  const StatusIcon = cfg.icon;
  return (
    <div
      className={`rounded-xl border p-3 cursor-pointer transition-all duration-200 ${selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}`}
      onClick={onFocus}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 text-white text-sm font-bold`}>
          {asset.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-200 text-sm truncate">{asset.name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} text-white shrink-0`}>{cfg.label}</span>
          </div>
          {asset.location.address && (
            <p className="text-xs text-slate-500 mt-1 truncate flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {asset.location.address}
            </p>
          )}
          {(asset.floorNumber || asset.roomNumber) && (
            <p className="text-xs text-slate-600 mt-0.5">
              {asset.floorNumber && `Floor ${asset.floorNumber}`}
              {asset.floorNumber && asset.roomNumber && ' · '}
              {asset.roomNumber && `Room ${asset.roomNumber}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AssetLocation() {
  const { t, dir } = useTranslation();
  const { toast } = useToast();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
  const hasMapboxToken = mapboxToken.length > 0;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewState, setViewState] = useState({ latitude: 25.2867, longitude: 51.5333, zoom: 9 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [moveAssetOpen, setMoveAssetOpen] = useState(false);
  const [assetToMove, setAssetToMove] = useState<Asset | null>(null);
  const [shareLocationOpen, setShareLocationOpen] = useState(false);
  const [assetToShare, setAssetToShare] = useState<Asset | null>(null);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [assetToReport, setAssetToReport] = useState<Asset | null>(null);
  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [selectedAssetForDialog, setSelectedAssetForDialog] = useState<Asset | null>(null);
  const [activeView, setActiveView] = useState<"map" | "list">("map");
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();

  const assetStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) {
      counts[a.status] = (counts[a.status] || 0) + 1;
    }
    return {
      total: assets.length,
      active: counts.ACTIVE || 0,
      inTransit: counts.IN_TRANSIT || 0,
      maintenance: counts.MAINTENANCE || 0,
      disposed: counts.DISPOSED || 0,
      damaged: counts.DAMAGED || 0,
      critical: counts.CRITICAL || 0,
      likeNew: counts.LIKE_NEW || 0,
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        asset.name.toLowerCase().includes(q) ||
        asset.description?.toLowerCase().includes(q) ||
        asset.location.address?.toLowerCase().includes(q) ||
        asset.assetId?.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || asset.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assets, searchQuery, statusFilter]);

  const fetchAssets = useCallback(async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else { setIsLoading(true); setError(null); }

      const response = await fetch("/api/assets/locations");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Failed to fetch assets");
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      setAssets(data);

      // Auto-fit map to show all markers
      if (!silent && data.length > 0) {
        const lats = data.map((a: Asset) => a.location.latitude);
        const lngs = data.map((a: Asset) => a.location.longitude);
        const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        setViewState({ latitude: midLat, longitude: midLng, zoom: data.length === 1 ? 14 : 10 });
      }

      if (silent) toast({ title: "Refreshed", description: `${data.length} assets loaded.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (silent) {
        toast({ title: "Refresh failed", description: msg, variant: "destructive" });
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchAssets(); }, []);

  const focusOnAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowPopup(true);
    setViewState(prev => ({ ...prev, latitude: asset.location.latitude, longitude: asset.location.longitude, zoom: 15 }));
    if (isMobile) setActiveView("map");
  };

  const handleViewDetails = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) { setSelectedAssetForDialog(asset); setAssetDetailsOpen(true); }
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: "Active", IN_TRANSIT: "In Transit", MAINTENANCE: "Maintenance",
    DISPOSED: "Disposed", DAMAGED: "Damaged", CRITICAL: "Critical", LIKE_NEW: "Like New",
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-500", IN_TRANSIT: "bg-blue-500", MAINTENANCE: "bg-amber-500",
    DISPOSED: "bg-red-500", DAMAGED: "bg-orange-500", CRITICAL: "bg-rose-500", LIKE_NEW: "bg-teal-500",
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <DashboardLayout>
      <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
        <div className="p-6">
          <div className="h-10 w-72 bg-slate-700 animate-pulse rounded-xl mb-2" />
          <div className="h-5 w-48 bg-slate-800 animate-pulse rounded mb-8" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-800/60 animate-pulse rounded-2xl border border-slate-700" />
            ))}
          </div>
          <div className="rounded-2xl bg-slate-800/60 animate-pulse h-[500px] border border-slate-700" />
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
          <Button onClick={() => fetchAssets()} className="bg-red-500 hover:bg-red-600 text-white gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <AssetLocationDetailsDialog
        asset={selectedAssetForDialog}
        open={assetDetailsOpen}
        onOpenChange={setAssetDetailsOpen}
        statusLabels={statusLabels}
        statusColors={statusColors}
      />
      {assetToMove && (
        <AssetMoveDialog
          asset={{ id: assetToMove.id, name: assetToMove.name, floorNumber: assetToMove.floorNumber, roomNumber: assetToMove.roomNumber }}
          open={moveAssetOpen}
          onOpenChange={setMoveAssetOpen}
          onAssetMoved={() => { fetchAssets(true); setMoveAssetOpen(false); setAssetToMove(null); }}
        />
      )}
      <AssetBulkActionsDialog
        assets={assets}
        selectedAssets={selectedAssets}
        open={bulkActionsOpen}
        onOpenChange={setBulkActionsOpen}
        onActionComplete={() => { fetchAssets(true); setSelectedAssets([]); setBulkActionsOpen(false); }}
      />
      <ShareLocationDialog asset={assetToShare} open={shareLocationOpen} onOpenChange={setShareLocationOpen} />
      <CreateTicketDialog
        open={reportIssueOpen}
        onOpenChange={setReportIssueOpen}
        onTicketCreated={() => { setReportIssueOpen(false); setAssetToReport(null); }}
        assetId={assetToReport?.id}
      />

      {/* ── Page Wrapper ─────────────────────────────────────────────────────── */}
      <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)" }}>

        {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 70%, #1e40af 100%)" }}>
          {/* Decorative blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #a78bfa, transparent 70%)" }} />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #60a5fa, transparent 70%)" }} />
            <div className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #818cf8, transparent 70%)", transform: "translate(-50%,-50%)" }} />
          </div>

          <div className="relative z-10 px-6 py-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 max-w-7xl mx-auto">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                    <MapPin className="h-6 w-6 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest">Operations Center</p>
                    <h1 className="text-3xl font-black text-white leading-tight">Asset Location</h1>
                  </div>
                </div>
                <p className="text-indigo-200/80 text-sm max-w-lg">
                  Real-time visibility across your entire asset fleet. Track locations, monitor status, and manage movements with precision.
                </p>
              </div>

              {/* Stat tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Total Assets" value={assetStats.total} sublabel="with location" accent="border-indigo-500/30" />
                <StatTile label="Active" value={assetStats.active} sublabel="operational" accent="border-emerald-500/30" />
                <StatTile label="In Transit" value={assetStats.inTransit} sublabel="on the move" accent="border-blue-500/30" />
                <StatTile label="Needs Attention" value={assetStats.maintenance + assetStats.damaged + assetStats.critical} sublabel="maintenance/damaged" accent="border-amber-500/30" />
              </div>
            </div>

            {/* Status breakdown pills */}
            <div className="flex flex-wrap gap-2 mt-6 max-w-7xl mx-auto">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = assetStats[key === 'ACTIVE' ? 'active' : key === 'IN_TRANSIT' ? 'inTransit' : key === 'LIKE_NEW' ? 'likeNew' : key.toLowerCase()] || 0;
                if (count === 0) return null;
                const StatusIcon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${statusFilter === key ? `${cfg.bg} text-white border-transparent` : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20'}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${statusFilter === key ? 'bg-white/30' : 'bg-white/10'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 border-b border-slate-800" style={{ background: "rgba(15,23,42,0.95)", backdropFilter: "blur(16px)" }}>
          <div className="px-4 py-3 max-w-7xl mx-auto flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search assets, addresses, IDs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => setActiveView("map")}
                className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold transition-colors ${activeView === "map" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
              >
                <MapIcon className="h-3.5 w-3.5" /> Map
              </button>
              <button
                onClick={() => setActiveView("list")}
                className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold transition-colors ${activeView === "list" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>

            {/* Bulk actions */}
            {selectedAssets.length > 0 && (
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setBulkActionsOpen(true)}>
                <CheckSquare className="h-4 w-4" />
                Bulk Actions ({selectedAssets.length})
              </Button>
            )}

            {/* Refresh */}
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => fetchAssets(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {/* Badge */}
            <div className="ml-auto text-xs text-slate-500 font-medium hidden md:block">
              {filteredAssets.length} / {assets.length} assets
            </div>
          </div>
        </div>

        {/* ── Main Content ─────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto p-4 pb-10">
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
                <MapPin className="h-10 w-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">No Assets with Location Data</h3>
              <p className="text-slate-500 text-sm max-w-sm mb-6">
                Assets will appear here once their location has been set. Try adding location data to your assets.
              </p>
              <Button onClick={() => router.push('/assets')} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <ArrowUpRight className="h-4 w-4" /> Go to Assets
              </Button>
            </div>
          ) : activeView === "list" ? (
            // ── List View ────────────────────────────────────────────────────────
            <div className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredAssets.map(asset => {
                  const cfg = getStatusCfg(asset.status);
                  const StatusIcon = cfg.icon;
                  return (
                    <div
                      key={asset.id}
                      className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-hidden hover:border-indigo-500/50 transition-all duration-200 group"
                    >
                      {/* Card header */}
                      <div className={`h-2 ${cfg.bg}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center text-white font-bold text-sm`}>
                            {asset.name[0]?.toUpperCase()}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${cfg.bg} text-white`}>{cfg.label}</span>
                        </div>
                        <h3 className="font-bold text-slate-200 mb-1 truncate">{asset.name}</h3>
                        {asset.description && <p className="text-xs text-slate-500 truncate mb-2">{asset.description}</p>}
                        {asset.location.address && (
                          <p className="text-xs text-slate-500 flex items-start gap-1 mb-3">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-indigo-400" />
                            <span className="truncate">{asset.location.address}</span>
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                            onClick={() => { focusOnAsset(asset); }}>
                            <MapPin className="h-3 w-3 mr-1" /> Map
                          </Button>
                          <Button size="sm" className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => handleViewDetails(asset.id)}>
                            <Eye className="h-3 w-3 mr-1" /> Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredAssets.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No assets match your search</p>
                </div>
              )}
            </div>
          ) : (
            // ── Map View ─────────────────────────────────────────────────────────
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: isMobile ? "auto" : "calc(100vh - 280px)", minHeight: "500px" }}>
              {/* Asset Sidebar */}
              <div className="lg:col-span-1 flex flex-col gap-3 order-2 lg:order-1" style={{ maxHeight: isMobile ? "300px" : "100%", overflow: "hidden" }}>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
                    <p className="text-sm font-bold text-slate-200">Assets</p>
                    <span className="text-xs text-slate-500">{filteredAssets.length} shown</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredAssets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-sm">
                        <Search className="h-6 w-6 mb-2" />
                        No assets found
                      </div>
                    ) : (
                      filteredAssets.map(asset => (
                        <AssetListCard
                          key={asset.id}
                          asset={asset}
                          selected={selectedAsset?.id === asset.id}
                          onSelect={() => setSelectedAssets(prev => prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id])}
                          onFocus={() => focusOnAsset(asset)}
                        />
                      ))
                    )}
                  </div>
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

                    {filteredAssets.map(asset => {
                      const cfg = getStatusCfg(asset.status);
                      return (
                        <Marker
                          key={asset.id}
                          latitude={asset.location.latitude}
                          longitude={asset.location.longitude}
                          onClick={e => {
                            e.originalEvent.stopPropagation();
                            focusOnAsset(asset);
                          }}
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-pointer group">
                                  <div className={`relative w-10 h-10 ${cfg.bg} rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xl border-2 ${selectedAsset?.id === asset.id ? 'border-white scale-125' : 'border-transparent'} transition-all duration-200 hover:scale-110`}>
                                    {asset.name[0]?.toUpperCase()}
                                    {/* Pulse ring for critical */}
                                    {(asset.status === 'CRITICAL' || asset.status === 'DAMAGED') && (
                                      <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: cfg.bg.replace('bg-', '') }} />
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-semibold">{asset.name}</p>
                                <p className="text-xs">{cfg.label}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Marker>
                      );
                    })}

                    {selectedAsset && showPopup && (
                      <Popup
                        latitude={selectedAsset.location.latitude}
                        longitude={selectedAsset.location.longitude}
                        onClose={() => setShowPopup(false)}
                        closeButton={true}
                        closeOnClick={false}
                        maxWidth="320px"
                        className="asset-popup"
                      >
                        <div className="p-4 bg-slate-900 rounded-xl text-white min-w-60">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg ${getStatusCfg(selectedAsset.status).bg} flex items-center justify-center text-white text-sm font-bold`}>
                                {selectedAsset.name[0]?.toUpperCase()}
                              </div>
                              <div>
                                <h3 className="font-bold text-sm">{selectedAsset.name}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusCfg(selectedAsset.status).bg} text-white`}>
                                  {getStatusCfg(selectedAsset.status).label}
                                </span>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-slate-400 hover:text-white p-1">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                <DropdownMenuItem className="text-slate-200 hover:bg-slate-700" onClick={() => handleViewDetails(selectedAsset.id)}>
                                  <Eye className="h-4 w-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-slate-200 hover:bg-slate-700" onClick={() => { setAssetToMove(selectedAsset); setMoveAssetOpen(true); setShowPopup(false); }}>
                                  <MoveHorizontal className="h-4 w-4 mr-2" /> Move Asset
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-slate-200 hover:bg-slate-700" onClick={() => { setAssetToShare(selectedAsset); setShareLocationOpen(true); }}>
                                  <ExternalLink className="h-4 w-4 mr-2" /> Google Maps
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-700" />
                                <DropdownMenuItem className="text-red-400 hover:bg-slate-700" onClick={() => { setAssetToReport(selectedAsset); setReportIssueOpen(true); setShowPopup(false); }}>
                                  <AlertCircle className="h-4 w-4 mr-2" /> Report Issue
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Asset Image */}
                          {selectedAsset.imageUrl ? (
                            <div className="mb-3 rounded-lg overflow-hidden h-28">
                              <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          ) : (
                            <div className="mb-3 rounded-lg bg-slate-800 h-20 flex items-center justify-center">
                              <Box className="h-8 w-8 text-slate-600" />
                            </div>
                          )}

                          {/* Details */}
                          <div className="space-y-1.5 mb-3">
                            {selectedAsset.location.address && (
                              <p className="text-xs text-slate-400 flex items-start gap-1.5">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 text-indigo-400 shrink-0" />
                                {selectedAsset.location.address}
                              </p>
                            )}
                            {(selectedAsset.floorNumber || selectedAsset.roomNumber) && (
                              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                <Building className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                {selectedAsset.floorNumber && `Floor ${selectedAsset.floorNumber}`}
                                {selectedAsset.floorNumber && selectedAsset.roomNumber && ' · '}
                                {selectedAsset.roomNumber && `Room ${selectedAsset.roomNumber}`}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 font-mono">
                              {selectedAsset.location.latitude.toFixed(5)}, {selectedAsset.location.longitude.toFixed(5)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                              onClick={() => handleViewDetails(selectedAsset.id)}
                            >
                              View Details
                            </button>
                            <button
                              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                              onClick={() => { setAssetToMove(selectedAsset); setMoveAssetOpen(true); setShowPopup(false); }}
                            >
                              Move Asset
                            </button>
                          </div>
                        </div>
                      </Popup>
                    )}
                  </Map>
                ) : (
                  // No Mapbox token fallback
                  <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-4">
                      <MapIcon className="h-8 w-8 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-200 mb-2">Map Unavailable</h3>
                    <p className="text-slate-500 text-sm mb-1">
                      <code className="text-amber-400 text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> is not configured.
                    </p>
                    <p className="text-slate-600 text-xs">Switch to List view to browse assets.</p>
                    <Button size="sm" variant="outline" className="mt-4 border-slate-700 text-slate-300" onClick={() => setActiveView("list")}>
                      <List className="h-4 w-4 mr-2" /> Switch to List View
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Legend ───────────────────────────────────────────────────────────── */}
          {activeView === "map" && assets.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const StatusIcon = cfg.icon;
                return (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />
                    {cfg.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .asset-popup .mapboxgl-popup-content {
          background: transparent;
          padding: 0;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          border-radius: 12px;
          overflow: hidden;
        }
        .asset-popup .mapboxgl-popup-close-button {
          color: #94a3b8;
          font-size: 18px;
          padding: 4px 8px;
          z-index: 10;
        }
        .asset-popup .mapboxgl-popup-tip {
          border-top-color: #0f172a;
        }
      `}</style>
    </DashboardLayout>
  );
}
