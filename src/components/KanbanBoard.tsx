import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { formatTicketId } from "@/util/ticketFormat";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import PrintTicketButton from "@/components/PrintTicketButton";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Calendar,
  ChevronRight,
  Tag,
  MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface Column {
  id: TicketStatus;
  title: string;
  tickets: Ticket[];
  icon: React.ReactNode;
  color: string;
}

// Safely format date with fallback
const safeFormatDate = (dateString: string | null | undefined, language: string = 'en'): string => {
  if (!dateString) return language === 'ar' ? "تاريخ غير معروف" : "Unknown date";
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return language === 'ar' ? "تاريخ غير صالح" : "Invalid date";
    }
    
    // Use Intl.DateTimeFormat for more reliable formatting with language support
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    console.error("Date formatting error:", error);
    return language === 'ar' ? "خطأ في تنسيق التاريخ" : "Date format error";
  }
};

export default function KanbanBoard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user]);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/tickets", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets. Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error("Received invalid data format from server");
      }
      
      setTickets(data);
      organizeTicketsByStatus(data);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "Could not connect to the server. Please check your connection and try again.",
        variant: "destructive",
      });
      setTickets([]);
      setColumns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const organizeTicketsByStatus = (tickets: Ticket[]) => {
    const openTickets = tickets.filter(ticket => ticket.status === TicketStatus.OPEN);
    const inProgressTickets = tickets.filter(ticket => ticket.status === TicketStatus.IN_PROGRESS);
    const resolvedTickets = tickets.filter(ticket => ticket.status === TicketStatus.RESOLVED);
    const closedTickets = tickets.filter(ticket => ticket.status === TicketStatus.CLOSED);

    setColumns([
      {
        id: TicketStatus.OPEN,
        title: t('open'),
        tickets: openTickets,
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        color: "border-red-500"
      },
      {
        id: TicketStatus.IN_PROGRESS,
        title: t('in_progress'),
        tickets: inProgressTickets,
        icon: <Clock className="h-4 w-4 text-yellow-500" />,
        color: "border-yellow-500"
      },
      {
        id: TicketStatus.RESOLVED,
        title: t('resolved'),
        tickets: resolvedTickets,
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
        color: "border-green-500"
      },
      {
        id: TicketStatus.CLOSED,
        title: t('closed'),
        tickets: closedTickets,
        icon: <XCircle className="h-4 w-4 text-gray-500" />,
        color: "border-gray-500"
      }
    ]);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If there's no destination or the item was dropped back to its original position
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }

    // Find the ticket that was dragged
    const ticket = tickets.find(t => t.id === draggableId);
    if (!ticket) return;

    // Get the new status from the destination column id
    const newStatus = destination.droppableId as TicketStatus;
    
    // If the status hasn't changed, just reorder within the column
    if (ticket.status === newStatus) {
      // Create a new array of columns with the ticket reordered
      const newColumns = [...columns];
      const columnIndex = newColumns.findIndex(col => col.id === newStatus);
      if (columnIndex === -1) return;
      
      const newTickets = [...newColumns[columnIndex].tickets];
      const [removed] = newTickets.splice(source.index, 1);
      newTickets.splice(destination.index, 0, removed);
      
      newColumns[columnIndex].tickets = newTickets;
      setColumns(newColumns);
      return;
    }

    // Optimistically update the UI
    const updatedTicket = { ...ticket, status: newStatus };
    const updatedTickets = tickets.map(t => t.id === ticket.id ? updatedTicket : t);
    setTickets(updatedTickets);
    organizeTicketsByStatus(updatedTickets);

    // Send the update to the server
    try {
      const response = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error(`Failed to update ticket status. Status: ${response.status}`);
      }

      toast({
        title: "Status Updated",
        description: `Ticket ${formatTicketId(ticket.displayId, ticket.id)} moved to ${t(newStatus.toLowerCase())}.`,
      });
    } catch (error) {
      console.error("Error updating ticket status:", error);
      toast({
        title: "Error",
        description: "Failed to update ticket status. The view has been refreshed.",
        variant: "destructive",
      });
      // Revert the optimistic update
      fetchTickets();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('kanban_board')}</h1>
          <p className="text-muted-foreground">
            {t('drag_tickets_between_columns')}
          </p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('create_ticket')}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-[500px]">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-32 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map((column) => (
              <div key={column.id} className="flex flex-col h-full">
                <Card className={`flex-1 border-t-4 ${column.color}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {column.icon}
                        {column.title}
                        <Badge variant="outline" className="ml-2">
                          {column.tickets.length}
                        </Badge>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <CardContent
                        className={`p-2 flex-1 min-h-[400px] overflow-y-auto ${snapshot.isDraggingOver ? 'bg-accent/50' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {column.tickets.length === 0 ? (
                          <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-4">
                            <p className="text-muted-foreground text-center">
                              {t('no_tickets_in_column')}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {column.tickets.map((ticket, index) => (
                              <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`rounded-lg border bg-card text-card-foreground shadow-sm ${snapshot.isDragging ? 'opacity-70 shadow-lg' : ''}`}
                                    style={{
                                      ...provided.draggableProps.style,
                                      borderLeft: `4px solid ${ticket.priority === TicketPriority.CRITICAL ? 'rgb(239, 68, 68)' :
                                        ticket.priority === TicketPriority.HIGH ? 'rgb(249, 115, 22)' :
                                        ticket.priority === TicketPriority.MEDIUM ? 'rgb(234, 179, 8)' :
                                        'rgb(59, 130, 246)'}`
                                    }}
                                  >
                                    <div className="p-3">
                                      <div className="flex justify-between items-start gap-2">
                                        <div>
                                          <h3 className="font-medium text-sm line-clamp-2">{ticket.title}</h3>
                                          <div className="flex items-center mt-1">
                                            <Badge variant="outline" className="text-xs bg-background text-foreground border border-border font-mono">
                                              {formatTicketId(ticket.displayId, ticket.id)}
                                            </Badge>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className={`${getPriorityColor(ticket.priority)} text-xs`}>
                                          {formatPriorityLabel(ticket.priority)}
                                        </Badge>
                                      </div>
                                      
                                      {ticket.asset && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                          <span>{t('asset')}: {ticket.asset.name}</span>
                                        </div>
                                      )}
                                      
                                      <div className="flex justify-between items-center mt-3">
                                        <div className="text-xs text-muted-foreground flex items-center">
                                          <Calendar className="h-3 w-3 mr-1" />
                                          {safeFormatDate(ticket.createdAt, t.language)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Actions</span>
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem asChild>
                                                <Link href={`/tickets/${ticket.id}`} className="cursor-pointer">
                                                  {t('view_details')}
                                                </Link>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem>
                                                <PrintTicketButton 
                                                  ticket={ticket} 
                                                  variant="ghost" 
                                                  size="sm" 
                                                  className="w-full justify-start p-0 h-auto font-normal"
                                                  printBarcodeOnly={true}
                                                />
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 w-7 p-0 text-primary"
                                            asChild
                                          >
                                            <Link href={`/tickets/${ticket.id}`}>
                                              <ChevronRight className="h-4 w-4" />
                                              <span className="sr-only">View details</span>
                                            </Link>
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                        )}
                        {provided.placeholder}
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTicketCreated={() => {
          fetchTickets();
        }}
      />
    </div>
  );
}