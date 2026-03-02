import React from 'react';
import { BarChart3, Calendar, TrendingUp, DollarSign } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";

type MonthlyConsumption = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
};

type CategoryForecast = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
  confidence: number;
};

interface ConsumptionAnalysisReportProps {
  monthlyData: MonthlyConsumption[];
  categoryForecasts: CategoryForecast[];
  currentDate: Date;
}

export function ConsumptionAnalysisReport({ 
  monthlyData, 
  categoryForecasts,
  currentDate
}: ConsumptionAnalysisReportProps) {
  const { t, language } = useTranslation();
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR'
    }).format(amount);
  };

  const getMonthYearLabel = (month: string, year: number) => {
    return `${month} ${year}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculatePercentage = (value: number, total: number) => {
    if (!total) return 0;
    return (value / total) * 100;
  };

  // Calculate totals for summary
  const totalFoodConsumption = monthlyData.reduce((sum, month) => sum + month.foodConsumption, 0);
  const totalAssetsPurchased = monthlyData.reduce((sum, month) => sum + month.assetsPurchased, 0);
  const totalVehicleRentalCosts = monthlyData.reduce((sum, month) => sum + month.vehicleRentalCosts, 0);
  const grandTotal = totalFoodConsumption + totalAssetsPurchased + totalVehicleRentalCosts;

  // Calculate forecast totals
  const forecastFoodConsumption = categoryForecasts.reduce((sum, forecast) => sum + forecast.foodConsumption, 0);
  const forecastAssetsPurchased = categoryForecasts.reduce((sum, forecast) => sum + forecast.assetsPurchased, 0);
  const forecastVehicleRentalCosts = categoryForecasts.reduce((sum, forecast) => sum + forecast.vehicleRentalCosts, 0);
  const forecastGrandTotal = forecastFoodConsumption + forecastAssetsPurchased + forecastVehicleRentalCosts;

  return (
    <div className="consumption-analysis-report">
      <div className="report-header">
        <h1>{t('consumption_analysis_report')}</h1>
        <p>{t('generated_on')} {formatDate(currentDate)}</p>
      </div>

      {/* Summary Section */}
      <section className="summary-section">
        <h2>{t('executive_summary')}</h2>
        <div className="grid-cols-2">
          <div className="border rounded-lg p-4">
            <h3>{t('year_to_date_spending')}</h3>
            <p className="text-gray-500">{t('total_spending_across_categories')}</p>
            <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
            
            <div className="mt-4">
              <table>
                <thead>
                  <tr>
                    <th>{t('category')}</th>
                    <th>{t('amount')}</th>
                    <th>{t('percentage')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Food Consumption</td>
                    <td>{formatCurrency(totalFoodConsumption)}</td>
                    <td>{calculatePercentage(totalFoodConsumption, grandTotal).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td>Assets Purchased</td>
                    <td>{formatCurrency(totalAssetsPurchased)}</td>
                    <td>{calculatePercentage(totalAssetsPurchased, grandTotal).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td>Vehicle Rental Costs</td>
                    <td>{formatCurrency(totalVehicleRentalCosts)}</td>
                    <td>{calculatePercentage(totalVehicleRentalCosts, grandTotal).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <h3>Forecast Summary</h3>
            <p className="text-gray-500">Projected spending for next {categoryForecasts.length} months</p>
            <div className="text-2xl font-bold">{formatCurrency(forecastGrandTotal)}</div>
            
            <div className="mt-4">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Projected Amount</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Food Consumption</td>
                    <td>{formatCurrency(forecastFoodConsumption)}</td>
                    <td>{calculatePercentage(forecastFoodConsumption, forecastGrandTotal).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td>Assets Purchased</td>
                    <td>{formatCurrency(forecastAssetsPurchased)}</td>
                    <td>{calculatePercentage(forecastAssetsPurchased, forecastGrandTotal).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td>Vehicle Rental Costs</td>
                    <td>{formatCurrency(forecastVehicleRentalCosts)}</td>
                    <td>{calculatePercentage(forecastVehicleRentalCosts, forecastGrandTotal).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Breakdown Section */}
      <section className="monthly-breakdown-section">
        <h2 className="flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Monthly Consumption Breakdown
        </h2>
        
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Food Consumption</th>
              <th>Assets Purchased</th>
              <th>Vehicle Rental Costs</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((month) => (
              <tr key={`${month.month}-${month.year}`}>
                <td>{getMonthYearLabel(month.month, month.year)}</td>
                <td className="text-emerald-700">{formatCurrency(month.foodConsumption)}</td>
                <td className="text-indigo-700">{formatCurrency(month.assetsPurchased)}</td>
                <td className="text-amber-700">{formatCurrency(month.vehicleRentalCosts)}</td>
                <td className="font-bold">{formatCurrency(month.total)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td>Total</td>
              <td className="text-emerald-700">{formatCurrency(totalFoodConsumption)}</td>
              <td className="text-indigo-700">{formatCurrency(totalAssetsPurchased)}</td>
              <td className="text-amber-700">{formatCurrency(totalVehicleRentalCosts)}</td>
              <td>{formatCurrency(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Monthly Breakdown Details */}
        <div className="mt-6">
          <h3>Detailed Monthly Analysis</h3>
          <div className="grid-cols-2">
            {monthlyData.map((month) => (
              <div key={`detail-${month.month}-${month.year}`} className="border rounded-lg p-4 mb-4">
                <h4 className="font-bold">{getMonthYearLabel(month.month, month.year)}</h4>
                <div className="text-lg font-semibold">{formatCurrency(month.total)}</div>
                
                <div className="mt-3">
                  <div className="mb-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Food Consumption</span>
                      <span className="text-emerald-700">{formatCurrency(month.foodConsumption)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full" 
                        style={{ width: `${calculatePercentage(month.foodConsumption, month.total)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {calculatePercentage(month.foodConsumption, month.total).toFixed(1)}% of monthly total
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Assets Purchased</span>
                      <span className="text-indigo-700">{formatCurrency(month.assetsPurchased)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full" 
                        style={{ width: `${calculatePercentage(month.assetsPurchased, month.total)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {calculatePercentage(month.assetsPurchased, month.total).toFixed(1)}% of monthly total
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Vehicle Rental Costs</span>
                      <span className="text-amber-700">{formatCurrency(month.vehicleRentalCosts)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full" 
                        style={{ width: `${calculatePercentage(month.vehicleRentalCosts, month.total)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {calculatePercentage(month.vehicleRentalCosts, month.total).toFixed(1)}% of monthly total
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ML Forecast Section */}
      <section className="forecast-section">
        <h2 className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          ML-Powered Category Forecast
        </h2>
        <p className="text-gray-500 mb-4">
          Predicted expenses by category for the next {categoryForecasts.length} months based on machine learning analysis
        </p>
        
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Food Consumption</th>
              <th>Assets Purchased</th>
              <th>Vehicle Rental Costs</th>
              <th>Total</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {categoryForecasts.map((forecast) => (
              <tr key={`${forecast.month}-${forecast.year}`}>
                <td>{getMonthYearLabel(forecast.month, forecast.year)}</td>
                <td className="text-emerald-700">{formatCurrency(forecast.foodConsumption)}</td>
                <td className="text-indigo-700">{formatCurrency(forecast.assetsPurchased)}</td>
                <td className="text-amber-700">{formatCurrency(forecast.vehicleRentalCosts)}</td>
                <td className="font-bold">{formatCurrency(forecast.total)}</td>
                <td>{Math.round(forecast.confidence * 100)}%</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td>Total</td>
              <td className="text-emerald-700">{formatCurrency(forecastFoodConsumption)}</td>
              <td className="text-indigo-700">{formatCurrency(forecastAssetsPurchased)}</td>
              <td className="text-amber-700">{formatCurrency(forecastVehicleRentalCosts)}</td>
              <td>{formatCurrency(forecastGrandTotal)}</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>

        {/* Forecast Details */}
        <div className="mt-6">
          <h3>Detailed Forecast Analysis</h3>
          <div className="grid-cols-2">
            {categoryForecasts.map((forecast) => (
              <div key={`detail-${forecast.month}-${forecast.year}`} className="border rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold">{getMonthYearLabel(forecast.month, forecast.year)}</h4>
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {Math.round(forecast.confidence * 100)}% Confidence
                  </div>
                </div>
                <div className="text-lg font-semibold">{formatCurrency(forecast.total)}</div>
                
                <div className="mt-3">
                  <div className="mb-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Food Consumption</span>
                      <span className="text-emerald-700">{formatCurrency(forecast.foodConsumption)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full" 
                        style={{ width: `${calculatePercentage(forecast.foodConsumption, forecast.total)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {calculatePercentage(forecast.foodConsumption, forecast.total).toFixed(1)}% of monthly total
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Assets Purchased</span>
                      <span className="text-indigo-700">{formatCurrency(forecast.assetsPurchased)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full" 
                        style={{ width: `${calculatePercentage(forecast.assetsPurchased, forecast.total)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {calculatePercentage(forecast.assetsPurchased, forecast.total).toFixed(1)}% of monthly total
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Vehicle Rental Costs</span>
                      <span className="text-amber-700">{formatCurrency(forecast.vehicleRentalCosts)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full" 
                        style={{ width: `${calculatePercentage(forecast.vehicleRentalCosts, forecast.total)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {calculatePercentage(forecast.vehicleRentalCosts, forecast.total).toFixed(1)}% of monthly total
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="report-footer">
        <p>{t('report_footer')}</p>
        <p>{t('data_based_on')}</p>
      </div>
    </div>
  );
}