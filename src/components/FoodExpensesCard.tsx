import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Utensils, ShoppingCart, AlertTriangle, BarChart, ArrowRight, Calendar, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/contexts/TranslationContext";

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

export function FoodExpensesCard({
  monthlyTotal = 0,
  yearlyTotal = 0,
  totalFoodItems = 0,
  lowStockItems = 0
}: FoodExpensesCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const { t, dir } = useTranslation();
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/food-supply/expenses', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
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
      } finally {
        setIsLoading(false);
      }
    };

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
    <Card className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      <div className="bg-gradient-to-r from-slate-50 to-green-50 dark:from-slate-800 dark:to-green-900 p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center">
            <Utensils className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-5 w-5 text-green-600 dark:text-green-400`} />
            {t('food_supply_expenses').replace(/_/g, ' ')}
          </h3>
          <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full">
            <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-300" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
          {t('inventory_consumption_overview')}
        </p>
      </div>
      <CardContent className="p-5 flex-grow dark:bg-card">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-slate-100/50 dark:bg-slate-800/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
              <Package className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('overview')}
            </TabsTrigger>
            <TabsTrigger value="monthly" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
              <ShoppingCart className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('monthly')}
            </TabsTrigger>
            <TabsTrigger value="yearly" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
              <BarChart className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('yearly')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
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
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{t('consumed_value')}</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{formatCurrency(data.totalConsumed)}</span>
                </div>
                <Progress 
                  value={data.totalValue > 0 ? (data.totalConsumed / (data.totalValue + data.totalConsumed)) * 100 : 0} 
                  className="h-2 bg-emerald-100 dark:bg-emerald-900/30" 
                  indicatorClassName="bg-emerald-600 dark:bg-emerald-500" 
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
                        <div key={supply.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800 hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-sm transition-all duration-200">
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-emerald-800 dark:text-emerald-300 truncate mr-2">{supply.name}</div>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 whitespace-nowrap">
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
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              {Math.round(supply.consumedPercentage)}% {t('consumed')}
                            </span>
                          </div>
                          
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex justify-between">
                            <span>{t('remaining')}: {supply.remainingQuantity.toLocaleString()}</span>
                            <span>{t('consumed')}: {supply.consumedQuantity.toLocaleString()}</span>
                          </div>
                          
                          <Progress 
                            value={supply.consumedPercentage} 
                            className="h-1.5 mt-1.5 bg-emerald-100 dark:bg-emerald-900/30" 
                            indicatorClassName="bg-emerald-600 dark:bg-emerald-500" 
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
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {isLoading ? "Loading..." : formatCurrency(data.monthlyTotal)}
                </div>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">{t('current_month_expenses')}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ShoppingCart className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-600/80 dark:text-emerald-400/80">{t('month_progress')}</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">{monthProgress}%</span>
              </div>
              <Progress value={monthProgress} className="h-2 bg-emerald-100 dark:bg-emerald-900/30" indicatorClassName="bg-emerald-600 dark:bg-emerald-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
                <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                  {data.totalFoodItems}
                </div>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 flex items-center">
                  <ShoppingCart className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('total_items')}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-amber-800">
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                  {data.lowStockItems}
                </div>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 flex items-center">
                  <AlertTriangle className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('low_stock')}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="yearly" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-teal-700 dark:text-teal-400">
                  {isLoading ? "Loading..." : formatCurrency(data.yearlyTotal)}
                </div>
                <p className="text-sm text-teal-600/80 dark:text-teal-400/80">{t('year_to_date_expenses')}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <BarChart className="h-7 w-7 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-teal-600/80 dark:text-teal-400/80">{t('year_progress')}</span>
                <span className="font-medium text-teal-700 dark:text-teal-400">{yearProgress}%</span>
              </div>
              <Progress value={yearProgress} className="h-2 bg-teal-100 dark:bg-teal-900/30" indicatorClassName="bg-teal-600 dark:bg-teal-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-teal-100 dark:border-teal-800">
                <div className="text-xl font-semibold text-teal-700 dark:text-teal-400">
                  {data.totalFoodItems}
                </div>
                <p className="text-sm text-teal-600/80 dark:text-teal-400/80 flex items-center">
                  <ShoppingCart className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('total_items')}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-teal-100 dark:border-amber-800">
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                  {data.lowStockItems}
                </div>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 flex items-center">
                  <AlertTriangle className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'} inline`} />
                  {t('low_stock')}
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
          className="ml-auto text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50"
          onClick={() => router.push('/food-supply')}
        >
          {t('view_all_supplies')}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}