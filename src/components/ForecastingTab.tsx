import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  AlertTriangle, 
  ChefHat, 
  Trash2, 
  DollarSign,
  TrendingUp,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle2,
  Search,
  Filter,
  Building2,
  UtensilsCrossed,
  BarChart4,
  PieChart,
  Clock,
  CalendarDays
} from 'lucide-react';

// Type definitions
interface KitchenConsumption {
  id: string;
  name: string;
  totalConsumed: number;
  totalWasted: number;
  wastePercentage: number;
  consumptionTrend: number; // positive for increase, negative for decrease
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

export function ForecastingTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [consumptionData, setConsumptionData] = useState<ConsumptionResponse | null>(null);
  const [selectedKitchen, setSelectedKitchen] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState(30); // days

  // Fetch consumption data
  const fetchConsumptionData = useCallback(async (retryCount = 0) => {
    setIsRefreshing(true);
    if (!isLoading) setIsLoading(true);
    
    try {
      // Use query parameters to customize the time range
      const response = await fetch(`/api/food-supply/kitchen-consumption?days=${timeRange}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch consumption data');
      }
      
      const data: ConsumptionResponse = await response.json();
      
      // Update state with the fetched data
      setConsumptionData(data);
      
      toast({
        title: t('consumption_data_updated'),
        description: t('consumption_data_refreshed'),
      });
    } catch (error) {
      console.error('Error fetching consumption data:', error);
      
      // Retry logic for transient errors
      if (retryCount < 2) {
        console.log(`Retrying consumption data fetch (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchConsumptionData(retryCount + 1), 1000);
        return;
      }
      
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_load_consumption_data'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast, t, timeRange]);

  // Initial data load and event listener setup
  useEffect(() => {
    fetchConsumptionData();
    
    // Set up an event listener for consumption updates with debouncing
    const handleConsumptionUpdate = (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      
      return () => {
        console.log('Received food-consumption-recorded event in ForecastingTab');
        
        // Clear any existing timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Set a new timeout to debounce multiple rapid events
        timeoutId = setTimeout(() => {
          console.log('Refreshing consumption data after consumption event (debounced)');
          fetchConsumptionData();
          timeoutId = null;
        }, 2000); // 2 second debounce
      };
    })();
    
    // Add the event listener
    window.addEventListener('food-consumption-recorded', handleConsumptionUpdate);
    
    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('food-consumption-recorded', handleConsumptionUpdate);
    };
  }, [fetchConsumptionData]);

  // Filter kitchens based on search
  const filteredKitchens = consumptionData?.kitchens.filter(kitchen => {
    return searchTerm ? 
      kitchen.name.toLowerCase().includes(searchTerm.toLowerCase()) : 
      true;
  }) || [];

  // Generate consumption report
  const handleGenerateReport = () => {
    if (!consumptionData) return;
    
    // Create a CSV string with the consumption report
    const headers = ['Kitchen', 'Total Consumed', 'Total Wasted', 'Waste %', 'Total Cost', 'Waste Cost', 'Savings Opportunity'];
    const rows = consumptionData.kitchens.map(kitchen => [
      kitchen.name,
      kitchen.totalConsumed,
      kitchen.totalWasted,
      `${kitchen.wastePercentage.toFixed(1)}%`,
      `QAR ${kitchen.costData.totalCost.toFixed(2)}`,
      `QAR ${kitchen.costData.wasteCost.toFixed(2)}`,
      `QAR ${kitchen.costData.savingsOpportunity.toFixed(2)}`
    ]);
    
    // Add a summary row
    rows.push([
      'TOTAL',
      consumptionData.summary.totalConsumed,
      consumptionData.summary.totalWasted,
      `${consumptionData.summary.overallWastePercentage.toFixed(1)}%`,
      `QAR ${consumptionData.summary.totalCost.toFixed(2)}`,
      `QAR ${consumptionData.summary.totalWasteCost.toFixed(2)}`,
      `QAR ${consumptionData.summary.potentialSavings.toFixed(2)}`
    ]);
    
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
    link.setAttribute('download', `kitchen_consumption_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t('report_generated'),
      description: t('consumption_report_generated_description'),
    });
  };

  // Get trend indicator component
  const getTrendIndicator = (value: number) => {
    if (value > 0) {
      return <div className="flex items-center text-red-600"><ArrowUp className="h-3 w-3 mr-1" />{Math.abs(value).toFixed(1)}%</div>;
    } else if (value < 0) {
      return <div className="flex items-center text-green-600"><ArrowDown className="h-3 w-3 mr-1" />{Math.abs(value).toFixed(1)}%</div>;
    }
    return <div className="text-gray-500">0%</div>;
  };

  // Get color class based on waste percentage
  const getWasteColorClass = (percentage: number) => {
    if (percentage > 15) return "text-red-600";
    if (percentage > 10) return "text-amber-600";
    if (percentage > 5) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl">{t('kitchen_consumption_analytics')}</CardTitle>
              <CardDescription>{t('track_consumption_and_waste_by_kitchen')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                onClick={() => fetchConsumptionData()}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('refresh_data')}
              </Button>
              <Button variant="outline" onClick={handleGenerateReport}>
                <Download className="h-4 w-4 mr-2" />
                {t('export_report')}
              </Button>
            </div>
          </div>
          
          {/* Time range selector */}
          {!isLoading && consumptionData && (
            <div className="mt-4 flex flex-col sm:flex-row gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('time_period')}:</span>
                <select 
                  className="bg-background border rounded px-2 py-1"
                  value={timeRange}
                  onChange={(e) => setTimeRange(Number(e.target.value))}
                >
                  <option value="7">7 {t('days')}</option>
                  <option value="14">14 {t('days')}</option>
                  <option value="30">30 {t('days')}</option>
                  <option value="60">60 {t('days')}</option>
                  <option value="90">90 {t('days')}</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                <span>{t('last_updated')}: {consumptionData.metadata?.generatedAt ? 
                  new Date(consumptionData.metadata.generatedAt).toLocaleString() : 
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
              <p className="text-muted-foreground">{t('loading_consumption_data')}</p>
            </div>
          ) : !consumptionData ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-muted-foreground">{t('no_consumption_data_available')}</p>
              <Button onClick={() => fetchConsumptionData()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('try_again')}
              </Button>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="overflow-hidden shadow-md border-0 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 opacity-80"></div>
                  <CardContent className="p-4 relative">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">{t('total_consumption')}</h3>
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center">
                        <UtensilsCrossed className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-300 flex items-baseline">
                      {consumptionData.summary.totalConsumed.toFixed(0)} units
                      <span className="ml-2 text-xs font-normal flex items-center">
                        {getTrendIndicator(consumptionData.summary.periodComparison.percentageChange)}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
                      {t('vs_previous_period')}
                    </p>
                    <div className="mt-2">
                      <Progress 
                        value={Math.min(100, Math.max(0, 50 + consumptionData.summary.periodComparison.percentageChange / 2))} 
                        className="h-1.5 bg-blue-200" 
                        indicatorClassName="bg-blue-600" 
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="overflow-hidden shadow-md border-0 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 opacity-80"></div>
                  <CardContent className="p-4 relative">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{t('total_waste')}</h3>
                      <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-800/40 flex items-center justify-center">
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-red-800 dark:text-red-300 flex items-baseline">
                      {consumptionData.summary.totalWasted.toFixed(0)} units
                      <span className="ml-2 text-xs font-normal flex items-center">
                        {getTrendIndicator(consumptionData.summary.periodComparison.wastePercentageChange)}
                      </span>
                    </div>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                      {t('vs_previous_period')}
                    </p>
                    <div className="mt-2">
                      <Progress 
                        value={Math.min(100, Math.max(0, 50 + consumptionData.summary.periodComparison.wastePercentageChange / 2))} 
                        className="h-1.5 bg-red-200" 
                        indicatorClassName="bg-red-600" 
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="overflow-hidden shadow-md border-0 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 opacity-80"></div>
                  <CardContent className="p-4 relative">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">{t('waste_percentage')}</h3>
                      <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
                        <PieChart className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-amber-800 dark:text-amber-300 flex items-baseline">
                      {consumptionData.summary.overallWastePercentage.toFixed(1)}%
                      <span className="ml-2 text-xs font-normal flex items-center">
                        {getTrendIndicator(
                          consumptionData.summary.periodComparison.wastePercentageChange - 
                          consumptionData.summary.periodComparison.percentageChange
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                      {t('of_total_consumption')}
                    </p>
                    <div className="mt-2">
                      <Progress 
                        value={Math.min(100, consumptionData.summary.overallWastePercentage * 3)} 
                        className="h-1.5 bg-amber-200" 
                        indicatorClassName={
                          consumptionData.summary.overallWastePercentage > 15 ? "bg-red-600" :
                          consumptionData.summary.overallWastePercentage > 10 ? "bg-amber-600" :
                          consumptionData.summary.overallWastePercentage > 5 ? "bg-yellow-600" :
                          "bg-green-600"
                        } 
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="overflow-hidden shadow-md border-0 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 opacity-80"></div>
                  <CardContent className="p-4 relative">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-300">{t('potential_savings')}</h3>
                      <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-800/40 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                      QAR {consumptionData.summary.potentialSavings.toFixed(0)}
                    </div>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                      {t('with_waste_reduction')}
                    </p>
                    <div className="mt-2">
                      <Progress 
                        value={75} 
                        className="h-1.5 bg-green-200" 
                        indicatorClassName="bg-green-600" 
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Tabs defaultValue="kitchens" className="space-y-4">
                <TabsList className="grid grid-cols-2 mb-4 p-1 bg-muted/30 rounded-xl">
                  <TabsTrigger value="kitchens" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Building2 className="h-4 w-4 mr-2" />
                    {t('kitchen_breakdown')}
                  </TabsTrigger>
                  <TabsTrigger value="trends" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <BarChart4 className="h-4 w-4 mr-2" />
                    {t('consumption_trends')}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="kitchens" className="space-y-4">
                  {/* Kitchen Search and Filter */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-lg flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-blue-600" />
                      {t('kitchen_consumption_data')}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder={t('search_kitchens')}
                          className="bg-background border rounded-full pl-8 pr-4 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Kitchen Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredKitchens.length === 0 ? (
                      <div className="col-span-2 text-center py-12 bg-gray-50 rounded-lg border">
                        <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-muted-foreground font-medium">{t('no_kitchens_found')}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('try_adjusting_your_search')}</p>
                      </div>
                    ) : (
                      filteredKitchens.map(kitchen => (
                        <Card 
                          key={kitchen.id} 
                          className={`border hover:border-blue-200 transition-colors shadow-sm ${
                            selectedKitchen === kitchen.id ? 'ring-2 ring-blue-500 border-blue-200' : ''
                          }`}
                          onClick={() => setSelectedKitchen(kitchen.id === selectedKitchen ? null : kitchen.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-lg flex items-center">
                                <Building2 className="h-4 w-4 mr-2 text-blue-600" />
                                {kitchen.name}
                              </CardTitle>
                              <Badge 
                                className={`${
                                  kitchen.wastePercentage > 15 ? "bg-red-100 text-red-800 hover:bg-red-200" :
                                  kitchen.wastePercentage > 10 ? "bg-amber-100 text-amber-800 hover:bg-amber-200" :
                                  kitchen.wastePercentage > 5 ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" :
                                  "bg-green-100 text-green-800 hover:bg-green-200"
                                } border-0`}
                              >
                                {t('waste')}: {kitchen.wastePercentage.toFixed(1)}%
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="bg-blue-50 rounded-lg p-3">
                                <div className="text-sm text-blue-600 mb-1">{t('consumption')}</div>
                                <div className="text-xl font-bold text-blue-800">{kitchen.totalConsumed.toFixed(0)} units</div>
                                <div className="text-xs text-blue-600 mt-1 flex items-center">
                                  {getTrendIndicator(kitchen.consumptionTrend)}
                                </div>
                              </div>
                              <div className="bg-red-50 rounded-lg p-3">
                                <div className="text-sm text-red-600 mb-1">{t('waste')}</div>
                                <div className="text-xl font-bold text-red-800">{kitchen.totalWasted.toFixed(0)} units</div>
                                <div className="text-xs text-red-600 mt-1">
                                  QAR {kitchen.costData.wasteCost.toFixed(0)} {t('lost')}
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">{t('waste_percentage')}</span>
                                <span className={`font-medium ${getWasteColorClass(kitchen.wastePercentage)}`}>
                                  {kitchen.wastePercentage.toFixed(1)}%
                                </span>
                              </div>
                              <Progress 
                                value={Math.min(100, kitchen.wastePercentage * 3)} 
                                className="h-2 bg-gray-100" 
                                indicatorClassName={
                                  kitchen.wastePercentage > 15 ? "bg-red-500" :
                                  kitchen.wastePercentage > 10 ? "bg-amber-500" :
                                  kitchen.wastePercentage > 5 ? "bg-yellow-500" :
                                  "bg-green-500"
                                } 
                              />
                              
                              <div className="flex justify-between items-center text-sm mt-4">
                                <span className="text-muted-foreground">{t('total_cost')}</span>
                                <span className="font-medium">QAR {kitchen.costData.totalCost.toFixed(0)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">{t('savings_opportunity')}</span>
                                <span className="font-medium text-green-600">QAR {kitchen.costData.savingsOpportunity.toFixed(0)}</span>
                              </div>
                            </div>
                            
                            {selectedKitchen === kitchen.id && (
                              <div className="mt-4 pt-4 border-t">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center">
                                      <ChefHat className="h-3 w-3 mr-1 text-blue-600" />
                                      {t('most_consumed')}
                                    </h4>
                                    <ul className="text-sm space-y-1">
                                      {kitchen.mostConsumedItems.map((item, idx) => (
                                        <li key={idx} className="flex justify-between">
                                          <span className="text-muted-foreground">{item.name}</span>
                                          <span className="font-medium">{item.quantity} {item.unit}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center">
                                      <Trash2 className="h-3 w-3 mr-1 text-red-600" />
                                      {t('most_wasted')}
                                    </h4>
                                    <ul className="text-sm space-y-1">
                                      {kitchen.mostWastedItems.map((item, idx) => (
                                        <li key={idx} className="flex justify-between">
                                          <span className="text-muted-foreground">{item.name}</span>
                                          <span className="font-medium">{item.quantity} {item.unit}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                                
                                <div className="mt-4 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                  <h4 className="text-sm font-medium flex items-center text-amber-800">
                                    <Info className="h-3 w-3 mr-1 text-amber-600" />
                                    {t('improvement_opportunity')}
                                  </h4>
                                  <p className="text-xs text-amber-700 mt-1">
                                    {kitchen.wastePercentage > 10 
                                      ? t('high_waste_recommendation') 
                                      : kitchen.wastePercentage > 5
                                      ? t('moderate_waste_recommendation')
                                      : t('low_waste_recommendation')}
                                  </p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                  
                  {/* Top Waste Reasons */}
                  <Card className="mt-6 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
                        {t('top_waste_reasons')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {consumptionData.summary.topWasteReasons.length === 0 ? (
                          <div className="text-center py-6 bg-gray-50 rounded-lg">
                            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                            <p className="text-muted-foreground">{t('no_waste_data_available')}</p>
                          </div>
                        ) : (
                          consumptionData.summary.topWasteReasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  idx === 0 ? 'bg-red-500' :
                                  idx === 1 ? 'bg-amber-500' :
                                  idx === 2 ? 'bg-yellow-500' :
                                  'bg-blue-500'
                                }`}></div>
                                <span className="font-medium">{t(reason.reason)}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={reason.percentage} 
                                    className="h-2 w-24 bg-gray-100" 
                                    indicatorClassName={
                                      idx === 0 ? 'bg-red-500' :
                                      idx === 1 ? 'bg-amber-500' :
                                      idx === 2 ? 'bg-yellow-500' :
                                      'bg-blue-500'
                                    } 
                                  />
                                  <span className="text-sm font-medium">{reason.percentage.toFixed(1)}%</span>
                                </div>
                                <span className="text-sm font-medium">QAR {reason.cost.toFixed(0)}</span>
                              </div>
                            </div>
                          ))
                        )}
                        
                        <div className="mt-4 bg-green-50 p-4 rounded-lg border border-green-100">
                          <h4 className="font-medium flex items-center text-green-800 mb-2">
                            <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                            {t('waste_reduction_strategy')}
                          </h4>
                          <p className="text-sm text-green-700">
                            {t('waste_reduction_recommendation')}
                          </p>
                          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                            <div className="bg-white p-2 rounded border border-green-100 text-center">
                              <span className="block font-medium text-green-800">{t('staff_training')}</span>
                              <span className="text-xs text-green-600">{t('high_impact')}</span>
                            </div>
                            <div className="bg-white p-2 rounded border border-green-100 text-center">
                              <span className="block font-medium text-green-800">{t('portion_control')}</span>
                              <span className="text-xs text-green-600">{t('medium_impact')}</span>
                            </div>
                            <div className="bg-white p-2 rounded border border-green-100 text-center">
                              <span className="block font-medium text-green-800">{t('inventory_management')}</span>
                              <span className="text-xs text-green-600">{t('high_impact')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="trends" className="space-y-4">
                  {/* Period Comparison */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-blue-600" />
                        {t('period_comparison')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium text-blue-800">{t('consumption_comparison')}</h4>
                            <div className="text-sm">
                              {getTrendIndicator(consumptionData.summary.periodComparison.percentageChange)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                              <div className="text-sm text-blue-600 mb-1">{t('current_period')}</div>
                              <div className="text-xl font-bold text-blue-800">
                                {consumptionData.summary.periodComparison.currentPeriodConsumption.toFixed(0)}
                              </div>
                              <div className="text-xs text-blue-600 mt-1">{t('units')}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                              <div className="text-sm text-gray-600 mb-1">{t('previous_period')}</div>
                              <div className="text-xl font-bold text-gray-800">
                                {consumptionData.summary.periodComparison.previousPeriodConsumption.toFixed(0)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">{t('units')}</div>
                            </div>
                          </div>
                          
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-sm mb-2">{t('consumption_trend')}</div>
                            <div className="h-24 bg-gray-50 rounded-lg flex items-end p-2">
                              <div className="flex-1 h-full flex items-end justify-around">
                                {[1, 2, 3, 4, 5, 6, 7].map((_, idx) => {
                                  // Generate a random height for the bar chart visualization
                                  const height = 30 + Math.random() * 60;
                                  return (
                                    <div 
                                      key={idx} 
                                      className="w-6 bg-blue-500 rounded-t"
                                      style={{ height: `${height}%` }}
                                    ></div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium text-red-800">{t('waste_comparison')}</h4>
                            <div className="text-sm">
                              {getTrendIndicator(consumptionData.summary.periodComparison.wastePercentageChange)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-red-50 rounded-lg p-3 text-center">
                              <div className="text-sm text-red-600 mb-1">{t('current_period')}</div>
                              <div className="text-xl font-bold text-red-800">
                                {consumptionData.summary.periodComparison.currentPeriodWaste.toFixed(0)}
                              </div>
                              <div className="text-xs text-red-600 mt-1">{t('units')}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                              <div className="text-sm text-gray-600 mb-1">{t('previous_period')}</div>
                              <div className="text-xl font-bold text-gray-800">
                                {consumptionData.summary.periodComparison.previousPeriodWaste.toFixed(0)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">{t('units')}</div>
                            </div>
                          </div>
                          
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-sm mb-2">{t('waste_trend')}</div>
                            <div className="h-24 bg-gray-50 rounded-lg flex items-end p-2">
                              <div className="flex-1 h-full flex items-end justify-around">
                                {[1, 2, 3, 4, 5, 6, 7].map((_, idx) => {
                                  // Generate a random height for the bar chart visualization
                                  const height = 20 + Math.random() * 40;
                                  return (
                                    <div 
                                      key={idx} 
                                      className="w-6 bg-red-500 rounded-t"
                                      style={{ height: `${height}%` }}
                                    ></div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-medium flex items-center text-blue-800 mb-2">
                          <Info className="h-4 w-4 mr-2 text-blue-600" />
                          {t('trend_analysis')}
                        </h4>
                        <p className="text-sm text-blue-700">
                          {consumptionData.summary.periodComparison.percentageChange > 0
                            ? t('increasing_consumption_analysis')
                            : consumptionData.summary.periodComparison.percentageChange < 0
                            ? t('decreasing_consumption_analysis')
                            : t('stable_consumption_analysis')}
                        </p>
                        <p className="text-sm text-blue-700 mt-2">
                          {consumptionData.summary.periodComparison.wastePercentageChange > 0
                            ? t('increasing_waste_analysis')
                            : consumptionData.summary.periodComparison.wastePercentageChange < 0
                            ? t('decreasing_waste_analysis')
                            : t('stable_waste_analysis')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Kitchen Comparison */}
                  <Card className="shadow-sm mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center">
                        <Building2 className="h-4 w-4 mr-2 text-purple-600" />
                        {t('kitchen_comparison')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-3">
                            {filteredKitchens.map(kitchen => (
                              <div key={kitchen.id} className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                                <div className="w-1/4">
                                  <span className="font-medium">{kitchen.name}</span>
                                </div>
                                <div className="w-3/4 flex items-center gap-4">
                                  <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span>{t('consumption')}</span>
                                      <span>{kitchen.totalConsumed.toFixed(0)} {t('units')}</span>
                                    </div>
                                    <Progress 
                                      value={Math.min(100, (kitchen.totalConsumed / (consumptionData.summary.totalConsumed * 0.3)) * 100)} 
                                      className="h-2 bg-gray-100" 
                                      indicatorClassName="bg-blue-500" 
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span>{t('waste')}</span>
                                      <span className={getWasteColorClass(kitchen.wastePercentage)}>
                                        {kitchen.wastePercentage.toFixed(1)}%
                                      </span>
                                    </div>
                                    <Progress 
                                      value={Math.min(100, kitchen.wastePercentage * 3)} 
                                      className="h-2 bg-gray-100" 
                                      indicatorClassName={
                                        kitchen.wastePercentage > 15 ? "bg-red-500" :
                                        kitchen.wastePercentage > 10 ? "bg-amber-500" :
                                        kitchen.wastePercentage > 5 ? "bg-yellow-500" :
                                        "bg-green-500"
                                      } 
                                    />
                                  </div>
                                  <div className="w-24 text-right">
                                    <Badge variant="outline" className={`
                                      ${kitchen.wastePercentage > 15 ? "bg-red-50 text-red-700 border-red-200" :
                                        kitchen.wastePercentage > 10 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        kitchen.wastePercentage > 5 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                        "bg-green-50 text-green-700 border-green-200"
                                      }
                                    `}>
                                      {kitchen.wastePercentage > 15 ? t('critical') :
                                       kitchen.wastePercentage > 10 ? t('high') :
                                       kitchen.wastePercentage > 5 ? t('moderate') :
                                       t('good')}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h4 className="font-medium flex items-center text-green-800 mb-2">
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                              {t('best_performing_kitchen')}
                            </h4>
                            {filteredKitchens.length > 0 && (
                              <>
                                <p className="text-lg font-bold text-green-700">
                                  {filteredKitchens.sort((a, b) => a.wastePercentage - b.wastePercentage)[0].name}
                                </p>
                                <p className="text-sm text-green-600 mt-1">
                                  {t('waste')}: {filteredKitchens.sort((a, b) => a.wastePercentage - b.wastePercentage)[0].wastePercentage.toFixed(1)}%
                                </p>
                                <p className="text-xs text-green-700 mt-2">
                                  {t('best_practices_to_share')}
                                </p>
                              </>
                            )}
                          </div>
                          
                          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <h4 className="font-medium flex items-center text-red-800 mb-2">
                              <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                              {t('needs_improvement')}
                            </h4>
                            {filteredKitchens.length > 0 && (
                              <>
                                <p className="text-lg font-bold text-red-700">
                                  {filteredKitchens.sort((a, b) => b.wastePercentage - a.wastePercentage)[0].name}
                                </p>
                                <p className="text-sm text-red-600 mt-1">
                                  {t('waste')}: {filteredKitchens.sort((a, b) => b.wastePercentage - a.wastePercentage)[0].wastePercentage.toFixed(1)}%
                                </p>
                                <p className="text-xs text-red-700 mt-2">
                                  {t('recommended_training_and_review')}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}