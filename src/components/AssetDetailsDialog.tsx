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
} from "lucide-react";
import { EditAssetDialog } from "./EditAssetDialog";
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

export function AssetDetailsDialog({ asset, open, onOpenChange }: AssetDetailsDialogProps) {
  const { t } = useTranslation();
  const { isButtonVisible } = useButtonVisibility();
  const printRef = useRef<HTMLDivElement>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const handleAssetUpdated = () => {
    setIsEditDialogOpen(false);
    // Refresh the asset details by closing and reopening the details dialog
    onOpenChange(false);
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
      fetchTickets();
      fetchHistory();
    }
  }, [open, asset]);

  const handleTicketCreated = () => {
    setIsCreateTicketDialogOpen(false);
    fetchTickets();
    fetchHistory();
  };

  if (!asset) return null;

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
              {asset.status !== 'DISPOSED' && isButtonVisible('dispose_asset') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('dispose-asset', { detail: asset }))}
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
          asset={asset}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onAssetUpdated={handleAssetUpdated}
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
                    value={asset.barcode || asset.assetId} 
                    width={1.5}
                    height={50}
                    format="CODE128"
                    displayValue={true}
                  />
                  <div className="text-sm text-muted-foreground">
                    {t('asset_id')}: {asset.assetId}
                  </div>
                </div>
                
                {/* QR Code */}
                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('qr_code')}</h3>
                  <div className="w-[150px] h-[150px]">
                    <QRCode 
                      value={asset.barcode || asset.assetId}
                      size={150}
                      level="H"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('asset_id')}: {asset.assetId}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-center">
                <PrintBarcodeButton
                  barcodeValue={asset.barcode || asset.assetId}
                  displayText={asset.assetId}
                  title={asset.name}
                  subtitle={`${t('asset_id')}: ${asset.assetId}`}
                  variant="outline"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-4" />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              {t('details')}
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t('health')}
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              {t('tickets')}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('history')}
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('documents')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {asset.imageUrl ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden">
                    <img
                      src={asset.imageUrl}
                      alt={asset.name}
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
                      <h3 className="text-2xl font-semibold">{asset.name}</h3>
                      <Badge className={getStatusColor(asset.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(asset.status)}
                          {asset.status}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {asset.description}
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
                          <p className="text-sm text-muted-foreground">{asset.type}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-start gap-2">
                        <Hash className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{t('asset_id')}</p>
                          <p className="text-sm text-muted-foreground">{asset.assetId}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{t('purchase_details')}</p>
                          {asset.purchaseAmount && (
                            <p className="text-sm text-muted-foreground">{t('amount')}: QAR {asset.purchaseAmount.toLocaleString()}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {t('date')}: {
                              (() => {
                                try {
                                  // Check if purchase date exists and is not null or empty
                                  if (!asset.purchaseDate || asset.purchaseDate === "null" || asset.purchaseDate === "") {
                                    return t('not_specified');
                                  }
                                  
                                  // Handle different date formats
                                  const date = new Date(asset.purchaseDate);
                                  
                                  // Check if the date is valid
                                  if (isNaN(date.getTime())) {
                                    return t('not_specified');
                                  }
                                  
                                  // Format the date
                                  return date.toLocaleDateString();
                                } catch (error) {
                                  console.error('Error formatting purchase date:', error, asset.purchaseDate);
                                  return t('not_specified');
                                }
                              })()
                            }
                          </p>
                        </div>
                      </div>
                      {(asset.floorNumber || asset.roomNumber) && (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{t('building_details')}</p>
                            {asset.floorNumber && (
                              <p className="text-sm text-muted-foreground">{t('floor')}: {asset.floorNumber}</p>
                            )}
                            {asset.roomNumber && (
                              <p className="text-sm text-muted-foreground">{t('room')}: {asset.roomNumber}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {asset.location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{t('location')}</p>
                            {asset.location.address ? (
                              <p className="text-sm text-muted-foreground break-words">{asset.location.address}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {asset.location.latitude.toFixed(6)}, {asset.location.longitude.toFixed(6)}
                              </p>
                            )}
                            <div className="mt-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  if (asset.location) {
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${asset.location.latitude},${asset.location.longitude}`, '_blank');
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
                      {asset.vendor && (
                        <div className="flex items-start gap-2">
                          <Briefcase className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{t('vendor')}</p>
                            <p className="text-sm text-muted-foreground">{asset.vendor.name}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{t('dates')}</p>
                          <p className="text-sm text-muted-foreground">{t('created')}: {new Date(asset.createdAt).toLocaleDateString()}</p>
                          {asset.lastMovedAt && (
                            <p className="text-sm text-muted-foreground">{t('last_moved')}: {new Date(asset.lastMovedAt).toLocaleDateString()}</p>
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