import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import BatchPrintBarcodeDialog from './BatchPrintBarcodeDialog';

type Asset = {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  barcode: string;
  type: string;
  imageUrl?: string;
  floorNumber?: string;
  roomNumber?: string;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'DISPOSED';
  vendor?: { name: string };
  vendorId: string;
  purchaseAmount?: number;
  purchaseDate?: string;
};

interface AssetDuplicateButtonProps {
  asset: Asset;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  onDuplicationComplete?: () => void;
}

const AssetDuplicateButton: React.FC<AssetDuplicateButtonProps> = ({
  asset,
  variant = "ghost",
  size = "icon",
  className = "h-8 w-8",
  onDuplicationComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState<number>(1);
  const [sameRoom, setSameRoom] = useState<boolean>(true);
  const [floorNumber, setFloorNumber] = useState<string>(asset.floorNumber || "");
  const [roomNumber, setRoomNumber] = useState<string>(asset.roomNumber || "");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [duplicatedAssets, setDuplicatedAssets] = useState<any[]>([]);
  const [showBatchPrintDialog, setShowBatchPrintDialog] = useState<boolean>(false);
  
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setCount(value);
    }
  };

  const handleDuplicate = async () => {
    if (count <= 0) {
      toast({
        title: t("error"),
        description: t("please_enter_valid_count"),
        variant: "destructive",
      });
      return;
    }

    if (!sameRoom && (!floorNumber || !roomNumber)) {
      toast({
        title: t("error"),
        description: t("please_enter_floor_and_room_numbers"),
        variant: "destructive",
      });
      return;
    }

    // Check if vendorId is available
    if (!asset.vendorId) {
      toast({
        title: t("error"),
        description: "Vendor information is missing. Cannot duplicate asset.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare the duplication data
      const duplicationData = {
        count,
        name: asset.name,
        description: asset.description || "",
        type: asset.type,
        vendorId: asset.vendorId,
        floorNumber: sameRoom ? asset.floorNumber : floorNumber,
        roomNumber: sameRoom ? asset.roomNumber : roomNumber,
        purchaseAmount: asset.purchaseAmount?.toString(),
        purchaseDate: asset.purchaseDate,
        imageUrl: asset.imageUrl, // Include the imageUrl for duplication
      };
      
      console.log("Sending duplication data:", duplicationData);
      
      // Call the API to duplicate assets
      const response = await fetch("/api/assets/duplicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(duplicationData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || 
          errorData?.error || 
          "Failed to duplicate assets"
        );
      }
      
      const assets = await response.json();
      setDuplicatedAssets(assets);
      toast({
        title: t("success"),
        description: `${count} ${t("assets_duplicated_successfully")}`,
      });
      
      // Show batch print dialog after successful duplication
      setShowBatchPrintDialog(true);
      setIsOpen(false);
      
      // Call the onDuplicationComplete callback if provided
      if (onDuplicationComplete) {
        onDuplicationComplete();
      }
    } catch (error) {
      console.error("Error duplicating assets:", error);
      toast({
        title: t("error"),
        description: error instanceof Error 
          ? error.message 
          : t("failed_to_duplicate_assets"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseBatchPrintDialog = () => {
    setShowBatchPrintDialog(false);
    // Reset the form
    setCount(1);
    setSameRoom(true);
    setFloorNumber(asset.floorNumber || "");
    setRoomNumber(asset.roomNumber || "");
  };

  return (
    <>
      {size === "default" ? (
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          title="Duplicate Asset"
        >
          <Copy className="h-4 w-4 mr-2" />
          Duplicate Asset
        </Button>
      ) : (
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          title="Duplicate Asset"
        >
          <Copy className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Duplicate Asset</DialogTitle>
            <DialogDescription>
              Create multiple copies of "{asset.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="count" className="text-right">
                Quantity
              </Label>
              <Input
                id="count"
                type="number"
                min="1"
                value={count}
                onChange={handleCountChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Type</Label>
              <div className="col-span-3 text-sm">
                {asset.type === 'FURNITURE' ? 'Furniture' : 
                 asset.type === 'EQUIPMENT' ? 'Equipment' : 
                 asset.type === 'ELECTRONICS' ? 'Electronics' : asset.type}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Location</Label>
              <div className="col-span-3">
                <RadioGroup 
                  defaultValue="same" 
                  className="space-y-3"
                  onValueChange={(value) => {
                    setSameRoom(value === "same");
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="same" id="same-room" />
                    <Label htmlFor="same-room" className="font-normal">
                      Same room (Floor {asset.floorNumber}, Room {asset.roomNumber})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="different" id="different-room" />
                    <Label htmlFor="different-room" className="font-normal">
                      Different room
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            
            {!sameRoom && (
              <div className="grid grid-cols-4 items-center gap-4">
                <div></div>
                <div className="col-span-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="floor-number">Floor Number</Label>
                      <Input
                        id="floor-number"
                        value={floorNumber}
                        onChange={(e) => {
                          e.stopPropagation();
                          setFloorNumber(e.target.value);
                        }}
                        placeholder="Floor"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="room-number">Room Number</Label>
                      <Input
                        id="room-number"
                        value={roomNumber}
                        onChange={(e) => {
                          e.stopPropagation();
                          setRoomNumber(e.target.value);
                        }}
                        placeholder="Room"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDuplicate} 
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Duplicating...
                </>
              ) : (
                <>Submit</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showBatchPrintDialog && (
        <BatchPrintBarcodeDialog
          isOpen={showBatchPrintDialog}
          onClose={handleCloseBatchPrintDialog}
          assets={duplicatedAssets}
        />
      )}
    </>
  );
};

export default AssetDuplicateButton;