import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer, FileText, Brain } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PrintLoadingAnimation } from './PrintLoadingAnimation';
import { KitchenAIRecommendations } from './KitchenAIRecommendations';
import { DetailedFoodConsumptionAnalysis } from './DetailedFoodConsumptionAnalysis';
import { DetailedWasteAnalysis } from './DetailedWasteAnalysis';
import { DirectPrintKitchenReport } from './DirectPrintKitchenReport';

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  prepTime: number;
  ingredients: any[];
  instructions: string;
  totalCost: number;
  costPerServing: number;
  sellingPrice?: number;
  usageCount?: number;
}

interface KitchenInfo {
  id: string;
  name: string;
  floorNumber: string;
  description?: string;
}

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  pricePerUnit: number;
  expirationDate: string;
  totalWasted: number;
}

interface EnhancedKitchenReportButtonProps {
  kitchen: KitchenInfo;
  recipes: Recipe[];
  foodSupplies: FoodSupply[];
  expiringItems: FoodSupply[];
  lowStockItems: FoodSupply[];
}

export function EnhancedKitchenReportButton({ 
  kitchen, 
  recipes, 
  foodSupplies, 
  expiringItems, 
  lowStockItems 
}: EnhancedKitchenReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showDirectPrint, setShowDirectPrint] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handlePrint = () => {
    setIsPrinting(true);
    setShowDirectPrint(true);
  };

  const handlePrintComplete = () => {
    setShowDirectPrint(false);
    setIsPrinting(false);
    setOpen(false);
    
    toast({
      title: t('report_generated'),
      description: t('kitchen_report_generated_successfully'),
    });
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      <Button 
        variant="outline" 
        className="flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Printer className="h-4 w-4" />
        {t('print_report')}
      </Button>
      
      {/* Direct print component that renders when printing is triggered */}
      {showDirectPrint && (
        <DirectPrintKitchenReport
          kitchen={kitchen}
          recipes={recipes}
          foodSupplies={foodSupplies}
          expiringItems={expiringItems}
          lowStockItems={lowStockItems}
          onPrintComplete={handlePrintComplete}
        />
      )}
      
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isPrinting) {
          setOpen(isOpen);
        }
      }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('enhanced_kitchen_report')} - {kitchen.name}
            </DialogTitle>
          </DialogHeader>
          
          {isPrinting ? (
            <div className="flex flex-col items-center justify-center py-12">
              <PrintLoadingAnimation />
              <p className="mt-4 text-muted-foreground">{t('generating_report')}</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 max-h-[60vh]">
                <div className="p-6">
                  {/* Preview of the report */}
                  <div className="report-header">
                    <div className="report-title">Kitchen Performance Report</div>
                    <div className="report-subtitle">{kitchen.name} - Floor {kitchen.floorNumber}</div>
                    <div className="report-date">Generated on: {formatDate(new Date())}</div>
                  </div>
                  
                  {/* AI Recommendations */}
                  <KitchenAIRecommendations 
                    kitchenId={kitchen.id}
                    kitchenName={kitchen.name}
                    recipes={recipes}
                    foodSupplies={foodSupplies}
                  />
                  
                  {/* Detailed Food Consumption Analysis */}
                  <DetailedFoodConsumptionAnalysis foodSupplies={foodSupplies} />
                  
                  {/* Detailed Waste Analysis */}
                  <DetailedWasteAnalysis foodSupplies={foodSupplies} />
                </div>
              </ScrollArea>
              
              <DialogFooter className="pt-4 border-t">
                <div className="flex items-center mr-auto text-sm text-muted-foreground">
                  <Brain className="h-4 w-4 mr-2 text-purple-600" />
                  AI-powered analysis and recommendations
                </div>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  {t('print_report')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}