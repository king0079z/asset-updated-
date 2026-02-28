// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Car, TrendingUp, Calendar, CalendarClock, ArrowRight, AlertTriangle, RefreshCw, Wallet, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/contexts/TranslationContext";
import { fetchWithCache, invalidateCache } from "@/lib/api-cache";
import { useToast } from "@/components/ui/use-toast";

interface VehicleDetail {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  status: string;
  rentalAmount: number;
  imageUrl?: string;
}

interface RentalCostsCardProps {
  monthlyTotal: number;
  yearlyTotal: number;
  monthlyRentalTotal?: number;
  yearlyRentalTotal?: number;
  monthlyMaintenanceTotal?: number;
  yearlyMaintenanceTotal?: number;
}

export function EnhancedRentalCostsCard({
  monthlyTotal = 0,
  yearlyTotal = 0,
  monthlyRentalTotal = 0,
  yearlyRentalTotal = 0,
  monthlyMaintenanceTotal = 0,
  yearlyMaintenanceTotal = 0
}: RentalCostsCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const { t, dir } = useTranslation();
  const [data, setData] = useState({
    monthlyTotal,
    yearlyTotal,
    monthlyRentalTotal,
    yearlyRentalTotal,
    monthlyMaintenanceTotal,
    yearlyMaintenanceTotal,
    totalVehicles: 0,
    vehicles: [] as VehicleDetail[]
  });

  const { toast } = useToast();
  
  const fetchData = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      
      // If forceRefresh is true, invalidate the cache
      if (forceRefresh) {
        invalidateCache('/api/vehicles/rental-costs');
        invalidateCache('/api/vehicles');
      }
      
      // Fetch both data sources in parallel using the cache utility
      const [costsData, vehiclesData] = await Promise.all([
        fetchWithCache('/api/vehicles/rental-costs', { maxAge: 10 * 60 * 1000 }), // 10 minutes cache
        fetchWithCache('/api/vehicles', { maxAge: 10 * 60 * 1000 }) // 10 minutes cache
      ]);
      
      // Update state with whatever data we have
      setData({
        monthlyTotal: costsData?.monthlyTotal || monthlyTotal || 0,
        yearlyTotal: costsData?.yearlyTotal || yearlyTotal || 0,
        monthlyRentalTotal: costsData?.monthlyRentalTotal || monthlyRentalTotal || 0,
        yearlyRentalTotal: costsData?.yearlyRentalTotal || yearlyRentalTotal || 0,
        monthlyMaintenanceTotal: costsData?.monthlyMaintenanceTotal || monthlyMaintenanceTotal || 0,
        yearlyMaintenanceTotal: costsData?.yearlyMaintenanceTotal || yearlyMaintenanceTotal || 0,
        totalVehicles: vehiclesData?.vehicles?.length || 0,
        vehicles: vehiclesData?.vehicles || []
      });
    } catch (error) {
      console.error("Error in fetchData:", error);
      toast({
        title: t('error'),
        description: t('failed_to_load_rental_data'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [monthlyTotal, yearlyTotal]);

  const formatCurrency = (amount: number) => {
    // For large numbers, use abbreviated format
    if (amount >= 1000000) {
      return `QAR ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `QAR ${(amount / 1000).toFixed(1)}K`;
    } else {
      // For smaller numbers, use standard formatting with QAR currency
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'QAR',
        maximumFractionDigits: 0
      }).format(amount);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
      case 'RENTED':
        return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800';
      case 'MAINTENANCE':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'DISPOSED':
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  // Calculate what percentage of the year's budget has been spent this month
  const monthlyPercentage = Math.min((data.monthlyTotal / (data.yearlyTotal / 12)) * 100, 100);
  
  // Count vehicles by status
  const vehicleStatusCounts = {
    available: data.vehicles.filter(v => v.status?.toUpperCase() === 'AVAILABLE').length,
    rented: data.vehicles.filter(v => v.status?.toUpperCase() === 'RENTED').length,
    maintenance: data.vehicles.filter(v => v.status?.toUpperCase() === 'MAINTENANCE').length
  };
  
  return (
    <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden bg-card dark:bg-gray-800 relative group transform hover:-translate-y-1 h-full flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 group-hover:h-2 transition-all duration-300"></div>
      
      <CardHeader className="relative pb-2 pt-5">
        <div className="absolute -top-4 left-4 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-indigo-200 dark:group-hover:shadow-indigo-900 group-hover:scale-110 transition-all duration-300">
          <Car className="h-6 w-6 text-white group-hover:animate-pulse" />
        </div>
        <div className="ml-10">
          <CardTitle className="text-indigo-900 dark:text-indigo-300 text-lg group-hover:text-indigo-700 dark:group-hover:text-indigo-200 transition-colors">
            {t('vehicle_rental_expenses').replace(/_/g, ' ')}
          </CardTitle>
          <CardDescription className="text-indigo-700 dark:text-indigo-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors">
            {data.totalVehicles} {t('vehicles_in_fleet')}
          </CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-5 right-4 h-8 w-8 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900 opacity-70 group-hover:opacity-100"
          onClick={() => fetchData(true)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 text-blue-600 dark:text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="sr-only">{t('refresh')}</span>
        </Button>
      </CardHeader>
      
      <CardContent className="pt-4 pb-5 relative z-10 flex-grow">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-white/40 dark:bg-slate-800/40 rounded-lg">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 rounded-md"
            >
              <Car className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('overview')}
            </TabsTrigger>
            <TabsTrigger 
              value="monthly" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 rounded-md"
            >
              <Calendar className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('monthly')}
            </TabsTrigger>
            <TabsTrigger 
              value="yearly" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 rounded-md"
            >
              <CalendarClock className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('yearly')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-center bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-700">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('total_vehicles')}</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {isLoading ? "..." : data.totalVehicles}
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-700">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('monthly')}</div>
                <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
                  {isLoading ? "..." : formatCurrency(data.monthlyTotal)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('rental')}: {isLoading ? "..." : formatCurrency(data.monthlyRentalTotal || 0)}
                  <br />
                  {t('maintenance')}: {isLoading ? "..." : formatCurrency(data.monthlyMaintenanceTotal || 0)}
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-700">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('annual')}</div>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {isLoading ? "..." : formatCurrency(data.yearlyTotal)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('rental')}: {isLoading ? "..." : formatCurrency(data.yearlyRentalTotal || 0)}
                  <br />
                  {t('maintenance')}: {isLoading ? "..." : formatCurrency(data.yearlyMaintenanceTotal || 0)}
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('vehicle_status')}</h4>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-indigo-600 dark:text-indigo-400 p-0 h-auto"
                  onClick={() => router.push('/vehicles')}
                >
                  {t('view_all')}
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50/80 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800/50 flex flex-col items-center shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-emerald-200 dark:group-hover:border-emerald-700">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">{t('available')}</div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{vehicleStatusCounts.available}</div>
                </div>
                
                <div className="bg-amber-50/80 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-100 dark:border-amber-800/50 flex flex-col items-center shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-amber-200 dark:group-hover:border-amber-700">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">{t('maintenance')}</div>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{vehicleStatusCounts.maintenance}</div>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t('vehicle_details')}</h4>
                <div className="max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                  {isLoading ? (
                    <div className="text-center py-2 text-slate-500 dark:text-slate-400">{t('loading_vehicles')}</div>
                  ) : data.vehicles.length > 0 ? (
                    <div className="space-y-2">
                      {data.vehicles.map((vehicle) => (
                        <div 
                          key={vehicle.id} 
                          className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-300 cursor-pointer transform hover:translate-x-1"
                          onClick={() => router.push(`/vehicles/${vehicle.id}`)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {vehicle.make} {vehicle.model}
                            </div>
                            <Badge variant="outline" className={`${getStatusColor(vehicle.status)} shadow-sm`}>
                              {vehicle.status}
                            </Badge>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2 text-sm">
                            <div className="text-slate-500 dark:text-slate-400">
                              {vehicle.year} • {vehicle.plateNumber}
                            </div>
                            <div className="font-medium text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(vehicle.rentalAmount)}
                              <span className={`text-xs text-slate-400 dark:text-slate-500 ${dir === 'rtl' ? 'mr-1' : 'ml-1'}`}>/ {t('monthly')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-slate-500 dark:text-slate-400">{t('no_vehicles_found')}</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="monthly" className="mt-0 space-y-4">
            <div className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-700">
              <div>
                <div className="text-3xl font-bold text-sky-700 dark:text-sky-400">
                  {formatCurrency(data.monthlyTotal)}
                </div>
                <p className="text-sm text-sky-600/80 dark:text-sky-400/80">{t('current_month_expenses')}</p>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('rental')}: {formatCurrency(data.monthlyRentalTotal || 0)}<br />
                  {t('maintenance')}: {formatCurrency(data.monthlyMaintenanceTotal || 0)}
                </div>
              </div>
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:shadow-sky-200 dark:group-hover:shadow-sky-900 group-hover:scale-110 transition-all duration-300">
                <Wallet className="h-7 w-7 text-white group-hover:animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2 bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('monthly_budget_utilization')}</span>
                <span className="font-medium text-sky-700 dark:text-sky-400">{Math.round(monthlyPercentage)}%</span>
              </div>
              <Progress 
                value={monthlyPercentage} 
                className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" 
                indicatorClassName="bg-gradient-to-r from-sky-500 to-blue-600" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                  {data.totalVehicles}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center">
                  <Car className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline text-blue-500`} />
                  {t('total_vehicles')}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-amber-100 dark:border-amber-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-amber-200 dark:group-hover:border-amber-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-500">
                  {vehicleStatusCounts.maintenance}
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                  <AlertTriangle className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline`} />
                  {t('in_maintenance')}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="yearly" className="mt-0 space-y-4">
            <div className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-indigo-200 dark:group-hover:border-indigo-700">
              <div>
                <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">
                  {formatCurrency(data.yearlyTotal)}
                </div>
                <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80">{t('annual_projection')}</p>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('rental')}: {formatCurrency(data.yearlyRentalTotal || 0)}<br />
                  {t('maintenance')}: {formatCurrency(data.yearlyMaintenanceTotal || 0)}
                </div>
              </div>
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-indigo-200 dark:group-hover:shadow-indigo-900 group-hover:scale-110 transition-all duration-300">
                <BarChart3 className="h-7 w-7 text-white group-hover:animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2 bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-indigo-200 dark:group-hover:border-indigo-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('year_progress')}</span>
                <span className="font-medium text-indigo-700 dark:text-indigo-400">
                  {formatCurrency(data.monthlyTotal)} / {formatCurrency(data.yearlyTotal)}
                </span>
              </div>
              <Progress 
                value={(new Date().getMonth() + 1) / 12 * 100} 
                className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" 
                indicatorClassName="bg-gradient-to-r from-indigo-500 to-purple-600" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-sky-100 dark:border-sky-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-sky-200 dark:group-hover:border-sky-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-sky-600 dark:text-sky-400">
                  {vehicleStatusCounts.rented}
                </div>
                <p className="text-sm text-sky-600 dark:text-sky-400 flex items-center">
                  <Car className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline`} />
                  {t('rented')}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-emerald-200 dark:group-hover:border-emerald-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {vehicleStatusCounts.available}
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center">
                  <Car className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline`} />
                  {t('available')}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="bg-white/60 dark:bg-slate-800/60 pt-3 pb-3 px-5 border-t border-blue-100 dark:border-blue-800/50 mt-auto relative z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 group"
          onClick={() => router.push('/vehicles')}
        >
          {t('view_all_vehicles')}
          <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </CardFooter>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </Card>
  );
}