import React from 'react';
import { format } from 'date-fns';
import { ComplianceFooter } from './ComplianceFooter';

type Asset = {
  id: string;
  assetId?: string;
  name: string;
  description?: string;
  barcode?: string;
  type?: string;
  imageUrl?: string;
  status?: string;
  purchaseAmount?: number;
  purchaseDate?: string;
  lastMovedAt?: string | Date;
  location?: {
    id: string;
    building?: string;
    floorNumber?: string;
    roomNumber?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  vendor?: {
    id: string;
    name: string;
  };
  history?: AssetHistory[];
  tickets?: Ticket[];
  healthScore?: number;
  healthFactors?: {
    age: number;
    maintenance: number;
    usage: number;
    condition: number;
  };
};

type AssetHistory = {
  id: string;
  action: string;
  details?: any;
  createdAt: string;
  user: {
    email: string;
  };
};

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user: {
    email: string;
  };
  history?: any[];
};

interface AssetReportDetailedProps {
  assets: Asset[];
  isFullReport: boolean;
}

export const AssetReportDetailed: React.FC<AssetReportDetailedProps> = ({ assets, isFullReport }) => {
  // Print functionality is now handled by the parent component
  // We don't need to automatically print here anymore

  // Log what we received for debugging
  console.log("AssetReportDetailed received:", { 
    isArray: Array.isArray(assets), 
    length: Array.isArray(assets) ? assets.length : 'not an array',
    isFullReport,
    firstAsset: Array.isArray(assets) && assets.length > 0 ? {
      id: assets[0].id,
      hasHistory: Array.isArray(assets[0].history),
      historyLength: Array.isArray(assets[0].history) ? assets[0].history.length : 'no history',
      hasTickets: Array.isArray(assets[0].tickets),
      ticketsLength: Array.isArray(assets[0].tickets) ? assets[0].tickets.length : 'no tickets'
    } : 'no assets'
  });
  
  // Ensure assets is always an array, even if API returns a single object or null/undefined
  let assetsArray = Array.isArray(assets) ? assets : assets ? [assets] : [];
  
  // Debug the assets array after conversion
  console.log("Assets array after conversion:", {
    length: assetsArray.length,
    firstItem: assetsArray.length > 0 ? {
      id: assetsArray[0].id,
      name: assetsArray[0].name,
      type: assetsArray[0].type
    } : 'no items'
  });
  
  // Ensure each asset has history and tickets arrays
  assetsArray = assetsArray.map(asset => ({
    ...asset,
    history: Array.isArray(asset.history) ? asset.history : [],
    tickets: Array.isArray(asset.tickets) ? asset.tickets : []
  }));
  
  // Debug the assets array after ensuring history and tickets
  console.log("Assets array after ensuring history and tickets:", {
    length: assetsArray.length,
    firstItem: assetsArray.length > 0 ? {
      id: assetsArray[0].id,
      name: assetsArray[0].name,
      type: assetsArray[0].type,
      historyLength: assetsArray[0].history.length,
      ticketsLength: assetsArray[0].tickets.length
    } : 'no items'
  });
  
  // Add error handling for missing or malformed data
  if (!assetsArray || assetsArray.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto print-content bg-white">
        <div className="text-center mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold mb-2">
            {isFullReport ? 'Complete Asset Inventory Report' : 'Asset Detailed Report'}
          </h1>
          <p className="text-gray-600">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-center py-8">
          <p className="text-lg text-gray-500">No asset data available for this report.</p>
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

  // Helper function to format details object for display
  const formatDetails = (details: any): string => {
    if (!details) return 'N/A';
    
    if (typeof details === 'string') return details;
    
    if (typeof details === 'object') {
      return Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    
    return String(details);
  };

  // Calculate total asset value
  const totalAssetValue = assetsArray.reduce((sum, asset) => sum + (asset.purchaseAmount || 0), 0);

  // Group assets by type for the full report
  const assetsByType = isFullReport ? assetsArray.reduce((acc, asset) => {
    const type = asset.type || 'Uncategorized';
    if (!acc[type]) acc[type] = [];
    acc[type].push(asset);
    return acc;
  }, {} as Record<string, Asset[]>) : {};

  // Status color mapping
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100';
    
    switch(status.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'IN_TRANSIT': return 'bg-yellow-100 text-yellow-800';
      case 'DISPOSED': return 'bg-red-100 text-red-800';
      case 'MAINTENANCE': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100';
    }
  };

  // Priority color mapping
  const getPriorityColor = (priority?: string) => {
    if (!priority) return 'bg-gray-100';
    
    switch(priority.toUpperCase()) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100';
    }
  };

  // Action color and icon mapping for history timeline
  const getActionStyles = (action: string) => {
    let styles = {
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: '●', // Default icon
      label: action
    };
    
    switch(action) {
      case 'CREATED':
        styles.color = "bg-green-100 text-green-800 border-green-300 print:bg-green-200 print:border-green-500";
        styles.icon = "✚"; // Plus symbol
        styles.label = 'ASSET CREATED';
        break;
      case 'UPDATED':
        styles.color = "bg-blue-100 text-blue-800 border-blue-300 print:bg-blue-200 print:border-blue-500";
        styles.icon = "✎"; // Edit symbol
        styles.label = 'ASSET UPDATED';
        break;
      case 'MOVED':
        styles.color = "bg-yellow-100 text-yellow-800 border-yellow-300 print:bg-yellow-200 print:border-yellow-500";
        styles.icon = "↹"; // Move symbol
        styles.label = 'ASSET MOVED';
        break;
      case 'DISPOSED':
        styles.color = "bg-red-100 text-red-800 border-red-300 print:bg-red-200 print:border-red-500";
        styles.icon = "✕"; // X symbol
        styles.label = 'ASSET DISPOSED';
        break;
      case 'MAINTENANCE':
        styles.color = "bg-purple-100 text-purple-800 border-purple-300 print:bg-purple-200 print:border-purple-500";
        styles.icon = "⚙"; // Gear symbol
        styles.label = 'MAINTENANCE';
        break;
      case 'TICKET_CREATED':
        styles.color = "bg-indigo-100 text-indigo-800 border-indigo-300 print:bg-indigo-200 print:border-indigo-500";
        styles.icon = "🎫"; // Ticket symbol
        styles.label = 'TICKET CREATED';
        break;
    }
    
    return styles;
  };

  // Format details based on action type
  const formatActionDetails = (record: AssetHistory) => {
    if (!record.details) return 'N/A';
    
    if (record.action === 'MOVED' && record.details) {
      return `Moved from Floor ${record.details.fromFloor || 'N/A'}, Room ${record.details.fromRoom || 'N/A'} to Floor ${record.details.toFloor || 'N/A'}, Room ${record.details.toRoom || 'N/A'}`;
    } else if (record.action === 'TICKET_CREATED' && record.details) {
      return `Ticket "${record.details.ticketTitle}" created`;
    } else if (record.action === 'DISPOSED' && record.details) {
      return `Disposal reason: ${record.details.reason || 'Not specified'}`;
    } else if (record.action === 'MAINTENANCE' && record.details) {
      return `Maintenance details: ${record.details.notes || 'Not specified'}`;
    } else if (record.action === 'UPDATED' && record.details) {
      return `Updated fields: ${Object.keys(record.details).join(', ')}`;
    } else {
      return formatDetails(record.details);
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
            {isFullReport ? 'Asset Inventory Report' : 'Asset Detailed Report'}
          </h1>
          <p className="text-gray-600 mt-1">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Enterprise Asset Management</p>
          <p className="text-sm font-medium">Report ID: {reportId}</p>
        </div>
      </div>

      {isFullReport ? (
        // Full Report View - All Assets
        <div className="mb-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3">
            <div className="bg-blue-50 rounded-lg p-5 shadow-sm border border-blue-100 print:bg-blue-50 print:border-blue-200">
              <h3 className="text-sm uppercase text-blue-700 font-semibold mb-1">Total Assets</h3>
              <p className="text-3xl font-bold text-blue-900">{assetsArray.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-5 shadow-sm border border-green-100 print:bg-green-50 print:border-green-200">
              <h3 className="text-sm uppercase text-green-700 font-semibold mb-1">Total Value</h3>
              <p className="text-3xl font-bold text-green-900">QAR {totalAssetValue.toFixed(2)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-5 shadow-sm border border-purple-100 print:bg-purple-50 print:border-purple-200">
              <h3 className="text-sm uppercase text-purple-700 font-semibold mb-1">Asset Categories</h3>
              <p className="text-3xl font-bold text-purple-900">{Object.keys(assetsByType).length}</p>
            </div>
          </div>

          {/* Asset Categories */}
          {Object.keys(assetsByType).length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Assets by Category</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                {Object.entries(assetsByType).map(([type, assets]) => (
                  <div key={type} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 print:border-gray-300">
                    <h3 className="font-medium text-lg mb-2">{type}</h3>
                    <div className="flex justify-between text-sm">
                      <span>Count: <span className="font-medium">{assets.length}</span></span>
                      <span>Value: <span className="font-medium">QAR {assets.reduce((sum, asset) => sum + (asset.purchaseAmount || 0), 0).toFixed(2)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Asset Inventory Table */}
          <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Complete Asset Inventory</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm mb-8 print:border-gray-300">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 print:bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset ID</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Amount</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assetsArray.map((asset, index) => (
                  <tr key={asset.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{asset.assetId || asset.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.type || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {asset.location 
                        ? (() => {
                            let locationText = '';
                            
                            // Add building, floor, room if available
                            if (asset.location.building || asset.location.floorNumber || asset.location.roomNumber) {
                              locationText += `${asset.location.building || ''} - Floor ${asset.location.floorNumber || 'N/A'}, Room ${asset.location.roomNumber || 'N/A'}`;
                            }
                            
                            // Add GPS coordinates or address if available
                            if (asset.location.latitude && asset.location.longitude) {
                              if (locationText) locationText += ' | ';
                              if (asset.location.address) {
                                locationText += asset.location.address;
                              } else {
                                locationText += `${asset.location.latitude.toFixed(6)}, ${asset.location.longitude.toFixed(6)}`;
                              }
                            }
                            
                            return locationText || 'N/A';
                          })()
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                        {asset.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">QAR {asset.purchaseAmount?.toFixed(2) || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(asset.purchaseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Single Asset Detailed Report
        <div className="mb-8">
          {assetsArray.map((asset) => (
            <div key={asset.id}>
              {/* Asset Information Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 print:border-gray-300">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg print:bg-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800">Asset Information</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Asset ID</p>
                        <p className="font-medium text-gray-900">{asset.assetId || asset.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Name</p>
                        <p className="font-medium text-gray-900">{asset.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Type</p>
                        <p className="font-medium text-gray-900">{asset.type || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Status</p>
                        <p className="font-medium">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                            {asset.status || 'Unknown'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Location</p>
                        <p className="font-medium text-gray-900">
                          {asset.location 
                            ? (() => {
                                let locationText = '';
                                
                                // Add building, floor, room if available
                                if (asset.location.building || asset.location.floorNumber || asset.location.roomNumber) {
                                  locationText += `${asset.location.building || ''} - Floor ${asset.location.floorNumber || 'N/A'}, Room ${asset.location.roomNumber || 'N/A'}`;
                                }
                                
                                // Add GPS coordinates or address if available
                                if (asset.location.latitude && asset.location.longitude) {
                                  if (locationText) locationText += '\n';
                                  if (asset.location.address) {
                                    locationText += asset.location.address;
                                  } else {
                                    locationText += `GPS: ${asset.location.latitude.toFixed(6)}, ${asset.location.longitude.toFixed(6)}`;
                                  }
                                }
                                
                                return locationText || 'N/A';
                              })()
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Vendor</p>
                        <p className="font-medium text-gray-900">{asset.vendor?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Purchase Amount</p>
                        <p className="font-medium text-gray-900">QAR {asset.purchaseAmount?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Purchase Date</p>
                        <p className="font-medium text-gray-900">{formatDate(asset.purchaseDate)}</p>
                      </div>
                    </div>
                  </div>
                  {asset.description && (
                    <div className="mt-6 pt-4 border-t border-gray-100 print:border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">Description</p>
                      <p className="font-medium text-gray-900">{asset.description}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Asset Health Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 print:border-gray-300">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg print:bg-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800">Asset Health</h2>
                </div>
                <div className="p-6">
                  {asset.healthScore !== undefined ? (
                    <div>
                      {/* Health Score */}
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-lg font-medium text-gray-800">Health Score</h3>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            asset.healthScore >= 80 ? 'bg-green-100 text-green-800 print:bg-green-200' :
                            asset.healthScore >= 60 ? 'bg-blue-100 text-blue-800 print:bg-blue-200' :
                            asset.healthScore >= 40 ? 'bg-yellow-100 text-yellow-800 print:bg-yellow-200' :
                            asset.healthScore >= 20 ? 'bg-orange-100 text-orange-800 print:bg-orange-200' :
                            'bg-red-100 text-red-800 print:bg-red-200'
                          }`}>
                            {asset.healthScore} - {
                              asset.healthScore >= 80 ? 'Excellent' :
                              asset.healthScore >= 60 ? 'Good' :
                              asset.healthScore >= 40 ? 'Fair' :
                              asset.healthScore >= 20 ? 'Poor' :
                              'Critical'
                            }
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-4 mb-4 print:border print:border-gray-300">
                          <div 
                            className={`h-4 rounded-full ${
                              asset.healthScore >= 80 ? 'bg-green-500 print:bg-green-600' :
                              asset.healthScore >= 60 ? 'bg-blue-500 print:bg-blue-600' :
                              asset.healthScore >= 40 ? 'bg-yellow-500 print:bg-yellow-600' :
                              asset.healthScore >= 20 ? 'bg-orange-500 print:bg-orange-600' :
                              'bg-red-500 print:bg-red-600'
                            }`}
                            style={{ width: `${asset.healthScore}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Health Factors */}
                      {asset.healthFactors && typeof asset.healthFactors === 'object' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Age Factor</p>
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2 mr-2 print:border print:border-gray-300">
                                  <div 
                                    className="bg-blue-500 h-2 rounded-full print:bg-blue-600" 
                                    style={{ width: `${typeof asset.healthFactors.age === 'number' ? asset.healthFactors.age : 0}%` }}
                                  ></div>
                                </div>
                                <span className="font-medium text-gray-900 min-w-[40px] text-right">
                                  {typeof asset.healthFactors.age === 'number' ? `${asset.healthFactors.age}%` : '0%'}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Maintenance Factor</p>
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2 mr-2 print:border print:border-gray-300">
                                  <div 
                                    className="bg-purple-500 h-2 rounded-full print:bg-purple-600" 
                                    style={{ width: `${typeof asset.healthFactors.maintenance === 'number' ? asset.healthFactors.maintenance : 0}%` }}
                                  ></div>
                                </div>
                                <span className="font-medium text-gray-900 min-w-[40px] text-right">
                                  {typeof asset.healthFactors.maintenance === 'number' ? `${asset.healthFactors.maintenance}%` : '0%'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Usage Factor</p>
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2 mr-2 print:border print:border-gray-300">
                                  <div 
                                    className="bg-green-500 h-2 rounded-full print:bg-green-600" 
                                    style={{ width: `${typeof asset.healthFactors.usage === 'number' ? asset.healthFactors.usage : 0}%` }}
                                  ></div>
                                </div>
                                <span className="font-medium text-gray-900 min-w-[40px] text-right">
                                  {typeof asset.healthFactors.usage === 'number' ? `${asset.healthFactors.usage}%` : '0%'}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Condition Factor</p>
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2 mr-2 print:border print:border-gray-300">
                                  <div 
                                    className="bg-yellow-500 h-2 rounded-full print:bg-yellow-600" 
                                    style={{ width: `${typeof asset.healthFactors.condition === 'number' ? asset.healthFactors.condition : 0}%` }}
                                  ></div>
                                </div>
                                <span className="font-medium text-gray-900 min-w-[40px] text-right">
                                  {typeof asset.healthFactors.condition === 'number' ? `${asset.healthFactors.condition}%` : '0%'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Asset Age and Last Activity */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t border-gray-100 print:border-gray-200 print:grid-cols-2">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Asset Age</p>
                          <p className="font-medium text-gray-900">
                            {asset.purchaseDate ? (() => {
                              try {
                                const purchaseDate = new Date(asset.purchaseDate);
                                if (isNaN(purchaseDate.getTime())) return 'Unknown';
                                
                                const now = new Date();
                                const ageInMonths = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + 
                                                  (now.getMonth() - purchaseDate.getMonth());
                                
                                if (ageInMonths < 12) {
                                  return `${ageInMonths} month${ageInMonths !== 1 ? 's' : ''}`;
                                } else {
                                  const years = Math.floor(ageInMonths / 12);
                                  const months = ageInMonths % 12;
                                  return `${years} year${years !== 1 ? 's' : ''}${months > 0 ? `, ${months} month${months !== 1 ? 's' : ''}` : ''}`;
                                }
                              } catch (error) {
                                return 'Unknown';
                              }
                            })() : 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Last Activity</p>
                          <p className="font-medium text-gray-900">
                            {asset.lastMovedAt 
                              ? (() => {
                                  try {
                                    const date = new Date(asset.lastMovedAt);
                                    return isNaN(date.getTime()) ? 'Unknown' : formatDate(date.toISOString());
                                  } catch (error) {
                                    return 'Unknown';
                                  }
                                })()
                              : 'None'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg print:bg-gray-100">
                      <p className="text-gray-500 font-medium">No health data available for this asset.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Asset History Section - Enhanced Timeline */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 print:border-gray-300 print:break-before-page">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg print:bg-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800">Asset History</h2>
                </div>
                <div className="p-6">
                  {asset.history && asset.history.length > 0 ? (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 print:bg-gray-400"></div>
                      
                      {/* Timeline events */}
                      <div className="space-y-8">
                        {asset.history.map((record, index) => {
                          const actionStyles = getActionStyles(record.action);
                          const details = formatActionDetails(record);
                          
                          return (
                            <div key={record.id} className="relative pl-10 print:break-inside-avoid">
                              {/* Timeline dot with icon */}
                              <div className={`absolute left-0 w-12 h-12 flex items-center justify-center rounded-full border-2 ${actionStyles.color} z-10`}>
                                <span className="text-xl" aria-hidden="true">{actionStyles.icon}</span>
                              </div>
                              
                              {/* Content card */}
                              <div className={`ml-6 p-5 rounded-lg border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} print:border-gray-400 shadow-sm`}>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3">
                                  <div>
                                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${actionStyles.color} mb-2`}>
                                      {actionStyles.label}
                                    </div>
                                    <div className="text-sm text-gray-500">{formatDate(record.createdAt)}</div>
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1 sm:mt-0 font-medium">
                                    By: {record.user?.email || 'N/A'}
                                  </div>
                                </div>
                                <div className="mt-3 text-sm text-gray-800 border-t pt-3 border-gray-100 print:border-gray-300">
                                  {details !== 'N/A' ? (
                                    <p className="font-medium">{details}</p>
                                  ) : (
                                    <p className="italic text-gray-500">No additional details</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg print:bg-gray-100">
                      <p className="text-gray-500 font-medium">No history records found for this asset.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Asset Tickets Section - Enhanced Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 print:border-gray-300 print:break-before-page">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg print:bg-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800">Asset Tickets</h2>
                </div>
                <div className="p-6">
                  {asset.tickets && asset.tickets.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 print:border-gray-300">
                        <thead className="bg-gray-50 print:bg-gray-100">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Title</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Description</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Status</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Priority</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Created</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Assigned To</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {asset.tickets.map((ticket, index) => (
                            <tr key={ticket.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50'}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-100">{ticket.title}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">{ticket.description}</td>
                              <td className="px-4 py-3 text-sm border-r border-gray-100">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                                  {ticket.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm border-r border-gray-100">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                                  {ticket.priority}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">{formatDate(ticket.createdAt)}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{ticket.user?.email || 'Unassigned'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg print:bg-gray-100">
                      <p className="text-gray-500 font-medium">No tickets found for this asset.</p>
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
        complianceStandards={['ISO 27001', 'GDPR', 'SOC2', 'ISO 9001']} 
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
          .asset-card, .history-item, tr {
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