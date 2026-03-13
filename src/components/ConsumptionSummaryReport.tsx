// @ts-nocheck
import { useTranslation } from "@/contexts/TranslationContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Package, Utensils, Car, TrendingUp, DollarSign } from "lucide-react";
import { format } from "date-fns";
import React from 'react';
import { ComplianceFooter } from './ComplianceFooter';

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
}

interface ConsumptionSummaryReportProps {
  data: ConsumptionData[];
  isPrintMode?: boolean;
}

export function ConsumptionSummaryReport({ data, isPrintMode = false }: ConsumptionSummaryReportProps) {
  const { t } = useTranslation();

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
  const consumptionChartData = data.map(item => ({
    name: item.category,
    value: item.totalSpent,
    color: getCategoryColor(item.category)
  }));

  // Prepare data for forecast chart
  const forecastChartData = [
    { name: t("current_year"), ...data.reduce((acc, item) => ({ ...acc, [item.category]: item.yearlyProjection }), {}) },
    { name: t("next_year"), ...data.reduce((acc, item) => ({ ...acc, [item.category]: item.nextYearForecast }), {}) },
    { name: t("year_plus_two"), ...data.reduce((acc, item) => ({ ...acc, [item.category]: item.twoYearForecast }), {}) },
    { name: t("year_plus_three"), ...data.reduce((acc, item) => ({ ...acc, [item.category]: item.threeYearForecast }), {}) },
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

  // Calculate totals for each year
  const yearlyTotals = forecastChartData.map(item => ({
    year: item.name,
    total: Object.keys(item)
      .filter(key => key !== 'name')
      .reduce((sum, key) => sum + (item[key] as number), 0)
  }));

  return (
    <div className={`p-6 ${isPrintMode ? 'print-container' : ''}`}>
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{t("consumption_summary")}</h1>
          <p className="text-gray-500">{t("generated_on")} {format(new Date(), "PPP p")}</p>
        </div>
        <div className="text-right">
          <div className="font-bold text-xl">{t("enterprise_asset_management")}</div>
          <div className="text-gray-500">{t("report_id")}: {Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          {t("total_consumption_by_category")}
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="h-[300px] w-full">
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
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {data.map((item) => (
            <div key={item.category} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getCategoryIcon(item.category)}
                  <span className="ml-2 font-medium">{item.category}</span>
                </div>
              </div>
              <div className="text-2xl font-bold mb-1">{formatCurrency(item.totalSpent)}</div>
              <div className="text-sm text-gray-500 flex justify-between">
                <span>{t("monthly_avg")}:</span>
                <span>{formatCurrency(item.monthlyAverage)}</span>
              </div>
              <div className="text-sm text-gray-500 flex justify-between">
                <span>{t("yearly_projection")}:</span>
                <span>{formatCurrency(item.yearlyProjection)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          {t("budget_forecast_next_three_years")}
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip 
                  formatter={(value) => [formatCurrency(value as number), ""]}
                />
                <Legend />
                {data.map((item) => (
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">{t("year")}</th>
                {data.map(item => (
                  <th key={item.category} className="border p-2 text-left">{item.category}</th>
                ))}
                <th className="border p-2 text-left font-bold">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {forecastChartData.map((item, index) => (
                <tr key={item.name} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border p-2 font-medium">{item.name}</td>
                  {data.map(category => (
                    <td key={category.category} className="border p-2">
                      {formatCurrency(item[category.category] as number)}
                    </td>
                  ))}
                  <td className="border p-2 font-bold">
                    {formatCurrency(yearlyTotals[index].total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">{t("budget_growth_analysis")}</h2>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="mb-4">{t("budget_growth_analysis_description")}</p>
          
          <h3 className="font-bold mb-2">{t("year_over_year_growth")}</h3>
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">{t("period")}</th>
                <th className="border p-2 text-left">{t("total_budget")}</th>
                <th className="border p-2 text-left">{t("growth_percentage")}</th>
              </tr>
            </thead>
            <tbody>
              {yearlyTotals.map((item, index) => {
                // Skip first year as we can't calculate growth
                if (index === 0) return (
                  <tr key={item.year} className="bg-white">
                    <td className="border p-2">{item.year}</td>
                    <td className="border p-2">{formatCurrency(item.total)}</td>
                    <td className="border p-2">-</td>
                  </tr>
                );
                
                const prevYear = yearlyTotals[index - 1];
                const growthPercentage = ((item.total - prevYear.total) / prevYear.total) * 100;
                
                return (
                  <tr key={item.year} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border p-2">{item.year}</td>
                    <td className="border p-2">{formatCurrency(item.total)}</td>
                    <td className="border p-2">
                      <span className={growthPercentage > 0 ? "text-red-500" : "text-green-500"}>
                        {growthPercentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <h3 className="font-bold mb-2">{t("category_breakdown")}</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">{t("category")}</th>
                <th className="border p-2 text-left">{t("current_year")}</th>
                <th className="border p-2 text-left">{t("three_year_projection")}</th>
                <th className="border p-2 text-left">{t("percentage_change")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const currentYearValue = item.yearlyProjection;
                const threeYearValue = item.threeYearForecast;
                const percentageChange = ((threeYearValue - currentYearValue) / currentYearValue) * 100;
                
                return (
                  <tr key={item.category} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border p-2 flex items-center">
                      {getCategoryIcon(item.category)}
                      <span className="ml-2">{item.category}</span>
                    </td>
                    <td className="border p-2">{formatCurrency(currentYearValue)}</td>
                    <td className="border p-2">{formatCurrency(threeYearValue)}</td>
                    <td className="border p-2">
                      <span className={percentageChange > 0 ? "text-red-500" : "text-green-500"}>
                        {percentageChange.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Compliance Footer */}
      <ComplianceFooter 
        reportId={`CONSUMPTION-${Math.random().toString(36).substring(2, 10).toUpperCase()}`} 
        complianceStandards={['ISO 27001', 'GDPR', 'SOC2', 'ISO 22000']} 
      />
    </div>
  );
}