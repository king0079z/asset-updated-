import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';
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
  Star
} from "lucide-react";
import { AiAlerts } from "@/components/AiAlerts";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useRouter } from 'next/router';
import { useEffect, useState } from "react";
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
    setIsLoading(true);
    
    const fetchStats = async () => {
      try {
        console.log('Dashboard: Starting to fetch data');
        
        // Enhanced fetch function with error handling
        const fetchData = async (url: string) => {
          // Add timestamp to URL to prevent caching
          const cacheBustUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
          const options = {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          };
          
          // Use the centralized error handling utility with default values
          const data = await fetchWithErrorHandling(cacheBustUrl, options, null);
          if (data) {
            console.log(`Dashboard: Successfully fetched data from ${url}`);
          }
          return data || {};
        };
        
        // Use Promise.allSettled to fetch all data in parallel
        // This allows us to continue even if some requests fail
        const [
          dashboardResult,
          rentalCostsResult,
          foodConsumptionResult,
          foodValueResult,
          totalSpentResult
        ] = await Promise.allSettled([
          fetchData('/api/dashboard/stats'),
          fetchData('/api/vehicles/rental-costs'),
          fetchData('/api/food-supply/total-consumed'),
          fetchData('/api/food-supply/total-value'),
          fetchData('/api/dashboard/total-spent')
        ]);
        
        // Log the results for debugging
        console.log('Dashboard: API results:', {
          dashboardStatus: dashboardResult.status,
          rentalCostsStatus: rentalCostsResult.status,
          foodConsumptionStatus: foodConsumptionResult.status,
          foodValueStatus: foodValueResult.status,
          totalSpentStatus: totalSpentResult.status
        });
        
        // Extract data from successful requests or use defaults
        const dashboardData = dashboardResult.status === 'fulfilled' ? dashboardResult.value : {
          totalAssets: 0,
          totalFoodItems: 0,
          activeVehicleRentals: 0,
          lowStockItems: 0,
          totalFoodCost: 0,
          totalVehicleCost: 0,
          recentRentals: [],
          vehicleStats: [],
          assetStats: {
            byStatus: [],
            totalValue: 0,
            disposedValue: 0
          }
        };
        
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
            vehicleRentalCosts: 0 
          } 
        };
        
        // Check if all requests failed
        const allFailed = [
          dashboardResult.status,
          rentalCostsResult.status,
          foodConsumptionResult.status,
          foodValueResult.status,
          totalSpentResult.status
        ].every(status => status === 'rejected');
        
        if (allFailed) {
          console.warn("Dashboard: All API requests failed. Using default values.");
          toast({
            title: "Warning",
            description: "Could not load dashboard data. Some information may be missing.",
            variant: "destructive",
          });
        }
        
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
        
        // Combine all data into a validated stats object
        const validatedStats = {
          totalAssets: parseNumber(dashboardData.totalAssets),
          totalFoodItems: parseNumber(dashboardData.totalFoodItems),
          activeVehicleRentals: parseNumber(dashboardData.activeVehicleRentals),
          lowStockItems: parseNumber(dashboardData.lowStockItems),
          totalFoodCost: parseNumber(dashboardData.totalFoodCost),
          // Use rental+maintenance costs from dedicated API
          totalVehicleCost: parseNumber(rentalCostsData.monthlyTotal || dashboardData.totalVehicleCost),
          yearlyVehicleCost: parseNumber(rentalCostsData.yearlyTotal),
          monthlyRentalTotal: parseNumber(rentalCostsData.monthlyRentalTotal),
          yearlyRentalTotal: parseNumber(rentalCostsData.yearlyRentalTotal),
          monthlyMaintenanceTotal: parseNumber(rentalCostsData.monthlyMaintenanceTotal),
          yearlyMaintenanceTotal: parseNumber(rentalCostsData.yearlyMaintenanceTotal),
          // Use total food consumption from dedicated API
          totalFoodConsumption: parseNumber(totalFoodConsumptionData.totalConsumed),
          // Use total food supply value from dedicated API
          totalFoodSupplyValue: parseNumber(totalFoodValueData.totalValue),
          // Use total amount spent from dedicated API
          totalAmountSpent: parseNumber(totalAmountSpentData.totalAmountSpent),
          amountSpentBreakdown: {
            foodConsumption: parseNumber(totalAmountSpentData.breakdown?.foodConsumption),
            assetsPurchased: parseNumber(totalAmountSpentData.breakdown?.assetsPurchased),
            vehicleRentalCosts: parseNumber(totalAmountSpentData.breakdown?.vehicleRentalCosts)
          },
          recentRentals: Array.isArray(dashboardData.recentRentals) ? dashboardData.recentRentals : [],
          vehicleStats: Array.isArray(dashboardData.vehicleStats) ? dashboardData.vehicleStats : [],
          assetStats: {
            byStatus: Array.isArray(dashboardData.assetStats?.byStatus) ? dashboardData.assetStats.byStatus : [],
            totalValue: parseNumber(dashboardData.assetStats?.totalValue),
            disposedValue: parseNumber(dashboardData.assetStats?.disposedValue)
          }
        };
        
        console.log('Dashboard: Validated stats:', validatedStats);
        setStats(validatedStats);
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
      <div className={`dashboard-container flex-1 space-y-5 p-4 sm:p-5 md:p-6 pb-24 sm:pb-24 md:pb-8 ${dir === 'rtl' ? 'text-right' : ''}`}>
        {/* Welcome Section - More Compact */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="dashboard-title text-slate-800 dark:text-slate-100">
                {t('welcome_back')}{user?.email ? `, ${user.email.split('@')[0]}` : ''}
              </h1>
              <p className="dashboard-subtitle text-slate-500 dark:text-slate-400 mt-1">{formattedDate}</p>
              <p className="dashboard-subtitle text-slate-600 dark:text-slate-300 mt-1.5 max-w-2xl">
                {t('your_enterprise_dashboard')}
              </p>
            </div>
          </div>
        </div>

        {/* Key Performance Metrics */}
        <div className="dashboard-section">
          <h2 className="section-header flex items-center text-slate-800 dark:text-slate-100">
            <Activity className={`${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} h-4 w-4 text-indigo-600 dark:text-indigo-400`} />
            {t('key_performance_metrics')}
          </h2>
          <div className="dashboard-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Amount Spent Card */}
            <Card className="enhanced-card relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 opacity-50 group-hover:opacity-80 transition-opacity duration-300"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
              <CardHeader className="relative pb-2 pt-4">
                <div className="absolute -top-3 left-3 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-300">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <div className="ml-8">
                  <CardTitle className="card-title text-indigo-900 dark:text-indigo-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-200 transition-colors">
                    {t('total_amount_spent').replace(/_/g, ' ')}
                  </CardTitle>
                  <CardDescription className="card-description text-indigo-700 dark:text-indigo-400">
                    {t('this_year')}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pb-4 relative z-10">
                <div className="flex flex-col">
                  <span className="metric-value text-slate-800 dark:text-slate-100 mb-2 group-hover:text-indigo-900 dark:group-hover:text-indigo-200 transition-colors">
                    QAR {(stats.totalAmountSpent || 0).toLocaleString()}
                  </span>
                  <div className="mt-2 space-y-3">
                    <div className="space-y-1.5 transform transition-transform duration-300 group-hover:translate-x-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('food_consumption')}</span>
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">QAR {(stats.amountSpentBreakdown?.foodConsumption || 0).toLocaleString()}</span>
                      </div>
                      <Progress 
                        value={stats.totalAmountSpent ? (stats.amountSpentBreakdown?.foodConsumption || 0) / stats.totalAmountSpent * 100 : 0} 
                        className="h-2 bg-slate-100 dark:bg-slate-700 group-hover:bg-slate-50 dark:group-hover:bg-slate-600 transition-colors" 
                        indicatorClassName="bg-emerald-500 group-hover:bg-emerald-400 transition-colors" 
                      />
                    </div>
                    
                    <div className="space-y-1.5 transform transition-transform duration-300 group-hover:translate-x-1 delay-75">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('assets_purchased')}</span>
                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">QAR {(stats.amountSpentBreakdown?.assetsPurchased || 0).toLocaleString()}</span>
                      </div>
                      <Progress 
                        value={stats.totalAmountSpent ? (stats.amountSpentBreakdown?.assetsPurchased || 0) / stats.totalAmountSpent * 100 : 0} 
                        className="h-2 bg-slate-100 dark:bg-slate-700 group-hover:bg-slate-50 dark:group-hover:bg-slate-600 transition-colors" 
                        indicatorClassName="bg-indigo-500 group-hover:bg-indigo-400 transition-colors" 
                      />
                    </div>
                    
                    <div className="space-y-1.5 transform transition-transform duration-300 group-hover:translate-x-1 delay-150">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {t('vehicle_rentals')} + {t('maintenance')}
                        </span>
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          QAR {(
                            (stats.amountSpentBreakdown?.vehicleRentalCosts || 0) +
                            (stats.amountSpentBreakdown?.vehicleMaintenanceCosts || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{t('rental')}:</span>
                        <span>QAR {(stats.amountSpentBreakdown?.vehicleRentalCosts || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                        <span>{t('maintenance')}:</span>
                        <span>QAR {(stats.amountSpentBreakdown?.vehicleMaintenanceCosts || 0).toLocaleString()}</span>
                      </div>
                      <Progress 
                        value={stats.totalAmountSpent
                          ? (
                              ((stats.amountSpentBreakdown?.vehicleRentalCosts || 0) +
                              (stats.amountSpentBreakdown?.vehicleMaintenanceCosts || 0)) /
                              stats.totalAmountSpent * 100
                            )
                          : 0
                        }
                        className="h-2 bg-slate-100 dark:bg-slate-700 group-hover:bg-slate-50 dark:group-hover:bg-slate-600 transition-colors" 
                        indicatorClassName="bg-amber-500 group-hover:bg-amber-400 transition-colors" 
                      />
                    </div>
                    
                    <Button 
                      onClick={() => setConsumptionAnalysisOpen(true)}
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2 bg-white/50 dark:bg-slate-800/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-all flex items-center justify-center"
                    >
                      <BarChart3 className="h-4 w-4 mr-2 text-blue-500" />
                      <span className="hidden xs:inline">{t('view_detailed_analysis')}</span>
                      <span className="xs:hidden">{t('analysis')}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </Card>

            {/* Total Asset Value Card */}
            <Card className="enhanced-card relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 opacity-50 group-hover:opacity-80 transition-opacity duration-300"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
              <CardHeader className="relative pb-2 pt-4">
                <div className="absolute -top-3 left-3 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-300">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div className="ml-8">
                  <CardTitle className="card-title text-indigo-900 dark:text-indigo-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-200 transition-colors">
                    {t('total_asset_value')}
                  </CardTitle>
                  <CardDescription className="card-description text-indigo-700 dark:text-indigo-400">
                    {t('current_valuation')}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pb-4 relative z-10">
                <div className="flex flex-col">
                  <span className="metric-value text-slate-800 dark:text-slate-100 mb-2 group-hover:text-purple-900 dark:group-hover:text-purple-200 transition-colors">
                    QAR {(stats.assetStats.totalValue).toLocaleString()}
                  </span>
                  <div className="flex items-center text-xs">
                    <div className="flex items-center bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-full font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M18 15l-6-6-6 6"/>
                      </svg>
                      <span>1%</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">vs last month</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Food Supply Value Card */}
            <Card className="enhanced-card relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 opacity-50 group-hover:opacity-80 transition-opacity duration-300"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
              <CardHeader className="relative pb-2 pt-4">
                <div className="absolute -top-3 left-3 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-300">
                  <Utensils className="h-5 w-5 text-white" />
                </div>
                <div className="ml-8">
                  <CardTitle className="card-title text-emerald-900 dark:text-emerald-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-200 transition-colors">
                    {t('food_supply_value')}
                  </CardTitle>
                  <CardDescription className="card-description text-emerald-700 dark:text-emerald-400">
                    {t('current_inventory')}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pb-4 relative z-10">
                <div className="flex flex-col">
                  <span className="metric-value text-slate-800 dark:text-slate-100 mb-2 group-hover:text-emerald-900 dark:group-hover:text-emerald-200 transition-colors">
                    QAR {(stats.totalFoodSupplyValue || 0).toLocaleString()}
                  </span>
                  <div className="flex items-center text-xs mb-3">
                    <div className="flex items-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                      <span>2%</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">vs last month</span>
                  </div>
                  <Button 
                    onClick={() => setKitchenConsumptionOpen(true)}
                    variant="outline" 
                    size="sm" 
                    className="btn-compact w-full bg-white/50 dark:bg-slate-800/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center justify-center"
                  >
                    <BarChart3 className="h-3 w-3 mr-1.5 text-emerald-500" />
                    <span className="hidden xs:inline">{t('view_kitchen_consumption')}</span>
                    <span className="xs:hidden">{t('consumption')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Total Rental Fees Card (now includes maintenance) */}
            <Card className="enhanced-card relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 opacity-50 group-hover:opacity-80 transition-opacity duration-300"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
              <CardHeader className="relative pb-2 pt-4">
                <div className="absolute -top-3 left-3 w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-300">
                  <Car className="h-5 w-5 text-white" />
                </div>
                <div className="ml-8">
                  <CardTitle className="card-title text-amber-900 dark:text-amber-300 group-hover:text-amber-700 dark:group-hover:text-amber-200 transition-colors">
                    {t('total_rental_fees')} + {t('maintenance')}
                  </CardTitle>
                  <CardDescription className="card-description text-amber-700 dark:text-amber-400">
                    {t('this_year')}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pb-4 relative z-10">
                <div className="flex flex-col">
                  <span className="metric-value text-slate-800 dark:text-slate-100 mb-2 group-hover:text-amber-900 dark:group-hover:text-amber-200 transition-colors">
                    QAR {(stats.yearlyVehicleCost || 0).toLocaleString()}
                  </span>
                  <div className="flex flex-col gap-1 text-xs mb-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-amber-700 dark:text-amber-400">{t('rental')}:</span>
                      <span className="text-slate-700 dark:text-slate-300">QAR {(stats.yearlyRentalTotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-amber-700 dark:text-amber-400">{t('maintenance')}:</span>
                      <span className="text-slate-700 dark:text-slate-300">QAR {(stats.yearlyMaintenanceTotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 flex items-center text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-100 dark:border-amber-800/50">
                      <Calendar className="h-3 w-3 text-amber-600 dark:text-amber-400 mr-1.5" />
                      <span className="text-amber-800 dark:text-amber-300 font-medium">Monthly: QAR {(stats.totalVehicleCost || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setDriverTripSummaryOpen(true)}
                    variant="outline" 
                    size="sm" 
                    className="btn-compact w-full bg-white/50 dark:bg-slate-800/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center justify-center"
                  >
                    <FileText className="h-3 w-3 mr-1.5 text-amber-500" />
                    <span className="hidden xs:inline">{t('view_driver_trip_summary')}</span>
                    <span className="xs:hidden">{t('trip_summary')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Budget Overview Cards */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card dark:bg-gray-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold flex items-center text-slate-800 dark:text-slate-100">
                <BarChart3 className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-5 w-5 text-slate-700 dark:text-slate-300`} />
                {t('financial_overview')}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                {t('track_enterprise_expenses')}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 dark:bg-gray-700 px-3 sm:px-4 py-2 rounded-lg border border-slate-200 dark:border-gray-600 shadow-sm mt-2 md:mt-0">
              <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Total Expenses:</span>
              <span className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                {formatCurrency(stats.totalAmountSpent || 0)}
              </span>
            </div>
          </div>
          
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {/* Vehicle Rentals Card with Monthly and Yearly Costs */}
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

            {/* Food Supply Expenses Card */}
            <MotionCard delay={0.2}>
              <EnhancedFoodExpensesCard 
                monthlyTotal={stats.totalFoodCost} 
                yearlyTotal={stats.totalFoodCost * 12} 
                totalFoodItems={stats.totalFoodItems}
                lowStockItems={stats.lowStockItems}
              />
            </MotionCard>

            {/* Assets Overview Card */}
            <MotionCard delay={0.3} className="sm:col-span-2 lg:col-span-1">
              <EnhancedAssetsOverviewCard 
                totalAssets={stats.totalAssets} 
                assetStats={stats.assetStats} 
              />
            </MotionCard>
          </div>
        </div>

        {/* Quick Actions & AI Alerts Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Actions - Left Side */}
          <EnhancedQuickActionsSection />
          
          {/* AI Alerts & Recommendations - Middle */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center text-slate-800 dark:text-slate-100">
              <div className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mr-2">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              {t('ai_alerts_recommendations')}
            </h2>
            <div className="transform transition-all duration-300 hover:-translate-y-1">
              <AiAlerts className="w-full h-full shadow-md hover:shadow-lg transition-all duration-300" />
            </div>
          </div>

          {/* Vendor Performance Reminders - Right Side */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center text-slate-800 dark:text-slate-100">
              <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 mr-2">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
              </div>
              {t('vendor_performance')}
            </h2>
            <div className="transform transition-all duration-300 hover:-translate-y-1">
              <EnhancedVendorPerformanceCard />
            </div>
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