import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useTranslation } from "@/contexts/TranslationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useButtonVisibility } from "@/hooks/useButtonVisibility";
import {
  Box,
  Calendar,
  Hash,
  DollarSign,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  Edit,
  Ticket,
  History,
  Info,
  Activity,
  Trash2,
  FileText,
  ExternalLink,
  Briefcase,
  UserCheck,
  User,
  Radio,
  Signal,
  Battery,
  BatteryLow,
  BatteryCharging,
  Tag,
  Wifi,
  ChevronRight,
  Package,
  Zap,
  ArrowRight,
  MoreHorizontal,
  Printer,
} from "lucide-react";
import { EditAssetDialog } from "./EditAssetDialog";
import { AssignAssetDialog } from "./AssignAssetDialog";
import { useRef, useState, useEffect } from "react";
import Barcode from "react-barcode";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTicketDialog } from "./CreateTicketDialog";
import PrintBarcodeButton from "./PrintBarcodeButton";
import { AssetHealthDashboard } from "./AssetHealthDashboard";
import { AssetDocumentsTab } from "./AssetDocumentsTab";
import { PrintAssetReportButton } from "./PrintAssetReportButton";

interface Asset {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  type: string;
  status: "ACTIVE" | "IN_TRANSIT" | "DISPOSED";
  imageUrl?: string;
  floorNumber?: string;
  roomNumber?: string;
  purchaseAmount?: number;
  purchaseDate?: string;
  barcode?: string;
  vendor?: { name: string };
  location?: { latitude: number; longitude: number; address?: string };
  createdAt: string;
  lastMovedAt?: string;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedToId?: string | null;
  assignedAt?: string | null;
  rfidTag?: {
    id: string; tagId: string; tagType: string; status: string;
    batteryLevel?: number | null; lastRssi?: number | null;
    lastSeenAt?: string | null; manufacturer?: string | null; model?: string | null;
    lastZone?: { id: string; name: string; floorNumber?: string | null; roomNumber?: string | null; building?: string | null } | null;
  } | null;
}

interface Ticket {
  id: string; title: string; description: string;
  status: string; priority: string; createdAt: string; updatedAt: string;
  user: { email: string };
}

interface AssetHistory {
  id: string; action: string; createdAt: string; details?: any;
  user: { email: string };
}

interface AssetDetailsDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetUpdated?: () => void;
}

function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || /[\r\n\t]/.test(trimmed) || /%0[DA]/i.test(trimmed)) return false;
  try {
    const p = new URL(trimmed);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch { return false; }
}

const STATUS_MAP = {
  ACTIVE:     { label: "Active",     dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800", icon: CheckCircle2, glow: "shadow-emerald-200 dark:shadow-emerald-900" },
  IN_TRANSIT: { label: "In Transit", dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800",           icon: AlertCircle,  glow: "shadow-amber-200 dark:shadow-amber-900" },
  DISPOSED:   { label: "Disposed",   dot: "bg-red-500",     badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800",                       icon: XCircle,      glow: "shadow-red-200 dark:shadow-red-900" },
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  RESOLVED:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED:      "bg-slate-100 text-slate-700 border-slate-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    "bg-slate-100 text-slate-700 border-slate-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH:   "bg-red-100 text-red-800 border-red-200",
  URGENT: "bg-purple-100 text-purple-800 border-purple-200",
};

const HISTORY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  MOVED:          { color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30",     border: "border-blue-200 dark:border-blue-800",   icon: MapPin },
  DISPOSED:       { color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-800",     icon: XCircle },
  TICKET_CREATED: { color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800",icon: Ticket },
  TASK_CREATED:   { color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800", icon: Calendar },
  UPDATED:        { color: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-950/30",border: "border-emerald-200 dark:border-emerald-800",icon: Edit },
  REGISTERED:     { color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800",icon: Package },
};

function InfoRow({ icon: Icon, label, value, mono = false }: { icon: any; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</p>
        <div className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
    </div>
  );
}

export function AssetDetailsDialog({ asset, open, onOpenChange, onAssetUpdated }: AssetDetailsDialogProps) {
  const { t } = useTranslation();
  const { isButtonVisible } = useButtonVisibility();
  const printRef = useRef<HTMLDivElement>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [currentAsset, setCurrentAsset] = useState(asset);
  const [rfidTag, setRfidTag] = useState<Asset["rfidTag"] | null>(null);
  const [rfidLoading, setRfidLoading] = useState(false);

  const handleAssetUpdated = async () => {
    setIsEditDialogOpen(false);
    if (asset?.id) {
      try {
        const res = await fetch(`/api/assets?assetId=${asset.assetId}&refresh=1`, { headers: { "Cache-Control": "no-cache" } });
        if (res.ok) {
          const data = await res.json();
          const updated = data?.asset ?? data;
          if (updated?.id) setCurrentAsset(updated as Asset);
        }
      } catch { /* ignore */ }
      onAssetUpdated?.();
    }
  };

  const fetchTickets = async () => {
    if (!asset?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tickets?assetId=${asset.id}`);
      if (res.ok) setTickets(await res.json());
    } catch { /* ignore */ } finally { setIsLoading(false); }
  };

  const fetchHistory = async () => {
    if (!asset?.id) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history ?? data ?? []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (open && asset) {
      setCurrentAsset(asset);
      fetchTickets();
      fetchHistory();
      setRfidLoading(true);
      fetch("/api/rfid/tags")
        .then(r => r.ok ? r.json() : { tags: [] })
        .then(data => {
          const tag = (data.tags ?? []).find((t: any) => t.asset?.id === asset.id) ?? null;
          setRfidTag(tag);
        })
        .catch(() => setRfidTag(null))
        .finally(() => setRfidLoading(false));
    }
  }, [open, asset]);

  const handleTicketCreated = () => {
    setIsCreateTicketDialogOpen(false);
    fetchTickets();
    fetchHistory();
  };

  if (!asset) return null;
  const displayAsset = currentAsset || asset;
  const statusMeta = STATUS_MAP[displayAsset.status] ?? STATUS_MAP.ACTIVE;
  const StatusIcon = statusMeta.icon;
  const hasImage = isValidImageUrl(displayAsset.imageUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[90dvh] flex flex-col">
        <VisuallyHidden>
          <DialogTitle>{displayAsset.name} — Asset Details</DialogTitle>
          <DialogDescription>View and manage details, RFID tracking, tickets, history and documents for this asset.</DialogDescription>
        </VisuallyHidden>

        {/* ── HERO HEADER ─────────────────────────────────────────── */}
        <div className="relative flex-shrink-0">
          {/* Background: blurred image or gradient */}
          {hasImage ? (
            <div className="absolute inset-0 overflow-hidden">
              <img src={displayAsset.imageUrl} alt="" className="w-full h-full object-cover scale-110 blur-sm opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/70 to-slate-900/90" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950" />
          )}

          <div className="relative z-10 p-4 pb-3 sm:p-6 sm:pb-5">
            <div className="flex items-start gap-3 sm:gap-5">
              {/* Asset image / icon */}
              <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/20 shadow-lg ${statusMeta.glow}`}>
                {hasImage ? (
                  <img src={displayAsset.imageUrl} alt={displayAsset.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <Package className="h-6 w-6 sm:h-9 sm:w-9 text-white/80" />
                  </div>
                )}
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${statusMeta.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot} ${displayAsset.status === "ACTIVE" ? "animate-pulse" : ""}`} />
                    {statusMeta.label}
                  </span>
                  <span className="text-[10px] sm:text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full border border-white/10 font-medium truncate max-w-[80px] sm:max-w-none">{displayAsset.type}</span>
                  {rfidTag?.status === "ACTIVE" && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <Radio className="h-2.5 w-2.5 animate-pulse" /> Live RFID
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-xl font-bold text-white leading-tight line-clamp-2 sm:truncate">{displayAsset.name}</h2>
                <p className="text-[10px] text-white/50 mt-0.5 font-mono truncate">{displayAsset.assetId}</p>
              </div>

              {/* Action toolbar */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  onClick={() => setIsAssignDialogOpen(true)}
                  title={currentAsset?.assignedToName ? "Reassign" : "Assign To"}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all"
                >
                  <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  onClick={() => setIsEditDialogOpen(true)}
                  title="Edit Asset"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all"
                >
                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  onClick={() => setIsCreateTicketDialogOpen(true)}
                  title="Create Ticket"
                  className="hidden sm:flex w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white items-center justify-center transition-all"
                >
                  <Ticket className="h-4 w-4" />
                </button>
                {displayAsset.status !== "DISPOSED" && isButtonVisible("dispose_asset") && (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("dispose-asset", { detail: displayAsset }))}
                    title="Dispose Asset"
                    className="hidden sm:flex w-9 h-9 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 items-center justify-center transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Assignment strip */}
            {currentAsset?.assignedToName ? (
              <div className="mt-4 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {currentAsset.assignedToName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/90 font-semibold truncate">{currentAsset.assignedToName}</p>
                  {currentAsset.assignedToEmail && <p className="text-[10px] text-white/50 truncate">{currentAsset.assignedToEmail}</p>}
                </div>
                {currentAsset.assignedAt && (
                  <p className="text-[10px] text-white/40 flex-shrink-0">since {new Date(currentAsset.assignedAt).toLocaleDateString()}</p>
                )}
                <button onClick={() => setIsAssignDialogOpen(true)} className="text-[10px] text-emerald-300 hover:text-emerald-200 font-semibold ml-1">Change</button>
              </div>
            ) : (
              <button
                onClick={() => setIsAssignDialogOpen(true)}
                className="mt-4 w-full flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl px-3 py-2 text-white/40 hover:text-white/60 transition-all text-left"
              >
                <User className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs">Not assigned — click to assign</span>
              </button>
            )}
          </div>
        </div>

        {/* ── BARCODE / QR STRIP ──────────────────────────────────── */}
        <div className="bg-muted/30 border-b border-border/50 px-4 sm:px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-hide" ref={printRef}>
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Barcode</p>
                <Barcode value={displayAsset.barcode || displayAsset.assetId} width={1} height={28} format="CODE128" displayValue={false} margin={0} />
                <p className="text-[9px] font-mono text-muted-foreground truncate max-w-[120px]">{displayAsset.barcode || displayAsset.assetId}</p>
              </div>
              <div className="w-px h-10 bg-border/60 flex-shrink-0" />
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">QR Code</p>
                <QRCode value={displayAsset.barcode || displayAsset.assetId} size={40} level="H" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <PrintBarcodeButton
                barcodeValue={displayAsset.barcode || displayAsset.assetId}
                displayText={displayAsset.assetId}
                title={displayAsset.name}
                subtitle={`Asset ID: ${displayAsset.assetId}`}
                variant="outline"
              />
              <div className="hidden sm:block">
                <PrintAssetReportButton asset={displayAsset as any} />
              </div>
            </div>
          </div>
        </div>

        {/* ── TABS ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            {/* Pill tab bar */}
            <div className="px-3 sm:px-6 pt-3 sm:pt-4 flex-shrink-0">
              <TabsList className="h-10 bg-muted/50 rounded-xl p-1 flex gap-0.5 w-full overflow-x-auto scrollbar-hide">
                {[
                  { value: "details",   icon: Info,     label: "Details" },
                  { value: "rfid",      icon: Radio,    label: "RFID", dot: rfidTag ? (rfidTag.status === "ACTIVE" ? "bg-emerald-500" : rfidTag.status === "LOW_BATTERY" ? "bg-amber-500" : "bg-red-500") : null },
                  { value: "health",    icon: Activity, label: "Health" },
                  { value: "tickets",   icon: Ticket,   label: "Tickets", count: tickets.length },
                  { value: "history",   icon: History,  label: "History", count: history.length },
                  { value: "documents", icon: FileText,  label: "Docs" },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-semibold rounded-lg relative data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      {tab.dot && <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${tab.dot} ${tab.dot === "bg-emerald-500" ? "animate-pulse" : ""}`} />}
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className="bg-primary text-primary-foreground text-[9px] font-bold px-1 py-0 rounded-full leading-tight min-w-[14px] text-center">{tab.count}</span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Scrollable tab content */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-6 pt-3 sm:pt-4">

              {/* ── DETAILS TAB ──────────────────────────────────── */}
              <TabsContent value="details" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
                  {/* Left: image + description — hidden on mobile to save space */}
                  <div className="hidden sm:block lg:col-span-2 space-y-4">
                    <div className="aspect-video rounded-2xl overflow-hidden border border-border/50 shadow-sm">
                      {hasImage ? (
                        <img src={displayAsset.imageUrl} alt={displayAsset.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center gap-2">
                          <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                          <p className="text-xs text-muted-foreground">No image</p>
                        </div>
                      )}
                    </div>
                    {displayAsset.description && (
                      <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Description</p>
                        <p className="text-sm text-foreground leading-relaxed">{displayAsset.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Description card — mobile only */}
                  {displayAsset.description && (
                    <div className="sm:hidden rounded-xl border border-border/50 bg-muted/30 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Description</p>
                      <p className="text-sm text-foreground leading-relaxed">{displayAsset.description}</p>
                    </div>
                  )}

                  {/* Right: info fields */}
                  <div className="lg:col-span-3 rounded-2xl border border-border/50 bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asset Information</h3>
                    </div>
                    <div className="px-4 divide-y divide-border/40">
                      <InfoRow icon={Box} label="Type" value={displayAsset.type} />
                      <InfoRow icon={Hash} label="Asset ID" value={displayAsset.assetId} mono />
                      {displayAsset.barcode && <InfoRow icon={Hash} label="Barcode" value={displayAsset.barcode} mono />}
                      <InfoRow
                        icon={DollarSign}
                        label="Purchase Details"
                        value={
                          <span>
                            {displayAsset.purchaseAmount
                              ? <span className="font-bold text-foreground">QAR {displayAsset.purchaseAmount.toLocaleString()}</span>
                              : <span className="text-muted-foreground">—</span>}
                            {displayAsset.purchaseDate && (() => {
                              try {
                                if (!displayAsset.purchaseDate || displayAsset.purchaseDate === "null") return null;
                                const d = new Date(displayAsset.purchaseDate);
                                if (isNaN(d.getTime())) return null;
                                return <span className="text-muted-foreground ml-2 text-xs">· {d.toLocaleDateString()}</span>;
                              } catch { return null; }
                            })()}
                          </span>
                        }
                      />
                      {(displayAsset.floorNumber || displayAsset.roomNumber) && (
                        <InfoRow
                          icon={Building2}
                          label="Building Location"
                          value={
                            <span className="flex items-center gap-2 flex-wrap">
                              {displayAsset.floorNumber && <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-semibold">Floor {displayAsset.floorNumber}</span>}
                              {displayAsset.roomNumber  && <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-semibold">Room {displayAsset.roomNumber}</span>}
                            </span>
                          }
                        />
                      )}
                      {displayAsset.location && (
                        <InfoRow
                          icon={MapPin}
                          label="GPS Location"
                          value={
                            <span className="flex items-center gap-2 flex-wrap">
                              <span>{displayAsset.location.address || `${displayAsset.location.latitude.toFixed(4)}, ${displayAsset.location.longitude.toFixed(4)}`}</span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${displayAsset.location.latitude},${displayAsset.location.longitude}`}
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" /> Map
                              </a>
                            </span>
                          }
                        />
                      )}
                      {displayAsset.vendor && (
                        <InfoRow icon={Briefcase} label="Vendor" value={displayAsset.vendor.name} />
                      )}
                      <InfoRow
                        icon={Calendar}
                        label="Dates"
                        value={
                          <span className="flex flex-col gap-0.5">
                            <span>Created: {new Date(displayAsset.createdAt).toLocaleDateString()}</span>
                            {displayAsset.lastMovedAt && <span className="text-muted-foreground text-xs">Last moved: {new Date(displayAsset.lastMovedAt).toLocaleDateString()}</span>}
                          </span>
                        }
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── RFID TAB ─────────────────────────────────────── */}
              <TabsContent value="rfid" className="mt-0">
                <div className="space-y-4">
                  {rfidLoading ? (
                    <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                      <Radio className="h-5 w-5 animate-pulse text-indigo-500" />
                      <span className="text-sm">Loading RFID data…</span>
                    </div>
                  ) : !rfidTag ? (
                    <div className="rounded-2xl border-2 border-dashed border-border p-10 flex flex-col items-center gap-4 text-center">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center">
                        <Radio className="h-9 w-9 text-indigo-300 dark:text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-bold text-base">No RFID / BLE Tag Linked</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs">Attach a BLE beacon to this asset and register it in the RFID dashboard to enable live tracking.</p>
                      </div>
                      <a href="/rfid" target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900">
                        <Tag className="h-4 w-4" /> Open RFID Dashboard <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ) : (
                    <>
                      {/* Status hero */}
                      <div className={`rounded-2xl p-5 border flex items-center gap-4 ${
                        rfidTag.status === "ACTIVE"      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" :
                        rfidTag.status === "LOW_BATTERY" ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" :
                        rfidTag.status === "MISSING"     ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" :
                        "bg-muted border-border"}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          rfidTag.status === "ACTIVE" ? "bg-emerald-100 dark:bg-emerald-900" :
                          rfidTag.status === "LOW_BATTERY" ? "bg-amber-100 dark:bg-amber-900" :
                          rfidTag.status === "MISSING" ? "bg-red-100 dark:bg-red-900" : "bg-muted"}`}>
                          <Radio className={`h-7 w-7 ${
                            rfidTag.status === "ACTIVE" ? "text-emerald-600 animate-pulse" :
                            rfidTag.status === "LOW_BATTERY" ? "text-amber-600" :
                            rfidTag.status === "MISSING" ? "text-red-600" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                              rfidTag.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                              rfidTag.status === "LOW_BATTERY" ? "bg-amber-100 text-amber-700 border-amber-300" :
                              rfidTag.status === "MISSING" ? "bg-red-100 text-red-700 border-red-300" : "bg-muted text-muted-foreground border-border"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${rfidTag.status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : rfidTag.status === "LOW_BATTERY" ? "bg-amber-500" : rfidTag.status === "MISSING" ? "bg-red-500" : "bg-slate-400"}`} />
                              {rfidTag.status.replace("_", " ")}
                            </span>
                            <span className="text-xs bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full font-semibold">{rfidTag.tagType}</span>
                          </div>
                          <p className="font-mono text-sm font-bold truncate">{rfidTag.tagId}</p>
                          {rfidTag.lastSeenAt && <p className="text-xs text-muted-foreground mt-0.5">Last seen: {new Date(rfidTag.lastSeenAt).toLocaleString()}</p>}
                        </div>
                      </div>

                      {/* Metrics row */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {/* Battery */}
                        <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-2">
                          <div className="flex justify-center">
                            {rfidTag.batteryLevel == null ? <Battery className="h-6 w-6 text-muted-foreground/30" />
                              : rfidTag.batteryLevel <= 20 ? <BatteryLow className="h-6 w-6 text-red-500" />
                              : <BatteryCharging className="h-6 w-6 text-emerald-500" />}
                          </div>
                          <p className="text-2xl font-bold">{rfidTag.batteryLevel != null ? `${rfidTag.batteryLevel}%` : "—"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Battery</p>
                          {rfidTag.batteryLevel != null && (
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${rfidTag.batteryLevel > 50 ? "bg-emerald-500" : rfidTag.batteryLevel > 20 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${rfidTag.batteryLevel}%` }} />
                            </div>
                          )}
                        </div>
                        {/* Signal */}
                        <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-2">
                          <div className="flex justify-center">
                            <Signal className={`h-6 w-6 ${rfidTag.lastRssi == null ? "text-muted-foreground/30" : rfidTag.lastRssi >= -60 ? "text-emerald-500" : rfidTag.lastRssi >= -75 ? "text-blue-500" : rfidTag.lastRssi >= -90 ? "text-amber-500" : "text-red-500"}`} />
                          </div>
                          <p className="text-2xl font-bold">{rfidTag.lastRssi != null ? rfidTag.lastRssi : "—"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">RSSI (dBm)</p>
                          {rfidTag.lastRssi != null && (
                            <p className={`text-xs font-bold ${rfidTag.lastRssi >= -60 ? "text-emerald-600" : rfidTag.lastRssi >= -75 ? "text-blue-600" : rfidTag.lastRssi >= -90 ? "text-amber-600" : "text-red-600"}`}>
                              {rfidTag.lastRssi >= -60 ? "Excellent" : rfidTag.lastRssi >= -75 ? "Good" : rfidTag.lastRssi >= -90 ? "Fair" : "Weak"}
                            </p>
                          )}
                        </div>
                        {/* Last seen */}
                        <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-2">
                          <div className="flex justify-center"><Clock className="h-6 w-6 text-violet-500" /></div>
                          <p className="text-sm font-bold leading-tight">
                            {rfidTag.lastSeenAt ? (() => {
                              const s = Math.floor((Date.now() - new Date(rfidTag.lastSeenAt).getTime()) / 1000);
                              if (s < 60) return `${s}s ago`;
                              if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                              if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                              return `${Math.floor(s / 86400)}d ago`;
                            })() : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Seen</p>
                          {rfidTag.lastSeenAt && <p className="text-[10px] text-muted-foreground">{new Date(rfidTag.lastSeenAt).toLocaleTimeString()}</p>}
                        </div>
                      </div>

                      {/* Zone */}
                      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-blue-500" /> Current Zone</h4>
                        {rfidTag.lastZone ? (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                            <Wifi className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-sm">{rfidTag.lastZone.name}</p>
                              <p className="text-xs text-muted-foreground">{[rfidTag.lastZone.building, rfidTag.lastZone.floorNumber && `Floor ${rfidTag.lastZone.floorNumber}`, rfidTag.lastZone.roomNumber && `Room ${rfidTag.lastZone.roomNumber}`].filter(Boolean).join(" · ") || "Zone location"}</p>
                            </div>
                          </div>
                        ) : <p className="text-sm text-muted-foreground italic">Location not yet determined</p>}
                      </div>

                      {/* Tag details */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Tag ID / MAC", value: rfidTag.tagId, mono: true },
                          { label: "Tag Type",     value: rfidTag.tagType },
                          { label: "Manufacturer", value: rfidTag.manufacturer || "—" },
                          { label: "Model",        value: rfidTag.model || "—" },
                        ].map(f => (
                          <div key={f.label} className="rounded-xl border border-border bg-muted/40 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{f.label}</p>
                            <p className={`text-sm font-semibold truncate ${f.mono ? "font-mono" : ""}`}>{f.value}</p>
                          </div>
                        ))}
                      </div>

                      <a href="/rfid" target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
                        <Radio className="h-4 w-4" /> View Full RFID Dashboard <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* ── HEALTH TAB ───────────────────────────────────── */}
              <TabsContent value="health" className="mt-0">
                <AssetHealthDashboard asset={asset} />
              </TabsContent>

              {/* ── TICKETS TAB ──────────────────────────────────── */}
              <TabsContent value="tickets" className="mt-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <Ticket className="h-5 w-5 animate-pulse" /> Loading tickets…
                  </div>
                ) : tickets.length > 0 ? (
                  <div className="space-y-3">
                    {tickets.map(ticket => (
                      <div key={ticket.id} className="rounded-2xl border border-border bg-card p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex flex-col gap-1.5 mb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <h4 className="font-bold text-sm leading-tight">{ticket.title}</h4>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.LOW}`}>{ticket.priority}</span>
                            <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${TICKET_STATUS_COLORS[ticket.status] ?? TICKET_STATUS_COLORS.OPEN}`}>{ticket.status}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{ticket.description}</p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2 mt-2">
                          <span>{ticket.user?.email ?? "—"}</span>
                          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                      <Ticket className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="font-bold text-muted-foreground">{t("no_tickets_found")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("create_ticket_to_track")}</p>
                    </div>
                    <Button variant="outline" onClick={() => setIsCreateTicketDialogOpen(true)}>
                      <Ticket className="h-4 w-4 mr-2" /> {t("create_ticket")}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* ── HISTORY TAB ──────────────────────────────────── */}
              <TabsContent value="history" className="mt-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <History className="h-5 w-5 animate-pulse" /> Loading history…
                  </div>
                ) : history.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border/60" />
                    <div className="space-y-3">
                      {history.map((record) => {
                        const cfg = HISTORY_CONFIG[record.action] ?? { color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-900/30", border: "border-slate-200 dark:border-slate-800", icon: Clock };
                        const Icon = cfg.icon;
                        return (
                          <div key={record.id} className="relative pl-12">
                            {/* Timeline dot */}
                            <div className={`absolute left-2.5 top-3 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center ${cfg.bg} ${cfg.border} border`}>
                              <Icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                            </div>
                            <div className={`rounded-2xl border p-4 ${cfg.border} ${cfg.bg}`}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-background/60 border ${cfg.border} ${cfg.color}`}>
                                  {record.action.replace(/_/g, " ")}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{new Date(record.createdAt).toLocaleString()}</span>
                              </div>

                              {record.action === "MOVED" && record.details && (
                                <div className="text-xs space-y-0.5">
                                  <p><span className="font-semibold">From:</span> Floor {record.details.fromFloor || "—"}, Room {record.details.fromRoom || "—"}</p>
                                  <p><span className="font-semibold">To:</span> Floor {record.details.toFloor}, Room {record.details.toRoom}</p>
                                  {record.details.reason && <p><span className="font-semibold">Reason:</span> {record.details.reason}</p>}
                                </div>
                              )}
                              {record.action === "TICKET_CREATED" && record.details && (
                                <div className="text-xs space-y-0.5">
                                  <p className="font-semibold">{record.details.ticketTitle}</p>
                                  <p className="text-muted-foreground">{record.details.ticketDescription}</p>
                                </div>
                              )}
                              {record.action === "UPDATED" && record.details && (() => {
                                /* Clearance-type UPDATED records have a `type` field starting with CLEARANCE_ */
                                const d = record.details as any;
                                if (d.type && String(d.type).startsWith("CLEARANCE_")) {
                                  const typeLabel = d.type === "CLEARANCE_RETURN" ? "Returned to Stock"
                                    : d.type === "CLEARANCE_REASSIGN" ? "Reassigned"
                                    : d.type === "CLEARANCE_DISPOSE" ? "Disposed"
                                    : d.type;
                                  const reasonLabels: Record<string, string> = {
                                    TERMINATED: "Terminated", RESIGNED: "Resigned",
                                    TRANSFERRED: "Transferred", SUSPENDED: "Suspended", OTHER: "Other",
                                  };
                                  return (
                                    <div className="text-xs space-y-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-rose-700 dark:text-rose-400">Clearance Action:</span>
                                        <span className="font-bold">{typeLabel}</span>
                                      </div>
                                      {d.clearanceReason && (
                                        <p><span className="font-semibold">Reason:</span> {reasonLabels[d.clearanceReason] ?? d.clearanceReason}</p>
                                      )}
                                      {d.previousAssignedTo && (
                                        <p><span className="font-semibold">Previous Holder:</span> {d.previousAssignedTo}</p>
                                      )}
                                      {d.newAssignedTo && (
                                        <p><span className="font-semibold">Reassigned To:</span> {d.newAssignedTo}</p>
                                      )}
                                      {d.clearanceNotes && (
                                        <p><span className="font-semibold">Notes:</span> {d.clearanceNotes}</p>
                                      )}
                                      {d.processedBy && (
                                        <p className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                                          Clearance Officer: {d.processedBy}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                                /* Regular UPDATED records — guard against null values */
                                return (
                                  <div className="text-xs space-y-1">
                                    {Object.entries(d).map(([field, values]: [string, any]) => {
                                      if (values === null || values === undefined || typeof values !== "object") return null;
                                      return (
                                        <div key={field} className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold capitalize">{field.replace(/([A-Z])/g, " $1").trim()}:</span>
                                          <span className="line-through text-muted-foreground">{values?.from ?? "—"}</span>
                                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                                          <span className="font-semibold">{values?.to ?? "—"}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              {record.action === "REGISTERED" && record.details && (
                                <div className="text-xs space-y-0.5">
                                  {record.details.type && <p><span className="font-semibold">Type:</span> {record.details.type}</p>}
                                  {record.details.floorNumber && <p><span className="font-semibold">Floor:</span> {record.details.floorNumber}</p>}
                                  {record.details.purchaseAmount && <p><span className="font-semibold">Amount:</span> QAR {record.details.purchaseAmount.toLocaleString()}</p>}
                                </div>
                              )}
                              {record.action === "DISPOSED" && record.details && (() => {
                                const d = record.details as any;
                                const isClearanceDispose = d.type === "CLEARANCE_DISPOSE";
                                const reasonLabels: Record<string, string> = {
                                  TERMINATED: "Terminated", RESIGNED: "Resigned",
                                  TRANSFERRED: "Transferred", SUSPENDED: "Suspended", OTHER: "Other",
                                };
                                return (
                                  <div className="text-xs space-y-0.5">
                                    {isClearanceDispose ? (
                                      <>
                                        <p className="text-rose-700 dark:text-rose-400 font-semibold">Disposed via User Clearance</p>
                                        {d.clearanceReason && <p><span className="font-semibold">Reason:</span> {reasonLabels[d.clearanceReason] ?? d.clearanceReason}</p>}
                                        {d.previousAssignedTo && <p><span className="font-semibold">Previous Holder:</span> {d.previousAssignedTo}</p>}
                                      </>
                                    ) : (
                                      <>
                                        <p><span className="font-semibold">Reason:</span> {d.reason || "Not specified"}</p>
                                        {d.disposalMethod && <p><span className="font-semibold">Method:</span> {d.disposalMethod}</p>}
                                      </>
                                    )}
                                    {d.processedBy && (
                                      <p className="text-indigo-600 dark:text-indigo-400 font-semibold">Officer: {d.processedBy}</p>
                                    )}
                                  </div>
                                );
                              })()}
                              <p className="text-[10px] text-muted-foreground mt-2">by {record.user?.email ?? (record.details as any)?.processedBy ?? "system"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                      <History className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                    <p className="font-bold text-muted-foreground">{t("no_history_found")}</p>
                    <p className="text-sm text-muted-foreground">{t("asset_history_will_appear_here")}</p>
                  </div>
                )}
              </TabsContent>

              {/* ── DOCUMENTS TAB ────────────────────────────────── */}
              <TabsContent value="documents" className="mt-0">
                <AssetDocumentsTab assetId={asset.id} />
              </TabsContent>

            </div>
          </Tabs>
        </div>

        {/* Sub-dialogs */}
        <EditAssetDialog asset={currentAsset} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onAssetUpdated={handleAssetUpdated} />
        <AssignAssetDialog
          asset={currentAsset}
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          onAssigned={async () => {
            try {
              const res = await fetch(`/api/assets/${asset?.id}`, { headers: { 'Cache-Control': 'no-cache' } });
              if (res.ok) {
                const data = await res.json();
                const updated = data?.asset ?? data;
                if (updated?.id) {
                  setCurrentAsset(updated);
                }
              }
            } catch { /* ignore */ }
            fetchHistory();
            onAssetUpdated?.();
          }}
        />
        <CreateTicketDialog
          open={isCreateTicketDialogOpen}
          onOpenChange={setIsCreateTicketDialogOpen}
          onTicketCreated={handleTicketCreated}
          assetId={asset.id}
        />
      </DialogContent>
    </Dialog>
  );
}
