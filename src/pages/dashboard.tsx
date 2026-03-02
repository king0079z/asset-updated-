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
  Sparkles,
  MapPin,
  CheckCircle2,
  ChefHat,
  Wifi,
  Sun,
  Sunset,
  Moon,
  CircleDot
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

  // Time-of-day greeting
  const hour = currentDate.getHours();
  const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const TimeIcon = hour < 12 ? Sun : hour < 17 ? Sunset : Moon;

  // Spending ring chart data
  const foodSpend    = stats.amountSpentBreakdown?.foodConsumption || 0;
  const assetsSpend  = stats.amountSpentBreakdown?.assetsPurchased || 0;
  const vehicleSpend = (stats.amountSpentBreakdown?.vehicleRentalCosts || 0) + (stats.amountSpentBreakdown?.vehicleMaintenanceCosts || 0);
  const spendTotal   = foodSpend + assetsSpend + vehicleSpend;
  const foodDeg    = spendTotal ? (foodSpend / spendTotal) * 360 : 0;
  const assetsDeg  = spendTotal ? (assetsSpend / spendTotal) * 360 : 0;
  const vehicleDeg = 360 - foodDeg - assetsDeg;
  const ringGradient = spendTotal
    ? `conic-gradient(#10b981 0deg ${foodDeg}deg, #8b5cf6 ${foodDeg}deg ${foodDeg + assetsDeg}deg, #f59e0b ${foodDeg + assetsDeg}deg 360deg)`
    : 'conic-gradient(#334155 0deg 360deg)';

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

        {/* ══════════════════════════════════════════════════════
            HERO — dark navy with time greeting + live metrics
        ══════════════════════════════════════════════════════ */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f1729] to-indigo-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-10%,rgba(99,102,241,0.4),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_0%_80%,rgba(14,165,233,0.12),transparent)]" />
          {/* Decorative orbs */}
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-indigo-500/8 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-24 w-48 h-48 rounded-full bg-blue-500/8 blur-2xl pointer-events-none" />
          <div className="absolute top-8 right-48 w-24 h-24 rounded-full bg-violet-500/15 blur-xl pointer-events-none" />
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

          {/* Main content */}
          <div className="relative z-10 p-6 sm:p-8 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-8">
            {/* Left: greeting + chips */}
            <div className="flex-1 min-w-0">
              {/* LIVE badge + date */}
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
                <span className="text-[11px] text-slate-400/80 font-medium">{formattedDate}</span>
              </div>

              {/* Greeting row */}
              <div className="flex items-center gap-4 mb-2">
                <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 flex items-center justify-center shadow-xl flex-shrink-0">
                  <TimeIcon className="h-7 w-7 text-indigo-300" />
                </div>
                <div>
                  <p className="text-indigo-300/70 text-xs font-semibold tracking-wide">{timeGreeting}</p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                    {user?.email ? user.email.split('@')[0] : 'Welcome back'} 👋
                  </h1>
                </div>
              </div>
              <p className="text-slate-400/70 text-sm mb-7 ml-1">{t('your_enterprise_dashboard')}</p>

              {/* 4 stat chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Assets', value: stats.totalAssets, icon: Package, chip: 'bg-indigo-500/20 border-indigo-400/25', dot: 'bg-indigo-400', nav: '/assets' },
                  { label: 'Food Items', value: stats.totalFoodItems, icon: Utensils, chip: 'bg-emerald-500/20 border-emerald-400/25', dot: 'bg-emerald-400', nav: '/food-supply' },
                  { label: 'Active Rentals', value: stats.activeVehicleRentals, icon: Car, chip: 'bg-amber-500/20 border-amber-400/25', dot: 'bg-amber-400', nav: '/vehicles' },
                  { label: 'Low Stock', value: stats.lowStockItems, icon: AlertTriangle,
                    chip: stats.lowStockItems > 0 ? 'bg-rose-500/25 border-rose-400/35' : 'bg-slate-600/20 border-slate-500/20',
                    dot: stats.lowStockItems > 0 ? 'bg-rose-400 animate-pulse' : 'bg-slate-500',
                    nav: '/food-supply' },
                ].map(({ label, value, icon: Icon, chip, dot, nav }) => (
                  <button key={label} onClick={() => router.push(nav)}
                    className={`group rounded-2xl px-4 py-3.5 border ${chip} backdrop-blur-sm text-left hover:scale-[1.02] hover:bg-white/10 transition-all duration-200`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                      <p className="text-[9px] uppercase tracking-[0.12em] text-white/50 font-bold">{label}</p>
                    </div>
                    <p className="text-2xl font-black text-white tabular-nums">{value}</p>
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[9px] text-white/40">View →</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Spending Summary card */}
            <div className="xl:w-72 flex-shrink-0 bg-white/[0.07] backdrop-blur-xl rounded-2xl border border-white/15 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-300/70">Total Spent</p>
                <span className="text-[9px] text-white/40">{t('this_year')}</span>
              </div>
              <p className="text-4xl font-black text-white tabular-nums leading-none mb-1">
                {(stats.totalAmountSpent || 0).toLocaleString()}
              </p>
              <p className="text-xs text-white/40 mb-5">QAR</p>

              {/* Mini donut ring */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative flex-shrink-0">
                  <div className="h-20 w-20 rounded-full" style={{ background: ringGradient }} />
                  <div className="absolute inset-[10px] rounded-full bg-[#0f1729]" />
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  {[
                    { label: 'Food', value: foodSpend, color: 'bg-emerald-400', pct: spendTotal ? Math.round((foodSpend / spendTotal) * 100) : 0 },
                    { label: 'Assets', value: assetsSpend, color: 'bg-violet-400', pct: spendTotal ? Math.round((assetsSpend / spendTotal) * 100) : 0 },
                    { label: 'Vehicles', value: vehicleSpend, color: 'bg-amber-400', pct: spendTotal ? Math.round((vehicleSpend / spendTotal) * 100) : 0 },
                  ].map(({ label, value, color, pct }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-sm ${color} flex-shrink-0`} />
                      <span className="text-[10px] text-white/60 flex-1 truncate">{label}</span>
                      <span className="text-[10px] font-bold text-white/80 tabular-nums">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown amounts */}
              <div className="space-y-2 mb-4">
                {[
                  { label: t('food_consumption'), value: foodSpend, color: 'text-emerald-400' },
                  { label: t('assets_purchased'), value: assetsSpend, color: 'text-violet-400' },
                  { label: 'Vehicles & Maintenance', value: vehicleSpend, color: 'text-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`text-[10px] text-white/50 flex-1 truncate`}>{label}</span>
                    <span className={`text-[10px] font-bold ${color} tabular-nums`}>QAR {value.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setConsumptionAnalysisOpen(true)}
                className="w-full bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/30 rounded-xl py-2 text-xs font-semibold text-indigo-200 flex items-center justify-center gap-2 transition-all">
                <BarChart3 className="h-3 w-3" /> Deep Analysis
              </button>
            </div>
          </div>

          {/* Bottom nav strip — 5 modules */}
          <div className="relative z-10 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 divide-x divide-white/10">
            {[
              { label: 'Assets', sub: `${stats.totalAssets} items`, icon: Package, href: '/assets', status: 'active' },
              { label: 'Food Supply', sub: `${stats.totalFoodItems} products`, icon: ChefHat, href: '/food-supply', status: stats.lowStockItems > 0 ? 'warn' : 'active' },
              { label: 'Kitchens', sub: 'Kitchen ops', icon: Utensils, href: '/kitchens', status: 'active' },
              { label: 'Vehicles', sub: `${stats.activeVehicleRentals} active`, icon: Car, href: '/vehicles', status: 'active' },
              { label: 'AI Analysis', sub: 'Insights online', icon: Brain, href: '/ai-analysis', status: 'active' },
            ].map(({ label, sub, icon: Icon, href, status }) => (
              <button key={label} onClick={() => router.push(href)}
                className="px-4 py-3 flex items-center gap-2.5 hover:bg-white/8 transition-colors text-left group min-w-0">
                <div className={`h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center ${status === 'warn' ? 'bg-amber-500/20' : 'bg-white/10'}`}>
                  <Icon className={`h-3.5 w-3.5 ${status === 'warn' ? 'text-amber-400' : 'text-indigo-300/70 group-hover:text-white'} transition-colors`} />
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className="text-xs font-semibold text-white/80 truncate">{label}</p>
                  <p className="text-[9px] text-white/40 truncate">{sub}</p>
                </div>
                <span className={`ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 ${status === 'warn' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            KPI CARDS — 4 full-gradient premium
        ══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-blue-400" />
            <h2 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">{t('key_performance_metrics')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Total Expenditure */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-blue-200/80 font-bold">Total Expenditure</p>
                    <p className="text-[10px] text-blue-300/50 mt-0.5">{t('this_year')}</p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-white/15 group-hover:bg-white/25 transition-colors flex items-center justify-center flex-shrink-0 shadow-lg">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-4xl font-black tabular-nums mb-1 leading-none">
                  {(stats.totalAmountSpent || 0).toLocaleString()}
                </p>
                <p className="text-xs text-blue-300/60 mb-5">QAR</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Food', v: foodSpend, color: 'bg-emerald-400' },
                    { label: 'Assets', v: assetsSpend, color: 'bg-violet-300' },
                    { label: 'Vehicles', v: vehicleSpend, color: 'bg-amber-300' },
                  ].map(({ label, v, color }) => {
                    const pct = spendTotal ? (v / spendTotal) * 100 : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-[10px] text-blue-200/70 mb-1">
                          <span>{label}</span><span className="font-bold text-white/90">QAR {v.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setConsumptionAnalysisOpen(true)}
                  className="mt-5 w-full text-xs font-bold bg-white/15 hover:bg-white/25 rounded-xl py-2 flex items-center justify-center gap-2 transition-all">
                  <BarChart3 className="h-3.5 w-3.5" /> Detailed Analysis
                </button>
              </div>
            </div>

            {/* Total Asset Value */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-violet-200/80 font-bold">{t('total_asset_value')}</p>
                    <p className="text-[10px] text-violet-300/50 mt-0.5">{t('current_valuation')}</p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-white/15 group-hover:bg-white/25 transition-colors flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-4xl font-black tabular-nums mb-1 leading-none">
                  {(stats.assetStats?.totalValue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-violet-300/60 mb-5">QAR</p>

                {/* Asset status breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  {(stats.assetStats?.byStatus || []).slice(0, 4).map(s => {
                    const dotColor = s.status === 'ACTIVE' ? 'bg-emerald-400' : s.status === 'DISPOSED' ? 'bg-rose-400' : 'bg-amber-400';
                    return (
                      <div key={s.status} className="bg-white/10 rounded-xl px-3 py-2.5 hover:bg-white/15 transition-colors">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                          <p className="text-[9px] text-white/50 uppercase tracking-wide truncate">{s.status}</p>
                        </div>
                        <p className="font-black text-white text-lg tabular-nums">{s.count}</p>
                      </div>
                    );
                  })}
                  {(stats.assetStats?.byStatus || []).length === 0 && (
                    <div className="col-span-2 bg-white/10 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-white/60 text-sm font-bold">{stats.totalAssets}</p>
                      <p className="text-[10px] text-white/40">total tracked</p>
                    </div>
                  )}
                </div>

                <button onClick={() => router.push('/assets')}
                  className="mt-4 w-full text-xs font-bold bg-white/15 hover:bg-white/25 rounded-xl py-2 flex items-center justify-center gap-2 transition-all">
                  <ArrowRight className="h-3.5 w-3.5" /> View All Assets
                </button>
              </div>
            </div>

            {/* Food Supply */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-200/80 font-bold">{t('food_supply_value')}</p>
                    <p className="text-[10px] text-emerald-300/50 mt-0.5">{t('current_inventory')}</p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-white/15 group-hover:bg-white/25 transition-colors flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Utensils className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-4xl font-black tabular-nums mb-1 leading-none">
                  {(stats.totalFoodSupplyValue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-emerald-300/60 mb-5">QAR</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white/10 rounded-xl px-3.5 py-2.5">
                    <span className="text-xs text-white/70">Items in stock</span>
                    <span className="font-black text-white tabular-nums">{stats.totalFoodItems}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/10 rounded-xl px-3.5 py-2.5">
                    <span className="text-xs text-white/70">Consumed value</span>
                    <span className="font-black text-white tabular-nums text-sm">QAR {(stats.totalFoodConsumption || 0).toLocaleString()}</span>
                  </div>
                  {stats.lowStockItems > 0 ? (
                    <div className="flex items-center gap-2 bg-rose-500/30 border border-rose-400/30 rounded-xl px-3.5 py-2.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-300 flex-shrink-0" />
                      <span className="text-xs text-rose-200 font-bold">{stats.lowStockItems} items low on stock</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-500/20 rounded-xl px-3.5 py-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 flex-shrink-0" />
                      <span className="text-xs text-emerald-200 font-semibold">All stock levels healthy</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setKitchenConsumptionOpen(true)}
                  className="mt-4 w-full text-xs font-bold bg-white/15 hover:bg-white/25 rounded-xl py-2 flex items-center justify-center gap-2 transition-all">
                  <ChefHat className="h-3.5 w-3.5" /> Kitchen Consumption
                </button>
              </div>
            </div>

            {/* Vehicle Costs */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-600 via-amber-700 to-orange-800 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-amber-200/80 font-bold">Vehicles & Maintenance</p>
                    <p className="text-[10px] text-amber-300/50 mt-0.5">{t('this_year')}</p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-white/15 group-hover:bg-white/25 transition-colors flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Car className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-4xl font-black tabular-nums mb-1 leading-none">
                  {(stats.yearlyVehicleCost || 0).toLocaleString()}
                </p>
                <p className="text-xs text-amber-300/60 mb-5">QAR yearly</p>
                <div className="space-y-2">
                  {[
                    { label: 'Yearly Rental', value: stats.yearlyRentalTotal || 0 },
                    { label: 'Yearly Maintenance', value: stats.yearlyMaintenanceTotal || 0 },
                    { label: 'Monthly Average', value: stats.totalVehicleCost || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center bg-white/10 rounded-xl px-3.5 py-2.5">
                      <span className="text-xs text-white/70">{label}</span>
                      <span className="font-black text-white tabular-nums text-sm">QAR {value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setDriverTripSummaryOpen(true)}
                  className="mt-4 w-full text-xs font-bold bg-white/15 hover:bg-white/25 rounded-xl py-2 flex items-center justify-center gap-2 transition-all">
                  <FileText className="h-3.5 w-3.5" /> Driver Trip Summary
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SPENDING RING + RECENT RENTALS (2-col)
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Spending Ring Card */}
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <BarChart3 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-bold text-sm">Spending Breakdown</h3>
            </div>

            <div className="flex items-center gap-6">
              {/* Donut */}
              <div className="relative flex-shrink-0">
                <div className="h-28 w-28 rounded-full" style={{ background: ringGradient }} />
                <div className="absolute inset-[14px] rounded-full bg-card flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground font-semibold">Total</p>
                    <p className="text-xs font-black tabular-nums">{(spendTotal / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-3">
                {[
                  { label: 'Food Consumption', value: foodSpend, color: 'bg-emerald-500', pct: spendTotal ? Math.round((foodSpend / spendTotal) * 100) : 0 },
                  { label: 'Assets Purchased', value: assetsSpend, color: 'bg-violet-500', pct: spendTotal ? Math.round((assetsSpend / spendTotal) * 100) : 0 },
                  { label: 'Vehicles & Maint.', value: vehicleSpend, color: 'bg-amber-500', pct: spendTotal ? Math.round((vehicleSpend / spendTotal) * 100) : 0 },
                ].map(({ label, value, color, pct }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">QAR {value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total Expenditure</span>
              <span className="text-sm font-black tabular-nums">QAR {(stats.totalAmountSpent || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Recent Rentals */}
          <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Car className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-sm">Recent Vehicle Rentals</h3>
              </div>
              <button onClick={() => router.push('/vehicles')}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {(stats.recentRentals || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Car className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">No recent rentals</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Vehicle rentals will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(stats.recentRentals || []).slice(0, 5).map((rental, i) => {
                  const statusColor = rental.vehicle?.status === 'AVAILABLE' ? 'bg-emerald-500' :
                    rental.vehicle?.status === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-blue-500';
                  return (
                    <div key={rental.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <Car className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {rental.vehicle?.make} {rental.vehicle?.model}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {rental.startDate ? new Date(rental.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          {rental.endDate ? ` → ${new Date(rental.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                        <span className="text-xs font-bold tabular-nums">
                          QAR {(rental.vehicle?.rentalAmount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => setDriverTripSummaryOpen(true)}
              className="mt-4 w-full text-xs font-bold text-muted-foreground hover:text-foreground border border-border/60 rounded-xl py-2 flex items-center justify-center gap-2 hover:bg-muted/50 transition-all">
              <FileText className="h-3.5 w-3.5" /> Full Trip Summary
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            FINANCIAL OVERVIEW — Enhanced sub-cards
        ══════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-card border border-border/60 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">{t('financial_overview')}</h2>
                <p className="text-xs text-muted-foreground">{t('track_enterprise_expenses')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-2.5 border border-border/40">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground font-medium">Total:</span>
              <span className="text-sm font-black tabular-nums">{formatCurrency(stats.totalAmountSpent || 0)}</span>
            </div>
          </div>
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <MotionCard delay={0.1}><EnhancedRentalCostsCard monthlyTotal={stats.totalVehicleCost} yearlyTotal={stats.yearlyVehicleCost || stats.totalVehicleCost * 12} monthlyRentalTotal={stats.monthlyRentalTotal} yearlyRentalTotal={stats.yearlyRentalTotal} monthlyMaintenanceTotal={stats.monthlyMaintenanceTotal} yearlyMaintenanceTotal={stats.yearlyMaintenanceTotal} /></MotionCard>
            <MotionCard delay={0.2}><EnhancedFoodExpensesCard monthlyTotal={stats.totalFoodCost} yearlyTotal={stats.totalFoodCost * 12} totalFoodItems={stats.totalFoodItems} lowStockItems={stats.lowStockItems} /></MotionCard>
            <MotionCard delay={0.3} className="sm:col-span-2 lg:col-span-1"><EnhancedAssetsOverviewCard totalAssets={stats.totalAssets} assetStats={stats.assetStats} /></MotionCard>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            BOTTOM: Quick Actions | AI Alerts | Vendor Performance
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <EnhancedQuickActionsSection />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Brain className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="font-bold text-sm">{t('ai_alerts_recommendations')}</h2>
              <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>
            {!isLoading && <AiAlerts className="w-full shadow-sm hover:shadow-md transition-shadow duration-200" />}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Star className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="font-bold text-sm">{t('vendor_performance')}</h2>
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
