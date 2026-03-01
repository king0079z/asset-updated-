// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";
import { useRTLOptimization } from "@/hooks/useRTLOptimization";
import Map, { Marker, NavigationControl, Popup, Layer, Source } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/util/string";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/router";
import { 
  MapPin, Navigation, Building, DollarSign, 
  Calendar, Info, Search, Filter, List, Map as MapIcon,
  Edit, Trash, Eye, History, Share, MoreHorizontal,
  Layers, Activity, AlertCircle, Box, Truck, Settings,
  CheckCircle2, Clock, AlertTriangle, XCircle, MoveHorizontal,
  Boxes, CheckSquare, Square, LocateFixed, Copy, Link, ExternalLink,
  ChevronUp, ChevronDown, Image
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { AssetLocationDetailsDialog } from "@/components/AssetLocationDetailsDialog";
import { AssetMoveDialog } from "@/components/AssetMoveDialog";
import { AssetBulkActionsDialog } from "@/components/AssetBulkActionsDialog";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import { useToast } from "@/components/ui/use-toast";
import {
import { fetchWithCache } from '@/lib/api-cache';
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

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

interface AssetHistory {
  id: string;
  action: string;
  timestamp: string;
  details: string;
}

interface Asset {
  id: string;
  name: string;
  description: string | null;
  status: string;
  location: Location;
  floorNumber: string | null;
  roomNumber: string | null;
  purchaseAmount: number | null;
  createdAt: string;
  history?: AssetHistory[];
  lastUpdated?: string;
  department?: string;
  assignedTo?: string;
  imageUrl?: string | null;
}

const statusColors = {
  AVAILABLE: "bg-green-500",
  IN_USE: "bg-blue-500",
  MAINTENANCE: "bg-yellow-500",
  DISPOSED: "bg-red-500"
};

const statusLabels = (t: (key: string) => string) => ({
  AVAILABLE: t('available'),
  IN_USE: t('in_use'),
  MAINTENANCE: t('under_maintenance'),
  DISPOSED: t('disposed')
});

const statusIcons = {
  AVAILABLE: CheckCircle2,
  IN_USE: Clock,
  MAINTENANCE: AlertTriangle,
  DISPOSED: XCircle
};

const mapLayerStyles = {
  clusters: {
    circles: {
      id: 'clusters',
      type: 'circle',
      source: 'assets',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6',
          100,
          '#f1f075',
          750,
          '#f28cb1'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          100,
          30,
          750,
          40
        ]
      }
    },
    count: {
      id: 'cluster-count',
      type: 'symbol',
      source: 'assets',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    },
    unclustered: {
      id: 'unclustered-point',
      type: 'circle',
      source: 'assets',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#11b4da',
        'circle-radius': 8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    }
  }
};

const AssetStatCard = ({ title, value, icon: Icon, color, t }: { title: string; value: number; icon: any; color?: string; t: (key: string) => string }) => (
  <Card>
    <CardContent className="flex items-center p-6">
      <div className={`p-2 rounded-full ${color || 'bg-primary/10'} mr-4`}>
        <Icon className={`h-6 w-6 ${color ? 'text-white' : 'text-primary'}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <h3 className="text-2xl font-bold">{value}</h3>
      </div>
    </CardContent>
  </Card>
);

const LoadingState = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
    {[...Array(4)].map((_, i) => (
      <Card key={i}>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse mr-4" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-6 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const ErrorState = ({ error, onRetry, t }: { error: string; onRetry: () => void; t: (key: string) => string }) => (
  <div className="p-4">
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {t('error_loading_assets')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-destructive mb-4">{error}</p>
        <Button 
          variant="outline" 
          onClick={onRetry}
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          {t('try_again')}
        </Button>
      </CardContent>
    </Card>
  </div>
);

const ShareLocationDialog = ({ 
  asset, 
  open, 
  onOpenChange,
  t
}: { 
  asset: Asset | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetLocation, setAssetLocation] = useState<{latitude: number, longitude: number} | null>(null);

  useEffect(() => {
    if (open && asset) {
      setIsLoading(true);
      setError(null);
      
      fetch('/api/assets/share-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assetId: asset.id }),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to get asset location');
          }
          return response.json();
        })
        .then(data => {
          setAssetLocation({
            latitude: data.location.latitude,
            longitude: data.location.longitude
          });
        })
        .catch(err => {
          console.error('Error getting asset location:', err);
          setError(err.message || 'Failed to get location');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setAssetLocation(null);
      setError(null);
    }
  }, [open, asset]);

  const openInGoogleMaps = () => {
    if (assetLocation) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${assetLocation.latitude},${assetLocation.longitude}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('view_asset_location')}</DialogTitle>
          <DialogDescription>
            {t('view_the_location_of')} {asset?.name} {t('in_google_maps')}.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 p-4 rounded-md text-destructive">
            <p className="font-medium">{t('error')}</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : assetLocation ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <h3 className="text-sm font-medium">Google Maps</h3>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${assetLocation.latitude},${assetLocation.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center"
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> 
                  {t('open_in_google_maps')}
                </a>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openInGoogleMaps}
              >
                {t('open')}
              </Button>
            </div>
            
            <div className="flex flex-col space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('click_the_button_to_open')}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <p>{t('no_asset_selected')}</p>
          </div>
        )}
        
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {t('close')}
          </Button>
          {assetLocation && (
            <Button
              type="button"
              onClick={openInGoogleMaps}
              className="gap-1"
            >
              <ExternalLink className="h-4 w-4" /> {t('open_in_google_maps')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const QuickActionsMenu = ({ 
  asset, 
  onViewDetails, 
  onMoveAsset,
  onShareLocation,
  onReportIssue,
  t
}: { 
  asset: Asset; 
  onViewDetails: () => void; 
  onMoveAsset: () => void;
  onShareLocation: () => void;
  onReportIssue: () => void;
  t: (key: string) => string;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuLabel>{t('quick_actions')}</DropdownMenuLabel>
      <DropdownMenuItem className="flex items-center" onClick={onViewDetails}>
        <Eye className="h-4 w-4 mr-2" /> {t('view_details')}
      </DropdownMenuItem>
      <DropdownMenuItem className="flex items-center" onClick={onMoveAsset}>
        <MoveHorizontal className="h-4 w-4 mr-2" /> {t('move_asset')}
      </DropdownMenuItem>
      <DropdownMenuItem className="flex items-center">
        <Edit className="h-4 w-4 mr-2" /> {t('edit_asset')}
      </DropdownMenuItem>
      <DropdownMenuItem className="flex items-center" onClick={onShareLocation}>
        <ExternalLink className="h-4 w-4 mr-2" /> {t('open_in_google_maps')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="flex items-center text-destructive" onClick={onReportIssue}>
        <AlertCircle className="h-4 w-4 mr-2" /> {t('report_issue')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// List view component removed

export default function AssetLocation() {
  const { t, dir } = useTranslation();
  useRTLOptimization();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
  const hasMapboxToken = mapboxToken.length > 0;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  // Map view only - list view removed
  const [showPopup, setShowPopup] = useState(false);
  const [selectedTab, setSelectedTab] = useState("details");
  const [viewState, setViewState] = useState({
    latitude: 25.2867,  // Doha, Qatar
    longitude: 51.5333,
    zoom: 9
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Clustering is permanently disabled
  const showClusters = false;
  // Bulk actions
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [moveAssetOpen, setMoveAssetOpen] = useState(false);
  const [assetToMove, setAssetToMove] = useState<Asset | null>(null);
  // Share location
  const [shareLocationOpen, setShareLocationOpen] = useState(false);
  const [assetToShare, setAssetToShare] = useState<Asset | null>(null);
  // Report issue
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [assetToReport, setAssetToReport] = useState<Asset | null>(null);
  // Mobile optimization
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [mapHeight, setMapHeight] = useState("300px");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isSmallMobile = useMediaQuery("(max-width: 480px)");
  
  const router = useRouter();

  // Asset statistics
  const assetStats = useMemo(() => ({
    total: assets.length,
    available: assets.filter(a => a.status === 'AVAILABLE').length,
    inUse: assets.filter(a => a.status === 'IN_USE').length,
    maintenance: assets.filter(a => a.status === 'MAINTENANCE').length,
    disposed: assets.filter(a => a.status === 'DISPOSED').length
  }), [assets]);

  useEffect(() => {
    fetchAssets();
  }, []);
  
  // Handle responsive map sizing and behavior
  useEffect(() => {
    const handleResize = () => {
      // Update map height based on screen size
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      if (windowWidth <= 480) { // Small mobile
        setMapHeight("250px");
      } else if (windowWidth <= 768) { // Regular mobile
        setMapHeight("300px");
      } else if (windowWidth <= 1024) { // Tablet
        setMapHeight("400px");
      } else { // Desktop
        setMapHeight("100%");
      }
      
      // This will trigger a re-render of the map component
      setViewState(prevState => ({
        ...prevState,
        latitude: prevState.latitude,
        // Adjust zoom level for better mobile experience
        zoom: windowWidth <= 768 ? Math.max(8, prevState.zoom) : prevState.zoom
      }));
    };
    
    // Initial resize
    handleResize();
    
    // Add resize event listener for responsive behavior
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const fetchAssets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchWithCache("/api/assets/locations");
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Failed to fetch assets');
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from server');
      }

      const assetsWithHistory = data.map(asset => {
        if (!asset.location || typeof asset.location.latitude !== 'number' || typeof asset.location.longitude !== 'number') {
          console.warn(`Asset ${asset.id} has invalid location data`);
          return null;
        }
        
        return {
          ...asset,
          history: [
            {
              id: '1',
              action: 'Location Updated',
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              details: 'Asset location was updated'
            },
            {
              id: '2',
              action: 'Status Changed',
              timestamp: new Date(Date.now() - 172800000).toISOString(),
              details: 'Status changed to ' + asset.status
            }
          ],
          lastUpdated: new Date().toISOString(),
          department: 'Operations',
          assignedTo: 'John Doe'
        };
      }).filter(Boolean) as Asset[];

      setAssets(assetsWithHistory);
    } catch (error) {
      console.error("Error fetching assets:", error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.location.address?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLocation = 
        !locationSearch || 
        (asset.location.address?.toLowerCase().includes(locationSearch.toLowerCase())) ||
        (asset.floorNumber?.toLowerCase().includes(locationSearch.toLowerCase())) ||
        (asset.roomNumber?.toLowerCase().includes(locationSearch.toLowerCase()));
      
      const matchesStatus = !statusFilter || asset.status === statusFilter;
      
      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [assets, searchQuery, statusFilter, locationSearch]);

  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [selectedAssetForDialog, setSelectedAssetForDialog] = useState<Asset | null>(null);

  const handleViewAssetDetails = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      setSelectedAssetForDialog(asset);
      setAssetDetailsOpen(true);
    }
  };

  const getClusterData = useCallback(() => {
    // Create a clean GeoJSON object without any React-specific attributes
    const geoJson = {
      type: 'FeatureCollection',
      features: filteredAssets.map(asset => ({
        type: 'Feature',
        properties: {
          id: asset.id,
          name: asset.name,
          status: asset.status
        },
        geometry: {
          type: 'Point',
          coordinates: [asset.location.longitude, asset.location.latitude]
        }
      }))
    };
    
    // Return a plain JavaScript object to avoid any React props being attached
    return JSON.parse(JSON.stringify(geoJson));
  }, [filteredAssets]);

  if (isLoading) return (
    <DashboardLayout>
      <LoadingState />
    </DashboardLayout>
  );

  if (error) return (
    <DashboardLayout>
      <ErrorState error={error} onRetry={fetchAssets} t={t} />
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      {/* Asset Details Dialog */}
      <AssetLocationDetailsDialog
        asset={selectedAssetForDialog}
        open={assetDetailsOpen}
        onOpenChange={setAssetDetailsOpen}
        statusLabels={statusLabels(t)}
        statusColors={statusColors}
      />
      
      {/* Move Asset Dialog */}
      {assetToMove && (
        <AssetMoveDialog
          asset={{
            id: assetToMove.id,
            name: assetToMove.name,
            floorNumber: assetToMove.floorNumber,
            roomNumber: assetToMove.roomNumber
          }}
          open={moveAssetOpen}
          onOpenChange={setMoveAssetOpen}
          onAssetMoved={() => {
            fetchAssets();
            setMoveAssetOpen(false);
            setAssetToMove(null);
          }}
        />
      )}
      
      {/* Bulk Actions Dialog */}
      <AssetBulkActionsDialog
        assets={assets}
        selectedAssets={selectedAssets}
        open={bulkActionsOpen}
        onOpenChange={setBulkActionsOpen}
        onActionComplete={() => {
          fetchAssets();
          setSelectedAssets([]);
          setBulkActionsOpen(false);
        }}
      />
      
      {/* Share Location Dialog */}
      <ShareLocationDialog
        asset={assetToShare}
        open={shareLocationOpen}
        onOpenChange={setShareLocationOpen}
        t={t}
      />
      
      {/* Report Issue Dialog */}
      <CreateTicketDialog
        open={reportIssueOpen}
        onOpenChange={setReportIssueOpen}
        onTicketCreated={() => {
          setReportIssueOpen(false);
          setAssetToReport(null);
        }}
        assetId={assetToReport?.id}
      />
      
      <div className="space-y-4 p-4 h-[calc(100vh-4rem)]">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <AssetStatCard 
            title={t('total_assets')} 
            value={assetStats.total} 
            icon={Box}
            color="bg-primary"
            t={t}
          />
          <AssetStatCard 
            title={t('available')} 
            value={assetStats.available} 
            icon={CheckCircle2}
            color="bg-green-500"
            t={t}
          />
          <AssetStatCard 
            title={t('in_use')} 
            value={assetStats.inUse} 
            icon={Clock}
            color="bg-blue-500"
            t={t}
          />
          <AssetStatCard 
            title={t('maintenance')} 
            value={assetStats.maintenance} 
            icon={Settings}
            color="bg-yellow-500"
            t={t}
          />
          <AssetStatCard 
            title={t('disposed')} 
            value={assetStats.disposed} 
            icon={Trash}
            color="bg-red-500"
            t={t}
          />
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CardTitle>{t('asset_locations')}</CardTitle>
                <Badge variant="outline" className="ml-2">
                  {filteredAssets.length} {t('assets')}
                </Badge>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative w-full md:w-auto">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('search_assets')}
                    className="pl-8 w-full md:w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="relative w-full md:w-auto">
                  <LocateFixed className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('search_by_location')}
                    className="pl-8 w-full md:w-[250px]"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full md:w-[150px]">
                      <Filter className="mr-2 h-4 w-4" />
                      {statusFilter ? statusLabels(t)[statusFilter] : t('all_status')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                      {t('all_status')}
                    </DropdownMenuItem>
                    {Object.entries(statusLabels(t)).map(([value, label]) => (
                      <DropdownMenuItem key={value} onClick={() => setStatusFilter(value)}>
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedAssets.length > 0 && (
                  <Button 
                    variant="default" 
                    className="gap-2 w-full md:w-auto"
                    onClick={() => setBulkActionsOpen(true)}
                  >
                    <Boxes className="h-4 w-4" />
                    {t('bulk_actions')} ({selectedAssets.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Mobile Filter Toggle */}
            {isMobile && (
              <div className="mb-4">
                <Button 
                  variant="outline" 
                  className="w-full flex items-center justify-between"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                >
                  <span className="flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    {t('filters_search')}
                  </span>
                  {showMobileFilters ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            
            {/* Mobile Filters */}
            {isMobile && showMobileFilters && (
              <div className="space-y-3 mb-4 p-3 bg-muted/30 rounded-lg">
                <div className="relative w-full">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('search_assets')}
                    className="pl-8 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="relative w-full">
                  <LocateFixed className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('search_by_location')}
                    className="pl-8 w-full"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Filter className="mr-2 h-4 w-4" />
                        {statusFilter ? statusLabels(t)[statusFilter] : t('all_status')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                        {t('all_status')}
                      </DropdownMenuItem>
                      {Object.entries(statusLabels(t)).map(([value, label]) => (
                        <DropdownMenuItem key={value} onClick={() => setStatusFilter(value)}>
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {selectedAssets.length > 0 && (
                    <Button 
                      variant="default" 
                      className="gap-2"
                      onClick={() => setBulkActionsOpen(true)}
                    >
                      <Boxes className="h-4 w-4" />
                      {t('bulk_actions').split(' ')[0]} ({selectedAssets.length})
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-auto lg:h-[calc(100vh-20rem)]">
              {/* Map View */}
              <div className="lg:col-span-2 order-2 lg:order-1">
                <Card className="h-full">
                  <div className="relative" style={{ height: isMobile ? mapHeight : '100%' }}>
                    {/* Mobile instructions */}
                    <div className="lg:hidden absolute top-2 left-2 right-2 z-10 bg-white/90 dark:bg-slate-900/90 p-3 rounded-md shadow-md text-xs">
                      <h4 className="font-semibold text-center mb-1">{t('map_controls')}</h4>
                      <ul className="space-y-1 list-disc pl-4">
                        <li>{t('tap_markers_to_view')}</li>
                        <li>{t('use_two_fingers')}</li>
                        <li>{t('drag_with_one_finger')}</li>
                        <li>{t('tap_the_checkbox')}</li>
                      </ul>
                    </div>
                    {hasMapboxToken ? (
                      <Map
                        {...viewState}
                        onMove={evt => setViewState(evt.viewState)}
                        mapboxAccessToken={mapboxToken}
                        style={{ width: "100%", height: "100%" }}
                        mapStyle="mapbox://styles/mapbox/streets-v11"
                        maxBounds={[[QATAR_BOUNDS.minLng, QATAR_BOUNDS.minLat], [QATAR_BOUNDS.maxLng, QATAR_BOUNDS.maxLat]]}
                        interactiveLayerIds={showClusters ? ['clusters'] : undefined}
                        touchZoomRotate={true}
                        dragRotate={false}
                      >
                        <NavigationControl position="top-right" />
                        
                        {showClusters && filteredAssets.length > 0 && (
                          <Source
                            id="assets"
                            type="geojson"
                            data={getClusterData()}
                            cluster={true}
                            clusterMaxZoom={14}
                            clusterRadius={50}
                          >
                            <Layer {...mapLayerStyles.clusters.circles} />
                            <Layer {...mapLayerStyles.clusters.count} />
                            <Layer {...mapLayerStyles.clusters.unclustered} />
                          </Source>
                        )}
                        
                        {(!showClusters && filteredAssets.map((asset) => (
                          <Marker
                            key={asset.id}
                            latitude={asset.location.latitude}
                            longitude={asset.location.longitude}
                            onClick={e => {
                              e.originalEvent.stopPropagation();
                              setSelectedAsset(asset);
                              setShowPopup(true);
                            }}
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="cursor-pointer transform transition-transform hover:scale-110 relative">
                                    <div 
                                      className={`w-8 h-8 md:w-10 md:h-10 ${statusColors[asset.status] || 'bg-primary'} rounded-full flex items-center justify-center text-white text-sm md:text-base shadow-lg border-2 ${selectedAssets.includes(asset.id) ? 'border-blue-500' : 'border-white'} touch-manipulation`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAsset(asset);
                                        setShowPopup(true);
                                      }}
                                      style={{ touchAction: "manipulation" }}
                                    >
                                      {asset.name[0]}
                                    </div>
                                    <div 
                                      className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer touch-manipulation"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAssets(prev => 
                                          prev.includes(asset.id) 
                                            ? prev.filter(id => id !== asset.id)
                                            : [...prev, asset.id]
                                        );
                                      }}
                                      style={{ touchAction: "manipulation" }}
                                    >
                                      {selectedAssets.includes(asset.id) ? (
                                        <CheckSquare className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                                      ) : (
                                        <Square className="h-3 w-3 md:h-4 md:w-4 text-gray-400" />
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{asset.name}</p>
                                  <p className="text-xs">{statusLabels(t)[asset.status]}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Marker>
                        )))}

                        {selectedAsset && showPopup && (
                          <Popup
                            latitude={selectedAsset.location.latitude}
                            longitude={selectedAsset.location.longitude}
                            onClose={() => setShowPopup(false)}
                            closeButton={true}
                            closeOnClick={false}
                            className="w-80"
                            maxWidth="320px"
                          >
                            <div className="p-3">
                            {/* Header with asset name and status */}
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-semibold text-lg">{selectedAsset.name}</h3>
                                <Badge 
                                  className={`${statusColors[selectedAsset.status]} text-white mt-1`}
                                >
                                  {statusLabels(t)[selectedAsset.status]}
                                </Badge>
                              </div>
                              <QuickActionsMenu 
                                asset={selectedAsset} 
                                onViewDetails={() => handleViewAssetDetails(selectedAsset.id)}
                                onMoveAsset={() => {
                                  setAssetToMove(selectedAsset);
                                  setMoveAssetOpen(true);
                                  setShowPopup(false);
                                }}
                                onShareLocation={() => {
                                  setAssetToShare(selectedAsset);
                                  setShareLocationOpen(true);
                                }}
                                onReportIssue={() => {
                                  setAssetToReport(selectedAsset);
                                  setReportIssueOpen(true);
                                  setShowPopup(false);
                                }}
                                t={t}
                              />
                            </div>
                            
                            {/* Asset Image */}
                            {selectedAsset.imageUrl ? (
                              <div className="mb-3 rounded-md overflow-hidden border border-border">
                                <div className="relative aspect-video w-full">
                                  <img 
                                    src={selectedAsset.imageUrl} 
                                    alt={selectedAsset.name}
                                    className="object-cover w-full h-full"
                                    onError={(e) => {
                                      // Fallback if image fails to load
                                      (e.target as HTMLImageElement).src = '/images/rect.png';
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="mb-3 rounded-md overflow-hidden border border-border bg-muted/30">
                                <div className="relative aspect-video w-full flex items-center justify-center">
                                  <div className="text-muted-foreground flex flex-col items-center">
                                    <Box className="h-8 w-8 mb-1" />
                                    <span className="text-xs">{t('no_image_available')}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Asset details */}
                            <div className="space-y-2 mb-3">
                              {/* Location info */}
                              {selectedAsset.location.address && (
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                  <p className="text-sm text-muted-foreground">{selectedAsset.location.address}</p>
                                </div>
                              )}
                              
                              {/* Building info */}
                              {(selectedAsset.floorNumber || selectedAsset.roomNumber) && (
                                <div className="flex items-start gap-2">
                                  <Building className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                  <div>
                                    {selectedAsset.floorNumber && (
                                      <p className="text-sm text-muted-foreground">{t('floor')}: {selectedAsset.floorNumber}</p>
                                    )}
                                    {selectedAsset.roomNumber && (
                                      <p className="text-sm text-muted-foreground">{t('room')}: {selectedAsset.roomNumber}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Last updated */}
                              <div className="flex items-start gap-2">
                                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm text-muted-foreground">
                                  {t('last_updated')}: {formatDate(selectedAsset.lastUpdated || selectedAsset.createdAt)}
                                </p>
                              </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex gap-2">
                              <Button 
                                className="flex-1" 
                                size="sm"
                                onClick={() => handleViewAssetDetails(selectedAsset.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" /> {t('view_details')}
                              </Button>
                              <Button 
                                className="flex-1" 
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAssetToMove(selectedAsset);
                                  setMoveAssetOpen(true);
                                  setShowPopup(false);
                                }}
                              >
                                <MoveHorizontal className="h-4 w-4 mr-1" /> {t('move_asset')}
                              </Button>
                            </div>
                            </div>
                          </Popup>
                        )}
                      </Map>
                    ) : (
                      <div className="h-full w-full p-4 md:p-6 bg-muted/20">
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 mb-4">
                          <p className="font-semibold mb-1">{t('map_controls')}: Map disabled</p>
                          <p className="text-sm">
                            Missing <code>NEXT_PUBLIC_MAPBOX_TOKEN</code>. Add it to <code>.env</code> to enable interactive map rendering.
                          </p>
                        </div>
                        <ScrollArea className="h-[calc(100%-5.5rem)]">
                          <div className="space-y-2">
                            {filteredAssets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                className="w-full text-left rounded-md border p-3 hover:bg-muted/40"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowPopup(false);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{asset.name}</span>
                                  <Badge className={`${statusColors[asset.status] || 'bg-primary'} text-white`}>
                                    {statusLabels(t)[asset.status]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {asset.location.latitude.toFixed(5)}, {asset.location.longitude.toFixed(5)}
                                </p>
                              </button>
                            ))}
                            {filteredAssets.length === 0 && (
                              <p className="text-sm text-muted-foreground">{t('no_assets_found')}</p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                    
                    {/* Map Controls removed - clustering permanently disabled */}
                  </div>
                </Card>
              </div>

              {/* Asset Details Panel */}
              <Card className="h-full order-1 lg:order-2">
                <CardHeader className="pb-2">
                  <CardTitle>{selectedAsset ? t('asset_details') : t('select_an_asset')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[calc(100vh-25rem)] lg:h-[calc(100vh-25rem)] md:h-[300px] h-[250px]">
                    {selectedAsset ? (
                      <div className="space-y-6">
                        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                          <TabsList className="grid w-full grid-cols-2 h-auto">
                            <TabsTrigger value="details" className="py-2 px-0">
                              <span className="flex items-center gap-1">
                                <Info className="h-4 w-4" />
                                <span>{t('details')}</span>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger value="history" className="py-2 px-0">
                              <span className="flex items-center gap-1">
                                <History className="h-4 w-4" />
                                <span>{t('history')}</span>
                              </span>
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="details" className="space-y-6">
                            <div>
                              <h3 className="text-2xl font-bold mb-2">{selectedAsset.name}</h3>
                              <Badge variant="outline">
                                {statusLabels(t)[selectedAsset.status]}
                              </Badge>
                            </div>

                            {selectedAsset.description && (
                              <div className="flex items-start gap-2">
                                <Info className="w-5 h-5 mt-1 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">{selectedAsset.description}</p>
                              </div>
                            )}

                            {selectedAsset.location.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-5 h-5 mt-1 text-muted-foreground" />
                                <p className="text-sm">{selectedAsset.location.address}</p>
                              </div>
                            )}

                            {(selectedAsset.floorNumber || selectedAsset.roomNumber) && (
                              <div className="flex items-start gap-2">
                                <Building className="w-5 h-5 mt-1 text-muted-foreground" />
                                <div>
                                  {selectedAsset.floorNumber && (
                                    <p className="text-sm">{t('floor')}: {selectedAsset.floorNumber}</p>
                                  )}
                                  {selectedAsset.roomNumber && (
                                    <p className="text-sm">{t('room')}: {selectedAsset.roomNumber}</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {selectedAsset.purchaseAmount && (
                              <div className="flex items-start gap-2">
                                <DollarSign className="w-5 h-5 mt-1 text-muted-foreground" />
                                <p className="text-sm">{t('purchase_amount')}: ${selectedAsset.purchaseAmount.toFixed(2)}</p>
                              </div>
                            )}

                            <div className="flex items-start gap-2">
                              <Calendar className="w-5 h-5 mt-1 text-muted-foreground" />
                              <div>
                                <p className="text-sm">{t('registered')}: {formatDate(selectedAsset.createdAt)}</p>
                                <p className="text-sm">{t('last_updated')}: {formatDate(selectedAsset.lastUpdated || selectedAsset.createdAt)}</p>
                              </div>
                            </div>

                            <Separator />

                            <div className="flex gap-2">
                              <Button 
                                className="flex-1"
                                onClick={() => handleViewAssetDetails(selectedAsset.id)}
                              >
                                {t('view_details')}
                              </Button>
                            </div>
                          </TabsContent>
                          <TabsContent value="history">
                            <div className="space-y-4">
                              {selectedAsset.history?.map((event) => (
                                <div key={event.id} className="border-l-2 border-muted pl-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    <p className="font-medium">{event.action}</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{event.details}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(event.timestamp)}</p>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
                        <MapPin className="w-12 h-12 mb-4" />
                        <p>{t('select_an_asset_on_the_map')}</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}