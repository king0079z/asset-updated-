import { useState, useEffect, useRef } from 'react';
import { fetchWithCache } from '@/lib/api-cache';
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

// Module-level currency formatter so it can be called outside the component
const formatCurrencyStatic = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(amount);

// Sentinel text that the server returns when ML computation times out
const TIMEOUT_SENTINELS = ['refresh to try again', 'try again in a moment', 'taking longer than expected'];
const isTimeoutFallback = (keyPoints: string[] = []) =>
  keyPoints.some(k => TIMEOUT_SENTINELS.some(s => k.toLowerCase().includes(s)));

export function AiAlerts({ className }: AiAlertsProps) {
  const [aiData, setAiData] = useState<AiAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isComputing, setIsComputing] = useState(false); // server is still running ML
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { t, dir } = useTranslation();

  const scheduleRetry = (delayMs: number) => {
    const seconds = Math.round(delayMs / 1000);
    setRetryCountdown(seconds);
    const tick = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) { clearInterval(tick); return 0; }
        return prev - 1;
      });
    }, 1000);
    retryTimerRef.current = setTimeout(() => {
      clearInterval(tick);
      fetchAiAnalysis();
    }, delayMs);
  };

  const buildAnalysisData = (data: any): AiAnalysisData => {
    const analysisData: AiAnalysisData = {
      recommendations: [],
      anomalies: { items: data.insights?.anomalies?.items || [] },
      optimizations: { items: data.insights?.optimizations?.items || [] },
      kitchenAnomalies: { items: data.insights?.kitchenAnomalies?.items || [] },
      assetDisposals: { items: data.insights?.assetDisposals?.items || [] },
      locationOverpurchasing: { items: data.insights?.locationOverpurchasing?.items || [] },
    };

    // Summary key points → info recommendations
    (data.insights?.summary?.keyPoints ?? []).forEach((point: string) => {
      analysisData.recommendations.push({ category: 'ai_insight', severity: 'info', message: point });
    });

    // Consumption anomalies
    (data.insights?.anomalies?.items ?? []).forEach((anomaly: Anomaly) => {
      analysisData.recommendations.push({
        category: 'consumption_anomaly',
        severity: anomaly.severity,
        message: `Unusual consumption detected for ${anomaly.name}: ${anomaly.causes?.[0] ?? 'see full analysis'}`,
      });
    });

    // Top 3 optimization opportunities
    (data.insights?.optimizations?.items ?? []).slice(0, 3).forEach((opt: Optimization) => {
      analysisData.recommendations.push({
        category: 'cost_optimization',
        severity: opt.yearlySavings > 1000 ? 'medium' : 'low',
        message: `Potential savings of ${formatCurrencyStatic(Number(opt.yearlySavings))}/year by optimizing ${opt.name} usage. ${opt.reason}`,
      });
    });

    // Kitchen consumption anomalies
    (data.insights?.kitchenAnomalies?.items ?? []).forEach((anomaly: KitchenAnomaly) => {
      const top = anomaly.details?.[0];
      analysisData.recommendations.push({
        category: 'kitchen_consumption',
        severity: anomaly.severity,
        message: top
          ? `Kitchen "${anomaly.name}" (Floor ${anomaly.floorNumber}) is consuming ${top.percentageAboveAvg} more ${top.foodName} than average.`
          : `Kitchen "${anomaly.name}" (Floor ${anomaly.floorNumber}) has unusual consumption patterns.`,
      });
    });

    // Asset disposals
    (data.insights?.assetDisposals?.items ?? []).forEach((disposal: AssetDisposal) => {
      analysisData.recommendations.push({
        category: 'asset_disposal',
        severity: disposal.severity,
        message: `Asset "${disposal.name}" worth ${formatCurrencyStatic(Number(disposal.purchaseAmount))} was disposed from Floor ${disposal.floorNumber}, Room ${disposal.roomNumber}.`,
      });
    });

    // Location overpurchasing
    (data.insights?.locationOverpurchasing?.items ?? []).forEach((location: LocationOverpurchasing) => {
      analysisData.recommendations.push({
        category: 'asset_overpurchasing',
        severity: location.severity,
        message: `${location.location} acquired ${location.recentPurchases} new assets recently, totaling ${formatCurrencyStatic(Number(location.totalValue))}.`,
      });
    });

    return analysisData;
  };

  const fetchAiAnalysis = async () => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setLoading(true);
    setError(null);
    setIsComputing(false);
    setRetryCountdown(0);

    try {
      const data = (await fetchWithCache('/api/ai-analysis/ml-predictions', {
        maxAge: 5 * 60 * 1000,
        timeoutMs: 30000,
      })) as any;

      const keyPoints: string[] = data?.insights?.summary?.keyPoints ?? [];

      // Server returned a timeout/fallback sentinel — ML is still computing.
      // Show a "computing" state and auto-retry after 12 seconds.
      if (data?._computing || isTimeoutFallback(keyPoints)) {
        setLoading(false);
        setIsComputing(true);
        scheduleRetry(12000);
        return;
      }

      // Happy path — build rich analysis data
      const analysisData = buildAnalysisData(data);
      setAiData(analysisData);
      setLastUpdated(new Date());
      setIsComputing(false);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Request was cancelled — don't change state
        setLoading(false);
        return;
      }
      console.error('Error fetching AI analysis:', err);
      // Show meaningful fallback data (no error state, so the card stays useful)
      setAiData({
        recommendations: [
          { category: 'ai_insight', severity: 'info', message: 'AI analysis is warming up. Your insights will appear shortly — check back in a moment.' },
          { category: 'budget_planning', severity: 'info', message: 'Track your asset spending trends in the Full Analysis page for detailed predictions.' },
        ],
        anomalies: { items: [] },
        optimizations: { items: [] },
        kitchenAnomalies: { items: [] },
        assetDisposals: { items: [] },
        locationOverpurchasing: { items: [] },
      });
      setLastUpdated(new Date());
      setIsComputing(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiAnalysis();
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
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

  const formatCurrency = (amount: number) => formatCurrencyStatic(amount);

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

  const AiCardHeader = ({ showRefresh = true }: { showRefresh?: boolean }) => (
    <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 pb-3 pt-4">
      <div className="flex justify-between items-center">
        <CardTitle className="text-white text-lg flex items-center">
          <Sparkles className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
          {t('ai_insights_alerts')}
        </CardTitle>
        {showRefresh && (
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={fetchAiAnalysis}>
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </CardHeader>
  );

  if (loading) {
    return (
      <Card className={`border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
        <AiCardHeader showRefresh={false} />
        <CardContent className="p-5">
          <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-800 border-opacity-50" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
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

  // Server-side ML computation in progress — show a polished "computing" state with countdown
  if (isComputing) {
    return (
      <Card className={`border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
        <AiCardHeader />
        <CardContent className="p-5">
          <div className="flex flex-col items-center justify-center h-[300px] space-y-5 text-center">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-800/60" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-violet-500 animate-spin" />
              <Brain className="absolute inset-0 m-auto h-8 w-8 text-indigo-500 animate-pulse" />
            </div>
            <div>
              <p className="text-base font-semibold text-indigo-700 dark:text-indigo-300">AI is analyzing your data</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Machine learning models are processing your enterprise data.
              </p>
              {retryCountdown > 0 && (
                <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2 font-medium">
                  Auto-refreshing in {retryCountdown}s…
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchAiAnalysis} className="flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300">
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh now
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push('/ai-analysis')} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400">
                Full Analysis
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-t border-indigo-100 dark:border-indigo-800/50 p-3">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-indigo-400" />
            {t('powered_by_ml')}
          </p>
        </CardFooter>
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
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={fetchAiAnalysis}>
                  <RefreshCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{t('refresh_insights')}</p></TooltipContent>
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