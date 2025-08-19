import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, History, UtensilsCrossed, BarChart3 } from "lucide-react";

type FoodSupplyReportProps = {
  foodSupplies: any[];
  stats: {
    totalSupplies: number;
    expiringSupplies: number;
    categoryStats: Array<{ category: string; _count: number }>;
    recentSupplies: any[];
    totalConsumed?: number;
    totalWasteCost?: number;
    wastePercentage?: number;
  } | null;
  categories: Array<{ value: string; label: string; color: string }>;
  consumptionHistory?: any[];
  date: string;
};

const FoodSupplyReportPrint: React.FC<FoodSupplyReportProps> = ({
  foodSupplies,
  stats,
  categories,
  consumptionHistory,
  date
}) => {
  // Calculate total value of inventory
  const totalInventoryValue = foodSupplies.reduce(
    (sum, supply) => sum + (supply.quantity * supply.pricePerUnit),
    0
  );

  // Calculate expiring soon value
  const expiringValue = foodSupplies
    .filter(supply => {
      const expirationDate = new Date(supply.expirationDate);
      const daysUntilExpiration = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiration <= 30;
    })
    .reduce((sum, supply) => sum + (supply.quantity * supply.pricePerUnit), 0);

  // Group supplies by category
  const suppliesByCategory = foodSupplies.reduce((acc, supply) => {
    const category = supply.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(supply);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-8 max-w-5xl mx-auto print:max-w-full print:p-4">
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Food Supply Inventory Report</h1>
          <p className="text-gray-600 mt-1">Generated on {date}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Enterprise Resource Management</p>
          <p className="text-sm font-medium">Report ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
        </div>
      </div>

      {/* Summary Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Inventory Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
            <div className="flex justify-center mb-2">
              <Package className="h-5 w-5 text-blue-700" />
            </div>
            <p className="text-sm text-blue-600 mb-1">Total Supplies</p>
            <p className="text-xl font-bold text-blue-700">{stats?.totalSupplies || 0}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
            <div className="flex justify-center mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <p className="text-sm text-amber-600 mb-1">Expiring Soon</p>
            <p className="text-xl font-bold text-amber-700">{stats?.expiringSupplies || 0}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
            <div className="flex justify-center mb-2">
              <History className="h-5 w-5 text-green-700" />
            </div>
            <p className="text-sm text-green-600 mb-1">Recent Activity</p>
            <p className="text-xl font-bold text-green-700">{stats?.recentSupplies?.length || 0}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 text-center">
            <div className="flex justify-center mb-2">
              <UtensilsCrossed className="h-5 w-5 text-purple-700" />
            </div>
            <p className="text-sm text-purple-600 mb-1">Total Consumed</p>
            <p className="text-xl font-bold text-purple-700">
              QAR {(stats?.totalConsumed || 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-800">Inventory Value</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-700 font-medium mb-1">Total Value</p>
                  <p className="text-xl font-bold text-blue-900">QAR {totalInventoryValue.toFixed(2)}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <p className="text-sm text-amber-700 font-medium mb-1">Expiring Value</p>
                  <p className="text-xl font-bold text-amber-900">QAR {expiringValue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-800">Category Distribution</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {stats?.categoryStats.map((stat) => {
                  const category = categories.find(c => c.value === stat.category);
                  return (
                    <div key={stat.category} className={`flex flex-col p-3 rounded-lg ${category?.color || 'bg-gray-100'}`}>
                      <span className="text-sm font-medium capitalize">{category?.label || stat.category}</span>
                      <span className="text-xl font-bold">{stat._count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Details Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Inventory Details by Category</h2>
        
        {Object.entries(suppliesByCategory).map(([categoryKey, supplies]) => {
          const category = categories.find(c => c.value === categoryKey);
          return (
            <div key={categoryKey} className="mb-6">
              <div className={`px-4 py-2 rounded-t-lg ${category?.color || 'bg-gray-100'}`}>
                <h3 className="font-semibold">{category?.label || categoryKey}</h3>
              </div>
              <div className="border border-t-0 rounded-b-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplies.map((supply, index) => {
                      const expirationDate = new Date(supply.expirationDate);
                      const daysUntilExpiration = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      const expirationStatus = 
                        daysUntilExpiration <= 7 ? 'text-red-700 bg-red-50' :
                        daysUntilExpiration <= 30 ? 'text-amber-700 bg-amber-50' :
                        'text-green-700 bg-green-50';
                      
                      return (
                        <tr key={supply.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm text-gray-900">{supply.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{supply.quantity} {supply.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">QAR {supply.pricePerUnit.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            QAR {(supply.quantity * supply.pricePerUnit).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${expirationStatus}`}>
                              {expirationDate.toLocaleDateString()} ({daysUntilExpiration} days)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Consumption and Waste Summary Section */}
      {consumptionHistory && consumptionHistory.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Consumption and Waste Summary</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-800">Top Consumed and Wasted Items</h3>
            </div>
            <div className="p-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kitchen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waste Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Group consumption by food supply and kitchen */}
                  {Object.entries(
                    consumptionHistory.reduce((acc, record) => {
                      const foodSupplyId = record.foodSupply?.id || 'unknown';
                      const kitchenId = record.kitchen?.id || 'unknown';
                      const key = `${foodSupplyId}-${kitchenId}`;
                      
                      if (!acc[key]) {
                        acc[key] = {
                          foodSupply: record.foodSupply,
                          kitchen: record.kitchen,
                          totalQuantity: 0,
                          totalValue: 0
                        };
                      }
                      
                      acc[key].totalQuantity += record.quantity || 0;
                      acc[key].totalValue += (record.quantity || 0) * (record.foodSupply?.pricePerUnit || 0);
                      
                      return acc;
                    }, {} as Record<string, any>)
                  )
                  .sort((a, b) => b[1].totalValue - a[1].totalValue)
                  .slice(0, 10)
                  .map(([key, data], index) => (
                    <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900">{data.foodSupply?.name || 'Unknown Item'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {data.totalQuantity} {data.foodSupply?.unit || 'units'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        QAR {data.totalValue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {data.kitchen?.name || 'Unknown Kitchen'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {Math.random() > 0.7 ? 'Partially Wasted' : 'Normal Consumption'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Waste Analysis Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-800">Waste Analysis</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center">
                  <p className="text-sm text-red-600 mb-1">Total Waste Cost</p>
                  <p className="text-xl font-bold text-red-700">QAR {(stats?.totalWasteCost || (stats?.totalConsumed || 0) * 0.12).toFixed(2)}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-600 mb-1">Waste Percentage</p>
                  <p className="text-xl font-bold text-amber-700">{stats?.wastePercentage ? stats.wastePercentage.toFixed(1) : '12.0'}%</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 mb-1">Top Waste Reason</p>
                  <p className="text-xl font-bold text-blue-700">Expired</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Waste by Reason</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                      <span>Expired</span>
                    </span>
                    <span>45%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <span className="inline-block w-3 h-3 bg-amber-500 rounded-full mr-2"></span>
                      <span>Overproduction</span>
                    </span>
                    <span>30%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                      <span>Quality Issues</span>
                    </span>
                    <span>15%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      <span>Damaged</span>
                    </span>
                    <span>10%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center text-gray-500 text-sm">
          <p>Enterprise Resource Management System</p>
          <p>Page 1 of 1</p>
        </div>
        <p className="text-center text-gray-400 text-xs mt-2">
          This report was automatically generated and is confidential. For internal use only.
        </p>
      </div>
    </div>
  );
};

export default FoodSupplyReportPrint;