import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, PieChart, Trash2, Info, Calendar, Search, X } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  kitchenId: string;
  kitchenName: string;
};

type ConsumptionDetails = {
  kitchen: { id: string; name: string };
  items: {
    id: string;
    name: string;
    unit: string;
    category: string;
    totalQuantity: number;
    consumptions: any[];
    monthlyConsumption: Record<string, number>;
  }[];
  monthlyConsumption: {
    labels: string[];
    totalData: number[];
    byFoodType: { name: string; unit: string; data: number[] }[];
  };
  waste: {
    items: {
      id: string;
      name: string;
      unit: string;
      totalWasted: number;
      wasteReasons: { reason: string; quantity: number; percentage: number }[];
      wastePercentage: number;
    }[];
    totalWaste: number;
    avgWastePercentage: number;
  };
  totalConsumption: number;
  totalWaste: number;
  kitchenEfficiency: number;
  topWastedItems: { name: string; amount: string; percentage: number }[];
  consumptionTrends: { month: string; value: number }[];
  recommendations: string[];
  anomalies: any[];
};

export function ConsumptionTabContent({ kitchenId, kitchenName }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<ConsumptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  // Default date range: last 30 days
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const fetchData = (start: string, end: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/kitchens/consumption-details?kitchenId=${kitchenId}&startDate=${start}&endDate=${end}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((json) => { setData(json); setLoading(false); })
      .catch(() => { setError(t("error_fetching_data")); setLoading(false); });
  };

  useEffect(() => { fetchData(startDate, endDate); }, [kitchenId]);

  const handleApplyFilter = () => fetchData(startDate, endDate);
  const handleResetFilter = () => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setItemSearch('');
    fetchData(defaultStart, defaultEnd);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        <Info className="mx-auto mb-2 h-8 w-8" />
        <div>{error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Calculate summary stats for today, this week, this month if possible
  // (API does not provide direct breakdown, so show totals and monthly trends)
  const { totalConsumption, totalWaste, kitchenEfficiency, waste, monthlyConsumption, topWastedItems, recommendations } = data;

  // Filter items by search query
  const filteredItems = (data.items ?? []).filter(item =>
    !itemSearch || item.name.toLowerCase().includes(itemSearch.toLowerCase()) || item.category?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Date Range + Search Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Search ingredient</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1.5 h-4 w-4 text-muted-foreground" />
                <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Filter by name…" className="pl-7 h-8 text-sm" />
              </div>
            </div>
            <Button size="sm" onClick={handleApplyFilter} className="h-8">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={handleResetFilter} className="h-8">
              <X className="h-3.5 w-3.5 mr-1.5" />Reset
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-medium">{t("total_consumption")}</span>
            </div>
            <div className="text-2xl font-bold">{totalConsumption?.toFixed(1) ?? 0}</div>
            <div className="text-xs text-muted-foreground">{t("total_consumption_by_category")}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-100 dark:border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="font-medium">{t("waste")}</span>
            </div>
            <div className="text-2xl font-bold">{waste?.totalWaste?.toFixed(1) ?? 0}</div>
            <div className="text-xs text-muted-foreground">{t("total_waste")}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-100 dark:border-green-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <PieChart className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium">{t("kitchen_efficiency")}</span>
            </div>
            <div className="text-2xl font-bold">{kitchenEfficiency ?? 100}%</div>
            <div className="text-xs text-muted-foreground">{t("efficiency")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Consumption Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t("consumption_trends")}
          </CardTitle>
          <CardDescription>{t("monthly_avg")}</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyConsumption?.labels?.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                {monthlyConsumption.labels.map((label, idx) => (
                  <Badge key={label} variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                    {label}: {monthlyConsumption.totalData[idx]?.toFixed(1) ?? 0}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">{t("no_analysis_data")}</div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown by Food Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            {t("consumption_breakdown")}
          </CardTitle>
          <CardDescription>{t("consumption_summary_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.items?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-1 px-2">{t("category")}</th>
                    <th className="text-left py-1 px-2">{t("total")}</th>
                    <th className="text-left py-1 px-2">{t("unit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 px-2">{item.name}</td>
                      <td className="py-1 px-2">{item.totalQuantity?.toFixed(1) ?? 0}</td>
                      <td className="py-1 px-2">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted-foreground">{t("no_analysis_data")}</div>
          )}
        </CardContent>
      </Card>

      {/* Waste Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            {t("waste")}
          </CardTitle>
          <CardDescription>{t("waste_information") || "Waste information for this kitchen"}</CardDescription>
        </CardHeader>
        <CardContent>
          {waste?.items?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-1 px-2">{t("category")}</th>
                    <th className="text-left py-1 px-2">{t("total_waste")}</th>
                    <th className="text-left py-1 px-2">{t("unit")}</th>
                    <th className="text-left py-1 px-2">{t("waste_percentage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {waste.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 px-2">{item.name}</td>
                      <td className="py-1 px-2">{item.totalWasted?.toFixed(1) ?? 0}</td>
                      <td className="py-1 px-2">{item.unit}</td>
                      <td className="py-1 px-2">{item.wastePercentage ? `${item.wastePercentage.toFixed(1)}%` : "0%"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted-foreground">{t("no_analysis_data")}</div>
          )}
        </CardContent>
      </Card>

      {/* Top Wasted Items */}
      {topWastedItems?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              {t("top_wasted_items") || "Top Wasted Items"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topWastedItems.map((item, idx) => (
                <Badge key={item.name + idx} variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {item.name}: {item.amount} ({item.percentage}%)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {t("recommendation")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1">
              {recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ConsumptionTabContent;