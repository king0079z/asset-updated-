import React from "react";
import Link from "next/link";
import { useTranslation } from "@/contexts/TranslationContext";
import { formatTicketId } from "@/util/ticketFormat";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Calendar,
  ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PrintTicketButton from "@/components/PrintTicketButton";
import { safeFormatDate, getPriorityColor, getStatusColor } from "@/util/ticketUtils";
import { TicketStatus, TicketPriority } from "@prisma/client";

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

interface TicketListViewProps {
  tickets: Ticket[];
  isLoading: boolean;
}

export default function TicketListView({ tickets, isLoading }: TicketListViewProps) {
  const { t } = useTranslation();

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
        return "bg-red-50 text-red-700 border-red-200";
      case TicketStatus.IN_PROGRESS:
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case TicketStatus.RESOLVED:
        return "bg-green-50 text-green-700 border-green-200";
      case TicketStatus.CLOSED:
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
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
    // Use translation keys for statuses
    const statusKeys = {
      [TicketStatus.OPEN]: 'open',
      [TicketStatus.IN_PROGRESS]: 'in_progress',
      [TicketStatus.RESOLVED]: 'resolved',
      [TicketStatus.CLOSED]: 'closed'
    };
    return t(statusKeys[status] || 'unknown_status');
  };

  const formatPriorityLabel = (priority: TicketPriority): string => {
    // Use translation keys for priorities
    const priorityKeys = {
      [TicketPriority.LOW]: 'priority_low',
      [TicketPriority.MEDIUM]: 'priority_medium',
      [TicketPriority.HIGH]: 'priority_high',
      [TicketPriority.CRITICAL]: 'priority_critical'
    };
    return t(priorityKeys[priority] || 'unknown_priority');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="bg-muted/30 p-4 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">{t('no_tickets_found')}</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          {t('no_tickets_in_status').replace('{status}', t('selected'))}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table header */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 font-medium text-sm text-muted-foreground bg-muted/40 rounded-lg">
        <div className="col-span-5">{t('ticket')}</div>
        <div className="col-span-2">{t('created')}</div>
        <div className="col-span-2">{t('priority')}</div>
        <div className="col-span-2">{t('status')}</div>
        <div className="col-span-1 text-right">{t('actions')}</div>
      </div>
      
      {/* Ticket rows */}
      {tickets.map((ticket) => (
        <div 
          key={ticket.id} 
          className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-accent/10 transition-colors"
        >
          {/* Ticket info - mobile view is stacked, desktop is grid */}
          <div className="col-span-5 min-w-0">
            <Link href={`/tickets/${ticket.id}`} className="block group">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-lg truncate group-hover:text-primary transition-colors">
                  {ticket.title}
                </h3>
                <Badge variant="outline" className="bg-background text-foreground border border-border font-mono">
                  {formatTicketId(ticket.displayId, ticket.id)}
                </Badge>
              </div>
              {ticket.asset && (
                <div className="text-sm text-muted-foreground mt-1">
                  {t('asset')}: {ticket.asset.name}
                </div>
              )}
            </Link>
          </div>
          
          {/* Created date */}
          <div className="col-span-2 flex items-center text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 mr-2 md:inline-block hidden" />
            <span>{safeFormatDate(ticket.createdAt, t.language)}</span>
          </div>
          
          {/* Priority */}
          <div className="col-span-2 flex items-center">
            <Badge variant="outline" className={`${getPriorityColor(ticket.priority)} border`}>
              {formatPriorityLabel(ticket.priority)}
            </Badge>
          </div>
          
          {/* Status */}
          <div className="col-span-2 flex items-center">
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1 ${getStatusColor(ticket.status)} border`}
            >
              {getStatusIcon(ticket.status)}
              <span>{formatStatusLabel(ticket.status)}</span>
            </Badge>
          </div>
          
          {/* Actions */}
          <div className="col-span-1 flex items-center justify-end space-x-1">
            <PrintTicketButton 
              ticket={ticket} 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              printBarcodeOnly={false}
            />
            <Link 
              href={`/tickets/${ticket.id}`}
              className="h-8 w-8 p-0 flex items-center justify-center text-primary hover:bg-accent rounded-md"
            >
              <ChevronRight className="h-5 w-5" />
              <span className="sr-only">View details</span>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}