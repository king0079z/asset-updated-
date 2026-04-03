import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Building, ArrowRight, Package, AlertTriangle, RefreshCw, Wallet, BarChart3, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/contexts/TranslationContext";
import { useToast } from "@/components/ui/use-toast";
import { calculatePortfolioDepreciation } from "@/lib/depreciation";

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

export function EnhancedAssetsOverviewCard({ totalAssets = 0, assetStats = { byStatus: [], totalValue: 0, disposedValue: 0 } }: AssetsOverviewCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<AssetDetail[]>([]);
  const [showDepreciation, setShowDepreciation] = useState(false);
  const { t, dir } = useTranslation();
  const { toast } = useToast();

  const portfolio = useMemo(() => {
    if (!assets.length) return null;
    try {
      return calculatePortfolioDepreciation(assets.map(a => ({
        id: a.id, name: a.name, type: a.type,
        purchaseAmount: a.purchaseAmount, purchaseDate: null, createdAt: a.createdAt,
      })));
    } catch { return null; }
  }, [assets]);

  const fetchAssets = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/assets', {
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache' : 'default',
          'Pragma': forceRefresh ? 'no-cache' : 'default'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssets(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast({
        title: t('error'),
        description: t('failed_to_load_assets'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
    <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden bg-card dark:bg-gray-800 relative group transform hover:-translate-y-1 h-full flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 group-hover:h-2 transition-all duration-300"></div>
      
      <CardHeader className="relative pb-2 pt-5">
        <div className="absolute -top-4 left-4 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-purple-200 dark:group-hover:shadow-purple-900 group-hover:scale-110 transition-all duration-300">
          <Building className="h-6 w-6 text-white group-hover:animate-pulse" />
        </div>
        <div className="ml-10">
          <CardTitle className="text-indigo-900 dark:text-indigo-300 text-lg group-hover:text-indigo-700 dark:group-hover:text-indigo-200 transition-colors">
            {t('assets_overview').replace(/_/g, ' ')}
          </CardTitle>
          <CardDescription className="text-indigo-700 dark:text-indigo-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors">
            {totalAssets} {t('assets_tracked')}
          </CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-5 right-4 h-8 w-8 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900 opacity-70 group-hover:opacity-100"
          onClick={() => fetchAssets(true)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 text-purple-600 dark:text-purple-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="sr-only">{t('refresh')}</span>
        </Button>
      </CardHeader>
      
      <CardContent className="pt-4 pb-5 relative z-10 flex-grow">
        <div className="space-y-4">
          {/* Asset Counts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Active Assets Count */}
            <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 p-4 border border-indigo-100 dark:border-indigo-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-indigo-200 dark:group-hover:border-indigo-700 transform hover:translate-y-[-2px]">
              <div className={`flex items-center ${dir === 'rtl' ? 'space-x-reverse' : ''} space-x-2`}>
                <div className="h-3 w-3 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('active')}</p>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {totalAssets}
              </div>
            </div>
            
            {/* Disposed Assets Count */}
            <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 p-4 border border-indigo-100 dark:border-indigo-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-indigo-200 dark:group-hover:border-indigo-700 transform hover:translate-y-[-2px]">
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
          <div className="space-y-3 bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-indigo-200 dark:group-hover:border-indigo-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">{t('active_value')}</span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-400">{formatCurrency(assetStats.totalValue)}</span>
            </div>
            <Progress 
              value={100} 
              className="h-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden" 
              indicatorClassName="bg-gradient-to-r from-indigo-500 to-purple-600" 
            />
            
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">{t('disposed_value')}</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(assetStats.disposedValue)}</span>
            </div>
            <Progress 
              value={assetStats.disposedValue > 0 ? 
                (assetStats.disposedValue / (assetStats.totalValue + assetStats.disposedValue)) * 100 : 0} 
              className="h-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-full overflow-hidden" 
              indicatorClassName="bg-gradient-to-r from-rose-500 to-pink-600" 
            />
          </div>

          {/* Portfolio Depreciation */}
          {portfolio && portfolio.totalCost > 0 && (
            <div className="rounded-lg border border-violet-200 dark:border-violet-800/50 overflow-hidden">
              <button
                onClick={() => setShowDepreciation(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300">Depreciation Analysis</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300">AI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{portfolio.overallDepreciationPercent.toFixed(1)}% dep.</span>
                  {showDepreciation ? <ChevronUp className="w-3.5 h-3.5 text-violet-500" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-500" />}
                </div>
              </button>

              {showDepreciation && (
                <div className="p-3 bg-white dark:bg-slate-900 space-y-3">
                  {/* KPI row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Original Cost", val: formatCurrency(portfolio.totalCost), color: "text-slate-700 dark:text-slate-200" },
                      { label: "Book Value", val: formatCurrency(portfolio.totalCurrentValue), color: "text-emerald-700 dark:text-emerald-400" },
                      { label: "Depreciated", val: formatCurrency(portfolio.totalAccumulatedDepreciation), color: "text-rose-600 dark:text-rose-400" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="text-center">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
                        <p className={`text-xs font-bold ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Decay bar */}
                  <div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(portfolio.overallDepreciationPercent, 100)}%`,
                          background: portfolio.overallDepreciationPercent > 75 ? '#ef4444' : portfolio.overallDepreciationPercent > 50 ? '#f97316' : portfolio.overallDepreciationPercent > 25 ? '#f59e0b' : '#8b5cf6',
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 text-right mt-0.5">{portfolio.overallDepreciationPercent.toFixed(1)}% of portfolio depreciated</p>
                  </div>

                  {/* Top depreciated types */}
                  {portfolio.byType.slice(0, 3).map(t => (
                    <div key={t.type} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-24 truncate">{t.type}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${Math.min(t.depreciationPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 w-10 text-right">{t.depreciationPercent.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                      className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-300 cursor-pointer transform hover:translate-x-1"
                      onClick={() => router.push(`/assets/${asset.id}`)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                          {asset.name}
                        </div>
                        <Badge variant="outline" className={`${getStatusColor(asset.status)} shadow-sm`}>
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
      
      <CardFooter className="bg-white/60 dark:bg-slate-800/60 pt-3 pb-3 px-5 border-t border-indigo-100 dark:border-indigo-800/50 mt-auto relative z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 group"
          onClick={() => router.push('/assets')}
        >
          {t('view_all_assets')}
          <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </CardFooter>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-purple-300 dark:via-purple-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </Card>
  );
}