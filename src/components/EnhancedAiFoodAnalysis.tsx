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
  TrendingDown,
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
  ChefHat,
  Info,
  DollarSign,
  Wallet,
  Trash2,
  Search,
  PieChart,
  BarChart,
  CheckCircle2,
  XCircle,
  Filter,
  ShoppingCart,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  Package,
  ArrowRight
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// Type definitions
interface FoodSupplyItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  category: string;
  pricePerUnit: number;
  forecastedDemand: number;
  suggestedOrder: number;
  daysUntilDepletion: number;
  dailyConsumptionRate: number;
  wastePercentage: number;
}

interface KitchenData {
  id: string;
  name: string;
  totalConsumption: number;
  totalWaste: number;
  wastePercentage: number;
  costEfficiency: number;
  topItems: {
    name: string;
    consumption: number;
    unit: string;
  }[];
}

interface WasteReduction {
  kitchenId: string;
  kitchenName: string;
  currentWastePercentage: number;
  targetWastePercentage: number;
  potentialSavings: number;
  recommendations: string[];
  topWastedItems: {
    name: string;
    quantity: number;
    unit: string;
    value: number;
    reason: string;
  }[];
}

interface ProfitOptimization {
  kitchenId: string;
  kitchenName: string;
  currentProfitMargin: number;
  targetProfitMargin: number;
  potentialIncrease: number;
  recommendations: string[];
  highProfitItems: {
    name: string;
    profitMargin: number;
    salesVolume: number;
    recommendation: string;
  }[];
}

interface InventoryReloadingForecast {
  kitchenId: string;
  kitchenName: string;
  itemsToReload: FoodSupplyItem[];
  totalCost: number;
  urgentItems: FoodSupplyItem[];
  optimalOrderDate: string;
}

interface AiInsight {
  type: 'optimization' | 'warning' | 'information';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedAction?: string;
  kitchenId?: string;
  kitchenName?: string;
}

interface EnhancedAiAnalysisResponse {
  kitchens: KitchenData[];
  wasteReduction: WasteReduction[];
  profitOptimization: ProfitOptimization[];
  inventoryForecasts: InventoryReloadingForecast[];
  insights: AiInsight[];
  aggregatedStats: {
    totalConsumption: number;
    totalWaste: number;
    averageWastePercentage: number;
    totalPotentialSavings: number;
    totalReloadingCost: number;
    totalItemsToReload: number;
  };
  metadata: {
    analyzedPeriod: string;
    predictionPeriod: string;
    confidenceScore: number;
    generatedAt: string;
  };
}

export function EnhancedAiFoodAnalysis() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analysisData, setAnalysisData] = useState<EnhancedAiAnalysisResponse | null>(null);
  const [historyDays, setHistoryDays] = useState(30);
  const [forecastDays, setForecastDays] = useState(14);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  // State for kitchen selection
  const [kitchens, setKitchens] = useState<{id: string, name: string}[]>([]);
  const [selectedKitchenId, setSelectedKitchenId] = useState<string>('all');

  // Fetch kitchens
  useEffect(() => {
    const fetchKitchens = async () => {
      try {
        const response = await fetch('/api/kitchens');
        if (response.ok) {
          const data = await response.json();
          setKitchens(data);
          
          // If we have kitchens, set a default kitchen ID if none is selected
          if (data.length > 0 && selectedKitchenId === 'all') {
            // Keep 'all' as the selection but we'll use the first kitchen ID in the API call
            // This ensures we have a valid kitchen ID for the API
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
    
    try {
      // Make sure we have a valid kitchen ID
      if (kitchens.length === 0) {
        throw new Error('No kitchens available. Please add kitchens first.');
      }
      
      // Always use a valid kitchen ID, even when "all kitchens" is selected
      const kitchenIdToUse = selectedKitchenId === 'all' ? kitchens[0].id : selectedKitchenId;
      
      // Fetch data from the API with kitchen ID
      const endpoint = `/api/food-supply/ai-analysis?historyDays=${historyDays}&forecastDays=${forecastDays}&kitchenId=${kitchenIdToUse}${selectedKitchenId === 'all' ? '&allKitchens=true' : ''}`;
      
      const response = await fetch(endpoint, {
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
      
      // For demo purposes, we'll simulate the enhanced data structure
      // In a real implementation, the API would return the actual data
      const enhancedData: EnhancedAiAnalysisResponse = simulateEnhancedAnalysisData(data, kitchens);
      
      // Update state with the fetched data
      setAnalysisData(enhancedData);
      
      toast({
        title: t('ai_analysis_updated'),
        description: t('ai_analysis_data_refreshed'),
      });
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

  // Initial data load - only fetch analysis data after kitchens are loaded
  useEffect(() => {
    if (kitchens.length > 0) {
      fetchAnalysisData();
    }
  }, [kitchens]);

  // Simulate enhanced analysis data for demo purposes
  const simulateEnhancedAnalysisData = (baseData: any, kitchens: {id: string, name: string}[]): EnhancedAiAnalysisResponse => {
    // Create kitchen data
    const kitchenData: KitchenData[] = kitchens.map(kitchen => ({
      id: kitchen.id,
      name: kitchen.name,
      totalConsumption: Math.round(Math.random() * 1000) + 500,
      totalWaste: Math.round(Math.random() * 200) + 50,
      wastePercentage: Math.round((Math.random() * 15) + 5),
      costEfficiency: Math.round((Math.random() * 30) + 60),
      topItems: [
        { name: 'Chicken Breast', consumption: Math.round(Math.random() * 50) + 20, unit: 'kg' },
        { name: 'Rice', consumption: Math.round(Math.random() * 40) + 15, unit: 'kg' },
        { name: 'Tomatoes', consumption: Math.round(Math.random() * 30) + 10, unit: 'kg' }
      ]
    }));

    // Create waste reduction data
    const wasteReduction: WasteReduction[] = kitchens.map(kitchen => ({
      kitchenId: kitchen.id,
      kitchenName: kitchen.name,
      currentWastePercentage: Math.round((Math.random() * 15) + 5),
      targetWastePercentage: Math.round((Math.random() * 5) + 2),
      potentialSavings: Math.round((Math.random() * 1000) + 200),
      recommendations: [
        'Implement a first-in, first-out (FIFO) inventory system',
        'Train staff on proper portioning techniques',
        'Conduct weekly inventory audits to identify slow-moving items',
        'Repurpose excess ingredients in daily specials'
      ],
      topWastedItems: [
        { 
          name: 'Fresh Vegetables', 
          quantity: Math.round(Math.random() * 20) + 5, 
          unit: 'kg', 
          value: Math.round(Math.random() * 200) + 50,
          reason: 'Expired'
        },
        { 
          name: 'Dairy Products', 
          quantity: Math.round(Math.random() * 15) + 3, 
          unit: 'kg', 
          value: Math.round(Math.random() * 150) + 40,
          reason: 'Spoiled'
        },
        { 
          name: 'Prepared Meals', 
          quantity: Math.round(Math.random() * 10) + 2, 
          unit: 'portions', 
          value: Math.round(Math.random() * 100) + 30,
          reason: 'Overproduction'
        }
      ]
    }));

    // Create profit optimization data
    const profitOptimization: ProfitOptimization[] = kitchens.map(kitchen => ({
      kitchenId: kitchen.id,
      kitchenName: kitchen.name,
      currentProfitMargin: Math.round((Math.random() * 15) + 20),
      targetProfitMargin: Math.round((Math.random() * 10) + 30),
      potentialIncrease: Math.round((Math.random() * 1500) + 500),
      recommendations: [
        'Adjust menu pricing based on ingredient costs',
        'Promote high-margin items through staff recommendations',
        'Optimize portion sizes to reduce costs without affecting quality',
        'Negotiate better prices with suppliers for frequently used items'
      ],
      highProfitItems: [
        { 
          name: 'Specialty Pasta Dishes', 
          profitMargin: Math.round((Math.random() * 20) + 40), 
          salesVolume: Math.round(Math.random() * 50) + 20,
          recommendation: 'Feature prominently on menu'
        },
        { 
          name: 'Premium Desserts', 
          profitMargin: Math.round((Math.random() * 25) + 45), 
          salesVolume: Math.round(Math.random() * 30) + 15,
          recommendation: 'Offer as part of meal deals'
        },
        { 
          name: 'Signature Beverages', 
          profitMargin: Math.round((Math.random() * 30) + 50), 
          salesVolume: Math.round(Math.random() * 40) + 25,
          recommendation: 'Promote during peak hours'
        }
      ]
    }));

    // Create inventory reloading forecasts
    const inventoryForecasts: InventoryReloadingForecast[] = kitchens.map(kitchen => {
      const itemsToReload: FoodSupplyItem[] = [
        {
          id: '1',
          name: 'Chicken Breast',
          currentStock: Math.round(Math.random() * 5) + 2,
          unit: 'kg',
          category: 'meat',
          pricePerUnit: Math.round((Math.random() * 5) + 10),
          forecastedDemand: Math.round(Math.random() * 15) + 10,
          suggestedOrder: Math.round(Math.random() * 10) + 8,
          daysUntilDepletion: Math.round(Math.random() * 3) + 1,
          dailyConsumptionRate: Math.round((Math.random() * 2) + 1),
          wastePercentage: Math.round((Math.random() * 5) + 2)
        },
        {
          id: '2',
          name: 'Rice',
          currentStock: Math.round(Math.random() * 10) + 5,
          unit: 'kg',
          category: 'grains',
          pricePerUnit: Math.round((Math.random() * 2) + 3),
          forecastedDemand: Math.round(Math.random() * 20) + 15,
          suggestedOrder: Math.round(Math.random() * 15) + 10,
          daysUntilDepletion: Math.round(Math.random() * 4) + 2,
          dailyConsumptionRate: Math.round((Math.random() * 3) + 2),
          wastePercentage: Math.round((Math.random() * 3) + 1)
        },
        {
          id: '3',
          name: 'Fresh Vegetables',
          currentStock: Math.round(Math.random() * 3) + 1,
          unit: 'kg',
          category: 'vegetables',
          pricePerUnit: Math.round((Math.random() * 3) + 5),
          forecastedDemand: Math.round(Math.random() * 12) + 8,
          suggestedOrder: Math.round(Math.random() * 10) + 7,
          daysUntilDepletion: Math.round(Math.random() * 2) + 1,
          dailyConsumptionRate: Math.round((Math.random() * 2) + 2),
          wastePercentage: Math.round((Math.random() * 8) + 5)
        },
        {
          id: '4',
          name: 'Dairy Products',
          currentStock: Math.round(Math.random() * 4) + 2,
          unit: 'kg',
          category: 'dairy',
          pricePerUnit: Math.round((Math.random() * 4) + 6),
          forecastedDemand: Math.round(Math.random() * 10) + 6,
          suggestedOrder: Math.round(Math.random() * 8) + 4,
          daysUntilDepletion: Math.round(Math.random() * 3) + 1,
          dailyConsumptionRate: Math.round((Math.random() * 1.5) + 1),
          wastePercentage: Math.round((Math.random() * 7) + 4)
        },
        {
          id: '5',
          name: 'Cooking Oil',
          currentStock: Math.round(Math.random() * 2) + 1,
          unit: 'L',
          category: 'other',
          pricePerUnit: Math.round((Math.random() * 3) + 8),
          forecastedDemand: Math.round(Math.random() * 5) + 3,
          suggestedOrder: Math.round(Math.random() * 4) + 2,
          daysUntilDepletion: Math.round(Math.random() * 4) + 2,
          dailyConsumptionRate: Math.round((Math.random() * 0.5) + 0.5),
          wastePercentage: Math.round((Math.random() * 2) + 1)
        }
      ];

      const urgentItems = itemsToReload.filter(item => item.daysUntilDepletion <= 2);
      const totalCost = itemsToReload.reduce((sum, item) => sum + (item.suggestedOrder * item.pricePerUnit), 0);

      // Generate a date 2-5 days in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 3) + 2);

      return {
        kitchenId: kitchen.id,
        kitchenName: kitchen.name,
        itemsToReload,
        totalCost,
        urgentItems,
        optimalOrderDate: futureDate.toISOString().split('T')[0]
      };
    });

    // Create insights
    const insights: AiInsight[] = [
      {
        type: 'optimization',
        title: 'Reduce Vegetable Waste',
        description: 'Fresh vegetables have the highest waste percentage across all kitchens. Implementing better storage practices could reduce waste by up to 40%.',
        impact: 'high',
        actionable: true,
        suggestedAction: 'Train staff on proper vegetable storage techniques and implement a first-in, first-out system.'
      },
      {
        type: 'warning',
        title: 'Critical Chicken Inventory',
        description: 'Multiple kitchens will run out of chicken within 2 days, affecting 8 popular menu items.',
        impact: 'high',
        actionable: true,
        suggestedAction: 'Place an urgent order for chicken and consider temporary menu adjustments.'
      },
      {
        type: 'information',
        title: 'Seasonal Price Changes',
        description: 'Tomato prices are expected to increase by 15% next month due to seasonal changes. Consider adjusting menu or finding alternative suppliers.',
        impact: 'medium',
        actionable: true,
        suggestedAction: 'Explore alternative suppliers or adjust menu to reduce tomato usage during the price increase period.'
      },
      {
        type: 'optimization',
        title: 'Bulk Purchase Opportunity',
        description: 'Purchasing rice in bulk could save 12% on costs across all kitchens, with minimal impact on storage requirements.',
        impact: 'medium',
        actionable: true,
        suggestedAction: 'Negotiate bulk pricing with current supplier or explore new suppliers for rice.'
      },
      {
        type: 'warning',
        title: 'High Dairy Waste in Kitchen 2',
        description: `${kitchens[1]?.name || 'Kitchen 2'} has 3x higher dairy waste than other kitchens. Refrigeration issues may be the cause.`,
        impact: 'high',
        actionable: true,
        suggestedAction: 'Check refrigeration equipment in Kitchen 2 and adjust ordering quantities until resolved.',
        kitchenId: kitchens[1]?.id,
        kitchenName: kitchens[1]?.name
      }
    ];

    // Calculate aggregated stats
    const totalConsumption = kitchenData.reduce((sum, kitchen) => sum + kitchen.totalConsumption, 0);
    const totalWaste = kitchenData.reduce((sum, kitchen) => sum + kitchen.totalWaste, 0);
    const averageWastePercentage = kitchenData.reduce((sum, kitchen) => sum + kitchen.wastePercentage, 0) / kitchenData.length;
    const totalPotentialSavings = wasteReduction.reduce((sum, wr) => sum + wr.potentialSavings, 0);
    const totalReloadingCost = inventoryForecasts.reduce((sum, forecast) => sum + forecast.totalCost, 0);
    const totalItemsToReload = inventoryForecasts.reduce((sum, forecast) => sum + forecast.itemsToReload.length, 0);

    return {
      kitchens: kitchenData,
      wasteReduction,
      profitOptimization,
      inventoryForecasts,
      insights,
      aggregatedStats: {
        totalConsumption,
        totalWaste,
        averageWastePercentage,
        totalPotentialSavings,
        totalReloadingCost,
        totalItemsToReload
      },
      metadata: {
        analyzedPeriod: `${historyDays} days`,
        predictionPeriod: `${forecastDays} days`,
        confidenceScore: 85,
        generatedAt: new Date().toISOString()
      }
    };
  };

  // Filter items based on search
  const getFilteredItems = (items: FoodSupplyItem[]) => {
    return items.filter(item => 
      searchTerm ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
    );
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

  // Generate comprehensive report
  const handleGenerateReport = () => {
    if (!analysisData) return;
    
    toast({
      title: t('report_generated'),
      description: t('comprehensive_report_generated_description'),
    });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                {t('enhanced_ai_food_analysis')}
              </CardTitle>
              <CardDescription>{t('comprehensive_ai_analysis_for_all_kitchens')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Kitchen selector */}
              <Select
                value={selectedKitchenId}
                onValueChange={setSelectedKitchenId}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('select_kitchen')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_kitchens')}</SelectItem>
                  {kitchens.map(kitchen => (
                    <SelectItem key={kitchen.id} value={kitchen.id}>{kitchen.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                onClick={() => fetchAnalysisData()}
                disabled={isRefreshing}
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
              {/* AI Confidence Score */}
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
                          stroke-width="10"
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

              {/* Key Metrics Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Package className="h-4 w-4 mr-2 text-blue-600" />
                      {t('total_consumption')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">
                      {analysisData.aggregatedStats.totalConsumption.toLocaleString()} {t('units')}
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {t('across_all_kitchens')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                      {t('waste_percentage')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-700">
                      {analysisData.aggregatedStats.averageWastePercentage.toFixed(1)}%
                    </div>
                    <p className="text-sm text-red-600 mt-1">
                      {t('average_across_kitchens')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                      {t('potential_savings')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                      ${analysisData.aggregatedStats.totalPotentialSavings.toLocaleString()}
                    </div>
                    <p className="text-sm text-green-600 mt-1">
                      {t('through_waste_reduction')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <ShoppingCart className="h-4 w-4 mr-2 text-amber-600" />
                      {t('reloading_forecast')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-700">
                      ${analysisData.aggregatedStats.totalReloadingCost.toLocaleString()}
                    </div>
                    <p className="text-sm text-amber-600 mt-1">
                      {analysisData.aggregatedStats.totalItemsToReload} {t('items_to_reload')}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Tabs */}
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
                <TabsList className="grid grid-cols-4 md:w-[600px]">
                  <TabsTrigger value="overview" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('overview')}
                  </TabsTrigger>
                  <TabsTrigger value="waste" className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t('waste_reduction')}
                  </TabsTrigger>
                  <TabsTrigger value="profit" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {t('profit_optimization')}
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {t('inventory_forecast')}
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                  {/* Top Insights */}
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
                              
                              {insight.kitchenName && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                  {insight.kitchenName}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kitchen Performance Comparison */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="h-5 w-5 text-gray-600" />
                        {t('kitchen_performance_comparison')}
                      </CardTitle>
                      <CardDescription>
                        {t('compare_consumption_and_waste_across_kitchens')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {analysisData.kitchens.map((kitchen, index) => (
                          <div key={kitchen.id} className="border rounded-lg p-4 space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-medium text-lg">{kitchen.name}</h3>
                              <Badge className={kitchen.wastePercentage > 10 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                                {kitchen.wastePercentage}% {t('waste')}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-blue-50 rounded-lg p-3 text-center">
                                <p className="text-sm text-blue-600 mb-1">{t('total_consumption')}</p>
                                <p className="text-xl font-bold text-blue-800">{kitchen.totalConsumption} {t('units')}</p>
                              </div>
                              
                              <div className="bg-red-50 rounded-lg p-3 text-center">
                                <p className="text-sm text-red-600 mb-1">{t('total_waste')}</p>
                                <p className="text-xl font-bold text-red-800">{kitchen.totalWaste} {t('units')}</p>
                              </div>
                              
                              <div className="bg-green-50 rounded-lg p-3 text-center">
                                <p className="text-sm text-green-600 mb-1">{t('cost_efficiency')}</p>
                                <p className="text-xl font-bold text-green-800">{kitchen.costEfficiency}%</p>
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium mb-2">{t('top_consumed_items')}:</p>
                              <div className="flex flex-wrap gap-2">
                                {kitchen.topItems.map((item, idx) => (
                                  <Badge key={idx} variant="outline" className="bg-gray-50">
                                    {item.name}: {item.consumption} {item.unit}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Waste Reduction Tab */}
                <TabsContent value="waste" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-red-600" />
                        {t('waste_reduction_opportunities')}
                      </CardTitle>
                      <CardDescription>
                        {t('strategies_to_reduce_waste_and_save_costs')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {analysisData.wasteReduction.map((wr, index) => (
                          <div key={wr.kitchenId} className="border rounded-lg p-4 space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-medium text-lg">{wr.kitchenName}</h3>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-red-100 text-red-800">
                                  {t('current')}: {wr.currentWastePercentage}%
                                </Badge>
                                <ArrowRight className="h-4 w-4 text-gray-400" />
                                <Badge className="bg-green-100 text-green-800">
                                  {t('target')}: {wr.targetWastePercentage}%
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="bg-green-50 rounded-lg p-4 flex justify-between items-center">
                              <div>
                                <p className="text-sm text-green-600 mb-1">{t('potential_savings')}</p>
                                <p className="text-xl font-bold text-green-800">${wr.potentialSavings}</p>
                              </div>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                {t('implement_strategy')}
                              </Button>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium mb-2">{t('top_wasted_items')}:</p>
                              <div className="space-y-2">
                                {wr.topWastedItems.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                                    <div>
                                      <span className="font-medium">{item.name}</span>
                                      <div className="text-sm text-gray-500">
                                        {item.quantity} {item.unit} ({t('reason')}: {item.reason})
                                      </div>
                                    </div>
                                    <div className="text-red-600 font-medium">
                                      ${item.value}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium mb-2">{t('recommendations')}:</p>
                              <ul className="space-y-1 list-disc pl-5">
                                {wr.recommendations.map((rec, idx) => (
                                  <li key={idx} className="text-sm">{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Profit Optimization Tab */}
                <TabsContent value="profit" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        {t('profit_optimization_strategies')}
                      </CardTitle>
                      <CardDescription>
                        {t('strategies_to_increase_profit_margins')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {analysisData.profitOptimization.map((po, index) => (
                          <div key={po.kitchenId} className="border rounded-lg p-4 space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-medium text-lg">{po.kitchenName}</h3>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-amber-100 text-amber-800">
                                  {t('current')}: {po.currentProfitMargin}%
                                </Badge>
                                <ArrowRight className="h-4 w-4 text-gray-400" />
                                <Badge className="bg-green-100 text-green-800">
                                  {t('target')}: {po.targetProfitMargin}%
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="bg-green-50 rounded-lg p-4 flex justify-between items-center">
                              <div>
                                <p className="text-sm text-green-600 mb-1">{t('potential_profit_increase')}</p>
                                <p className="text-xl font-bold text-green-800">${po.potentialIncrease}</p>
                              </div>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                {t('implement_strategy')}
                              </Button>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium mb-2">{t('high_profit_items')}:</p>
                              <div className="space-y-2">
                                {po.highProfitItems.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                                    <div>
                                      <span className="font-medium">{item.name}</span>
                                      <div className="text-sm text-gray-500">
                                        {t('sales_volume')}: {item.salesVolume} {t('units')}
                                      </div>
                                    </div>
                                    <div className="text-green-600 font-medium flex items-center gap-1">
                                      <Percent className="h-3 w-3" />
                                      {item.profitMargin}%
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium mb-2">{t('recommendations')}:</p>
                              <ul className="space-y-1 list-disc pl-5">
                                {po.recommendations.map((rec, idx) => (
                                  <li key={idx} className="text-sm">{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Inventory Forecast Tab */}
                <TabsContent value="inventory" className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={t('search_items')}
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-amber-600" />
                        {t('inventory_reloading_forecast')}
                      </CardTitle>
                      <CardDescription>
                        {t('forecast_of_items_that_need_reloading_soon')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {analysisData.inventoryForecasts.map((forecast, index) => {
                          const filteredItems = getFilteredItems(forecast.itemsToReload);
                          
                          if (filteredItems.length === 0 && searchTerm) {
                            return null;
                          }
                          
                          return (
                            <div key={forecast.kitchenId} className="border rounded-lg p-4 space-y-4">
                              <div className="flex justify-between items-center">
                                <h3 className="font-medium text-lg">{forecast.kitchenName}</h3>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-amber-100 text-amber-800">
                                    {t('total_cost')}: ${forecast.totalCost.toFixed(2)}
                                  </Badge>
                                  <Badge className="bg-blue-100 text-blue-800">
                                    {t('optimal_order_date')}: {new Date(forecast.optimalOrderDate).toLocaleDateString()}
                                  </Badge>
                                </div>
                              </div>
                              
                              {forecast.urgentItems.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <p className="text-sm font-medium text-red-800 mb-2">
                                    {t('urgent_items')} ({forecast.urgentItems.length})
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {forecast.urgentItems.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-md border border-red-100">
                                        <div>
                                          <span className="font-medium">{item.name}</span>
                                          <div className="text-sm text-gray-500">
                                            {t('current_stock')}: {item.currentStock} {item.unit}
                                          </div>
                                        </div>
                                        <div className="text-red-600 font-medium flex flex-col items-end">
                                          <span>{t('depletes_in')}: {item.daysUntilDepletion} {t('days')}</span>
                                          <span className="text-sm">{t('order')}: {item.suggestedOrder} {item.unit}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div>
                                <p className="text-sm font-medium mb-2">{t('items_to_reload')}:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {filteredItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{item.name}</span>
                                          <Badge variant="outline" className={getCategoryColorClass(item.category)}>
                                            {item.category}
                                          </Badge>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                          <div className="flex items-center gap-4">
                                            <span>{t('current')}: {item.currentStock} {item.unit}</span>
                                            <span>{t('daily_use')}: {item.dailyConsumptionRate.toFixed(1)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium">
                                          {t('order')}: {item.suggestedOrder} {item.unit}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          ${(item.suggestedOrder * item.pricePerUnit).toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex justify-end pt-2">
                                <Button className="bg-amber-600 hover:bg-amber-700">
                                  {t('generate_order')}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Action Recommendations */}
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
                                
                                {insight.kitchenName && (
                                  <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                    {insight.kitchenName}
                                  </Badge>
                                )}
                                
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