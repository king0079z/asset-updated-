import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Package, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  RefreshCw,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  Users,
  Activity
} from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { KitchenConsumptionDialog } from "@/components/KitchenConsumptionDialog";
import { useToast } from "@/components/ui/use-toast";

interface KitchenSummary {
  id: string;
  name: string;
  totalConsumption: number;
  totalWaste: number;
  expirationWaste: number;
  ingredientWaste: number;
  ingredientWastePercent: number;
  kitchenEfficiency: number;
  totalCost: number;
  wasteCost: number;
  profitMargin: number;
  consumptionTrend: number;
  wasteTrend: number;
  topConsumedItems: Array<{
    name: string;
    amount: string;
    type: 'ingredient' | 'recipe' | 'subrecipe';
    cost: number;
  }>;
  topWastedItems: Array<{
    name: string;
    amount: string;
    reason: string;
    cost: number;
  }>;
  monthlyData: {
    consumption: number[];
    waste: number[];
    labels: string[];
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  lastUpdated: string;
}

interface KitchenBreakdownResponse {
  kitchens: KitchenSummary[];
  summary: {
    totalKitchens: number;
    totalConsumption: number;
    totalWaste: number;
    averageEfficiency: number;
    totalCost: number;
    totalWasteCost: number;
    potentialSavings: number;
  };
  metadata: {
    dateRange: string;
    generatedAt: string;
    dataFreshness: 'fresh' | 'stale' | 'outdated';
  };
}

export function KitchenConsumptionBreakdown() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // State management
  const [data, setData] = useState<KitchenBreakdownResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [sortBy, setSortBy] = useState<'name' | 'consumption' | 'waste' | 'efficiency' | 'cost'>('efficiency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Fetch kitchen consumption data
  const fetchKitchenData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const timeRangeMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = timeRangeMap[selectedTimeRange];
      
      const response = await fetch(
        `/api/kitchens/consumption-summary?days=${days}&includeDetails=true&includeTrends=true`,
        {
          headers: forceRefresh ? { 'Cache-Control': 'no-cache' } : {},
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast({
        title: t('error'),
        description: t('failed_to_load_kitchen_data'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTimeRange, t, toast]);

  // Initial data fetch and refresh on time range change
  useEffect(() => {
    fetchKitchenData();
  }, [fetchKitchenData]);

  // Memoized sorted kitchens
  const sortedKitchens = useMemo(() => {
    if (!data?.kitchens) return [];

    return [...data.kitchens].sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case 'name':
          return sortOrder === 'asc' 
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'consumption':
          aValue = a.totalConsumption;
          bValue = b.totalConsumption;
          break;
        case 'waste':
          aValue = a.totalRecipeWaste ?? a.totalWaste;
          bValue = b.totalRecipeWaste ?? b.totalWaste;
          break;
        case 'efficiency':
          aValue = a.kitchenEfficiency;
          bValue = b.kitchenEfficiency;
          break;
        case 'cost':
          aValue = a.totalRecipeCost ?? a.totalCost;
          bValue = b.totalRecipeCost ?? b.totalCost;
          break;
        default:
          return 0;
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [data?.kitchens, sortBy, sortOrder]);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-QA', {
      style: 'currency',
      currency: 'QAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  // Get efficiency status
  const getEfficiencyStatus = useCallback((efficiency: number) => {
    if (efficiency >= 85) return { status: 'excellent', color: 'text-green-600', bgColor: 'bg-green-50' };
    if (efficiency >= 70) return { status: 'good', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (efficiency >= 60) return { status: 'fair', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { status: 'poor', color: 'text-red-600', bgColor: 'bg-red-50' };
  }, []);

  // Get trend icon
  const getTrendIcon = useCallback((trend: number) => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Activity className="h-4 w-4 text-gray-400" />;
  }, []);

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t('kitchen_consumption_breakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-4"
                onClick={() => fetchKitchenData(true)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!data || data.kitchens.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t('kitchen_consumption_breakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('no_kitchen_data')}</h3>
            <p className="text-muted-foreground mb-4">{t('no_kitchen_data_description')}</p>
            <Button onClick={() => fetchKitchenData(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('refresh_data')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package className="h-6 w-6 text-primary" />
              {t('kitchen_consumption_breakdown')}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t('comprehensive_kitchen_analytics')} • {data.summary.totalKitchens} {t('kitchens')}
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Time Range Selector */}
            <div className="flex rounded-lg border">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <Button
                  key={range}
                  variant={selectedTimeRange === range ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                  onClick={() => setSelectedTimeRange(range)}
                >
                  {range === '7d' && '7 Days'}
                  {range === '30d' && '30 Days'}
                  {range === '90d' && '90 Days'}
                </Button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-lg border">
              <Button
                variant={viewMode === 'table' ? "default" : "ghost"}
                size="sm"
                className="rounded-none rounded-l-lg"
                onClick={() => setViewMode('table')}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? "default" : "ghost"}
                size="sm"
                className="rounded-none rounded-r-lg"
                onClick={() => setViewMode('cards')}
              >
                <PieChart className="h-4 w-4" />
              </Button>
            </div>

            {/* Refresh Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchKitchenData(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('total_consumption')}</p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                  {data.summary.totalConsumption.toFixed(1)}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  {formatCurrency(data.summary.totalCost)}
                </p>
              </div>
              <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('total_waste')}</p>
                <p className="text-2xl font-bold text-red-800 dark:text-red-300">
                  {data.summary.totalWasteCost.toFixed(1)}
                </p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70">
                  {formatCurrency(data.summary.totalWasteCost)}
                </p>
              </div>
              <Trash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('avg_efficiency')}</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {data.summary.averageEfficiency.toFixed(1)}%
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70">
                  {t('across_all_kitchens')}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-400">{t('potential_savings')}</p>
                <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                  {formatCurrency(data.summary.potentialSavings)}
                </p>
                <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                  {t('waste_reduction')}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Sort Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm font-medium">{t('sort_by')}:</span>
          {(['name', 'consumption', 'waste', 'efficiency', 'cost'] as const).map((option) => (
            <Button
              key={option}
              variant={sortBy === option ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (sortBy === option) {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy(option);
                  setSortOrder('desc');
                }
              }}
            >
              {t(option)}
              {sortBy === option && (
                sortOrder === 'asc' ? <TrendingUp className="h-3 w-3 ml-1" /> : <TrendingDown className="h-3 w-3 ml-1" />
              )}
            </Button>
          ))}
        </div>

        {/* Kitchen Data Display */}
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">{t('kitchen')}</th>
                  <th className="text-left p-4 font-semibold">{t('consumption')}</th>
                  <th className="text-left p-4 font-semibold">{t('waste_analysis')}</th>
                  <th className="text-left p-4 font-semibold">{t('efficiency')}</th>
                  <th className="text-left p-4 font-semibold">{t('financial_impact')}</th>
                  <th className="text-left p-4 font-semibold">{t('trends')}</th>
                  <th className="text-left p-4 font-semibold">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedKitchens.map((kitchen) => {
                  const efficiencyStatus = getEfficiencyStatus(kitchen.kitchenEfficiency);
                  
                  return (
                    <tr key={kitchen.id} className="border-b hover:bg-muted/30 transition-colors">
                      {/* Kitchen Name & Status */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-lg">{kitchen.name}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${efficiencyStatus.bgColor} ${efficiencyStatus.color} border-0`}>
                              {t(efficiencyStatus.status)}
                            </Badge>
                            {kitchen.alerts.length > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {kitchen.alerts.length} {t('alerts')}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t('updated')}: {new Date(kitchen.lastUpdated).toLocaleString()}
                          </div>
                        </div>
                      </td>

                      {/* Consumption */}
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="text-lg font-bold text-blue-600">
                            {kitchen.totalConsumption.toFixed(1)} {t('units')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(kitchen.totalRecipeCost ?? kitchen.totalCost)}
                          </div>
                          <div className="space-y-1">
                            {kitchen.topConsumedItems.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-xs flex items-center gap-1">
                                <Badge variant="outline" className={`text-xs ${
                                  item.type === 'ingredient' ? 'bg-blue-50 text-blue-700' :
                                  item.type === 'recipe' ? 'bg-amber-50 text-amber-700' :
                                  'bg-purple-50 text-purple-700'
                                }`}>
                                  {t(item.type)}
                                </Badge>
                                <span>{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Waste Analysis */}
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="text-lg font-bold text-red-600">
                            {kitchen.totalWaste.toFixed(1)} {t('units')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(kitchen.totalRecipeWaste ?? kitchen.wasteCost)}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Exp: {kitchen.expirationWaste.toFixed(1)}
                            </Badge>
                            <Badge variant="outline" className="bg-pink-50 text-pink-700 text-xs" title="Ingredient waste as % of total ingredient usage">
                              <Package className="h-3 w-3 mr-1" />
                              Ing: {kitchen.ingredientWaste.toFixed(1)}
                              <span className="ml-1 text-xs text-pink-700/70">
                                ({kitchen.ingredientWastePercent.toFixed(1)}%)
                              </span>
                            </Badge>
                          </div>
                        </div>
                      </td>

                      {/* Efficiency */}
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold">
                              {kitchen.kitchenEfficiency.toFixed(1)}%
                            </div>
                            {kitchen.kitchenEfficiency >= 85 ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : kitchen.kitchenEfficiency >= 60 ? (
                              <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                          <Progress 
                            value={kitchen.kitchenEfficiency} 
                            className="h-2"
                            indicatorClassName={
                              kitchen.kitchenEfficiency >= 85 ? "bg-green-500" :
                              kitchen.kitchenEfficiency >= 60 ? "bg-yellow-500" : "bg-red-500"
                            }
                          />
                          <div className="text-xs text-muted-foreground">
                            {t('profit_margin')}: {kitchen.profitMargin.toFixed(1)}%
                          </div>
                        </div>
                      </td>

                      {/* Financial Impact */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('cost')}: </span>
                            <span className="font-semibold">{formatCurrency(kitchen.totalRecipeCost ?? kitchen.totalCost)}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('waste')}: </span>
                            <span className="font-semibold text-red-600">{formatCurrency(kitchen.totalRecipeWaste ?? kitchen.wasteCost)}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('savings')}: </span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency((kitchen.totalRecipeWaste ?? kitchen.wasteCost) * 0.7)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Trends */}
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getTrendIcon(kitchen.consumptionTrend)}
                            <span className="text-sm">
                              {kitchen.consumptionTrend > 0 ? '+' : ''}{kitchen.consumptionTrend.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t('consumption_trend')}
                          </div>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(kitchen.wasteTrend)}
                            <span className="text-sm">
                              {kitchen.wasteTrend > 0 ? '+' : ''}{kitchen.wasteTrend.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t('waste_trend')}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <KitchenConsumptionDialog
                            kitchenId={kitchen.id}
                            kitchenName={kitchen.name}
                            buttonVariant="outline"
                            buttonSize="sm"
                            buttonLabel={t('view_details')}
                            onSuccess={() => fetchKitchenData(true)}
                          />
                          {kitchen.alerts.length > 0 && (
                            <Button variant="ghost" size="sm" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {t('view_alerts')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedKitchens.map((kitchen) => {
              const efficiencyStatus = getEfficiencyStatus(kitchen.kitchenEfficiency);
              
              return (
                <Card key={kitchen.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{kitchen.name}</CardTitle>
                      <Badge variant="outline" className={`${efficiencyStatus.bgColor} ${efficiencyStatus.color} border-0`}>
                        {kitchen.kitchenEfficiency.toFixed(1)}%
                      </Badge>
                    </div>
                    {kitchen.alerts.length > 0 && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {kitchen.alerts.length} {t('active_alerts')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Consumption & Waste */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {kitchen.totalConsumption.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('consumption')}</div>
                        <div className="text-xs font-medium">{formatCurrency(kitchen.totalRecipeCost ?? kitchen.totalCost)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {kitchen.totalWaste.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('waste')}</div>
                        <div className="text-xs font-medium">{formatCurrency(kitchen.totalRecipeWaste ?? kitchen.wasteCost)}</div>
                      </div>
                    </div>

                    {/* Efficiency Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t('efficiency')}</span>
                        <span className="font-semibold">{kitchen.kitchenEfficiency.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={kitchen.kitchenEfficiency} 
                        className="h-2"
                        indicatorClassName={
                          kitchen.kitchenEfficiency >= 85 ? "bg-green-500" :
                          kitchen.kitchenEfficiency >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }
                      />
                    </div>

                    {/* Top Items */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('top_consumed')}</div>
                      {kitchen.topConsumedItems.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-xs ${
                              item.type === 'ingredient' ? 'bg-blue-50 text-blue-700' :
                              item.type === 'recipe' ? 'bg-amber-50 text-amber-700' :
                              'bg-purple-50 text-purple-700'
                            }`}>
                              {t(item.type)}
                            </Badge>
                            <span>{item.name}</span>
                          </div>
                          <span className="font-medium">{item.amount}</span>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <KitchenConsumptionDialog
                        kitchenId={kitchen.id}
                        kitchenName={kitchen.name}
                        buttonVariant="outline"
                        buttonSize="sm"
                        buttonLabel={t('details')}
                        onSuccess={() => fetchKitchenData(true)}
                      />
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Data Freshness Indicator */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span>{t('data_range')}: {data.metadata.dateRange}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                data.metadata.dataFreshness === 'fresh' ? 'bg-green-500' :
                data.metadata.dataFreshness === 'stale' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span>{t('last_updated')}: {new Date(data.metadata.generatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}