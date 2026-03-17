// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { WasteHistoryDialog } from './WasteHistoryDialog';
import { EnhancedWasteTrackingDialog } from './EnhancedWasteTrackingDialog';
import { 
  Trash2, 
  AlertTriangle, 
  RefreshCw, 
  BarChart3, 
  Calendar, 
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface KitchenWasteAnalysisProps {
  kitchenId: string;
  kitchenName: string;
}

interface WasteRecord {
  id: string;
  foodSupplyId: string;
  quantity: number;
  reason: string;
  notes?: string;
  cost: number;
  createdAt: string;
  updatedAt: string;
  source?: 'direct' | 'recipe';
  recipeId?: string;
  recipe?: {
    id: string;
    name: string;
    servings: number;
  };
  foodSupply: {
    id: string;
    name: string;
    unit: string;
  };
  user: {
    id: string;
    email: string;
  };
}

interface WasteByReason {
  reason: string;
  _sum: {
    cost: number;
    quantity: number;
  };
}

export function KitchenWasteAnalysis({ kitchenId, kitchenName }: KitchenWasteAnalysisProps) {
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [wasteByReason, setWasteByReason] = useState<WasteByReason[]>([]);
  const [totalWasteCost, setTotalWasteCost] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('month'); // Default to last 30 days
  const [financialMetrics, setFinancialMetrics] = useState<any>(null);
  
  const { toast } = useToast();
  const { t } = useTranslation();

  const loadWasteData = async () => {
    setIsLoading(true);
    
    try {
      // Build query parameters
      let queryParams = new URLSearchParams();
      
      queryParams.append('kitchenId', kitchenId);
      
      if (timeRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        if (timeRange === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (timeRange === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        } else if (timeRange === 'quarter') {
          startDate.setMonth(now.getMonth() - 3);
        }
        
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', now.toISOString());
      }
      
      // Fetch waste history
      const response = await fetch(`/api/food-supply/disposals?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch waste history: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.disposals || !Array.isArray(data.disposals)) {
        console.error('Invalid waste history data format:', data);
        throw new Error('Invalid data format received from server');
      }
      
      setWasteRecords(data.disposals);
      setWasteByReason(data.wasteByReason || []);
      setTotalWasteCost(data.totalWasteCost || 0);

      // Fetch financial metrics
      const metricsResponse = await fetch(`/api/kitchens/financial-metrics?kitchenId=${kitchenId}`);
      
      if (!metricsResponse.ok) {
        throw new Error(`Failed to fetch financial metrics: ${metricsResponse.status} ${metricsResponse.statusText}`);
      }
      
      const metricsData = await metricsResponse.json();
      setFinancialMetrics(metricsData);
    } catch (error) {
      console.error('Error loading waste data:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_waste_data'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (kitchenId) {
      loadWasteData();
    }
  }, [kitchenId, timeRange]);

  const getReasonBadgeColor = (reason: string) => {
    switch (reason) {
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'damaged':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'quality_issues':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'overproduction':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  // Calculate waste percentage
  const wastePercentage = financialMetrics?.wastePercentage || 0;
  const isWasteRatioGood = wastePercentage <= 15;

  // Get top waste reasons
  const topWasteReasons = [...wasteByReason]
    .sort((a, b) => b._sum.cost - a._sum.cost)
    .slice(0, 3);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center">
            <Trash2 className="h-5 w-5 mr-2 text-red-600" />
            {t('waste_analysis')}
          </CardTitle>
          <CardDescription>{t('analyze_food_waste_for')} {kitchenName}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
            onClick={() => loadWasteData()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 dark:text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="sr-only">{t('refresh')}</span>
          </Button>
          <WasteHistoryDialog />
          <EnhancedWasteTrackingDialog onWasteRecorded={loadWasteData} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Trash2 className="h-5 w-5 text-red-700" />
                </div>
                <p className="text-sm text-red-600 mb-1">{t('total_waste_cost')}</p>
                <p className="text-xl font-bold text-red-700">QAR {totalWasteCost.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
                <div className="flex justify-center mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </div>
                <p className="text-sm text-amber-600 mb-1">{t('waste_percentage')}</p>
                <div className="flex items-center justify-center">
                  <p className="text-xl font-bold text-amber-700">{wastePercentage}%</p>
                  {isWasteRatioGood ? (
                    <ArrowDownRight className="h-5 w-5 ml-1 text-green-600" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 ml-1 text-red-600" />
                  )}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                <div className="flex justify-center mb-2">
                  <BarChart3 className="h-5 w-5 text-blue-700" />
                </div>
                <p className="text-sm text-blue-600 mb-1">{t('waste_records')}</p>
                <p className="text-xl font-bold text-blue-700">{wasteRecords.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Waste by Reason */}
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-3 flex items-center">
                  <PieChart className="h-4 w-4 mr-2 text-primary" />
                  {t('waste_by_reason')}
                </h3>
                <div className="space-y-3">
                  {topWasteReasons.length > 0 ? (
                    topWasteReasons.map((reason) => {
                      const percentage = totalWasteCost > 0 
                        ? Math.round((reason._sum.cost / totalWasteCost) * 100) 
                        : 0;
                      
                      return (
                        <div key={reason.reason} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center">
                              <Badge variant="outline" className={getReasonBadgeColor(reason.reason)}>
                                {t(reason.reason)}
                              </Badge>
                            </span>
                            <span>QAR {reason._sum.cost.toFixed(2)} ({percentage}%)</span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className="h-2" 
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      {t('no_waste_data_available')}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Waste Records */}
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-primary" />
                  {t('recent_waste_records')}
                </h3>
                <div className="space-y-3">
                  {wasteRecords.length > 0 ? (
                    wasteRecords.slice(0, 3).map((record) => (
                      <div key={record.id} className="flex justify-between items-center border-b pb-2">
                        <div>
                          <p className="font-medium text-sm">
                            {record.source === 'recipe' && record.recipe 
                              ? record.recipe.name 
                              : record.foodSupply.name}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className={getReasonBadgeColor(record.reason)}>
                              {t(record.reason)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(record.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="font-bold text-red-600">QAR {record.cost.toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      {t('no_recent_waste_records')}
                    </div>
                  )}
                  {wasteRecords.length > 3 && (
                    <div className="text-center mt-2">
                      <WasteHistoryDialog>
                        <Button variant="link" size="sm" className="text-primary">
                          {t('view_all_records')}
                        </Button>
                      </WasteHistoryDialog>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="pt-0 pb-2 px-4 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <span>{t('last_updated')}: {new Date().toLocaleTimeString()}</span>
        <span className="text-xs text-muted-foreground">
          {t('data_synced_with_food_supply')}
        </span>
      </CardFooter>
    </Card>
  );
}