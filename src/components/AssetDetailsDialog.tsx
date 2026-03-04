import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/TranslationContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  Printer,
  Building2,
  DoorOpen,
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
  UserX,
  Radio,
  Signal,
  Battery,
  BatteryLow,
  BatteryCharging,
  Tag,
  Wifi,
  Link as LinkIcon,
} from "lucide-react";
import { EditAssetDialog } from "./EditAssetDialog";
import { AssignAssetDialog } from "./AssignAssetDialog";
import { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import Barcode from "react-barcode";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTicketDialog } from "./CreateTicketDialog";
import PrintBarcodeButton from "./PrintBarcodeButton";
import { AssetHealthDashboard } from "./AssetHealthDashboard";
import { AssetDocumentsTab } from "./AssetDocumentsTab";

interface Asset {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  type: string;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'DISPOSED';
  imageUrl?: string;
  floorNumber?: string;
  roomNumber?: string;
  purchaseAmount?: number;
  purchaseDate?: string;
  barcode?: string;
  vendor?: {
    name: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
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
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user: {
    email: string;
  };
}

interface AssetHistory {
  id: string;
  action: string;
  createdAt: string;
  details?: any;
  user: {
    email: string;
  };
}

interface AssetDetailsDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetUpdated?: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'IN_TRANSIT':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'DISPOSED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'IN_TRANSIT':
      return 'bg-yellow-100 text-yellow-800';
    case 'DISPOSED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getTicketStatusColor = (status: string) => {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-800';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800';
    case 'RESOLVED':
      return 'bg-green-100 text-green-800';
    case 'CLOSED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'LOW':
      return 'bg-green-100 text-green-800';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800';
    case 'HIGH':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || /[\r\n\t]/.test(trimmed) || /%0[DA]/i.test(trimmed)) return false;
  try {
    const p = new URL(trimmed);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch { return false; }
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
  const [rfidTag, setRfidTag] = useState<Asset['rfidTag'] | null>(null);
  const [rfidLoading, setRfidLoading] = useState(false);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const handleAssetUpdated = async () => {
    setIsEditDialogOpen(false);
    // Fetch the latest asset data and update the dialog in-place so the new image shows immediately
    if (asset?.id) {
      try {
        const res = await fetch(`/api/assets?assetId=${asset.assetId}&refresh=1`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data?.asset ?? data;
          if (updated?.id) setCurrentAsset(updated as Asset);
        }
      } catch {
        // non-critical — dialog still open with old data
      }
    }
    // Tell the parent page to also refresh its list (bypasses cache)
    onAssetUpdated?.();
  };

  const fetchTickets = async () => {
    if (!asset) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/assets/${asset.id}/tickets`);
      
      if (!response.ok) {
        throw new Error(`Error fetching tickets: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!asset) return;
    
    try {
      setIsLoading(true);
      console.log(`Fetching history for asset: ${asset.id}`);
      
      const response = await fetch(`/api/assets/${asset.id}/history`);
      
      if (!response.ok) {
        throw new Error(`Error fetching history: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('History data received:', data);
      
      // Check if data.history exists and is an array
      if (data && data.history && Array.isArray(data.history)) {
        setHistory(data.history);
      } else {
        console.error('Invalid history data format:', data);
        throw new Error('Invalid history data format');
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
      // Set an empty array to prevent undefined errors
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && asset) {
      setCurrentAsset(asset);
      fetchTickets();
      fetchHistory();
      // Fetch live RFID tag data for this asset
      setRfidLoading(true);
      fetch(`/api/rfid/tags`)
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

  // Always use the most up-to-date asset data for display (currentAsset is refreshed after edits)
  const displayAsset = currentAsset || asset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle>{t('asset_details')}</DialogTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignDialogOpen(true)}
                className="flex items-center gap-2 text-xs sm:text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
              >
                <UserCheck className="h-4 w-4" />
                <span>{currentAsset?.assignedToName ? 'Reassign' : 'Assign To'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateTicketDialogOpen(true)}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <Ticket className="h-4 w-4" />
                <span className="hidden xs:inline">{t('create_ticket')}</span>
                <span className="xs:hidden">{t('ticket')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden xs:inline">{t('edit_asset')}</span>
                <span className="xs:hidden">{t('edit')}</span>
              </Button>
              {displayAsset.status !== 'DISPOSED' && isButtonVisible('dispose_asset') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('dispose-asset', { detail: displayAsset }))}
                  className="flex items-center gap-2 text-xs sm:text-sm text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden xs:inline">{t('dispose_asset')}</span>
                  <span className="xs:hidden">{t('dispose')}</span>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <EditAssetDialog
          asset={currentAsset}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onAssetUpdated={handleAssetUpdated}
        />

        <AssignAssetDialog
          asset={currentAsset}
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          onAssigned={() => {
            // Refetch the asset to get updated assignment
            fetch(`/api/assets/${asset?.id}`)
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (data?.asset) setCurrentAsset(data.asset); })
              .catch(() => {});
            fetchHistory();
          }}
        />

        <CreateTicketDialog
          open={isCreateTicketDialogOpen}
          onOpenChange={setIsCreateTicketDialogOpen}
          onTicketCreated={handleTicketCreated}
          assetId={asset.id}
        />

        {/* Barcode and QR Code Section */}
        <div className="mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Barcode */}
                <div className="flex flex-col items-center space-y-4" ref={printRef}>
                  <h3 className="text-sm font-medium text-muted-foreground">{t('barcode')}</h3>
                  <Barcode 
                    value={displayAsset.barcode || displayAsset.assetId} 
                    width={1.5}
                    height={50}
                    format="CODE128"
                    displayValue={true}
                  />
                  <div className="text-sm text-muted-foreground">
                    {t('asset_id')}: {displayAsset.assetId}
                  </div>
                </div>
                
                {/* QR Code */}
                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('qr_code')}</h3>
                  <div className="w-[150px] h-[150px]">
                    <QRCode 
                      value={displayAsset.barcode || displayAsset.assetId}
                      size={150}
                      level="H"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('asset_id')}: {displayAsset.assetId}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-center">
                <PrintBarcodeButton
                  barcodeValue={displayAsset.barcode || displayAsset.assetId}
                  displayText={displayAsset.assetId}
                  title={displayAsset.name}
                  subtitle={`${t('asset_id')}: ${displayAsset.assetId}`}
                  variant="outline"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-4" />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="details" className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('details')}</span>
            </TabsTrigger>
            <TabsTrigger value="rfid" className="flex items-center gap-1.5 relative">
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">RFID</span>
              {rfidTag && (
                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-background ${
                  rfidTag.status === 'ACTIVE' ? 'bg-emerald-500' :
                  rfidTag.status === 'LOW_BATTERY' ? 'bg-amber-500' :
                  rfidTag.status === 'MISSING' ? 'bg-red-500' : 'bg-slate-400'
                }`} />
              )}
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('health')}</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('tickets')}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('history')}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('documents')}</span>
            </TabsTrigger>
          </TabsList>

          {/* ── RFID / BLE Tracking Tab ─────────────────────────────── */}
          <TabsContent value="rfid">
            <div className="space-y-4 py-2">
              {rfidLoading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Radio className="h-5 w-5 animate-pulse" /> Loading RFID data…
                </div>
              ) : !rfidTag ? (
                /* No tag linked */
                <div className="rounded-2xl border border-dashed border-border p-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                    <Radio className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="font-bold text-muted-foreground">No RFID / BLE Tag Linked</p>
                    <p className="text-sm text-muted-foreground mt-1">Attach a BLE beacon to this asset and register it in the RFID dashboard to enable live tracking.</p>
                  </div>
                  <a
                    href="/rfid"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                  >
                    <Tag className="h-4 w-4" /> Go to RFID Dashboard
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <>
                  {/* Status hero */}
                  <div className={`rounded-2xl p-5 border flex items-center gap-4 ${
                    rfidTag.status === 'ACTIVE'      ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' :
                    rfidTag.status === 'LOW_BATTERY' ? 'bg-amber-50   border-amber-200   dark:bg-amber-950/40   dark:border-amber-800'   :
                    rfidTag.status === 'MISSING'     ? 'bg-red-50     border-red-200     dark:bg-red-950/40     dark:border-red-800'     :
                    'bg-muted border-border'
                  }`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      rfidTag.status === 'ACTIVE'      ? 'bg-emerald-100 dark:bg-emerald-900' :
                      rfidTag.status === 'LOW_BATTERY' ? 'bg-amber-100   dark:bg-amber-900'   :
                      rfidTag.status === 'MISSING'     ? 'bg-red-100     dark:bg-red-900'     :
                      'bg-muted-foreground/10'
                    }`}>
                      <Radio className={`h-6 w-6 ${
                        rfidTag.status === 'ACTIVE'      ? 'text-emerald-600 dark:text-emerald-400' :
                        rfidTag.status === 'LOW_BATTERY' ? 'text-amber-600   dark:text-amber-400'   :
                        rfidTag.status === 'MISSING'     ? 'text-red-600     dark:text-red-400'     :
                        'text-muted-foreground'
                      } ${rfidTag.status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                          rfidTag.status === 'ACTIVE'      ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700' :
                          rfidTag.status === 'LOW_BATTERY' ? 'bg-amber-100   text-amber-700   border-amber-300   dark:bg-amber-900   dark:text-amber-300   dark:border-amber-700'   :
                          rfidTag.status === 'MISSING'     ? 'bg-red-100     text-red-700     border-red-300     dark:bg-red-900     dark:text-red-300     dark:border-red-700'     :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            rfidTag.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' :
                            rfidTag.status === 'LOW_BATTERY' ? 'bg-amber-500' :
                            rfidTag.status === 'MISSING' ? 'bg-red-500' : 'bg-slate-400'
                          }`} />
                          {rfidTag.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold">{rfidTag.tagType}</span>
                      </div>
                      <p className="font-mono text-sm font-bold mt-1 truncate">{rfidTag.tagId}</p>
                      {rfidTag.lastSeenAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last seen: {new Date(rfidTag.lastSeenAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Current location */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <h4 className="font-bold text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-500" /> Current Location</h4>
                    {rfidTag.lastZone ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                          <Wifi className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-sm">{rfidTag.lastZone.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[rfidTag.lastZone.building, rfidTag.lastZone.floorNumber && `Floor ${rfidTag.lastZone.floorNumber}`, rfidTag.lastZone.roomNumber && `Room ${rfidTag.lastZone.roomNumber}`].filter(Boolean).join(' · ') || 'Zone location'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Location not yet determined — waiting for AP scan</p>
                    )}
                  </div>

                  {/* Signal + battery metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Battery */}
                    <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-2">
                      <div className="flex justify-center">
                        {rfidTag.batteryLevel == null ? (
                          <Battery className="h-6 w-6 text-muted-foreground/40" />
                        ) : rfidTag.batteryLevel <= 20 ? (
                          <BatteryLow className="h-6 w-6 text-red-500" />
                        ) : (
                          <BatteryCharging className="h-6 w-6 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{rfidTag.batteryLevel != null ? `${rfidTag.batteryLevel}%` : '—'}</p>
                        <p className="text-xs text-muted-foreground">Battery Level</p>
                      </div>
                      {rfidTag.batteryLevel != null && (
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${rfidTag.batteryLevel > 50 ? 'bg-emerald-500' : rfidTag.batteryLevel > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${rfidTag.batteryLevel}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Signal strength */}
                    <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-2">
                      <div className="flex justify-center">
                        <Signal className={`h-6 w-6 ${
                          rfidTag.lastRssi == null ? 'text-muted-foreground/40' :
                          rfidTag.lastRssi >= -60 ? 'text-emerald-500' :
                          rfidTag.lastRssi >= -75 ? 'text-blue-500' :
                          rfidTag.lastRssi >= -90 ? 'text-amber-500' : 'text-red-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{rfidTag.lastRssi != null ? `${rfidTag.lastRssi}` : '—'}</p>
                        <p className="text-xs text-muted-foreground">RSSI (dBm)</p>
                      </div>
                      {rfidTag.lastRssi != null && (
                        <p className={`text-xs font-semibold ${
                          rfidTag.lastRssi >= -60 ? 'text-emerald-600 dark:text-emerald-400' :
                          rfidTag.lastRssi >= -75 ? 'text-blue-600 dark:text-blue-400' :
                          rfidTag.lastRssi >= -90 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {rfidTag.lastRssi >= -60 ? 'Excellent' : rfidTag.lastRssi >= -75 ? 'Good' : rfidTag.lastRssi >= -90 ? 'Fair' : 'Weak'}
                        </p>
                      )}
                    </div>

                    {/* Last seen */}
                    <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-2">
                      <div className="flex justify-center"><Clock className="h-6 w-6 text-violet-500" /></div>
                      <div>
                        <p className="text-sm font-bold leading-tight">
                          {rfidTag.lastSeenAt ? (() => {
                            const s = Math.floor((Date.now() - new Date(rfidTag.lastSeenAt).getTime()) / 1000);
                            if (s < 60)    return `${s}s ago`;
                            if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
                            if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                            return `${Math.floor(s / 86400)}d ago`;
                          })() : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">Last Seen</p>
                      </div>
                      {rfidTag.lastSeenAt && (
                        <p className="text-[10px] text-muted-foreground">{new Date(rfidTag.lastSeenAt).toLocaleTimeString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Tag details */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <h4 className="font-bold text-sm flex items-center gap-2"><Tag className="h-4 w-4 text-indigo-500" /> Tag Details</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Tag ID / MAC', value: rfidTag.tagId, mono: true },
                        { label: 'Tag Type',     value: rfidTag.tagType },
                        { label: 'Manufacturer', value: rfidTag.manufacturer || '—' },
                        { label: 'Model',        value: rfidTag.model || '—' },
                      ].map(f => (
                        <div key={f.label} className="bg-muted/40 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
                          <p className={`text-sm font-semibold truncate ${f.mono ? 'font-mono' : ''}`}>{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Link to full RFID dashboard */}
                  <a
                    href="/rfid"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                  >
                    <Radio className="h-4 w-4" /> View Full RFID Dashboard
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {isValidImageUrl(displayAsset.imageUrl) ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden">
                    <img
                      src={displayAsset.imageUrl}
                      alt={displayAsset.name}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    <Box className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-semibold">{displayAsset.name}</h3>
                      <Badge className={getStatusColor(displayAsset.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(displayAsset.status)}
                          {displayAsset.status}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {displayAsset.description}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-start gap-2">
                        <Box className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{t('asset_type')}</p>
                          <p className="text-sm text-muted-foreground">{displayAsset.type}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-start gap-2">
                        <Hash className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{t('asset_id')}</p>
                          <p className="text-sm text-muted-foreground">{displayAsset.assetId}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{t('purchase_details')}</p>
                          {displayAsset.purchaseAmount && (
                            <p className="text-sm text-muted-foreground">{t('amount')}: QAR {displayAsset.purchaseAmount.toLocaleString()}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {t('date')}: {
                              (() => {
                                try {
                                  if (!displayAsset.purchaseDate || displayAsset.purchaseDate === "null" || displayAsset.purchaseDate === "") {
                                    return t('not_specified');
                                  }
                                  const date = new Date(displayAsset.purchaseDate);
                                  if (isNaN(date.getTime())) return t('not_specified');
                                  return date.toLocaleDateString();
                                } catch {
                                  return t('not_specified');
                                }
                              })()
                            }
                          </p>
                        </div>
                      </div>
                      {(displayAsset.floorNumber || displayAsset.roomNumber) && (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{t('building_details')}</p>
                            {displayAsset.floorNumber && (
                              <p className="text-sm text-muted-foreground">{t('floor')}: {displayAsset.floorNumber}</p>
                            )}
                            {displayAsset.roomNumber && (
                              <p className="text-sm text-muted-foreground">{t('room')}: {displayAsset.roomNumber}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {displayAsset.location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{t('location')}</p>
                            {displayAsset.location.address ? (
                              <p className="text-sm text-muted-foreground break-words">{displayAsset.location.address}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {displayAsset.location.latitude.toFixed(6)}, {displayAsset.location.longitude.toFixed(6)}
                              </p>
                            )}
                            <div className="mt-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  if (displayAsset.location) {
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${displayAsset.location.latitude},${displayAsset.location.longitude}`, '_blank');
                                  }
                                }}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {t('view_on_map')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {displayAsset.vendor && (
                        <div className="flex items-start gap-2">
                          <Briefcase className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{t('vendor')}</p>
                            <p className="text-sm text-muted-foreground">{displayAsset.vendor.name}</p>
                          </div>
                        </div>
                      )}
                      <Separator />
                      {/* Assignment Info */}
                      <div className="flex items-start gap-2">
                        <UserCheck className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">Assignment</p>
                          {currentAsset?.assignedToName ? (
                            <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                    {currentAsset.assignedToName[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-emerald-900">{currentAsset.assignedToName}</p>
                                    {currentAsset.assignedToEmail && (
                                      <p className="text-xs text-emerald-700">{currentAsset.assignedToEmail}</p>
                                    )}
                                    {currentAsset.assignedAt && (
                                      <p className="text-xs text-emerald-600 mt-0.5">
                                        Since {new Date(currentAsset.assignedAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setIsAssignDialogOpen(true)}
                                  className="h-7 text-xs text-emerald-700 hover:bg-emerald-100"
                                >
                                  <Edit className="h-3 w-3 mr-1" /> Change
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-slate-400">
                                <User className="h-4 w-4" />
                                <span className="text-sm">Not assigned</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsAssignDialogOpen(true)}
                                className="h-7 text-xs border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                              >
                                <UserCheck className="h-3 w-3 mr-1" /> Assign
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{t('dates')}</p>
                          <p className="text-sm text-muted-foreground">{t('created')}: {new Date(displayAsset.createdAt).toLocaleDateString()}</p>
                          {displayAsset.lastMovedAt && (
                            <p className="text-sm text-muted-foreground">{t('last_moved')}: {new Date(displayAsset.lastMovedAt).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="health">
            <AssetHealthDashboard asset={asset} />
          </TabsContent>

          <TabsContent value="tickets">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="min-h-[200px] flex items-center justify-center">
                    <p>{t('loading_tickets')}</p>
                  </div>
                ) : tickets.length > 0 ? (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-semibold">{ticket.title}</h3>
                          <div className="flex gap-2">
                            <Badge className={getTicketStatusColor(ticket.status)}>
                              {ticket.status}
                            </Badge>
                            <Badge className={getPriorityColor(ticket.priority)}>
                              {ticket.priority}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{ticket.description}</p>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t('created_by')}: {ticket.user.email}</span>
                          <span>{t('created')}: {new Date(ticket.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="min-h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p className="text-lg mb-2">{t('no_tickets_found')}</p>
                      <p className="text-sm">{t('create_ticket_to_track')}</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setIsCreateTicketDialogOpen(true)}
                      >
                        <Ticket className="h-4 w-4 mr-2" />
                        {t('create_ticket')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="min-h-[200px] flex items-center justify-center">
                    <p>{t('loading_history')}</p>
                  </div>
                ) : history.length > 0 ? (
                  <div className="relative space-y-0">
                    {/* Timeline with connecting line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                    
                    {history.map((record, index) => {
                      // Determine badge color based on action type
                      let badgeColor = "bg-gray-100 text-gray-800";
                      let icon = null;
                      
                      switch(record.action) {
                        case 'MOVED':
                          badgeColor = "bg-blue-100 text-blue-800";
                          icon = <MapPin className="h-4 w-4" />;
                          break;
                        case 'DISPOSED':
                          badgeColor = "bg-red-100 text-red-800";
                          icon = <XCircle className="h-4 w-4" />;
                          break;
                        case 'TICKET_CREATED':
                          badgeColor = "bg-purple-100 text-purple-800";
                          icon = <Ticket className="h-4 w-4" />;
                          break;
                        case 'TASK_CREATED':
                          badgeColor = "bg-amber-100 text-amber-800";
                          icon = <Calendar className="h-4 w-4" />;
                          break;
                        case 'UPDATED':
                          badgeColor = "bg-green-100 text-green-800";
                          icon = <Edit className="h-4 w-4" />;
                          break;
                        case 'REGISTERED':
                          badgeColor = "bg-indigo-100 text-indigo-800";
                          icon = <Box className="h-4 w-4" />;
                          break;
                      }
                      
                      return (
                        <div key={record.id} className="relative pl-10 pb-6">
                          {/* Timeline dot */}
                          <div className="absolute left-2 top-1.5 -translate-x-1/2 h-6 w-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                            {icon}
                          </div>
                          
                          <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Badge className={badgeColor}>
                                  {record.action.replace('_', ' ')}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {new Date(record.createdAt).toLocaleDateString()} {t('at')} {new Date(record.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                            
                            {/* Action-specific details */}
                            {record.action === 'MOVED' && record.details && (
                              <div className="bg-blue-50 p-3 rounded-md my-2">
                                <p className="text-sm">
                                  <span className="font-medium">{t('from')}:</span> {t('floor')} {record.details.fromFloor || t('not_available')}, {t('room')} {record.details.fromRoom || t('not_available')}
                                </p>
                                <p className="text-sm">
                                  <span className="font-medium">{t('to')}:</span> {t('floor')} {record.details.toFloor}, {t('room')} {record.details.toRoom}
                                </p>
                                {record.details.reason && (
                                  <p className="text-sm mt-1">
                                    <span className="font-medium">{t('reason')}:</span> {record.details.reason}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {record.action === 'TICKET_CREATED' && record.details && (
                              <div className="bg-purple-50 p-3 rounded-md my-2">
                                <p className="text-sm font-medium">{record.details.ticketTitle}</p>
                                <p className="text-sm text-gray-600 mt-1">{record.details.ticketDescription}</p>
                                <div className="flex gap-2 mt-2">
                                  <Badge className="bg-gray-100">{record.details.ticketStatus}</Badge>
                                  <Badge className="bg-gray-100">{record.details.ticketPriority}</Badge>
                                </div>
                              </div>
                            )}
                            
                            {record.action === 'TASK_CREATED' && record.details && (
                              <div className="bg-amber-50 p-3 rounded-md my-2">
                                <p className="text-sm font-medium">{record.details.taskTitle}</p>
                                <p className="text-sm text-gray-600 mt-1">{record.details.taskDescription}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge className="bg-gray-100">{record.details.taskStatus}</Badge>
                                  <Badge className="bg-gray-100">{record.details.taskPriority}</Badge>
                                  {record.details.taskAssignedTo && (
                                    <Badge className="bg-gray-100">{t('assigned_to')}: {record.details.taskAssignedTo}</Badge>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {record.action === 'DISPOSED' && record.details && (
                              <div className="bg-red-50 p-3 rounded-md my-2">
                                <p className="text-sm">
                                  <span className="font-medium">{t('reason')}:</span> {record.details.reason || t('not_specified')}
                                </p>
                                {record.details.disposalMethod && (
                                  <p className="text-sm mt-1">
                                    <span className="font-medium">{t('method')}:</span> {record.details.disposalMethod}
                                  </p>
                                )}
                                <p className="text-sm mt-1 text-gray-500">
                                  <span className="font-medium">{t('date')}:</span> {new Date(record.details.disposedAt).toLocaleString()}
                                </p>
                              </div>
                            )}
                            
                            {record.action === 'UPDATED' && record.details && (
                              <div className="bg-green-50 p-3 rounded-md my-2">
                                <p className="text-sm font-medium">{t('updated_fields')}:</p>
                                <div className="mt-1 space-y-1">
                                  {Object.entries(record.details).map(([field, values]: [string, any]) => (
                                    <div key={field} className="text-sm">
                                      <span className="font-medium capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}:</span> {' '}
                                      <span className="line-through text-gray-500">
                                        {field === 'purchaseDate' 
                                          ? (values.from ? new Date(values.from).toLocaleDateString() : t('none'))
                                          : (values.from !== null ? values.from : t('none'))}
                                      </span> {' → '}
                                      <span className="font-medium">
                                        {field === 'purchaseDate'
                                          ? (values.to ? new Date(values.to).toLocaleDateString() : t('none'))
                                          : (values.to !== null ? values.to : t('none'))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {record.action === 'REGISTERED' && record.details && !record.details.action && (
                              <div className="bg-indigo-50 p-3 rounded-md my-2">
                                <p className="text-sm font-medium">{t('asset_registered')}</p>
                                <div className="mt-1 space-y-1">
                                  {record.details.type && (
                                    <p className="text-sm">
                                      <span className="font-medium">{t('type')}:</span> {record.details.type}
                                    </p>
                                  )}
                                  {record.details.floorNumber && (
                                    <p className="text-sm">
                                      <span className="font-medium">{t('floor')}:</span> {record.details.floorNumber}
                                    </p>
                                  )}
                                  {record.details.roomNumber && (
                                    <p className="text-sm">
                                      <span className="font-medium">{t('room')}:</span> {record.details.roomNumber}
                                    </p>
                                  )}
                                  {record.details.purchaseAmount && (
                                    <p className="text-sm">
                                      <span className="font-medium">{t('purchase_amount')}:</span> QAR {record.details.purchaseAmount.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="text-xs text-muted-foreground mt-2">
                              <span>{t('by')}: {record.user.email}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="min-h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p className="text-lg mb-2">{t('no_history_found')}</p>
                      <p className="text-sm">{t('asset_history_will_appear_here')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents">
            <AssetDocumentsTab assetId={asset.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}