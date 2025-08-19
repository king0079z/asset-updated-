import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  BarChart3, 
  Lightbulb, 
  ArrowRight, 
  RefreshCcw, 
  Building, 
  Package, 
  Utensils, 
  Car, 
  DollarSign, 
  Bell, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Brain
} from "lucide-react";
import { useRouter } from 'next/router';
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AiAlertsProps {
  className?: string;
}

interface Recommendation {
  category: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  message: string;
}

interface Anomaly {
  id: string;
  name: string;
  severity: 'high' | 'medium' | 'low';
  score: number;
  causes: string[];
}

interface Optimization {
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
}

interface KitchenAnomalyDetail {
  foodName: string;
  avgConsumption: number;
  kitchenConsumption: number;
  percentageAboveAvg: string;
  unit: string;
}

interface KitchenAnomaly {
  id: string;
  name: string;
  floorNumber: string;
  severity: 'high' | 'medium' | 'low';
  anomalyScore: number;
  details: KitchenAnomalyDetail[];
}

interface AssetDisposal {
  id: string;
  name: string;
  disposedAt: string;
  floorNumber: string;
  roomNumber: string;
  purchaseAmount: number;
  severity: 'high' | 'medium' | 'low';
}

interface LocationOverpurchasing {
  location: string;
  floorNumber: string;
  roomNumber: string;
  totalAssets: number;
  totalValue: number;
  recentPurchases: number;
  severity: 'high' | 'medium' | 'low';
}

interface AiAnalysisData {
  recommendations: Recommendation[];
  anomalies: {
    items: Anomaly[];
  };
  optimizations: {
    items: Optimization[];
  };
  kitchenAnomalies: {
    items: KitchenAnomaly[];
  };
  assetDisposals: {
    items: AssetDisposal[];
  };
  locationOverpurchasing: {
    items: LocationOverpurchasing[];
  };
}

export function AiAlerts({ className }: AiAlertsProps) {
  const [aiData, setAiData] = useState<AiAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const router = useRouter();
  const { t, dir } = useTranslation();

  const fetchAiAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch AI analysis as before
      const response = await fetch('/api/ai-analysis/ml-predictions', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching AI analysis: ${response.status}`);
      }

      const data = await response.json();

      // Extract the relevant data from the response
      const analysisData: AiAnalysisData = {
        recommendations: data.insights?.summary?.keyPoints?.map((point: string) => ({
          category: 'ai_insight',
          severity: 'info',
          message: point
        })) || [],
        anomalies: {
          items: data.insights?.anomalies?.items || []
        },
        optimizations: {
          items: data.insights?.optimizations?.items || []
        },
        kitchenAnomalies: {
          items: data.insights?.kitchenAnomalies?.items || []
        },
        assetDisposals: {
          items: data.insights?.assetDisposals?.items || []
        },
        locationOverpurchasing: {
          items: data.insights?.locationOverpurchasing?.items || []
        }
      };

      // 2. Fetch all vehicles
      const vehiclesRes = await fetch('/api/vehicles', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const vehiclesData = await vehiclesRes.json();
      const vehicles = vehiclesData.vehicles || [];

      // 3. For each vehicle, fetch maintenance history and analyze
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const vendorMaintenanceMap: Record<string, { vendorName: string, count: number, totalCost: number, vehicles: string[] }> = {};

      await Promise.all(
        vehicles.map(async (vehicle: any) => {
          // Fetch maintenance history for this vehicle
          const maintRes = await fetch(`/api/vehicles/${vehicle.id}/maintenance-history`, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          const maintData = await maintRes.json();
          const maints = maintData.maintenance || [];

          // Filter for last 12 months
          const recentMaints = maints.filter((m: any) => {
            const date = new Date(m.maintenanceDate);
            return date >= oneYearAgo && date <= now;
          });

          const totalMaintCost = recentMaints.reduce((sum: number, m: any) => sum + (Number(m.cost) || 0), 0);

          // Frequent maintenance: more than 3 in last year
          if (recentMaints.length >= 3) {
            analysisData.recommendations.push({
              category: 'vehicle_rentals',
              severity: recentMaints.length >= 5 ? 'high' : 'medium',
              message: `Vehicle "${vehicle.make} ${vehicle.model}" (Plate: ${vehicle.plateNumber}) required ${recentMaints.length} maintenance actions in the last year. Consider reviewing for chronic issues.`
            });
          }

          // High maintenance cost: > QAR 10,000 in last year
          if (totalMaintCost > 10000) {
            analysisData.recommendations.push({
              category: 'vehicle_rentals',
              severity: totalMaintCost > 20000 ? 'high' : 'medium',
              message: `Vehicle "${vehicle.make} ${vehicle.model}" (Plate: ${vehicle.plateNumber}) incurred QAR ${totalMaintCost.toLocaleString()} in maintenance costs in the last year. Consider replacement or major overhaul.`
            });
          }

          // Vehicle health: if < 60%, recommend replacement
          if (typeof vehicle.healthScore === 'number' && vehicle.healthScore < 60) {
            analysisData.recommendations.push({
              category: 'vehicle_rentals',
              severity: 'high',
              message: `Vehicle "${vehicle.make} ${vehicle.model}" (Plate: ${vehicle.plateNumber}) health is critically low (${vehicle.healthScore}%). Immediate replacement is recommended.`
            });
          }

          // Vendor performance: aggregate maintenance by vendor
          recentMaints.forEach((m: any) => {
            if (m.vendor && m.vendor.name) {
              const vendorId = m.vendor.id || m.vendor.name;
              if (!vendorMaintenanceMap[vendorId]) {
                vendorMaintenanceMap[vendorId] = {
                  vendorName: m.vendor.name,
                  count: 0,
                  totalCost: 0,
                  vehicles: []
                };
              }
              vendorMaintenanceMap[vendorId].count += 1;
              vendorMaintenanceMap[vendorId].totalCost += Number(m.cost) || 0;
              if (!vendorMaintenanceMap[vendorId].vehicles.includes(vehicle.plateNumber)) {
                vendorMaintenanceMap[vendorId].vehicles.push(vehicle.plateNumber);
              }
            }
          });
        })
      );

      // Add vendor performance alerts
      Object.values(vendorMaintenanceMap).forEach(vendor => {
        if (vendor.count >= 5) {
          analysisData.recommendations.push({
            category: 'vendor_performance',
            severity: vendor.count >= 10 ? 'high' : 'medium',
            message: `Vendor "${vendor.vendorName}" handled ${vendor.count} vehicle maintenances (QAR ${vendor.totalCost.toLocaleString()}) in the last year for vehicles: ${vendor.vehicles.join(', ')}. Review vendor performance for quality and cost.`
          });
        }
      });

      // Add anomalies as high-severity recommendations
      data.insights?.anomalies?.items?.forEach((anomaly: Anomaly) => {
        analysisData.recommendations.push({
          category: 'consumption_anomaly',
          severity: anomaly.severity === 'high' ? 'high' : (anomaly.severity === 'medium' ? 'medium' : 'low'),
          message: `Unusual consumption detected for ${anomaly.name}: ${anomaly.causes[0]}`
        });
      });

      // Add top optimization recommendations
      data.insights?.optimizations?.items?.slice(0, 3).forEach((opt: Optimization) => {
        analysisData.recommendations.push({
          category: 'cost_optimization',
          severity: opt.yearlySavings > 1000 ? 'medium' : 'low',
          message: `Potential savings of ${formatCurrency(opt.yearlySavings)}/year by optimizing ${opt.name} usage. ${opt.reason}`
        });
      });

      // Add kitchen consumption anomalies
      data.insights?.kitchenAnomalies?.items?.forEach((anomaly: KitchenAnomaly) => {
        const topFoodItem = anomaly.details[0]; // Get the first food item with anomaly
        analysisData.recommendations.push({
          category: 'kitchen_consumption',
          severity: anomaly.severity,
          message: `Kitchen "${anomaly.name}" on Floor ${anomaly.floorNumber} is consuming ${topFoodItem?.percentageAboveAvg} more ${topFoodItem?.foodName} than average.`
        });
      });

      // Add asset disposal alerts
      data.insights?.assetDisposals?.items?.forEach((disposal: AssetDisposal) => {
        analysisData.recommendations.push({
          category: 'asset_disposal',
          severity: disposal.severity,
          message: `Asset "${disposal.name}" worth ${formatCurrency(disposal.purchaseAmount)} was disposed from Floor ${disposal.floorNumber}, Room ${disposal.roomNumber}.`
        });
      });

      // Add location overpurchasing alerts
      data.insights?.locationOverpurchasing?.items?.forEach((location: LocationOverpurchasing) => {
        analysisData.recommendations.push({
          category: 'asset_overpurchasing',
          severity: location.severity,
          message: `${location.location} has acquired ${location.recentPurchases} new assets recently, totaling ${formatCurrency(location.totalValue)}.`
        });
      });

      setAiData(analysisData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching AI analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      toast({
        title: "Error",
        description: "Failed to load AI analysis. Using fallback data.",
        variant: "destructive",
      });

      // Set fallback data
      setAiData({
        recommendations: [
          {
            category: 'food_supply',
            severity: 'medium',
            message: 'Food consumption costs have increased by 12% compared to last month. Consider reviewing kitchen usage patterns.'
          },
          {
            category: 'vehicle_rentals',
            severity: 'high',
            message: 'Vehicle rental costs are 15% above projected budget. Consider optimizing vehicle usage schedules.'
          },
          {
            category: 'budget_planning',
            severity: 'info',
            message: 'Based on current trends, prepare for a 5% increase in monthly expenses for the next quarter.'
          }
        ],
        anomalies: { items: [] },
        optimizations: { items: [] },
        kitchenAnomalies: { items: [] },
        assetDisposals: { items: [] },
        locationOverpurchasing: { items: [] }
      });
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiAnalysis();
  }, []);

  const getSeverityIcon = (severity: string, size = 5) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className={`h-${size} w-${size} text-rose-500`} />;
      case 'medium':
        return <TrendingUp className={`h-${size} w-${size} text-amber-500`} />;
      case 'low':
        return <TrendingDown className={`h-${size} w-${size} text-emerald-500`} />;
      default:
        return <Info className={`h-${size} w-${size} text-sky-500`} />;
    }
  };

  const getCategoryIcon = (category: string, size = 5) => {
    switch (category) {
      case 'food_supply':
      case 'kitchen_consumption':
        return <Utensils className={`h-${size} w-${size} text-emerald-500`} />;
      case 'vehicle_rentals':
        return <Car className={`h-${size} w-${size} text-blue-500`} />;
      case 'asset_disposal':
      case 'asset_overpurchasing':
        return <Package className={`h-${size} w-${size} text-purple-500`} />;
      case 'budget_planning':
      case 'cost_optimization':
        return <DollarSign className={`h-${size} w-${size} text-amber-500`} />;
      case 'consumption_anomaly':
        return <AlertTriangle className={`h-${size} w-${size} text-rose-500`} />;
      case 'ai_insight':
        return <Brain className={`h-${size} w-${size} text-indigo-500`} />;
      default:
        return <Info className={`h-${size} w-${size} text-sky-500`} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30';
      case 'medium':
        return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30';
      case 'low':
        return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30';
      default:
        return 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-rose-700 dark:text-rose-300';
      case 'medium':
        return 'text-amber-700 dark:text-amber-300';
      case 'low':
        return 'text-emerald-700 dark:text-emerald-300';
      default:
        return 'text-sky-700 dark:text-sky-300';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/70';
      case 'medium':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70';
      case 'low':
        return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70';
      default:
        return 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-900/70';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR'
    }).format(amount);
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('just_now');
    if (diffMins === 1) return t('one_minute_ago');
    if (diffMins < 60) return t('x_minutes_ago', { minutes: diffMins });
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return t('one_hour_ago');
    if (diffHours < 24) return t('x_hours_ago', { hours: diffHours });
    
    return lastUpdated.toLocaleString();
  };

  // Filter recommendations by category for tabs
  const getFilteredRecommendations = (category: string) => {
    if (!aiData) return [];
    
    if (category === 'all') {
      return aiData.recommendations;
    }
    
    if (category === 'critical') {
      return aiData.recommendations.filter(rec => rec.severity === 'high');
    }
    
    if (category === 'warnings') {
      return aiData.recommendations.filter(rec => rec.severity === 'medium');
    }
    
    if (category === 'info') {
      return aiData.recommendations.filter(rec => rec.severity === 'low' || rec.severity === 'info');
    }
    
    // Filter by specific categories
    const categoryMap: Record<string, string[]> = {
      'assets': ['asset_disposal', 'asset_overpurchasing'],
      'food': ['food_supply', 'kitchen_consumption'],
      'vehicles': ['vehicle_rentals'],
      'budget': ['budget_planning', 'cost_optimization']
    };
    
    return aiData.recommendations.filter(rec => categoryMap[category]?.includes(rec.category));
  };

  // Count alerts by severity
  const getAlertCounts = () => {
    if (!aiData) return { high: 0, medium: 0, low: 0, total: 0 };
    
    const high = aiData.recommendations.filter(rec => rec.severity === 'high').length;
    const medium = aiData.recommendations.filter(rec => rec.severity === 'medium').length;
    const low = aiData.recommendations.filter(rec => 
      rec.severity === 'low' || rec.severity === 'info'
    ).length;
    
    return {
      high,
      medium,
      low,
      total: high + medium + low
    };
  };

  const alertCounts = getAlertCounts();
  const filteredRecommendations = getFilteredRecommendations(activeTab);

  if (loading) {
    return (
      <Card className={`border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 pb-2">
          <CardTitle className="text-white text-lg flex items-center">
            <Lightbulb className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
            {t('ai_insights_alerts')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-800 border-opacity-50"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
              <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-indigo-500 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-indigo-700 dark:text-indigo-300">{t('analyzing_enterprise_data')}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('generating_ai_insights')}</p>
            </div>
            <Progress value={65} className="w-64 h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !aiData) {
    return (
      <Card className={`border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 pb-2">
          <CardTitle className="text-white text-lg flex items-center">
            <Lightbulb className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
            {t('ai_insights_alerts')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-col items-center justify-center h-[250px] text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">{t('error_loading_insights')}</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">{t('ai_analysis_error_message')}</p>
            <Button 
              variant="outline" 
              onClick={fetchAiAnalysis}
              className="flex items-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              {t('retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border border-slate-200 shadow-md hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 pb-3 pt-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-white text-lg flex items-center">
            <Sparkles className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
            {t('ai_insights_alerts')}
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={fetchAiAnalysis}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('refresh_insights')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-white/80 text-sm flex items-center mt-1">
          <Clock className="h-3 w-3 mr-1.5" />
          {t('last_updated')}: {formatLastUpdated()}
        </CardDescription>
      </CardHeader>
      
      <div className="px-4 pt-3 pb-1 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-100 dark:border-indigo-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium">
              {alertCounts.total} {t('alerts')}
            </Badge>
            
            {alertCounts.high > 0 && (
              <Badge className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {alertCounts.high} {t('critical')}
              </Badge>
            )}
            
            {alertCounts.medium > 0 && (
              <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {alertCounts.medium} {t('warnings')}
              </Badge>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/50"
            onClick={() => router.push('/ai-analysis')}
          >
            {t('full_analysis')}
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full pb-1">
            <TabsList className="bg-white/50 dark:bg-gray-800/50 w-full h-9 inline-flex mb-1 min-w-max">
              <TabsTrigger value="all" className="text-xs">
                {t('all')}
              </TabsTrigger>
              <TabsTrigger value="critical" className="text-xs">
                {t('critical')}
              </TabsTrigger>
              <TabsTrigger value="warnings" className="text-xs">
                {t('warnings')}
              </TabsTrigger>
              <TabsTrigger value="assets" className="text-xs">
                {t('assets')}
              </TabsTrigger>
              <TabsTrigger value="food" className="text-xs">
                {t('food')}
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="text-xs">
                {t('vehicles')}
              </TabsTrigger>
              <TabsTrigger value="budget" className="text-xs">
                {t('budget')}
              </TabsTrigger>
            </TabsList>
          </ScrollArea>
        </Tabs>
      </div>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          <div className="p-4 space-y-3">
            {filteredRecommendations.length > 0 ? (
              filteredRecommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className={`rounded-lg border ${getSeverityColor(rec.severity)} p-3 transition-all duration-200 hover:shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${getSeverityColor(rec.severity)} border-2 ${rec.severity === 'high' ? 'border-rose-300 dark:border-rose-700' : rec.severity === 'medium' ? 'border-amber-300 dark:border-amber-700' : 'border-emerald-300 dark:border-emerald-700'} flex-shrink-0`}>
                      {getCategoryIcon(rec.category, 4)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`font-medium ${getSeverityTextColor(rec.severity)} text-sm`}>
                            {t(rec.category)}
                          </h4>
                          <Badge variant="outline" className={`${getSeverityBadgeColor(rec.severity)} text-xs whitespace-nowrap`}>
                            {rec.severity === 'high' ? t('critical') : rec.severity === 'medium' ? t('warning') : t('info')}
                          </Badge>
                        </div>
                        
                        {rec.severity === 'high' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-900/50 text-xs py-0 px-2"
                            onClick={() => router.push('/ai-analysis')}
                          >
                            {t('take_action')}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-slate-700 dark:text-slate-300 text-sm break-words" dir={dir}>
                        {rec.message}
                      </p>
                      
                      {rec.category === 'cost_optimization' && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 dark:bg-emerald-600" style={{ width: '65%' }}></div>
                          </div>
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">65% {t('confidence')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-center py-8">
                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-full mb-3">
                  <CheckCircle2 className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                  {activeTab === 'all' 
                    ? t('no_alerts_detected') 
                    : t('no_alerts_in_category')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                  {activeTab === 'all' 
                    ? t('all_systems_normal') 
                    : t('try_different_category')}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-t border-indigo-100 dark:border-indigo-800/50 p-3 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
          <Brain className="h-3.5 w-3.5 mr-1.5 text-indigo-500 dark:text-indigo-400" />
          {t('powered_by_ml')}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/50 w-full sm:w-auto text-xs"
          onClick={() => router.push('/ai-analysis')}
        >
          {t('view_detailed_ai_analysis')}
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}