import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Clock, CheckCircle2, XCircle, History, Calendar, User, MessageSquare, Tag } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";

interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  status: TicketStatus | null;
  priority: TicketPriority | null;
  comment: string;
  user: {
    id: string | null;
    email: string;
  };
  createdAt: string;
  ticketDisplayId?: string;
  ticketTitle?: string;
  startedAt?: string;
  resolutionTime?: number;
}

interface TicketHistoryProps {
  ticketId: string;
}

export default function TicketHistory({ ticketId }: TicketHistoryProps) {
  const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (ticketId) {
      fetchHistory();
    }
  }, [ticketId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/history`);
      
      if (!response.ok) {
        let errorMessage = "Failed to fetch ticket history";
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("Error fetching ticket history:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch ticket history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(dateString));
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Invalid date";
    }
  };

  const getStatusIcon = (status: TicketStatus | null) => {
    if (!status) return null;
    
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

  const formatStatusLabel = (status: TicketStatus | null): string => {
    if (!status) return "";
    return status.replace("_", " ");
  };

  const formatPriorityLabel = (priority: TicketPriority | null): string => {
    if (!priority) return "";
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  };

  const getPriorityColor = (priority: TicketPriority | null) => {
    if (!priority) return "";
    
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

  const getStatusColor = (status: TicketStatus | null) => {
    if (!status) return "";
    
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
  
  const formatResolutionTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const timeString = [];
    if (hours > 0) timeString.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) timeString.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (remainingSeconds > 0 && hours === 0) timeString.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
    
    return timeString.join(', ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Ticket History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Ticket History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="bg-muted/30 p-4 rounded-full mb-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No history yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              This ticket doesn't have any history entries yet. Changes to status or priority will appear here.
            </p>
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-muted-foreground/20" />
            
            {history.map((entry, index) => (
              <div key={entry.id} className="relative pl-10 pb-8">
                {/* Timeline dot */}
                <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-background border-2 border-muted-foreground/20 flex items-center justify-center">
                  {entry.status ? (
                    getStatusIcon(entry.status)
                  ) : entry.priority ? (
                    <Tag className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm">{entry.user?.email || 'System'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {/* Check if this is a ticket creation entry */}
                    {entry.comment && entry.comment.startsWith("Ticket created") ? (
                      <Badge 
                        variant="outline" 
                        className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="h-4 w-4"
                        >
                          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                          <path d="M7 7h.01" />
                        </svg>
                        <span>Ticket Created</span>
                      </Badge>
                    ) : (
                      <>
                        {entry.status && (
                          <Badge 
                            variant="outline" 
                            className={`flex items-center gap-1 ${getStatusColor(entry.status)} border`}
                          >
                            {getStatusIcon(entry.status)}
                            <span>Changed status to {formatStatusLabel(entry.status)}</span>
                          </Badge>
                        )}
                        
                        {entry.priority && (
                          <Badge 
                            variant="outline" 
                            className={`${getPriorityColor(entry.priority)} border`}
                          >
                            Changed priority to {formatPriorityLabel(entry.priority)}
                          </Badge>
                        )}
                        
                        {!entry.status && !entry.priority && (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                            Added comment
                          </Badge>
                        )}
                        
                        {/* Display resolution time badge if available */}
                        {entry.status === TicketStatus.RESOLVED && entry.resolutionTime && (
                          <Badge 
                            variant="outline" 
                            className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1"
                          >
                            <Clock className="h-4 w-4" />
                            <span>
                              Resolution time: {formatResolutionTime(entry.resolutionTime)}
                            </span>
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{entry.comment}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}