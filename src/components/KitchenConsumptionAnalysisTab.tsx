import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChefHat, TrendingUp, Trash2, DollarSign, PieChart, Info, Printer } from "lucide-react";
import { PrintKitchenConsumptionReportButton } from "@/components/PrintKitchenConsumptionReportButton";
import { PrintAllKitchenConsumptionReportButton } from "@/components/PrintAllKitchenConsumptionReportButton";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Kitchen = {
  id: string;
  name: string;
};

type MonthlyData = {
  labels: string[];
  consumption: number[];
  waste: number[];
  cost: number[];
  sellingPrice: number[];
  profit: number[];
};

type IngredientUsage = {
  name: string;
  totalUsed: number;
  unit: string;
};

type RecipeUsageSummary = {
  recipeId: string;
  recipeName: string;
  totalServings: number;
  totalCost: number;
  totalSellingPrice: number;
  totalProfit: number;
  totalWaste: number;
};

type KitchenAnalytics = {
  kitchen: Kitchen;
  totalConsumption: number;
  totalWaste: number;
  totalWasteCost?: number;
  totalCost: number;
  totalSellingPrice: number;
  totalProfit: number;
  wasteByExpiration: number;
  wasteByExpirationCost?: number;
  wasteByIngredient: number;
  wasteByIngredientCost?: number;
  monthly: MonthlyData;
  mostUsedIngredients: IngredientUsage[];
  leastUsedIngredients: IngredientUsage[];
  recipes: RecipeUsageSummary[];
};

export function KitchenConsumptionAnalysisTab() {
  const { t } = useTranslation();
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, KitchenAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [activeKitchenId, setActiveKitchenId] = useState<string | null>(null);

  // Fetch kitchens
  useEffect(() => {
    async function fetchKitchens() {
      const res = await fetch("/api/kitchens");
      const data = await res.json();
      setKitchens(data);
      if (data.length > 0) setActiveKitchenId(data[0].id);
    }
    fetchKitchens();
  }, []);

  // Fetch analytics for the active kitchen only
  useEffect(() => {
    async function fetchAnalyticsForKitchen(kitchenId: string) {
      setLoading(true);
      try {
        const res = await fetch(`/api/kitchens/consumption-details?kitchenId=${kitchenId}`);
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const data = await res.json();

        // Compose monthly data (simulate cost, sellingPrice, profit if not present)
        const months = data.monthlyConsumption?.labels || [];
        const consumption = data.monthlyConsumption?.totalData || [];
        // Simulate cost, sellingPrice, profit arrays for the chart
        const cost = months.map((_, i) => (data.monthlyCost?.[i] ?? 0));
        const sellingPrice = months.map((_, i) => (data.monthlySellingPrice?.[i] ?? 0));
        const profit = months.map((_, i) => (sellingPrice[i] - cost[i]));

        // Use backend-provided waste breakdown (cost and quantity)
        const wasteByExpiration = data.wasteByExpiration ?? 0;
        const wasteByExpirationCost = data.wasteByExpirationCost ?? 0;
        const wasteByIngredient = data.wasteByIngredient ?? 0;
        const wasteByIngredientCost = data.wasteByIngredientCost ?? 0;
        const totalWaste = data.totalWaste ?? 0;
        const totalWasteCost = data.totalWasteCost ?? 0;

        // Ingredient usage
        const allIngredients: IngredientUsage[] = (data.items || []).map((item: any) => ({
          name: item.name,
          totalUsed: item.totalQuantity,
          unit: item.unit,
        }));
        const mostUsedIngredients = [...allIngredients].sort((a, b) => b.totalUsed - a.totalUsed).slice(0, 5);
        const leastUsedIngredients = [...allIngredients].sort((a, b) => a.totalUsed - b.totalUsed).slice(0, 5);

        const analytics: KitchenAnalytics = {
          kitchen: kitchens.find(k => k.id === kitchenId) || { id: kitchenId, name: "Kitchen" },
          totalConsumption: data.totalConsumption ?? 0,
          totalWaste,
          totalWasteCost,
          totalCost: data.totalCost ?? 0,
          totalSellingPrice: data.totalSellingPrice ?? 0,
          totalProfit: (data.totalSellingPrice ?? 0) - (data.totalCost ?? 0),
          wasteByExpiration,
          wasteByExpirationCost,
          wasteByIngredient,
          wasteByIngredientCost,
          monthly: {
            labels: months,
            consumption,
            waste: data.monthlyWaste ?? months.map(() => 0),
            cost,
            sellingPrice,
            profit,
          },
          mostUsedIngredients,
          leastUsedIngredients,
          recipes: (data.recipes || []).map((r: any) => ({
            recipeId: r.recipeId,
            recipeName: r.recipeName,
            totalServings: r.totalServings,
            totalCost: r.totalCost,
            totalSellingPrice: r.totalSellingPrice,
            totalProfit: r.totalProfit,
            totalWaste: r.totalWaste,
          })),
        };

        setAnalyticsMap(prev => ({ ...prev, [kitchenId]: analytics }));
      } catch (e) {
        // skip kitchen if error
      }
      setLoading(false);
    }

    if (activeKitchenId && !analyticsMap[activeKitchenId]) {
      fetchAnalyticsForKitchen(activeKitchenId);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKitchenId, kitchens]);

  // Prepare analytics array for rendering tabs
  const analytics = activeKitchenId && analyticsMap[activeKitchenId]
    ? [analyticsMap[activeKitchenId]]
    : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">{t('loading_kitchen_analytics')}</p>
      </div>
    );
  }

  if (!activeKitchenId || !kitchens.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ChefHat className="h-12 w-12 mb-3 opacity-20" />
        <p>{t('no_analytics_data_available')}</p>
      </div>
    );
  }

  // Helper for stat cards
  function StatCard({ icon, label, value, unit, color, tooltip }: { icon: React.ReactNode, label: string, value: string, unit?: string, color: string, tooltip?: string }) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex flex-col items-center justify-center rounded-xl px-4 py-3 bg-muted/60 shadow-sm border border-border min-w-[120px]`}>
              <div className={`mb-1`}>{icon}</div>
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground">{label} {unit && <span className="ml-1">{unit}</span>}</div>
            </div>
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent>
              <span>{tooltip}</span>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Helper for section headers
  function SectionHeader({ icon, title }: { icon: React.ReactNode, title: string }) {
    return (
      <div className="flex items-center gap-2 text-lg font-semibold mb-2 mt-6">
        {icon}
        <span>{title}</span>
      </div>
    );
  }

  // Prepare data for PrintAllKitchenConsumptionReportButton
  // We'll use totalConsumption as "total" for each kitchen, and fake floorNumber as 1 (or you can adapt if you have it)
  const kitchenTotals = kitchens.map(k => ({
    id: k.id,
    name: k.name,
    floorNumber: 1,
    total: analyticsMap[k.id]?.totalConsumption ?? 0,
  }));

  // For chartData, we'll just provide a summary per kitchen (since monthly is removed)
  // We'll create a single "summary" row for all kitchens
  const chartData = [
    {
      month: t('summary'),
      ...kitchenTotals.reduce((acc, k) => ({ ...acc, [k.name]: k.total }), {}),
    }
  ];

  return (
    <div>
      {/* Print All Kitchens Button */}
      <div className="flex items-center justify-end mb-4 gap-2">
        <PrintAllKitchenConsumptionReportButton
          chartData={chartData}
          kitchenTotals={kitchenTotals}
        />
      </div>
      <Tabs value={activeKitchenId ?? ""} onValueChange={setActiveKitchenId}>
        <TabsList className="mb-4 flex flex-wrap gap-2">
          {kitchens.map((k) => (
            <TabsTrigger key={k.id} value={k.id}>
              <ChefHat className="h-4 w-4 mr-1" />
              {k.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {analytics.length > 0 && analytics.map((a) => (
          <TabsContent key={a.kitchen.id} value={a.kitchen.id}>
            {/* Print This Kitchen Button */}
            <div className="flex justify-end mb-2">
              <PrintKitchenConsumptionReportButton
                kitchenId={a.kitchen.id}
                kitchenName={a.kitchen.name}
                details={
                  // Map mostUsedIngredients and leastUsedIngredients into details
                  [
                    ...a.mostUsedIngredients.map(ing => ({
                      name: ing.name,
                      unit: ing.unit,
                      totalQuantity: ing.totalUsed,
                      consumptions: [], // No detailed consumptions in analytics, so leave empty
                    })),
                    ...a.leastUsedIngredients
                      .filter(ing => !a.mostUsedIngredients.some(m => m.name === ing.name))
                      .map(ing => ({
                        name: ing.name,
                        unit: ing.unit,
                        totalQuantity: ing.totalUsed,
                        consumptions: [],
                      })),
                  ]
                }
                monthlyData={{
                  labels: [],
                  totalData: [],
                  byFoodType: [],
                }}
              />
            </div>
            <div className="space-y-10">
              {/* Stats Bar */}
              <div className="flex flex-wrap gap-4 justify-between bg-background rounded-xl p-4 shadow-sm border border-border">
                <StatCard
                  icon={<TrendingUp className="h-5 w-5 text-primary" />}
                  label={t('total_consumption')}
                  value={a.totalConsumption.toFixed(1)}
                  unit={t('quantity')}
                  color="text-primary"
                  tooltip={t('total_consumption_tooltip')}
                />
                <StatCard
                  icon={<Trash2 className="h-5 w-5 text-destructive" />}
                  label={t('total_waste')}
                  value={a.totalWaste.toFixed(1)}
                  unit={t('quantity')}
                  color="text-destructive"
                  tooltip={t('total_waste_tooltip')}
                />
                <StatCard
                  icon={<Trash2 className="h-5 w-5 text-amber-600" />}
                  label={t('waste_by_expiration')}
                  value={a.wasteByExpiration.toFixed(1)}
                  unit={t('quantity')}
                  color="text-amber-600"
                  tooltip={t('waste_by_expiration_tooltip')}
                />
                <StatCard
                  icon={<Trash2 className="h-5 w-5 text-green-600" />}
                  label={t('waste_by_ingredient')}
                  value={a.wasteByIngredient.toFixed(1)}
                  unit={t('quantity')}
                  color="text-green-600"
                  tooltip={t('waste_by_ingredient_tooltip')}
                />
                <StatCard
                  icon={<DollarSign className="h-5 w-5 text-purple-600" />}
                  label={t('total_cost')}
                  value={`QAR ${a.totalCost.toFixed(2)}`}
                  color="text-purple-600"
                  tooltip={t('total_cost_tooltip')}
                />
                <StatCard
                  icon={<DollarSign className="h-5 w-5 text-pink-600" />}
                  label={t('total_selling_price')}
                  value={`QAR ${a.totalSellingPrice.toFixed(2)}`}
                  color="text-pink-600"
                  tooltip={t('total_selling_price_tooltip')}
                />
                <StatCard
                  icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
                  label={t('total_profit')}
                  value={`QAR ${a.totalProfit.toFixed(2)}`}
                  color={a.totalProfit >= 0 ? "text-emerald-600" : "text-destructive"}
                  tooltip={t('total_profit_tooltip')}
                />
              </div>

              {/* Waste Cost Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm border border-border">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-base">{t('total_waste_cost')}</CardTitle>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>{t('total_waste_cost_tooltip')}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">QAR {a.totalWasteCost?.toFixed(2) ?? "0.00"}</div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border border-border">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Trash2 className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-base">{t('waste_by_expiration_cost')}</CardTitle>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>{t('waste_by_expiration_cost_tooltip')}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">QAR {a.wasteByExpirationCost?.toFixed(2) ?? "0.00"}</div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border border-border">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Trash2 className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-base">{t('waste_by_ingredient_cost')}</CardTitle>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>{t('waste_by_ingredient_cost_tooltip')}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">QAR {a.wasteByIngredientCost?.toFixed(2) ?? "0.00"}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Ingredient Usage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <SectionHeader icon={<PieChart className="h-5 w-5 text-primary" />} title={t('most_used_ingredients')} />
                  <ScrollArea className="h-56 pr-2">
                    {a.mostUsedIngredients.length === 0 ? (
                      <div className="text-muted-foreground">{t('no_data')}</div>
                    ) : (
                      a.mostUsedIngredients.map((ing, idx) => (
                        <Card key={ing.name} className="mb-2 shadow-xs border border-border">
                          <CardContent className="flex items-center gap-3 py-2 px-3">
                            <Badge className="bg-primary/10 text-primary">{idx + 1}</Badge>
                            <span className="font-medium">{ing.name}</span>
                            <Progress value={Math.min(100, (ing.totalUsed / (a.mostUsedIngredients[0]?.totalUsed || 1)) * 100)} className="flex-1 mx-2 h-2 bg-muted" />
                            <span className="text-xs text-primary">{ing.totalUsed.toFixed(1)} {ing.unit}</span>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </ScrollArea>
                </div>
                <div>
                  <SectionHeader icon={<PieChart className="h-5 w-5 text-destructive" />} title={t('least_used_ingredients')} />
                  <ScrollArea className="h-56 pr-2">
                    {a.leastUsedIngredients.length === 0 ? (
                      <div className="text-muted-foreground">{t('no_data')}</div>
                    ) : (
                      a.leastUsedIngredients.map((ing, idx) => (
                        <Card key={ing.name} className="mb-2 shadow-xs border border-border">
                          <CardContent className="flex items-center gap-3 py-2 px-3">
                            <Badge className="bg-destructive/10 text-destructive">{idx + 1}</Badge>
                            <span className="font-medium">{ing.name}</span>
                            <Progress value={Math.min(100, (ing.totalUsed / (a.leastUsedIngredients[0]?.totalUsed || 1)) * 100)} className="flex-1 mx-2 h-2 bg-muted" />
                            <span className="text-xs text-destructive">{ing.totalUsed.toFixed(1)} {ing.unit}</span>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </ScrollArea>
                </div>
              </div>

              {/* Recipe Consumption */}
              <div>
                <SectionHeader icon={<ChefHat className="h-5 w-5 text-primary" />} title={t('recipe_consumption', 'Recipe Consumption')} />
                <Card className="shadow-sm border border-border">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-muted/60">
                            <th className="px-4 py-2 text-left">{t('recipe_name', 'Recipe')}</th>
                            <th className="px-4 py-2 text-center">{t('servings', 'Servings')}</th>
                            <th className="px-4 py-2 text-center">{t('total_cost', 'Total Cost')}</th>
                            <th className="px-4 py-2 text-center">{t('total_selling_price', 'Total Selling Price')}</th>
                            <th className="px-4 py-2 text-center">{t('profit', 'Profit')}</th>
                            <th className="px-4 py-2 text-center">{t('waste', 'Waste')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.recipes.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center text-muted-foreground py-6">
                                {t('no_recipe_consumption', 'No recipe consumption data available')}
                              </td>
                            </tr>
                          ) : (
                            a.recipes.map((r) => (
                              <tr key={r.recipeId} className="border-b last:border-b-0 hover:bg-muted/30 transition">
                                <td className="px-4 py-2 font-medium">{r.recipeName}</td>
                                <td className="px-4 py-2 text-center">{r.totalServings}</td>
                                <td className="px-4 py-2 text-center text-purple-700">QAR {r.totalCost.toFixed(2)}</td>
                                <td className="px-4 py-2 text-center text-pink-700">QAR {r.totalSellingPrice.toFixed(2)}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`font-semibold ${r.totalProfit >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                                    QAR {r.totalProfit.toFixed(2)}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-center">{r.totalWaste?.toFixed(2) ?? "0.00"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default KitchenConsumptionAnalysisTab;