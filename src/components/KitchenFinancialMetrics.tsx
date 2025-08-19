import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from '@/components/ui/use-toast';
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';
import { 
  DollarSign, 
  TrendingUp, 
  Trash2, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  BarChart3,
  Calendar,
  Info
} from 'lucide-react';

interface KitchenFinancialMetricsProps {
  kitchenId: string;
  kitchenName: string;
}

interface FinancialMetrics {
  totalCost: number;
  totalWaste: number;
  totalProfit: number;
  monthlyConsumedValue: number;
  monthlyWasteValue: number;
  monthlyTotalProfit: number;
  wastePercentage: number;
  profitMargin: number;
  totalRecipeSellingPrice?: number;
  monthlyRecipeSellingPrice?: number;
}

export function KitchenFinancialMetrics({ kitchenId, kitchenName }: KitchenFinancialMetricsProps) {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { t } = useTranslation();
  const { toast } = useToast();

  const fetchMetrics = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const data = await fetchWithErrorHandling(
        `/api/kitchens/financial-metrics?kitchenId=${kitchenId}`,
        forceRefresh ? { headers: { 'Cache-Control': 'no-cache' } } : {},
        null
      );
      
      if (data) {
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching kitchen financial metrics:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_financial_data'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (kitchenId) {
      fetchMetrics();
    }
  }, [kitchenId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading && !metrics) {
    return (
      <Card className="border-none shadow-md bg-white dark:bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <Wallet className="h-5 w-5 mr-2 text-primary" />
            {t('kitchen_financial_metrics')}
          </CardTitle>
          <CardDescription>{t('loading_financial_data')}</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate trend indicators
  const isProfitMarginGood = metrics && metrics.profitMargin >= 20;
  const isWasteRatioGood = metrics && metrics.wastePercentage <= 15;

  return (
    <Card className="border-none shadow-md bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="pb-2 relative">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center">
            <Wallet className="h-5 w-5 mr-2 text-primary" />
            {t('kitchen_financial_metrics')}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
            onClick={() => fetchMetrics(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 dark:text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="sr-only">{t('refresh')}</span>
          </Button>
        </div>
        <CardDescription>{t('financial_overview_for')} {kitchenName}</CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4">
            <TabsList className="grid w-full grid-cols-3 mb-2">
              <TabsTrigger value="overview" className="text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                {t('overview')}
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                {t('monthly')}
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs">
                <Info className="h-3.5 w-3.5 mr-1" />
                {t('details')}
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="m-0">
            <div className="px-4 pb-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Profit Card */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-3 border border-green-100 dark:border-green-800/30 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-medium text-green-700 dark:text-green-400">{t('profit')}</h3>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center ${
                      isProfitMarginGood 
                        ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-400' 
                        : 'bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-400'
                    }`}>
                      {metrics ? `${metrics.profitMargin}%` : '-'}
                      {metrics && (isProfitMarginGood ? (
                        <ArrowUpRight className="h-3 w-3 ml-0.5" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 ml-0.5" />
                      ))}
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${
                    metrics && metrics.totalProfit <= 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-800 dark:text-green-300'
                  }`}>
                    {metrics ? formatCurrency(metrics.totalProfit) : '-'}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-green-600/70 dark:text-green-400/70">
                      {t('profit_margin')}
                    </div>
                    <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </div>
                </div>

                {/* Sales Card */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-3 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-medium text-purple-700 dark:text-purple-400">{t('sales')}</h3>
                  </div>
                  <div className="text-xl font-bold text-purple-800 dark:text-purple-300">
                    {metrics?.totalRecipeSellingPrice ? formatCurrency(metrics.totalRecipeSellingPrice) : '-'}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-purple-600/70 dark:text-purple-400/70">
                      {t('recipe_selling_price')}
                    </div>
                    <DollarSign className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>

              {/* Cost & Waste */}
              <div className="grid grid-cols-2 gap-3">
                {/* Cost Card */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('cost')}</h3>
                    <DollarSign className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
                    {metrics ? formatCurrency(metrics.totalCost) : '-'}
                  </div>
                </div>

                {/* Waste Card */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-medium text-red-700 dark:text-red-400">{t('waste')}</h3>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center ${
                      isWasteRatioGood 
                        ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-400' 
                        : 'bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-400'
                    }`}>
                      {metrics ? `${metrics.wastePercentage}%` : '-'}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-red-800 dark:text-red-300">
                    {metrics ? formatCurrency(metrics.totalWaste) : '-'}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Monthly Tab */}
          <TabsContent value="monthly" className="m-0">
            <div className="px-4 pb-4 space-y-3">
              {/* Monthly Profit */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{t('monthly_profit')}</span>
                  <span className={`font-medium ${
                    metrics && metrics.monthlyTotalProfit <= 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {metrics ? formatCurrency(metrics.monthlyTotalProfit) : '-'}
                  </span>
                </div>
                <Progress 
                  value={metrics && (metrics.totalProfit > 0) ? (metrics.monthlyTotalProfit / metrics.totalProfit) * 100 : 0} 
                  className="h-1.5 bg-green-100 dark:bg-green-900/30" 
                  indicatorClassName="bg-green-600 dark:bg-green-500"
                />
                <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                  {metrics && metrics.totalProfit > 0 ? 
                    `${Math.round((metrics.monthlyTotalProfit / metrics.totalProfit) * 100)}% ${t('of_total')}` : '-'}
                </div>
              </div>
              
              {/* Monthly Sales */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{t('monthly_sales')}</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">
                    {metrics?.monthlyRecipeSellingPrice ? formatCurrency(metrics.monthlyRecipeSellingPrice) : '-'}
                  </span>
                </div>
                <Progress 
                  value={metrics && metrics.totalRecipeSellingPrice ? (metrics.monthlyRecipeSellingPrice! / metrics.totalRecipeSellingPrice) * 100 : 0} 
                  className="h-1.5 bg-purple-100 dark:bg-purple-900/30" 
                  indicatorClassName="bg-purple-600 dark:bg-purple-500"
                />
                <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                  {metrics && metrics.totalRecipeSellingPrice ? 
                    `${Math.round((metrics.monthlyRecipeSellingPrice! / metrics.totalRecipeSellingPrice) * 100)}% ${t('of_total')}` : '-'}
                </div>
              </div>
              
              {/* Monthly Cost */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{t('monthly_cost')}</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {metrics ? formatCurrency(metrics.monthlyConsumedValue) : '-'}
                  </span>
                </div>
                <Progress 
                  value={metrics && (metrics.totalCost > 0) ? (metrics.monthlyConsumedValue / metrics.totalCost) * 100 : 0} 
                  className="h-1.5 bg-blue-100 dark:bg-blue-900/30" 
                  indicatorClassName="bg-blue-600 dark:bg-blue-500"
                />
                <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                  {metrics && metrics.totalCost > 0 ? 
                    `${Math.round((metrics.monthlyConsumedValue / metrics.totalCost) * 100)}% ${t('of_total')}` : '-'}
                </div>
              </div>
              
              {/* Monthly Waste */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{t('monthly_waste')}</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {metrics ? formatCurrency(metrics.monthlyWasteValue) : '-'}
                  </span>
                </div>
                <Progress 
                  value={metrics && (metrics.totalWaste > 0) ? (metrics.monthlyWasteValue / metrics.totalWaste) * 100 : 0} 
                  className="h-1.5 bg-red-100 dark:bg-red-900/30" 
                  indicatorClassName="bg-red-600 dark:bg-red-500"
                />
                <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                  {metrics && metrics.totalWaste > 0 ? 
                    `${Math.round((metrics.monthlyWasteValue / metrics.totalWaste) * 100)}% ${t('of_total')}` : '-'}
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Details Tab */}
          <TabsContent value="details" className="m-0">
            <div className="px-4 pb-4">
              {/* Profit Formula Explanation */}
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profit_calculation')}</h3>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>{t('recipe_selling_price')}</span>
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {metrics?.totalRecipeSellingPrice ? formatCurrency(metrics.totalRecipeSellingPrice) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('minus_total_waste')}</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      - {metrics ? formatCurrency(metrics.totalWaste) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('minus_total_cost')}</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      - {metrics ? formatCurrency(metrics.totalCost) : '-'}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1 mt-1 flex justify-between">
                    <span className="font-medium">{t('equals_total_profit')}</span>
                    <span className={`font-medium ${
                      metrics && metrics.totalProfit <= 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      = {metrics ? formatCurrency(metrics.totalProfit) : '-'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Performance Indicators */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                  <span className="text-xs text-slate-600 dark:text-slate-400">{t('waste_to_cost_ratio')}</span>
                  <div className={`flex items-center text-sm font-medium ${
                    isWasteRatioGood
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {metrics ? `${metrics.wastePercentage}%` : '-'}
                    {metrics && (isWasteRatioGood ? (
                      <ArrowDownRight className="h-3.5 w-3.5 ml-1" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                  <span className="text-xs text-slate-600 dark:text-slate-400">{t('profit_margin')}</span>
                  <div className={`flex items-center text-sm font-medium ${
                    isProfitMarginGood
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {metrics ? `${metrics.profitMargin}%` : '-'}
                    {metrics && (isProfitMarginGood ? (
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 ml-1" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-0 pb-2 px-4 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <span>{t('last_updated')}: {new Date().toLocaleTimeString()}</span>
      </CardFooter>
    </Card>
  );
}