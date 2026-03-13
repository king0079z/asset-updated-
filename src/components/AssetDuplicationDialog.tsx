import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Printer } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import BatchPrintBarcodeDialog from './BatchPrintBarcodeDialog';

interface AssetDuplicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assetType: string;
  roomNumber: string;
  floorNumber: string;
  vendorId: string;
  onDuplicate: (count: number) => Promise<any[]>;
}

const AssetDuplicationDialog: React.FC<AssetDuplicationDialogProps> = ({
  isOpen,
  onClose,
  assetType,
  roomNumber,
  floorNumber,
  vendorId,
  onDuplicate
}) => {
  const [count, setCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [duplicatedAssets, setDuplicatedAssets] = useState<any[]>([]);
  const [showBatchPrintDialog, setShowBatchPrintDialog] = useState<boolean>(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsSubmitting(true);
    try {
      const assets = await onDuplicate(count);
      setDuplicatedAssets(assets);
      toast({
        title: t("success"),
        description: `${count} ${t("assets_duplicated_successfully")}`,
      });
      
      // Show batch print dialog after successful duplication
      setShowBatchPrintDialog(true);
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
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Duplicate Assets</DialogTitle>
            <DialogDescription>
              Create multiple identical assets in the same room.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="count" className="text-right">
                Count
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
                {assetType === 'FURNITURE' ? 'Furniture' : 
                 assetType === 'EQUIPMENT' ? 'Equipment' : 
                 assetType === 'ELECTRONICS' ? 'Electronics' : assetType}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Location</Label>
              <div className="col-span-3 text-sm">
                Floor {floorNumber}, Room {roomNumber}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
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
                <>
                  <Copy className="h-4 w-4" />
                  Duplicate Assets
                </>
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

export default AssetDuplicationDialog;