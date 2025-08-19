import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Computer, 
  Sofa, 
  MapPin, 
  Truck, 
  Edit,
  Printer,
  Info,
  Trash2,
  MoreVertical,
  RefreshCcw
} from "lucide-react";
import Image from "next/image";
import { useTranslation } from "@/contexts/TranslationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangeAssetStatusDialog } from "@/components/ChangeAssetStatusDialog";
import { PrintAssetReportButton } from "@/components/PrintAssetReportButton";
import AssetDuplicateButton from "@/components/AssetDuplicateButton";

interface Asset {
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
  purchaseAmount?: number;
}

interface AssetMobileCardProps {
  asset: Asset;
  onViewDetails: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onPrintReport: (asset: Asset) => void;
}

export function AssetMobileCard({ 
  asset, 
  onViewDetails, 
  onEdit,
  onPrintReport
}: AssetMobileCardProps) {
  const { t } = useTranslation();
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'FURNITURE':
        return <Sofa className="h-5 w-5 text-blue-700 dark:text-blue-400" />;
      case 'EQUIPMENT':
        return <Package className="h-5 w-5 text-green-700 dark:text-green-400" />;
      case 'ELECTRONICS':
        return <Computer className="h-5 w-5 text-purple-700 dark:text-purple-400" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'IN_TRANSIT':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'DISPOSED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FURNITURE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'EQUIPMENT':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'ELECTRONICS':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400';
    }
  };

  return (
    <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border bg-muted">
              {asset.imageUrl ? (
                <Image
                  src={asset.imageUrl}
                  alt={asset.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                  priority
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  {getAssetIcon(asset.type)}
                </div>
              )}
            </div>
            <div>
              <CardTitle className="text-base line-clamp-1">{asset.name}</CardTitle>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {asset.assetId}
              </code>
            </div>
          </div>
          <Badge className={getStatusColor(asset.status)}>
            {asset.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2 pt-0">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`flex items-center gap-1 ${getTypeColor(asset.type)}`}>
              {getAssetIcon(asset.type)}
              <span>{asset.type}</span>
            </Badge>
          </div>
          
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{t('floor')} {asset.floorNumber}</span>
            <span className="text-muted-foreground">{t('room')} {asset.roomNumber}</span>
          </div>
          
          {asset.vendor && (
            <div className="flex items-center gap-1.5 col-span-2 overflow-hidden">
              <Truck className="h-4 w-4 min-w-[16px] text-muted-foreground" />
              <span className="font-medium truncate">{asset.vendor.name}</span>
            </div>
          )}
          
          {asset.purchaseAmount !== undefined && asset.purchaseAmount !== null && (
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="font-medium">QAR {asset.purchaseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
        
        {asset.description && (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            {asset.description}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between gap-2 p-2 bg-muted/10">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10"
          onClick={() => onViewDetails(asset)}
        >
          <Info className="h-4 w-4 mr-2" />
          <span>{t('asset_details')}</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          onClick={() => setShowStatusDialog(true)}
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          <span>{t('status')}</span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 px-3">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(asset)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('edit')} {t('asset')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <AssetDuplicateButton 
                asset={asset}
                variant="ghost"
                size="default"
                className="flex items-center w-full h-auto p-0 justify-start"
              />
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <PrintAssetReportButton asset={asset}>
                <div className="flex items-center">
                  <Printer className="h-4 w-4 mr-2" />
                  {t('print_report')}
                </div>
              </PrintAssetReportButton>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Status Change Dialog */}
        <ChangeAssetStatusDialog
          asset={asset}
          open={showStatusDialog}
          onOpenChange={setShowStatusDialog}
          onStatusChanged={() => {
            // Refresh the asset data after status change
            if (onViewDetails) {
              onViewDetails(asset);
            }
          }}
        />
      </CardFooter>
    </Card>
  );
}