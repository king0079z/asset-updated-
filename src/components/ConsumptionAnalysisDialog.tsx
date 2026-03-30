import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart3, Calendar, TrendingUp, TrendingDown, DollarSign,
  LineChart, AlertTriangle, Info, Brain, Sparkles, Utensils,
  Package, Car, ArrowUpRight, ArrowDownRight, Minus, Target,
  ChevronRight, Zap, Shield, Activity
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChartJSBar } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PrintConsumptionReportButton } from "./PrintConsumptionReportButton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";

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
  vehicleMaintenanceCosts?: number;
  vehicleTotal?: number;
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR', maximumFractionDigits: 0 }).format(n);

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

const momChange = (current: number, previous: number) => {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

// ── Component ──────────────────────────────────────────────────────────────────
export function ConsumptionAnalysisDialog({ open, onOpenChange }: ConsumptionAnalysisProps) {
  const { t, dir } = useTranslation();
  const [loading, setLoading]               = useState(false);
  const [monthlyData, setMonthlyData]       = useState<MonthlyConsumption[]>([]);
  const [forecastData, setForecastData]     = useState<ForecastData[]>([]);
  const [categoryForecasts, setCategoryForecasts] = useState<CategoryForecast[]>([]);
  const [error, setError]                   = useState<string | null>(null);
  const [isMlForecast, setIsMlForecast]     = useState(false);

  const isMobile = useMediaQuery('(max-width: 640px)');

  useEffect(() => { if (open) loadConsumptionData(); }, [open]);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadConsumptionData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/total-spent?includeMonthly=true');
      if (!response.ok) throw new Error('Failed to load consumption data');
      const data = await response.json();
      const monthly: MonthlyConsumption[] = data.monthlyData || [];
      setMonthlyData(monthly);

      let budgetPredictions: any[] = [];
      try {
        const mlResponse = await fetch('/api/ai-analysis/ml-predictions');
        if (mlResponse.ok) {
          const mlData = await mlResponse.json();
          budgetPredictions = mlData?.mlAnalysis?.budgetPredictions ?? [];
        }
      } catch { /* fall through */ }

      let forecasts = transformBudgetPredictions(budgetPredictions, monthly);
      const usedMl = forecasts.length > 0;
      if (!usedMl && monthly.length >= 2) forecasts = generateTrendForecasts(monthly);
      setIsMlForecast(usedMl);
      setForecastData(forecasts);
      setCategoryForecasts(generateCategoryForecasts(forecasts, monthly));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // ── Forecast generation ───────────────────────────────────────────────────────
  const generateTrendForecasts = (historicalData: MonthlyConsumption[]): ForecastData[] => {
    if (!historicalData || historicalData.length < 2) return [];
    const n = historicalData.length;
    const sumX  = (n * (n - 1)) / 2;
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumY  = historicalData.reduce((s, d) => s + d.total, 0);
    const sumXY = historicalData.reduce((s, d, i) => s + i * d.total, 0);
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const predictedAmount = Math.max(0, intercept + slope * (n + i));
      const margin = predictedAmount * 0.15;
      return {
        month: d.toLocaleString('default', { month: 'long' }),
        year: d.getFullYear(),
        predictedAmount,
        upperBound: predictedAmount + margin,
        lowerBound: Math.max(0, predictedAmount - margin),
        confidence: Math.max(0.55, Math.min(0.80, 0.75 - i * 0.03)),
      };
    });
  };

  const transformBudgetPredictions = (budgetPredictions: any[], historicalData: MonthlyConsumption[]) => {
    if (!budgetPredictions?.length || !historicalData?.length) return [];
    const now = new Date();
    return Array.from({ length: 6 }, (_, idx) => {
      const i = idx + 1;
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const closest = budgetPredictions.reduce((p, c) =>
        Math.abs(c.months - i) < Math.abs(p.months - i) ? c : p, budgetPredictions[0]);
      const adj = 1 - Math.abs(closest.months - i) * 0.05;
      const fd: any = {
        month: d.toLocaleString('default', { month: 'long' }),
        year: d.getFullYear(),
        predictedAmount: closest.prediction.predictedAmount * adj,
        upperBound:      closest.prediction.upperBound * adj,
        lowerBound:      closest.prediction.lowerBound * adj,
        confidence:      closest.prediction.confidence,
      };
      if (closest.categoryPredictions) {
        fd.categoryPredictions = {
          food: { ...closest.categoryPredictions.food,
            predictedAmount: closest.categoryPredictions.food.predictedAmount * adj },
          vehicleRental: { ...closest.categoryPredictions.vehicleRental },
        };
      }
      return fd;
    });
  };

  const generateCategoryForecasts = (forecasts: ForecastData[], historicalData: MonthlyConsumption[]): CategoryForecast[] => {
    if (!forecasts?.length || !historicalData?.length) return [];
    const totalFood    = historicalData.reduce((s, m) => s + m.foodConsumption, 0);
    const totalAssets  = historicalData.reduce((s, m) => s + m.assetsPurchased, 0);
    const totalVehicle = historicalData.reduce((s, m) => s + m.vehicleRentalCosts, 0);
    const totalSpent   = totalFood + totalAssets + totalVehicle;
    const foodProp   = totalSpent > 0 ? totalFood   / totalSpent : 0.33;
    const assetProp  = totalSpent > 0 ? totalAssets / totalSpent : 0.33;
    const lastVehicle = historicalData[historicalData.length - 1].vehicleRentalCosts;
    return forecasts.map(f => {
      const ml = f as any;
      if (ml.categoryPredictions) {
        return {
          month: f.month, year: f.year,
          vehicleRentalCosts: ml.categoryPredictions.vehicleRental.predictedAmount,
          foodConsumption:    ml.categoryPredictions.food.predictedAmount * 0.7,
          assetsPurchased:    ml.categoryPredictions.food.predictedAmount * 0.3,
          total: f.predictedAmount, confidence: f.confidence,
        };
      }
      const remaining = f.predictedAmount - lastVehicle;
      return {
        month: f.month, year: f.year,
        vehicleRentalCosts: lastVehicle,
        foodConsumption:  remaining * (foodProp  / (foodProp + assetProp)),
        assetsPurchased:  remaining * (assetProp / (foodProp + assetProp)),
        total: f.predictedAmount, confidence: f.confidence,
      };
    });
  };

  // ── Derived analytics ─────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (!monthlyData.length) return null;
    const ytdFood    = monthlyData.reduce((s, m) => s + m.foodConsumption, 0);
    const ytdAssets  = monthlyData.reduce((s, m) => s + m.assetsPurchased, 0);
    const ytdVehicle = monthlyData.reduce((s, m) => s + m.vehicleRentalCosts, 0);
    const ytdTotal   = monthlyData.reduce((s, m) => s + m.total, 0);
    const avgMonthly = ytdTotal / monthlyData.length;
    const peakMonth  = [...monthlyData].sort((a, b) => b.total - a.total)[0];
    const lastMonth  = monthlyData[monthlyData.length - 1];
    const prevMonth  = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;
    const momDelta   = prevMonth ? momChange(lastMonth.total, prevMonth.total) : null;
    const forecastTotal = categoryForecasts.reduce((s, f) => s + f.total, 0);
    const avgConf = categoryForecasts.length
      ? categoryForecasts.reduce((s, f) => s + f.confidence, 0) / categoryForecasts.length
      : 0;
    return {
      ytdTotal, ytdFood, ytdAssets, ytdVehicle,
      avgMonthly, peakMonth, lastMonth, prevMonth, momDelta,
      forecastTotal, avgConf,
    };
  }, [monthlyData, categoryForecasts]);

  // ── Chart data ────────────────────────────────────────────────────────────────
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: (isMobile ? 'bottom' : 'top') as const,
        labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle' as const, font: { size: isMobile ? 10 : 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, stacked: false,
        ticks: { font: { size: isMobile ? 9 : 11 }, maxRotation: isMobile ? 45 : 0 } },
      y: { beginAtZero: true,
        ticks: { callback: (v: any) => fmt(v).replace('QAR ', '').replace(',000', 'k'), font: { size: isMobile ? 9 : 11 } } },
    },
  }), [isMobile]);

  const monthlyChartData = useMemo(() => {
    if (!monthlyData.length) return null;
    return {
      labels: monthlyData.map(m => m.month.slice(0, 3)),
      datasets: [
        { label: 'Food', data: monthlyData.map(m => m.foodConsumption),
          backgroundColor: 'rgba(16,185,129,0.75)', borderColor: 'rgb(16,185,129)', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Assets', data: monthlyData.map(m => m.assetsPurchased),
          backgroundColor: 'rgba(99,102,241,0.75)', borderColor: 'rgb(99,102,241)', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Vehicles', data: monthlyData.map(m => m.vehicleRentalCosts),
          backgroundColor: 'rgba(245,158,11,0.75)', borderColor: 'rgb(245,158,11)', borderWidth: 1.5, borderRadius: 4 },
      ],
    };
  }, [monthlyData]);

  const forecastChartData = useMemo(() => {
    if (!categoryForecasts.length) return null;
    return {
      labels: categoryForecasts.map(f => f.month.slice(0, 3)),
      datasets: [
        { label: 'Food', data: categoryForecasts.map(f => f.foodConsumption),
          backgroundColor: 'rgba(16,185,129,0.75)', borderColor: 'rgb(16,185,129)', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Assets', data: categoryForecasts.map(f => f.assetsPurchased),
          backgroundColor: 'rgba(99,102,241,0.75)', borderColor: 'rgb(99,102,241)', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Vehicles', data: categoryForecasts.map(f => f.vehicleRentalCosts),
          backgroundColor: 'rgba(245,158,11,0.75)', borderColor: 'rgb(245,158,11)', borderWidth: 1.5, borderRadius: 4 },
      ],
    };
  }, [categoryForecasts]);

  // ── Rendering helpers ─────────────────────────────────────────────────────────
  const TrendArrow = ({ delta }: { delta: number | null }) => {
    if (delta === null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
    if (delta > 0) return <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />;
    return <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" />;
  };

  const ConfBadge = ({ conf }: { conf: number }) => {
    const pctVal = Math.round(conf * 100);
    const cls = conf >= 0.80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : conf >= 0.65 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cls}`}>{pctVal}% conf.</span>;
  };

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <Brain className="absolute inset-0 m-auto h-5 w-5 text-primary animate-pulse" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Analysing enterprise data…</p>
    </div>
  );

  const ErrorState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="font-semibold">Failed to load data</p>
      <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
      <Button variant="outline" size="sm" onClick={loadConsumptionData}>Retry</Button>
    </div>
  );

  // ── KPI Hero ──────────────────────────────────────────────────────────────────
  const KpiHero = () => {
    if (!analytics) return null;
    const cards = [
      {
        label: 'YTD Total',
        value: fmt(analytics.ytdTotal),
        sub: `${monthlyData.length} months recorded`,
        icon: <DollarSign className="h-4 w-4" />,
        color: 'from-violet-500 to-purple-600',
        light: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
      },
      {
        label: 'Avg / Month',
        value: fmt(analytics.avgMonthly),
        sub: analytics.momDelta !== null
          ? `${analytics.momDelta > 0 ? '+' : ''}${analytics.momDelta.toFixed(1)}% vs last month`
          : 'Based on all months',
        icon: <Activity className="h-4 w-4" />,
        color: 'from-sky-500 to-blue-600',
        light: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300',
        trend: analytics.momDelta,
      },
      {
        label: 'Peak Month',
        value: analytics.peakMonth.month.slice(0, 3),
        sub: fmt(analytics.peakMonth.total),
        icon: <Target className="h-4 w-4" />,
        color: 'from-rose-500 to-pink-600',
        light: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
      },
      {
        label: '6-Mo Forecast',
        value: analytics.forecastTotal > 0 ? fmt(analytics.forecastTotal) : '—',
        sub: analytics.forecastTotal > 0
          ? `${Math.round(analytics.avgConf * 100)}% avg. confidence`
          : 'Insufficient data',
        icon: isMlForecast ? <Brain className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />,
        color: 'from-emerald-500 to-teal-600',
        light: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
      },
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {cards.map((c, i) => (
          <div key={i} className="relative rounded-xl overflow-hidden border border-border/50 bg-card shadow-sm">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.color}`} />
            <div className="p-3 pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`p-1 rounded-md ${c.light}`}>{c.icon}</span>
                {'trend' in c && c.trend !== undefined && (
                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${
                    c.trend === null ? 'text-muted-foreground'
                    : c.trend > 0 ? 'text-red-500' : 'text-emerald-500'
                  }`}>
                    <TrendArrow delta={c.trend ?? null} />
                    {c.trend !== null && `${Math.abs(c.trend).toFixed(1)}%`}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-2">{c.label}</p>
              <p className="text-sm sm:text-base font-bold truncate">{c.value}</p>
              <p className="text-xs text-muted-foreground truncate">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Category pill row ─────────────────────────────────────────────────────────
  const CategoryPills = ({ food, assets, vehicle, total }: { food: number; assets: number; vehicle: number; total: number }) => (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'Food', val: food, pctVal: pct(food, total), icon: <Utensils className="h-3.5 w-3.5" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
        { label: 'Assets', val: assets, pctVal: pct(assets, total), icon: <Package className="h-3.5 w-3.5" />, bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500' },
        { label: 'Vehicles', val: vehicle, pctVal: pct(vehicle, total), icon: <Car className="h-3.5 w-3.5" />, bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
      ].map(c => (
        <div key={c.label} className={`rounded-xl p-3 ${c.bg}`}>
          <div className={`flex items-center gap-1.5 ${c.text} mb-2`}>
            {c.icon}
            <span className="text-xs font-semibold">{c.label}</span>
            <span className="ml-auto text-xs opacity-70">{c.pctVal}%</span>
          </div>
          <p className={`text-sm font-bold ${c.text}`}>{fmt(c.val)}</p>
          <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${c.pctVal}%` }} />
          </div>
        </div>
      ))}
    </div>
  );

  // ── Month card ────────────────────────────────────────────────────────────────
  const MonthCard = ({ month, prev, isPeak }: { month: MonthlyConsumption; prev?: MonthlyConsumption; isPeak: boolean }) => {
    const delta = prev ? momChange(month.total, prev.total) : null;
    return (
      <Card className={`overflow-hidden border ${isPeak ? 'border-rose-200 dark:border-rose-800/50' : 'border-border/50'} shadow-sm`}>
        <div className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPeak ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-muted text-muted-foreground'}`}>
                {isPeak ? '🔥 Peak' : month.month.slice(0, 3)}
              </span>
              <span className="font-semibold text-sm">{month.month} {month.year}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {delta !== null && (
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  <TrendArrow delta={delta} />
                  {Math.abs(delta).toFixed(1)}%
                </span>
              )}
              <Badge variant="secondary" className="font-bold text-xs">{fmt(month.total)}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { label: 'Food', val: month.foodConsumption, bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Assets', val: month.assetsPurchased, bar: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Vehicles', val: month.vehicleRentalCosts, bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
            ].map(row => (
              <div key={row.label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${row.bar} inline-block`} />
                    {row.label}
                  </span>
                  <span className={`font-semibold ${row.text}`}>{fmt(row.val)}</span>
                </div>
                <Progress value={pct(row.val, month.total)} className="h-1.5" indicatorClassName={row.bar} />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  };

  // ── Forecast card ─────────────────────────────────────────────────────────────
  const ForecastCard = ({ forecast, index, lastActual }: { forecast: CategoryForecast; index: number; lastActual?: MonthlyConsumption }) => {
    const vsActual = lastActual ? momChange(forecast.total, lastActual.total) : null;
    return (
      <Card className={`overflow-hidden border border-border/50 shadow-sm ${index === 0 ? 'ring-1 ring-primary/20' : ''}`}>
        <div className={`h-1 ${index === 0 ? 'bg-gradient-to-r from-primary to-violet-500' : 'bg-gradient-to-r from-muted to-muted/50'}`} />
        <div className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {index === 0 && <Zap className="h-3.5 w-3.5 text-primary" />}
              <span className="font-semibold text-sm">{forecast.month} {forecast.year}</span>
              {index === 0 && <Badge variant="outline" className="text-xs py-0">Next</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <ConfBadge conf={forecast.confidence} />
              <Badge variant={index === 0 ? 'default' : 'secondary'} className="font-bold text-xs">{fmt(forecast.total)}</Badge>
            </div>
          </div>

          {vsActual !== null && (
            <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 ${vsActual > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
              <TrendArrow delta={vsActual} />
              <span>{vsActual > 0 ? '+' : ''}{vsActual.toFixed(1)}% vs last actual month</span>
            </div>
          )}

          <div className="space-y-2">
            {[
              { label: 'Food Consumption', val: forecast.foodConsumption, bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Assets Purchased', val: forecast.assetsPurchased, bar: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Vehicle Costs', val: forecast.vehicleRentalCosts, bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
            ].map(row => (
              <div key={row.label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${row.bar} inline-block`} />
                    {row.label}
                  </span>
                  <span className={`font-semibold ${row.text}`}>{fmt(row.val)}</span>
                </div>
                <Progress value={pct(row.val, forecast.total)} className="h-1.5" indicatorClassName={row.bar} />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const peakMonthKey = analytics
    ? `${analytics.peakMonth.month}-${analytics.peakMonth.year}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isMobile ? 'w-[96vw] max-w-[96vw]' : 'sm:max-w-[960px]'} overflow-hidden p-0`}
        showFullscreenButton
        showPrintButton={!loading && !error && monthlyData.length > 0}
        showShareButton={!loading && !error && monthlyData.length > 0}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-primary/10 via-background to-violet-500/5 border-b px-4 sm:px-6 pt-5 pb-4">
          <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
          <DialogHeader className="relative mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Enterprise Consumption Dashboard
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Year-to-date spending analysis with 6-month forward projection
                </DialogDescription>
              </div>
              {!isMobile && !loading && !error && monthlyData.length > 0 && categoryForecasts.length > 0 && (
                <div className="ml-auto">
                  <PrintConsumptionReportButton monthlyData={monthlyData} categoryForecasts={categoryForecasts} />
                </div>
              )}
            </div>
          </DialogHeader>

          {/* KPI Hero row */}
          {!loading && !error && <KpiHero />}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[90px] rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 pb-4">
          <Tabs defaultValue="monthly" className="w-full" dir={dir}>
            <TabsList className="grid w-full grid-cols-2 mt-4 mb-4 h-10">
              <TabsTrigger value="monthly" className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                Monthly Breakdown
              </TabsTrigger>
              <TabsTrigger value="forecast" className="flex items-center gap-1.5 text-sm">
                {isMlForecast ? <Brain className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {isMlForecast ? 'ML Forecast' : 'Trend Forecast'}
                {!loading && categoryForecasts.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-1 ${isMlForecast ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {isMlForecast ? 'ML' : 'Trend'}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ══ MONTHLY BREAKDOWN TAB ══════════════════════════════════ */}
            <TabsContent value="monthly" className="m-0">
              {loading ? <LoadingState /> : error ? <ErrorState /> : monthlyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-semibold">No consumption data yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Start recording food, assets, or vehicle expenses to see your monthly breakdown.
                  </p>
                </div>
              ) : (
                <ScrollArea className={`${isMobile ? 'h-[460px]' : 'h-[480px]'} pr-1`}>
                  <div className="space-y-4 pb-2">

                    {/* Category totals */}
                    {analytics && (
                      <CategoryPills
                        food={analytics.ytdFood}
                        assets={analytics.ytdAssets}
                        vehicle={analytics.ytdVehicle}
                        total={analytics.ytdTotal}
                      />
                    )}

                    {/* Chart */}
                    <Card className="border-border/50 shadow-sm">
                      <CardHeader className="pb-1 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">Spending by Month</CardTitle>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/>Food</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block"/>Assets</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block"/>Vehicles</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <div className={`${isMobile ? 'h-[200px]' : 'h-[240px]'}`}>
                          {monthlyChartData && <ChartJSBar data={monthlyChartData} options={chartOptions} />}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Insights strip */}
                    {analytics && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {[
                          { label: 'Highest category', value: analytics.ytdFood >= analytics.ytdAssets && analytics.ytdFood >= analytics.ytdVehicle ? '🍽️ Food' : analytics.ytdAssets >= analytics.ytdVehicle ? '📦 Assets' : '🚗 Vehicles' },
                          { label: 'Monthly avg.', value: fmt(analytics.avgMonthly) },
                          { label: analytics.momDelta !== null ? 'Month-over-month' : 'Months tracked', value: analytics.momDelta !== null ? `${analytics.momDelta > 0 ? '+' : ''}${analytics.momDelta.toFixed(1)}%` : `${monthlyData.length}` },
                        ].map(item => (
                          <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-2">
                            <p className="text-muted-foreground">{item.label}</p>
                            <p className="font-semibold mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Month-by-month cards */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Month Detail
                      </p>
                      <div className="grid gap-2.5">
                        {[...monthlyData].reverse().map((month, i) => (
                          <MonthCard
                            key={`${month.month}-${month.year}`}
                            month={month}
                            prev={monthlyData[monthlyData.length - i - 2]}
                            isPeak={`${month.month}-${month.year}` === peakMonthKey}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* ══ FORECAST TAB ══════════════════════════════════════════ */}
            <TabsContent value="forecast" className="m-0">
              {loading ? <LoadingState /> : error ? <ErrorState /> : categoryForecasts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-semibold">Forecast unavailable</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {monthlyData.length < 2
                      ? 'At least 2 months of spending data are needed. Record food, assets, or vehicle expenses to unlock forecasting.'
                      : 'Could not generate forecasts from the available data.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={loadConsumptionData}>Retry</Button>
                </div>
              ) : (
                <ScrollArea className={`${isMobile ? 'h-[460px]' : 'h-[480px]'} pr-1`}>
                  <div className="space-y-4 pb-2">

                    {/* Model badge + 6-month totals */}
                    {analytics && analytics.forecastTotal > 0 && (
                      <div className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 to-violet-500/5 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {isMlForecast
                              ? <Brain className="h-4 w-4 text-violet-500" />
                              : <TrendingUp className="h-4 w-4 text-blue-500" />}
                            <span className="font-semibold text-sm">
                              {isMlForecast ? 'Machine Learning Forecast' : 'Trend-Based Forecast'}
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  {isMlForecast
                                    ? 'Generated by ML models trained on your historical spending, vehicle rentals, and asset purchases.'
                                    : 'Generated using linear regression on your monthly spending history. ML forecasts activate with more data.'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <ConfBadge conf={analytics.avgConf} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">6-Month Total Projection</p>
                            <p className="text-xl font-bold">{fmt(analytics.forecastTotal)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Avg. Monthly Projection</p>
                            <p className="text-xl font-bold">{fmt(analytics.forecastTotal / categoryForecasts.length)}</p>
                          </div>
                        </div>
                        {analytics.lastMonth && (
                          <div className="mt-3 pt-3 border-t border-border/30">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Last actual: <strong>{analytics.lastMonth.month}</strong> — {fmt(analytics.lastMonth.total)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Forecast category totals */}
                    {analytics && (
                      <CategoryPills
                        food={categoryForecasts.reduce((s, f) => s + f.foodConsumption, 0)}
                        assets={categoryForecasts.reduce((s, f) => s + f.assetsPurchased, 0)}
                        vehicle={categoryForecasts.reduce((s, f) => s + f.vehicleRentalCosts, 0)}
                        total={analytics.forecastTotal}
                      />
                    )}

                    {/* Forecast chart */}
                    <Card className="border-border/50 shadow-sm">
                      <CardHeader className="pb-1 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">6-Month Projected Spend</CardTitle>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/>Food</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block"/>Assets</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block"/>Vehicles</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <div className={`${isMobile ? 'h-[200px]' : 'h-[240px]'}`}>
                          {forecastChartData && <ChartJSBar data={forecastChartData} options={chartOptions} />}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Month-by-month forecast cards */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5" /> Monthly Projections
                      </p>
                      <div className="grid gap-2.5">
                        {categoryForecasts.map((forecast, index) => (
                          <ForecastCard
                            key={`${forecast.month}-${forecast.year}`}
                            forecast={forecast}
                            index={index}
                            lastActual={analytics?.lastMonth}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
