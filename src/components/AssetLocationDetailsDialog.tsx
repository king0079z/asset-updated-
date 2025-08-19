import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Box,
  Calendar,
  DollarSign,
  MapPin,
  Info,
  Building,
  Activity,
  Share,
  Edit,
  Check,
  MoveHorizontal,
  Clock,
  User,
  Briefcase,
  Tag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  Eye,
  ExternalLink,
} from "lucide-react";
import { formatDate } from "@/util/string";
import { EditAssetDialog } from "./EditAssetDialog";
import { AssetMovementHistory } from "./AssetMovementHistory";
import { AssetMoveDialog } from "./AssetMoveDialog";

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
}

interface AssetLocationDetailsDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}

export function AssetLocationDetailsDialog({ 
  asset, 
  open, 
  onOpenChange,
  statusLabels,
  statusColors
}: AssetLocationDetailsDialogProps) {
  const [editAssetOpen, setEditAssetOpen] = useState(false);
  const [moveAssetOpen, setMoveAssetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const { toast } = useToast();
  
  if (!asset) return null;

  const handleEditAsset = () => {
    setEditAssetOpen(true);
  };

  const handleMoveAsset = () => {
    setMoveAssetOpen(true);
  };

  const handleShareLocation = () => {
    // Copy location coordinates to clipboard
    const locationText = `${asset.name} Location: ${asset.location.latitude}, ${asset.location.longitude}${asset.location.address ? ` (${asset.location.address})` : ''}`;
    
    navigator.clipboard.writeText(locationText)
      .then(() => {
        toast({
          title: "Location copied to clipboard",
          description: "You can now share this location with others.",
          action: (
            <Button variant="outline" size="sm" className="gap-1">
              <Check className="h-3 w-3" /> Copied
            </Button>
          ),
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Could not copy location to clipboard.",
          variant: "destructive",
        });
      });
  };

  const handleAssetUpdated = () => {
    toast({
      title: "Asset updated",
      description: "The asset details have been successfully updated.",
    });
    // In a real implementation, you would refresh the asset data here
  };
  
  const handleAssetMoved = () => {
    // Switch to the movement history tab
    setActiveTab("movement");
    
    toast({
      title: "Asset moved",
      description: "The asset has been successfully moved to a new location.",
    });
    // In a real implementation, you would refresh the asset data here
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Asset Details</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleEditAsset}
              >
                <Edit className="h-4 w-4" />
                Edit Asset
              </Button>
            </div>
          </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="movement">Movement</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <h3 className="text-xl sm:text-2xl font-semibold">{asset.name}</h3>
                    <Badge className={`${statusColors[asset.status]} text-white`}>
                      {statusLabels[asset.status]}
                    </Badge>
                  </div>
                  {asset.description && (
                    <p className="text-muted-foreground">
                      {asset.description}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {asset.location.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium">Location</p>
                          <p className="text-sm text-muted-foreground break-words">{asset.location.address}</p>
                        </div>
                      </div>
                    )}
                    
                    {(asset.floorNumber || asset.roomNumber) && (
                      <div className="flex items-start gap-2">
                        <Building className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium">Building Details</p>
                          {asset.floorNumber && (
                            <p className="text-sm text-muted-foreground">Floor: {asset.floorNumber}</p>
                          )}
                          {asset.roomNumber && (
                            <p className="text-sm text-muted-foreground">Room: {asset.roomNumber}</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {asset.department && (
                      <div className="flex items-start gap-2">
                        <Box className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium">Department</p>
                          <p className="text-sm text-muted-foreground">{asset.department}</p>
                        </div>
                      </div>
                    )}
                    
                    {asset.assignedTo && (
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium">Assigned To</p>
                          <p className="text-sm text-muted-foreground">{asset.assignedTo}</p>
                        </div>
                      </div>
                    )}
                    
                    {asset.purchaseAmount && (
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium">Purchase Amount</p>
                          <p className="text-sm text-muted-foreground">${asset.purchaseAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2">
                      <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium">Dates</p>
                        <p className="text-sm text-muted-foreground">Registered: {formatDate(asset.createdAt)}</p>
                        <p className="text-sm text-muted-foreground">Last Updated: {formatDate(asset.lastUpdated || asset.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  if (asset.location) {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${asset.location.latitude},${asset.location.longitude}`, '_blank');
                  }
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Open in Google Maps
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="movement">
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <MoveHorizontal className="h-5 w-5" />
                      Current Location
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={handleMoveAsset}
                    >
                      <MoveHorizontal className="h-4 w-4" />
                      Move Asset
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {asset.location.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Address</p>
                          <p className="text-sm text-muted-foreground">{asset.location.address}</p>
                        </div>
                      </div>
                    )}
                    
                    {(asset.floorNumber || asset.roomNumber) && (
                      <div className="flex items-start gap-2">
                        <Building className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Building Details</p>
                          {asset.floorNumber && (
                            <p className="text-sm text-muted-foreground">Floor: {asset.floorNumber}</p>
                          )}
                          {asset.roomNumber && (
                            <p className="text-sm text-muted-foreground">Room: {asset.roomNumber}</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2">
                      <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Last Moved</p>
                        <p className="text-sm text-muted-foreground">
                          {asset.lastUpdated ? formatDate(asset.lastUpdated) : "No movement recorded"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <AssetMovementHistory assetId={asset.id} assetName={asset.name} />
            </div>
          </TabsContent>
          
          <TabsContent value="history">
            <Card>
              <CardContent className="pt-6">
                {asset.history && asset.history.length > 0 ? (
                  <div className="space-y-4">
                    {asset.history.map((event) => (
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No history records found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Edit Asset Dialog */}
    {asset && (
      <EditAssetDialog
        asset={{
          id: asset.id,
          assetId: asset.id,
          name: asset.name,
          description: asset.description || undefined,
          type: asset.department || "General",
          status: asset.status === "AVAILABLE" ? "ACTIVE" : 
                 asset.status === "DISPOSED" ? "DISPOSED" : "IN_TRANSIT",
          floorNumber: asset.floorNumber || undefined,
          roomNumber: asset.roomNumber || undefined,
          purchaseAmount: asset.purchaseAmount || undefined
        }}
        open={editAssetOpen}
        onOpenChange={setEditAssetOpen}
        onAssetUpdated={handleAssetUpdated}
      />
    )}
    
    {/* Move Asset Dialog */}
    {asset && (
      <AssetMoveDialog
        asset={{
          id: asset.id,
          name: asset.name,
          floorNumber: asset.floorNumber,
          roomNumber: asset.roomNumber
        }}
        open={moveAssetOpen}
        onOpenChange={setMoveAssetOpen}
        onAssetMoved={handleAssetMoved}
      />
    )}
  </>
  );
}