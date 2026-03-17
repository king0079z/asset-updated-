// @ts-nocheck
/**
 * KitchenConsumptionAnalysisTab — World-class kitchen analytics with AI insights.
 * Displays per-kitchen metrics, cross-kitchen comparison, ingredient usage, recipe
 * profitability, waste analysis, and rule-based AI recommendations.
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChefHat, TrendingUp, TrendingDown, Trash2, DollarSign, Utensils,
  Brain, Sparkles, RefreshCcw, AlertTriangle, CheckCircle2, Info,
  BarChart3, Zap, Flame, Leaf, Activity, ArrowRight, Target,
  ShoppingCart, Star, Package, Clock, Award,
} from "lucide-react";
import { PrintKitchenConsumptionReportButton } from "@/components/PrintKitchenConsumptionReportButton";
import { PrintAllKitchenConsumptionReportButton } from "@/components/PrintAllKitchenConsumptionReportButton";

/* ── Types ────────────────────────────────────────────────────────────────── */
type Kitchen = { id: string; name: string };
type IngredientUsage = { name: string; totalUsed: number; unit: string };
type RecipeUsageSummary = {
  recipeId: string; recipeName: string; totalServings: number;
  totalCost: number; totalSellingPrice: number; totalProfit: number; totalWaste: number;
};
type KitchenAnalytics = {
  kitchen: Kitchen;
  totalConsumption: number; totalWaste: number; totalWasteCost?: number;
  totalCost: number; totalSellingPrice: number; totalProfit: number;
  wasteByExpiration: number; wasteByExpirationCost?: number;
  wasteByIngredient: number; wasteByIngredientCost?: number;
  mostUsedIngredients: IngredientUsage[];
  leastUsedIngredients: IngredientUsage[];
  recipes: RecipeUsageSummary[];
};
type AiInsight = {
  id: string; severity: 'critical' | 'warning' | 'info' | 'success';
  title: string; message: string; icon?: string;
};

/* ── AI insight generator (rule-based, instant) ───────────────────────────── */
function generateAiInsights(all: KitchenAnalytics[]): AiInsight[] {
  const insights: AiInsight[] = [];
  if (!all.length) return insights;

  const totalWaste = all.reduce((s, a) => s + a.totalWaste, 0);
  const totalConsumption = all.reduce((s, a) => s + a.totalConsumption, 0);
  const totalCost = all.reduce((s, a) => s + a.totalCost, 0);
  const totalWasteCost = all.reduce((s, a) => s + (a.totalWasteCost ?? 0), 0);
  const totalProfit = all.reduce((s, a) => s + a.totalProfit, 0);
  const wasteRatio = totalConsumption > 0 ? (totalWaste / totalConsumption) * 100 : 0;
  const wasteCostRatio = totalCost > 0 ? (totalWasteCost / totalCost) * 100 : 0;

  // 1. Waste rate
  if (wasteRatio >= 20) {
    insights.push({ id: 'waste-critical', severity: 'critical',
      title: `Critical Waste Rate — ${wasteRatio.toFixed(1)}%`,
      message: `${wasteRatio.toFixed(1)}% of all food consumed is wasted (QAR ${totalWasteCost.toFixed(0)} lost). Immediate intervention required: audit FIFO procedures and review batch sizing across all kitchens.`,
      icon: 'waste' });
  } else if (wasteRatio >= 10) {
    insights.push({ id: 'waste-warning', severity: 'warning',
      title: `Elevated Waste Rate — ${wasteRatio.toFixed(1)}%`,
      message: `Waste is at ${wasteRatio.toFixed(1)}%, above the 10% benchmark. Review expiry-driven waste (QAR ${all.reduce((s, a) => s + (a.wasteByExpirationCost ?? 0), 0).toFixed(0)}) — consider ordering smaller, more frequent batches.`,
      icon: 'waste' });
  } else {
    insights.push({ id: 'waste-ok', severity: 'success',
      title: `Excellent Waste Management — ${wasteRatio.toFixed(1)}%`,
      message: `Waste is below the 10% industry benchmark. All kitchens are performing well on inventory management.`,
      icon: 'ok' });
  }

  // 2. Profitability
  if (totalProfit < 0) {
    insights.push({ id: 'profit-neg', severity: 'critical',
      title: 'Operations Running at a Loss',
      message: `Total operations show a deficit of QAR ${Math.abs(totalProfit).toFixed(2)}. Review recipe selling prices and ingredient costs immediately.`,
      icon: 'profit' });
  } else if (totalProfit > 0 && totalCost > 0) {
    const margin = (totalProfit / (totalCost + totalProfit)) * 100;
    insights.push({ id: 'profit-ok', severity: margin > 20 ? 'success' : 'info',
      title: `Profit Margin — ${margin.toFixed(1)}%`,
      message: `Total profit is QAR ${totalProfit.toFixed(2)} on revenue of QAR ${(totalCost + totalProfit).toFixed(2)}. ${margin > 20 ? 'Excellent margin — maintain current pricing strategy.' : 'Consider optimising high-cost recipes to improve margins.'}`,
      icon: 'profit' });
  }

  // 3. Waste cost impact
  if (wasteCostRatio > 15) {
    insights.push({ id: 'waste-cost', severity: 'warning',
      title: `Waste Consuming ${wasteCostRatio.toFixed(0)}% of Food Budget`,
      message: `QAR ${totalWasteCost.toFixed(0)} in food waste represents ${wasteCostRatio.toFixed(0)}% of total food costs. A 50% reduction in waste could save QAR ${(totalWasteCost * 0.5).toFixed(0)} annually.`,
      icon: 'cost' });
  }

  // 4. Best and worst kitchen
  if (all.length > 1) {
    const best = [...all].sort((a, b) => b.totalProfit - a.totalProfit)[0];
    const worst = [...all].sort((a, b) => a.totalProfit - b.totalProfit)[0];
    if (best.kitchen.id !== worst.kitchen.id) {
      insights.push({ id: 'kitchen-gap', severity: 'info',
        title: `Best vs Worst: QAR ${Math.abs(best.totalProfit - worst.totalProfit).toFixed(0)} Profitability Gap`,
        message: `${best.kitchen.name} leads with QAR ${best.totalProfit.toFixed(0)} profit. ${worst.kitchen.name} lags at QAR ${worst.totalProfit.toFixed(0)}. Review ${worst.kitchen.name}'s top 3 waste items and recipe pricing.`,
        icon: 'compare' });
    }
  }

  // 5. Expiry-driven waste
  const expiryWaste = all.reduce((s, a) => s + (a.wasteByExpirationCost ?? 0), 0);
  if (expiryWaste > 100) {
    insights.push({ id: 'expiry', severity: 'warning',
      title: `QAR ${expiryWaste.toFixed(0)} Lost to Expired Items`,
      message: `Expiry-related waste accounts for QAR ${expiryWaste.toFixed(0)}. Implement a first-expiry-first-out policy and set up low-stock alerts at 30% of par level.`,
      icon: 'expiry' });
  }

  if (insights.length === 0) {
    insights.push({ id: 'all-good', severity: 'success',
      title: 'All Kitchen Metrics Healthy',
      message: 'No critical issues detected. All kitchens are operating within acceptable ranges for waste, cost, and profitability.', icon: 'ok' });
  }

  return insights;
}

/* ── Mini bar chart (SVG-based, no external lib) ─────────────────────────── */
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 6; const gap = 3;
  return (
    <svg width={data.length * (w + gap) - gap} height={32} style={{ overflow: 'visible' }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * 30);
        return <rect key={i} x={i * (w + gap)} y={32 - h} width={w} height={h}
          rx={2} fill={color} opacity={i === data.length - 1 ? 1 : 0.55} />;
      })}
    </svg>
  );
}

/* ── Gradient stat card ────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, grad, trend, trendUp }: {
  icon: any; label: string; value: string; sub?: string;
  grad: string; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${grad}`}>
      <div className="absolute top-2 right-3 opacity-10">
        <Icon className="h-12 w-12 text-white" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">{label}</span>
        </div>
        <div className="text-2xl font-black text-white tracking-tight leading-none mb-1">{value}</div>
        {(sub || trend) && (
          <div className="flex items-center gap-1.5 mt-1">
            {trend && (
              <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trendUp ? 'text-emerald-200' : 'text-red-200'}`}>
                {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend}
              </span>
            )}
            {sub && <span className="text-[10px] text-white/60">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Section header ────────────────────────────────────────────────────────── */
function SectionHdr({ icon: Icon, title, badge, color = "indigo" }: {
  icon: any; title: string; badge?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
    red: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
  };
  const cls = colors[color] ?? colors.indigo;
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-bold">{title}</h3>
      {badge && (
        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-muted-foreground ml-auto">
          {badge}
        </span>
      )}
    </div>
  );
}

/* ── AI insight card ───────────────────────────────────────────────────────── */
function InsightCard({ insight }: { insight: AiInsight }) {
  const styles = {
    critical: { border: 'border-red-200 dark:border-red-800', bg: 'bg-red-50 dark:bg-red-950/30', icon: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/50', label: 'CRITICAL', labelColor: 'text-red-700 dark:text-red-400' },
    warning:  { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/30', icon: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/50', label: 'WARNING', labelColor: 'text-amber-700 dark:text-amber-400' },
    info:     { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/50', label: 'INSIGHT', labelColor: 'text-blue-700 dark:text-blue-400' },
    success:  { border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50', label: 'HEALTHY', labelColor: 'text-emerald-700 dark:text-emerald-400' },
  };
  const s = styles[insight.severity];
  const IconComp = insight.severity === 'critical' ? AlertTriangle
    : insight.severity === 'warning' ? AlertTriangle
    : insight.severity === 'success' ? CheckCircle2 : Info;

  return (
    <div className={`rounded-xl border p-3.5 ${s.border} ${s.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
          <IconComp className={`h-4 w-4 ${s.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-black uppercase tracking-widest ${s.labelColor}`}>{s.label}</span>
          </div>
          <p className="text-sm font-bold text-foreground leading-snug mb-1">{insight.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{insight.message}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-muted" />)}
      </div>
      <div className="h-48 rounded-2xl bg-muted" />
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────────── */
export function KitchenConsumptionAnalysisTab() {
  const { t } = useTranslation();
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, KitchenAnalytics>>({});
  const [aiData, setAiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeKitchenId, setActiveKitchenId] = useState<string | null>(null);
  const [view, setView] = useState<'kitchen' | 'compare'>('kitchen');
  const [refreshKey, setRefreshKey] = useState(0);

  /* ── Fetch kitchens ─────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/kitchens")
      .then(r => r.json())
      .then(data => {
        setKitchens(data);
        if (data.length > 0) setActiveKitchenId(data[0].id);
      });
  }, []);

  /* ── Fetch analytics for active kitchen ─────────────────────────────────── */
  useEffect(() => {
    if (!activeKitchenId) return;
    if (analyticsMap[activeKitchenId] && refreshKey === 0) { setLoading(false); return; }
    setLoading(true);

    fetch(`/api/kitchens/consumption-details?kitchenId=${activeKitchenId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const months = data.monthlyConsumption?.labels || [];
        const cost = months.map((_: any, i: number) => data.monthlyCost?.[i] ?? 0);
        const sellingPrice = months.map((_: any, i: number) => data.monthlySellingPrice?.[i] ?? 0);
        const allIngredients = (data.items || []).map((item: any) => ({
          name: item.name, totalUsed: item.totalQuantity, unit: item.unit,
        }));

        const analytics: KitchenAnalytics = {
          kitchen: kitchens.find(k => k.id === activeKitchenId) || { id: activeKitchenId, name: "Kitchen" },
          totalConsumption: data.totalConsumption ?? 0,
          totalWaste: data.totalWaste ?? 0,
          totalWasteCost: data.totalWasteCost ?? 0,
          totalCost: data.totalCost ?? 0,
          totalSellingPrice: data.totalSellingPrice ?? 0,
          totalProfit: (data.totalSellingPrice ?? 0) - (data.totalCost ?? 0),
          wasteByExpiration: data.wasteByExpiration ?? 0,
          wasteByExpirationCost: data.wasteByExpirationCost ?? 0,
          wasteByIngredient: data.wasteByIngredient ?? 0,
          wasteByIngredientCost: data.wasteByIngredientCost ?? 0,
          mostUsedIngredients: [...allIngredients].sort((a: any, b: any) => b.totalUsed - a.totalUsed).slice(0, 8),
          leastUsedIngredients: [...allIngredients].sort((a: any, b: any) => a.totalUsed - b.totalUsed).slice(0, 8),
          recipes: (data.recipes || []).map((r: any) => ({
            recipeId: r.recipeId, recipeName: r.recipeName,
            totalServings: r.totalServings, totalCost: r.totalCost,
            totalSellingPrice: r.totalSellingPrice, totalProfit: r.totalProfit,
            totalWaste: r.totalWaste,
          })),
        };
        setAnalyticsMap(prev => ({ ...prev, [activeKitchenId]: analytics }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKitchenId, kitchens, refreshKey]);

  /* ── Fetch AI analysis ──────────────────────────────────────────────────── */
  const fetchAi = useCallback(async () => {
    if (!activeKitchenId) return;
    setAiLoading(true);
    try {
      const r = await fetch(`/api/food-supply/ai-analysis?kitchenId=${activeKitchenId}`);
      if (r.ok) setAiData(await r.json());
    } catch {}
    setAiLoading(false);
  }, [activeKitchenId]);

  useEffect(() => { if (activeKitchenId) fetchAi(); }, [activeKitchenId, fetchAi]);

  /* ── All loaded kitchens for comparison ─────────────────────────────────── */
  const allLoaded = useMemo(() => Object.values(analyticsMap), [analyticsMap]);
  const generatedInsights = useMemo(() => generateAiInsights(allLoaded), [allLoaded]);

  const a = activeKitchenId ? analyticsMap[activeKitchenId] : null;

  /* ── Derived metrics ─────────────────────────────────────────────────────── */
  const wasteRatio = a && a.totalConsumption > 0 ? (a.totalWaste / a.totalConsumption) * 100 : 0;
  const margin = a && (a.totalCost + a.totalProfit) > 0 ? (a.totalProfit / (a.totalCost + a.totalProfit)) * 100 : 0;
  const maxIngUsed = a?.mostUsedIngredients[0]?.totalUsed || 1;
  const maxIngLeast = a?.leastUsedIngredients[0]?.totalUsed || 1;

  /* ── Print data helpers ─────────────────────────────────────────────────── */
  const kitchenTotals = kitchens.map(k => ({
    id: k.id, name: k.name, floorNumber: 1, total: analyticsMap[k.id]?.totalConsumption ?? 0,
  }));
  const chartData = [{ month: t('summary'), ...kitchenTotals.reduce((acc, k) => ({ ...acc, [k.name]: k.total }), {}) }];

  /* ── No kitchens empty state ────────────────────────────────────────────── */
  if (!loading && !kitchens.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <ChefHat className="h-8 w-8 opacity-30" />
        </div>
        <p className="font-semibold">{t('no_analytics_data_available')}</p>
        <p className="text-xs mt-1 opacity-60">Add kitchens to start tracking consumption analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-5">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-20 w-20 h-20 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">Kitchen Analytics</span>
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-200 bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Consumption & Performance</h2>
            <p className="text-sm text-white/60 mt-0.5">AI-powered insights across {kitchens.length} kitchen{kitchens.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setView(v => v === 'kitchen' ? 'compare' : 'kitchen')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
            >
              {view === 'kitchen' ? <><Activity className="h-3.5 w-3.5" /> Compare All</> : <><ChefHat className="h-3.5 w-3.5" /> Kitchen View</>}
            </button>
            <button
              onClick={() => { setAnalyticsMap({}); setAiData(null); setRefreshKey(k => k + 1); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </button>
            <PrintAllKitchenConsumptionReportButton chartData={chartData} kitchenTotals={kitchenTotals} />
          </div>
        </div>

        {/* Kitchen selector pills */}
        {kitchens.length > 1 && (
          <div className="relative z-10 flex gap-2 mt-4 flex-wrap">
            {kitchens.map(k => (
              <button key={k.id} onClick={() => setActiveKitchenId(k.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeKitchenId === k.id
                    ? 'bg-white text-emerald-700 shadow-lg'
                    : 'bg-white/15 text-white/80 border border-white/20 hover:bg-white/25'
                }`}>
                <ChefHat className="h-3 w-3" /> {k.name}
                {analyticsMap[k.id] && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeKitchenId === k.id ? 'bg-emerald-100 text-emerald-700' : 'bg-white/20 text-white'}`}>
                    QAR {analyticsMap[k.id].totalProfit.toFixed(0)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading && <LoadingSkeleton />}

      {/* ══════════════════════════════════════════════════════════════════════
          COMPARE VIEW — Cross-kitchen comparison
      ══════════════════════════════════════════════════════════════════════ */}
      {!loading && view === 'compare' && allLoaded.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <SectionHdr icon={Activity} title="Cross-Kitchen Comparison" badge={`${allLoaded.length} kitchens`} color="indigo" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Kitchen</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Consumption</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Waste</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Waste %</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost (QAR)</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Revenue (QAR)</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Profit (QAR)</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {allLoaded.map(kd => {
                    const wr = kd.totalConsumption > 0 ? (kd.totalWaste / kd.totalConsumption) * 100 : 0;
                    const mg = (kd.totalCost + kd.totalProfit) > 0 ? (kd.totalProfit / (kd.totalCost + kd.totalProfit)) * 100 : 0;
                    return (
                      <tr key={kd.kitchen.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                              <ChefHat className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="font-semibold">{kd.kitchen.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-medium">{kd.totalConsumption.toFixed(1)}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-semibold ${kd.totalWaste > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {kd.totalWaste.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${wr >= 15 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : wr >= 8 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                            {wr.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-violet-600 dark:text-violet-400 font-medium">{kd.totalCost.toFixed(0)}</td>
                        <td className="py-3 px-3 text-right text-blue-600 dark:text-blue-400 font-medium">{kd.totalSellingPrice.toFixed(0)}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-bold ${kd.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {kd.totalProfit >= 0 ? '+' : ''}{kd.totalProfit.toFixed(0)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${mg >= 20 ? 'bg-emerald-500' : mg >= 10 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(0, Math.min(100, mg))}%` }} />
                            </div>
                            <span className="text-xs font-bold">{mg.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="py-2 pr-4 text-xs font-black uppercase tracking-wider">TOTAL</td>
                    <td className="py-2 px-3 text-right text-xs font-bold">{allLoaded.reduce((s, a) => s + a.totalConsumption, 0).toFixed(1)}</td>
                    <td className="py-2 px-3 text-right text-xs font-bold text-red-600">{allLoaded.reduce((s, a) => s + a.totalWaste, 0).toFixed(1)}</td>
                    <td className="py-2 px-3" />
                    <td className="py-2 px-3 text-right text-xs font-bold text-violet-600">QAR {allLoaded.reduce((s, a) => s + a.totalCost, 0).toFixed(0)}</td>
                    <td className="py-2 px-3 text-right text-xs font-bold text-blue-600">QAR {allLoaded.reduce((s, a) => s + a.totalSellingPrice, 0).toFixed(0)}</td>
                    <td className="py-2 px-3 text-right text-xs font-bold text-emerald-600">QAR {allLoaded.reduce((s, a) => s + a.totalProfit, 0).toFixed(0)}</td>
                    <td className="py-2 px-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* AI Insights in compare view */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <SectionHdr icon={Brain} title="AI Cross-Kitchen Insights" badge="AI Powered" color="violet" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {generatedInsights.map(i => <InsightCard key={i.id} insight={i} />)}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          KITCHEN VIEW — Single kitchen detail
      ══════════════════════════════════════════════════════════════════════ */}
      {!loading && view === 'kitchen' && a && (
        <div className="space-y-6">

          {/* Print + kitchen info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <ChefHat className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-bold text-sm">{a.kitchen.name}</span>
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {a.recipes.length} recipe{a.recipes.length !== 1 ? 's' : ''}
              </span>
            </div>
            <PrintKitchenConsumptionReportButton
              kitchenId={a.kitchen.id}
              kitchenName={a.kitchen.name}
              details={[
                ...a.mostUsedIngredients.map(ing => ({ name: ing.name, unit: ing.unit, totalQuantity: ing.totalUsed, consumptions: [] })),
                ...a.leastUsedIngredients.filter(ing => !a.mostUsedIngredients.some(m => m.name === ing.name)).map(ing => ({ name: ing.name, unit: ing.unit, totalQuantity: ing.totalUsed, consumptions: [] })),
              ]}
              monthlyData={{ labels: [], totalData: [], byFoodType: [] }}
            />
          </div>

          {/* ── KPI Stat Cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={TrendingUp} label="Total Consumption" value={a.totalConsumption.toFixed(1)} sub="total qty" grad="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <StatCard icon={Trash2} label="Total Waste" value={a.totalWaste.toFixed(1)} sub={`${wasteRatio.toFixed(1)}% waste rate`} trendUp={false} trend={wasteRatio >= 10 ? 'High' : undefined} grad={wasteRatio >= 15 ? 'bg-gradient-to-br from-red-500 to-rose-600' : wasteRatio >= 8 ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-slate-500 to-slate-600'} />
            <StatCard icon={DollarSign} label="Total Cost" value={`QAR ${a.totalCost.toFixed(0)}`} sub={`QAR ${(a.totalWasteCost ?? 0).toFixed(0)} wasted`} grad="bg-gradient-to-br from-violet-500 to-purple-600" />
            <StatCard icon={Award} label="Net Profit" value={`QAR ${a.totalProfit.toFixed(0)}`} sub={`${margin.toFixed(1)}% margin`} trendUp={a.totalProfit >= 0} trend={a.totalProfit >= 0 ? 'Positive' : 'Loss'} grad={a.totalProfit >= 0 ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-red-500 to-rose-600'} />
          </div>

          {/* ── Waste Breakdown + Financial ──────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Waste breakdown */}
            <div className="md:col-span-1 rounded-2xl border border-border bg-card p-4">
              <SectionHdr icon={Trash2} title="Waste Breakdown" color="red" />
              <div className="space-y-4">
                {[
                  { label: 'By Expiration', qty: a.wasteByExpiration, cost: a.wasteByExpirationCost ?? 0, color: '#f97316', bg: 'bg-orange-500' },
                  { label: 'By Ingredient', qty: a.wasteByIngredient, cost: a.wasteByIngredientCost ?? 0, color: '#ef4444', bg: 'bg-red-500' },
                ].map(w => {
                  const totalWaste = a.wasteByExpiration + a.wasteByIngredient;
                  const pct = totalWaste > 0 ? Math.round((w.qty / totalWaste) * 100) : 0;
                  return (
                    <div key={w.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold">{w.label}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                        <div className={`h-full ${w.bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{w.qty.toFixed(1)} units</span>
                        <span className="font-semibold text-foreground">QAR {w.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Total Waste Cost</span>
                    <span className="text-sm font-black text-red-600 dark:text-red-400">QAR {(a.totalWasteCost ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial summary */}
            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-4">
              <SectionHdr icon={DollarSign} title="Financial Overview" color="emerald" />
              <div className="space-y-3">
                {[
                  { label: 'Total Revenue', val: a.totalSellingPrice, color: 'text-blue-600 dark:text-blue-400', pct: 100, barColor: 'bg-blue-500' },
                  { label: 'Total Cost', val: a.totalCost, color: 'text-violet-600 dark:text-violet-400', pct: a.totalSellingPrice > 0 ? (a.totalCost / a.totalSellingPrice) * 100 : 0, barColor: 'bg-violet-500' },
                  { label: 'Waste Cost', val: a.totalWasteCost ?? 0, color: 'text-red-600 dark:text-red-400', pct: a.totalSellingPrice > 0 ? ((a.totalWasteCost ?? 0) / a.totalSellingPrice) * 100 : 0, barColor: 'bg-red-500' },
                  { label: 'Net Profit', val: a.totalProfit, color: a.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400', pct: a.totalSellingPrice > 0 ? (Math.abs(a.totalProfit) / a.totalSellingPrice) * 100 : 0, barColor: a.totalProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                      <span className={`text-sm font-bold ${row.color}`}>QAR {row.val.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${row.barColor} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── AI Insights ───────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-sm font-bold">AI Kitchen Insights</h3>
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-2.5 w-2.5" /> AI Powered
                </span>
              </div>
              <button onClick={fetchAi} disabled={aiLoading}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                <RefreshCcw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                Refresh AI
              </button>
            </div>

            {/* Rule-based insights (instant) */}
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Quick Analysis</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {generatedInsights.filter(i => !i.id.startsWith('all-good') || generatedInsights.length === 1).map(i => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            </div>

            {/* API-based AI insights */}
            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-violet-500 animate-spin" />
                Loading deep AI analysis…
              </div>
            )}
            {!aiLoading && aiData && (
              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deep Analysis</p>
                {/* Insights */}
                {aiData.insights?.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {aiData.insights.slice(0, 4).map((ins: any) => (
                      <InsightCard key={ins.id} insight={{
                        id: ins.id,
                        severity: ins.type === 'positive' ? 'success' : ins.type === 'negative' ? 'warning' : 'info',
                        title: ins.title,
                        message: ins.description,
                      }} />
                    ))}
                  </div>
                )}
                {/* Recommendations */}
                {aiData.recommendations && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { icon: Package, label: 'Inventory Optimisation', items: aiData.recommendations.inventoryOptimization, color: 'indigo' },
                      { icon: Leaf, label: 'Waste Reduction', items: aiData.recommendations.wasteReduction, color: 'emerald' },
                      { icon: DollarSign, label: 'Cost Saving', items: aiData.recommendations.costSaving, color: 'amber' },
                    ].map(rec => (
                      <div key={rec.label} className="rounded-xl border border-border bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <rec.icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{rec.label}</span>
                        </div>
                        <ul className="space-y-1.5">
                          {(rec.items ?? []).map((item: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/50" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                {/* Top consumed / wasted */}
                {aiData.topItems && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Consumed</span>
                      </div>
                      {(aiData.topItems.mostConsumed ?? []).map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                          <span className="text-xs font-medium">{item.name}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.quantity.toFixed(1)} {item.unit}</span>
                            {item.trend !== 0 && (
                              <span className={`font-bold text-[10px] ${item.trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {item.trend > 0 ? '↑' : '↓'}{Math.abs(item.trend).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Most Wasted</span>
                      </div>
                      {(aiData.topItems.mostWasted ?? []).map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                          <span className="text-xs font-medium">{item.name}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.quantity.toFixed(1)} {item.unit}</span>
                            <span className="text-[10px] text-muted-foreground italic">{item.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Ingredient Usage ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Most used */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <SectionHdr icon={TrendingUp} title="Top Used Ingredients" badge={`${a.mostUsedIngredients.length}`} color="emerald" />
              {a.mostUsedIngredients.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No ingredient data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {a.mostUsedIngredients.map((ing, idx) => {
                    const pct = maxIngUsed > 0 ? (ing.totalUsed / maxIngUsed) * 100 : 0;
                    return (
                      <div key={ing.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black ${idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
                              {idx === 0 ? '★' : idx + 1}
                            </span>
                            <span className="text-xs font-semibold truncate max-w-[120px]">{ing.name}</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{ing.totalUsed.toFixed(1)} {ing.unit}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Least used */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <SectionHdr icon={TrendingDown} title="Least Used Ingredients" badge={`${a.leastUsedIngredients.length}`} color="amber" />
              {a.leastUsedIngredients.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No ingredient data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {a.leastUsedIngredients.filter(i => !a.mostUsedIngredients.slice(0, 5).some(m => m.name === i.name)).slice(0, 8).map((ing, idx) => {
                    const pct = maxIngLeast > 0 ? (ing.totalUsed / maxIngLeast) * 100 : 0;
                    return (
                      <div key={ing.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[9px] font-black">{idx + 1}</span>
                            <span className="text-xs font-semibold truncate max-w-[120px]">{ing.name}</span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{ing.totalUsed.toFixed(1)} {ing.unit}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Recipe Performance ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <SectionHdr icon={ChefHat} title="Recipe Performance" badge={`${a.recipes.length} recipes`} color="violet" />
            {a.recipes.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Utensils className="h-10 w-10 mb-3 opacity-20" />
                <p className="font-medium">No recipe consumption data</p>
                <p className="text-xs mt-1 opacity-60">Use recipes in kitchens to see performance metrics</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2.5 pr-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipe</th>
                      <th className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Servings</th>
                      <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cost</th>
                      <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue</th>
                      <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Profit</th>
                      <th className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Margin</th>
                      <th className="text-right py-2.5 pl-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Waste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...a.recipes].sort((x, y) => y.totalProfit - x.totalProfit).map((r, idx) => {
                      const mg = (r.totalCost + r.totalProfit) > 0 ? (r.totalProfit / (r.totalCost + r.totalProfit)) * 100 : 0;
                      const isTop = idx === 0 && r.totalProfit > 0;
                      return (
                        <tr key={r.recipeId} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isTop ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {isTop && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                              <span className="font-semibold truncate max-w-[160px]">{r.recipeName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">{r.totalServings}</span>
                          </td>
                          <td className="py-3 px-3 text-right text-violet-600 dark:text-violet-400 font-medium text-xs">QAR {r.totalCost.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right text-blue-600 dark:text-blue-400 font-medium text-xs">QAR {r.totalSellingPrice.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`font-black text-sm ${r.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {r.totalProfit >= 0 ? '+' : ''}QAR {r.totalProfit.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${mg >= 20 ? 'bg-emerald-500' : mg >= 10 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(0, Math.min(100, mg))}%` }} />
                              </div>
                              <span className="text-[10px] font-bold">{mg.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <span className={`text-xs ${r.totalWaste > 0 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                              {r.totalWaste?.toFixed(2) ?? '0.00'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {a.recipes.length > 1 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td className="py-2 pr-4 text-xs font-black uppercase tracking-wider">Total</td>
                        <td className="py-2 px-3 text-center text-xs font-bold">{a.recipes.reduce((s, r) => s + r.totalServings, 0)}</td>
                        <td className="py-2 px-3 text-right text-xs font-bold text-violet-600">QAR {a.recipes.reduce((s, r) => s + r.totalCost, 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-xs font-bold text-blue-600">QAR {a.recipes.reduce((s, r) => s + r.totalSellingPrice, 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-xs font-bold text-emerald-600">QAR {a.recipes.reduce((s, r) => s + r.totalProfit, 0).toFixed(2)}</td>
                        <td className="py-2 px-3" />
                        <td className="py-2 pl-3 text-right text-xs font-bold text-red-500">{a.recipes.reduce((s, r) => s + (r.totalWaste ?? 0), 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* No data for active kitchen */}
      {!loading && view === 'kitchen' && !a && activeKitchenId && (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <ChefHat className="h-7 w-7 opacity-20" />
          </div>
          <p className="font-semibold">No data for this kitchen</p>
          <p className="text-xs mt-1 opacity-60">Record some consumption or recipe usage to see analytics</p>
        </div>
      )}

    </div>
  );
}

export default KitchenConsumptionAnalysisTab;
