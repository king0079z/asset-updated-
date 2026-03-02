import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface AiAnalysisReportProps {
  data: any;
  mlData?: any;
}

const AiAnalysisReport: React.FC<AiAnalysisReportProps> = ({ data, mlData }) => {
  if (!data) return null;

  const { food, assets, vehicles, forecast, recommendations, insightMetrics } = data;

  return (
    <div className="ai-analysis-report">
      <div className="report-header">
        <h1 className="text-3xl font-bold mb-2">AI Analysis Report</h1>
        <p className="text-gray-500 mb-6">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      {/* Budget Consumption Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Current Year Budget Consumption</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Food Supply</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Current Year</div>
                  <div className="text-sm font-medium">QAR {food.currentYearCost.toLocaleString()}</div>
                </div>
                <Progress value={food.currentYearCost > food.prevYearCost ? 100 : (food.currentYearCost / food.prevYearCost) * 100} className="h-2" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Previous Year</div>
                  <div className="text-sm font-medium">QAR {food.prevYearCost.toLocaleString()}</div>
                </div>
                <Progress value={food.prevYearCost > food.currentYearCost ? 100 : (food.prevYearCost / food.currentYearCost) * 100} className="h-2" />
              </div>
              
              <div className="pt-2">
                <div className="text-sm font-medium">Trend</div>
                <div className="flex items-center mt-1">
                  {food.trendPercentage > 0 ? (
                    <span className="text-red-600">↑ {food.trendPercentage.toFixed(1)}% increase from previous year</span>
                  ) : (
                    <span className="text-green-600">↓ {Math.abs(food.trendPercentage).toFixed(1)}% decrease from previous year</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Vehicle Rentals</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Current Year</div>
                  <div className="text-sm font-medium">QAR {vehicles.currentYearCost.toLocaleString()}</div>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              
              <div className="pt-2">
                <div className="text-sm font-medium">Monthly Trend</div>
                <div className="flex items-center mt-1">
                  {vehicles.trendPercentage > 0 ? (
                    <span className="text-red-600">↑ {vehicles.trendPercentage.toFixed(1)}% increase from previous month</span>
                  ) : (
                    <span className="text-green-600">↓ {Math.abs(vehicles.trendPercentage).toFixed(1)}% decrease from previous month</span>
                  )}
                </div>
              </div>
              
              <div className="pt-2">
                <div className="text-sm font-medium">Vehicle Types</div>
                <div className="mt-1">
                  {Object.entries(vehicles.costByType).map(([type, cost]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span>{type}:</span>
                      <span>QAR {(cost as number).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4 mt-6">
          <h3 className="text-lg font-semibold mb-3">Total Budget Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded p-3">
              <div className="text-sm text-gray-500">Current Year Total</div>
              <div className="text-xl font-bold">QAR {(food.currentYearCost + vehicles.currentYearCost).toLocaleString()}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-gray-500">Food Percentage</div>
              <div className="text-xl font-bold">
                {((food.currentYearCost / (food.currentYearCost + vehicles.currentYearCost)) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-gray-500">Vehicle Percentage</div>
              <div className="text-xl font-bold">
                {((vehicles.currentYearCost / (food.currentYearCost + vehicles.currentYearCost)) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Budget Forecast Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Budget Forecast</h2>
        <div className="border rounded-lg p-4">
          <div className="space-y-6">
            <div className="grid grid-cols-6 gap-2 text-center text-sm font-medium">
              <div>Year</div>
              <div className="col-span-5">Projected Budget</div>
            </div>
            
            {/* Current Year */}
            <div className="grid grid-cols-6 gap-2 items-center">
              <div className="text-sm font-medium">{forecast.currentYear}</div>
              <div className="col-span-5">
                <div className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-4 mr-4 overflow-hidden">
                    <div className="bg-blue-600 h-4 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">QAR {forecast.yearly.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Food: QAR {food.forecast.yearly.toLocaleString()}</span>
                  <span>Vehicles: QAR {vehicles.forecast.yearly.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            {/* Future Years */}
            {forecast.multiYear.map((yearData) => {
              // Calculate percentage relative to current year for the bar width
              const percentageOfCurrent = (yearData.amount / forecast.yearly) * 100;
              
              return (
                <div key={yearData.year} className="grid grid-cols-6 gap-2 items-center">
                  <div className="text-sm font-medium">{yearData.year}</div>
                  <div className="col-span-5">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-4 mr-4 overflow-hidden">
                        <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${percentageOfCurrent}%` }}></div>
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">QAR {yearData.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Food: QAR {yearData.foodAmount.toLocaleString()}</span>
                      <span>Vehicles: QAR {yearData.vehicleAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t text-sm text-gray-500">
            <strong>Note:</strong> Forecast includes 3% annual inflation and 2% cost reduction from optimization efforts.
          </div>
        </div>
      </section>

      {/* Key Metrics Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Key Performance Metrics</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Food Supply Metrics</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Monthly Forecast</span>
                  <span className="text-sm font-medium">QAR {food.forecast.monthly.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Yearly Forecast</span>
                  <span className="text-sm font-medium">QAR {food.forecast.yearly.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Trend</span>
                  <span className="text-sm font-medium">
                    {insightMetrics.foodTrend.value > 0 ? '+' : ''}{insightMetrics.foodTrend.value}%
                  </span>
                </div>
              </div>
              {food.optimization && (
                <div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Potential Yearly Savings</span>
                    <span className="text-sm font-medium text-green-600">
                      QAR {food.optimization.totalYearlySavings.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Vehicle Rental Metrics</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Monthly Forecast</span>
                  <span className="text-sm font-medium">QAR {vehicles.forecast.monthly.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Yearly Forecast</span>
                  <span className="text-sm font-medium">QAR {vehicles.forecast.yearly.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Trend</span>
                  <span className="text-sm font-medium">
                    {insightMetrics.vehicleTrend.value > 0 ? '+' : ''}{insightMetrics.vehicleTrend.value}%
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Vehicle Types</span>
                  <span className="text-sm font-medium">{Object.keys(vehicles.costByType).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Asset Metrics</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Active Assets</span>
                  <span className="text-sm font-medium">{assets.totalCount}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Asset Value</span>
                  <span className="text-sm font-medium">QAR {assets.totalValue.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Asset Types</span>
                  <span className="text-sm font-medium">{assets.byType.length}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Disposed Assets (This Year)</span>
                  <span className="text-sm font-medium">{assets.disposedAssets.length}</span>
                </div>
              </div>
              
              {/* Asset Values by Type */}
              {assets.valueByType && assets.valueByType.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Asset Values by Type</div>
                  <div className="space-y-2">
                    {assets.valueByType.map((item, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-sm">{item.type || 'Unknown'}</span>
                        <span className="text-sm font-medium">QAR {(item._sum?.purchaseAmount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Budget Efficiency</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Budget Efficiency</span>
                  <span className="text-sm font-medium">{insightMetrics.budgetEfficiency.value.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Asset Utilization</span>
                  <span className="text-sm font-medium">{insightMetrics.assetUtilization.value.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Monthly Forecast</span>
                  <span className="text-sm font-medium">QAR {forecast.monthly.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Yearly Forecast</span>
                  <span className="text-sm font-medium">QAR {forecast.yearly.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Recommendations Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">AI Recommendations</h2>
        <div className="border rounded-lg p-4">
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className={`p-3 border rounded-lg ${rec.severity === 'high' ? 'border-red-200 bg-red-50' : rec.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}`}>
                <div className="font-semibold">{rec.category}</div>
                <div className="text-sm mt-1">{rec.message}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Food Supply Optimization Section */}
      {food.optimization && food.optimization.items && food.optimization.items.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Food Supply Optimization</h2>
          <div className="border rounded-lg p-4">
            <div className="mb-4">
              <div className="text-lg font-semibold">Potential Savings</div>
              <div className="flex items-center mt-2">
                <span className="text-2xl font-bold text-green-600">QAR {food.optimization.totalYearlySavings.toLocaleString()}</span>
                <span className="text-sm ml-2 text-gray-500">per year</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                QAR {food.optimization.totalMonthlySavings.toLocaleString()} per month
              </div>
            </div>

            <div className="mt-4">
              <div className="text-lg font-semibold mb-2">Top Optimization Opportunities</div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Item</th>
                    <th className="border p-2 text-left">Category</th>
                    <th className="border p-2 text-left">Current Usage</th>
                    <th className="border p-2 text-left">Recommended</th>
                    <th className="border p-2 text-left">Yearly Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {food.optimization.items.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td className="border p-2">{item.name}</td>
                      <td className="border p-2">{item.category}</td>
                      <td className="border p-2">{item.currentMonthlyUsage.toFixed(2)} {item.unit}/month</td>
                      <td className="border p-2">{item.recommendedMonthlyUsage.toFixed(2)} {item.unit}/month</td>
                      <td className="border p-2 text-green-600">QAR {item.potentialYearlySavings.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ML Analysis Section */}
      {mlData && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Machine Learning Analysis</h2>
          
          {/* ML Summary */}
          <div className="border rounded-lg p-4 mb-6 bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold mb-2">{mlData.insights.summary.title}</h3>
            <p className="text-sm mb-4">{mlData.insights.summary.description}</p>
            <ul className="space-y-2">
              {mlData.insights.summary.keyPoints.map((point, index) => (
                <li key={index} className="text-sm flex items-start">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 mt-1.5"></span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Budget Predictions */}
          {mlData.insights.budget && mlData.insights.budget.predictions && mlData.insights.budget.predictions.length > 0 && (
            <div className="border rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3">{mlData.insights.budget.title}</h3>
              <p className="text-sm mb-4">{mlData.insights.budget.description}</p>
              
              <div className="space-y-4">
                {mlData.insights.budget.predictions.map((prediction) => (
                  <div key={prediction.months} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">
                        {prediction.months === 1 ? 'Next month' : 
                         prediction.months === 3 ? 'Next quarter' : 
                         `Next ${prediction.months} months`}
                      </div>
                      <Badge variant="outline" className="bg-blue-50">
                        {prediction.confidence} confidence
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-2xl font-bold">QAR {prediction.amount}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center">
                        <span>Upper bound: QAR {prediction.upperBound}</span>
                      </div>
                      <div className="flex items-center">
                        <span>Lower bound: QAR {prediction.lowerBound}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      <span>Risk factor: {prediction.riskFactor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Smart Optimization Recommendations */}
          {mlData.insights.optimizations && mlData.insights.optimizations.items && mlData.insights.optimizations.items.length > 0 && (
            <div className="border rounded-lg p-4 mb-6 bg-green-50 border-green-200">
              <h3 className="text-lg font-semibold mb-3">{mlData.insights.optimizations.title}</h3>
              <p className="text-sm mb-4">{mlData.insights.optimizations.description}</p>
              
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="border p-2 text-left">Item</th>
                    <th className="border p-2 text-left">Category</th>
                    <th className="border p-2 text-left">Current Usage</th>
                    <th className="border p-2 text-left">Recommended</th>
                    <th className="border p-2 text-left">Yearly Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {mlData.insights.optimizations.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border p-2">{item.name}</td>
                      <td className="border p-2">{item.category}</td>
                      <td className="border p-2">{item.currentUsage.toFixed(2)}</td>
                      <td className="border p-2">{item.recommendedUsage.toFixed(2)}</td>
                      <td className="border p-2 text-green-600">QAR {item.yearlySavings.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Anomaly Detection */}
          {mlData.insights.anomalies && mlData.insights.anomalies.items && mlData.insights.anomalies.items.length > 0 && (
            <div className="border rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3">{mlData.insights.anomalies.title}</h3>
              <p className="text-sm mb-4">{mlData.insights.anomalies.description}</p>
              
              <div className="space-y-4">
                {mlData.insights.anomalies.items.map((anomaly) => (
                  <div key={anomaly.id} className={`p-3 border rounded-lg ${anomaly.severity === 'high' ? 'border-red-200 bg-red-50' : anomaly.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}`}>
                    <div className="font-semibold">{anomaly.name}</div>
                    <div className="text-sm mt-1">Severity: {anomaly.severity} (Score: {anomaly.score})</div>
                    <div className="mt-2">
                      <div className="text-sm font-medium">Possible causes:</div>
                      <ul className="text-sm text-gray-600 space-y-1 ml-5 list-disc">
                        {anomaly.causes.map((cause, idx) => (
                          <li key={idx}>{cause}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Report Footer */}
      <div className="report-footer mt-8 pt-4 border-t text-center text-sm text-gray-500">
        <p>This report was generated by the Enterprise Asset Management System AI Analysis module.</p>
        <p>© {new Date().getFullYear()} Enterprise Asset Management System</p>
      </div>
    </div>
  );
};

export default AiAnalysisReport;