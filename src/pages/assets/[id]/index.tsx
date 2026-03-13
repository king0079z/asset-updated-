// @ts-nocheck
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { 
  Loader2, Move, Trash2, Info, Ticket, Calendar, PlusCircle, 
  Download, Filter, Search, BarChart4, RefreshCcw, Clock, User,
  Printer, QrCode
} from 'lucide-react';
import PrintBarcodeButton from '@/components/PrintBarcodeButton';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

interface AssetHistory {
  id: string;
  action: 'MOVED' | 'DISPOSED' | 'REGISTERED' | 'TICKET_CREATED' | 'TASK_CREATED';
  details: any;
  createdAt: string;
  user: {
    id?: string;
    email: string;
  };
  assetId: string;
}

interface AssetHistoryResponse {
  history: AssetHistory[];
  stats: {
    totalEvents: number;
    byActionType: Record<string, number>;
    byUser: Record<string, number>;
    firstEvent: string | null;
    lastEvent: string | null;
  };
  asset: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    lastMovedAt: string | null;
    disposedAt: string | null;
    owner: string;
    vendor: string | null;
  };
}

const AssetHistoryList = ({ history }: { history: AssetHistory[] }) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No history records found
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'text-blue-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-orange-600';
      case 'CRITICAL': return 'text-red-600';
      case 'URGENT': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-blue-100 text-blue-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      case 'URGENT': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'text-blue-600';
      case 'IN_PROGRESS': return 'text-yellow-600';
      case 'COMPLETED': return 'text-green-600';
      case 'CANCELLED': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      case 'OPEN': return 'bg-green-100 text-green-800';
      case 'RESOLVED': return 'bg-purple-100 text-purple-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (item: AssetHistory) => {
    const isDisposed = item.action === 'DISPOSED';
    const isRegistered = item.action === 'REGISTERED';
    const isTicket = item.action === 'TICKET_CREATED' || (item.action === 'REGISTERED' && item.details?.action === 'TICKET_CREATED');
    const isTask = item.action === 'TASK_CREATED' || (item.action === 'REGISTERED' && item.details?.action === 'TASK_CREATED');
    const isMoved = item.action === 'MOVED';

    if (isDisposed) return <Trash2 className="h-5 w-5 text-destructive" />;
    if (isTicket) return <Ticket className="h-5 w-5 text-indigo-600" />;
    if (isTask) return <Calendar className="h-5 w-5 text-green-600" />;
    if (isMoved) return <Move className="h-5 w-5 text-blue-600" />;
    if (isRegistered) return <PlusCircle className="h-5 w-5 text-primary" />;
    
    return <Info className="h-5 w-5 text-muted-foreground" />;
  };

  const getActionTitle = (item: AssetHistory) => {
    const isDisposed = item.action === 'DISPOSED';
    const isRegistered = item.action === 'REGISTERED';
    const isTicket = item.action === 'TICKET_CREATED' || (item.action === 'REGISTERED' && item.details?.action === 'TICKET_CREATED');
    const isTask = item.action === 'TASK_CREATED' || (item.action === 'REGISTERED' && item.details?.action === 'TASK_CREATED');
    const isMoved = item.action === 'MOVED';

    if (isDisposed) return 'Asset Disposed';
    if (isTicket) return 'Ticket Created';
    if (isTask) return 'Task Planned';
    if (isMoved) return 'Asset Moved';
    if (isRegistered) return 'Asset Registered';
    
    return 'Action Performed';
  };

  const getActionStyles = (item: AssetHistory) => {
    const isDisposed = item.action === 'DISPOSED';
    const isRegistered = item.action === 'REGISTERED';
    const isTicket = item.action === 'TICKET_CREATED' || (item.action === 'REGISTERED' && item.details?.action === 'TICKET_CREATED');
    const isTask = item.action === 'TASK_CREATED' || (item.action === 'REGISTERED' && item.details?.action === 'TASK_CREATED');
    const isMoved = item.action === 'MOVED';
    
    if (isDisposed) {
      return {
        dotColor: 'bg-destructive/10 border-destructive',
        headerColor: 'text-destructive',
        bgColor: 'bg-destructive/5',
        badgeColor: 'bg-destructive/10 text-destructive'
      };
    } else if (isTicket) {
      return {
        dotColor: 'bg-indigo-100 border-indigo-500',
        headerColor: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        badgeColor: 'bg-indigo-100 text-indigo-800'
      };
    } else if (isTask) {
      return {
        dotColor: 'bg-green-100 border-green-500',
        headerColor: 'text-green-600',
        bgColor: 'bg-green-50',
        badgeColor: 'bg-green-100 text-green-800'
      };
    } else if (isMoved) {
      return {
        dotColor: 'bg-blue-100 border-blue-500',
        headerColor: 'text-blue-600',
        bgColor: 'bg-blue-50',
        badgeColor: 'bg-blue-100 text-blue-800'
      };
    } else if (isRegistered) {
      return {
        dotColor: 'bg-primary/10 border-primary',
        headerColor: 'text-primary',
        bgColor: 'bg-primary/5',
        badgeColor: 'bg-primary/10 text-primary'
      };
    }
    
    return {
      dotColor: 'bg-muted border-muted-foreground',
      headerColor: 'text-muted-foreground',
      bgColor: 'bg-muted/10',
      badgeColor: 'bg-muted text-muted-foreground'
    };
  };

  return (
    <ScrollArea className="h-[400px] w-full">
      <div className="relative p-4">
        {/* Timeline line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-[2px] bg-border" />
        
        <div className="space-y-8">
          {history.map((item, index) => {
            const { date, time } = formatDate(item.createdAt);
            const styles = getActionStyles(item);
            const actionTitle = getActionTitle(item);
            const isDisposed = item.action === 'DISPOSED';
            const isTicket = item.action === 'REGISTERED' && item.details?.action === 'TICKET_CREATED';
            const isTask = item.action === 'REGISTERED' && item.details?.action === 'TASK_CREATED';
            const isMoved = item.action === 'MOVED';
            const isRegistered = item.action === 'REGISTERED' && !item.details?.action;
            
            return (
              <div key={item.id} className="relative">
                {/* Timeline dot with icon */}
                <div className={`absolute left-0 w-[28px] h-[28px] rounded-full border-2 ${styles.dotColor} flex items-center justify-center -translate-y-1/2`}>
                  {getActionIcon(item)}
                </div>
                
                <div className="ml-12">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-semibold ${styles.headerColor}`}>
                        {actionTitle}
                      </h4>
                      <Badge variant="outline" className={styles.badgeColor}>
                        {item.action}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{date}</p>
                      <p className="text-xs text-muted-foreground">{time}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    by <span className="font-medium">{item.user.email}</span>
                  </p>

                  {/* Content */}
                  <div className={`mt-2 rounded-lg border p-4 ${styles.bgColor}`}>
                    {isMoved && item.details && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">Location Change</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">From Location:</span>
                            <div className="p-2 bg-background rounded border">
                              <p className="text-sm font-medium">
                                Floor {item.details.fromFloor || 'N/A'}
                              </p>
                              <p className="text-sm font-medium">
                                Room {item.details.fromRoom || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">To Location:</span>
                            <div className="p-2 bg-background rounded border">
                              <p className="text-sm font-medium">
                                Floor {item.details.toFloor || 'N/A'}
                              </p>
                              <p className="text-sm font-medium">
                                Room {item.details.toRoom || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                        {item.details.reason && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground block">Reason:</span>
                            <p className="text-sm">{item.details.reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isDisposed && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">Permanently Disposed</Badge>
                        </div>
                        <p className="text-sm mt-2">
                          This asset has been permanently marked as disposed and is no longer in circulation.
                        </p>
                        {item.details?.reason && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground block">Reason:</span>
                            <p className="text-sm">{item.details.reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isRegistered && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={styles.badgeColor}>Initial Registration</Badge>
                        </div>
                        <p className="text-sm mt-2">
                          This asset was registered in the system.
                        </p>
                        {item.details && Object.keys(item.details).length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {Object.entries(item.details).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-xs text-muted-foreground block capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>
                                <span className="text-sm font-medium">
                                  {typeof value === 'string' ? value : JSON.stringify(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isTicket && item.details && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-indigo-100 text-indigo-800">Maintenance Ticket</Badge>
                          {item.details.ticketPriority && (
                            <Badge variant="outline" className={getPriorityBadgeColor(item.details.ticketPriority)}>
                              {item.details.ticketPriority}
                            </Badge>
                          )}
                          {item.details.ticketStatus && (
                            <Badge variant="outline" className={getStatusBadgeColor(item.details.ticketStatus)}>
                              {item.details.ticketStatus}
                            </Badge>
                          )}
                        </div>
                        <div className="p-3 bg-background rounded border">
                          <h5 className="font-medium text-base">{item.details.ticketTitle}</h5>
                          {item.details.ticketDescription && (
                            <p className="text-sm text-muted-foreground mt-1">{item.details.ticketDescription}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Ticket ID:</span>
                            <span className="font-medium ml-1">{item.details.ticketDisplayId || `T-${item.details.ticketId?.substring(0, 8)}`}</span>
                          </div>
                          {item.details.ticketCreatedAt && (
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <span className="font-medium ml-1">
                                {new Date(item.details.ticketCreatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {item.details.latestUpdate && (
                            <div>
                              <span className="text-muted-foreground">Last Updated:</span>
                              <span className="font-medium ml-1">
                                {new Date(item.details.latestUpdate.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        {item.details.latestUpdate && (
                          <div className="mt-2 p-2 bg-muted/30 rounded-md">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Latest Update</span>
                              <Badge variant="outline" className={getStatusBadgeColor(item.details.latestUpdate.status)}>
                                {item.details.latestUpdate.status}
                              </Badge>
                            </div>
                            {item.details.latestUpdate.comment && (
                              <p className="text-sm">{item.details.latestUpdate.comment}</p>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              By {item.details.latestUpdate.updatedBy}
                            </div>
                          </div>
                        )}
                        <div className="mt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => {
                              if (item.details.ticketId) {
                                window.open(`/tickets/${item.details.ticketId}`, '_blank');
                              }
                            }}
                          >
                            <Ticket className="h-4 w-4 mr-2" />
                            View Ticket Details
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {isTask && item.details && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-100 text-green-800">Planned Task</Badge>
                          {item.details.taskPriority && (
                            <Badge variant="outline" className={getPriorityBadgeColor(item.details.taskPriority)}>
                              {item.details.taskPriority}
                            </Badge>
                          )}
                          {item.details.taskStatus && (
                            <Badge variant="outline" className={getStatusBadgeColor(item.details.taskStatus)}>
                              {item.details.taskStatus}
                            </Badge>
                          )}
                        </div>
                        <div className="p-3 bg-background rounded border">
                          <h5 className="font-medium text-base">{item.details.taskTitle}</h5>
                          {item.details.taskDescription && (
                            <p className="text-sm text-muted-foreground mt-1">{item.details.taskDescription}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">Schedule:</span>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">Start: </span>
                                <span className="text-xs font-medium">
                                  {new Date(item.details.taskStartDate).toLocaleDateString()}
                                </span>
                              </div>
                              {item.details.taskEndDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">End: </span>
                                  <span className="text-xs font-medium">
                                    {new Date(item.details.taskEndDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {item.details.taskAssignedTo && (
                            <div>
                              <span className="text-xs text-muted-foreground block">Assigned To:</span>
                              <span className="text-sm font-medium">{item.details.taskAssignedTo}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
};

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
  };
}

interface Asset {
  id: string;
  name: string;
  floorNumber?: string;
  roomNumber?: string;
  status: string;
  createdAt: string;
  lastMovedAt?: string;
  disposedAt?: string;
}

const AssetTicketsList = ({ tickets }: { tickets: Ticket[] }) => {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tickets found for this asset
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-blue-100 text-blue-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'RESOLVED': return 'bg-purple-100 text-purple-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ScrollArea className="h-[400px] w-full">
      <div className="p-4 space-y-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-lg">{ticket.title}</h3>
              <div className="flex gap-2">
                <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                  {ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()}
                </Badge>
                <Badge variant="outline" className={getStatusColor(ticket.status)}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{ticket.description}</p>
            <div className="flex flex-col gap-1">
              {ticket.user && (
                <div className="text-xs text-muted-foreground">
                  Created by: <span className="font-medium">{ticket.user.email}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Ticket ID: {ticket.id}</span>
                <span>Created: {formatDate(ticket.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default function AssetDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<AssetHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Dialog states
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDisposeDialog, setShowDisposeDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);

  // Move form state
  const [newFloorNumber, setNewFloorNumber] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');

  // History filter state
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');

  const fetchHistory = async (filters?: {
    filter?: string;
    startDate?: Date;
    endDate?: Date;
    actionType?: string[];
    userId?: string;
  }) => {
    if (!id) return;
    
    setLoadingHistory(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (filters?.filter && filters.filter !== 'ALL') {
        params.append('filter', filters.filter);
      }
      
      if (filters?.startDate) {
        params.append('startDate', filters.startDate.toISOString());
      }
      
      if (filters?.endDate) {
        params.append('endDate', filters.endDate.toISOString());
      }
      
      if (filters?.actionType && filters.actionType.length > 0) {
        params.append('actionType', filters.actionType.join(','));
      }
      
      if (filters?.userId) {
        params.append('userId', filters.userId);
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/assets/${id}/history${queryString}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      
      const data = await response.json();
      console.log('Fetched history:', data); // Debug log
      
      if (data.history) {
        setHistoryData(data);
      } else {
        // Handle legacy API response format
        setHistoryData({
          history: Array.isArray(data) ? data : [],
          stats: {
            totalEvents: Array.isArray(data) ? data.length : 0,
            byActionType: {},
            byUser: {},
            firstEvent: null,
            lastEvent: null
          },
          asset: asset ? {
            id: asset.id,
            name: asset.name,
            status: asset.status,
            createdAt: asset.createdAt,
            lastMovedAt: asset.lastMovedAt || null,
            disposedAt: asset.disposedAt || null,
            owner: '',
            vendor: null
          } : null
        });
      }
    } catch (error) {
      console.error('History fetch error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch asset history",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAsset();
    }
  }, [id]);

  // Function to fetch tickets for this asset
  const fetchTickets = async () => {
    if (!id) return;
    
    setLoadingTickets(true);
    try {
      const response = await fetch(`/api/assets/${id}/tickets`);
      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }
      const data = await response.json();
      console.log('Fetched tickets:', data); // Debug log
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Tickets fetch error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch asset tickets",
        variant: "destructive",
      });
    } finally {
      setLoadingTickets(false);
    }
  };

  // Separate effect for fetching history and tickets when details dialog is opened
  useEffect(() => {
    if (showDetailsDialog && id) {
      fetchHistory();
      fetchTickets();
    }
  }, [showDetailsDialog, id]);
  
  // Debug logs to help diagnose the issue
  useEffect(() => {
    if (historyData) {
      console.log('History data loaded:', {
        totalRecords: historyData.history.length,
        stats: historyData.stats,
        firstRecord: historyData.history[0] || 'No records'
      });
    }
  }, [historyData]);

  const fetchAsset = async () => {
    try {
      const response = await fetch(`/api/assets/${id}`);
      const data = await response.json();
      if (data.asset) {
        setAsset(data.asset);
        setNewFloorNumber(data.asset.floorNumber || '');
        setNewRoomNumber(data.asset.roomNumber || '');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch asset details",
        variant: "destructive",
      });
    }
  };

  const handleMove = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newFloorNumber.trim() || !newRoomNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter both floor number and room number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/assets/${id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          floorNumber: newFloorNumber, 
          roomNumber: newRoomNumber 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to move asset');
      }

      toast({
        title: "Success",
        description: "Asset location updated successfully",
      });
      setShowMoveDialog(false);
      await Promise.all([fetchAsset(), fetchHistory()]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update asset location",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDispose = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/assets/${id}/dispose`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to dispose asset');
      }

      toast({
        title: "Success",
        description: "Asset has been marked as disposed",
      });
      setShowDisposeDialog(false);
      await Promise.all([fetchAsset(), fetchHistory()]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dispose asset",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!asset) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{asset.name}</h1>
              <p className="text-sm text-muted-foreground">ID: {asset.id}</p>
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowDetailsDialog(true)}
              >
                <Info className="h-4 w-4 mr-2" />
                Details
              </Button>
              <PrintBarcodeButton
                barcodeValue={asset.id}
                displayText={asset.id}
                title={asset.name}
                subtitle={`Asset ID: ${asset.id}`}
                variant="outline"
                size="icon"
              />
              {asset.status !== 'DISPOSED' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowMoveDialog(true)}
                    disabled={loading}
                  >
                    <Move className="h-4 w-4 mr-2" />
                    Move
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDisposeDialog(true)}
                    disabled={loading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Dispose
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Floor</p>
              <p className="font-medium">{asset.floorNumber || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Room</p>
              <p className="font-medium">{asset.roomNumber || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">{asset.status}</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.back()}
            className="w-full"
          >
            Back
          </Button>
        </div>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Asset Details</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="font-medium">{asset.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">ID</Label>
                  <p className="font-medium">{asset.id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Floor</Label>
                  <p className="font-medium">{asset.floorNumber || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Room</Label>
                  <p className="font-medium">{asset.roomNumber || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <p className="font-medium">{asset.status}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Created At</Label>
                  <p className="font-medium">{new Date(asset.createdAt).toLocaleDateString()}</p>
                </div>
                {asset.purchaseDate && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Purchase Date</Label>
                    <p className="font-medium">{new Date(asset.purchaseDate).toLocaleDateString()}</p>
                  </div>
                )}
                {asset.purchaseAmount && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Purchase Amount</Label>
                    <p className="font-medium">{asset.purchaseAmount} QAR</p>
                  </div>
                )}
                {asset.lastMovedAt && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Last Moved</Label>
                    <p className="font-medium">{new Date(asset.lastMovedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {asset.disposedAt && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Disposed At</Label>
                    <p className="font-medium">{new Date(asset.disposedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="history">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowStatsDialog(true)}
                    >
                      <BarChart4 className="h-4 w-4 mr-2" />
                      Statistics
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Reset all filters
                        setHistoryFilter('ALL');
                        setStartDate(undefined);
                        setEndDate(undefined);
                        setSelectedActionTypes([]);
                        setSelectedUser('');
                        fetchHistory();
                      }}
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (!historyData?.history) return;
                        
                        // Create CSV content
                        const headers = [
                          'Action', 
                          'Date', 
                          'Time', 
                          'User', 
                          'Details'
                        ];
                        
                        const rows = historyData.history.map(item => {
                          const date = new Date(item.createdAt);
                          return [
                            item.action,
                            date.toLocaleDateString(),
                            date.toLocaleTimeString(),
                            item.user.email,
                            JSON.stringify(item.details)
                          ];
                        });
                        
                        const csvContent = [
                          headers.join(','),
                          ...rows.map(row => row.join(','))
                        ].join('\n');
                        
                        // Create download link
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `asset-${id}-history.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search history..."
                        className="pl-8 h-9 w-[200px]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Filter className="h-4 w-4 mr-2" />
                          Filter
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-4">
                          <h4 className="font-medium">Filter History</h4>
                          
                          <div className="space-y-2">
                            <Label>Action Type</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {['REGISTERED', 'MOVED', 'DISPOSED', 'TICKET_CREATED', 'TASK_CREATED'].map((action) => (
                                <div key={action} className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`action-${action}`} 
                                    checked={selectedActionTypes.includes(action)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedActionTypes([...selectedActionTypes, action]);
                                      } else {
                                        setSelectedActionTypes(
                                          selectedActionTypes.filter(a => a !== action)
                                        );
                                      }
                                    }}
                                  />
                                  <label 
                                    htmlFor={`action-${action}`}
                                    className="text-sm cursor-pointer"
                                  >
                                    {action.replace('_', ' ')}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label>Start Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                    size="sm"
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <CalendarComponent
                                    mode="single"
                                    selected={startDate}
                                    onSelect={setStartDate}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>End Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                    size="sm"
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <CalendarComponent
                                    mode="single"
                                    selected={endDate}
                                    onSelect={setEndDate}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          
                          {historyData?.stats?.byUser && Object.keys(historyData.stats.byUser).length > 0 && (
                            <div className="space-y-2">
                              <Label>User</Label>
                              <Select 
                                value={selectedUser} 
                                onValueChange={setSelectedUser}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="All users" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">All users</SelectItem>
                                  {Object.entries(historyData.stats.byUser).map(([email, count]) => (
                                    <SelectItem key={email} value={email}>
                                      {email} ({count})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedActionTypes([]);
                                setStartDate(undefined);
                                setEndDate(undefined);
                                setSelectedUser('');
                              }}
                            >
                              Reset
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => {
                                fetchHistory({
                                  actionType: selectedActionTypes.length > 0 ? selectedActionTypes : undefined,
                                  startDate,
                                  endDate,
                                  userId: selectedUser || undefined
                                });
                              }}
                            >
                              Apply Filters
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {historyData?.stats && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
                    <div>
                      Total events: <span className="font-medium">{historyData.stats.totalEvents}</span>
                    </div>
                    {historyData.stats.firstEvent && historyData.stats.lastEvent && (
                      <div>
                        Timeline: <span className="font-medium">{new Date(historyData.stats.firstEvent).toLocaleDateString()}</span> to <span className="font-medium">{new Date(historyData.stats.lastEvent).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : historyData?.history && historyData.history.length > 0 ? (
                  <AssetHistoryList 
                    history={
                      searchQuery 
                        ? historyData.history.filter(item => 
                            JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
                          )
                        : historyData.history
                    } 
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No history records found
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="tickets">
              {loadingTickets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <AssetTicketsList tickets={tickets} />
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Asset</DialogTitle>
            <DialogDescription>
              Update the location of this asset
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMove}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentFloor">Current Floor</Label>
                  <p className="text-sm text-muted-foreground">{asset.floorNumber || 'Not specified'}</p>
                </div>
                <div>
                  <Label htmlFor="currentRoom">Current Room</Label>
                  <p className="text-sm text-muted-foreground">{asset.roomNumber || 'Not specified'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newFloor">New Floor Number</Label>
                  <Input
                    id="newFloor"
                    value={newFloorNumber}
                    onChange={(e) => setNewFloorNumber(e.target.value)}
                    placeholder="Enter floor number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newRoom">New Room Number</Label>
                  <Input
                    id="newRoom"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    placeholder="Enter room number"
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMoveDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dispose Dialog */}
      <AlertDialog open={showDisposeDialog} onOpenChange={setShowDisposeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispose Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dispose of this asset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDispose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dispose
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Statistics Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Asset History Statistics</DialogTitle>
            <DialogDescription>
              Detailed analytics about this asset's history and activity
            </DialogDescription>
          </DialogHeader>
          
          {historyData?.stats ? (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Activity Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Events:</span>
                      <span className="font-medium">{historyData.stats.totalEvents}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">First Activity:</span>
                      <span className="font-medium">
                        {historyData.stats.firstEvent 
                          ? new Date(historyData.stats.firstEvent).toLocaleDateString() 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Last Activity:</span>
                      <span className="font-medium">
                        {historyData.stats.lastEvent 
                          ? new Date(historyData.stats.lastEvent).toLocaleDateString() 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Active Period:</span>
                      <span className="font-medium">
                        {historyData.stats.firstEvent && historyData.stats.lastEvent
                          ? `${Math.ceil((new Date(historyData.stats.lastEvent).getTime() - 
                              new Date(historyData.stats.firstEvent).getTime()) / 
                              (1000 * 60 * 60 * 24))} days`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Asset Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Name:</span>
                      <span className="font-medium">{historyData.asset?.name || asset.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Status:</span>
                      <span className="font-medium">{historyData.asset?.status || asset.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Owner:</span>
                      <span className="font-medium">{historyData.asset?.owner || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Vendor:</span>
                      <span className="font-medium">{historyData.asset?.vendor || 'N/A'}</span>
                    </div>
                  </div>
                </Card>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Events by Type</h3>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(historyData.stats.byActionType).map(([action, count]) => (
                    <Card key={action} className="p-3 flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-center text-muted-foreground mt-1">
                        {action.replace('_', ' ')}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
              
              {Object.keys(historyData.stats.byUser).length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Activity by User</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="text-left p-2 text-sm font-medium">User</th>
                          <th className="text-center p-2 text-sm font-medium">Events</th>
                          <th className="text-right p-2 text-sm font-medium">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(historyData.stats.byUser)
                          .sort((a, b) => b[1] - a[1])
                          .map(([email, count], index) => (
                            <tr key={email} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                              <td className="p-2 text-sm">{email}</td>
                              <td className="p-2 text-sm text-center">{count}</td>
                              <td className="p-2 text-sm text-right">
                                {Math.round((count / historyData.stats.totalEvents) * 100)}%
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Timeline Highlights</h3>
                <div className="space-y-2">
                  {historyData.asset?.createdAt && (
                    <div className="flex justify-between items-center p-2 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-primary" />
                        <span className="text-sm">Asset Registered</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(historyData.asset.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {historyData.asset?.lastMovedAt && (
                    <div className="flex justify-between items-center p-2 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Move className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Last Moved</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(historyData.asset.lastMovedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {historyData.asset?.disposedAt && (
                    <div className="flex justify-between items-center p-2 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="text-sm">Asset Disposed</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(historyData.asset.disposedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No statistics available
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowStatsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}