// @ts-nocheck
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, TrendingUp, ArrowUpDown, Info, PieChart, BarChart3, DollarSign } from "lucide-react";
import { PrintAllKitchenConsumptionReportButton } from "./PrintAllKitchenConsumptionReportButton";
import { useTranslation } from "@/contexts/TranslationContext";

interface KitchenConsumptionSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface KitchenTotal {
  id: string;
  name: string;
  floorNumber: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
}

interface AIRecommendation {
  kitchenId: string;
  kitchenName: string;
  recommendations: string[];
}

export function KitchenConsumptionSummaryDialog({ open, onOpenChange }: KitchenConsumptionSummaryDialogProps) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [kitchenTotals, setKitchenTotals] = useState<KitchenTotal[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [activeTab, setActiveTab] = useState<"monthly" | "total" | "recommendations">("monthly");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/kitchens/monthly-consumption");
      if (response.ok) {
        const data = await response.json();
        setChartData(data.chartData);
        setKitchenTotals(data.kitchenTotals);
        if (data.aiRecommendations) {
          setAiRecommendations(data.aiRecommendations);
        }
      } else {
        console.error("Failed to fetch kitchen consumption data");
      }
    } catch (error) {
      console.error("Error fetching kitchen consumption data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get colors for different kitchens
  const getKitchenColor = (index: number) => {
    const colors = [
      "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", 
      "#00C49F", "#FFBB28", "#FF8042", "#a4de6c", "#d0ed57"
    ];
    return colors[index % colors.length];
  };

  // Calculate totals across all kitchens
  const grandTotalCost = kitchenTotals.reduce((sum, kitchen) => sum + kitchen.totalCost, 0);
  const grandTotalRevenue = kitchenTotals.reduce((sum, kitchen) => sum + kitchen.totalRevenue, 0);
  const grandTotalProfit = kitchenTotals.reduce((sum, kitchen) => sum + kitchen.totalProfit, 0);

  // Prepare data for total consumption chart
  const totalConsumptionData = [...kitchenTotals]
    .sort((a, b) => sortOrder === "desc" ? b.totalCost - a.totalCost : a.totalCost - b.totalCost)
    .map((kitchen, index) => ({
      name: kitchen.name,
      cost: kitchen.totalCost,
      revenue: kitchen.totalRevenue,
      profit: kitchen.totalProfit,
      floor: kitchen.floorNumber,
      color: getKitchenColor(index)
    }));

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
  };

  // Custom tooltip for monthly chart
  const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const totalForMonth = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
      
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-bold text-gray-800 dark:text-gray-200 mb-2">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              entry.value > 0 && (
                <div key={index} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{entry.name}</span>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(entry.value)}</span>
                </div>
              )
            ))}
            <div className="pt-1.5 mt-1.5 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-sm text-gray-800 dark:text-gray-200">{t('total')}:</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{formatCurrency(totalForMonth)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for total chart
  const CustomTotalTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const costPercentage = ((data.cost / grandTotalCost) * 100).toFixed(1);
      const profitMargin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : '0';
      
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">{data.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('floor')} {data.floor}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('cost')}:</span>
              <span className="text-sm font-medium">{formatCurrency(data.cost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('revenue')}:</span>
              <span className="text-sm font-medium">{formatCurrency(data.revenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('profit')}:</span>
              <span className={`text-sm font-medium ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.profit)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('cost_percentage')}:</span>
              <span className="text-sm font-medium">{costPercentage}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('profit_margin')}:</span>
              <span className={`text-sm font-medium ${Number(profitMargin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profitMargin}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-6 border-b border-emerald-100 dark:border-emerald-800/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl text-emerald-900 dark:text-emerald-300">
              <Building className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              {t('kitchen_consumption_summary')}
            </DialogTitle>
            <DialogDescription className="text-emerald-700 dark:text-emerald-400 mt-1">
              {t('monthly_consumption_details')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                {t('total_cost')}: {formatCurrency(grandTotalCost)}
              </Badge>
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 px-3 py-1.5">
                <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                {t('total_revenue')}: {formatCurrency(grandTotalRevenue)}
              </Badge>
              <Badge variant={grandTotalProfit >= 0 ? "outline" : "destructive"} className={`bg-white/80 dark:bg-gray-800/50 ${grandTotalProfit >= 0 ? 'text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' : ''} px-3 py-1.5`}>
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                {t('total_profit')}: {formatCurrency(grandTotalProfit)}
              </Badge>
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 px-3 py-1.5">
                <Building className="h-3.5 w-3.5 mr-1.5" />
                {t('kitchens')}: {kitchenTotals.length}
              </Badge>
            </div>
            <PrintAllKitchenConsumptionReportButton 
              chartData={chartData}
              kitchenTotals={kitchenTotals}
            />
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="monthly" onClick={(e) => e.stopPropagation()} className="data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-900/30 data-[state=active]:text-emerald-800 dark:data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('monthly_breakdown')}
              </TabsTrigger>
              <TabsTrigger value="total" onClick={(e) => e.stopPropagation()} className="data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-900/30 data-[state=active]:text-emerald-800 dark:data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm">
                <PieChart className="h-4 w-4 mr-2" />
                {t('total_by_kitchen')}
              </TabsTrigger>
              <TabsTrigger value="recommendations" onClick={(e) => e.stopPropagation()} className="data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-900/30 data-[state=active]:text-emerald-800 dark:data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm">
                <Info className="h-4 w-4 mr-2" />
                {t('ai_recommendations')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="monthly" className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[400px] w-full" />
                  <div className="flex justify-center gap-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                </div>
              ) : (
                <Card className="border-emerald-100 dark:border-emerald-800/30 shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border-b border-emerald-100 dark:border-emerald-800/30 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      {t('monthly_kitchen_consumption')}
                    </CardTitle>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                      {t('breakdown_of_consumption_costs')}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6 pb-4">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fill: '#64748B' }} 
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={{ stroke: '#CBD5E1' }}
                          />
                          <YAxis 
                            tickFormatter={(value) => formatCurrency(value)} 
                            tick={{ fill: '#64748B' }} 
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={{ stroke: '#CBD5E1' }}
                          />
                          <Tooltip content={<CustomMonthlyTooltip />} />
                          <Legend 
                            wrapperStyle={{ paddingTop: '10px' }} 
                            formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                          />
                          {kitchenTotals.map((kitchen, index) => (
                            <Bar 
                              key={kitchen.id}
                              dataKey={`${kitchen.name}_cost`}
                              name={`${kitchen.name} (Cost)`}
                              fill={getKitchenColor(index)}
                              stackId="a"
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                          {kitchenTotals.map((kitchen, index) => (
                            <Bar 
                              key={`revenue-${kitchen.id}`}
                              dataKey={`${kitchen.name}_revenue`}
                              name={`${kitchen.name} (Revenue)`}
                              fill="#3b82f6"
                              stackId="b"
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                          {kitchenTotals.map((kitchen, index) => (
                            <Bar 
                              key={`profit-${kitchen.id}`}
                              dataKey={`${kitchen.name}_profit`}
                              name={`${kitchen.name} (Profit)`}
                              fill="#22c55e"
                              stackId="c"
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 py-3 px-6">
                    <div className="w-full flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Info className="h-4 w-4" />
                        <span>{t('showing_data_for_last_12_months')}</span>
                      </div>
                      <span>{t('total_cost')}: {formatCurrency(grandTotalCost)}</span>
                    </div>
                  </CardFooter>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="total" className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[400px] w-full" />
                  <div className="flex justify-center gap-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                </div>
              ) : (
                <Card className="border-emerald-100 dark:border-emerald-800/30 shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border-b border-emerald-100 dark:border-emerald-800/30 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                        <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        {t('total_by_kitchen')}
                      </CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={toggleSortOrder}
                        className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        {sortOrder === "desc" ? t('highest_first') : t('lowest_first')}
                      </Button>
                    </div>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                      {t('total_consumption_costs')}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6 pb-4">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={totalConsumptionData} 
                          layout="vertical"
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis 
                            type="number" 
                            tickFormatter={(value) => formatCurrency(value)} 
                            tick={{ fill: '#64748B' }} 
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={{ stroke: '#CBD5E1' }}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={150} 
                            tick={{ fill: '#64748B' }} 
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={{ stroke: '#CBD5E1' }}
                          />
                          <Tooltip content={<CustomTotalTooltip />} />
                          <Legend 
                            wrapperStyle={{ paddingTop: '10px' }} 
                            formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                          />
                          <Bar 
                            dataKey="cost" 
                            name={t('total_cost')} 
                            radius={[0, 4, 4, 0]}
                            fill="#10b981"
                          >
                            {totalConsumptionData.map((entry, index) => (
                              <Cell key={`cell-cost-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                          <Bar 
                            dataKey="revenue" 
                            name={t('total_revenue')} 
                            radius={[0, 4, 4, 0]}
                            fill="#3b82f6"
                          />
                          <Bar 
                            dataKey="profit" 
                            name={t('total_profit')} 
                            radius={[0, 4, 4, 0]}
                            fill="#22c55e"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 py-3 px-6">
                    <div className="w-full">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('top_3_kitchens')}</h4>
                          <div className="space-y-1.5">
                            {totalConsumptionData.slice(0, 3).map((kitchen, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: kitchen.color }} />
                                  <span className="text-sm text-gray-600 dark:text-gray-400">{kitchen.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {formatCurrency(kitchen.cost)}
                                  </span>
                                  <span className={`text-sm font-medium ${kitchen.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ({formatCurrency(kitchen.profit)})
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('statistics')}</h4>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{t('average_cost_per_kitchen')}:</span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {formatCurrency(grandTotalCost / kitchenTotals.length)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{t('average_revenue_per_kitchen')}:</span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {formatCurrency(grandTotalRevenue / kitchenTotals.length)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{t('average_profit_per_kitchen')}:</span>
                              <span className={`text-sm font-medium ${grandTotalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(grandTotalProfit / kitchenTotals.length)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{t('overall_profit_margin')}:</span>
                              <span className={`text-sm font-medium ${grandTotalRevenue > 0 && grandTotalProfit / grandTotalRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {grandTotalRevenue > 0 ? ((grandTotalProfit / grandTotalRevenue) * 100).toFixed(1) : '0'}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="recommendations" className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {aiRecommendations.map((item, index) => (
                    <Card key={index} className="border-blue-100 dark:border-blue-800/30 shadow-md overflow-hidden">
                      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-blue-100 dark:border-blue-800/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-300">
                          <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          {item.kitchenName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 pb-2">
                        <div className="space-y-3">
                          {item.recommendations.map((recommendation, recIndex) => (
                            <div key={recIndex} className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg">
                              <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0 text-blue-700 dark:text-blue-300">
                                {recIndex + 1}
                              </div>
                              <p className="text-sm text-blue-700 dark:text-blue-300">{recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 py-3 px-6">
                        <div className="w-full flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">{t('cost')}:</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {formatCurrency(kitchenTotals.find(k => k.id === item.kitchenId)?.totalCost || 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">{t('profit')}:</span>
                            <span className={`font-medium ${(kitchenTotals.find(k => k.id === item.kitchenId)?.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(kitchenTotals.find(k => k.id === item.kitchenId)?.totalProfit || 0)}
                            </span>
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}