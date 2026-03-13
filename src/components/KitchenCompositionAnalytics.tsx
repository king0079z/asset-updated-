// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';
import { 
  BarChart3, 
  Utensils, 
  Trash2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Building2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  LineChart,
  Wallet
} from 'lucide-react';
import { BarChart } from '@/components/ui/chart';
import WasteAnalyticsBarChart from './WasteAnalyticsBarChart';

interface KitchenConsumption {
  id: string;
  name: string;
  totalConsumed: number;
  totalWasted: number;
  wastePercentage: number;
  consumptionTrend: number;
  mostConsumedItems: {
    name: string;
    quantity: number;
    unit: string;
  }[];
  mostWastedItems: {
    name: string;
    quantity: number;
    unit: string;
    reason: string;
  }[];
  costData: {
    totalCost: number;
    wasteCost: number;
    savingsOpportunity: number;
  };
}

interface ConsumptionSummary {
  totalConsumed: number;
  totalWasted: number;
  overallWastePercentage: number;
  totalCost: number;
  totalWasteCost: number;
  potentialSavings: number;
  topWasteReasons: {
    reason: string;
    percentage: number;
    cost: number;
  }[];
  periodComparison: {
    currentPeriodConsumption: number;
    previousPeriodConsumption: number;
    percentageChange: number;
    currentPeriodWaste: number;
    previousPeriodWaste: number;
    wastePercentageChange: number;
  };
}

interface ConsumptionResponse {
  kitchens: KitchenConsumption[];
  summary: ConsumptionSummary;
  metadata: {
    startDate: string;
    endDate: string;
    generatedAt: string;
  };
}

function getMostConsumedItemPerPeriod(periods: any[]) {
  // Returns a map: periodKey -> {name, type}
  const map: Record<string, { name: string; type: string }> = {};
  periods.forEach(period => {
    if (period.items && period.items.length > 0) {
      const maxItem = period.items.reduce((max, item) => (item.quantity > max.quantity ? item : max), period.items[0]);
      map[period.date || period.month] = { name: maxItem.name, type: maxItem.type };
    }
  });
  return map;
}

function getColorForType(type: string) {
  if (type === 'ingredient') return 'rgba(59,130,246,0.7)'; // blue-500
  if (type === 'recipe') return 'rgba(251,191,36,0.7)'; // amber-500
  if (type === 'subrecipe') return 'rgba(168,85,247,0.7)'; // purple-500
  return 'rgba(107,114,128,0.7)'; // gray-500
}

function getHighlightColor(type: string) {
  if (type === 'ingredient') return 'rgba(34,197,94,0.9)'; // green-500
  if (type === 'recipe') return 'rgba(34,197,94,0.9)'; // green-500
  if (type === 'subrecipe') return 'rgba(34,197,94,0.9)'; // green-500
  return 'rgba(34,197,94,0.9)';
}



function ConsumptionBarChart({ kitchen, chartView, t }: { kitchen: any, chartView: 'day' | 'month', t: any }) {
  if (!kitchen) return null;

  // Select data
  const periods = chartView === 'day' ? kitchen.consumptionByDay : kitchen.consumptionByMonth;
  if (!periods || periods.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8">
        {t('no_consumption_data')}
      </div>
    );
  }

  const { data, options } = (() => {
    // Build a set of all unique item names and types (for stacking/grouping)
    const allItemKeys = new Set<string>();
    const itemTypeMap: Record<string, string> = {};
    periods.forEach(period => {
      (period.items || []).forEach((item: any) => {
        allItemKeys.add(`${item.type}:${item.name}`);
        itemTypeMap[`${item.type}:${item.name}`] = item.type;
      });
    });
    const itemKeys = Array.from(allItemKeys);

    // Find the most consumed item for each period
    const mostConsumedMap = getMostConsumedItemPerPeriod(periods);

    // For each item, build a dataset (one bar per item, grouped by period)
    const datasets = itemKeys.map(itemKey => {
      const [type, itemName] = itemKey.split(':');
      // Build data array for this item across all periods
      const data = periods.map(period => {
        const found = (period.items || []).find((item: any) => item.name === itemName && item.type === type);
        return found ? found.quantity : 0;
      });
      // Highlight if this item is the most consumed in any period
      const backgroundColor = periods.map((period, idx) => {
        const most = mostConsumedMap[period.date || period.month];
        if (most && most.name === itemName && most.type === type) {
          return getHighlightColor(type);
        }
        return getColorForType(type);
      });
      return {
        label: `${itemName} (${type})`,
        data,
        backgroundColor,
        stack: 'stack1',
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      };
    });

    // X-axis labels: dates or months
    const labels = periods.map(period => period.date || period.month);

    // Chart options
    const options = {
      responsive: true,
      animation: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const value = context.parsed.y;
              return `${context.dataset.label}: ${value}`;
            }
          }
        },
        title: {
          display: false
        }
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: chartView === 'day' ? t('day') : t('month')
          },
          ticks: {
            color: '#64748b',
            font: { size: 12 }
          }
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: t('quantity')
          },
          beginAtZero: true,
          ticks: {
            color: '#64748b',
            font: { size: 12 }
          }
        }
      }
    };

    return {
      data: {
        labels,
        datasets
      },
      options
    };
  })();

  return (
    <div className="w-full h-[380px] relative flex flex-col justify-center items-center">
      <BarChart data={data} options={options} />
    </div>
  );
}

export function KitchenCompositionAnalytics() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<ConsumptionResponse | null>(null);
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(30); // Default to 30 days
  // NEW: Chart view state
  const [chartView, setChartView] = useState<'day' | 'month'>('day');

  const fetchData = async (forceRefresh = false) => {
    try {
      setIsRefreshing(true);
      if (!isLoading) setIsLoading(true);
      
      const response = await fetchWithErrorHandling(
        `/api/food-supply/kitchen-consumption?days=${timeRange}`,
        forceRefresh ? { headers: { 'Cache-Control': 'no-cache' } } : {},
        null
      );
      
      if (response) {
        setData(response);
        
        // Set the first kitchen as selected by default if none is selected
        if (!selectedKitchenId && response.kitchens.length > 0) {
          setSelectedKitchenId(response.kitchens[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching kitchen consumption data:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_kitchen_consumption_data'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate profit for each kitchen using new backend fields
  const getKitchenProfit = (kitchen: any) => {
    // Use the new totalRecipeProfit field if available
    if (typeof kitchen.totalRecipeProfit === 'number') {
      return kitchen.totalRecipeProfit;
    }
    // Fallback to old logic if not present
    const markup = 0.4;
    const estimatedRecipeSellingPrice = kitchen.costData?.totalCost * (1 + markup);
    return estimatedRecipeSellingPrice - (kitchen.costData?.wasteCost ?? 0) - (kitchen.costData?.totalCost ?? 0);
  };

  // Get selected kitchen data
  const selectedKitchen = data?.kitchens.find(k => k.id === selectedKitchenId);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('kitchen_composition_analytics')}
            </CardTitle>
            <CardDescription>{t('analyze_consumption_and_waste_by_kitchen')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-1 border rounded-md text-sm"
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
            >
              <option value="7">7 {t('days')}</option>
              <option value="30">30 {t('days')}</option>
              <option value="90">90 {t('days')}</option>
            </select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !data ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('no_data_available')}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => fetchData(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('try_again')}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('total_cost')}</p>
                      <h3 className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        {formatCurrency(data.summary.totalCost ?? data.kitchens.reduce((sum, k) => sum + (k.totalRecipeCost ?? 0), 0))}
                      </h3>
                      <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">{t('across_all_kitchens')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('waste_cost')}</p>
                      <h3 className="text-2xl font-bold text-red-800 dark:text-red-300">
                        {formatCurrency(data.summary.totalWasteCost ?? data.kitchens.reduce((sum, k) => sum + (k.totalRecipeWaste ?? 0), 0))}
                      </h3>
                      <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{t('potential_savings')}: {formatCurrency(data.summary.potentialSavings)}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Trash2 className="h-5 w-5 text-red-700 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('total_profit')}</p>
                      <h3 className="text-2xl font-bold text-green-800 dark:text-green-300">
                        {formatCurrency(data.kitchens.reduce((sum, kitchen) => sum + getKitchenProfit(kitchen), 0))}
                      </h3>
                      <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">{t('estimated_profit_margin')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-green-700 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-400">{t('waste_percentage')}</p>
                      <h3 className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                        {data.summary.overallWastePercentage.toFixed(1)}%
                      </h3>
                      <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-1">{t('of_total_inventory')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <PieChart className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Kitchen Selection and Details */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Kitchen List */}
              <div className="md:col-span-3 lg:col-span-3">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <Building2 className="h-4 w-4 mr-2 text-primary" />
                      {t('kitchens')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {data.kitchens.map((kitchen) => (
                        <div
                          key={kitchen.id}
                          className={`p-3 cursor-pointer transition-all ${
                            selectedKitchenId === kitchen.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-accent hover:text-accent-foreground'
                          }`}
                          onClick={() => setSelectedKitchenId(kitchen.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{kitchen.name}</div>
                            <Badge variant="outline" className={`${
                              selectedKitchenId === kitchen.id
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {formatCurrency(kitchen.costData.totalCost)}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-xs">
                            <div className={`${
                              selectedKitchenId === kitchen.id
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            }`}>
                              {t('waste')}: {kitchen.wastePercentage.toFixed(1)}%
                            </div>
                            <div className={`${
                              selectedKitchenId === kitchen.id
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            }`}>
                              {t('profit')}: {formatCurrency(getKitchenProfit(kitchen))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Kitchen Details */}
              <div className="md:col-span-9 lg:col-span-9">
                {selectedKitchen ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{selectedKitchen.name}</CardTitle>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          {t('last_updated')}: {new Date(data.metadata.generatedAt).toLocaleString()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                          <TabsTrigger value="overview" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            {t('overview')}
                          </TabsTrigger>
                          <TabsTrigger value="consumption" className="flex items-center gap-2">
                            <Utensils className="h-4 w-4" />
                            {t('consumption')}
                          </TabsTrigger>
                          <TabsTrigger value="waste" className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            {t('waste')}
                          </TabsTrigger>
                        </TabsList>
                        
                        {/* Overview Tab */}
                        <TabsContent value="overview" className="space-y-4">
                          {/* Financial Metrics */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('total_cost')}</h3>
                                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="text-xl font-bold text-blue-800 dark:text-blue-300">
                                {formatCurrency(selectedKitchen.totalRecipeCost ?? selectedKitchen.costData.totalCost)}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <div className="text-xs text-blue-600/70 dark:text-blue-400/70">
                                  {t('consumption_value')}
                                </div>
                                <div className="flex items-center text-xs">
                                  {selectedKitchen.consumptionTrend > 0 ? (
                                    <>
                                      <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
                                      <span className="text-red-500">+{selectedKitchen.consumptionTrend.toFixed(1)}%</span>
                                    </>
                                  ) : (
                                    <>
                                      <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                                      <span className="text-green-500">{selectedKitchen.consumptionTrend.toFixed(1)}%</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-medium text-red-700 dark:text-red-400">{t('waste_cost')}</h3>
                                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </div>
                              <div className="text-xl font-bold text-red-800 dark:text-red-300">
                                {formatCurrency(selectedKitchen.totalRecipeWaste ?? selectedKitchen.costData.wasteCost)}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <div className="text-xs text-red-600/70 dark:text-red-400/70">
                                  {t('savings_opportunity')}: {formatCurrency(selectedKitchen.costData.savingsOpportunity)}
                                </div>
                                <Badge variant="outline" className="bg-red-50 text-red-700 h-5 text-xs">
                                  {selectedKitchen.wastePercentage.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-medium text-green-700 dark:text-green-400">{t('profit')}</h3>
                                <Wallet className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="text-xl font-bold text-green-800 dark:text-green-300">
                                {formatCurrency(getKitchenProfit(selectedKitchen))}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <div className="text-xs text-green-600/70 dark:text-green-400/70">
                                  {t('profit_margin')}: {((getKitchenProfit(selectedKitchen) / ((selectedKitchen.totalRecipeCost ?? selectedKitchen.costData.totalCost) || 1)) * 100).toFixed(1)}%
                                </div>
                                <div className="flex items-center text-xs">
                                  {getKitchenProfit(selectedKitchen) > (selectedKitchen.totalRecipeWaste ?? selectedKitchen.costData.wasteCost) ? (
                                    <>
                                      <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                                      <span className="text-green-500">{t('positive')}</span>
                                    </>
                                  ) : (
                                    <>
                                      <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                                      <span className="text-red-500">{t('needs_improvement')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Consumption vs Waste */}
                          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
                            <h3 className="text-sm font-medium mb-3">{t('consumption_vs_waste')}</h3>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>{t('consumption')}</span>
                                  <span>{selectedKitchen.totalConsumed.toFixed(1)} {t('units')}</span>
                                </div>
                                <Progress 
                                  value={selectedKitchen.totalConsumed / (selectedKitchen.totalConsumed + selectedKitchen.totalWasted) * 100} 
                                  className="h-2 bg-blue-100" 
                                  indicatorClassName="bg-blue-600" 
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>{t('waste')}</span>
                                  <span>{selectedKitchen.totalWasted.toFixed(1)} {t('units')} ({selectedKitchen.wastePercentage.toFixed(1)}%)</span>
                                </div>
                                <Progress 
                                  value={selectedKitchen.totalWasted / (selectedKitchen.totalConsumed + selectedKitchen.totalWasted) * 100} 
                                  className="h-2 bg-red-100" 
                                  indicatorClassName="bg-red-600" 
                                />
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                        
                        {/* Consumption Tab */}
                        <TabsContent value="consumption" className="space-y-4">
                          {/* --- NEW: Consumption Bar Chart with Toggle --- */}
                          <div className="bg-white dark:bg-gray-800 border rounded-lg shadow p-6">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
    <h3 className="text-base font-semibold text-primary flex items-center gap-2">
      <BarChart3 className="h-5 w-5" />
      {t('kitchen_consumption_breakdown')}
    </h3>
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="px-3"
        onClick={() => setChartView('day')}
        style={{
          background: chartView === 'day' ? 'var(--primary)' : undefined,
          color: chartView === 'day' ? 'white' : undefined,
          borderColor: chartView === 'day' ? 'var(--primary)' : undefined,
        }}
      >
        {t('per_day')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="px-3"
        onClick={() => setChartView('month')}
        style={{
          background: chartView === 'month' ? 'var(--primary)' : undefined,
          color: chartView === 'month' ? 'white' : undefined,
          borderColor: chartView === 'month' ? 'var(--primary)' : undefined,
        }}
      >
        {t('per_month')}
      </Button>
    </div>
  </div>
  {/* Bar Chart */}
  <div className="mb-4">
    <ConsumptionBarChart
      kitchen={selectedKitchen}
      chartView={chartView}
      t={t}
    />
  </div>
  {/* Legend */}
  <div className="flex flex-wrap gap-4 mt-2 text-xs">
    <div className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded bg-blue-500"></span>
      {t('ingredient')}
    </div>
    <div className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded bg-amber-500"></span>
      {t('recipe')}
    </div>
    <div className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded bg-purple-500"></span>
      {t('subrecipe')}
    </div>
    <div className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded bg-green-500"></span>
      {t('most_consumed')}
    </div>
  </div>
</div>
                          {/* --- END NEW --- */}

                          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
                            <h3 className="text-sm font-medium mb-3">{t('most_consumed_items')}</h3>
                            <div className="space-y-3">
                              {selectedKitchen.mostConsumedItems.map((item, index) => (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                                        ${
                                          item.type === 'ingredient'
                                            ? 'bg-blue-100 text-blue-700'
                                            : item.type === 'recipe'
                                            ? 'bg-amber-100 text-amber-700'
                                            : item.type === 'subrecipe'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-gray-100 text-gray-700'
                                        }
                                      `}
                                    >
                                      {index + 1}
                                    </div>
                                    <span className="font-medium">{item.name}</span>
                                    <span className={`text-xs ml-2 px-2 py-0.5 rounded-full
                                      ${
                                        item.type === 'ingredient'
                                          ? 'bg-blue-50 text-blue-700'
                                          : item.type === 'recipe'
                                          ? 'bg-amber-50 text-amber-700'
                                          : item.type === 'subrecipe'
                                          ? 'bg-purple-50 text-purple-700'
                                          : 'bg-gray-50 text-gray-700'
                                      }
                                    `}>
                                      {t(item.type)}
                                    </span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`${
                                      item.type === 'ingredient'
                                        ? 'bg-blue-50 text-blue-700'
                                        : item.type === 'recipe'
                                        ? 'bg-amber-50 text-amber-700'
                                        : item.type === 'subrecipe'
                                        ? 'bg-purple-50 text-purple-700'
                                        : 'bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    {item.quantity.toFixed(1)} {item.unit}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
                            <h3 className="text-sm font-medium mb-3">{t('consumption_trend')}</h3>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-2xl font-bold">
                                  {selectedKitchen.consumptionTrend > 0 ? '+' : ''}{selectedKitchen.consumptionTrend.toFixed(1)}%
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {t('vs_previous_period')}
                                </div>
                              </div>
                              <div className="h-16 w-16 rounded-full flex items-center justify-center">
                                {selectedKitchen.consumptionTrend > 0 ? (
                                  <TrendingUp className="h-10 w-10 text-blue-500" />
                                ) : selectedKitchen.consumptionTrend < 0 ? (
                                  <TrendingDown className="h-10 w-10 text-green-500" />
                                ) : (
                                  <LineChart className="h-10 w-10 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                        
                        {/* Waste Tab */}
                        <TabsContent value="waste" className="space-y-4">
                          {/* --- NEW: Waste Analytics Bar Chart --- */}
                          <WasteAnalyticsBarChart kitchenId={selectedKitchen.id} t={t} />
                          
                          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
                            <h3 className="text-sm font-medium mb-3">{t('most_wasted_items')}</h3>
                            <div className="space-y-3">
                              {selectedKitchen.mostWastedItems.map((item, index) => (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-xs font-medium">
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="font-medium">{item.name}</div>
                                      <div className="text-xs text-muted-foreground">{t(item.reason)}</div>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="bg-red-50 text-red-700">
                                    {item.quantity.toFixed(1)} {item.unit}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
                            <h3 className="text-sm font-medium mb-3">{t('waste_cost_impact')}</h3>
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">{t('total_waste_cost')}</span>
                                <span className="font-medium text-red-600">{formatCurrency(selectedKitchen.costData.wasteCost)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">{t('potential_savings')}</span>
                                <span className="font-medium text-green-600">{formatCurrency(selectedKitchen.costData.savingsOpportunity)}</span>
                              </div>
                              <div className="pt-2 border-t">
                                <div className="flex justify-between text-sm mb-1">
                                  <span>{t('savings_opportunity')}</span>
                                  <span>{((selectedKitchen.costData.savingsOpportunity / selectedKitchen.costData.wasteCost) * 100).toFixed(0)}%</span>
                                </div>
                                <Progress 
                                  value={(selectedKitchen.costData.savingsOpportunity / selectedKitchen.costData.wasteCost) * 100} 
                                  className="h-2 bg-green-100" 
                                  indicatorClassName="bg-green-600" 
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Profit Calculation Breakdown */}
                          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 mt-4">
                            <h3 className="text-sm font-medium mb-3">{t('profit_calculation_breakdown')}</h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Estimated Recipe Selling Price:</span>
                                <span className="font-medium text-purple-600 dark:text-purple-400">
                                  {formatCurrency(selectedKitchen.totalRecipeRevenue ?? (selectedKitchen.costData.totalCost * 1.4))}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Minus Total Cost:</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  - {formatCurrency(selectedKitchen.totalRecipeCost ?? selectedKitchen.costData.totalCost)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Minus Waste Cost:</span>
                                <span className="font-medium text-red-600 dark:text-red-400">
                                  - {formatCurrency(selectedKitchen.totalRecipeWaste ?? selectedKitchen.costData.wasteCost)}
                                </span>
                              </div>
                              <div className="border-t pt-2 flex justify-between">
                                <span className="font-medium">Equals Total Profit:</span>
                                <span className={`font-medium ${getKitchenProfit(selectedKitchen) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                  = {formatCurrency(getKitchenProfit(selectedKitchen))}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <CardContent className="py-12 text-center">
                      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-mute-foreground">{t('select_a_kitchen_to_view_details')}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}