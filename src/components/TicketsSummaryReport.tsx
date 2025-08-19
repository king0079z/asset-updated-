import React from 'react';
import { format } from 'date-fns';
import { AlertCircle, Clock, CheckCircle2, XCircle, BarChart4 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ComplianceFooter } from './ComplianceFooter';

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
  assetId: string | null;
  asset: {
    id: string;
    name: string;
    assetId: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketsSummaryReportProps {
  tickets: Ticket[];
}

// Safely format date with fallback
const safeFormatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch (error) {
    return "Invalid Date";
  }
};

const getPriorityColor = (priority: TicketPriority) => {
  switch (priority) {
    case TicketPriority.LOW:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case TicketPriority.MEDIUM:
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case TicketPriority.HIGH:
      return "bg-orange-100 text-orange-800 border-orange-200";
    case TicketPriority.CRITICAL:
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case TicketStatus.OPEN:
      return "bg-red-100 text-red-800 border-red-200";
    case TicketStatus.IN_PROGRESS:
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case TicketStatus.RESOLVED:
      return "bg-green-100 text-green-800 border-green-200";
    case TicketStatus.CLOSED:
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusIcon = (status: TicketStatus) => {
  switch (status) {
    case TicketStatus.OPEN:
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case TicketStatus.IN_PROGRESS:
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case TicketStatus.RESOLVED:
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case TicketStatus.CLOSED:
      return <XCircle className="h-4 w-4 text-gray-500" />;
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

const TicketsSummaryReport: React.FC<TicketsSummaryReportProps> = ({ tickets }) => {
  // Count tickets by status
  const statusCounts = {
    [TicketStatus.OPEN]: tickets.filter(t => t.status === TicketStatus.OPEN).length,
    [TicketStatus.IN_PROGRESS]: tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
    [TicketStatus.RESOLVED]: tickets.filter(t => t.status === TicketStatus.RESOLVED).length,
    [TicketStatus.CLOSED]: tickets.filter(t => t.status === TicketStatus.CLOSED).length,
  };

  // Count tickets by priority
  const priorityCounts = {
    [TicketPriority.LOW]: tickets.filter(t => t.priority === TicketPriority.LOW).length,
    [TicketPriority.MEDIUM]: tickets.filter(t => t.priority === TicketPriority.MEDIUM).length,
    [TicketPriority.HIGH]: tickets.filter(t => t.priority === TicketPriority.HIGH).length,
    [TicketPriority.CRITICAL]: tickets.filter(t => t.priority === TicketPriority.CRITICAL).length,
  };

  // Calculate simple statistics
  const openTicketsPercentage = Math.round((statusCounts[TicketStatus.OPEN] / tickets.length) * 100) || 0;
  const highPriorityPercentage = Math.round(((priorityCounts[TicketPriority.HIGH] + priorityCounts[TicketPriority.CRITICAL]) / tickets.length) * 100) || 0;

  return (
    <div className="p-8 max-w-5xl mx-auto print-content bg-white">
      {/* Header with Logo and Title */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Tickets Summary Report</h1>
          <p className="text-gray-600 mt-1">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end">
            <BarChart4 className="h-6 w-6 text-gray-700 mr-2" />
            <span className="text-lg font-semibold text-gray-700">Enterprise Ticket Management</span>
          </div>
          <p className="text-sm font-medium mt-1">Total Tickets: {tickets.length}</p>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="text-2xl font-bold">{statusCounts[TicketStatus.OPEN]}</div>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {openTicketsPercentage}%
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts[TicketStatus.IN_PROGRESS]}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="text-2xl font-bold">{priorityCounts[TicketPriority.HIGH] + priorityCounts[TicketPriority.CRITICAL]}</div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {highPriorityPercentage}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${status === TicketStatus.OPEN ? 'bg-red-500' : 
                        status === TicketStatus.IN_PROGRESS ? 'bg-yellow-500' : 
                        status === TicketStatus.RESOLVED ? 'bg-green-500' : 'bg-gray-500'}`} 
                      style={{ width: `${Math.round((count / tickets.length) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between ml-4 min-w-[120px]">
                    <div className="flex items-center">
                      {getStatusIcon(status as TicketStatus)}
                      <span className="ml-2 text-sm">{formatStatusLabel(status as TicketStatus)}</span>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(priorityCounts).map(([priority, count]) => (
                <div key={priority} className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${priority === TicketPriority.LOW ? 'bg-blue-500' : 
                        priority === TicketPriority.MEDIUM ? 'bg-yellow-500' : 
                        priority === TicketPriority.HIGH ? 'bg-orange-500' : 'bg-red-500'}`} 
                      style={{ width: `${Math.round((count / tickets.length) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between ml-4 min-w-[120px]">
                    <span className="text-sm">{formatPriorityLabel(priority as TicketPriority)}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Table */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Ticket Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, index) => (
                  <tr key={ticket.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-50`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.displayId || `ID-${ticket.id.substring(0, 8)}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{ticket.title}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline" className={`${getStatusColor(ticket.status)}`}>
                        <span className="flex items-center">
                          {getStatusIcon(ticket.status)}
                          <span className="ml-1">{formatStatusLabel(ticket.status)}</span>
                        </span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline" className={`${getPriorityColor(ticket.priority)}`}>
                        {formatPriorityLabel(ticket.priority)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.asset ? ticket.asset.name : 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{safeFormatDate(ticket.createdAt)}</td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No tickets found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Footer */}
      <Separator className="my-6" />
      <ComplianceFooter 
        reportId={`TICKETS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`} 
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

export default TicketsSummaryReport;