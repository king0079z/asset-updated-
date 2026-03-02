import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Utensils, ShoppingCart, AlertTriangle, BarChart, ArrowRight, Calendar, Package, RefreshCw, Wallet, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/contexts/TranslationContext";
import { useToast } from "@/components/ui/use-toast";

interface FoodSupplyDetail {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate: string;
  pricePerUnit: number;
  totalValue: number;
  consumedQuantity: number;
  remainingQuantity: number;
  consumedPercentage: number;
}

interface FoodExpensesCardProps {
  monthlyTotal: number;
  yearlyTotal: number;
  totalFoodItems: number;
  lowStockItems: number;
}

export function EnhancedFoodExpensesCard({
  monthlyTotal = 0,
  yearlyTotal = 0,
  totalFoodItems = 0,
  lowStockItems = 0
}: FoodExpensesCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const { t, dir } = useTranslation();
  const { toast } = useToast();
  const [data, setData] = useState({
    monthlyTotal,
    yearlyTotal,
    totalFoodItems,
    lowStockItems,
    totalValue: 0,
    totalConsumed: 0,
    stockLevel: 100,
    topSupplies: [] as FoodSupplyDetail[]
  });

  const fetchData = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/food-supply/expenses', {
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache' : 'default',
          'Pragma': forceRefresh ? 'no-cache' : 'default'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setData({
          monthlyTotal: result.monthlyTotal || 0,
          yearlyTotal: result.yearlyTotal || 0,
          totalFoodItems: result.totalFoodItems || 0,
          lowStockItems: result.lowStockItems || 0,
          totalValue: result.totalValue || 0,
          totalConsumed: result.totalConsumed || 0,
          stockLevel: result.stockLevel || 100,
          topSupplies: result.topSupplies || []
        });
      }
    } catch (error) {
      console.error("Error fetching food expenses:", error);
      toast({
        title: t('error'),
        description: t('failed_to_load_food_data'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    // For large numbers, use abbreviated format
    if (amount >= 1000000) {
      return `QAR ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `QAR ${(amount / 1000).toFixed(1)}K`;
    } else {
      // For smaller numbers, use standard formatting
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'QAR',
        maximumFractionDigits: 0
      }).format(amount);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  // Calculate the current month progress (1-100%)
  const currentDate = new Date();
  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();
  const dayOfMonth = currentDate.getDate();
  const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

  // Calculate the year progress (1-100%)
  const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
  const endOfYear = new Date(currentDate.getFullYear(), 11, 31);
  const yearProgress = Math.round(
    ((currentDate.getTime() - startOfYear.getTime()) /
      (endOfYear.getTime() - startOfYear.getTime())) *
      100
  );

  return (
    <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden bg-card dark:bg-gray-800 relative group transform hover:-translate-y-1 h-full flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 group-hover:h-2 transition-all duration-300"></div>
      
      <CardHeader className="relative pb-2 pt-5">
        <div className="absolute -top-4 left-4 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:shadow-emerald-200 dark:group-hover:shadow-emerald-900 group-hover:scale-110 transition-all duration-300">
          <Utensils className="h-6 w-6 text-white group-hover:animate-pulse" />
        </div>
        <div className="ml-10">
          <CardTitle className="text-emerald-900 dark:text-emerald-300 text-lg group-hover:text-emerald-700 dark:group-hover:text-emerald-200 transition-colors">
            {t('food_supply_expenses').replace(/_/g, ' ')}
          </CardTitle>
          <CardDescription className="text-emerald-700 dark:text-emerald-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-300 transition-colors">
            {t('inventory_consumption_overview')}
          </CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-5 right-4 h-8 w-8 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-900 opacity-70 group-hover:opacity-100"
          onClick={() => fetchData(true)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="sr-only">{t('refresh')}</span>
        </Button>
      </CardHeader>
      
      <CardContent className="pt-4 pb-5 relative z-10 flex-grow">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-white/40 dark:bg-slate-800/40 rounded-lg">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 rounded-md"
            >
              <Package className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('overview')}
            </TabsTrigger>
            <TabsTrigger 
              value="monthly" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 rounded-md"
            >
              <ShoppingCart className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('monthly')}
            </TabsTrigger>
            <TabsTrigger 
              value="yearly" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 rounded-md"
            >
              <BarChart className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('yearly')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-emerald-200 dark:group-hover:border-emerald-700">
                <div>
                  <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('stock_level')}</div>
                  <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{data.stockLevel}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('total_value')}</div>
                  <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                    {isLoading ? "Loading..." : formatCurrency(data.totalValue)}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-emerald-200 dark:group-hover:border-emerald-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{t('consumed_value')}</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{formatCurrency(data.totalConsumed)}</span>
                </div>
                <Progress 
                  value={data.totalValue > 0 ? (data.totalConsumed / (data.totalValue + data.totalConsumed)) * 100 : 0} 
                  className="h-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden" 
                  indicatorClassName="bg-gradient-to-r from-emerald-500 to-teal-600" 
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t('supply_details')}</span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-emerald-700 dark:text-emerald-400 p-0 h-auto"
                    onClick={() => router.push('/food-supply')}
                  >
                    {t('view_all_details')}
                  </Button>
                </div>
                
                <div className="max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                  {isLoading ? (
                    <div className="text-center py-2 text-emerald-600 dark:text-emerald-400">{t('loading_supplies')}</div>
                  ) : data.topSupplies.length > 0 ? (
                    <div className="space-y-3">
                      {data.topSupplies.map((supply) => (
                        <div 
                          key={supply.id} 
                          className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all duration-300 cursor-pointer transform hover:translate-x-1"
                          onClick={() => router.push(`/food-supply?id=${supply.id}`)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-emerald-800 dark:text-emerald-300 truncate mr-2">{supply.name}</div>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 whitespace-nowrap shadow-sm">
                              {supply.unit}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-2 mt-1">
                            <div className="text-sm text-emerald-600 dark:text-emerald-400">
                              <span className="text-emerald-500 dark:text-emerald-500 text-xs">{t('quantity')}:</span> {supply.quantity.toLocaleString()}
                            </div>
                            <div className="text-sm text-emerald-600 dark:text-emerald-400 text-right">
                              <span className="text-emerald-500 dark:text-emerald-500 text-xs">{t('expires')}:</span> {formatDate(supply.expirationDate)}
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(supply.totalValue)}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm">
                              {Math.round(supply.consumedPercentage)}% {t('consumed')}
                            </span>
                          </div>
                          
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex justify-between">
                            <span>{t('remaining')}: {supply.remainingQuantity.toLocaleString()}</span>
                            <span>{t('consumed')}: {supply.consumedQuantity.toLocaleString()}</span>
                          </div>
                          
                          <Progress 
                            value={supply.consumedPercentage} 
                            className="h-1.5 mt-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden" 
                            indicatorClassName="bg-gradient-to-r from-emerald-500 to-teal-600" 
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-emerald-600 dark:text-emerald-400">{t('no_supplies_found')}</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="monthly" className="mt-0 space-y-4">
            <div className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-emerald-200 dark:group-hover:border-emerald-700">
              <div>
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {isLoading ? "Loading..." : formatCurrency(data.monthlyTotal)}
                </div>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">{t('current_month_expenses')}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:shadow-emerald-200 dark:group-hover:shadow-emerald-900 group-hover:scale-110 transition-all duration-300">
                <Wallet className="h-7 w-7 text-white group-hover:animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2 bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-emerald-200 dark:group-hover:border-emerald-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-600/80 dark:text-emerald-400/80">{t('month_progress')}</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">{monthProgress}%</span>
              </div>
              <Progress 
                value={monthProgress} 
                className="h-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden" 
                indicatorClassName="bg-gradient-to-r from-emerald-500 to-teal-600" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-emerald-200 dark:group-hover:border-emerald-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                  {data.totalFoodItems}
                </div>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 flex items-center">
                  <ShoppingCart className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline text-emerald-500`} />
                  {t('total_items')}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-amber-100 dark:border-amber-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-amber-200 dark:group-hover:border-amber-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                  {data.lowStockItems}
                </div>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 flex items-center">
                  <AlertTriangle className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline`} />
                  {t('low_stock')}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="yearly" className="mt-0 space-y-4">
            <div className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-teal-100 dark:border-teal-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-teal-200 dark:group-hover:border-teal-700">
              <div>
                <div className="text-3xl font-bold text-teal-700 dark:text-teal-400">
                  {isLoading ? "Loading..." : formatCurrency(data.yearlyTotal)}
                </div>
                <p className="text-sm text-teal-600/80 dark:text-teal-400/80">{t('year_to_date_expenses')}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg group-hover:shadow-teal-200 dark:group-hover:shadow-teal-900 group-hover:scale-110 transition-all duration-300">
                <BarChart3 className="h-7 w-7 text-white group-hover:animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2 bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-teal-100 dark:border-teal-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-teal-200 dark:group-hover:border-teal-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-teal-600/80 dark:text-teal-400/80">{t('year_progress')}</span>
                <span className="font-medium text-teal-700 dark:text-teal-400">{yearProgress}%</span>
              </div>
              <Progress 
                value={yearProgress} 
                className="h-2.5 bg-teal-100 dark:bg-teal-900/30 rounded-full overflow-hidden" 
                indicatorClassName="bg-gradient-to-r from-teal-500 to-emerald-600" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-teal-100 dark:border-teal-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-teal-200 dark:group-hover:border-teal-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-teal-700 dark:text-teal-400">
                  {data.totalFoodItems}
                </div>
                <p className="text-sm text-teal-600/80 dark:text-teal-400/80 flex items-center">
                  <ShoppingCart className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline`} />
                  {t('total_items')}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-amber-100 dark:border-amber-800/50 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:border-amber-200 dark:group-hover:border-amber-700 transform hover:translate-y-[-2px]">
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                  {data.lowStockItems}
                </div>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 flex items-center">
                  <AlertTriangle className={`h-3.5 w-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} inline`} />
                  {t('low_stock')}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="bg-white/60 dark:bg-slate-800/60 pt-3 pb-3 px-5 border-t border-emerald-100 dark:border-emerald-800/50 mt-auto relative z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 group"
          onClick={() => router.push('/food-supply')}
        >
          {t('view_all_supplies')}
          <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </CardFooter>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-emerald-300 dark:via-emerald-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </Card>
  );
}