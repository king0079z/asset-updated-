import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Building, ArrowRight, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/contexts/TranslationContext";

interface AssetDetail {
  id: string;
  assetId: string;
  name: string;
  description: string;
  barcode: string;
  type: string;
  imageUrl: string | null;
  floorNumber: number | null;
  roomNumber: string | null;
  status: string;
  purchaseAmount: number;
  vendor: {
    name: string;
  } | null;
  createdAt: string;
}

interface AssetStats {
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  totalValue: number;
  disposedValue: number;
}

interface AssetsOverviewCardProps {
  totalAssets: number;
  assetStats: AssetStats;
}

export function AssetsOverviewCard({ totalAssets = 0, assetStats = { byStatus: [], totalValue: 0, disposedValue: 0 } }: AssetsOverviewCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<AssetDetail[]>([]);
  const { t, dir } = useTranslation();

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/assets', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAssets(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching assets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, []);

  const formatCurrency = (amount: number) => {
    // For large numbers, use abbreviated format
    if (amount >= 1000000) {
      return `QAR ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `QAR ${(amount / 1000).toFixed(1)}K`;
    } else {
      // For smaller numbers, use standard formatting
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'QAR',
        maximumFractionDigits: 0
      }).format(amount);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
      case 'IN_USE':
        return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800';
      case 'MAINTENANCE':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'DISPOSED':
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getLocationDisplay = (floorNumber: number | null, roomNumber: string | null) => {
    if (floorNumber && roomNumber) {
      return `Floor ${floorNumber}, Room ${roomNumber}`;
    } else if (floorNumber) {
      return `Floor ${floorNumber}`;
    } else if (roomNumber) {
      return `Room ${roomNumber}`;
    } else {
      return "No location data";
    }
  };
  
  return (
    <Card className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      <div className="bg-gradient-to-r from-slate-50 to-purple-50 dark:from-slate-800 dark:to-purple-900 p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center">
            <Building className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-5 w-5 text-purple-600 dark:text-purple-400`} />
            {t('assets_overview').replace(/_/g, ' ')}
          </h3>
          <div className="bg-purple-100 dark:bg-purple-800 p-2 rounded-full">
            <Package className="h-5 w-5 text-purple-600 dark:text-purple-300" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
          {totalAssets} {t('assets_tracked')}
        </p>
      </div>
      <CardContent className="p-5 flex-grow dark:bg-card">
        <div className="space-y-4">
          {/* Asset Counts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Active Assets Count */}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700">
              <div className={`flex items-center ${dir === 'rtl' ? 'space-x-reverse' : ''} space-x-2`}>
                <div className="h-3 w-3 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('active')}</p>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {totalAssets}
              </div>
            </div>
            
            {/* Disposed Assets Count */}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700">
              <div className={`flex items-center ${dir === 'rtl' ? 'space-x-reverse' : ''} space-x-2`}>
                <div className="h-3 w-3 rounded-full bg-rose-500 dark:bg-rose-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('disposed')}</p>
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                {assetStats.byStatus.find(s => s.status === 'DISPOSED')?.count || 0}
              </div>
            </div>
          </div>

          {/* Asset Values */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">{t('active_value')}</span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-400">{formatCurrency(assetStats.totalValue)}</span>
            </div>
            <Progress value={100} className="h-2 bg-indigo-100 dark:bg-indigo-900/30" indicatorClassName="bg-indigo-600 dark:bg-indigo-500" />
            
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">{t('disposed_value')}</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(assetStats.disposedValue)}</span>
            </div>
            <Progress 
              value={assetStats.disposedValue > 0 ? 
                (assetStats.disposedValue / (assetStats.totalValue + assetStats.disposedValue)) * 100 : 0} 
              className="h-2 bg-rose-100 dark:bg-rose-900/30" 
              indicatorClassName="bg-rose-500 dark:bg-rose-500" 
            />
          </div>

          {/* Asset Details */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('asset_details')}</h4>
              <Button 
                variant="link" 
                size="sm" 
                className="text-indigo-600 dark:text-indigo-400 p-0 h-auto"
                onClick={() => router.push('/assets')}
              >
                {t('view_all')}
              </Button>
            </div>
            
            <div className="max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
              {isLoading ? (
                <div className="text-center py-2 text-slate-500 dark:text-slate-400">{t('loading_assets')}</div>
              ) : assets.length > 0 ? (
                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div 
                      key={asset.id} 
                      className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all duration-200 cursor-pointer"
                      onClick={() => router.push(`/assets/${asset.id}`)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                          {asset.name}
                        </div>
                        <Badge variant="outline" className={getStatusColor(asset.status)}>
                          {asset.status}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <div className="text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {getLocationDisplay(asset.floorNumber, asset.roomNumber)}
                        </div>
                        <div className="font-medium text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(asset.purchaseAmount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2 text-slate-500 dark:text-slate-400">{t('no_assets_found')}</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 dark:bg-slate-800 pt-3 pb-3 px-5 border-t border-slate-200 dark:border-slate-700 mt-auto">
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
          onClick={() => router.push('/assets')}
        >
          {t('view_all_assets')}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}