import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  AlertTriangle, 
  Calendar, 
  Tag, 
  Truck, 
  History,
  Edit,
  Utensils,
  Leaf,
  Trash2,
  ChefHat
} from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { ConsumptionHistoryDialog } from "@/components/ConsumptionHistoryDialog";
import { EditFoodSupplyDialog } from "@/components/EditFoodSupplyDialog";
import { EnhancedWasteTrackingDialog } from "@/components/EnhancedWasteTrackingDialog";
import { WasteHistoryDialog } from "@/components/WasteHistoryDialog";
import { NutritionalInfoDialog } from "@/components/NutritionalInfoDialog";

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expirationDate: string;
  pricePerUnit: number;
  totalWasted?: number;
  notes?: string;
  vendor?: {
    id: string;
    name: string;
  } | null;
}

interface FoodSupplyMobileCardProps {
  supply: FoodSupply;
  categories: Array<{ value: string; label: string; color: string }>;
  onUpdate: () => void;
}

export function FoodSupplyMobileCard({ 
  supply, 
  categories,
  onUpdate
}: FoodSupplyMobileCardProps) {
  const { t } = useTranslation();
  const category = categories.find(c => c.value === supply.category);
  const expirationDate = new Date(supply.expirationDate);
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  const getExpirationStatus = () => {
    if (daysUntilExpiration <= 7) {
      return {
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    } else if (daysUntilExpiration <= 30) {
      return {
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    } else {
      return {
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: <Calendar className="h-4 w-4" />
      };
    }
  };

  const expirationStatus = getExpirationStatus();

  return (
    <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${category?.color || 'bg-gray-100'}`}>
              <Package className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base line-clamp-1">{supply.name}</CardTitle>
              <Badge className={category?.color || 'bg-gray-100'}>
                {category?.label || supply.category}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2 pt-0">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">QAR {supply.pricePerUnit}</span>
            <span className="text-muted-foreground">/ {supply.unit}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{supply.quantity}</span>
            <span className="text-muted-foreground">{supply.unit}</span>
            {supply.totalWasted > 0 && (
              <Badge variant="outline" className="ml-1 bg-red-50 text-red-700 text-xs">
                {supply.totalWasted} {t('wasted')}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium line-clamp-1">{t('vendor')}: {supply.vendor?.name || t('unknown')}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`flex items-center gap-1 ${expirationStatus.color}`}>
              {expirationStatus.icon}
              <span>{daysUntilExpiration} {t('days')}</span>
            </Badge>
          </div>
        </div>
        
        {supply.notes && (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            {supply.notes}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-wrap justify-between gap-2 p-2 bg-muted/10">
        <ConsumptionHistoryDialog 
          foodSupplyId={supply.id} 
          foodSupplyName={supply.name}
          buttonVariant="outline"
          buttonSize="sm"
          buttonClassName="flex-1 h-9"
          showIcon={true}
        />
        
        <EditFoodSupplyDialog
          foodSupplyId={supply.id}
          currentPrice={supply.pricePerUnit}
          onUpdate={onUpdate}
          buttonVariant="outline"
          buttonSize="sm"
          buttonClassName="flex-1 h-9"
          showIcon={true}
        />
        
        <div className="flex gap-1 flex-1">
          <EnhancedWasteTrackingDialog
            foodSupplyId={supply.id}
            foodSupplyName={supply.name}
            unit={supply.unit}
            onWasteRecorded={onUpdate}
          />
          
          <WasteHistoryDialog
            foodSupplyId={supply.id}
            foodSupplyName={supply.name}
            onRefresh={onUpdate}
          />
        </div>
        
        <NutritionalInfoDialog
          foodSupplyId={supply.id}
          foodSupplyName={supply.name}
          onUpdate={onUpdate}
        />
      </CardFooter>
    </Card>
  );
}