// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';
import { fetchWithCache } from '@/lib/api-cache';
import { 
  Package, 
  Utensils, 
  Car, 
  AlertTriangle, 
  Plus, 
  FileText, 
  Building, 
  BarChart3, 
  Clock, 
  ArrowRight, 
  User, 
  Calendar,
  Truck,
  ShoppingCart,
  Clipboard,
  Activity,
  Star,
  TrendingUp,
  TrendingDown,
  Zap,
  Brain,
  DollarSign,
  Layers,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { AiAlerts } from "@/components/AiAlerts";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { EnhancedRentalCostsCard } from "@/components/EnhancedRentalCostsCard";
import { EnhancedFoodExpensesCard } from "@/components/EnhancedFoodExpensesCard";
import { EnhancedAssetsOverviewCard } from "@/components/EnhancedAssetsOverviewCard";
import EnhancedQuickActionsSection from "@/components/EnhancedQuickActionsSection";
import { MotionCard } from "@/components/MotionCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ConsumptionAnalysisDialog } from "@/components/ConsumptionAnalysisDialog";
import { KitchenConsumptionSummaryDialog } from "@/components/KitchenConsumptionSummaryDialog";
import { DriverTripSummaryDialog } from "@/components/DriverTripSummaryDialog";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { EnhancedVendorPerformanceCard } from "@/components/EnhancedVendorPerformanceCard";
import { logDebug } from "@/lib/client-logger";

interface DashboardStats {
  totalAssets: number;
  totalFoodItems: number;
  activeVehicleRentals: number;
  lowStockItems: number;
  totalFoodCost: number;
  totalVehicleCost: number;
  yearlyVehicleCost?: number;
  totalFoodConsumption?: number;
  totalFoodSupplyValue?: number;
  totalAmountSpent?: number;
  amountSpentBreakdown?: {
    foodConsumption: number;
    assetsPurchased: number;
    vehicleRentalCosts: number;
  };
  recentRentals: Array<{
    id: string;
    startDate: string;
    endDate: string;
    vehicle: {
      make: string;
      model: string;
      status: string;
      rentalAmount: number;
    };
  }>;
  vehicleStats: Array<{
    status: string;
    _count: number;
  }>;
  assetStats: {
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    totalValue: number;
    disposedValue: number;
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'QAR'
  }).format(amount);
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [consumptionAnalysisOpen, setConsumptionAnalysisOpen] = useState(false);
  const [kitchenConsumptionOpen, setKitchenConsumptionOpen] = useState(false);
  const [driverTripSummaryOpen, setDriverTripSummaryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalAssets: 0,
    totalFoodItems: 0,
    activeVehicleRentals: 0,
    lowStockItems: 0,
    totalFoodCost: 0,
    totalVehicleCost: 0,
    totalFoodConsumption: 0,
    totalFoodSupplyValue: 0,
    totalAmountSpent: 0,
    amountSpentBreakdown: {
      foodConsumption: 0,
      assetsPurchased: 0,
      vehicleRentalCosts: 0
    },
    recentRentals: [],
    vehicleStats: [],
    assetStats: {
      byStatus: [],
      totalValue: 0,
      disposedValue: 0
    }
  });

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    setIsLoading(true);
    
    const fetchStats = async () => {
      // Parse numeric values to ensure they're numbers, not strings
      const parseNumber = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      try {
        logDebug('Dashboard: Starting to fetch data');

        // Use cached fetch — 2 min TTL for core stats, 5 min for secondary metrics.
        // In-flight deduplication is handled by fetchWithCache automatically.
        const fetchData = async (url: string, maxAge = 5 * 60 * 1000) => {
          try {
            const data = await fetchWithCache(url, { maxAge });
            logDebug(`Dashboard: data for ${url}`, data);
            return data || {};
          } catch {
            return {};
          }
        };

        // Phase 1: load core dashboard stats first so the page renders quickly.
        const dashboardData = await fetchData('/api/dashboard/stats', 2 * 60 * 1000);
        const baseStats = {
          totalAssets: parseNumber(dashboardData.totalAssets),
          totalFoodItems: parseNumber(dashboardData.totalFoodItems),
          activeVehicleRentals: parseNumber(dashboardData.activeVehicleRentals),
          lowStockItems: parseNumber(dashboardData.lowStockItems),
          totalFoodCost: parseNumber(dashboardData.totalFoodCost),
          totalVehicleCost: parseNumber(dashboardData.totalVehicleCost),
          recentRentals: Array.isArray(dashboardData.recentRentals) ? dashboardData.recentRentals : [],
          vehicleStats: Array.isArray(dashboardData.vehicleStats) ? dashboardData.vehicleStats : [],
          assetStats: {
            byStatus: Array.isArray(dashboardData.assetStats?.byStatus) ? dashboardData.assetStats.byStatus : [],
            totalValue: parseNumber(dashboardData.assetStats?.totalValue),
            disposedValue: parseNumber(dashboardData.assetStats?.disposedValue)
          }
        };
        setStats(prev => ({ ...prev, ...baseStats }));
        setIsLoading(false);

        // Phase 2: hydrate non-critical metrics in parallel.
        const [rentalCostsResult, foodConsumptionResult, foodValueResult, totalSpentResult] = await Promise.allSettled([
          fetchData('/api/vehicles/rental-costs'),
          fetchData('/api/food-supply/total-consumed'),
          fetchData('/api/food-supply/total-value'),
          fetchData('/api/dashboard/total-spent')
        ]);

        logDebug('Dashboard: Secondary API results:', {
          rentalCostsStatus: rentalCostsResult.status,
          foodConsumptionStatus: foodConsumptionResult.status,
          foodValueStatus: foodValueResult.status,
          totalSpentStatus: totalSpentResult.status
        });

        const rentalCostsData = rentalCostsResult.status === 'fulfilled' ? rentalCostsResult.value : {
          monthlyTotal: 0,
          yearlyTotal: 0,
          monthlyRentalTotal: 0,
          yearlyRentalTotal: 0,
          monthlyMaintenanceTotal: 0,
          yearlyMaintenanceTotal: 0
        };

        const totalFoodConsumptionData = foodConsumptionResult.status === 'fulfilled' ? foodConsumptionResult.value : {
          totalConsumed: 0
        };

        const totalFoodValueData = foodValueResult.status === 'fulfilled' ? foodValueResult.value : {
          totalValue: 0
        };

        const totalAmountSpentData = totalSpentResult.status === 'fulfilled' ? totalSpentResult.value : {
          totalAmountSpent: 0,
          breakdown: {
            foodConsumption: 0,
            assetsPurchased: 0,
            vehicleRentalCosts: 0,
            vehicleMaintenanceCosts: 0
          }
        };

        setStats(prev => ({
          ...prev,
          totalVehicleCost: parseNumber(rentalCostsData.monthlyTotal || prev.totalVehicleCost),
          yearlyVehicleCost: parseNumber(rentalCostsData.yearlyTotal),
          monthlyRentalTotal: parseNumber(rentalCostsData.monthlyRentalTotal),
          yearlyRentalTotal: parseNumber(rentalCostsData.yearlyRentalTotal),
          monthlyMaintenanceTotal: parseNumber(rentalCostsData.monthlyMaintenanceTotal),
          yearlyMaintenanceTotal: parseNumber(rentalCostsData.yearlyMaintenanceTotal),
          totalFoodConsumption: parseNumber(totalFoodConsumptionData.totalConsumed),
          totalFoodSupplyValue: parseNumber(totalFoodValueData.totalValue),
          totalAmountSpent: parseNumber(totalAmountSpentData.totalAmountSpent),
          amountSpentBreakdown: {
            foodConsumption: parseNumber(totalAmountSpentData.breakdown?.foodConsumption),
            assetsPurchased: parseNumber(totalAmountSpentData.breakdown?.assetsPurchased),
            vehicleRentalCosts: parseNumber(totalAmountSpentData.breakdown?.vehicleRentalCosts),
            vehicleMaintenanceCosts: parseNumber(totalAmountSpentData.breakdown?.vehicleMaintenanceCosts)
          }
        }));
      } catch (error) {
        console.error('Dashboard: Error fetching dashboard stats:', error);
        // Show toast notification for error
        toast({
          title: "Error",
          description: error instanceof Error 
            ? error.message 
            : "Failed to load dashboard statistics. Please try refreshing the page.",
          variant: "destructive",
        });
        
        // Set default stats even if there's an error
        setStats({
          totalAssets: 0,
          totalFoodItems: 0,
          activeVehicleRentals: 0,
          lowStockItems: 0,
          totalFoodCost: 0,
          totalVehicleCost: 0,
          yearlyVehicleCost: 0,
          totalFoodConsumption: 0,
          totalFoodSupplyValue: 0,
          totalAmountSpent: 0,
          amountSpentBreakdown: {
            foodConsumption: 0,
            assetsPurchased: 0,
            vehicleRentalCosts: 0
          },
          recentRentals: [],
          vehicleStats: [],
          assetStats: {
            byStatus: [],
            totalValue: 0,
            disposedValue: 0
          }
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'AVAILABLE':
        return 'bg-emerald-500';
      case 'RENTED':
      case 'IN_USE':
        return 'bg-sky-500';
      case 'MAINTENANCE':
        return 'bg-amber-500';
      case 'DISPOSED':
        return 'bg-rose-500';
      default:
        return 'bg-slate-500';
    }
  };

  // Get current date for welcome message
  const currentDate = new Date();
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(currentDate);

  const { t, dir } = useTranslation();

  if (isLoading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={`flex-1 space-y-6 p-4 sm:p-5 md:p-6 pb-24 md:pb-10 ${dir === 'rtl' ? 'text-right' : ''}`}>

        {/* ══════════════════════════════════════════════
            WORLD-CLASS HERO WELCOME BANNER
        ══════════════════════════════════════════════ */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Background layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(14,165,233,0.15),transparent_60%)]" />
          <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-16 w-40 h-40 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="absolute top-6 right-32 w-20 h-20 rounded-full bg-violet-400/20" />

          {/* Content */}
          <div className="relative z-10 p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              {/* Greeting */}
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-indigo-300/80 text-xs font-semibold uppercase tracking-widest">{formattedDate}</p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {t('welcome_back')}{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
                  </h1>
                </div>
              </div>
              <p className="text-slate-300/70 text-sm mt-1 ml-15">{t('your_enterprise_dashboard')}</p>

              {/* 4 quick-stat chips */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Assets', value: stats.totalAssets, icon: Package, accent: 'bg-indigo-500/25 border-indigo-400/30' },
                  { label: 'Food Items', value: stats.totalFoodItems, icon: Utensils, accent: 'bg-emerald-500/25 border-emerald-400/30' },
                  { label: 'Active Rentals', value: stats.activeVehicleRentals, icon: Car, accent: 'bg-amber-500/25 border-amber-400/30', warn: stats.activeVehicleRentals > 0 },
                  { label: 'Low Stock', value: stats.lowStockItems, icon: AlertTriangle, accent: stats.lowStockItems > 0 ? 'bg-rose-500/30 border-rose-400/40' : 'bg-slate-500/20 border-slate-400/20', warn: stats.lowStockItems > 0 },
                ].map(({ label, value, icon: Icon, accent, warn }) => (
                  <div key={label} className={`rounded-xl px-4 py-3 border ${accent} backdrop-blur-sm`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`h-3 w-3 ${warn ? 'text-rose-300' : 'text-white/70'}`} />
                      <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">{label}</p>
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${warn ? 'text-rose-300' : 'text-white'}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: total spent hero number */}
            <div className="flex-shrink-0 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5 min-w-[220px] text-center shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200/80 mb-2">{t('total_amount_spent')}</p>
              <p className="text-3xl font-bold text-white tabular-nums leading-tight">
                QAR {(stats.totalAmountSpent || 0).toLocaleString()}
              </p>
              <p className="text-xs text-white/50 mt-1">{t('this_year')}</p>
              <div className="mt-4 flex flex-col gap-1.5 text-left">
                {[
                  { label: t('food_consumption'), value: stats.amountSpentBreakdown?.foodConsumption || 0, color: 'bg-emerald-400' },
                  { label: t('assets_purchased'), value: stats.amountSpentBreakdown?.assetsPurchased || 0, color: 'bg-indigo-400' },
                  { label: t('vehicles'), value: (stats.amountSpentBreakdown?.vehicleRentalCosts || 0) + (stats.amountSpentBreakdown?.vehicleMaintenanceCosts || 0), color: 'bg-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${color} flex-shrink-0`} />
                    <span className="text-[10px] text-white/60 flex-1 truncate">{label}</span>
                    <span className="text-[10px] font-semibold text-white/80 tabular-nums">{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => setConsumptionAnalysisOpen(true)} size="sm"
                className="mt-4 w-full bg-white/20 hover:bg-white/30 text-white border-0 text-xs gap-1.5 backdrop-blur-sm">
                <BarChart3 className="h-3 w-3" />{t('view_detailed_analysis')}
              </Button>
            </div>
          </div>

          {/* Bottom nav strip */}
          <div className="relative z-10 border-t border-white/15 grid grid-cols-3 divide-x divide-white/15">
            {[
              { label: 'Assets', sublabel: `${stats.totalAssets} registered`, icon: Package, href: '/assets' },
              { label: 'Food Supply', sublabel: `${stats.totalFoodItems} items`, icon: Utensils, href: '/food-supply' },
              { label: 'AI Analysis', sublabel: 'Real-time insights', icon: Brain, href: '/ai-analysis' },
            ].map(({ label, sublabel, icon: Icon, href }) => (
              <button key={label} onClick={() => router.push(href)}
                className="px-5 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left group">
                <Icon className="h-4 w-4 text-indigo-300/70 group-hover:text-white transition-colors" />
                <div>
                  <p className="text-xs font-semibold text-white/90">{label}</p>
                  <p className="text-[10px] text-white/50">{sublabel}</p>
                </div>
                <ChevronRight className="h-3 w-3 text-white/30 group-hover:text-white/60 ml-auto transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            PREMIUM KPI CARDS — 4 full-gradient
        ══════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-1 rounded-full bg-indigo-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{t('key_performance_metrics')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* ── Total Expenditure ── */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{t('total_amount_spent').replace(/_/g,' ')}</p>
                    <p className="text-xs text-white/50">{t('this_year')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums mb-4">QAR {(stats.totalAmountSpent || 0).toLocaleString()}</p>
                <div className="space-y-2">
                  {[
                    { label: t('food_consumption'), v: stats.amountSpentBreakdown?.foodConsumption || 0, color: 'bg-emerald-400' },
                    { label: t('assets_purchased'), v: stats.amountSpentBreakdown?.assetsPurchased || 0, color: 'bg-violet-300' },
                    { label: `${t('vehicles')} & ${t('maintenance')}`, v: (stats.amountSpentBreakdown?.vehicleRentalCosts || 0) + (stats.amountSpentBreakdown?.vehicleMaintenanceCosts || 0), color: 'bg-amber-300' },
                  ].map(({ label, v, color }) => {
                    const pct = stats.totalAmountSpent ? (v / stats.totalAmountSpent) * 100 : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-[10px] text-white/70 mb-0.5">
                          <span>{label}</span><span className="font-semibold text-white/90">{v.toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-white/15 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setConsumptionAnalysisOpen(true)}
                  className="mt-4 w-full text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg py-1.5 flex items-center justify-center gap-1.5 transition-colors">
                  <BarChart3 className="h-3 w-3" />{t('view_detailed_analysis')}
                </button>
              </div>
            </div>

            {/* ── Total Asset Value ── */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{t('total_asset_value')}</p>
                    <p className="text-xs text-white/50">{t('current_valuation')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums mb-4">QAR {(stats.assetStats?.totalValue || 0).toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(stats.assetStats?.byStatus || []).slice(0, 4).map(s => (
                    <div key={s.status} className="bg-white/10 rounded-lg px-3 py-2">
                      <p className="text-white/60 text-[10px] uppercase tracking-wide">{s.status}</p>
                      <p className="font-bold text-white text-sm">{s.count}</p>
                    </div>
                  ))}
                  {(stats.assetStats?.byStatus || []).length === 0 && (
                    <div className="col-span-2 bg-white/10 rounded-lg px-3 py-2 text-center">
                      <p className="text-white/60 text-xs">{stats.totalAssets} total assets tracked</p>
                    </div>
                  )}
                </div>
                <button onClick={() => router.push('/assets')}
                  className="mt-4 w-full text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg py-1.5 flex items-center justify-center gap-1.5 transition-colors">
                  <ArrowRight className="h-3 w-3" />View All Assets
                </button>
              </div>
            </div>

            {/* ── Food Supply Value ── */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{t('food_supply_value')}</p>
                    <p className="text-xs text-white/50">{t('current_inventory')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Utensils className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums mb-4">QAR {(stats.totalFoodSupplyValue || 0).toLocaleString()}</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-xs text-white/70">Total Items</span>
                    <span className="text-sm font-bold">{stats.totalFoodItems}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-xs text-white/70">Total Consumed</span>
                    <span className="text-sm font-bold">QAR {(stats.totalFoodConsumption || 0).toLocaleString()}</span>
                  </div>
                  {stats.lowStockItems > 0 && (
                    <div className="flex items-center gap-2 bg-rose-500/30 border border-rose-400/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
                      <span className="text-xs text-rose-200 font-semibold">{stats.lowStockItems} low-stock items</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setKitchenConsumptionOpen(true)}
                  className="mt-4 w-full text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg py-1.5 flex items-center justify-center gap-1.5 transition-colors">
                  <BarChart3 className="h-3 w-3" />{t('view_kitchen_consumption')}
                </button>
              </div>
            </div>

            {/* ── Vehicle & Maintenance Costs ── */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{t('total_rental_fees')} & {t('maintenance')}</p>
                    <p className="text-xs text-white/50">{t('this_year')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Car className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums mb-4">QAR {(stats.yearlyVehicleCost || 0).toLocaleString()}</p>
                <div className="space-y-2">
                  {[
                    { label: 'Yearly Rental', value: stats.yearlyRentalTotal || 0 },
                    { label: 'Yearly Maintenance', value: stats.yearlyMaintenanceTotal || 0 },
                    { label: 'Monthly Total', value: stats.totalVehicleCost || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2">
                      <span className="text-xs text-white/70">{label}</span>
                      <span className="text-sm font-bold tabular-nums">QAR {value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setDriverTripSummaryOpen(true)}
                  className="mt-4 w-full text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg py-1.5 flex items-center justify-center gap-1.5 transition-colors">
                  <FileText className="h-3 w-3" />{t('view_driver_trip_summary')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            FINANCIAL OVERVIEW — Enhanced Cards
        ══════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-card border border-border/60 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <BarChart3 className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground">{t('financial_overview')}</h2>
                <p className="text-xs text-muted-foreground">{t('track_enterprise_expenses')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              <span className="text-xs text-muted-foreground font-medium">Total Expenses:</span>
              <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(stats.totalAmountSpent || 0)}</span>
            </div>
          </div>

          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <MotionCard delay={0.1}>
              <EnhancedRentalCostsCard
                monthlyTotal={stats.totalVehicleCost}
                yearlyTotal={stats.yearlyVehicleCost || stats.totalVehicleCost * 12}
                monthlyRentalTotal={stats.monthlyRentalTotal}
                yearlyRentalTotal={stats.yearlyRentalTotal}
                monthlyMaintenanceTotal={stats.monthlyMaintenanceTotal}
                yearlyMaintenanceTotal={stats.yearlyMaintenanceTotal}
              />
            </MotionCard>
            <MotionCard delay={0.2}>
              <EnhancedFoodExpensesCard
                monthlyTotal={stats.totalFoodCost}
                yearlyTotal={stats.totalFoodCost * 12}
                totalFoodItems={stats.totalFoodItems}
                lowStockItems={stats.lowStockItems}
              />
            </MotionCard>
            <MotionCard delay={0.3} className="sm:col-span-2 lg:col-span-1">
              <EnhancedAssetsOverviewCard
                totalAssets={stats.totalAssets}
                assetStats={stats.assetStats}
              />
            </MotionCard>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            BOTTOM GRID: Quick Actions | AI Alerts | Vendors
        ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Quick Actions */}
          <EnhancedQuickActionsSection />

          {/* AI Alerts */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Brain className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="font-bold text-sm text-foreground">{t('ai_alerts_recommendations')}</h2>
            </div>
            {!isLoading && <AiAlerts className="w-full h-full shadow-sm hover:shadow-md transition-shadow duration-200" />}
          </div>

          {/* Vendor Performance */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Star className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="font-bold text-sm text-foreground">{t('vendor_performance')}</h2>
            </div>
            <EnhancedVendorPerformanceCard />
          </div>
        </div>
      </div>
      
      {/* Consumption Analysis Dialog */}
      <ConsumptionAnalysisDialog 
        open={consumptionAnalysisOpen} 
        onOpenChange={setConsumptionAnalysisOpen} 
      />
      
      {/* Kitchen Consumption Summary Dialog */}
      <KitchenConsumptionSummaryDialog
        open={kitchenConsumptionOpen}
        onOpenChange={setKitchenConsumptionOpen}
      />
      
      {/* Driver Trip Summary Dialog */}
      <DriverTripSummaryDialog
        open={driverTripSummaryOpen}
        onOpenChange={setDriverTripSummaryOpen}
      />
    </DashboardLayout>
  );
}
