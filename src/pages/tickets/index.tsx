import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import ProtectedRoute from "@/components/ProtectedRoute";
import { 
  PlusCircle, 
  AlertCircle, 
  BarChart2,
  LayoutGrid as Kanban,
  Search, 
  ArrowUpDown,
  Calendar,
  Tag,
  LayoutList,
  LayoutGrid
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/use-toast";
import TicketBarcodeScanner from "@/components/TicketBarcodeScanner";
import { Input } from "@/components/ui/input";
import PrintTicketsReportButton from "@/components/PrintTicketsReportButton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import TicketCardView from "@/components/TicketCardView";
import TicketListView from "@/components/TicketListView";
import { filterTickets, sortTickets } from "@/util/ticketUtils";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { fetchWithCache } from '@/lib/api-cache';

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

export default function TicketsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TicketsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function TicketsContent() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "priority">("newest");
  const [viewMode, setViewMode] = useState<"card" | "list">("list");

  // Memoized fetch function to prevent unnecessary re-renders
  const fetchTickets = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log("Fetching tickets...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch("/api/tickets", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log("Tickets API response status:", response.status);
      
      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = `Failed to fetch tickets. Status: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error("Error response data:", errorData);
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
        const text = await response.text();
        console.log("Raw response:", text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        
        // Only try to parse if we have content
        if (text.trim()) {
          try {
            data = JSON.parse(text);
          } catch (jsonError) {
            console.error("JSON parse error:", jsonError);
            throw new Error("Invalid JSON response from server");
          }
        } else {
          console.log("Empty response from tickets API");
          data = [];
        }
      } catch (parseError) {
        console.error("Error parsing tickets data:", parseError);
        throw new Error("Invalid response format from server");
      }
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error("Unexpected response format:", data);
        // If we got an object with an error message, display it
        if (data && typeof data === 'object' && 'error' in data) {
          throw new Error(data.error as string);
        }
        // Otherwise use a generic error
        throw new Error("Received invalid data format from server");
      }
      
      console.log("Tickets data received:", data.length, "items");
      
      // Validate and normalize each ticket
      const validatedTickets = data.map(ticket => {
        // Ensure required fields exist with fallbacks
        return {
          id: ticket.id || "",
          displayId: ticket.displayId || null,
          title: ticket.title || "Untitled Ticket",
          description: ticket.description || "",
          status: Object.values(TicketStatus).includes(ticket.status) 
            ? ticket.status 
            : TicketStatus.OPEN,
          priority: Object.values(TicketPriority).includes(ticket.priority)
            ? ticket.priority
            : TicketPriority.MEDIUM,
          assetId: ticket.assetId || null,
          asset: ticket.asset || null,
          createdAt: ticket.createdAt || new Date().toISOString(),
          updatedAt: ticket.updatedAt || new Date().toISOString()
        };
      });
      
      console.log("Tickets processed successfully:", validatedTickets.length);
      setTickets(validatedTickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "Could not connect to the server. Please check your connection and try again.",
        variant: "destructive",
      });
      // Set empty array to prevent undefined errors
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch tickets on component mount, when user changes, and when tab changes
  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user, fetchTickets, activeTab]);
  
  // Set up a refresh interval to periodically check for ticket updates
  useEffect(() => {
    if (!user) return;
    
    // Refresh tickets every 30 seconds to catch status changes made by other users
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing tickets...");
      fetchTickets();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [user, fetchTickets]);

  // Apply filters and sorting
  const filteredTickets = filterTickets(tickets, activeTab, searchQuery);
  const sortedTickets = sortTickets(filteredTickets, sortOrder);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tickets')}</h1>
          <p className="text-muted-foreground">
            {t('create_and_manage_support_tickets')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline"
            asChild
          >
            <Link href="/tickets/dashboard">
              <BarChart2 className="mr-2 h-4 w-4" />
              {t('dashboard')}
            </Link>
          </Button>
          <Button 
            variant="outline"
            asChild
          >
            <Link href="/tickets/kanban">
              <Kanban className="mr-2 h-4 w-4" />
              {t('kanban_board') || 'Kanban Board'}
            </Link>
          </Button>
          <TicketBarcodeScanner />
          <PrintTicketsReportButton variant="outline" />
          <Button 
            onClick={() => {
              console.log("Opening create ticket dialog");
              setCreateDialogOpen(true);
            }}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('create_ticket')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('search_tickets_placeholder')}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">{t('sort_by')}</span>
              <span className="inline sm:hidden">{t('sort')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('sort_by')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setSortOrder("newest")}
              className={sortOrder === "newest" ? "bg-accent" : ""}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {t('newest_first')}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setSortOrder("oldest")}
              className={sortOrder === "oldest" ? "bg-accent" : ""}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {t('oldest_first')}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setSortOrder("priority")}
              className={sortOrder === "priority" ? "bg-accent" : ""}
            >
              <Tag className="mr-2 h-4 w-4" />
              {t('priority_highest_first')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "card" ? "default" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode("card")}
            aria-label="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full md:w-auto grid grid-cols-4 md:inline-flex">
          <TabsTrigger value="all" className="text-sm">{t('all_tickets')}</TabsTrigger>
          <TabsTrigger value="open" className="text-sm">{t('open')}</TabsTrigger>
          <TabsTrigger value="in-progress" className="text-sm">{t('in_progress')}</TabsTrigger>
          <TabsTrigger value="resolved" className="text-sm">{t('resolved')}</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-6">
          {viewMode === "card" ? (
            <TicketCardView tickets={sortedTickets} isLoading={isLoading} />
          ) : (
            <TicketListView tickets={sortedTickets} isLoading={isLoading} />
          )}
        </TabsContent>
      </Tabs>

      {/* Ensure the dialog is always rendered with proper error handling */}
      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          console.log("Dialog open state changed:", open);
          try {
            setCreateDialogOpen(open);
          } catch (error) {
            console.error("Error updating dialog state:", error);
            // Force reset the state if there's an error
            setTimeout(() => setCreateDialogOpen(false), 100);
          }
        }}
        onTicketCreated={() => {
          console.log("Ticket created, refreshing tickets list");
          try {
            fetchTickets();
          } catch (error) {
            console.error("Error refreshing tickets after creation:", error);
            toast({
              title: "Refresh Error",
              description: "Your ticket was created but we couldn't refresh the list. Please reload the page.",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}