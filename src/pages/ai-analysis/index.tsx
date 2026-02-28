// @ts-nocheck
import { useEffect, useState } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { KitchenConsumptionAnomalyDialog } from '@/components/KitchenConsumptionAnomalyDialog';
import { AssetDisposalDetailsDialog } from '@/components/AssetDisposalDetailsDialog';
import { LocationOverpurchasingDialog } from '@/components/LocationOverpurchasingDialog';
import PrintAiAnalysisReportButton from '@/components/PrintAiAnalysisReportButton';
import { 
  ArrowDown, 
  ArrowUp, 
  BrainCircuit, 
  DollarSign, 
  Info, 
  LineChart, 
  TrendingDown, 
  TrendingUp, 
  Utensils, 
  Package, 
  Car, 
  AlertTriangle,
  BarChart3,
  PieChart,
  Calendar,
  Brain,
  Lightbulb,
  Sparkles,
  Zap,
  Target,
  Gauge,
  BarChart4,
  BarChart2,
  ChevronRight,
  BarChart,
  Cpu,
  Activity,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Minus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  Trash2
} from 'lucide-react';

interface MLAnalysisData {
  mlAnalysis: {
    consumptionPredictions: {
      supplyId: string;
      prediction: {
        predictedQuantity: number;
        confidence: number;
        trend: 'increasing' | 'decreasing' | 'stable';
        anomalyScore: number;
        seasonalityFactor: number;
      };
    }[];
    optimizationRecommendations: {
      supplyId: string;
      supplyName: string;
      category: string;
      recommendation: {
        recommendedQuantity: number;
        potentialSavings: number;
        confidence: number;
        reasonCode: string;
        implementationDifficulty: 'easy' | 'medium' | 'hard';
      };
    }[];
    budgetPredictions: {
      months: number;
      prediction: {
        predictedAmount: number;
        confidence: number;
        upperBound: number;
        lowerBound: number;
        riskFactor: number;
      };
      categoryPredictions?: {
        food: any;
        vehicleRental: any;
      };
    }[];
    anomalyDetections: {
      supplyId: string;
      supplyName: string;
      anomalyResult: {
        isAnomaly: boolean;
        score: number;
        severity: 'low' | 'medium' | 'high';
        possibleCauses: string[];
      };
    }[];
  };
  insights: {
    summary: {
      title: string;
      description: string;
      keyPoints: string[];
    };
    predictions: {
      title: string;
      description: string;
      items: {
        id: string;
        predictedQuantity: string;
        confidence: string;
        trend: string;
        seasonalityFactor: string;
      }[];
    };
    optimizations: {
      title: string;
      description: string;
      items: {
        id: string;
        name: string;
        category: string;
        currentUsage: number;
        recommendedUsage: number;
        monthlySavings: number;
        yearlySavings: number;
        confidence: string;
        difficulty: string;
        reason: string;
      }[];
    };
    anomalies: {
      title: string;
      description: string;
      items: {
        id: string;
        name: string;
        severity: string;
        score: string;
        causes: string[];
      }[];
    };
    budget: {
      title: string;
      description: string;
      predictions: {
        months: number;
        amount: string;
        confidence: string;
        upperBound: string;
        lowerBound: string;
        riskFactor: string;
      }[];
    };
    kitchenAnomalies?: {
      title: string;
      description: string;
      items: {
        id: string;
        name: string;
        floorNumber: string;
        severity: string;
        anomalyScore: string;
        details: {
          foodName: string;
          avgConsumption: number;
          kitchenConsumption: number;
          percentageAboveAvg: string;
          unit: string;
        }[];
      }[];
    };
    assetDisposals?: {
      title: string;
      description: string;
      items: {
        id: string;
        name: string;
        disposedAt: string;
        floorNumber: string;
        roomNumber: string;
        purchaseAmount: string;
        severity: string;
      }[];
    };
    locationOverpurchasing?: {
      title: string;
      description: string;
      items: {
        location: string;
        floorNumber: string;
        roomNumber: string;
        totalAssets: number;
        totalValue: string;
        recentPurchases: number;
        severity: string;
      }[];
    };
  };
}

interface AnalysisData {
  food: {
    currentMonthCost: number;
    prevMonthCost: number;
    currentYearCost: number;
    prevYearCost: number;
    trendPercentage: number;
    kitchenConsumption: {
      kitchenId: string;
      kitchenName: string;
      totalQuantity: number;
    }[];
    categories: any[];
    forecast: {
      monthly: number;
      yearly: number;
    };
    optimization: {
      items: {
        id: string;
        name: string;
        category: string;
        currentMonthlyUsage: number;
        recommendedMonthlyUsage: number;
        potentialMonthlySavings: number;
        potentialYearlySavings: number;
        optimizationReason: string;
        pricePerUnit: number;
        unit: string;
      }[];
      totalMonthlySavings: number;
      totalYearlySavings: number;
    };
  };
  assets: {
    totalCount: number;
    byType: any[];
    totalValue: number;
    valueByType: any[];
    disposedAssets: any[];
  };
  vehicles: {
    currentMonthCost: number;
    prevMonthCost: number;
    currentYearCost: number;
    costByType: Record<string, number>;
    trendPercentage: number;
    forecast: {
      monthly: number;
      yearly: number;
    };
  };
  forecast: {
    monthly: number;
    yearly: number;
    multiYear: {
      year: number;
      amount: number;
      foodAmount: number;
      vehicleAmount: number;
    }[];
    currentYear: number;
  };
  recommendations: {
    category: string;
    severity: 'high' | 'medium' | 'low' | 'info';
    message: string;
  }[];
  insightMetrics: {
    foodTrend: {
      value: number;
      status: 'positive' | 'negative' | 'neutral';
    };
    vehicleTrend: {
      value: number;
      status: 'positive' | 'negative' | 'neutral';
    };
    assetUtilization: {
      value: number;
      status: 'positive' | 'negative' | 'neutral';
    };
    budgetEfficiency: {
      value: number;
      status: 'positive' | 'negative' | 'neutral';
    };
  };
}

export default function AIAnalysisPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <AIAnalysisContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function AIAnalysisContent() {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [mlData, setMlData] = useState<MLAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mlLoading, setMlLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysisData() {
      try {
        setLoading(true);
        
        // Implement retry logic for better reliability
        const MAX_RETRIES = 2;
        let retries = 0;
        let lastError;
        
        while (retries <= MAX_RETRIES) {
          try {
            // Add cache-busting parameter
            const cacheBuster = `_cb=${Date.now()}`;
            const response = await fetch(`/api/ai-analysis?${cacheBuster}`, {
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
              credentials: 'include'
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('AI analysis API error response:', errorData);
              throw new Error(`Failed to fetch analysis data: ${response.status} ${response.statusText}${errorData.error ? ': ' + errorData.error : ''}`);
            }
            
            const analysisData = await response.json();
            setData(analysisData);
            
            // Success, exit retry loop
            break;
          } catch (error) {
            lastError = error;
            retries++;
            
            if (retries <= MAX_RETRIES) {
              // Exponential backoff: 500ms, 1000ms
              const delay = Math.pow(2, retries - 1) * 500;
              console.warn(`Retry ${retries}/${MAX_RETRIES} for AI analysis after ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (retries > MAX_RETRIES && lastError) {
          throw lastError;
        }
      } catch (err) {
        console.error('Error fetching AI analysis data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analysis data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    async function fetchMLAnalysisData() {
      try {
        setMlLoading(true);
        console.log('Fetching ML analysis data...');
        
        // Implement retry logic for better reliability
        const MAX_RETRIES = 2;
        let retries = 0;
        let lastError;
        
        while (retries <= MAX_RETRIES) {
          try {
            // Add cache-busting parameter
            const cacheBuster = `_cb=${Date.now()}`;
            const response = await fetch(`/api/ai-analysis/ml-predictions?${cacheBuster}`, {
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
              credentials: 'include'
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('ML API error response:', errorData);
              throw new Error(`Failed to fetch ML analysis data: ${response.status} ${response.statusText}${errorData.error ? ': ' + errorData.error : ''}`);
            }
            
            const mlAnalysisData = await response.json();
            console.log('ML data received:', mlAnalysisData);
            setMlData(mlAnalysisData);
            
            // Success, exit retry loop
            break;
          } catch (error) {
            lastError = error;
            retries++;
            
            if (retries <= MAX_RETRIES) {
              // Exponential backoff: 500ms, 1000ms
              const delay = Math.pow(2, retries - 1) * 500;
              console.warn(`Retry ${retries}/${MAX_RETRIES} for ML analysis after ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (retries > MAX_RETRIES && lastError) {
          throw lastError;
        }
      } catch (err) {
        console.error('Error fetching ML analysis data:', err);
        setMlError(err instanceof Error ? err.message : 'Failed to load machine learning analysis. Please try again later.');
      } finally {
        setMlLoading(false);
      }
    }
    
    fetchAnalysisData();
    fetchMLAnalysisData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col space-y-6">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('ai_analysis')}</h1>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="bg-muted/30 h-20" />
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col space-y-6">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('ai_analysis')}</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { food, assets, vehicles, forecast, recommendations, insightMetrics } = data;

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('ai_analysis')}</h1>
        </div>
        <PrintAiAnalysisReportButton data={data} mlData={mlData} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('food_supply_forecast')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Utensils className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">QAR {food.forecast.monthly.toLocaleString()}</span>
              </div>
              <Badge variant={food.trendPercentage > 0 ? "destructive" : "outline"} className="flex items-center space-x-1">
                {food.trendPercentage > 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                <span>{Math.abs(food.trendPercentage).toFixed(1)}%</span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t('monthly_forecast_based_on_current_consumption')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('vehicle_rental_forecast')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">QAR {vehicles.forecast.monthly.toLocaleString()}</span>
              </div>
              <Badge variant={vehicles.trendPercentage > 0 ? "destructive" : "outline"} className="flex items-center space-x-1">
                {vehicles.trendPercentage > 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                <span>{Math.abs(vehicles.trendPercentage).toFixed(1)}%</span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t('monthly_forecast_based_on_current_rental')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('total_budget_forecast')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">QAR {forecast.monthly.toLocaleString()}</span>
              </div>
              <div className="text-xs font-medium">
                QAR {forecast.yearly.toLocaleString()}/year
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t('combined_monthly_forecast')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-primary" />
            <span>{t('ai_recommendations')}</span>
          </CardTitle>
          <CardDescription>
            {t('smart_suggestions')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <Alert key={index} variant={rec.severity === 'high' ? 'destructive' : rec.severity === 'info' ? 'default' : 'outline'}>
                <div className="flex items-start">
                  {rec.severity === 'high' ? (
                    <AlertTriangle className="h-4 w-4 mr-2 mt-0.5" />
                  ) : rec.severity === 'medium' ? (
                    <Info className="h-4 w-4 mr-2 mt-0.5" />
                  ) : (
                    <Info className="h-4 w-4 mr-2 mt-0.5" />
                  )}
                  <div>
                    <AlertTitle>{t(rec.category.toLowerCase())}</AlertTitle>
                    <AlertDescription>{rec.message}</AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Insight Metrics */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className={`border-l-4 ${insightMetrics.foodTrend.status === 'positive' ? 'border-l-green-500' : insightMetrics.foodTrend.status === 'negative' ? 'border-l-red-500' : 'border-l-blue-500'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Utensils className="h-4 w-4 mr-2" />
              {t('food_trend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insightMetrics.foodTrend.value > 0 ? '+' : ''}{insightMetrics.foodTrend.value}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {insightMetrics.foodTrend.status === 'positive' 
                ? t('decreasing_food_costs') 
                : insightMetrics.foodTrend.status === 'negative'
                ? t('increasing_food_costs')
                : t('stable_food_costs')}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${insightMetrics.vehicleTrend.status === 'positive' ? 'border-l-green-500' : insightMetrics.vehicleTrend.status === 'negative' ? 'border-l-red-500' : 'border-l-blue-500'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Car className="h-4 w-4 mr-2" />
              {t('vehicle_trend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insightMetrics.vehicleTrend.value > 0 ? '+' : ''}{insightMetrics.vehicleTrend.value}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {insightMetrics.vehicleTrend.status === 'positive' 
                ? t('decreasing_rental_costs') 
                : insightMetrics.vehicleTrend.status === 'negative'
                ? t('increasing_rental_costs')
                : t('stable_rental_costs')}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${insightMetrics.assetUtilization.status === 'positive' ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Package className="h-4 w-4 mr-2" />
              {t('asset_utilization')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insightMetrics.assetUtilization.value.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {insightMetrics.assetUtilization.status === 'positive' 
                ? t('good_asset_retention') 
                : t('high_asset_disposal_rate')}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 border-l-blue-500`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Gauge className="h-4 w-4 mr-2" />
              {t('budget_efficiency')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insightMetrics.budgetEfficiency.value.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('forecasted_vs_actual_spending_ratio')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Year Budget Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart4 className="h-5 w-5 mr-2 text-primary" />
            {t('multi_year_budget_forecast')}
          </CardTitle>
          <CardDescription>
            {t('projected_budget_description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-6 gap-2 text-center text-sm font-medium">
              <div>{t('year')}</div>
              <div className="col-span-5">{t('projected_budget')}</div>
            </div>
            
            {/* Current Year */}
            <div className="grid grid-cols-6 gap-2 items-center">
              <div className="text-sm font-medium">{forecast.currentYear}</div>
              <div className="col-span-5">
                <div className="flex items-center">
                  <div className="w-full bg-muted rounded-full h-4 mr-4 overflow-hidden">
                    <div className="bg-primary h-4 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">${forecast.yearly.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{t('food')}: QAR {food.forecast.yearly.toLocaleString()}</span>
                  <span>{t('vehicles')}: QAR {vehicles.forecast.yearly.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            {/* Future Years */}
            {forecast.multiYear.map((yearData, index) => {
              // Calculate percentage relative to current year for the bar width
              const percentageOfCurrent = (yearData.amount / forecast.yearly) * 100;
              const foodPercentage = (yearData.foodAmount / yearData.amount) * 100;
              
              return (
                <div key={yearData.year} className="grid grid-cols-6 gap-2 items-center">
                  <div className="text-sm font-medium">{yearData.year}</div>
                  <div className="col-span-5">
                    <div className="flex items-center">
                      <div className="w-full bg-muted rounded-full h-4 mr-4 overflow-hidden">
                        <div className="bg-primary h-4 rounded-full" style={{ width: `${percentageOfCurrent}%` }}></div>
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">${yearData.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{t('food')}: QAR {yearData.foodAmount.toLocaleString()}</span>
                      <span>{t('vehicles')}: QAR {yearData.vehicleAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{t('forecast_note')}</span>
          </div>
        </CardFooter>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="food" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="food">{t('food_supply')}</TabsTrigger>
          <TabsTrigger value="assets">{t('assets')}</TabsTrigger>
          <TabsTrigger value="vehicles">{t('vehicle_rentals')}</TabsTrigger>
          <TabsTrigger value="insights">{t('insights')}</TabsTrigger>
          <TabsTrigger value="ml" className="flex items-center gap-1">
            <Cpu className="h-4 w-4" />
            <span>{t('ml_analysis')}</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Food Supply Tab */}
        <TabsContent value="food" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('food_consumption_costs')}</CardTitle>
                <CardDescription>{t('monthly_and_yearly_consumption_costs')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t('current_month')}</div>
                      <div className="text-sm font-medium">QAR {food.currentMonthCost.toLocaleString()}</div>
                    </div>
                    <Progress value={food.currentMonthCost > food.prevMonthCost ? 100 : (food.currentMonthCost / food.prevMonthCost) * 100} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t('previous_month')}</div>
                      <div className="text-sm font-medium">QAR {food.prevMonthCost.toLocaleString()}</div>
                    </div>
                    <Progress value={food.prevMonthCost > food.currentMonthCost ? 100 : (food.prevMonthCost / food.currentMonthCost) * 100} className="h-2" />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t('current_year')}</div>
                      <div className="text-sm font-medium">QAR {food.currentYearCost.toLocaleString()}</div>
                    </div>
                    <Progress value={food.currentYearCost > food.prevYearCost ? 100 : (food.currentYearCost / food.prevYearCost) * 100} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t('previous_year')}</div>
                      <div className="text-sm font-medium">QAR {food.prevYearCost.toLocaleString()}</div>
                    </div>
                    <Progress value={food.prevYearCost > food.currentYearCost ? 100 : (food.prevYearCost / food.currentYearCost) * 100} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('kitchen_consumption')}</CardTitle>
                <CardDescription>{t('consumption_by_kitchen_location')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {food.kitchenConsumption.length > 0 ? (
                    food.kitchenConsumption
                      .sort((a, b) => b.totalQuantity - a.totalQuantity)
                      .map((kitchen) => {
                        const maxQuantity = Math.max(...food.kitchenConsumption.map(k => k.totalQuantity));
                        const percentage = (kitchen.totalQuantity / maxQuantity) * 100;
                        
                        return (
                          <div key={kitchen.kitchenId}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">{kitchen.kitchenName}</div>
                              <div className="text-sm font-medium">{kitchen.totalQuantity.toFixed(2)} {t('units')}</div>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center text-muted-foreground py-6">
                      {t('no_kitchen_consumption_data')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>{t('food_supply_forecast')}</CardTitle>
              <CardDescription>{t('projected_expenses_description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t('monthly_forecast')}</div>
                  <div className="flex items-center space-x-2">
                    <LineChart className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">QAR {food.forecast.monthly.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {food.trendPercentage > 0 ? (
                      <div className="flex items-center text-destructive">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span>{t('increasing_trend')} ({food.trendPercentage.toFixed(1)}% {t('from_previous_month')})</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-green-500">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        <span>{t('decreasing_trend')} ({Math.abs(food.trendPercentage).toFixed(1)}% {t('from_previous_month')})</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t('yearly_forecast')}</div>
                  <div className="flex items-center space-x-2">
                    <LineChart className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">QAR {food.forecast.yearly.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('based_on_average_monthly_consumption')} ${food.forecast.monthly.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('asset_overview')}</CardTitle>
                <CardDescription>{t('current_asset_count_and_value')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t('total_active_assets')}</div>
                    <div className="flex items-center space-x-2">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">{assets.totalCount}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t('total_asset_value')}</div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">QAR {assets.totalValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('assets_by_type')}</CardTitle>
                <CardDescription>{t('distribution_of_assets_by_category')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assets.byType.length > 0 ? (
                    assets.byType.map((type) => {
                      const percentage = (type._count / assets.totalCount) * 100;
                      const valueType = assets.valueByType.find(v => v.type === type.type);
                      const value = valueType?._sum?.purchaseAmount || 0;
                      
                      return (
                        <div key={type.type}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">{type.type || t('unknown')}</div>
                            <div className="text-sm font-medium">{type._count} {t('items')} (QAR {value.toLocaleString()})</div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted-foreground py-6">
                      {t('no_asset_type_data')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>{t('disposed_assets')}</CardTitle>
              <CardDescription>{t('assets_disposed_in_current_year')}</CardDescription>
            </CardHeader>
            <CardContent>
              {assets.disposedAssets.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium">
                    {t('total_disposed_value')}: ${assets.disposedAssets.reduce((total, asset) => total + (asset.purchaseAmount || 0), 0).toLocaleString()}
                  </div>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-3 p-3 bg-muted/50">
                      <div className="text-sm font-medium">{t('asset_name')}</div>
                      <div className="text-sm font-medium">{t('value')}</div>
                      <div className="text-sm font-medium">{t('disposed_date')}</div>
                    </div>
                    {assets.disposedAssets.map((asset) => (
                      <div key={asset.id} className="grid grid-cols-3 p-3 border-t">
                        <div className="text-sm">{asset.name}</div>
                        <div className="text-sm">QAR {(asset.purchaseAmount || 0).toLocaleString()}</div>
                        <div className="text-sm">{new Date(asset.disposedAt).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  {t('no_assets_disposed')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Vehicle Rentals Tab */}
        <TabsContent value="vehicles" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('vehicle_rental_costs')}</CardTitle>
                <CardDescription>{t('monthly_and_yearly_rental_expenses')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t('current_month')}</div>
                      <div className="text-sm font-medium">QAR {vehicles.currentMonthCost.toLocaleString()}</div>
                    </div>
                    <Progress value={vehicles.currentMonthCost > vehicles.prevMonthCost ? 100 : (vehicles.currentMonthCost / vehicles.prevMonthCost) * 100} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t('previous_month')}</div>
                      <div className="text-sm font-medium">QAR {vehicles.prevMonthCost.toLocaleString()}</div>
                    </div>
                    <Progress value={vehicles.prevMonthCost > vehicles.currentMonthCost ? 100 : (vehicles.prevMonthCost / vehicles.currentMonthCost) * 100} className="h-2" />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{t('current_year')}</div>
                      <div className="text-sm font-medium">QAR {vehicles.currentYearCost.toLocaleString()}</div>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('rental_costs_by_vehicle_type')}</CardTitle>
                <CardDescription>{t('distribution_of_rental_expenses')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.keys(vehicles.costByType).length > 0 ? (
                    Object.entries(vehicles.costByType)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([type, cost]) => {
                        const totalCost = Object.values(vehicles.costByType).reduce((sum, c) => sum + (c as number), 0);
                        const percentage = ((cost as number) / totalCost) * 100;
                        
                        return (
                          <div key={type}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">{type}</div>
                              <div className="text-sm font-medium">${(cost as number).toLocaleString()}</div>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center text-muted-foreground py-6">
                      {t('no_vehicle_type_data')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>{t('vehicle_rental_forecast')}</CardTitle>
              <CardDescription>{t('projected_expenses_based_on_rental')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t('monthly_forecast')}</div>
                  <div className="flex items-center space-x-2">
                    <LineChart className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">${vehicles.forecast.monthly.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {vehicles.trendPercentage > 0 ? (
                      <div className="flex items-center text-destructive">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span>{t('increasing_trend')} ({vehicles.trendPercentage.toFixed(1)}% {t('from_previous_month')})</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-green-500">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        <span>{t('decreasing_trend')} ({Math.abs(vehicles.trendPercentage).toFixed(1)}% {t('from_previous_month')})</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t('yearly_forecast')}</div>
                  <div className="flex items-center space-x-2">
                    <LineChart className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">${vehicles.forecast.yearly.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('based_on_average_monthly_rental')} ${vehicles.forecast.monthly.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        {/* ML Analysis Tab */}
        <TabsContent value="ml" className="space-y-4 pt-4">
          {mlLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-medium">{t('processing_machine_learning_analysis')}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t('ml_processing_description')}
              </p>
            </div>
          ) : mlError ? (
            <Alert variant="destructive">
              <AlertTitle>{t('error_loading_ml_analysis')}</AlertTitle>
              <AlertDescription>{mlError}</AlertDescription>
            </Alert>
          ) : !mlData ? (
            <Alert>
              <AlertTitle>{t('no_ml_data_available')}</AlertTitle>
              <AlertDescription>
                {t('unable_to_load_ml_analysis')}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* ML Summary Card */}
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Cpu className="h-6 w-6 mr-2 text-blue-600" />
                    {t('machine_learning_analysis')}
                  </CardTitle>
                  <CardDescription>
                    {t('advanced_predictive_analytics')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                    <h3 className="text-lg font-semibold flex items-center mb-3">
                      <BrainCircuit className="h-5 w-5 mr-2 text-blue-600" />
                      {mlData.insights.summary.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {mlData.insights.summary.description}
                    </p>
                    <div className="space-y-3">
                      {mlData.insights.summary.keyPoints.map((point, index) => (
                        <div key={index} className="flex items-start">
                          <div className="bg-blue-100 p-1 rounded-full mr-3 mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          </div>
                          <p className="text-sm">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Kitchen Consumption Anomalies */}
              {mlData.insights.kitchenAnomalies?.items && mlData.insights.kitchenAnomalies.items.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Utensils className="h-5 w-5 mr-2 text-amber-600" />
                      {t('kitchen_consumption_anomalies')}
                    </CardTitle>
                    <CardDescription>
                      {t('kitchens_with_high_consumption')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mlData.insights.kitchenAnomalies.items.map((anomaly) => (
                        <div key={anomaly.id} className="p-4 bg-white rounded-lg border border-amber-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg flex items-center">
                                {anomaly.severity === 'high' ? (
                                  <AlertTriangle className="h-5 w-5 mr-2 text-rose-500" />
                                ) : anomaly.severity === 'medium' ? (
                                  <TrendingUp className="h-5 w-5 mr-2 text-amber-500" />
                                ) : (
                                  <Info className="h-5 w-5 mr-2 text-blue-500" />
                                )}
                                {anomaly.name}
                              </h3>
                              <p className="text-sm text-slate-500">{t('floor')} {anomaly.floorNumber}</p>
                            </div>
                            <Badge className={
                              anomaly.severity === 'high' ? 'bg-rose-100 text-rose-700' :
                              anomaly.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {anomaly.severity === 'high' ? t('critical') : 
                               anomaly.severity === 'medium' ? t('warning') : t('info')}
                            </Badge>
                          </div>
                          
                          <div className="mt-3">
                            <p className="text-sm">
                              {t('more_resources_than_average').replace('{percentage}', (anomaly.anomalyScore * 100).toFixed(0))}
                            </p>
                            
                            {anomaly.details && anomaly.details.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-medium">{t('top_anomalies')}</p>
                                <ul className="mt-1 space-y-1">
                                  {anomaly.details.slice(0, 2).map((detail, idx) => (
                                    <li key={idx} className="text-sm flex items-center">
                                      <span className="inline-block w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                                      {detail.foodName}: {detail.percentageAboveAvg} {t('above_average')}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-3 flex justify-end">
                            <KitchenConsumptionAnomalyDialog 
                              anomaly={anomaly} 
                              trigger={
                                <Button variant="outline" size="sm" className="text-xs">
                                  {t('view_details')}
                                </Button>
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Asset Disposals */}
              {mlData.insights.assetDisposals?.items && mlData.insights.assetDisposals.items.length > 0 && (
                <Card className="border-rose-200 bg-rose-50/30">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Trash2 className="h-5 w-5 mr-2 text-rose-600" />
                      {t('recent_asset_disposals')}
                    </CardTitle>
                    <CardDescription>
                      {t('recently_disposed_assets')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mlData.insights.assetDisposals.items.map((disposal) => (
                        <div key={disposal.id} className="p-4 bg-white rounded-lg border border-rose-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{disposal.name}</h3>
                              <p className="text-sm text-slate-500">
                                {t('floor')} {disposal.floorNumber}, {t('room')} {disposal.roomNumber}
                              </p>
                            </div>
                            <Badge className={
                              disposal.severity === 'high' ? 'bg-rose-100 text-rose-700' :
                              disposal.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {disposal.severity === 'high' ? t('high_value') : 
                               disposal.severity === 'medium' ? t('medium_value') : t('low_value')}
                            </Badge>
                          </div>
                          
                          <div className="mt-3 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium">{t('asset_value')}:</p>
                              <p className="text-lg font-bold">${parseFloat(disposal.purchaseAmount.toString()).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{t('disposed_at')}:</p>
                              <p className="text-sm">{new Date(disposal.disposedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex justify-end">
                            <AssetDisposalDetailsDialog 
                              disposal={disposal} 
                              trigger={
                                <Button variant="outline" size="sm" className="text-xs">
                                  {t('view_details')}
                                </Button>
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Location Overpurchasing */}
              {mlData.insights.locationOverpurchasing?.items && mlData.insights.locationOverpurchasing.items.length > 0 && (
                <Card className="border-indigo-200 bg-indigo-50/30">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-indigo-600" />
                      {t('location_overpurchasing')}
                    </CardTitle>
                    <CardDescription>
                      {t('locations_with_high_acquisition')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mlData.insights.locationOverpurchasing.items.map((location) => (
                        <div key={`${location.floorNumber}-${location.roomNumber}`} className="p-4 bg-white rounded-lg border border-indigo-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{location.location}</h3>
                              <p className="text-sm text-slate-500 flex items-center">
                                <Package className="h-4 w-4 mr-1" />
                                {location.totalAssets} {t('total_assets')}
                              </p>
                            </div>
                            <Badge className={
                              location.severity === 'high' ? 'bg-rose-100 text-rose-700' :
                              location.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {location.severity === 'high' ? t('critical') : 
                               location.severity === 'medium' ? t('warning') : t('info')}
                            </Badge>
                          </div>
                          
                          <div className="mt-3">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm text-slate-600">{t('recent_purchases')}</span>
                              <span className="text-sm font-medium">{location.recentPurchases} {t('assets')}</span>
                            </div>
                            <Progress value={(location.recentPurchases / location.totalAssets) * 100} className="h-2" />
                            <p className="text-sm mt-2">
                              {t('total_value')}: <span className="font-medium">${parseFloat(location.totalValue.toString()).toFixed(2)}</span>
                            </p>
                          </div>
                          
                          <div className="mt-3 flex justify-end">
                            <LocationOverpurchasingDialog 
                              locationData={location} 
                              trigger={
                                <Button variant="outline" size="sm" className="text-xs">
                                  {t('view_details')}
                                </Button>
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ML Predictions Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Budget Predictions Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <LineChart className="h-5 w-5 mr-2 text-primary" />
                      {mlData.insights.budget.title}
                    </CardTitle>
                    <CardDescription>
                      {mlData.insights.budget.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mlData.insights.budget.predictions.map((prediction) => (
                        <div key={prediction.months} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">
                              {prediction.months === 1 ? 'Next month' : 
                               prediction.months === 3 ? 'Next quarter' : 
                               `Next ${prediction.months} months`}
                            </div>
                            <Badge variant="outline" className="bg-blue-50">
                              {prediction.confidence} confidence
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 mb-3">
                            <DollarSign className="h-5 w-5 text-primary" />
                            <span className="text-2xl font-bold">${prediction.amount}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center">
                              <ArrowUp className="h-4 w-4 text-muted-foreground mr-1" />
                              <span>Upper bound: ${prediction.upperBound}</span>
                            </div>
                            <div className="flex items-center">
                              <ArrowDown className="h-4 w-4 text-muted-foreground mr-1" />
                              <span>Lower bound: ${prediction.lowerBound}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-sm flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1 text-amber-500" />
                            <span>Risk factor: {prediction.riskFactor}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Anomaly Detection Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-primary" />
                      {mlData.insights.anomalies.title}
                    </CardTitle>
                    <CardDescription>
                      {mlData.insights.anomalies.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {mlData.insights.anomalies.items.length > 0 ? (
                      <div className="space-y-4">
                        {mlData.insights.anomalies.items.map((anomaly) => (
                          <div key={anomaly.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium">{anomaly.name}</div>
                              <Badge 
                                variant={
                                  anomaly.severity === 'high' ? 'destructive' : 
                                  anomaly.severity === 'medium' ? 'default' : 'outline'
                                }
                              >
                                {anomaly.severity} severity
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2 mb-3">
                              <AlertTriangle className={
                                anomaly.severity === 'high' ? 'h-5 w-5 text-red-500' : 
                                anomaly.severity === 'medium' ? 'h-5 w-5 text-amber-500' : 
                                'h-5 w-5 text-blue-500'
                              } />
                              <span className="text-sm">Anomaly score: {anomaly.score}</span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">Possible causes:</div>
                              <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                                {anomaly.causes.map((cause, idx) => (
                                  <li key={idx}>{cause}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                        <h3 className="text-lg font-medium">No Anomalies Detected</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-md">
                          Our machine learning models have analyzed your consumption patterns and found no significant anomalies.
                          This indicates stable and predictable resource usage.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Consumption Predictions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUpIcon className="h-5 w-5 mr-2 text-primary" />
                    {mlData.insights.predictions.title}
                  </CardTitle>
                  <CardDescription>
                    {mlData.insights.predictions.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 p-3 bg-muted/50 text-sm font-medium">
                      <div className="col-span-4">Predicted Quantity</div>
                      <div className="col-span-2">Confidence</div>
                      <div className="col-span-3">Trend</div>
                      <div className="col-span-3">Seasonality Factor</div>
                    </div>
                    
                    {mlData.insights.predictions.items.length > 0 ? (
                      mlData.insights.predictions.items.map((item, index) => (
                        <div key={item.id || index} className="grid grid-cols-12 p-3 border-t hover:bg-muted/10 text-sm">
                          <div className="col-span-4 font-medium">{item.predictedQuantity} units</div>
                          <div className="col-span-2">{item.confidence}</div>
                          <div className="col-span-3 flex items-center">
                            {item.trend === 'increasing' ? (
                              <>
                                <TrendingUpIcon className="h-4 w-4 mr-1 text-red-500" />
                                <span className="text-red-500">Increasing</span>
                              </>
                            ) : item.trend === 'decreasing' ? (
                              <>
                                <TrendingDownIcon className="h-4 w-4 mr-1 text-green-500" />
                                <span className="text-green-500">Decreasing</span>
                              </>
                            ) : (
                              <>
                                <Minus className="h-4 w-4 mr-1 text-blue-500" />
                                <span className="text-blue-500">Stable</span>
                              </>
                            )}
                          </div>
                          <div className="col-span-3">{item.seasonalityFactor}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-muted-foreground">
                        No prediction data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Smart Optimization Recommendations */}
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Sparkles className="h-5 w-5 mr-2 text-green-600" />
                    {mlData.insights.optimizations.title}
                  </CardTitle>
                  <CardDescription>
                    {mlData.insights.optimizations.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mlData.insights.optimizations.items.length > 0 ? (
                    <div className="space-y-4">
                      <div className="rounded-md border">
                        <div className="grid grid-cols-12 p-3 bg-muted/50 text-sm font-medium">
                          <div className="col-span-3">Item</div>
                          <div className="col-span-2">Category</div>
                          <div className="col-span-2">Current Usage</div>
                          <div className="col-span-2">Recommended</div>
                          <div className="col-span-3">Potential Savings</div>
                        </div>
                        
                        {mlData.insights.optimizations.items.map((item) => (
                          <div key={item.id} className="grid grid-cols-12 p-3 border-t hover:bg-muted/10 text-sm">
                            <div className="col-span-3 font-medium">{item.name}</div>
                            <div className="col-span-2 text-muted-foreground">{item.category}</div>
                            <div className="col-span-2">
                              {item.currentUsage.toFixed(2)} units/month
                            </div>
                            <div className="col-span-2 text-green-600 font-medium">
                              {item.recommendedUsage.toFixed(2)} units/month
                            </div>
                            <div className="col-span-3">
                              <div className="flex flex-col">
                                <span className="text-green-600 font-medium">${item.yearlySavings.toFixed(2)}/year</span>
                                <span className="text-xs text-muted-foreground">${item.monthlySavings.toFixed(2)}/month</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border">
                        <h4 className="font-medium flex items-center mb-2">
                          <Info className="h-4 w-4 mr-2 text-primary" />
                          Optimization Insights
                        </h4>
                        <div className="space-y-3 text-sm">
                          {mlData.insights.optimizations.items.map((item) => (
                            <div key={`insight-${item.id}`} className="flex items-start">
                              <div className="bg-green-100 p-1 rounded-full mr-3 mt-0.5">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              </div>
                              <div>
                                <span className="font-medium">{item.name}:</span>{' '}
                                <span className="text-muted-foreground">{item.reason}</span>
                                <div className="mt-1 text-xs">
                                  <span className="text-muted-foreground">Implementation difficulty: </span>
                                  <Badge variant="outline" className={
                                    item.difficulty === 'easy' ? 'bg-green-50 text-green-700' :
                                    item.difficulty === 'medium' ? 'bg-amber-50 text-amber-700' :
                                    'bg-red-50 text-red-700'
                                  }>
                                    {item.difficulty}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No optimization recommendations available at this time.</p>
                      <p className="text-sm mt-2">This could be due to insufficient data or already optimized quantities.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="md:col-span-2 bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-primary" />
                  AI-Powered Budget Optimization
                </CardTitle>
                <CardDescription>
                  Advanced analysis of your spending patterns to identify optimization opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-background rounded-lg border">
                    <h3 className="text-lg font-semibold flex items-center mb-2">
                      <Sparkles className="h-5 w-5 mr-2 text-yellow-500" />
                      Smart Budget Insights
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Our AI has analyzed your spending patterns and identified the following optimization opportunities:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <div className="bg-primary/10 p-1 rounded mr-3 mt-0.5">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Food Supply Optimization</p>
                          <p className="text-xs text-muted-foreground">
                            {food.trendPercentage > 0 
                              ? `Food costs are trending upward by ${food.trendPercentage.toFixed(1)}%. Consider reviewing kitchen consumption patterns and implementing portion control measures.`
                              : `Food costs are trending downward by ${Math.abs(food.trendPercentage).toFixed(1)}%. Continue with current optimization strategies.`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="bg-primary/10 p-1 rounded mr-3 mt-0.5">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Vehicle Rental Efficiency</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicles.trendPercentage > 0 
                              ? `Vehicle rental costs are trending upward by ${vehicles.trendPercentage.toFixed(1)}%. Consider negotiating better rates or optimizing vehicle usage schedules.`
                              : `Vehicle rental costs are trending downward by ${Math.abs(vehicles.trendPercentage).toFixed(1)}%. Continue with current optimization strategies.`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="bg-primary/10 p-1 rounded mr-3 mt-0.5">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Asset Management</p>
                          <p className="text-xs text-muted-foreground">
                            {assets.disposedAssets.length > 0 
                              ? `${assets.disposedAssets.length} assets have been disposed this year with a total value of $${assets.disposedAssets.reduce((total, asset) => total + (asset.purchaseAmount || 0), 0).toLocaleString()}. Consider implementing better maintenance procedures.`
                              : `No assets have been disposed this year. Continue with current asset management practices.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2 text-primary" />
                  Budget Targets
                </CardTitle>
                <CardDescription>
                  Recommended budget targets based on historical data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium">Food Supply</div>
                      <div className="text-sm font-medium">${(food.forecast.monthly * 0.95).toFixed(2)}</div>
                    </div>
                    <Progress value={95} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">5% reduction target from current forecast</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium">Vehicle Rentals</div>
                      <div className="text-sm font-medium">${(vehicles.forecast.monthly * 0.9).toFixed(2)}</div>
                    </div>
                    <Progress value={90} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">10% reduction target from current forecast</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium">Total Budget</div>
                      <div className="text-sm font-medium">${(forecast.monthly * 0.93).toFixed(2)}</div>
                    </div>
                    <Progress value={93} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">7% overall reduction target</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2 text-primary" />
                  Cost-Saving Opportunities
                </CardTitle>
                <CardDescription>
                  AI-identified areas for potential savings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-green-100 p-1 rounded-full mr-3">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Kitchen Consumption Optimization</p>
                      <p className="text-xs text-muted-foreground">
                        Potential annual savings: ${(food.forecast.yearly * 0.05).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-green-100 p-1 rounded-full mr-3">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Vehicle Rental Negotiation</p>
                      <p className="text-xs text-muted-foreground">
                        Potential annual savings: ${(vehicles.forecast.yearly * 0.1).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-green-100 p-1 rounded-full mr-3">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Asset Lifecycle Extension</p>
                      <p className="text-xs text-muted-foreground">
                        Potential annual savings: ${(assets.totalValue * 0.03).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Total Potential Savings</p>
                      <p className="text-sm font-medium text-green-600">
                        ${((food.forecast.yearly * 0.05) + (vehicles.forecast.yearly * 0.1) + (assets.totalValue * 0.03)).toLocaleString()}/year
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-primary" />
                Long-Term Budget Projection
              </CardTitle>
              <CardDescription>
                5-year budget forecast with optimization scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-6 gap-2 text-center text-sm font-medium">
                  <div>Year</div>
                  <div className="col-span-2">Current Trajectory</div>
                  <div className="col-span-3">With Optimizations</div>
                </div>
                
                {/* Current Year */}
                <div className="grid grid-cols-6 gap-2 items-center">
                  <div className="text-sm font-medium">{forecast.currentYear}</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <div className="w-full bg-muted rounded-full h-3 mr-2 overflow-hidden">
                        <div className="bg-blue-500 h-3 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">${forecast.yearly.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center">
                      <div className="w-full bg-muted rounded-full h-3 mr-2 overflow-hidden">
                        <div className="bg-green-500 h-3 rounded-full" style={{ width: '93%' }}></div>
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">${(forecast.yearly * 0.93).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                {/* Future Years */}
                {forecast.multiYear.map((yearData, index) => {
                  // Calculate optimized budget (7% less than projected)
                  const optimizedBudget = yearData.amount * 0.93;
                  // Calculate percentage relative to current year for the bar width
                  const percentageOfCurrent = (yearData.amount / forecast.yearly) * 100;
                  const optimizedPercentage = (optimizedBudget / forecast.yearly) * 100;
                  
                  return (
                    <div key={yearData.year} className="grid grid-cols-6 gap-2 items-center">
                      <div className="text-sm font-medium">{yearData.year}</div>
                      <div className="col-span-2">
                        <div className="flex items-center">
                          <div className="w-full bg-muted rounded-full h-3 mr-2 overflow-hidden">
                            <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${percentageOfCurrent > 100 ? 100 : percentageOfCurrent}%` }}></div>
                          </div>
                          <span className="text-sm font-medium whitespace-nowrap">${yearData.amount.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center">
                          <div className="w-full bg-muted rounded-full h-3 mr-2 overflow-hidden">
                            <div className="bg-green-500 h-3 rounded-full" style={{ width: `${optimizedPercentage > 100 ? 100 : optimizedPercentage}%` }}></div>
                          </div>
                          <span className="text-sm font-medium whitespace-nowrap">${optimizedBudget.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="pt-4 border-t flex justify-between text-sm">
                  <div>
                    <span className="font-medium">5-Year Total (Current):</span> 
                    <span className="ml-2">${(forecast.yearly + forecast.multiYear.reduce((sum, year) => sum + year.amount, 0)).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">5-Year Total (Optimized):</span>
                    <span className="ml-2 text-green-600">${((forecast.yearly * 0.93) + forecast.multiYear.reduce((sum, year) => sum + (year.amount * 0.93), 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Optimization Strategy:</span> Implementing recommended cost-saving measures could result in approximately 7% budget reduction year-over-year.
              </div>
            </CardFooter>
          </Card>
          
          {/* Quantity Optimization Section */}
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Utensils className="h-5 w-5 mr-2 text-primary" />
                Food Supply Quantity Optimization
              </CardTitle>
              <CardDescription>
                AI-recommended quantity adjustments based on consumption patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {food.optimization?.items && food.optimization.items.length > 0 ? (
                <div className="space-y-6">
                  <div className="bg-white p-4 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold flex items-center">
                        <Sparkles className="h-5 w-5 mr-2 text-yellow-500" />
                        Optimization Summary
                      </h3>
                      <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                        ${food.optimization.totalYearlySavings.toLocaleString()} potential yearly savings
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Based on your consumption patterns, we've identified opportunities to optimize food supply quantities
                      that could result in significant cost savings without impacting operations.
                    </p>
                  </div>
                  
                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 p-3 bg-muted/50 text-sm font-medium">
                      <div className="col-span-3">Item</div>
                      <div className="col-span-2">Category</div>
                      <div className="col-span-2">Current Usage</div>
                      <div className="col-span-2">Recommended</div>
                      <div className="col-span-3">Potential Savings</div>
                    </div>
                    
                    {food.optimization.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 p-3 border-t hover:bg-muted/10 text-sm">
                        <div className="col-span-3 font-medium">{item.name}</div>
                        <div className="col-span-2 text-muted-foreground">{item.category}</div>
                        <div className="col-span-2">
                          {item.currentMonthlyUsage.toFixed(2)} {item.unit}/month
                        </div>
                        <div className="col-span-2 text-green-600 font-medium">
                          {item.recommendedMonthlyUsage.toFixed(2)} {item.unit}/month
                        </div>
                        <div className="col-span-3">
                          <div className="flex flex-col">
                            <span className="text-green-600 font-medium">${item.potentialYearlySavings.toFixed(2)}/year</span>
                            <span className="text-xs text-muted-foreground">${item.potentialMonthlySavings.toFixed(2)}/month</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="grid grid-cols-12 p-3 border-t bg-muted/20">
                      <div className="col-span-7 font-medium">Total Potential Savings</div>
                      <div className="col-span-5 text-green-600 font-medium">
                        ${food.optimization.totalYearlySavings.toLocaleString()}/year (${food.optimization.totalMonthlySavings.toLocaleString()}/month)
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-medium flex items-center mb-2">
                      <Info className="h-4 w-4 mr-2 text-yellow-600" />
                      Implementation Recommendations
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-6 list-disc">
                      <li>Gradually reduce quantities to the recommended levels over the next 2-3 months</li>
                      <li>Monitor kitchen feedback to ensure service quality is maintained</li>
                      <li>Focus first on items with the highest potential savings</li>
                      <li>Consider implementing portion control measures in high-consumption kitchens</li>
                      <li>Review and adjust quantities quarterly based on changing needs</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No quantity optimization recommendations available at this time.</p>
                  <p className="text-sm mt-2">This could be due to insufficient consumption data or already optimized quantities.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}