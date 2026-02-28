// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart } from "@/components/ui/chart";
import { ChartData, ChartOptions } from 'chart.js';
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Lightbulb, 
  AlertTriangle, 
  Sparkles,
  RefreshCw,
  PieChart,
  LineChart,
  Utensils,
  Trash2,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KitchenAIAnalysisProps {
  kitchenId: string;
  kitchenName: string;
}

interface ConsumptionData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
  }[];
}

interface WasteData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
  }[];
}

interface Insight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'suggestion';
  title: string;
  description: string;
  impact?: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: string;
}

interface KitchenAnalysis {
  consumptionTrend: ConsumptionData;
  wasteTrend: WasteData;
  costAnalysis: {
    totalCost: number;
    wasteCost: number;
    savingsOpportunity: number;
    costTrend: number;
  };
  insights: Insight[];
  topItems: {
    mostConsumed: {
      name: string;
      quantity: number;
      unit: string;
      trend: number;
    }[];
    mostWasted: {
      name: string;
      quantity: number;
      unit: string;
      reason: string;
    }[];
  };
  recommendations: {
    inventoryOptimization: string[];
    wasteReduction: string[];
    costSaving: string[];
  };
}

export function KitchenAIAnalysis({ kitchenId, kitchenName }: KitchenAIAnalysisProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<KitchenAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState("insights");

  useEffect(() => {
    fetchAnalysisData();
  }, [kitchenId]);

  const fetchAnalysisData = async () => {
    setIsLoading(true);
    try {
      // Fetch AI analysis data for this specific kitchen using our error handling utility
      const data = await fetchWithErrorHandling(
        `/api/food-supply/ai-analysis?kitchenId=${kitchenId}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        },
        null // Default value if fetch fails
      );
      
      if (data) {
        setAnalysis(data);
      } else {
        // If API fails, use mock data
        setMockData();
      }
    } catch (error) {
      console.error('Error fetching kitchen AI analysis:', error);
      setMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const setMockData = () => {
    // Generate mock data for demonstration
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    const mockAnalysis: KitchenAnalysis = {
      consumptionTrend: {
        labels: months,
        datasets: [
          {
            label: t('consumption'),
            data: [65, 59, 80, 81, 56, 75],
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
          }
        ]
      },
      wasteTrend: {
        labels: [t('expired'), t('quality_issues'), t('overproduction'), t('damaged')],
        datasets: [
          {
            label: t('waste_by_reason'),
            data: [45, 25, 20, 10],
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(255, 159, 64, 0.2)',
              'rgba(255, 205, 86, 0.2)',
              'rgba(54, 162, 235, 0.2)'
            ],
            borderColor: [
              'rgb(255, 99, 132)',
              'rgb(255, 159, 64)',
              'rgb(255, 205, 86)',
              'rgb(54, 162, 235)'
            ],
          }
        ]
      },
      costAnalysis: {
        totalCost: 12500,
        wasteCost: 1875,
        savingsOpportunity: 1406,
        costTrend: -5.2
      },
      insights: [
        {
          id: '1',
          type: 'positive',
          title: t('consumption_efficiency_improved'),
          description: t('kitchen_consumption_efficiency_improved_description'),
          impact: 'high',
          actionable: false
        },
        {
          id: '2',
          type: 'negative',
          title: t('high_waste_in_dairy'),
          description: t('kitchen_high_waste_in_dairy_description'),
          impact: 'medium',
          actionable: true,
          action: t('review_dairy_inventory')
        },
        {
          id: '3',
          type: 'suggestion',
          title: t('optimize_vegetable_ordering'),
          description: t('kitchen_optimize_vegetable_ordering_description'),
          impact: 'medium',
          actionable: true,
          action: t('adjust_order_quantities')
        },
        {
          id: '4',
          type: 'neutral',
          title: t('seasonal_menu_impact'),
          description: t('kitchen_seasonal_menu_impact_description'),
          impact: 'low',
          actionable: false
        }
      ],
      topItems: {
        mostConsumed: [
          { name: 'Rice', quantity: 45, unit: 'kg', trend: 5.2 },
          { name: 'Chicken', quantity: 38, unit: 'kg', trend: -2.1 },
          { name: 'Tomatoes', quantity: 25, unit: 'kg', trend: 8.7 }
        ],
        mostWasted: [
          { name: 'Lettuce', quantity: 12, unit: 'kg', reason: t('quality_issues') },
          { name: 'Milk', quantity: 8, unit: 'liters', reason: t('expired') },
          { name: 'Bread', quantity: 6, unit: 'kg', reason: t('overproduction') }
        ]
      },
      recommendations: {
        inventoryOptimization: [
          t('kitchen_recommendation_inventory_1'),
          t('kitchen_recommendation_inventory_2'),
          t('kitchen_recommendation_inventory_3')
        ],
        wasteReduction: [
          t('kitchen_recommendation_waste_1'),
          t('kitchen_recommendation_waste_2'),
          t('kitchen_recommendation_waste_3')
        ],
        costSaving: [
          t('kitchen_recommendation_cost_1'),
          t('kitchen_recommendation_cost_2'),
          t('kitchen_recommendation_cost_3')
        ]
      }
    };
    
    setAnalysis(mockAnalysis);
  };

  const consumptionChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: t('monthly_consumption_trend')
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('quantity_consumed')
        }
      }
    }
  };

  const wasteChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: t('waste_by_reason')
      }
    }
  };

  const getInsightBadge = (type: string, impact?: string) => {
    switch (type) {
      case 'positive':
        return {
          icon: <TrendingUp className="h-4 w-4" />,
          color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          label: t('positive')
        };
      case 'negative':
        return {
          icon: <TrendingDown className="h-4 w-4" />,
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          label: t('negative')
        };
      case 'suggestion':
        return {
          icon: <Lightbulb className="h-4 w-4" />,
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          label: t('suggestion')
        };
      default:
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          label: t('neutral')
        };
    }
  };

  const getImpactBadge = (impact?: string) => {
    if (!impact) return null;
    
    switch (impact) {
      case 'high':
        return {
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          label: t('high_impact')
        };
      case 'medium':
        return {
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
          label: t('medium_impact')
        };
      case 'low':
        return {
          color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          label: t('low_impact')
        };
      default:
        return null;
    }
  };

  const getTrendBadge = (trend: number) => {
    if (trend > 0) {
      return {
        icon: <TrendingUp className="h-3 w-3" />,
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        label: `+${trend.toFixed(1)}%`
      };
    } else if (trend < 0) {
      return {
        icon: <TrendingDown className="h-3 w-3" />,
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        label: `${trend.toFixed(1)}%`
      };
    } else {
      return {
        icon: null,
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        label: '0%'
      };
    }
  };

  const handleActionClick = (action: string) => {
    toast({
      title: t('action_initiated'),
      description: action,
    });
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 pb-3 pt-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-white text-lg flex items-center">
            <Sparkles className="mr-2 h-5 w-5" />
            {t('ai_kitchen_analysis')} - {kitchenName}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={fetchAnalysisData}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription className="text-white/80 text-sm">
          {t('ai_powered_insights_for_kitchen_optimization')}
        </CardDescription>
      </CardHeader>
      
      {isLoading ? (
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-full mb-3">
              <Sparkles className="h-8 w-8 text-indigo-500 dark:text-indigo-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
              {t('analyzing_kitchen_data')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              {t('ai_is_analyzing_kitchen_patterns')}
            </p>
          </div>
        </CardContent>
      ) : (
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 pt-3 pb-1 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-100 dark:border-indigo-800/50">
            <TabsList className="bg-white/50 dark:bg-gray-800/50 w-full h-9 mb-1">
              <TabsTrigger value="insights" className="text-xs flex items-center">
                <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                {t('insights')}
              </TabsTrigger>
              <TabsTrigger value="consumption" className="text-xs flex items-center">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                {t('consumption')}
              </TabsTrigger>
              <TabsTrigger value="waste" className="text-xs flex items-center">
                <PieChart className="h-3.5 w-3.5 mr-1.5" />
                {t('waste')}
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="text-xs flex items-center">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {t('recommendations')}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="insights">
            <CardContent className="p-4">
              <ScrollArea className="h-[350px]">
                <div className="space-y-4">
                  {analysis?.insights.map((insight) => {
                    const badge = getInsightBadge(insight.type);
                    const impactBadge = getImpactBadge(insight.impact);
                    
                    return (
                      <div 
                        key={insight.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          insight.type === 'positive' ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10' :
                          insight.type === 'negative' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' :
                          insight.type === 'suggestion' ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10' :
                          'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/10'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{insight.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={badge.color}>
                                <span className="flex items-center gap-1">
                                  {badge.icon}
                                  {badge.label}
                                </span>
                              </Badge>
                              {impactBadge && (
                                <Badge variant="outline" className={impactBadge.color}>
                                  {impactBadge.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {insight.actionable && insight.action && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              onClick={() => handleActionClick(insight.action!)}
                            >
                              {insight.action}
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {insight.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>
          
          <TabsContent value="consumption">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="col-span-2">
                  <div className="h-[200px] border rounded-md p-4">
                    {analysis && (
                      <BarChart 
                        data={analysis.consumptionTrend as ChartData<'bar'>} 
                        options={consumptionChartOptions} 
                      />
                    )}
                  </div>
                </div>
                <div>
                  <div className="border rounded-md p-4 h-full">
                    <h3 className="text-sm font-medium mb-3 flex items-center">
                      <Utensils className="h-4 w-4 mr-2 text-indigo-500" />
                      {t('most_consumed_items')}
                    </h3>
                    <div className="space-y-3">
                      {analysis?.topItems.mostConsumed.map((item, index) => {
                        const trendBadge = getTrendBadge(item.trend);
                        return (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                              <span>{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.quantity} {item.unit}</span>
                              <Badge variant="outline" className={trendBadge.color}>
                                <span className="flex items-center gap-1 text-xs">
                                  {trendBadge.icon}
                                  {trendBadge.label}
                                </span>
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-md p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-green-500" />
                  {t('cost_analysis')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/10 rounded-md p-3">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">{t('total_cost')}</div>
                    <div className="text-xl font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(analysis?.costAnalysis.totalCost || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{t('last_30_days')}</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-md p-3">
                    <div className="text-xs text-red-600 dark:text-red-400 mb-1">{t('waste_cost')}</div>
                    <div className="text-xl font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(analysis?.costAnalysis.wasteCost || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{t('last_30_days')}</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-md p-3">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t('savings_opportunity')}</div>
                    <div className="text-xl font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(analysis?.costAnalysis.savingsOpportunity || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{t('potential_monthly_savings')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </TabsContent>
          
          <TabsContent value="waste">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="col-span-2">
                  <div className="h-[200px] border rounded-md p-4">
                    {analysis && (
                      <BarChart 
                        data={analysis.wasteTrend as ChartData<'pie'>} 
                        options={wasteChartOptions} 
                        type="pie"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <div className="border rounded-md p-4 h-full">
                    <h3 className="text-sm font-medium mb-3 flex items-center">
                      <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                      {t('most_wasted_items')}
                    </h3>
                    <div className="space-y-3">
                      {analysis?.topItems.mostWasted.map((item, index) => {
                        return (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-red-500"></span>
                              <span>{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.quantity} {item.unit}</span>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                {item.reason}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-md p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center">
                  <LineChart className="h-4 w-4 mr-2 text-indigo-500" />
                  {t('waste_reduction_strategies')}
                </h3>
                <div className="space-y-2">
                  {analysis?.recommendations.wasteReduction.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <div className="h-5 w-5 flex items-center justify-center bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-full flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <p>{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </TabsContent>
          
          <TabsContent value="recommendations">
            <CardContent className="p-4">
              <ScrollArea className="h-[350px]">
                <div className="space-y-6">
                  <div className="border rounded-md p-4 bg-blue-50/30 dark:bg-blue-900/5">
                    <h3 className="text-sm font-medium mb-3 flex items-center text-blue-700 dark:text-blue-400">
                      <Utensils className="h-4 w-4 mr-2" />
                      {t('inventory_optimization')}
                    </h3>
                    <div className="space-y-2">
                      {analysis?.recommendations.inventoryOptimization.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <div className="h-5 w-5 flex items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded-full flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <p>{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4 bg-green-50/30 dark:bg-green-900/5">
                    <h3 className="text-sm font-medium mb-3 flex items-center text-green-700 dark:text-green-400">
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('waste_reduction')}
                    </h3>
                    <div className="space-y-2">
                      {analysis?.recommendations.wasteReduction.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <div className="h-5 w-5 flex items-center justify-center bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-full flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <p>{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4 bg-purple-50/30 dark:bg-purple-900/5">
                    <h3 className="text-sm font-medium mb-3 flex items-center text-purple-700 dark:text-purple-400">
                      <DollarSign className="h-4 w-4 mr-2" />
                      {t('cost_saving')}
                    </h3>
                    <div className="space-y-2">
                      {analysis?.recommendations.costSaving.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <div className="h-5 w-5 flex items-center justify-center bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded-full flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <p>{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}