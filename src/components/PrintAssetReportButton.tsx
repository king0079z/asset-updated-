import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { printContent } from "@/util/print";
import { useTranslation } from "@/contexts/TranslationContext";

interface Asset {
  id: string;
  assetId?: string;
  name: string;
  description?: string;
  barcode?: string;
  type?: string;
  imageUrl?: string;
  status?: string;
  purchaseAmount?: number;
  purchaseDate?: string;
  lastMovedAt?: string | Date;
  location?: {
    id: string;
    building?: string;
    floorNumber?: string;
    roomNumber?: string;
  };
  vendor?: {
    id: string;
    name: string;
  };
  floorNumber?: string;
  roomNumber?: string;
}

interface PrintAssetReportButtonProps {
  asset: Asset;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

export function PrintAssetReportButton({
  asset,
  variant = "outline",
  size = "sm",
  className = "",
  children,
  onClick
}: PrintAssetReportButtonProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const handlePrintReport = async (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
    
    if (!asset) return;
    
    try {
      setIsPrinting(true);
      setShowPrintDialog(true);
      setProgress(10);
      
      // Fetch asset history
      setProgress(20);
      const historyResponse = await fetch(`/api/assets/${asset.id}/history`);
      if (!historyResponse.ok) {
        console.error('Failed to fetch asset history:', await historyResponse.text());
        throw new Error(t('failed_to_fetch_asset_history'));
      }
      const historyData = await historyResponse.json();
      console.log('Asset history data fetched:', { 
        count: historyData.history ? historyData.history.length : 0,
        sample: historyData.history && historyData.history.length > 0 ? historyData.history[0] : null
      });
      setProgress(40);
      
      // Fetch asset tickets
      const ticketsResponse = await fetch(`/api/assets/${asset.id}/tickets`);
      if (!ticketsResponse.ok) {
        console.warn('Failed to fetch tickets, continuing without tickets data:', await ticketsResponse.text());
      }
      const ticketsData = ticketsResponse.ok ? await ticketsResponse.json() : [];
      console.log('Asset tickets data fetched:', { 
        count: ticketsData ? ticketsData.length : 0,
        sample: ticketsData && ticketsData.length > 0 ? ticketsData[0] : null
      });
      setProgress(60);
      
      // Fetch asset health data
      const healthResponse = await fetch(`/api/assets/${asset.id}/health`);
      if (!healthResponse.ok) {
        console.warn('Failed to fetch health data, continuing without health data');
      }
      
      let healthData;
      try {
        healthData = healthResponse.ok ? await healthResponse.json() : { 
          healthScore: 0,
          healthFactors: {
            age: 0,
            maintenance: 0,
            usage: 0,
            condition: 0
          }
        };
        
        // Ensure healthFactors is properly structured
        if (healthData && typeof healthData.healthFactors !== 'object') {
          console.warn('Health factors data is not in expected format, using default values');
          healthData.healthFactors = {
            age: 0,
            maintenance: 0,
            usage: 0,
            condition: 0
          };
        }
      } catch (error) {
        console.error('Error parsing health data:', error);
        healthData = { 
          healthScore: 0,
          healthFactors: {
            age: 0,
            maintenance: 0,
            usage: 0,
            condition: 0
          }
        };
      }
      
      setProgress(80);
      
      // Prepare asset data with all details
      // Handle the nested structure from the API response
      let healthScore = 0;
      let healthFactors = {
        age: 0,
        maintenance: 0,
        usage: 0,
        condition: 0
      };
      
      // Check if healthData has a nested healthScore object or a direct healthScore value
      if (healthData && typeof healthData.healthScore === 'object' && healthData.healthScore !== null) {
        // Handle nested structure: { healthScore: { score: number, factors: object } }
        healthScore = typeof healthData.healthScore.score === 'number' ? healthData.healthScore.score : 0;
        healthFactors = typeof healthData.healthScore.factors === 'object' ? healthData.healthScore.factors : healthFactors;
      } else if (healthData && typeof healthData.healthScore === 'number') {
        // Handle flat structure: { healthScore: number, healthFactors: object }
        healthScore = healthData.healthScore;
        healthFactors = typeof healthData.healthFactors === 'object' ? healthData.healthFactors : healthFactors;
      }
      
      console.log('Health data processed:', { healthScore, healthFactors });
      
      // Make sure we're extracting the history array from the historyData response
      const history = historyData && historyData.history ? historyData.history : [];
      
      const assetWithDetails = {
        ...asset,
        tickets: ticketsData,
        history: history,
        healthScore: healthScore,
        healthFactors: healthFactors
      };
      
      console.log('Asset with details prepared for report:', {
        id: assetWithDetails.id,
        name: assetWithDetails.name,
        historyCount: assetWithDetails.history.length,
        ticketsCount: assetWithDetails.tickets.length,
        healthScore: assetWithDetails.healthScore
      });
      
      // Import the AssetReportDetailed component
      const { AssetReportDetailed } = await import('@/components/AssetReportDetailed');
      const { renderToString } = await import('react-dom/server');
      
      // Render the component to HTML string
      const reportHtml = renderToString(
        <AssetReportDetailed 
          assets={[assetWithDetails]} 
          isFullReport={false} 
        />
      );
      
      setProgress(90);
      
      // Print the report
      await printContent(reportHtml, `${t('asset_report')} - ${asset.name}`);
      
      setProgress(100);
      
      // Success toast
      toast({
        title: t('report_generated'),
        description: t('asset_report_has_been_generated_successfully'),
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_generate_asset_report'),
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
        setShowPrintDialog(false);
        setProgress(0);
      }, 500);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handlePrintReport}
        disabled={isPrinting}
      >
        {children || (
          <>
            <Printer className="h-4 w-4 mr-2" />
            <span>{t('print_report')}</span>
          </>
        )}
      </Button>
      
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('generating_asset_report')}</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="mb-4 text-center">
              <p className="text-muted-foreground mb-2">
                {progress < 100 
                  ? t('please_wait_while_we_prepare_your_detailed_asset_report') 
                  : t('report_generated_successfully_printing')}
              </p>
            </div>
            <Progress value={progress} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('collecting_data')}</span>
              <span>{progress}%</span>
              <span>{t('printing')}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}