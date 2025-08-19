import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Printer, QrCode, Barcode } from "lucide-react";
import { printBarcode, CodeType } from '@/util/barcode';
import { useTranslation } from "@/contexts/TranslationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Asset {
  id: string;
  assetId: string;
  name: string;
  barcode: string;
  type: string;
  floorNumber?: string;
  roomNumber?: string;
}

interface BatchPrintBarcodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
}

const BatchPrintBarcodeDialog: React.FC<BatchPrintBarcodeDialogProps> = ({
  isOpen,
  onClose,
  assets
}) => {
  const [selectedAssets, setSelectedAssets] = useState<string[]>(assets.map(asset => asset.id));
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [codeType, setCodeType] = useState<CodeType>('barcode');
  const { toast } = useToast();
  const { t } = useTranslation();

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const toggleAllAssets = () => {
    if (selectedAssets.length === assets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(assets.map(asset => asset.id));
    }
  };

  const handlePrintBatch = async () => {
    if (selectedAssets.length === 0) {
      toast({
        title: t("error"),
        description: t("please_select_at_least_one_asset"),
        variant: "destructive",
      });
      return;
    }

    setIsPrinting(true);
    try {
      // Create a batch HTML content for all selected assets
      const selectedAssetsList = assets.filter(asset => selectedAssets.includes(asset.id));
      
      // Create HTML content for all barcodes
      let batchHtml = `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="text-align: center; font-size: 24px; margin-bottom: 20px;">Asset ${codeType === 'barcode' ? 'Barcodes' : 'QR Codes'}</h1>
      `;
      
      // Create a vertical layout for the codes (one below the other)
      batchHtml += `<div style="display: flex; flex-direction: column; gap: 20px;">`;
      
      // Process each asset in sequence
      for (const asset of selectedAssetsList) {
        // Create a canvas for the barcode or get QR code data URL
        let codeDataUrl;
        
        if (codeType === 'barcode') {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 150;
          
          // Use JsBarcode to generate the barcode
          // This is imported dynamically to ensure it's available in the browser
          const JsBarcode = (await import('jsbarcode')).default;
          JsBarcode(canvas, asset.barcode, {
            format: "CODE128",
            lineColor: "#000",
            width: 2,
            height: 100,
            displayValue: true,
            text: asset.assetId,
            fontSize: 16,
            margin: 10,
            background: "#fff"
          });
          
          codeDataUrl = canvas.toDataURL('image/png');
        } else {
          // Generate QR code
          const QRCode = await import('qrcode');
          codeDataUrl = await QRCode.toDataURL(asset.barcode, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
        }
        
        // Add this code to the batch HTML
        batchHtml += `
          <div style="padding: 15px; border: 1px solid #ccc; border-radius: 5px; background-color: white; page-break-inside: avoid;">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">${asset.name}</div>
            <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
              ${asset.type === 'FURNITURE' ? 'Furniture' : 
                asset.type === 'EQUIPMENT' ? 'Equipment' : 
                asset.type === 'ELECTRONICS' ? 'Electronics' : asset.type}
              ${asset.floorNumber && asset.roomNumber ? ` - Floor ${asset.floorNumber}, Room ${asset.roomNumber}` : ''}
            </div>
            <img src="${codeDataUrl}" alt="${codeType}" style="max-width: 100%; height: auto; margin: 10px 0; display: block;" />
            <div style="font-size: 14px; text-align: center;">${asset.assetId}</div>
          </div>
        `;
      }
      
      batchHtml += `</div></div>`;
      
      // Use the print utility to print the batch
      const { printContent } = await import('@/util/print');
      await printContent(
        batchHtml,
        `Batch ${codeType === 'barcode' ? 'Barcodes' : 'QR Codes'} Print`
      );
      
      toast({
        title: t("success"),
        description: `${selectedAssetsList.length} ${codeType === 'barcode' ? 'barcodes' : 'QR codes'} sent to printer`,
      });
    } catch (error) {
      console.error("Error in batch print:", error);
      toast({
        title: t("print_error"),
        description: t("an_unexpected_error_occurred_while_printing"),
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Print Asset Codes</DialogTitle>
          <DialogDescription>
            Select assets to print barcodes or QR codes in batch.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="barcode" onValueChange={(value) => setCodeType(value as CodeType)}>
          <TabsList className="grid w-full grid-cols-2" onClick={(e) => e.stopPropagation()}>
            <TabsTrigger value="barcode" className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Barcode className="h-4 w-4" />
              Barcodes
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <QrCode className="h-4 w-4" />
              QR Codes
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="py-4">
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox 
              id="select-all" 
              checked={selectedAssets.length === assets.length} 
              onCheckedChange={toggleAllAssets}
              onClick={(e) => e.stopPropagation()}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Select All
            </label>
          </div>
          
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="space-y-4">
              {assets.map((asset) => (
                <div key={asset.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`asset-${asset.id}`} 
                    checked={selectedAssets.includes(asset.id)}
                    onCheckedChange={() => toggleAssetSelection(asset.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label
                    htmlFor={`asset-${asset.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <div className="font-medium">{asset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {asset.assetId} - {asset.type === 'FURNITURE' ? 'Furniture' : 
                                         asset.type === 'EQUIPMENT' ? 'Equipment' : 
                                         asset.type === 'ELECTRONICS' ? 'Electronics' : asset.type}
                      {asset.floorNumber && asset.roomNumber ? ` - Floor ${asset.floorNumber}, Room ${asset.roomNumber}` : ''}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            Cancel
          </Button>
          <Button 
            onClick={(e) => { e.stopPropagation(); handlePrintBatch(); }} 
            disabled={isPrinting || selectedAssets.length === 0}
            className="gap-2"
          >
            {isPrinting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Printing...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Print {selectedAssets.length} {codeType === 'barcode' ? 'Barcode' : 'QR Code'}{selectedAssets.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchPrintBarcodeDialog;