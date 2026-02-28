// @ts-nocheck
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import PrintTicketButton from "@/components/PrintTicketButton";
import { safeFormatDate, getPriorityColor, getStatusColor, getPriorityBorderColor } from "@/util/ticketUtils";
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

interface TicketCardViewProps {
  tickets: Ticket[];
  isLoading: boolean;
}

export default function TicketCardView({ tickets, isLoading }: TicketCardViewProps) {
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
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
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
    <div className="grid gap-4">
      {tickets.map((ticket) => (
        <Card 
          key={ticket.id} 
          className="overflow-hidden transition-all duration-200 hover:shadow-md group border-l-4"
          style={{ 
            borderLeftColor: 
              ticket.priority === TicketPriority.CRITICAL ? 'rgb(239, 68, 68)' :
              ticket.priority === TicketPriority.HIGH ? 'rgb(249, 115, 22)' :
              ticket.priority === TicketPriority.MEDIUM ? 'rgb(234, 179, 8)' :
              'rgb(59, 130, 246)'
          }}
        >
          <Link href={`/tickets/${ticket.id}`} className="block">
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {ticket.title}
                    </CardTitle>
                    <Badge variant="outline" className="bg-background text-foreground border border-border font-mono">
                      {formatTicketId(ticket.displayId, ticket.id)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      <span>{safeFormatDate(ticket.createdAt, t.language)}</span>
                    </div>
                    {ticket.asset && (
                      <div className="flex items-center">
                        <span>•</span>
                        <span className="ml-2">{t('asset')}: {ticket.asset.name}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`${getPriorityColor(ticket.priority)} border`}>
                    {formatPriorityLabel(ticket.priority)}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`flex items-center gap-1 ${getStatusColor(ticket.status)} border`}
                  >
                    {getStatusIcon(ticket.status)}
                    <span>{formatStatusLabel(ticket.status)}</span>
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground line-clamp-2">
                {ticket.description}
              </p>
            </CardContent>
            <CardFooter className="pt-0 pb-4 flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {ticket.updatedAt !== ticket.createdAt && (
                  <span>{t('updated')} {safeFormatDate(ticket.updatedAt, t.language)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <PrintTicketButton 
                  ticket={ticket} 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  printBarcodeOnly={true}
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-primary"
                  asChild
                >
                  <div>
                    <ChevronRight className="h-5 w-5" />
                    <span className="sr-only">View details</span>
                  </div>
                </Button>
              </div>
            </CardFooter>
          </Link>
        </Card>
      ))}
    </div>
  );
}