import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Package, Utensils, Car, TrendingUp, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ConsumptionData {
  category: string;
  totalSpent: number;
  monthlyAverage: number;
  yearlyProjection: number;
  nextYearForecast: number;
  twoYearForecast: number;
  threeYearForecast: number;
  monthlyData: {
    month: string;
    amount: number;
  }[];
  totalWaste?: number;
  wastePercent?: number;
}

interface ConsumptionSummaryCardProps {
  className?: string;
}

export function ConsumptionSummaryCard({ className }: ConsumptionSummaryCardProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [consumptionData, setConsumptionData] = useState<ConsumptionData[]>([]);
  const [activeTab, setActiveTab] = useState<"consumption" | "forecast">("consumption");

  useEffect(() => {
    const fetchConsumptionData = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/reports/consumption-summary");
        if (response.ok) {
          const data = await response.json();
          setConsumptionData(data);
        } else {
          console.error("Failed to fetch consumption data");
        }
      } catch (error) {
        console.error("Error fetching consumption data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConsumptionData();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "assets":
        return <Package className="h-4 w-4 text-indigo-600" />;
      case "food":
        return <Utensils className="h-4 w-4 text-emerald-600" />;
      case "vehicles":
        return <Car className="h-4 w-4 text-blue-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "assets":
        return "#6366f1"; // indigo
      case "food":
        return "#10b981"; // emerald
      case "vehicles":
        return "#3b82f6"; // blue
      default:
        return "#6b7280"; // gray
    }
  };

  // Prepare data for consumption chart
  const consumptionChartData = consumptionData.map(item => ({
    name: item.category,
    value: item.totalSpent,
    color: getCategoryColor(item.category)
  }));

  // Prepare data for forecast chart
  const forecastChartData = [
    { name: t("current_year"), ...consumptionData.reduce((acc, item) => ({ ...acc, [item.category]: item.yearlyProjection }), {}) },
    { name: t("next_year"), ...consumptionData.reduce((acc, item) => ({ ...acc, [item.category]: item.nextYearForecast }), {}) },
    { name: t("year_plus_two"), ...consumptionData.reduce((acc, item) => ({ ...acc, [item.category]: item.twoYearForecast }), {}) },
    { name: t("year_plus_three"), ...consumptionData.reduce((acc, item) => ({ ...acc, [item.category]: item.threeYearForecast }), {}) },
  ];

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{t("consumption_summary")}</CardTitle>
            <CardDescription>{t("consumption_summary_description")}</CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-gray-500" />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "consumption" | "forecast")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="consumption">{t("consumption_breakdown")}</TabsTrigger>
            <TabsTrigger value="forecast">{t("budget_forecast")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="consumption" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-[250px] w-full" />
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consumptionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value as number), "Total Spent"]}
                        labelFormatter={(label) => `Category: ${label}`}
                      />
                      <Legend />
                      <Bar dataKey="value" name="Total Spent" fill="#8884d8">
                        {consumptionChartData.map((entry, index) => (
                          <Bar key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {consumptionData.map((item) => (
                    <Card key={item.category} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center">
                          {getCategoryIcon(item.category)}
                          <CardTitle className="text-sm font-medium ml-2">{item.category}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="text-2xl font-bold">{formatCurrency(item.totalSpent)}</div>
                        <p className="text-xs text-muted-foreground">
                          {t("monthly_avg")}: {formatCurrency(item.monthlyAverage)}
                        </p>
                        {item.category.toLowerCase() === "food" && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                              {t("waste_percent")}: {typeof item.wastePercent === "number" ? item.wastePercent.toFixed(1) + "%" : "N/A"}
                            </p>
                            <p className="text-xs text-rose-600 dark:text-rose-400">
                              {t("waste_value")}: {typeof item.totalWaste === "number" ? formatCurrency(item.totalWaste) : "N/A"}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="forecast" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-[250px] w-full" />
                <div className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value as number), ""]}
                      />
                      <Legend />
                      {consumptionData.map((item) => (
                        <Line
                          key={item.category}
                          type="monotone"
                          dataKey={item.category}
                          name={item.category}
                          stroke={getCategoryColor(item.category)}
                          activeDot={{ r: 8 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  {forecastChartData.map((item) => (
                    <Card key={item.name} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="text-2xl font-bold">
                          {formatCurrency(
                            Object.keys(item)
                              .filter(key => key !== 'name')
                              .reduce((sum, key) => sum + (item[key] as number), 0)
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          {consumptionData.map((category) => (
                            <div key={category.category} className="flex items-center justify-between text-xs">
                              <div className="flex items-center">
                                <div 
                                  className="w-2 h-2 rounded-full mr-1" 
                                  style={{ backgroundColor: getCategoryColor(category.category) }}
                                />
                                <span>{category.category}</span>
                              </div>
                              <span>{formatCurrency(item[category.category] as number)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}