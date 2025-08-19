import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Boxes, MoveHorizontal, Tag, AlertTriangle } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  status: string;
}

interface AssetBulkActionsDialogProps {
  assets: Asset[];
  selectedAssets: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
}

export function AssetBulkActionsDialog({ 
  assets,
  selectedAssets,
  open, 
  onOpenChange,
  onActionComplete
}: AssetBulkActionsDialogProps) {
  const [activeTab, setActiveTab] = useState("move");
  const [floorNumber, setFloorNumber] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const selectedAssetObjects = assets.filter(asset => selectedAssets.includes(asset.id));

  const handleMoveAssets = async () => {
    if (!floorNumber || !roomNumber) {
      toast({
        title: "Missing information",
        description: "Floor number and room number are required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const results = await Promise.allSettled(
        selectedAssets.map(assetId => 
          fetch(`/api/assets/${assetId}/move`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              floorNumber,
              roomNumber,
              reason: reason || undefined,
            }),
          })
        )
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        toast({
          title: "Partial success",
          description: `Moved ${successful} assets, but failed to move ${failed} assets.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Assets moved successfully",
          description: `${successful} assets have been moved to Floor ${floorNumber}, Room ${roomNumber}`,
        });
      }
      
      onActionComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error moving assets:", error);
      toast({
        title: "Failed to move assets",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!status) {
      toast({
        title: "Missing information",
        description: "Status is required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // This is a placeholder - you would need to create an API endpoint for bulk status updates
      toast({
        title: "Feature not implemented",
        description: "Bulk status update is not yet implemented",
        variant: "destructive",
      });
      
      // onActionComplete();
      // onOpenChange(false);
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast({
        title: "Failed to update asset status",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === "move") {
      await handleMoveAssets();
    } else if (activeTab === "status") {
      await handleUpdateStatus();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Bulk Actions ({selectedAssets.length} assets)
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <ScrollArea className="max-h-[150px] border rounded-md p-2">
            <div className="space-y-2">
              {selectedAssetObjects.map(asset => (
                <div key={asset.id} className="flex items-center justify-between">
                  <span>{asset.name}</span>
                  <span className="text-xs text-muted-foreground">{asset.status}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="move" className="flex items-center gap-2">
                <MoveHorizontal className="h-4 w-4" />
                Move Assets
              </TabsTrigger>
              <TabsTrigger value="status" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Update Status
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="move" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="floorNumber">Floor Number</Label>
                  <Input
                    id="floorNumber"
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(e.target.value)}
                    placeholder="e.g. 1, 2, 3"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="roomNumber">Room Number</Label>
                  <Input
                    id="roomNumber"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 101, 102"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Move (Optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are these assets being moved?"
                  rows={3}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="status" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="status">New Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Available</SelectItem>
                    <SelectItem value="IN_TRANSIT">In Use</SelectItem>
                    <SelectItem value="DISPOSED">Disposed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center p-3 bg-yellow-50 rounded-md border border-yellow-200">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                <p className="text-sm text-yellow-700">
                  This feature is not yet fully implemented. Please use individual asset actions instead.
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || (activeTab === "status")}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                activeTab === "move" ? "Move Assets" : "Update Status"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}