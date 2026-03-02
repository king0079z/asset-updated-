import React from 'react';
import { format } from 'date-fns';
import { AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { ComplianceFooter } from './ComplianceFooter';
import { formatTicketId } from '@/util/ticketFormat';

// Define ticket status and priority enums to match Prisma schema
enum TicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED"
}

enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

interface Ticket {
  id: string;
  displayId: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  barcode?: string;
  assetId: string | null;
  asset: {
    id: string;
    name: string;
    assetId: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  history?: TicketHistory[];
  assignedTo?: {
    id: string;
    email: string;
    name?: string;
  } | null;
  user?: {
    id: string;
    email: string;
    name?: string;
  } | null;
}

interface TicketHistory {
  id: string;
  action?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  comment?: string;
  details?: any;
  createdAt: string;
  user?: {
    email: string;
  };
}

interface TicketReportProps {
  ticket: Ticket;
}

// Safely format date with fallback
const safeFormatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), 'PPP p');
  } catch (error) {
    return "Invalid Date";
  }
};

const getPriorityColor = (priority: TicketPriority) => {
  switch (priority) {
    case TicketPriority.LOW:
      return "bg-green-100 text-green-800";
    case TicketPriority.MEDIUM:
      return "bg-yellow-100 text-yellow-800";
    case TicketPriority.HIGH:
      return "bg-orange-100 text-orange-800";
    case TicketPriority.CRITICAL:
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case TicketStatus.OPEN:
      return "bg-blue-100 text-blue-800";
    case TicketStatus.IN_PROGRESS:
      return "bg-yellow-100 text-yellow-800";
    case TicketStatus.RESOLVED:
      return "bg-green-100 text-green-800";
    case TicketStatus.CLOSED:
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusIcon = (status: TicketStatus) => {
  switch (status) {
    case TicketStatus.OPEN:
      return <AlertCircle className="h-5 w-5 text-blue-500" />;
    case TicketStatus.IN_PROGRESS:
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case TicketStatus.RESOLVED:
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case TicketStatus.CLOSED:
      return <XCircle className="h-5 w-5 text-gray-500" />;
    default:
      return null;
  }
};

const formatStatusLabel = (status: TicketStatus): string => {
  return status.replace("_", " ");
};

const formatPriorityLabel = (priority: TicketPriority): string => {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
};

// Helper function to format details object for display
const formatDetails = (details: any): string => {
  if (!details) return 'N/A';
  
  if (typeof details === 'string') return details;
  
  if (typeof details === 'object') {
    // Check if it's an empty object
    if (Object.keys(details).length === 0) {
      return 'No additional details';
    }
    
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
  
  return String(details);
};

const TicketReport: React.FC<TicketReportProps> = ({ ticket }) => {
  // We don't need to automatically trigger print here
  // The parent component (PrintTicketButton) will handle the print functionality
  // through useReactToPrint

  return (
    <div className="p-8 max-w-5xl mx-auto print-content bg-white">
      {/* Header with Logo and Title */}
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Ticket Report</h1>
          <p className="text-gray-600 mt-1">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Enterprise Ticket Management</p>
          <p className="text-sm font-medium font-mono bg-gray-100 px-3 py-1 rounded-md inline-block">Ticket ID: {formatTicketId(ticket.displayId, ticket.id)}</p>
        </div>
      </div>

      {/* Ticket Information Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-800">Ticket Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Title</p>
                <p className="font-medium text-gray-900">{ticket.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <p className="font-medium">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                    {formatStatusLabel(ticket.status)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Priority</p>
                <p className="font-medium">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                    {formatPriorityLabel(ticket.priority)}
                  </span>
                </p>
              </div>
              {ticket.user && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Requester</p>
                  <p className="font-medium text-gray-900">
                    {ticket.user.name || ticket.user.email}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Created</p>
                <p className="font-medium text-gray-900">{safeFormatDate(ticket.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Last Updated</p>
                <p className="font-medium text-gray-900">{safeFormatDate(ticket.updatedAt)}</p>
              </div>
              {ticket.assignedTo && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Assigned To</p>
                  <p className="font-medium text-gray-900">
                    {ticket.assignedTo.name || ticket.assignedTo.email}
                  </p>
                </div>
              )}
              {ticket.asset && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Related Asset</p>
                  <p className="font-medium text-gray-900">
                    {ticket.asset.assetId} - {ticket.asset.name}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-1">Description</p>
            <p className="font-medium text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>
      </div>

      {/* Ticket History Section */}
      {ticket.history && ticket.history.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
            <h2 className="text-xl font-semibold text-gray-800">Ticket History</h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ticket.history.map((record, index) => {
                    // Determine what to display as the action
                    let actionText = record.action || '';
                    
                    // If we have status or priority changes, include them in the action
                    if (record.status) {
                      actionText = actionText ? `${actionText} - Status: ${formatStatusLabel(record.status)}` : `Status changed to ${formatStatusLabel(record.status)}`;
                    }
                    
                    if (record.priority) {
                      actionText = actionText ? `${actionText} - Priority: ${formatPriorityLabel(record.priority)}` : `Priority changed to ${formatPriorityLabel(record.priority)}`;
                    }
                    
                    // If no action is specified, use a default
                    if (!actionText) {
                      actionText = 'Comment added';
                    }
                    
                    // Determine what to display as details
                    // Prefer comment field if available, otherwise use details
                    const detailsText = record.comment || formatDetails(record.details);
                    
                    return (
                      <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{actionText}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{safeFormatDate(record.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.user?.email || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{detailsText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Barcode Section */}
      {ticket.barcode && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
            <h2 className="text-xl font-semibold text-gray-800">Ticket Barcode</h2>
          </div>
          <div className="p-6 flex justify-center">
            <div className="text-center">
              <img 
                src={`data:image/png;base64,${ticket.barcode}`} 
                alt="Ticket Barcode" 
                className="max-w-xs mx-auto"
              />
              <p className="mt-2 text-sm text-gray-500">
                Scan this barcode to quickly access ticket information
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Footer */}
      <ComplianceFooter 
        reportId={formatTicketId(ticket.displayId, ticket.id)} 
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
        }
      `}</style>
    </div>
  );
};

export default TicketReport;