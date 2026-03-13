import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, PieChart, Trash2, Info, Calendar, Search, X,
  TrendingUp, TrendingDown, Flame, Leaf, Award, AlertTriangle,
  RefreshCw, ChevronRight, Package, Activity
} from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";

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

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  iconBg,
  iconColor,
  textColor,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  iconColor: string;
  textColor: string;
}) {
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} p-4 ring-1 ring-inset ring-white/20`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shadow-sm`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${textColor}`}>{label}</p>
      <p className="text-3xl font-bold tabular-nums leading-none mb-1">{value}</p>
      <p className="text-[11px] opacity-70">{sub}</p>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30" />
    </div>
  );
}

function BarRow({ label, value, max, colorClass }: { label: string; value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-12 text-right flex-shrink-0">{value.toFixed(1)}</span>
    </div>
  );
}

export function ConsumptionTabContent({ kitchenId, kitchenName }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<ConsumptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");

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
    setItemSearch("");
    fetchData(defaultStart, defaultEnd);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive/5">
        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h3 className="font-semibold mb-1">Failed to load data</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button size="sm" onClick={() => fetchData(startDate, endDate)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { totalConsumption, totalWaste, kitchenEfficiency, waste, monthlyConsumption, topWastedItems, recommendations } = data;

  const filteredItems = (data.items ?? []).filter(
    (item) =>
      !itemSearch ||
      item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (item.category ?? "").toLowerCase().includes(itemSearch.toLowerCase())
  );

  const maxConsumption = Math.max(...filteredItems.map((i) => i.totalQuantity), 1);
  const maxMonthly = Math.max(...(monthlyConsumption?.totalData ?? [0]), 1);

  const efficiencyColor =
    (kitchenEfficiency ?? 100) >= 90
      ? "text-emerald-600"
      : (kitchenEfficiency ?? 100) >= 70
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="space-y-5">
      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            From
          </Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-sm w-36"
          />
        </div>
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            To
          </Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 text-sm w-36"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            Search ingredient
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Filter by name or category…"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleApplyFilter} className="h-9 bg-emerald-600 hover:bg-emerald-700">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={handleResetFilter} className="h-9">
            <X className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t("total_consumption") || "Total Consumed"}
          value={totalConsumption?.toFixed(1) ?? "0"}
          sub="units consumed in period"
          icon={Activity}
          gradient="from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          textColor="text-blue-700 dark:text-blue-400"
        />
        <StatCard
          label={t("waste") || "Total Waste"}
          value={waste?.totalWaste?.toFixed(1) ?? "0"}
          sub={`avg ${waste?.avgWastePercentage?.toFixed(1) ?? 0}% waste rate`}
          icon={Trash2}
          gradient="from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20"
          iconBg="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-600 dark:text-red-400"
          textColor="text-red-700 dark:text-red-400"
        />
        <StatCard
          label={t("kitchen_efficiency") || "Efficiency"}
          value={`${kitchenEfficiency ?? 100}%`}
          sub={
            (kitchenEfficiency ?? 100) >= 90
              ? "excellent kitchen performance"
              : (kitchenEfficiency ?? 100) >= 70
              ? "good — room for improvement"
              : "needs attention"
          }
          icon={(kitchenEfficiency ?? 100) >= 80 ? Award : AlertTriangle}
          gradient={
            (kitchenEfficiency ?? 100) >= 90
              ? "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20"
              : (kitchenEfficiency ?? 100) >= 70
              ? "from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20"
              : "from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20"
          }
          iconBg={
            (kitchenEfficiency ?? 100) >= 90
              ? "bg-emerald-100 dark:bg-emerald-900/30"
              : (kitchenEfficiency ?? 100) >= 70
              ? "bg-amber-100 dark:bg-amber-900/30"
              : "bg-red-100 dark:bg-red-900/30"
          }
          iconColor={
            (kitchenEfficiency ?? 100) >= 90
              ? "text-emerald-600 dark:text-emerald-400"
              : (kitchenEfficiency ?? 100) >= 70
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400"
          }
          textColor={
            (kitchenEfficiency ?? 100) >= 90
              ? "text-emerald-700 dark:text-emerald-400"
              : (kitchenEfficiency ?? 100) >= 70
              ? "text-amber-700 dark:text-amber-400"
              : "text-red-700 dark:text-red-400"
          }
        />
      </div>

      {/* ── Monthly Consumption Trend ── */}
      {(monthlyConsumption?.labels?.length ?? 0) > 0 && (
        <Card className="border-0 ring-1 ring-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              {t("consumption_trends") || "Monthly Consumption Trend"}
            </CardTitle>
            <CardDescription className="text-xs">Consumption totals per month</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {monthlyConsumption.labels.map((label, idx) => (
              <BarRow
                key={label}
                label={label}
                value={monthlyConsumption.totalData[idx] ?? 0}
                max={maxMonthly}
                colorClass="bg-gradient-to-r from-blue-500 to-indigo-500"
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Consumption Breakdown by Ingredient ── */}
      <Card className="border-0 ring-1 ring-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600" />
                {t("consumption_breakdown") || "Consumption by Ingredient"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {filteredItems.length} ingredients · sorted by total usage
              </CardDescription>
            </div>
            {filteredItems.length > 0 && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                {filteredItems.length} items
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">
                {itemSearch ? "No matching ingredients" : t("no_analysis_data")}
              </p>
              {itemSearch && (
                <button
                  className="text-xs text-primary underline mt-1"
                  onClick={() => setItemSearch("")}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {[...filteredItems]
                .sort((a, b) => b.totalQuantity - a.totalQuantity)
                .map((item) => {
                  const isTop = item.totalQuantity === maxConsumption;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl p-3 transition-colors ${
                        isTop
                          ? "bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30"
                          : "bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isTop && (
                            <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                              <Flame className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          )}
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1.5 font-medium border-0 bg-muted text-muted-foreground flex-shrink-0"
                          >
                            {item.category}
                          </Badge>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-sm font-bold tabular-nums">{item.totalQuantity.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTop
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                              : "bg-gradient-to-r from-blue-400 to-indigo-400"
                          }`}
                          style={{ width: `${(item.totalQuantity / maxConsumption) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Waste Analysis ── */}
      {(waste?.items?.length ?? 0) > 0 && (
        <Card className="border-0 ring-1 ring-red-200/60 dark:ring-red-800/20 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-red-100/80 dark:border-red-900/20 bg-red-50/40 dark:bg-red-950/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              {t("waste") || "Waste Analysis"}
            </CardTitle>
            <CardDescription className="text-xs">
              Total waste: <strong className="text-red-700 dark:text-red-400">{waste?.totalWaste?.toFixed(1) ?? 0}</strong> units
              &nbsp;·&nbsp;Avg rate: <strong className="text-red-700 dark:text-red-400">{waste?.avgWastePercentage?.toFixed(1) ?? 0}%</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {[...waste.items]
              .sort((a, b) => b.totalWasted - a.totalWasted)
              .map((item) => {
                const maxWaste = Math.max(...waste.items.map((i) => i.totalWasted), 1);
                const pct = (item.totalWasted / maxWaste) * 100;
                const severity =
                  item.wastePercentage >= 30 ? "high" : item.wastePercentage >= 15 ? "medium" : "low";
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-3 border ${
                      severity === "high"
                        ? "border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10"
                        : severity === "medium"
                        ? "border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/10"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">{item.name}</span>
                        <Badge
                          className={`text-[10px] h-4 px-1.5 border-0 flex-shrink-0 ${
                            severity === "high"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              : severity === "medium"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.wastePercentage ? `${item.wastePercentage.toFixed(1)}%` : "0%"}
                        </Badge>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                          {item.totalWasted.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          severity === "high"
                            ? "bg-gradient-to-r from-red-500 to-rose-500"
                            : severity === "medium"
                            ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                            : "bg-gradient-to-r from-slate-400 to-slate-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* ── Top Wasted Items Summary ── */}
      {topWastedItems?.length > 0 && (
        <Card className="border-0 ring-1 ring-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              {t("top_wasted_items") || "Top Wasted Items"}
            </CardTitle>
            <CardDescription className="text-xs">Items with highest waste volume</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {topWastedItems.map((item, idx) => (
                <div
                  key={item.name + idx}
                  className="flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/30 px-3 py-1"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">{item.name}</span>
                  <span className="text-[10px] text-red-500">·</span>
                  <span className="text-xs text-red-600 dark:text-red-400">{item.amount}</span>
                  <Badge className="text-[10px] h-4 px-1.5 border-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ml-1">
                    {item.percentage}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recommendations ── */}
      {recommendations?.length > 0 && (
        <Card className="border-0 ring-1 ring-emerald-200/60 dark:ring-emerald-800/20 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-emerald-100/80 dark:border-emerald-900/20 bg-emerald-50/40 dark:bg-emerald-950/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {t("recommendation") || "Recommendations"}
            </CardTitle>
            <CardDescription className="text-xs">AI-powered suggestions to reduce waste and improve efficiency</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2.5 rounded-xl p-2.5 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors">
                <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ChevronRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-muted-foreground leading-snug">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state when no data at all */}
      {filteredItems.length === 0 &&
        (monthlyConsumption?.labels?.length ?? 0) === 0 &&
        !itemSearch && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-border text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No consumption data yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Start recording food consumption in this kitchen to see analytics here.
            </p>
          </div>
        )}
    </div>
  );
}
