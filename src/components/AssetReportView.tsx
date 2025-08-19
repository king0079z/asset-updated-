import React from 'react';
import { format } from 'date-fns';

type Asset = {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  barcode: string;
  type: string;
  imageUrl?: string;
  floorNumber?: string;
  roomNumber?: string;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'DISPOSED' | 'MAINTENANCE';
  vendor?: { name: string };
  purchaseAmount?: number;
  purchaseDate?: string;
  location?: {
    building?: string;
    floorNumber?: string;
    roomNumber?: string;
  };
  tickets?: Ticket[];
};

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
  };
};

interface AssetReportProps {
  asset: Asset;
  history: any[];
}

export const AssetReportView: React.FC<AssetReportProps> = ({ asset, history }) => {
  // Print functionality is now handled by the parent component
  // We don't need to automatically print here anymore
  React.useEffect(() => {
    // Log when component mounts with data
    console.log("AssetReportView mounted with data:", { 
      assetId: asset?.id,
      assetName: asset?.name,
      historyLength: Array.isArray(history) ? history.length : 'not an array'
    });
  }, []);

  // Log what we received for debugging
  console.log("AssetReportView received:", { 
    assetId: asset?.id,
    assetName: asset?.name,
    historyLength: Array.isArray(history) ? history.length : 'not an array',
    hasTickets: Array.isArray(asset?.tickets),
    ticketsLength: Array.isArray(asset?.tickets) ? asset.tickets.length : 'no tickets'
  });

  // Format date helper function
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'PPP');
    } catch (error) {
      return 'Invalid Date';
    }
  };

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

  return (
    <div className="p-8 max-w-5xl mx-auto print-content bg-white">
      {/* Header with Logo and Title */}
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Asset Detailed Report</h1>
          <p className="text-gray-600 mt-1">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Enterprise Asset Management</p>
          <p className="text-sm font-medium">Report ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
        </div>
      </div>

      {/* Asset Information Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-800">Asset Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Asset ID</p>
                <p className="font-medium text-gray-900">{asset.assetId || asset.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Name</p>
                <p className="font-medium text-gray-900">{asset.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Type</p>
                <p className="font-medium text-gray-900">{asset.type}</p>
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
                    ? `${asset.location.building || ''} - Floor ${asset.location.floorNumber || asset.floorNumber || 'N/A'}, Room ${asset.location.roomNumber || asset.roomNumber || 'N/A'}` 
                    : `Floor ${asset.floorNumber || 'N/A'}, Room ${asset.roomNumber || 'N/A'}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Vendor</p>
                <p className="font-medium text-gray-900">{asset.vendor?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Purchase Amount</p>
                <p className="font-medium text-gray-900">${asset.purchaseAmount?.toFixed(2) || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Purchase Date</p>
                <p className="font-medium text-gray-900">{formatDate(asset.purchaseDate)}</p>
              </div>
            </div>
          </div>
          {asset.description && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="font-medium text-gray-900">{asset.description}</p>
            </div>
          )}
          {asset.barcode && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-1">Barcode</p>
              <p className="font-medium text-gray-900">{asset.barcode}</p>
            </div>
          )}
        </div>
      </div>

      {/* Asset History Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-800">Asset History</h2>
        </div>
        <div className="p-6">
          {Array.isArray(history) && history.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 print:bg-gray-400"></div>
              
              {/* Timeline events */}
              <div className="space-y-6">
                {history.map((record, index) => {
                  // Determine action color and icon
                  let actionColor = "bg-gray-100 text-gray-800 border-gray-300";
                  let actionIcon = "●"; // Default icon
                  
                  switch(record.action) {
                    case 'CREATED':
                      actionColor = "bg-green-100 text-green-800 border-green-300 print:bg-green-200 print:border-green-500";
                      actionIcon = "✚"; // Plus symbol
                      break;
                    case 'UPDATED':
                      actionColor = "bg-blue-100 text-blue-800 border-blue-300 print:bg-blue-200 print:border-blue-500";
                      actionIcon = "✎"; // Edit symbol
                      break;
                    case 'MOVED':
                      actionColor = "bg-yellow-100 text-yellow-800 border-yellow-300 print:bg-yellow-200 print:border-yellow-500";
                      actionIcon = "↹"; // Move symbol
                      break;
                    case 'DISPOSED':
                      actionColor = "bg-red-100 text-red-800 border-red-300 print:bg-red-200 print:border-red-500";
                      actionIcon = "✕"; // X symbol
                      break;
                    case 'MAINTENANCE':
                      actionColor = "bg-purple-100 text-purple-800 border-purple-300 print:bg-purple-200 print:border-purple-500";
                      actionIcon = "⚙"; // Gear symbol
                      break;
                    case 'TICKET_CREATED':
                      actionColor = "bg-indigo-100 text-indigo-800 border-indigo-300 print:bg-indigo-200 print:border-indigo-500";
                      actionIcon = "🎫"; // Ticket symbol
                      break;
                  }
                  
                  // Format action label
                  const actionLabel = 
                    record.action === 'TICKET_CREATED' ? 'TICKET CREATED' : 
                    record.action === 'CREATED' ? 'ASSET CREATED' :
                    record.action === 'UPDATED' ? 'ASSET UPDATED' :
                    record.action === 'MOVED' ? 'ASSET MOVED' :
                    record.action === 'DISPOSED' ? 'ASSET DISPOSED' :
                    record.action === 'MAINTENANCE' ? 'MAINTENANCE SCHEDULED' :
                    record.action;
                  
                  // Format details based on action type
                  let detailsContent = '';
                  if (record.action === 'MOVED' && record.details) {
                    detailsContent = `Moved from Floor ${record.details.fromFloor || 'N/A'}, Room ${record.details.fromRoom || 'N/A'} to Floor ${record.details.toFloor || 'N/A'}, Room ${record.details.toRoom || 'N/A'}`;
                  } else if (record.action === 'TICKET_CREATED' && record.details) {
                    detailsContent = `Ticket "${record.details.ticketTitle}" created`;
                  } else if (record.action === 'DISPOSED' && record.details) {
                    detailsContent = `Disposal reason: ${record.details.reason || 'Not specified'}`;
                  } else if (record.action === 'MAINTENANCE' && record.details) {
                    detailsContent = `Maintenance details: ${record.details.notes || 'Not specified'}`;
                  } else if (record.action === 'UPDATED' && record.details) {
                    detailsContent = `Updated fields: ${Object.keys(record.details).join(', ')}`;
                  } else {
                    detailsContent = formatDetails(record.details);
                  }
                  
                  return (
                    <div key={record.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-0 w-12 h-12 flex items-center justify-center rounded-full border-2 ${actionColor} z-10`}>
                        <span className="text-xl" aria-hidden="true">{actionIcon}</span>
                      </div>
                      
                      {/* Content card */}
                      <div className={`ml-6 p-4 rounded-lg border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} print:border-gray-400`}>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                          <div>
                            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${actionColor} mb-2`}>
                              {actionLabel}
                            </div>
                            <div className="text-sm text-gray-500 mb-2">{formatDate(record.createdAt)}</div>
                          </div>
                          <div className="text-sm text-gray-600 mt-1 sm:mt-0">
                            By: {record.user?.email || 'N/A'}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-800 border-t pt-2 border-gray-100 print:border-gray-300">
                          {detailsContent !== 'N/A' ? (
                            <p className="font-medium">{detailsContent}</p>
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
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-500 font-medium">No history records found for this asset.</p>
            </div>
          )}
        </div>
      </div>

      {/* Asset Tickets Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-800">Asset Tickets</h2>
        </div>
        <div className="p-6">
          {Array.isArray(asset.tickets) && asset.tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {asset.tickets.map((ticket, index) => (
                    <tr key={ticket.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.description}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatDate(ticket.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.user?.email || 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-500 font-medium">No tickets found for this asset.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center text-gray-500 text-sm">
          <p>Enterprise Asset Management System</p>
          <p>Page 1 of 1</p>
        </div>
        <p className="text-center text-gray-400 text-xs mt-2">
          This report was automatically generated and is confidential. For internal use only.
        </p>
      </div>

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