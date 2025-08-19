import React from 'react';
import { format } from 'date-fns';
import { ComplianceFooter } from './ComplianceFooter';

type ConsumptionRecord = {
  id: string;
  quantity: number;
  date: string;
  kitchen: {
    name: string;
    floorNumber: string;
  };
  foodSupply: {
    name: string;
    unit: string;
    pricePerUnit: number;
  };
  user: {
    email: string;
  };
};

type FoodSupply = {
  id: string;
  name: string;
  unit: string;
  pricePerUnit: number;
};

interface FoodSupplyReportProps {
  foodSupply?: FoodSupply;
  consumptionHistory: ConsumptionRecord[];
  isFullReport?: boolean;
}

export const AssetReport: React.FC<FoodSupplyReportProps> = ({ foodSupply, consumptionHistory, isFullReport }) => {
  // Group consumptions by food supply name for full report with null checks
  const groupedConsumptions = React.useMemo(() => {
    if (!isFullReport) return null;
    
    return consumptionHistory
      .filter(record => record && record.foodSupply && record.foodSupply.name)
      .reduce((acc, record) => {
        const name = record.foodSupply.name || 'Unknown Item';
        if (!acc[name]) {
          acc[name] = {
            totalQuantity: 0,
            totalValue: 0,
            unit: record.foodSupply.unit || '',
            records: []
          };
        }
        acc[name].totalQuantity += record.quantity || 0;
        acc[name].totalValue += (record.quantity || 0) * (record.foodSupply.pricePerUnit || 0);
        acc[name].records.push(record);
        return acc;
      }, {} as Record<string, { totalQuantity: number; totalValue: number; unit: string; records: ConsumptionRecord[] }>);
  }, [consumptionHistory, isFullReport]);

  // Calculate total value with null checks
  const totalValue = React.useMemo(() => {
    return consumptionHistory.reduce((sum, record) => {
      if (!record.foodSupply || !record.quantity) return sum;
      return sum + (record.quantity * (record.foodSupply.pricePerUnit || 0));
    }, 0);
  }, [consumptionHistory]);

  // We're removing the automatic print functionality from the component
  // The parent component will handle printing using the print utility

  // Generate a unique report ID
  const reportId = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  return (
    <div className="p-8 max-w-5xl mx-auto print-content bg-white">
      {/* Header with Logo and Title */}
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {isFullReport ? 'Food Supplies Consumption Report' : `${foodSupply?.name} Consumption Report`}
          </h1>
          <p className="text-gray-600 mt-1">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Enterprise Resource Management</p>
          <p className="text-sm font-medium">Report ID: {reportId}</p>
        </div>
      </div>

      {isFullReport ? (
        // Full Report View
        <div className="mb-8">
          {/* Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-5 shadow-sm border border-green-100 col-span-3">
              <h3 className="text-sm uppercase text-green-700 font-semibold mb-1">Total Value Consumed</h3>
              <p className="text-3xl font-bold text-green-900">${totalValue.toFixed(2)}</p>
            </div>
          </div>

          {/* Food Supply Categories */}
          <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Consumption by Food Supply</h2>
          <div className="space-y-6">
            {groupedConsumptions && Object.entries(groupedConsumptions).map(([name, data]) => (
              <div key={name} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-700 font-medium mb-1">Total Quantity Consumed</p>
                      <p className="text-xl font-bold text-blue-900">{data.totalQuantity} {data.unit}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <p className="text-sm text-green-700 font-medium mb-1">Total Value</p>
                      <p className="text-xl font-bold text-green-900">${data.totalValue.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {/* Consumption Records Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kitchen</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.records
                          .filter(record => record && record.foodSupply && record.kitchen && record.user)
                          .map((record, index) => (
                            <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3 text-sm text-gray-900">{format(new Date(record.date || new Date()), 'PPp')}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{record.quantity || 0} {record.foodSupply?.unit || ''}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {record.kitchen?.name || 'Unknown Kitchen'} 
                                {record.kitchen?.floorNumber ? `(Floor ${record.kitchen.floorNumber})` : ''}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{record.user?.email || 'Unknown User'}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                ${((record.quantity || 0) * (record.foodSupply?.pricePerUnit || 0)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Single Item Report View
        <div className="mb-8">
          {/* Supply Information Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-800">Supply Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Name</p>
                    <p className="font-medium text-gray-900">{foodSupply?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Unit</p>
                    <p className="font-medium text-gray-900">{foodSupply?.unit}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Price per Unit</p>
                    <p className="font-medium text-gray-900">${foodSupply?.pricePerUnit ? foodSupply.pricePerUnit.toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Value Consumed</p>
                    <p className="font-medium text-green-700">${totalValue.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Consumption History Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-800">Consumption History</h2>
            </div>
            <div className="p-6">
              {consumptionHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kitchen</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded by</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {consumptionHistory
                        .filter(record => record && record.foodSupply && record.kitchen && record.user)
                        .map((record, index) => (
                          <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm text-gray-900">{format(new Date(record.date || new Date()), 'PPp')}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.quantity || 0} {record.foodSupply?.unit || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.kitchen?.name || 'Unknown Kitchen'} 
                              {record.kitchen?.floorNumber ? `(Floor ${record.kitchen.floorNumber})` : ''}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              ${((record.quantity || 0) * (record.foodSupply?.pricePerUnit || 0)).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.user?.email || 'Unknown User'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 font-medium">No consumption records found for this supply.</p>
                </div>
              )}
            </div>
          </div>

          {/* Consumption Analytics */}
          {consumptionHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 className="text-xl font-semibold text-gray-800">Consumption Analytics</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-700 font-medium mb-1">Total Quantity</p>
                    <p className="text-xl font-bold text-blue-900">
                      {consumptionHistory.reduce((sum, record) => sum + (record.quantity || 0), 0)} {foodSupply?.unit || ''}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <p className="text-sm text-purple-700 font-medium mb-1">Average Per Transaction</p>
                    <p className="text-xl font-bold text-purple-900">
                      {consumptionHistory.length > 0 
                        ? (consumptionHistory.reduce((sum, record) => sum + (record.quantity || 0), 0) / consumptionHistory.length).toFixed(2) 
                        : '0.00'} {foodSupply?.unit || ''}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <p className="text-sm text-green-700 font-medium mb-1">Total Value</p>
                    <p className="text-xl font-bold text-green-900">${totalValue.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compliance Footer */}
      <ComplianceFooter 
        reportId={reportId} 
        complianceStandards={['ISO 27001', 'GDPR', 'SOC2', 'ISO 22000']} 
      />

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 1.5cm;
          }
          html, body {
            width: 210mm;
            height: 297mm;
          }
        }
      `}</style>
    </div>
  );
};