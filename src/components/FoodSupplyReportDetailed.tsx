import React from 'react';
import { format } from 'date-fns';
import { ComplianceFooter } from './ComplianceFooter';

type FoodSupply = {
  id: string;
  name: string;
  description?: string;
  barcode?: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
  consumption?: ConsumptionRecord[];
};

type ConsumptionRecord = {
  id: string;
  quantity: number;
  date: string;
  notes?: string;
  createdAt: string;
  kitchen?: {
    id: string;
    name: string;
    floorNumber: string;
    roomNumber?: string;
  };
  user?: {
    email: string;
  };
};

interface FoodSupplyReportDetailedProps {
  foodSupplies: FoodSupply[];
  isFullReport: boolean;
}

export const FoodSupplyReportDetailed: React.FC<FoodSupplyReportDetailedProps> = ({ foodSupplies, isFullReport }) => {
  // Print functionality is now handled by the parent component
  // We don't need to automatically print here anymore

  // Log what we received for debugging
  console.log("FoodSupplyReportDetailed received:", { 
    isArray: Array.isArray(foodSupplies), 
    length: Array.isArray(foodSupplies) ? foodSupplies.length : 'not an array',
    isFullReport,
    firstItem: Array.isArray(foodSupplies) && foodSupplies.length > 0 ? {
      id: foodSupplies[0].id,
      hasConsumption: Array.isArray(foodSupplies[0].consumption),
      consumptionLength: Array.isArray(foodSupplies[0].consumption) ? foodSupplies[0].consumption.length : 'no consumption'
    } : 'no items'
  });
  
  // Ensure foodSupplies is always an array, even if API returns a single object
  let foodSuppliesArray = Array.isArray(foodSupplies) ? foodSupplies : foodSupplies ? [foodSupplies] : [];
  
  // Ensure each item has consumption array and other required fields
  foodSuppliesArray = foodSuppliesArray.map(item => ({
    ...item,
    id: item.id || `temp-${Math.random().toString(36).substring(2, 10)}`,
    name: item.name || 'Unnamed Item',
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    unit: item.unit || 'unit',
    pricePerUnit: typeof item.pricePerUnit === 'number' ? item.pricePerUnit : 0,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    consumption: Array.isArray(item.consumption) ? item.consumption : []
  }));
  
  // Add error handling for missing or malformed data
  if (!foodSuppliesArray || foodSuppliesArray.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto print-content bg-white">
        <div className="text-center mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold mb-2">
            {isFullReport ? 'Complete Food Supply Inventory Report' : 'Food Supply Detailed Report'}
          </h1>
          <p className="text-gray-600">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-center py-8">
          <p className="text-lg text-gray-500">No food supply data available for this report.</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'PPP');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Calculate total value for each food supply item
  const calculateTotalValue = (item: FoodSupply) => {
    return (item.quantity * item.pricePerUnit) || 0;
  };

  // Calculate total consumption for a specific food supply item
  const calculateTotalConsumption = (item: FoodSupply) => {
    if (!item.consumption || !Array.isArray(item.consumption)) return 0;
    return item.consumption.reduce((total, record) => total + (record.quantity || 0), 0);
  };

  // Calculate total inventory value
  const totalInventoryValue = foodSuppliesArray.reduce((sum, item) => sum + calculateTotalValue(item), 0);

  // Group food supplies by expiry date for the full report
  const foodSuppliesByExpiry = isFullReport ? foodSuppliesArray.reduce((acc, item) => {
    const expiryMonth = item.expiryDate 
      ? format(new Date(item.expiryDate), 'MMMM yyyy')
      : 'No Expiry Date';
    
    if (!acc[expiryMonth]) acc[expiryMonth] = [];
    acc[expiryMonth].push(item);
    return acc;
  }, {} as Record<string, FoodSupply[]>) : {};

  // Get expiry status color
  const getExpiryStatusColor = (expiryDate?: string) => {
    if (!expiryDate) return 'bg-gray-100 text-gray-800';
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (expiry < today) {
      return 'bg-red-100 text-red-800 print:bg-red-200 print:border-red-300';
    } else if (expiry < thirtyDaysFromNow) {
      return 'bg-yellow-100 text-yellow-800 print:bg-yellow-200 print:border-yellow-300';
    } else {
      return 'bg-green-100 text-green-800 print:bg-green-200 print:border-green-300';
    }
  };

  // Generate a unique report ID
  const reportId = Math.random().toString(36).substring(2, 10).toUpperCase();

  return (
    <div className="p-8 max-w-5xl mx-auto print-content bg-white">
      {/* Header with Logo and Title */}
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {isFullReport ? 'Food Supply Inventory Report' : 'Food Supply Detailed Report'}
          </h1>
          <p className="text-gray-600 mt-1">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Enterprise Asset Management</p>
          <p className="text-sm font-medium">Report ID: {reportId}</p>
        </div>
      </div>

      {isFullReport ? (
        // Full Report View - All Food Supplies
        <div className="mb-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3">
            <div className="bg-blue-50 rounded-lg p-5 shadow-sm border border-blue-100 print:bg-blue-50 print:border-blue-200">
              <h3 className="text-sm uppercase text-blue-700 font-semibold mb-1">Total Items</h3>
              <p className="text-3xl font-bold text-blue-900">{foodSuppliesArray.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-5 shadow-sm border border-green-100 print:bg-green-50 print:border-green-200">
              <h3 className="text-sm uppercase text-green-700 font-semibold mb-1">Total Inventory Value</h3>
              <p className="text-3xl font-bold text-green-900">QAR {totalInventoryValue.toFixed(2)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-5 shadow-sm border border-purple-100 print:bg-purple-50 print:border-purple-200">
              <h3 className="text-sm uppercase text-purple-700 font-semibold mb-1">Expiry Groups</h3>
              <p className="text-3xl font-bold text-purple-900">{Object.keys(foodSuppliesByExpiry).length}</p>
            </div>
          </div>

          {/* Expiry Date Groups */}
          {Object.keys(foodSuppliesByExpiry).length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Supplies by Expiry Date</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                {Object.entries(foodSuppliesByExpiry).map(([expiryMonth, items]) => (
                  <div key={expiryMonth} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 print:border-gray-300">
                    <h3 className="font-medium text-lg mb-2">{expiryMonth}</h3>
                    <div className="flex justify-between text-sm">
                      <span>Count: <span className="font-medium">{items.length}</span></span>
                      <span>Value: <span className="font-medium">QAR {items.reduce((sum, item) => sum + calculateTotalValue(item), 0).toFixed(2)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Food Supply Inventory Table */}
          <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Complete Food Supply Inventory</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm mb-8 print:border-gray-300">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 print:bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Per Unit</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {foodSuppliesArray.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.quantity || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.unit || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">QAR {item.pricePerUnit?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">QAR {calculateTotalValue(item).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.expiryDate ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getExpiryStatusColor(item.expiryDate)}`}>
                          {formatDate(item.expiryDate)}
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Single Food Supply Detailed Report
        <div className="mb-8">
          {foodSuppliesArray.map((item) => (
            <div key={item.id}>
              {/* Food Supply Information Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 print:border-gray-300">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg print:bg-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800">Food Supply Information</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Name</p>
                        <p className="font-medium text-gray-900">{item.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Barcode</p>
                        <p className="font-medium text-gray-900">{item.barcode || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Quantity</p>
                        <p className="font-medium text-gray-900">{item.quantity || 0} {item.unit || ''}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Unit</p>
                        <p className="font-medium text-gray-900">{item.unit || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Price Per Unit</p>
                        <p className="font-medium text-gray-900">QAR {item.pricePerUnit?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Total Value</p>
                        <p className="font-medium text-green-700">QAR {calculateTotalValue(item).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Expiry Date</p>
                        <p className="font-medium">
                          {item.expiryDate ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getExpiryStatusColor(item.expiryDate)}`}>
                              {formatDate(item.expiryDate)}
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Last Updated</p>
                        <p className="font-medium text-gray-900">{formatDate(item.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                  {item.description && (
                    <div className="mt-6 pt-4 border-t border-gray-100 print:border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">Description</p>
                      <p className="font-medium text-gray-900">{item.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Consumption History Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 print:border-gray-300">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg print:bg-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800">Consumption History</h2>
                </div>
                <div className="p-6">
                  {item.consumption && item.consumption.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3">
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 print:bg-blue-50 print:border-blue-200">
                          <p className="text-sm text-blue-700 font-medium mb-1">Total Consumed</p>
                          <p className="text-xl font-bold text-blue-900">
                            {calculateTotalConsumption(item)} {item.unit || ''}
                          </p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 print:bg-purple-50 print:border-purple-200">
                          <p className="text-sm text-purple-700 font-medium mb-1">Consumption Records</p>
                          <p className="text-xl font-bold text-purple-900">
                            {item.consumption.length}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100 print:bg-green-50 print:border-green-200">
                          <p className="text-sm text-green-700 font-medium mb-1">Value Consumed</p>
                          <p className="text-xl font-bold text-green-900">
                            QAR {(calculateTotalConsumption(item) * item.pricePerUnit).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto rounded-lg border border-gray-200 print:border-gray-300">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 print:bg-gray-100">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Date</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Quantity</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Kitchen</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">User</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Value</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {item.consumption.map((record, index) => (
                              <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50'}>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">{formatDate(record.date || record.createdAt)}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">{record.quantity || 0} {item.unit || ''}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                                  {record.kitchen 
                                    ? `${record.kitchen.name || 'N/A'} (Floor ${record.kitchen.floorNumber || 'N/A'})` 
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">{record.user?.email || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-100">
                                  QAR {(record.quantity * item.pricePerUnit).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">{record.notes || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg print:bg-gray-100">
                      <p className="text-gray-500 font-medium">No consumption records found for this supply.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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
          /* Ensure background colors print properly */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Improve table borders for printing */
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            border: 1px solid #e5e7eb;
          }
          /* Ensure page breaks don't occur in the middle of important content */
          .item-card, .consumption-record, tr {
            page-break-inside: avoid;
          }
          h2, h3 {
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
};