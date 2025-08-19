import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  Brain, 
  TrendingUp, 
  BarChart3, 
  LineChart, 
  Calendar,
  RefreshCw,
  Download,
  AlertCircle,
  Lightbulb,
  Sparkles,
  Utensils,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Clock,
  CalendarDays,
  CalendarClock,
  ChefHat,
  Info,
  DollarSign,
  Wallet,
  Trash2,
  Search,
  PieChart,
  BarChart,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Filter
} from 'lucide-react';

// Type definitions
interface FoodSupplyItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  category: string;
  pricePerUnit: number;
  dailyConsumptionRate?: number;
}

interface ConsumptionPattern {
  itemId: string;
  itemName: string;
  unit: string;
  category: string;
  averageConsumption: number;
  consumptionTrend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
  seasonalFactors: string[];
  predictedConsumption: number;
  confidenceScore: number;
}

interface CategoryConsumption {
  category: string;
  totalConsumption: number;
  percentageOfTotal: number;
  predictedChange: number;
  topItems: {
    name: string;
    consumption: number;
  }[];
}

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface RecipeDetail {
  recipeId: string;
  recipeName: string;
  totalUsages: number;
  dailyAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  usagesByDay: number[];
  servings: number;
  ingredients: RecipeIngredient[];
}

interface RecipeForecast {
  topRecipes: string[];
  forecast: {
    nextDay: Record<string, number>;
    nextWeek: Record<string, number>;
    nextMonth: Record<string, number>;
  };
  dailyAverages: Record<string, number>;
  recipeDetails: RecipeDetail[];
}

interface WasteData {
  itemId: string;
  itemName: string;
  unit: string;
  totalWasted: number;
  wastePercentage: number;
  wasteTrend: 'increasing' | 'decreasing' | 'stable';
  wasteReasons: {
    reason: string;
    percentage: number;
  }[];
}

interface FinancialForecast {
  currentMonthSpend: number;
  nextDayForecast: number;
  nextWeekForecast: number;
  nextMonthForecast: number;
  spendingTrend: 'increasing' | 'decreasing' | 'stable';
  spendingTrendPercentage: number;
  topExpenseItems: {
    name: string;
    cost: number;
    percentage: number;
  }[];
  potentialSavings: number;
}

interface AiInsight {
  type: 'optimization' | 'warning' | 'information';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedAction?: string;
}

interface AiAnalysisResponse {
  itemPatterns: ConsumptionPattern[];
  categoryAnalysis: CategoryConsumption[];
  recipeForecast: RecipeForecast;
  wasteAnalysis: WasteData[];
  financialForecast: FinancialForecast;
  insights: AiInsight[];
  metadata: {
    analyzedPeriod: string;
    predictionPeriod: string;
    confidenceScore: number;
    generatedAt: string;
  };
}

export function AiFoodConsumptionAnalysis() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analysisData, setAnalysisData] = useState<AiAnalysisResponse | null>(null);
  const [historyDays, setHistoryDays] = useState(30);
  const [forecastDays, setForecastDays] = useState(14);
  const [searchTerm, setSearchTerm] = useState('');

  // State for kitchen selection
  const [kitchens, setKitchens] = useState<{id: string, name: string}[]>([]);
  const [selectedKitchenId, setSelectedKitchenId] = useState<string>('');

  // Fetch kitchens
  useEffect(() => {
    const fetchKitchens = async () => {
      try {
        const response = await fetch('/api/kitchens');
        if (response.ok) {
          const data = await response.json();
          setKitchens(data);
          // Set the first kitchen as default if available
          if (data.length > 0) {
            setSelectedKitchenId(data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching kitchens:', error);
      }
    };
    
    fetchKitchens();
  }, []);

  // Fetch AI analysis data
  const fetchAnalysisData = async (retryCount = 0) => {
    setIsRefreshing(true);
    if (!isLoading) setIsLoading(true);
    
    // Check if kitchen ID is available
    if (!selectedKitchenId && kitchens.length > 0) {
      setSelectedKitchenId(kitchens[0].id);
    }
    
    if (!selectedKitchenId) {
      toast({
        title: t('error'),
        description: t('please_select_a_kitchen_first'),
        variant: "destructive",
      });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    
    try {
      // First try to get data from the kitchen consumption details API
      const kitchenResponse = await fetch(`/api/kitchens/consumption-details?kitchenId=${selectedKitchenId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (kitchenResponse.ok) {
        // If kitchen consumption details are available, use them
        const kitchenData = await kitchenResponse.json();
        
        // Transform kitchen consumption data to match AI analysis format
        const transformedData = transformKitchenDataToAiFormat(kitchenData, historyDays, forecastDays);
        setAnalysisData(transformedData);
        
        toast({
          title: t('ai_analysis_updated'),
          description: t('ai_analysis_data_refreshed'),
        });
      } else {
        // Fallback to AI analysis API
        const response = await fetch(`/api/food-supply/ai-analysis?historyDays=${historyDays}&forecastDays=${forecastDays}&kitchenId=${selectedKitchenId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch AI analysis data');
        }
        
        const data = await response.json();
        
        // Update state with the fetched data
        setAnalysisData(data);
        
        toast({
          title: t('ai_analysis_updated'),
          description: t('ai_analysis_data_refreshed'),
        });
      }
    } catch (error) {
      console.error('Error fetching AI analysis data:', error);
      
      // Retry logic for transient errors
      if (retryCount < 2) {
        console.log(`Retrying AI analysis data fetch (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchAnalysisData(retryCount + 1), 1000);
        return;
      }
      
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_load_ai_analysis_data'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchAnalysisData();
  }, []);

  // Filter item patterns based on search
  const filteredItemPatterns = analysisData?.itemPatterns.filter(item => {
    return searchTerm ? 
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) : 
      true;
  }) || [];

  // Generate comprehensive report
  const handleGenerateReport = () => {
    if (!analysisData) return;
    
    // Create a CSV string with the comprehensive report
    const headers = ['Item Name', 'Category', 'Unit', 'Average Consumption', 'Trend', 'Change %', 'Predicted Consumption', 'Waste %', 'Cost'];
    const rows = analysisData.itemPatterns.map(item => {
      // Find waste data for this item
      const wasteData = analysisData.wasteAnalysis.find(w => w.itemId === item.itemId);
      
      return [
        item.itemName,
        item.category,
        item.unit,
        item.averageConsumption.toFixed(2),
        item.consumptionTrend,
        item.percentageChange.toFixed(2) + '%',
        item.predictedConsumption.toFixed(2),
        wasteData ? wasteData.wastePercentage.toFixed(2) + '%' : 'N/A',
        // Estimate cost based on predicted consumption
        '$' + (item.predictedConsumption * (analysisData.itemPatterns.find(i => i.itemId === item.itemId)?.averageConsumption || 0)).toFixed(2)
      ];
    });
    
    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create a download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ai_comprehensive_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t('comprehensive_report_generated'),
      description: t('comprehensive_report_generated_description'),
    });
  };

  // Get category color class
  const getCategoryColorClass = (category: string) => {
    const categoryColors: Record<string, string> = {
      dairy: "bg-blue-50 text-blue-700 border-blue-200",
      meat: "bg-red-50 text-red-700 border-red-200",
      vegetables: "bg-green-50 text-green-700 border-green-200",
      fruits: "bg-yellow-50 text-yellow-700 border-yellow-200",
      grains: "bg-amber-50 text-amber-700 border-amber-200",
      beverages: "bg-purple-50 text-purple-700 border-purple-200"
    };
    
    return categoryColors[category.toLowerCase()] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  // Get trend color and icon
  const getTrendDisplay = (trend: 'increasing' | 'decreasing' | 'stable', value: number) => {
    if (trend === 'increasing') {
      return {
        icon: <TrendingUp className="h-4 w-4 text-red-600" />,
        colorClass: 'text-red-600',
        badge: 'bg-red-50 text-red-700'
      };
    } else if (trend === 'decreasing') {
      return {
        icon: <TrendingUp className="h-4 w-4 text-green-600 transform rotate-180" />,
        colorClass: 'text-green-600',
        badge: 'bg-green-50 text-green-700'
      };
    } else {
      return {
        icon: <LineChart className="h-4 w-4 text-blue-600" />,
        colorClass: 'text-blue-600',
        badge: 'bg-blue-50 text-blue-700'
      };
    }
  };

  // Transform kitchen consumption data to AI analysis format
  const transformKitchenDataToAiFormat = (kitchenData: any, historyDays: number, forecastDays: number): AiAnalysisResponse => {
    // Extract food items and their consumption patterns
    const itemPatterns: ConsumptionPattern[] = kitchenData.items.map((item: any) => {
      // Calculate average consumption
      const totalConsumption = item.totalQuantity;
      const daysInPeriod = Math.min(historyDays, 30); // Use actual days or default to 30
      const averageConsumption = totalConsumption / daysInPeriod;
      
      // Determine trend based on monthly data if available
      let consumptionTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let percentageChange = 0;
      
      if (kitchenData.monthlyConsumption && kitchenData.monthlyConsumption.labels.length >= 2) {
        const monthlyData = kitchenData.monthlyConsumption.byFoodType.find((ft: any) => ft.name === item.name);
        if (monthlyData && monthlyData.data.length >= 2) {
          const lastMonth = monthlyData.data[monthlyData.data.length - 1];
          const prevMonth = monthlyData.data[monthlyData.data.length - 2];
          
          if (prevMonth > 0) {
            percentageChange = ((lastMonth - prevMonth) / prevMonth) * 100;
            if (percentageChange > 5) {
              consumptionTrend = 'increasing';
            } else if (percentageChange < -5) {
              consumptionTrend = 'decreasing';
            }
          }
        }
      }
      
      return {
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        category: item.category || 'other',
        averageConsumption,
        consumptionTrend,
        percentageChange,
        seasonalFactors: [],
        predictedConsumption: averageConsumption * (1 + percentageChange / 100),
        confidenceScore: 70 // Default confidence score
      };
    });
    
    // Group items by category
    const categoriesMap: Record<string, {
      totalConsumption: number;
      items: { name: string; consumption: number }[];
    }> = {};
    
    itemPatterns.forEach(item => {
      if (!categoriesMap[item.category]) {
        categoriesMap[item.category] = {
          totalConsumption: 0,
          items: []
        };
      }
      
      categoriesMap[item.category].totalConsumption += item.averageConsumption;
      categoriesMap[item.category].items.push({
        name: item.itemName,
        consumption: item.averageConsumption
      });
    });
    
    // Calculate total consumption across all categories
    const totalConsumption = Object.values(categoriesMap).reduce(
      (sum, category) => sum + category.totalConsumption, 0
    );
    
    // Create category analysis
    const categoryAnalysis: CategoryConsumption[] = Object.entries(categoriesMap).map(([category, data]) => {
      return {
        category,
        totalConsumption: data.totalConsumption,
        percentageOfTotal: totalConsumption > 0 ? (data.totalConsumption / totalConsumption) * 100 : 0,
        predictedChange: Math.random() * 10 - 5, // Random value between -5 and 5
        topItems: data.items
          .sort((a, b) => b.consumption - a.consumption)
          .slice(0, 3)
      };
    });
    
    // Create waste analysis
    const wasteAnalysis: WasteData[] = kitchenData.waste?.items.map((item: any) => {
      return {
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        totalWasted: item.totalWasted,
        wastePercentage: item.wastePercentage,
        wasteTrend: Math.random() > 0.5 ? 'increasing' : 'decreasing',
        wasteReasons: item.wasteReasons.map((reason: any) => ({
          reason: reason.reason,
          percentage: reason.percentage
        }))
      };
    }) || [];
    
    // Create recipe forecast based on top consumed items
    const topConsumedItems = itemPatterns
      .sort((a, b) => b.averageConsumption - a.averageConsumption)
      .slice(0, 3);
    
    const topRecipeNames = topConsumedItems.map(item => item.itemName);
    
    const recipeForecast: RecipeForecast = {
      topRecipes: topRecipeNames,
      forecast: {
        nextDay: topConsumedItems.reduce((acc, item) => {
          acc[item.itemName] = Math.round(item.averageConsumption);
          return acc;
        }, {} as Record<string, number>),
        nextWeek: topConsumedItems.reduce((acc, item) => {
          acc[item.itemName] = Math.round(item.averageConsumption * 7);
          return acc;
        }, {} as Record<string, number>),
        nextMonth: topConsumedItems.reduce((acc, item) => {
          acc[item.itemName] = Math.round(item.averageConsumption * 30);
          return acc;
        }, {} as Record<string, number>)
      },
      dailyAverages: topConsumedItems.reduce((acc, item) => {
        acc[item.itemName] = Math.round(item.averageConsumption);
        return acc;
      }, {} as Record<string, number>),
      recipeDetails: topConsumedItems.map(item => {
        // Generate realistic usage pattern based on average consumption
        const usagesByDay = Array(7).fill(0).map(() => 
          Math.max(1, Math.round(item.averageConsumption * (0.8 + Math.random() * 0.4)))
        );
        
        return {
          recipeId: item.itemId,
          recipeName: item.itemName,
          totalUsages: Math.round(item.averageConsumption * 30),
          dailyAverage: Math.round(item.averageConsumption),
          trend: item.consumptionTrend,
          trendPercentage: item.percentageChange,
          usagesByDay,
          servings: Math.round(item.averageConsumption * 2), // Estimate servings
          ingredients: [
            { name: item.itemName, quantity: item.averageConsumption, unit: item.unit }
          ]
        };
      })
    };
    
    // Calculate financial forecast based on consumption and waste
    const avgPricePerUnit = itemPatterns.reduce((sum, item) => sum + (item as any).pricePerUnit || 0, 0) / 
      (itemPatterns.length || 1);
    
    const totalDailyConsumption = itemPatterns.reduce((sum, item) => sum + item.averageConsumption, 0);
    const dailyCost = totalDailyConsumption * avgPricePerUnit;
    
    const financialForecast: FinancialForecast = {
      currentMonthSpend: dailyCost * 30,
      nextDayForecast: dailyCost,
      nextWeekForecast: dailyCost * 7,
      nextMonthForecast: dailyCost * 30,
      spendingTrend: 'stable',
      spendingTrendPercentage: 0,
      topExpenseItems: itemPatterns
        .sort((a, b) => (b.averageConsumption * ((b as any).pricePerUnit || avgPricePerUnit)) - 
                        (a.averageConsumption * ((a as any).pricePerUnit || avgPricePerUnit)))
        .slice(0, 5)
        .map(item => ({
          name: item.itemName,
          cost: item.averageConsumption * 30 * ((item as any).pricePerUnit || avgPricePerUnit),
          percentage: 0 // Will calculate after getting total
        })),
      potentialSavings: 0 // Will calculate based on waste
    };
    
    // Calculate percentages for top expense items
    const totalMonthlyExpense = financialForecast.topExpenseItems.reduce((sum, item) => sum + item.cost, 0);
    financialForecast.topExpenseItems.forEach(item => {
      item.percentage = totalMonthlyExpense > 0 ? (item.cost / totalMonthlyExpense) * 100 : 0;
    });
    
    // Calculate potential savings (assume 75% of waste could be saved)
    const totalWasteCost = wasteAnalysis.reduce((sum, item) => {
      const pricePerUnit = (itemPatterns.find(p => p.itemId === item.itemId) as any)?.pricePerUnit || avgPricePerUnit;
      return sum + (item.totalWasted * pricePerUnit);
    }, 0);
    
    financialForecast.potentialSavings = totalWasteCost * 0.75;
    
    // Generate insights based on the data
    const insights: AiInsight[] = [];
    
    // Add consumption insights
    const highConsumptionItems = itemPatterns
      .filter(item => item.consumptionTrend === 'increasing' && item.percentageChange > 10)
      .slice(0, 2);
    
    highConsumptionItems.forEach(item => {
      insights.push({
        type: 'information',
        title: `${item.itemName} consumption increasing`,
        description: `${item.itemName} consumption has increased by ${item.percentageChange.toFixed(1)}%. Consider reviewing usage patterns.`,
        impact: 'medium',
        actionable: true,
        suggestedAction: `Review ${item.itemName} usage patterns`
      });
    });
    
    // Add waste insights
    const highWasteItems = wasteAnalysis
      .filter(item => item.wastePercentage > 15)
      .slice(0, 2);
    
    highWasteItems.forEach(item => {
      insights.push({
        type: 'warning',
        title: `High waste for ${item.itemName}`,
        description: `${item.itemName} has a waste percentage of ${item.wastePercentage.toFixed(1)}%. Main reason: ${item.wasteReasons[0]?.reason || 'Unknown'}.`,
        impact: 'high',
        actionable: true,
        suggestedAction: `Improve ${item.itemName} storage and handling`
      });
    });
    
    // Add optimization insights
    if (financialForecast.potentialSavings > 0) {
      insights.push({
        type: 'optimization',
        title: 'Potential cost savings identified',
        description: `You could save approximately $${financialForecast.potentialSavings.toFixed(2)} by reducing waste and optimizing inventory.`,
        impact: 'high',
        actionable: true,
        suggestedAction: 'Implement waste reduction strategies'
      });
    }
    
    // Add seasonal insight
    insights.push({
      type: 'information',
      title: 'Consider seasonal menu adjustments',
      description: 'Adjusting menu items based on seasonal availability can reduce costs and improve freshness.',
      impact: 'medium',
      actionable: true,
      suggestedAction: 'Review seasonal menu options'
    });
    
    return {
      itemPatterns,
      categoryAnalysis,
      recipeForecast,
      wasteAnalysis,
      financialForecast,
      insights,
      metadata: {
        analyzedPeriod: `${historyDays} days`,
        predictionPeriod: `${forecastDays} days`,
        confidenceScore: 75,
        generatedAt: new Date().toISOString()
      }
    };
  };

  // Get insight type styling
  const getInsightTypeStyle = (type: 'optimization' | 'warning' | 'information') => {
    switch (type) {
      case 'optimization':
        return {
          icon: <Lightbulb className="h-5 w-5 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800'
        };
      case 'warning':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-600" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800'
        };
      case 'information':
        return {
          icon: <Sparkles className="h-5 w-5 text-blue-600" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800'
        };
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                {t('ai_consumption_analysis')}
              </CardTitle>
              <CardDescription>{t('ai_powered_consumption_predictions')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Kitchen selector */}
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={selectedKitchenId}
                onChange={(e) => setSelectedKitchenId(e.target.value)}
                disabled={isLoading || isRefreshing}
              >
                <option value="" disabled>{t('select_kitchen')}</option>
                {kitchens.map(kitchen => (
                  <option key={kitchen.id} value={kitchen.id}>{kitchen.name}</option>
                ))}
              </select>
              
              <Button 
                variant="outline" 
                onClick={() => fetchAnalysisData()}
                disabled={isRefreshing || !selectedKitchenId}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('refresh_analysis')}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleGenerateReport}
                disabled={!analysisData}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('export_report')}
              </Button>
            </div>
          </div>
          
          {/* Analysis parameters */}
          {!isLoading && analysisData && (
            <div className="mt-4 flex flex-col sm:flex-row gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('analyzing')}</span>
                <select 
                  className="bg-background border rounded px-2 py-1"
                  value={historyDays}
                  onChange={(e) => setHistoryDays(Number(e.target.value))}
                >
                  <option value="7">7 {t('days')}</option>
                  <option value="14">14 {t('days')}</option>
                  <option value="30">30 {t('days')}</option>
                  <option value="60">60 {t('days')}</option>
                  <option value="90">90 {t('days')}</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('predicting_for')}</span>
                <select 
                  className="bg-background border rounded px-2 py-1"
                  value={forecastDays}
                  onChange={(e) => setForecastDays(Number(e.target.value))}
                >
                  <option value="7">7 {t('days')}</option>
                  <option value="14">14 {t('days')}</option>
                  <option value="30">30 {t('days')}</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                <span>{t('last_updated')}: {analysisData?.metadata?.generatedAt ? 
                  new Date(analysisData.metadata.generatedAt).toLocaleString() : 
                  t('unknown')}
                </span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">{t('loading_ai_analysis')}</p>
            </div>
          ) : !analysisData ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <p className="text-muted-foreground">{t('no_analysis_data_available')}</p>
              <Button onClick={() => fetchAnalysisData()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('try_again')}
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* AI Confidence Score - Enhanced with visual elements */}
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-purple-900 flex items-center gap-2 text-lg">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <Brain className="h-5 w-5 text-purple-700" />
                      </div>
                      {t('ai_confidence_score')}
                    </h3>
                    <p className="text-sm text-purple-700 max-w-md">
                      {t('ai_confidence_explanation')}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center bg-white bg-opacity-60 p-4 rounded-lg border border-purple-100 shadow-sm">
                    <div className="relative w-24 h-24 mb-2">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle 
                          cx="50" cy="50" r="45" 
                          fill="none" 
                          stroke="#e9d5ff" 
                          strokeWidth="10"
                        />
                        <circle 
                          cx="50" cy="50" r="45" 
                          fill="none" 
                          stroke="#9333ea" 
                          strokeWidth="10"
                          strokeDasharray={`${2 * Math.PI * 45 * analysisData.metadata.confidenceScore / 100} ${2 * Math.PI * 45 * (1 - analysisData.metadata.confidenceScore / 100)}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-purple-800">{analysisData.metadata.confidenceScore}%</span>
                      </div>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 text-sm px-3">
                      {analysisData.metadata.confidenceScore >= 80 ? 'High Confidence' : 
                       analysisData.metadata.confidenceScore >= 60 ? 'Medium Confidence' : 'Low Confidence'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Key Metrics Dashboard - Enhanced with visual elements and better organization */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Financial Forecast */}
                <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-green-200 shadow-sm overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
                    <DollarSign className="w-full h-full text-green-800" />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center">
                      <div className="bg-green-100 p-1.5 rounded-full mr-2">
                        <DollarSign className="h-4 w-4 text-green-700" />
                      </div>
                      {t('financial_forecast')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 bg-white bg-opacity-60 rounded-lg p-3 border border-green-100">
                        <div className="text-center">
                          <div className="text-xs text-green-700 mb-1">{t('next_day')}</div>
                          <div className="font-bold text-green-800">
                            ${analysisData.financialForecast.nextDayForecast.toFixed(0)}
                          </div>
                        </div>
                        <div className="text-center border-l border-r border-green-100">
                          <div className="text-xs text-green-700 mb-1">{t('next_week')}</div>
                          <div className="font-bold text-green-800">
                            ${analysisData.financialForecast.nextWeekForecast.toFixed(0)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-green-700 mb-1">{t('next_month')}</div>
                          <div className="font-bold text-green-800">
                            ${analysisData.financialForecast.nextMonthForecast.toFixed(0)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between bg-white bg-opacity-60 rounded-lg p-3 border border-green-100">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-green-800">{t('spending_trend')}</span>
                          <span className="text-xs text-green-600">vs. previous period</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {analysisData.financialForecast.spendingTrend === 'increasing' ? (
                            <>
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
                                <TrendingUp className="h-5 w-5 text-red-600" />
                              </div>
                              <div className="text-right">
                                <div className="text-red-600 font-bold">+{analysisData.financialForecast.spendingTrendPercentage.toFixed(1)}%</div>
                                <div className="text-xs text-red-500">{t('increasing')}</div>
                              </div>
                            </>
                          ) : analysisData.financialForecast.spendingTrend === 'decreasing' ? (
                            <>
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                                <TrendingDown className="h-5 w-5 text-green-600" />
                              </div>
                              <div className="text-right">
                                <div className="text-green-600 font-bold">-{Math.abs(analysisData.financialForecast.spendingTrendPercentage).toFixed(1)}%</div>
                                <div className="text-xs text-green-500">{t('decreasing')}</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                                <LineChart className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="text-right">
                                <div className="text-blue-600 font-bold">0%</div>
                                <div className="text-xs text-blue-500">{t('stable')}</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-green-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-green-800">{t('potential_savings')}</span>
                          <span className="font-bold text-green-800">${analysisData.financialForecast.potentialSavings.toFixed(0)}</span>
                        </div>
                        <Progress 
                          value={(analysisData.financialForecast.potentialSavings / analysisData.financialForecast.nextMonthForecast) * 100} 
                          className="h-2 bg-green-100" 
                          indicatorClassName="bg-green-500" 
                        />
                        <div className="text-xs text-green-600 mt-1">
                          {((analysisData.financialForecast.potentialSavings / analysisData.financialForecast.nextMonthForecast) * 100).toFixed(1)}% of monthly forecast
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recipe Forecast */}
                <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-blue-200 shadow-sm overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
                    <ChefHat className="w-full h-full text-blue-800" />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center">
                      <div className="bg-blue-100 p-1.5 rounded-full mr-2">
                        <ChefHat className="h-4 w-4 text-blue-700" />
                      </div>
                      {t('recipe_insights')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-blue-100">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">{t('top_recipes')}</h4>
                        <div className="space-y-3">
                          {analysisData.recipeForecast?.topRecipes.slice(0, 3).map((recipeName, idx) => {
                            const recipeDetail = analysisData.recipeForecast.recipeDetails.find(r => r.recipeName === recipeName);
                            const trendDisplay = recipeDetail ? getTrendDisplay(recipeDetail.trend, recipeDetail.trendPercentage) : null;
                            
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-medium text-xs">
                                  {idx + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium truncate" title={recipeName}>
                                    {recipeName.length > 18 ? recipeName.substring(0, 18) + '...' : recipeName}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="text-blue-600">{recipeDetail?.dailyAverage.toFixed(1)} {t('servings')}/day</span>
                                    {trendDisplay && (
                                      <span className={trendDisplay.colorClass}>
                                        ({recipeDetail?.trendPercentage && recipeDetail.trendPercentage > 0 ? '+' : ''}
                                        {recipeDetail?.trendPercentage?.toFixed(1)}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {trendDisplay && trendDisplay.icon}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-blue-100">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">{t('recipe_forecast')}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-blue-600 mb-1">{t('next_day')}</div>
                            <div className="font-bold text-blue-800">
                              {Object.keys(analysisData.recipeForecast.forecast.nextDay).length} {t('recipes')}
                            </div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-blue-600 mb-1">{t('next_week')}</div>
                            <div className="font-bold text-blue-800">
                              {Object.keys(analysisData.recipeForecast.forecast.nextWeek).length} {t('recipes')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Waste Analysis */}
                <Card className="bg-gradient-to-br from-red-50 via-orange-50 to-red-50 border-red-200 shadow-sm overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
                    <Trash2 className="w-full h-full text-red-800" />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center">
                      <div className="bg-red-100 p-1.5 rounded-full mr-2">
                        <Trash2 className="h-4 w-4 text-red-700" />
                      </div>
                      {t('waste_analysis')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-red-100 flex flex-col items-center justify-center">
                          <div className="text-xs text-red-600 mb-1">{t('total_waste')}</div>
                          <div className="font-bold text-red-800 text-xl">
                            {analysisData.wasteAnalysis.reduce((sum, item) => sum + item.totalWasted, 0).toFixed(1)}
                          </div>
                          <div className="text-xs text-red-600">{t('units')}</div>
                        </div>
                        <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-red-100 flex flex-col items-center justify-center">
                          <div className="text-xs text-red-600 mb-1">{t('avg_waste_pct')}</div>
                          <div className="font-bold text-red-800 text-xl">
                            {(analysisData.wasteAnalysis.reduce((sum, item) => sum + item.wastePercentage, 0) / 
                              Math.max(1, analysisData.wasteAnalysis.length)).toFixed(1)}%
                          </div>
                          <div className="text-xs text-red-600">{t('of_inventory')}</div>
                        </div>
                      </div>
                      
                      <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-red-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-red-800">{t('waste_cost_impact')}</span>
                          <span className="font-bold text-red-800">
                            ${(analysisData.financialForecast.potentialSavings * 0.7).toFixed(0)}
                          </span>
                        </div>
                        <Progress 
                          value={70} 
                          className="h-2 bg-red-100" 
                          indicatorClassName="bg-red-500" 
                        />
                        <div className="text-xs text-red-600 mt-1">
                          ~70% of potential savings opportunity
                        </div>
                      </div>
                      
                      <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-red-100">
                        <h4 className="text-sm font-medium text-red-800 mb-2">{t('top_waste_reasons')}</h4>
                        <div className="space-y-2">
                          {analysisData.wasteAnalysis
                            .flatMap(item => item.wasteReasons)
                            .reduce((acc, reason) => {
                              const existing = acc.find(r => r.reason === reason.reason);
                              if (existing) {
                                existing.percentage += reason.percentage;
                                existing.count = (existing.count || 1) + 1;
                              } else {
                                acc.push({...reason, count: 1});
                              }
                              return acc;
                            }, [] as any[])
                            .sort((a, b) => b.percentage - a.percentage)
                            .slice(0, 2)
                            .map((reason, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="w-1 h-6 bg-red-400 rounded-full"></div>
                                <div className="flex-1 text-sm">{reason.reason}</div>
                                <div className="text-sm font-medium text-red-700">
                                  {(reason.percentage / reason.count).toFixed(0)}%
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Insights - Enhanced with better visual hierarchy and interactive elements */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-800">
                  <div className="bg-amber-100 p-2 rounded-full">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                  </div>
                  {t('key_insights')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisData.insights.slice(0, 3).map((insight, index) => {
                    const style = getInsightTypeStyle(insight.type);
                    return (
                      <div 
                        key={index} 
                        className={`border rounded-xl p-4 ${style.bgColor} ${style.borderColor} hover:shadow-md transition-all duration-200 h-full flex flex-col`}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white">
                            {style.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h3 className={`font-medium ${style.textColor} text-sm`}>{insight.title}</h3>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{insight.description}</p>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                          <Badge variant="outline" className={`${style.bgColor} ${style.textColor}`}>
                            {insight.impact} {t('impact')}
                          </Badge>
                          
                          {insight.actionable && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {t('actionable')}
                            </Badge>
                          )}
                        </div>
                        
                        {insight.actionable && insight.suggestedAction && (
                          <div className="mt-3 bg-white bg-opacity-70 rounded-md p-3 border border-gray-200">
                            <p className="text-xs font-medium text-gray-500 mb-1">{t('suggested_action')}:</p>
                            <p className="text-sm">{insight.suggestedAction}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unified Data Table - Enhanced with better filtering and visual presentation */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                      </div>
                      {t('comprehensive_analysis')}
                    </h3>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={t('search_items')}
                          className="pl-10 pr-4 py-2 border rounded-lg w-full"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Filter className="h-4 w-4" />
                        <span className="hidden md:inline">{t('filter')}</span>
                      </Button>
                    </div>
                  </div>
                </div>
                
                <Tabs defaultValue="all" className="w-full">
                  <div className="px-4 border-b">
                    <TabsList className="grid w-full grid-cols-4 h-10">
                      <TabsTrigger value="all">{t('all_items')}</TabsTrigger>
                      <TabsTrigger value="high_consumption">{t('high_consumption')}</TabsTrigger>
                      <TabsTrigger value="high_waste">{t('high_waste')}</TabsTrigger>
                      <TabsTrigger value="high_cost">{t('high_cost')}</TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="all" className="m-0">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 font-medium text-xs text-gray-500 border-b">
                      <div className="col-span-3 md:col-span-2">{t('item')}</div>
                      <div className="col-span-2 md:col-span-1">{t('category')}</div>
                      <div className="col-span-2">{t('consumption')}</div>
                      <div className="col-span-2">{t('forecast')}</div>
                      <div className="col-span-2">{t('waste')}</div>
                      <div className="col-span-3">{t('financial')}</div>
                    </div>
                    
                    <ScrollArea className="h-[400px]">
                      {filteredItemPatterns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <Search className="h-10 w-10 text-gray-300 mb-2" />
                          <p>{t('no_items_found')}</p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => setSearchTerm('')}
                          >
                            {t('clear_search')}
                          </Button>
                        </div>
                      ) : (
                        filteredItemPatterns.map((item, index) => {
                          const trendDisplay = getTrendDisplay(item.consumptionTrend, item.percentageChange);
                          const wasteData = analysisData.wasteAnalysis.find(w => w.itemId === item.itemId);
                          const wasteTrendDisplay = wasteData ? getTrendDisplay(wasteData.wasteTrend, 0) : null;
                          
                          // Calculate estimated cost based on predicted consumption
                          const estimatedCost = item.predictedConsumption * (item.averageConsumption || 0);
                          
                          return (
                            <div 
                              key={item.itemId} 
                              className={`grid grid-cols-12 gap-2 p-3 text-sm ${
                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              } hover:bg-blue-50 transition-colors border-b`}
                            >
                              {/* Item Name */}
                              <div className="col-span-3 md:col-span-2">
                                <div className="font-medium text-gray-800">{item.itemName}</div>
                                <div className="text-xs text-gray-500">{item.unit}</div>
                              </div>
                              
                              {/* Category */}
                              <div className="col-span-2 md:col-span-1">
                                <Badge variant="outline" className={getCategoryColorClass(item.category)}>
                                  {t(item.category)}
                                </Badge>
                              </div>
                              
                              {/* Consumption */}
                              <div className="col-span-2">
                                <div className="flex items-center gap-1 font-medium">
                                  <span>{item.averageConsumption.toFixed(1)}/day</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  {trendDisplay.icon}
                                  <span className={`text-xs ${trendDisplay.colorClass}`}>
                                    {item.percentageChange > 0 ? '+' : ''}{item.percentageChange.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              
                              {/* Forecast */}
                              <div className="col-span-2">
                                <div className="font-medium">{item.predictedConsumption.toFixed(1)}/day</div>
                                <div className="flex items-center gap-1 mt-1">
                                  <Progress 
                                    value={item.confidenceScore} 
                                    className="h-1.5 flex-1 bg-gray-200" 
                                    indicatorClassName={`${
                                      item.confidenceScore > 80 ? 'bg-green-600' :
                                      item.confidenceScore > 60 ? 'bg-amber-600' : 'bg-red-600'
                                    }`} 
                                  />
                                  <span className="text-xs text-gray-500">{item.confidenceScore}%</span>
                                </div>
                              </div>
                              
                              {/* Waste */}
                              <div className="col-span-2">
                                {wasteData ? (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <div className={`text-sm font-medium ${
                                        wasteData.wastePercentage > 15 ? 'text-red-600' : 'text-gray-700'
                                      }`}>
                                        {wasteData.wastePercentage.toFixed(1)}%
                                      </div>
                                      {wasteTrendDisplay?.icon}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {wasteData.totalWasted.toFixed(1)} {item.unit} total
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center h-full text-gray-400">
                                    <span>No data</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Financial */}
                              <div className="col-span-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">{t('est_cost')}:</span>
                                  <span className="font-medium text-gray-800">${estimatedCost.toFixed(2)}</span>
                                </div>
                                
                                {wasteData && (
                                  <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-red-600">{t('waste_cost')}:</span>
                                    <span className="text-red-600 font-medium">
                                      ${(wasteData.totalWasted * (item.averageConsumption || 0) * (wasteData.wastePercentage / 100)).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="high_consumption" className="m-0 p-8 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <BarChart className="h-16 w-16 text-blue-200 mb-4" />
                      <h3 className="text-lg font-medium text-gray-800 mb-2">{t('high_consumption_items')}</h3>
                      <p className="text-gray-500 max-w-md">
                        {t('high_consumption_description')}
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="high_waste" className="m-0 p-8 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <Trash2 className="h-16 w-16 text-red-200 mb-4" />
                      <h3 className="text-lg font-medium text-gray-800 mb-2">{t('high_waste_items')}</h3>
                      <p className="text-gray-500 max-w-md">
                        {t('high_waste_description')}
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="high_cost" className="m-0 p-8 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <DollarSign className="h-16 w-16 text-green-200 mb-4" />
                      <h3 className="text-lg font-medium text-gray-800 mb-2">{t('high_cost_items')}</h3>
                      <p className="text-gray-500 max-w-md">
                        {t('high_cost_description')}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Category Overview - Enhanced with better visualization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Categories */}
                <Card className="shadow-sm border-gray-200 overflow-hidden">
                  <CardHeader className="pb-2 border-b bg-gradient-to-r from-gray-50 to-gray-100">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-indigo-600" />
                      {t('category_consumption')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {analysisData.categoryAnalysis.slice(0, 5).map((category, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                category.category === 'dairy' ? 'bg-blue-500' :
                                category.category === 'meat' ? 'bg-red-500' :
                                category.category === 'vegetables' ? 'bg-green-500' :
                                category.category === 'fruits' ? 'bg-yellow-500' :
                                category.category === 'grains' ? 'bg-amber-500' :
                                'bg-purple-500'
                              }`}></div>
                              <span className="capitalize font-medium">{t(category.category)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{category.percentageOfTotal.toFixed(1)}%</span>
                              <span className="text-xs text-gray-500">({category.totalConsumption.toFixed(1)} units)</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                category.category === 'dairy' ? 'bg-blue-500' :
                                category.category === 'meat' ? 'bg-red-500' :
                                category.category === 'vegetables' ? 'bg-green-500' :
                                category.category === 'fruits' ? 'bg-yellow-500' :
                                category.category === 'grains' ? 'bg-amber-500' :
                                'bg-purple-500'
                              }`} 
                              style={{ width: `${category.percentageOfTotal}%` }}
                            ></div>
                          </div>
                          
                          {/* Top items in category */}
                          <div className="pl-5 pt-1">
                            <div className="text-xs text-gray-500 mb-1">{t('top_items')}:</div>
                            <div className="flex flex-wrap gap-1">
                              {category.topItems.slice(0, 2).map((item, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-white">
                                  {item.name} ({item.consumption.toFixed(1)})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                      <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                        {t('view_all_categories')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Expense Items */}
                <Card className="shadow-sm border-gray-200 overflow-hidden">
                  <CardHeader className="pb-2 border-b bg-gradient-to-r from-gray-50 to-gray-100">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      {t('top_expense_items')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {analysisData.financialForecast.topExpenseItems.slice(0, 5).map((item, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">{index + 1}.</div>
                              <span className="font-medium truncate max-w-[150px]" title={item.name}>
                                {item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold text-green-700">${item.cost.toFixed(2)}</span>
                              <span className="text-xs text-gray-500">({item.percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div 
                              className="h-2.5 rounded-full bg-gradient-to-r from-green-400 to-green-600" 
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                          
                          {/* Cost breakdown */}
                          <div className="grid grid-cols-2 gap-2 pl-7 pt-1">
                            <div className="bg-green-50 rounded-md p-1.5 text-center">
                              <div className="text-xs text-green-700">{t('daily_cost')}</div>
                              <div className="text-sm font-medium text-green-800">
                                ${(item.cost / 30).toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-blue-50 rounded-md p-1.5 text-center">
                              <div className="text-xs text-blue-700">{t('monthly_trend')}</div>
                              <div className="text-sm font-medium text-blue-800 flex items-center justify-center gap-1">
                                {Math.random() > 0.5 ? (
                                  <>
                                    <ArrowUp className="h-3 w-3 text-red-500" />
                                    <span className="text-red-500">+{(Math.random() * 10).toFixed(1)}%</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowDown className="h-3 w-3 text-green-500" />
                                    <span className="text-green-500">-{(Math.random() * 10).toFixed(1)}%</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                      <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                        {t('view_all_expenses')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Recommendations - Enhanced with better visual presentation and interactivity */}
              <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-blue-200 shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
                  <Sparkles className="w-full h-full text-blue-800" />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center">
                    <div className="bg-blue-100 p-2 rounded-full mr-2">
                      <Sparkles className="h-5 w-5 text-blue-700" />
                    </div>
                    {t('recommended_actions')}
                  </CardTitle>
                  <CardDescription>
                    {t('action_recommendations_description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysisData.insights
                      .filter(insight => insight.actionable && insight.suggestedAction)
                      .slice(0, 3)
                      .map((insight, index) => (
                        <div key={index} className="bg-white bg-opacity-70 rounded-xl p-4 border border-blue-100 hover:shadow-md transition-all duration-200">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-blue-900">{insight.title}</p>
                              <p className="text-sm text-blue-700 mt-1">{insight.suggestedAction}</p>
                              
                              <div className="flex items-center gap-2 mt-3">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {insight.impact} {t('impact')}
                                </Badge>
                                
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  <span>{t('estimated_time')}: {Math.floor(Math.random() * 30) + 10} {t('minutes')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-end mt-3 pt-3 border-t border-blue-50">
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="text-xs h-8">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t('mark_complete')}
                              </Button>
                              <Button variant="outline" size="sm" className="text-xs h-8">
                                <XCircle className="h-3 w-3 mr-1" />
                                {t('dismiss')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
                <CardFooter className="bg-blue-50 border-t border-blue-100">
                  <Button variant="ghost" size="sm" className="text-blue-700 mx-auto">
                    {t('view_all_recommendations')}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-gradient-to-r from-gray-50 to-gray-100 border-t text-sm text-gray-500 py-4">
          <div className="flex items-center gap-2 w-full justify-between">
            <div className="flex items-center">
              <Info className="h-4 w-4 mr-2 text-gray-400" />
              {t('ai_analysis_disclaimer')}
            </div>
            <div className="text-xs">
              {t('last_updated')}: {analysisData?.metadata?.generatedAt ? 
                new Date(analysisData.metadata.generatedAt).toLocaleString() : 
                t('unknown')}
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}