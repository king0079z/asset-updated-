import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Calendar, TrendingUp, DollarSign, LineChart, AlertTriangle, Info, Printer, Brain, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ChartJSBar } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PrintConsumptionReportButton } from "./PrintConsumptionReportButton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";
import { useTheme } from "@/contexts/ThemeContext";

type ConsumptionAnalysisProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type MonthlyConsumption = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
};

type ForecastData = {
  month: string;
  year: number;
  predictedAmount: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
};

type CategoryForecast = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
  confidence: number;
};

export function ConsumptionAnalysisDialog({ open, onOpenChange }: ConsumptionAnalysisProps) {
  const { t, language, dir } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlyConsumption[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [categoryForecasts, setCategoryForecasts] = useState<CategoryForecast[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Media queries for responsive design
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  useEffect(() => {
    if (open) {
      loadConsumptionData();
    }
  }, [open]);

  const loadConsumptionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch monthly consumption data
      const response = await fetch('/api/dashboard/total-spent?includeMonthly=true');
      if (!response.ok) throw new Error('Failed to load consumption data');
      const data = await response.json();
      
      setMonthlyData(data.monthlyData || []);
      
      // Fetch ML forecast data
      const mlResponse = await fetch('/api/ai-analysis/ml-predictions');
      if (!mlResponse.ok) throw new Error('Failed to load forecast data');
      const mlData = await mlResponse.json();
      
      // Transform budget predictions into forecast data
      const forecasts = transformBudgetPredictions(mlData.mlAnalysis.budgetPredictions, data.monthlyData);
      setForecastData(forecasts);
      
      // Generate category-specific forecasts
      const categoryForecasts = generateCategoryForecasts(forecasts, data.monthlyData);
      setCategoryForecasts(categoryForecasts);
    } catch (error) {
      console.error('Error loading consumption analysis data:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Transform budget predictions into monthly forecast data
  const transformBudgetPredictions = (budgetPredictions: any[], historicalData: MonthlyConsumption[]) => {
    if (!budgetPredictions || !historicalData || historicalData.length === 0) {
      return [];
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Get the next 6 months forecast
    const forecasts: ForecastData[] = [];
    
    for (let i = 1; i <= 6; i++) {
      const forecastDate = new Date(currentYear, currentMonth + i, 1);
      const monthName = forecastDate.toLocaleString('default', { month: 'long' });
      const forecastYear = forecastDate.getFullYear();
      
      // Find the closest prediction (1, 3, or 6 months)
      const closestPrediction = budgetPredictions.reduce((prev, curr) => {
        return Math.abs(curr.months - i) < Math.abs(prev.months - i) ? curr : prev;
      }, budgetPredictions[0]);
      
      // Adjust prediction based on how far we are from the prediction point
      const adjustmentFactor = 1 - (Math.abs(closestPrediction.months - i) * 0.05);
      
      // Create the forecast data with the base prediction
      const forecastData: any = {
        month: monthName,
        year: forecastYear,
        predictedAmount: closestPrediction.prediction.predictedAmount * adjustmentFactor,
        upperBound: closestPrediction.prediction.upperBound * adjustmentFactor,
        lowerBound: closestPrediction.prediction.lowerBound * adjustmentFactor,
        confidence: closestPrediction.prediction.confidence
      };
      
      // If we have category-specific predictions, include them
      if (closestPrediction.categoryPredictions) {
        forecastData.categoryPredictions = {
          food: {
            ...closestPrediction.categoryPredictions.food,
            predictedAmount: closestPrediction.categoryPredictions.food.predictedAmount * adjustmentFactor,
            upperBound: closestPrediction.categoryPredictions.food.upperBound * adjustmentFactor,
            lowerBound: closestPrediction.categoryPredictions.food.lowerBound * adjustmentFactor
          },
          vehicleRental: {
            ...closestPrediction.categoryPredictions.vehicleRental,
            // Vehicle rental costs are typically fixed, so we don't apply the adjustment factor
            // This ensures the forecast reflects the fixed nature of these costs
            predictedAmount: closestPrediction.categoryPredictions.vehicleRental.predictedAmount,
            upperBound: closestPrediction.categoryPredictions.vehicleRental.upperBound,
            lowerBound: closestPrediction.categoryPredictions.vehicleRental.lowerBound
          }
        };
      }
      
      forecasts.push(forecastData);
    }
    
    return forecasts;
  };

  // Generate category-specific forecasts based on ML predictions with specialized vehicle rental forecasting
  const generateCategoryForecasts = (forecasts: ForecastData[], historicalData: MonthlyConsumption[]): CategoryForecast[] => {
    if (!forecasts || forecasts.length === 0 || !historicalData || historicalData.length === 0) {
      return [];
    }
    
    return forecasts.map((forecast, index) => {
      // Check if we have category-specific predictions from the ML model
      const mlData = forecast as any;
      
      if (mlData.categoryPredictions) {
        // Use the specialized category predictions from the ML model
        return {
          month: forecast.month,
          year: forecast.year,
          // Use the specialized vehicle rental prediction
          vehicleRentalCosts: mlData.categoryPredictions.vehicleRental.predictedAmount,
          // For food and assets, use the food prediction and historical proportions for assets
          foodConsumption: mlData.categoryPredictions.food.predictedAmount * 0.7, // 70% of food budget for food
          assetsPurchased: mlData.categoryPredictions.food.predictedAmount * 0.3, // 30% of food budget for assets
          total: forecast.predictedAmount,
          confidence: forecast.confidence
        };
      } else {
        // Fallback to historical proportions if category predictions aren't available
        // Calculate average proportions from historical data
        const totalFoodConsumption = historicalData.reduce((sum, month) => sum + month.foodConsumption, 0);
        const totalAssetsPurchased = historicalData.reduce((sum, month) => sum + month.assetsPurchased, 0);
        const totalVehicleRentalCosts = historicalData.reduce((sum, month) => sum + month.vehicleRentalCosts, 0);
        const totalSpent = totalFoodConsumption + totalAssetsPurchased + totalVehicleRentalCosts;
        
        const foodProportion = totalSpent > 0 ? totalFoodConsumption / totalSpent : 0.33;
        const assetsProportion = totalSpent > 0 ? totalAssetsPurchased / totalSpent : 0.33;
        const vehicleProportion = totalSpent > 0 ? totalVehicleRentalCosts / totalSpent : 0.34;
        
        // For vehicle rental costs, use the last month's value as the base
        // and apply a small growth factor for future months
        const lastMonthVehicleRental = historicalData.length > 0 
          ? historicalData[historicalData.length - 1].vehicleRentalCosts 
          : 0;
        
        // Vehicle rental costs are typically fixed monthly payments
        // with occasional step changes when new vehicles are added
        const vehicleRentalCosts = lastMonthVehicleRental;
        
        // Adjust food and assets proportions to account for the fixed vehicle costs
        const remainingBudget = forecast.predictedAmount - vehicleRentalCosts;
        const foodConsumption = remainingBudget * (foodProportion / (foodProportion + assetsProportion));
        const assetsPurchased = remainingBudget * (assetsProportion / (foodProportion + assetsProportion));
        
        return {
          month: forecast.month,
          year: forecast.year,
          foodConsumption,
          assetsPurchased,
          vehicleRentalCosts,
          total: forecast.predictedAmount,
          confidence: forecast.confidence
        };
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR'
    }).format(amount);
  };

  const getMonthYearLabel = (month: string, year: number) => {
    return `${month} ${year}`;
  };

  // Prepare monthly data for bar chart
  const prepareMonthlyChartData = () => {
    if (!monthlyData || monthlyData.length === 0) return null;

    const labels = monthlyData.map(item => getMonthYearLabel(item.month, item.year));
    
    return {
      labels,
      datasets: [
        {
          label: 'Food Consumption',
          data: monthlyData.map(item => item.foodConsumption),
          backgroundColor: 'rgba(16, 185, 129, 0.7)', // emerald color
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
        },
        {
          label: 'Assets Purchased',
          data: monthlyData.map(item => item.assetsPurchased),
          backgroundColor: 'rgba(99, 102, 241, 0.7)', // indigo color
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 1,
        },
        {
          label: 'Vehicle Rental Costs',
          data: monthlyData.map(item => item.vehicleRentalCosts),
          backgroundColor: 'rgba(245, 158, 11, 0.7)', // amber color
          borderColor: 'rgb(245, 158, 11)',
          borderWidth: 1,
        },
      ],
    };
  };

  // Prepare category forecast data for bar chart
  const prepareCategoryForecastChartData = () => {
    if (!categoryForecasts || categoryForecasts.length === 0) return null;

    const labels = categoryForecasts.map(item => getMonthYearLabel(item.month, item.year));
    
    return {
      labels,
      datasets: [
        {
          label: 'Food Consumption',
          data: categoryForecasts.map(item => item.foodConsumption),
          backgroundColor: 'rgba(16, 185, 129, 0.7)', // emerald color
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
        },
        {
          label: 'Assets Purchased',
          data: categoryForecasts.map(item => item.assetsPurchased),
          backgroundColor: 'rgba(99, 102, 241, 0.7)', // indigo color
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 1,
        },
        {
          label: 'Vehicle Rental Costs',
          data: categoryForecasts.map(item => item.vehicleRentalCosts),
          backgroundColor: 'rgba(245, 158, 11, 0.7)', // amber color
          borderColor: 'rgb(245, 158, 11)',
          borderWidth: 1,
        },
      ],
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isMobile ? 'bottom' as const : 'top' as const,
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: isMobile ? 10 : 12
          }
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: isMobile ? 8 : 12
          },
          maxRotation: isMobile ? 45 : 0
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return isMobile ? formatCurrency(value).replace('.00', '') : formatCurrency(value);
          },
          font: {
            size: isMobile ? 8 : 12
          }
        }
      }
    }
  };

  const monthlyChartData = prepareMonthlyChartData();
  const categoryForecastChartData = prepareCategoryForecastChartData();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`${isMobile ? 'w-[95vw] max-w-[95vw]' : 'sm:max-w-[900px]'} overflow-hidden`}
        showFullscreenButton
        showPrintButton={!loading && !error && monthlyData.length > 0 && categoryForecasts.length > 0}
        showShareButton={!loading && !error && monthlyData.length > 0}
      >
        <DialogHeader>
          <DialogTitle>{t('consumption_analysis')}</DialogTitle>
          <DialogDescription>{t('consumption_analysis_description')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-medium text-sm sm:text-base">{t('enterprise_consumption_dashboard')}</h3>
          </div>
          
          {!loading && !error && monthlyData.length > 0 && categoryForecasts.length > 0 && !isMobile && (
            <PrintConsumptionReportButton 
              monthlyData={monthlyData}
              categoryForecasts={categoryForecasts}
            />
          )}
        </div>
        
        <Tabs defaultValue="monthly" className="w-full" dir={dir}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">{t('monthly_breakdown')}</TabsTrigger>
            <TabsTrigger value="forecast">{t('ml_forecast')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="monthly" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 sm:py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">{t('loading_consumption_data')}</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-destructive mb-4" />
                <p className="text-destructive font-medium">Error loading data</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">{error}</p>
                <Button variant="outline" size={isMobile ? "sm" : "default"} className="mt-4" onClick={loadConsumptionData}>
                  Try Again
                </Button>
              </div>
            ) : monthlyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-medium">No consumption data available</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">Start tracking your expenses to see monthly breakdowns.</p>
              </div>
            ) : (
              <ScrollArea className={`${isMobile ? 'h-[450px]' : 'h-[500px]'} pr-2 sm:pr-4`}>
                <div className="space-y-4 sm:space-y-6">
                  {/* Summary Card */}
                  <Card className="border-none shadow-sm">
                    <CardHeader className={`pb-2 ${isMobile ? 'px-3 py-3' : ''}`}>
                      <div className="flex items-center justify-between">
                        <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'} flex items-center`}>
                          <DollarSign className="h-4 w-4 mr-2 text-primary" />
                          Consumption Summary
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {monthlyData.length} months
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className={`${isMobile ? 'px-3 py-2' : ''} grid grid-cols-3 gap-2 sm:gap-4`}>
                      {/* Calculate totals */}
                      {(() => {
                        const totalFood = monthlyData.reduce((sum, month) => sum + month.foodConsumption, 0);
                        const totalAssets = monthlyData.reduce((sum, month) => sum + month.assetsPurchased, 0);
                        const totalVehicle = monthlyData.reduce((sum, month) => sum + month.vehicleRentalCosts, 0);
                        const grandTotal = totalFood + totalAssets + totalVehicle;
                        
                        return (
                          <>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Food</p>
                              <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {formatCurrency(totalFood).replace('.00', '')}
                              </p>
                              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                                {Math.round((totalFood / grandTotal) * 100)}%
                              </p>
                            </div>
                            
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Assets</p>
                              <p className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                {formatCurrency(totalAssets).replace('.00', '')}
                              </p>
                              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1">
                                {Math.round((totalAssets / grandTotal) * 100)}%
                              </p>
                            </div>
                            
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Vehicles</p>
                              <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {formatCurrency(totalVehicle).replace('.00', '')}
                              </p>
                              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                                {Math.round((totalVehicle / grandTotal) * 100)}%
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                
                  {/* Chart Card */}
                  <Card className="border-none shadow-sm">
                    <CardHeader className={`pb-2 ${isMobile ? 'px-3 py-3' : ''}`}>
                      <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'}`}>Monthly Consumption Trends</CardTitle>
                      <CardDescription className={`${isMobile ? 'text-xs' : 'text-sm'}`}>
                        Breakdown of expenses by category
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={isMobile ? 'px-3 py-2' : ''}>
                      {/* Bar Chart for Monthly Data */}
                      <div className={`${isMobile ? 'h-[220px]' : 'h-[280px]'} mb-4 sm:mb-6`}>
                        {monthlyChartData && (
                          <ChartJSBar 
                            data={monthlyChartData} 
                            options={chartOptions} 
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Detailed breakdown */}
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className={`font-medium ${isMobile ? 'text-sm' : 'text-base'} flex items-center`}>
                      <Calendar className="h-4 w-4 mr-2 text-primary" />
                      Monthly Breakdown
                    </h3>
                    
                    <div className="grid gap-3 sm:gap-4">
                      {monthlyData.map((month) => (
                        <Card key={`${month.month}-${month.year}`} className="overflow-hidden border-none shadow-sm">
                          <div className="bg-gradient-to-r from-background to-background/95 p-3 sm:p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold flex items-center text-sm sm:text-base">
                                {getMonthYearLabel(month.month, month.year)}
                              </h4>
                              <Badge variant="secondary" className="font-semibold text-xs">
                                {formatCurrency(month.total)}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs sm:text-sm">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                                    <span>Food Consumption</span>
                                  </span>
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(month.foodConsumption)}
                                  </span>
                                </div>
                                <Progress 
                                  value={month.total ? (month.foodConsumption / month.total) * 100 : 0} 
                                  className="h-1.5 sm:h-2" 
                                  indicatorClassName="bg-emerald-500" 
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs sm:text-sm">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5"></span>
                                    <span>Assets Purchased</span>
                                  </span>
                                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(month.assetsPurchased)}
                                  </span>
                                </div>
                                <Progress 
                                  value={month.total ? (month.assetsPurchased / month.total) * 100 : 0} 
                                  className="h-1.5 sm:h-2" 
                                  indicatorClassName="bg-indigo-500" 
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs sm:text-sm">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
                                    <span>Vehicle Rental Costs</span>
                                  </span>
                                  <span className="font-medium text-amber-600 dark:text-amber-400">
                                    {formatCurrency(month.vehicleRentalCosts)}
                                  </span>
                                </div>
                                <Progress 
                                  value={month.total ? (month.vehicleRentalCosts / month.total) * 100 : 0} 
                                  className="h-1.5 sm:h-2" 
                                  indicatorClassName="bg-amber-500" 
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          
          <TabsContent value="forecast" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 sm:py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">{t('loading_forecast_data')}</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-destructive mb-4" />
                <p className="text-destructive font-medium">Error loading forecast data</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">{error}</p>
                <Button variant="outline" size={isMobile ? "sm" : "default"} className="mt-4" onClick={loadConsumptionData}>
                  Try Again
                </Button>
              </div>
            ) : categoryForecasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <LineChart className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-medium">No forecast data available</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">More historical data is needed to generate accurate forecasts.</p>
              </div>
            ) : (
              <ScrollArea className={`${isMobile ? 'h-[450px]' : 'h-[500px]'} pr-2 sm:pr-4`}>
                <div className="space-y-4 sm:space-y-6">
                  {/* Forecast Summary Card */}
                  <Card className="border-none shadow-sm">
                    <CardHeader className={`pb-2 ${isMobile ? 'px-3 py-3' : ''}`}>
                      <div className="flex items-center justify-between">
                        <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'} flex items-center`}>
                          <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                          Forecast Overview
                        </CardTitle>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8">
                                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs sm:text-sm">
                              <p>Forecasts are based on historical spending patterns and machine learning predictions for each expense category.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <CardDescription className={`${isMobile ? 'text-xs' : 'text-sm'}`}>
                        ML-powered predictions for the next {categoryForecasts.length} months
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={`${isMobile ? 'px-3 py-2' : ''} grid grid-cols-3 gap-2 sm:gap-4`}>
                      {/* Calculate forecast totals */}
                      {(() => {
                        const totalFood = categoryForecasts.reduce((sum, forecast) => sum + forecast.foodConsumption, 0);
                        const totalAssets = categoryForecasts.reduce((sum, forecast) => sum + forecast.assetsPurchased, 0);
                        const totalVehicle = categoryForecasts.reduce((sum, forecast) => sum + forecast.vehicleRentalCosts, 0);
                        const grandTotal = totalFood + totalAssets + totalVehicle;
                        const avgConfidence = categoryForecasts.reduce((sum, forecast) => sum + forecast.confidence, 0) / categoryForecasts.length;
                        
                        return (
                          <>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Food</p>
                              <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {formatCurrency(totalFood).replace('.00', '')}
                              </p>
                              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                                {Math.round((totalFood / grandTotal) * 100)}%
                              </p>
                            </div>
                            
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Assets</p>
                              <p className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                {formatCurrency(totalAssets).replace('.00', '')}
                              </p>
                              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1">
                                {Math.round((totalAssets / grandTotal) * 100)}%
                              </p>
                            </div>
                            
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Vehicles</p>
                              <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {formatCurrency(totalVehicle).replace('.00', '')}
                              </p>
                              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                                {Math.round((totalVehicle / grandTotal) * 100)}%
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                
                  {/* Chart Card */}
                  <Card className="border-none shadow-sm">
                    <CardHeader className={`pb-2 ${isMobile ? 'px-3 py-3' : ''}`}>
                      <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'}`}>Forecast Trends</CardTitle>
                      <CardDescription className={`${isMobile ? 'text-xs' : 'text-sm'}`}>
                        Predicted expenses by category
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={isMobile ? 'px-3 py-2' : ''}>
                      {/* Bar Chart for Forecast Data */}
                      <div className={`${isMobile ? 'h-[220px]' : 'h-[280px]'} mb-4 sm:mb-6`}>
                        {categoryForecastChartData && (
                          <ChartJSBar 
                            data={categoryForecastChartData} 
                            options={chartOptions} 
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Detailed forecast breakdown */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-medium ${isMobile ? 'text-sm' : 'text-base'} flex items-center`}>
                        <Calendar className="h-4 w-4 mr-2 text-primary" />
                        Monthly Forecast
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        Avg. Confidence: {Math.round((categoryForecasts.reduce((sum, f) => sum + f.confidence, 0) / categoryForecasts.length) * 100)}%
                      </Badge>
                    </div>
                    
                    <div className="grid gap-3 sm:gap-4">
                      {categoryForecasts.map((forecast, index) => (
                        <Card key={`${forecast.month}-${forecast.year}`} className="overflow-hidden border-none shadow-sm">
                          <div className="bg-gradient-to-r from-background to-background/95 p-3 sm:p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold flex items-center text-sm sm:text-base">
                                {getMonthYearLabel(forecast.month, forecast.year)}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant={index === 0 ? "default" : "secondary"} 
                                  className="font-semibold text-xs"
                                >
                                  {formatCurrency(forecast.total)}
                                </Badge>
                                <div className={`text-xs px-1.5 py-0.5 rounded-full text-center min-w-[40px] ${
                                  forecast.confidence >= 0.85 
                                    ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300" 
                                    : forecast.confidence >= 0.75
                                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                                      : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                                }`}>
                                  {Math.round(forecast.confidence * 100)}%
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs sm:text-sm">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                                    <span>Food Consumption</span>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 p-0">
                                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800">
                                          <div className="text-xs space-y-1 text-emerald-900 dark:text-emerald-100">
                                            <p className="font-medium">Food Consumption Prediction</p>
                                            <p>Calculated using:</p>
                                            <ul className="list-disc pl-4 space-y-0.5">
                                              <li>Exponential smoothing of historical data</li>
                                              <li>Seasonal adjustment factors</li>
                                              <li>Outlier detection and removal</li>
                                              <li>Confidence: {Math.round(forecast.confidence * 100)}%</li>
                                            </ul>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </span>
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(forecast.foodConsumption)}
                                  </span>
                                </div>
                                <Progress 
                                  value={forecast.total ? (forecast.foodConsumption / forecast.total) * 100 : 0} 
                                  className="h-1.5 sm:h-2" 
                                  indicatorClassName="bg-emerald-500" 
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs sm:text-sm">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5"></span>
                                    <span>Assets Purchased</span>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 p-0">
                                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800">
                                          <div className="text-xs space-y-1 text-indigo-900 dark:text-indigo-100">
                                            <p className="font-medium">Assets Purchased Prediction</p>
                                            <p>Calculated using:</p>
                                            <ul className="list-disc pl-4 space-y-0.5">
                                              <li>Historical asset purchase patterns</li>
                                              <li>Proportion of total budget (30% of food budget)</li>
                                              <li>Linear regression with t-distribution</li>
                                              <li>Confidence: {Math.round(forecast.confidence * 100)}%</li>
                                            </ul>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </span>
                                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(forecast.assetsPurchased)}
                                  </span>
                                </div>
                                <Progress 
                                  value={forecast.total ? (forecast.assetsPurchased / forecast.total) * 100 : 0} 
                                  className="h-1.5 sm:h-2" 
                                  indicatorClassName="bg-indigo-500" 
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs sm:text-sm">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
                                    <span>Vehicle Rental Costs</span>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 p-0">
                                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800">
                                          <div className="text-xs space-y-1 text-amber-900 dark:text-amber-100">
                                            <p className="font-medium">Vehicle Rental Prediction</p>
                                            <p>Calculated using:</p>
                                            <ul className="list-disc pl-4 space-y-0.5">
                                              <li>Fixed monthly payment analysis</li>
                                              <li>Step change detection for new vehicles</li>
                                              <li>Probability of fleet expansion: {Math.round((forecast.vehicleRentalCosts > (monthlyData.length > 0 ? monthlyData[monthlyData.length-1].vehicleRentalCosts : 0) ? 0.7 : 0.2) * 100)}%</li>
                                              <li>Confidence: {Math.round((forecast.confidence + 0.1) * 100)}%</li>
                                            </ul>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </span>
                                  <span className="font-medium text-amber-600 dark:text-amber-400">
                                    {formatCurrency(forecast.vehicleRentalCosts)}
                                  </span>
                                </div>
                                <Progress 
                                  value={forecast.total ? (forecast.vehicleRentalCosts / forecast.total) * 100 : 0} 
                                  className="h-1.5 sm:h-2" 
                                  indicatorClassName="bg-amber-500" 
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}