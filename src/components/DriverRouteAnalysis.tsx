import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/contexts/TranslationContext';
import { useRouter } from 'next/router';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Route, 
  Car, 
  MapPin, 
  Clock, 
  Fuel, 
  DollarSign, 
  BarChart3, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2, 
  Lightbulb,
  Sparkles,
  Shield,
  Activity,
  BarChart2
} from 'lucide-react';

interface RouteAnalysisResult {
  driverId: string;
  driverEmail: string;
  totalTrips: number;
  totalDistance: number;
  totalHours: number;
  averageSpeed: number;
  irregularStops: number;
  inefficientRoutes: number;
  fuelConsumptionEstimate: number;
  costSavingOpportunities: number;
  driverPerformance?: {
    safetyScore: number;
    efficiencyScore: number;
    consistencyScore: number;
    overallScore: number;
  };
  recommendations: {
    type: string;
    severity: 'high' | 'medium' | 'low' | 'info';
    message: string;
  }[];
  anomalies: {
    tripId: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    details: string;
    timestamp: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }[];
}

interface DriverRouteAnalysisProps {
  driverId?: string;
  className?: string;
}

export function DriverRouteAnalysis({ driverId, className = '' }: DriverRouteAnalysisProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [analysisData, setAnalysisData] = useState<RouteAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<number>(2.1); // Default QAR per liter

  useEffect(() => {
    fetchAnalysisData();
  }, [driverId]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = driverId 
        ? `/api/ai-analysis/driver-routes?driverId=${driverId}` 
        : '/api/ai-analysis/driver-routes';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error fetching analysis data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.analysisResults && data.analysisResults.length > 0) {
        setAnalysisData(data.analysisResults[0]);
      } else {
        setError('No analysis data available');
      }
    } catch (err) {
      console.error('Error fetching analysis data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

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

  const getTypeIcon = (type: string, size = 5) => {
    switch (type) {
      case 'route_optimization':
        return <Route className={`h-${size} w-${size} text-indigo-500`} />;
      case 'stop_reduction':
        return <MapPin className={`h-${size} w-${size} text-purple-500`} />;
      case 'speed_management':
        return <TrendingUp className={`h-${size} w-${size} text-amber-500`} />;
      case 'traffic_management':
        return <Clock className={`h-${size} w-${size} text-blue-500`} />;
      case 'irregular_stops':
        return <MapPin className={`h-${size} w-${size} text-rose-500`} />;
      case 'inefficient_route':
        return <Route className={`h-${size} w-${size} text-amber-500`} />;
      default:
        return <Info className={`h-${size} w-${size} text-sky-500`} />;
    }
  };

  if (loading) {
    return (
      <Card className={`border shadow-sm ${className}`}>
        <CardHeader>
          <CardTitle>{t('analyzing_driver_routes')}</CardTitle>
          <CardDescription>{t('please_wait_while_analyzing')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-800 border-opacity-50"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-indigo-500 animate-pulse" />
          </div>
          <Progress value={65} className="w-64 h-2 mb-4" />
          <p className="text-sm text-muted-foreground">{t('analyzing_trip_patterns')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !analysisData) {
    return (
      <Card className={`border shadow-sm ${className}`}>
        <CardHeader>
          <CardTitle>{t('route_analysis_error')}</CardTitle>
          <CardDescription>{t('error_analyzing_routes')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('error')}</AlertTitle>
            <AlertDescription>
              {error || t('no_analysis_data_available')}
            </AlertDescription>
          </Alert>
          <div className="flex justify-center mt-4">
            <Button onClick={fetchAnalysisData} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('try_again')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border shadow-sm ${className}`}>
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              {t('ai_route_analysis')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('driver')}: {analysisData.driverEmail}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAnalysisData}
            className="gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('refresh')}
          </Button>
        </div>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6 pt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="recommendations">{t('recommendations')}</TabsTrigger>
            <TabsTrigger value="anomalies">{t('anomalies')}</TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent className="p-6">
          <TabsContent value="overview" className="mt-0">
            <div className="mb-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <Fuel className="h-5 w-5 text-indigo-500" />
      <h3 className="font-medium">{t('fuel_price_settings')}</h3>
    </div>
  </div>
  <div className="flex items-end gap-3">
    <div className="flex-1">
      <Label htmlFor="fuelPrice" className="text-sm mb-1">{t('qar_per_liter')}</Label>
      <Input
        id="fuelPrice"
        type="number"
        step="0.01"
        min="0"
        value={fuelPricePerLiter}
        onChange={(e) => setFuelPricePerLiter(parseFloat(e.target.value) || 0)}
        className="max-w-[150px]"
      />
    </div>
    <div className="text-sm text-muted-foreground">
      {t('estimated_fuel_cost')}: <span className="font-medium">{(analysisData.fuelConsumptionEstimate * fuelPricePerLiter).toFixed(2)} QAR</span>
    </div>
  </div>
</div>

{analysisData.driverPerformance && (
  <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
    <div className="flex items-center gap-2 mb-3">
      <BarChart2 className="h-5 w-5 text-indigo-600" />
      <h3 className="font-medium">{t('driver_performance_analysis')}</h3>
      <div className="relative inline-block">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
          </TooltipTrigger>
          <TooltipContent className="max-w-sm bg-popover p-4 rounded-lg shadow-lg border">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">{t('performance_calculation')}</h4>
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-blue-500" />
                    <p className="text-xs font-medium">{t('safety_score')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('safety_score_calculation')}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-3.5 w-3.5 text-green-500" />
                    <p className="text-xs font-medium">{t('efficiency_score')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('efficiency_score_calculation')}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-purple-500" />
                    <p className="text-xs font-medium">{t('consistency_score')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('consistency_score_calculation')}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <p className="text-xs font-medium">{t('overall_score')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('overall_score_calculation')}</p>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
    
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-blue-500" />
          <p className="text-sm font-medium">{t('safety_score')}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold">{analysisData.driverPerformance.safetyScore}</p>
          <Badge variant={analysisData.driverPerformance.safetyScore > 80 ? "success" : analysisData.driverPerformance.safetyScore > 60 ? "warning" : "destructive"}>
            {analysisData.driverPerformance.safetyScore > 80 ? t('excellent') : 
             analysisData.driverPerformance.safetyScore > 60 ? t('good') : t('needs_improvement')}
          </Badge>
        </div>
        <Progress 
          value={analysisData.driverPerformance.safetyScore} 
          className="h-1.5 mt-2" 
          indicatorClassName={analysisData.driverPerformance.safetyScore > 80 ? "bg-green-500" : 
                              analysisData.driverPerformance.safetyScore > 60 ? "bg-amber-500" : "bg-rose-500"}
        />
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Fuel className="h-4 w-4 text-green-500" />
          <p className="text-sm font-medium">{t('efficiency_score')}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold">{analysisData.driverPerformance.efficiencyScore}</p>
          <Badge variant={analysisData.driverPerformance.efficiencyScore > 80 ? "success" : analysisData.driverPerformance.efficiencyScore > 60 ? "warning" : "destructive"}>
            {analysisData.driverPerformance.efficiencyScore > 80 ? t('excellent') : 
             analysisData.driverPerformance.efficiencyScore > 60 ? t('good') : t('needs_improvement')}
          </Badge>
        </div>
        <Progress 
          value={analysisData.driverPerformance.efficiencyScore} 
          className="h-1.5 mt-2" 
          indicatorClassName={analysisData.driverPerformance.efficiencyScore > 80 ? "bg-green-500" : 
                              analysisData.driverPerformance.efficiencyScore > 60 ? "bg-amber-500" : "bg-rose-500"}
        />
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-4 w-4 text-purple-500" />
          <p className="text-sm font-medium">{t('consistency_score')}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold">{analysisData.driverPerformance.consistencyScore}</p>
          <Badge variant={analysisData.driverPerformance.consistencyScore > 80 ? "success" : analysisData.driverPerformance.consistencyScore > 60 ? "warning" : "destructive"}>
            {analysisData.driverPerformance.consistencyScore > 80 ? t('excellent') : 
             analysisData.driverPerformance.consistencyScore > 60 ? t('good') : t('needs_improvement')}
          </Badge>
        </div>
        <Progress 
          value={analysisData.driverPerformance.consistencyScore} 
          className="h-1.5 mt-2" 
          indicatorClassName={analysisData.driverPerformance.consistencyScore > 80 ? "bg-green-500" : 
                              analysisData.driverPerformance.consistencyScore > 60 ? "bg-amber-500" : "bg-rose-500"}
        />
      </div>
      
      <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <p className="text-sm font-medium">{t('overall_score')}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{analysisData.driverPerformance.overallScore}</p>
          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900">
            {analysisData.driverPerformance.overallScore > 80 ? t('top_performer') : 
             analysisData.driverPerformance.overallScore > 60 ? t('good_performer') : t('needs_training')}
          </Badge>
        </div>
        <Progress 
          value={analysisData.driverPerformance.overallScore} 
          className="h-1.5 mt-2" 
          indicatorClassName="bg-indigo-600"
        />
      </div>
    </div>
  </div>
)}

<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Route className="h-5 w-5 text-indigo-500" />
                    <h3 className="font-medium">{t('trip_statistics')}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('total_trips')}</p>
                      <p className="text-2xl font-bold">{analysisData.totalTrips}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('total_distance')}</p>
                      <p className="text-2xl font-bold">{analysisData.totalDistance.toFixed(1)} km</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('total_hours')}</p>
                      <p className="text-2xl font-bold">{analysisData.totalHours.toFixed(1)} h</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('average_speed')}</p>
                      <p className="text-2xl font-bold">{analysisData.averageSpeed.toFixed(1)} km/h</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Fuel className="h-5 w-5 text-indigo-500" />
                    <h3 className="font-medium">{t('fuel_consumption')}</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('estimated_fuel_consumption')}</p>
                      <p className="text-2xl font-bold">{analysisData.fuelConsumptionEstimate.toFixed(1)} L</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('average_consumption')}</p>
                      <p className="text-lg font-medium">
                        {analysisData.totalDistance > 0 
                          ? (analysisData.fuelConsumptionEstimate / analysisData.totalDistance * 100).toFixed(1) 
                          : '0'} L/100km
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h3 className="font-medium">{t('issues_detected')}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('irregular_stops')}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">{analysisData.irregularStops}</p>
                        {analysisData.irregularStops > 0 && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                            {t('attention_needed')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('inefficient_routes')}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">{analysisData.inefficientRoutes}</p>
                        {analysisData.inefficientRoutes > 0 && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                            {t('optimization_needed')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <h3 className="font-medium">{t('cost_savings')}</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('potential_cost_savings')}</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {analysisData.costSavingOpportunities.toFixed(2)} QAR
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('optimization_opportunities')}</p>
                      <p className="text-lg font-medium">
                        {analysisData.recommendations.length}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    <h3 className="font-medium">{t('ai_insight')}</h3>
                  </div>
                  <p className="text-sm">
                    {analysisData.recommendations.length > 0 
                      ? analysisData.recommendations[0].message
                      : t('no_significant_issues')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                variant="default" 
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setActiveTab('recommendations')}
              >
                {t('view_all_recommendations')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="recommendations" className="mt-0">
            <div className="mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                {t('ai_recommendations')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('recommendations_description')}
              </p>
            </div>
            
            {analysisData.recommendations.length > 0 ? (
              <div className="space-y-4">
                {analysisData.recommendations.map((rec, index) => (
                  <div 
                    key={index} 
                    className={`rounded-lg border ${getSeverityColor(rec.severity)} p-4`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${getSeverityColor(rec.severity)} border-2 ${rec.severity === 'high' ? 'border-rose-300 dark:border-rose-700' : rec.severity === 'medium' ? 'border-amber-300 dark:border-amber-700' : 'border-emerald-300 dark:border-emerald-700'} flex-shrink-0`}>
                        {getTypeIcon(rec.type, 4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium ${getSeverityTextColor(rec.severity)}`}>
                            {t(rec.type)}
                          </h4>
                          <Badge variant="outline" className={getSeverityColor(rec.severity)}>
                            {rec.severity === 'high' ? t('high_priority') : 
                             rec.severity === 'medium' ? t('medium_priority') : 
                             rec.severity === 'low' ? t('low_priority') : t('info')}
                          </Badge>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">
                          {rec.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <h3 className="text-lg font-medium mb-1">{t('no_recommendations')}</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {t('no_recommendations_description')}
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="anomalies" className="mt-0">
            <div className="mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t('detected_anomalies')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('anomalies_description')}
              </p>
            </div>
            
            {analysisData.anomalies.length > 0 ? (
              <div className="space-y-4">
                {analysisData.anomalies.map((anomaly, index) => (
                  <div 
                    key={index} 
                    className={`rounded-lg border ${getSeverityColor(anomaly.severity)} p-4`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${getSeverityColor(anomaly.severity)} border-2 ${anomaly.severity === 'high' ? 'border-rose-300 dark:border-rose-700' : anomaly.severity === 'medium' ? 'border-amber-300 dark:border-amber-700' : 'border-emerald-300 dark:border-emerald-700'} flex-shrink-0`}>
                        {getTypeIcon(anomaly.type, 4)}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <h4 className={`font-medium ${getSeverityTextColor(anomaly.severity)}`}>
                              {t(anomaly.type)}
                            </h4>
                            <Badge variant="outline" className={getSeverityColor(anomaly.severity)}>
                              {anomaly.severity === 'high' ? t('high_severity') : 
                               anomaly.severity === 'medium' ? t('medium_severity') : t('low_severity')}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(anomaly.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mb-2">
                          {anomaly.details}
                        </p>
                        {anomaly.location && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">{t('location')}:</span> {anomaly.location.latitude.toFixed(6)}, {anomaly.location.longitude.toFixed(6)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <h3 className="text-lg font-medium mb-1">{t('no_anomalies')}</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {t('no_anomalies_description')}
                </p>
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-t p-4 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
          <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-500 dark:text-indigo-400" />
          {t('powered_by_ai')}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/50 w-full sm:w-auto"
          onClick={() => router.push('/ai-analysis')}
        >
          {t('view_detailed_analysis')}
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}