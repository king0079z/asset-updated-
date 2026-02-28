// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Car, TrendingUp, Calendar, CalendarClock, ArrowRight, AlertTriangle, RefreshCw } from "lucide-react";
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
}

export function RentalCostsCard({ monthlyTotal = 0, yearlyTotal = 0 }: RentalCostsCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const { t, dir } = useTranslation();
  const [data, setData] = useState({
    monthlyTotal,
    yearlyTotal,
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
    <Card className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900 p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center">
            <Car className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-5 w-5 text-blue-600 dark:text-blue-400`} />
            {t('vehicle_rental_expenses').replace(/_/g, ' ')}
          </h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900"
              onClick={() => fetchData(true)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 text-blue-600 dark:text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="sr-only">{t('refresh')}</span>
            </Button>
            <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
          {data.totalVehicles} {t('vehicles_in_fleet')}
        </p>
      </div>
      
      <CardContent className="p-5 flex-grow dark:bg-card">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-slate-100/50 dark:bg-slate-800/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
              <Car className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('overview')}
            </TabsTrigger>
            <TabsTrigger value="monthly" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
              <Calendar className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('monthly')}
            </TabsTrigger>
            <TabsTrigger value="yearly" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
              <CalendarClock className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('yearly')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('total_vehicles')}</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {isLoading ? "..." : data.totalVehicles}
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('monthly')}</div>
                <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
                  {isLoading ? "..." : formatCurrency(data.monthlyTotal)}
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('annual')}</div>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {isLoading ? "..." : formatCurrency(data.yearlyTotal)}
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
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800 flex flex-col items-center">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">{t('available')}</div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{vehicleStatusCounts.available}</div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-100 dark:border-amber-800 flex flex-col items-center">
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
                          className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all duration-200 cursor-pointer"
                          onClick={() => router.push(`/vehicles/${vehicle.id}`)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {vehicle.make} {vehicle.model}
                            </div>
                            <Badge variant="outline" className={getStatusColor(vehicle.status)}>
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
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-sky-700 dark:text-sky-400">
                  {formatCurrency(data.monthlyTotal)}
                </div>
                <p className="text-sm text-sky-600/80 dark:text-sky-400/80">{t('current_month_expenses')}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <Calendar className="h-7 w-7 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('monthly_budget_utilization')}</span>
                <span className="font-medium text-sky-700 dark:text-sky-400">{Math.round(monthlyPercentage)}%</span>
              </div>
              <Progress value={monthlyPercentage} className="h-2 bg-slate-100 dark:bg-slate-700" indicatorClassName="bg-sky-600 dark:bg-sky-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                  {data.totalVehicles}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center">
                  <Car className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('total_vehicles')}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-500">
                  {vehicleStatusCounts.maintenance}
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                  <AlertTriangle className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('in_maintenance')}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="yearly" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">
                  {formatCurrency(data.yearlyTotal)}
                </div>
                <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80">{t('annual_projection')}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <TrendingUp className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('year_progress')}</span>
                <span className="font-medium text-indigo-700 dark:text-indigo-400">
                  {formatCurrency(data.monthlyTotal)} / {formatCurrency(data.yearlyTotal)}
                </span>
              </div>
              <Progress 
                value={(new Date().getMonth() + 1) / 12 * 100} 
                className="h-2 bg-slate-100 dark:bg-slate-700" 
                indicatorClassName="bg-indigo-600 dark:bg-indigo-500" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xl font-semibold text-sky-600 dark:text-sky-400">
                  {vehicleStatusCounts.rented}
                </div>
                <p className="text-sm text-sky-600 dark:text-sky-400 flex items-center">
                  <Car className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('rented')}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {vehicleStatusCounts.available}
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center">
                  <Car className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('available')}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="bg-slate-50 dark:bg-slate-800 pt-3 pb-3 px-5 border-t border-slate-200 dark:border-slate-700 mt-auto">
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
          onClick={() => router.push('/vehicles')}
        >
          {t('view_all_vehicles')}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}