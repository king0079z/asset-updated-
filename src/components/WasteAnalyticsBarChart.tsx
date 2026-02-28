// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
import { BarChart } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface WasteAnalyticsBarChartProps {
  kitchenId: string;
  t: (key: string) => string;
}

type WasteCategory = "ingredientWaste" | "servingWaste" | "expirationWaste";

const CATEGORY_COLORS: Record<WasteCategory, string> = {
  ingredientWaste: "rgba(59,130,246,0.85)", // blue-500
  servingWaste: "rgba(251,191,36,0.85)",    // amber-400
  expirationWaste: "rgba(239,68,68,0.85)",  // red-500
};

const FORECAST_COLORS: Record<WasteCategory, string> = {
  ingredientWaste: "rgba(59,130,246,0.25)",
  servingWaste: "rgba(251,191,36,0.25)",
  expirationWaste: "rgba(239,68,68,0.25)",
};

export function WasteAnalyticsBarChart({ kitchenId, t }: WasteAnalyticsBarChartProps) {
  const [loading, setLoading] = useState(false);
  const [wasteData, setWasteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWasteData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/food-supply/disposals?kitchenId=${kitchenId}&limit=500`);
      if (!res.ok) throw new Error("Failed to fetch waste analytics");
      const data = await res.json();
      setWasteData(data);
    } catch (err: any) {
      setError(err.message || "Error loading waste analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (kitchenId) fetchWasteData();
    // eslint-disable-next-line
  }, [kitchenId]);

  // Prepare chart data
  // Add viewMode state: "monthly" | "daily"
  const [viewMode, setViewMode] = useState<"monthly" | "daily">("monthly");

  const { chartData, chartOptions, forecastMonths } = useMemo(() => {
    if (!wasteData) return { chartData: null, chartOptions: null, forecastMonths: [] };

    const categories: WasteCategory[] = ["ingredientWaste", "servingWaste", "expirationWaste"];

    if (viewMode === "daily") {
      // Gather all days
      const daysSet = new Set<string>();
      categories.forEach((cat) => {
        (wasteData.wasteByCategoryDaily?.[cat] || []).forEach((d: any) => daysSet.add(d.day));
      });
      const days = Array.from(daysSet).sort();

      // Build datasets for each category (no forecast for daily)
      const datasets = categories.map((cat) => ({
        label: t(cat),
        data: days.map((d) => {
          const found = (wasteData.wasteByCategoryDaily?.[cat] || []).find((x: any) => x.day === d);
          return found ? found.cost : 0;
        }),
        backgroundColor: CATEGORY_COLORS[cat],
        stack: "waste",
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      }));

      const chartData = {
        labels: days,
        datasets,
      };

      const chartOptions = {
        responsive: true,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
            labels: {
              font: { size: 13 },
              color: "#334155",
            },
          },
          tooltip: {
            callbacks: {
              label: function (context: any) {
                const value = context.parsed.y;
                return `${context.dataset.label}: QAR ${value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
              },
            },
          },
          title: {
            display: true,
            text: t("waste_analytics_by_category") + " - " + t("by_day"),
            font: { size: 16 },
          },
        },
        scales: {
          x: {
            stacked: true,
            title: {
              display: true,
              text: t("day"),
            },
            ticks: {
              color: "#64748b",
              font: { size: 12 },
              maxRotation: 45,
              minRotation: 45,
              autoSkip: true,
              maxTicksLimit: 14,
            },
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: t("waste_cost_qr"),
            },
            beginAtZero: true,
            ticks: {
              color: "#64748b",
              font: { size: 12 },
              callback: function (value: any) {
                return "QAR " + value;
              },
            },
          },
        },
      };

      return { chartData, chartOptions, forecastMonths: [] };
    }

    // Default: monthly view (with forecast)
    // Gather all months (historical + forecast)
    const monthsSet = new Set<string>();
    categories.forEach((cat) => {
      (wasteData.wasteByCategoryMonthly?.[cat] || []).forEach((d: any) => monthsSet.add(d.month));
      (wasteData.forecast?.[cat] || []).forEach((d: any) => monthsSet.add(d.month));
    });
    const months = Array.from(monthsSet).sort();

    // Split months into historical and forecast
    const forecastMonths = (wasteData.forecast?.ingredientWaste || []).map((d: any) => d.month);

    // Build datasets for each category
    const datasets = categories.map((cat) => {
      // Historical
      const histData = months.map((m) => {
        const found = (wasteData.wasteByCategoryMonthly?.[cat] || []).find((d: any) => d.month === m);
        return found && !forecastMonths.includes(m) ? found.cost : 0;
      });
      // Forecast
      const forecastData = months.map((m) => {
        const found = (wasteData.forecast?.[cat] || []).find((d: any) => d.month === m);
        return forecastMonths.includes(m) ? (found ? found.cost : 0) : 0;
      });
      return [
        {
          label: t(cat),
          data: histData,
          backgroundColor: CATEGORY_COLORS[cat],
          stack: "waste",
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
        {
          label: t(cat) + " " + t("forecast"),
          data: forecastData,
          backgroundColor: FORECAST_COLORS[cat],
          stack: "waste",
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
      ];
    }).flat();

    // Chart.js expects datasets as an array
    const chartData = {
      labels: months,
      datasets,
    };

    const chartOptions = {
      responsive: true,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            font: { size: 13 },
            color: "#334155",
          },
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const value = context.parsed.y;
              return `${context.dataset.label}: QAR ${value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            },
          },
        },
        title: {
          display: true,
          text: t("waste_analytics_by_category"),
          font: { size: 16 },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: t("month"),
          },
          ticks: {
            color: "#64748b",
            font: { size: 12 },
          },
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: t("waste_cost_qr"),
          },
          beginAtZero: true,
          ticks: {
            color: "#64748b",
            font: { size: 12 },
            callback: function (value: any) {
              return "QAR " + value;
            },
          },
        },
      },
    };

    return { chartData, chartOptions, forecastMonths };
  }, [wasteData, t, viewMode]);

  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">{t("waste_analytics_by_category")}</h3>
          <div className="ml-4 flex gap-1">
            <Button
              size="sm"
              variant={viewMode === "monthly" ? "default" : "outline"}
              className="px-2 py-1 text-xs"
              onClick={() => setViewMode("monthly")}
            >
              {t("monthly")}
            </Button>
            <Button
              size="sm"
              variant={viewMode === "daily" ? "default" : "outline"}
              className="px-2 py-1 text-xs"
              onClick={() => setViewMode("daily")}
            >
              {t("daily")}
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
          onClick={fetchWasteData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 text-slate-600 dark:text-slate-400 ${loading ? "animate-spin" : ""}`} />
          <span className="sr-only">{t("refresh")}</span>
        </Button>
      </div>
      {error && (
        <div className="text-red-600 text-sm mb-2">{error}</div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : chartData ? (
        <>
          <div className="w-full h-[380px] relative flex flex-col justify-center items-center">
            <BarChart data={chartData} options={chartOptions} />
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded" style={{ background: CATEGORY_COLORS.ingredientWaste }}></span>
              {t("ingredientWaste")}
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded" style={{ background: CATEGORY_COLORS.servingWaste }}></span>
              {t("servingWaste")}
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded" style={{ background: CATEGORY_COLORS.expirationWaste }}></span>
              {t("expirationWaste")}
            </div>
            {viewMode === "monthly" && (
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded" style={{ background: FORECAST_COLORS.ingredientWaste, border: "1px dashed #3b82f6" }}></span>
                {t("forecast")}
              </div>
            )}
          </div>
          {viewMode === "monthly" && (
            <div className="mt-2 text-xs text-muted-foreground">
              {t("ai_forecast_note") || "Forecasted values for coming months are shown with lighter bars."}
            </div>
          )}
        </>
      ) : (
        <div className="text-muted-foreground text-center py-8">
          {t("no_waste_data_available")}
        </div>
      )}
    </div>
  );
}

export default WasteAnalyticsBarChart;