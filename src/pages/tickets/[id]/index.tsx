import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatTicketId } from "@/util/ticketFormat";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  Printer, 
  Calendar,
  Tag,
  Info,
  Loader2,
  LayoutGrid,
  MessageSquare,
  History
} from "lucide-react";
import Link from "next/link";
import TicketBarcodeDisplay from "@/components/TicketBarcodeDisplay";
import PrintTicketButton from "@/components/PrintTicketButton";
import TicketHistory from "@/components/TicketHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// Safely format date with fallback
const safeFormatDate = (dateString: string | null | undefined, formatStr: string = "MMMM d, yyyy 'at' h:mm a"): string => {
  if (!dateString) return "Unknown date";
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }
    
    // Use Intl.DateTimeFormat for more reliable formatting
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Date format error";
  }
};

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
  assignedToId: string | null;
  assignedTo: {
    id: string;
    email: string;
  } | null;
  requesterName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TicketDetailsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TicketDetailsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function TicketDetailsContent() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<TicketStatus>(TicketStatus.OPEN);
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
  const [comment, setComment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchTicket(id);
    }
  }, [id]);
  
  // Set up periodic refresh to ensure ticket data stays up-to-date
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    
    // Initial fetch
    fetchTicket(id as string);
    
    // Refresh ticket data more frequently (every 10 seconds)
    const refreshInterval = setInterval(() => {
      if (!isUpdating) { // Don't refresh while an update is in progress
        fetchTicket(id as string);
      }
    }, 10000);
    
    // Clean up interval on unmount
    return () => clearInterval(refreshInterval);
  }, [id, isUpdating]);
  
  // Force refresh when the component becomes visible again (tab focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && id && typeof id === 'string') {
        fetchTicket(id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id]);

  const fetchTicket = async (ticketId: string) => {
    setIsLoading(true);
    try {
      // Add timestamp to URL to prevent browser caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/tickets/${ticketId}?t=${timestamp}`, {
        // Add cache control to prevent stale data
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = "Failed to fetch ticket details";
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
      
      // Parse the JSON response with error handling
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Error parsing ticket data:", parseError);
        throw new Error("Invalid response format from server");
      }
      
      // Validate the data structure
      if (!data || typeof data !== 'object') {
        console.error("Invalid ticket data received:", data);
        throw new Error("Received invalid ticket data from server");
      }
      
      // Log the received data to check if barcode is included
      console.log("Received ticket data:", {
        id: data.id,
        title: data.title,
        barcode: data.barcode,
        hasBarcode: !!data.barcode
      });
      
      // Ensure required fields exist with fallbacks
      const validatedData = {
        id: data.id || ticketId,
        title: data.title || "Untitled Ticket",
        description: data.description || "",
        status: data.status || TicketStatus.OPEN,
        priority: data.priority || TicketPriority.MEDIUM,
        barcode: data.barcode || null, // Make sure to include barcode
        assetId: data.assetId || null,
        asset: data.asset || null,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      };
      
      // Ensure status and priority are valid enum values
      const validStatus = Object.values(TicketStatus).includes(validatedData.status) 
        ? validatedData.status 
        : TicketStatus.OPEN;
        
      const validPriority = Object.values(TicketPriority).includes(validatedData.priority)
        ? validatedData.priority
        : TicketPriority.MEDIUM;
      
      // Update state with validated data
      setTicket({
        ...validatedData,
        status: validStatus,
        priority: validPriority
      });
      setStatus(validStatus);
      setPriority(validPriority);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "An error occurred while fetching ticket details",
        variant: "destructive",
      });
      // Set ticket to null to show the not found state
      setTicket(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTicket = async () => {
    if (!ticket || !id || typeof id !== 'string') return;
    
    // Check if status or priority has changed and require a comment
    const isStatusChanged = status !== ticket.status;
    const isPriorityChanged = priority !== ticket.priority;
    
    if ((isStatusChanged || isPriorityChanged) && (!comment || comment.trim() === '')) {
      toast({
        title: "Comment Required",
        description: "Please provide a comment explaining the changes you're making.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdating(true);
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      
      // Log the update attempt
      console.log(`Updating ticket ${id} with status: ${status}, priority: ${priority}`);
      
      const response = await fetch(`/api/tickets/${id}?t=${timestamp}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify({
          title: ticket.title,
          description: ticket.description,
          status,
          priority,
          assetId: ticket.assetId || null,
          comment: comment.trim()
        }),
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = "Failed to update ticket";
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
      
      // Parse the response to get the updated ticket
      const updatedTicket = await response.json();
      
      // Log the updated ticket status to verify it's correct
      console.log("Updated ticket status:", updatedTicket.status);
      
      // Update the local state with the updated ticket
      setTicket(updatedTicket);
      setStatus(updatedTicket.status);
      setPriority(updatedTicket.priority);
      
      // Show appropriate success message based on the status change
      let successMessage = "Ticket updated successfully";
      if (isStatusChanged) {
        if (updatedTicket.status === TicketStatus.RESOLVED) {
          successMessage = "Ticket resolved successfully";
        } else if (updatedTicket.status === TicketStatus.IN_PROGRESS) {
          successMessage = "Ticket marked as in progress";
        } else if (updatedTicket.status === TicketStatus.OPEN) {
          successMessage = "Ticket reopened successfully";
        } else if (updatedTicket.status === TicketStatus.CLOSED) {
          successMessage = "Ticket closed successfully";
        }
      }
      
      toast({
        title: "Success",
        description: successMessage,
      });
      
      // Clear the comment field
      setComment("");
      
      // Switch to history tab to show the new update
      setActiveTab("history");
      
      // Refresh the ticket data to ensure we have the latest state
      setTimeout(() => {
        fetchTicket(id);
      }, 500);
    } catch (error) {
      console.error("Error updating ticket:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update ticket",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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
        return <AlertCircle className="h-5 w-5 text-red-500" />;
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="outline" size="sm" className="mr-4" disabled>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="bg-muted/30 p-6 rounded-full mb-6">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-medium mb-2">Ticket not found</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          The ticket you're looking for doesn't exist or has been deleted.
        </p>
        <Button variant="default" asChild>
          <Link href="/tickets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to tickets
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tickets" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{ticket.title}</h1>
              <div className="font-medium text-foreground bg-background px-3 py-1 rounded-md border border-border font-mono">
                {formatTicketId(ticket.displayId, ticket.id)}
              </div>
            </div>
            <div className="flex items-center text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              <span className="text-sm">Created on {safeFormatDate(ticket.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PrintTicketButton 
            ticket={ticket} 
            variant="outline" 
            size="default" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "history")} className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>Details</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span>History</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-6 pt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                </CardContent>
              </Card>

              {ticket.barcode && (
                <div className="barcode-container" key={`barcode-container-${ticket.id}-${activeTab}`}>
                  <TicketBarcodeDisplay 
                    key={`ticket-barcode-${ticket.id}-${activeTab}`} 
                    ticketId={ticket.id} 
                    ticketTitle={ticket.title} 
                    barcode={ticket.barcode}
                    displayId={ticket.displayId}
                  />
                </div>
              )}

              {ticket.asset && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5 text-muted-foreground" />
                      Related Asset
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Badge variant="outline" className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200">
                        {ticket.asset.assetId}
                      </Badge>
                      <span className="font-medium">{ticket.asset.name}</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/assets/${ticket.asset.id}`}>
                        View Asset Details
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {ticket.assignedTo && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="h-5 w-5 text-muted-foreground"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Assigned Staff
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Badge variant="outline" className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200">
                        Staff
                      </Badge>
                      <span className="font-medium">{ticket.assignedTo.email}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {ticket.requesterName && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="h-5 w-5 text-muted-foreground"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Requester
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Badge variant="outline" className="px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200">
                        Requester
                      </Badge>
                      <span className="font-medium">{ticket.requesterName}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="pt-4">
              {ticket && <TicketHistory ticketId={ticket.id} />}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="border-t-4" style={{ 
            borderTopColor: 
              ticket.status === TicketStatus.OPEN ? 'rgb(239, 68, 68)' :
              ticket.status === TicketStatus.IN_PROGRESS ? 'rgb(234, 179, 8)' :
              ticket.status === TicketStatus.RESOLVED ? 'rgb(34, 197, 94)' :
              'rgb(107, 114, 128)'
          }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Status
              </CardTitle>
              <CardDescription>
                Current status: <span className="font-medium">{formatStatusLabel(ticket.status)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`flex items-center gap-1 px-3 py-1 ${getStatusColor(ticket.status)}`}
                >
                  {getStatusIcon(ticket.status)}
                  <span>{formatStatusLabel(ticket.status)}</span>
                </Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Update Status</p>
                <Select 
                  value={status} 
                  onValueChange={(value) => setStatus(value as TicketStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TicketStatus.OPEN}>Open</SelectItem>
                    <SelectItem value={TicketStatus.IN_PROGRESS}>In Progress</SelectItem>
                    <SelectItem value={TicketStatus.RESOLVED}>Resolved</SelectItem>
                    <SelectItem value={TicketStatus.CLOSED}>Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4" style={{ 
            borderTopColor: 
              ticket.priority === TicketPriority.CRITICAL ? 'rgb(239, 68, 68)' :
              ticket.priority === TicketPriority.HIGH ? 'rgb(249, 115, 22)' :
              ticket.priority === TicketPriority.MEDIUM ? 'rgb(234, 179, 8)' :
              'rgb(59, 130, 246)'
          }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-muted-foreground" />
                Priority
              </CardTitle>
              <CardDescription>
                Current priority: <span className="font-medium">{formatPriorityLabel(ticket.priority)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="outline" className={`${getPriorityColor(ticket.priority)} px-3 py-1`}>
                {formatPriorityLabel(ticket.priority)}
              </Badge>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Update Priority</p>
                <Select 
                  value={priority} 
                  onValueChange={(value) => setPriority(value as TicketPriority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TicketPriority.LOW}>Low</SelectItem>
                    <SelectItem value={TicketPriority.MEDIUM}>Medium</SelectItem>
                    <SelectItem value={TicketPriority.HIGH}>High</SelectItem>
                    <SelectItem value={TicketPriority.CRITICAL}>Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                Comment
              </CardTitle>
              <CardDescription>
                {(status !== ticket.status || priority !== ticket.priority) 
                  ? "Please provide a comment explaining the changes you're making." 
                  : "Add a comment to the ticket history (optional)."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <Textarea
                placeholder="Enter your comment here..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </CardContent>
            <CardFooter className="pt-2">
              <Button 
                className="w-full" 
                onClick={updateTicket} 
                disabled={isUpdating || (status === ticket.status && priority === ticket.priority && !comment.trim())}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Ticket"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}