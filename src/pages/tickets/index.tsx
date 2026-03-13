import { useState, useEffect, useCallback } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";

const TICKETS_KEY = "/api/tickets";
const TICKETS_TTL = 60_000; // 1 min
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
  LayoutGrid,
  UserPlus,
  CheckCircle,
  Loader2
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Ticket {
  id: string;
  displayId: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assetId: string | null;
  source?: string | null;
  assignedToId?: string | null;
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
  // Initialize from module-level cache — instant display when navigating back
  const [tickets, setTickets] = useState<Ticket[]>(() => getFromCache<Ticket[]>(TICKETS_KEY, TICKETS_TTL) ?? []);
  const [isLoading, setIsLoading] = useState(() => !getFromCache(TICKETS_KEY, TICKETS_TTL));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "priority">("newest");
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [staffMembers, setStaffMembers] = useState<{ id: string; email: string }[]>([]);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const normalizeTickets = (data: any[]): Ticket[] =>
    data.map(ticket => ({
      id: ticket.id || "",
      displayId: ticket.displayId || null,
      title: ticket.title || "Untitled Ticket",
      description: ticket.description || "",
      status: Object.values(TicketStatus).includes(ticket.status) ? ticket.status : TicketStatus.OPEN,
      priority: Object.values(TicketPriority).includes(ticket.priority) ? ticket.priority : TicketPriority.MEDIUM,
      assetId: ticket.assetId || null,
      source: ticket.source ?? null,
      assignedToId: ticket.assignedToId ?? null,
      asset: ticket.asset || null,
      createdAt: ticket.createdAt || new Date().toISOString(),
      updatedAt: ticket.updatedAt || new Date().toISOString(),
    }));

  const fetchTickets = useCallback(async (background = false) => {
    if (!user) return;
    if (!background) setIsLoading(true);
    try {
      const data = await fetchWithCache<any[]>(TICKETS_KEY, { maxAge: TICKETS_TTL });
      if (Array.isArray(data)) setTickets(normalizeTickets(data));
    } catch (error) {
      if (!background) {
        toast({ title: "Error", description: "Could not load tickets. Please try again.", variant: "destructive" });
        setTickets([]);
      }
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [user]);

  // Fetch on mount — if cache is warm, show instantly and revalidate in background
  useEffect(() => {
    if (!user) return;
    const cached = getFromCache<any[]>(TICKETS_KEY, TICKETS_TTL);
    if (cached) {
      setTickets(normalizeTickets(cached));
      setIsLoading(false);
      // Revalidate silently after a short delay
      setTimeout(() => fetchTickets(true), 300);
    } else {
      fetchTickets(false);
    }
  }, [user]);
  
  // Set up a refresh interval to periodically check for ticket updates
  useEffect(() => {
    if (!user) return;
    
    // Refresh every 2 minutes — tickets don't change that rapidly
    const intervalId = setInterval(() => fetchTickets(), 120_000);
    
    return () => clearInterval(intervalId);
  }, [user, fetchTickets]);

  // Fetch staff for Portal tab assign dropdown
  useEffect(() => {
    if (activeTab !== "portal" || !user) return;
    let cancelled = false;
    fetch("/api/planner/users", { headers: { "Cache-Control": "no-cache" } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const list = (data?.users ?? Array.isArray(data) ? data : []).map((u: any) => ({ id: u.id || "", email: u.email || "" })).filter((u: { id: string }) => u.id);
        setStaffMembers(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeTab, user]);

  const portalTickets = tickets.filter((t) => t.source === "PORTAL");
  const handleAssign = async (ticketId: string, assignedToId: string | null) => {
    setUpdatingTicketId(ticketId);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assignedToId || null }),
      });
      if (!res.ok) throw new Error("Failed to assign");
      toast({ title: "Assigned", description: "Ticket has been assigned." });
      fetchTickets();
    } catch {
      toast({ variant: "destructive", title: "Could not assign ticket" });
    } finally {
      setUpdatingTicketId(null);
    }
  };
  const handleApprove = async (ticketId: string) => {
    setUpdatingTicketId(ticketId);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: TicketStatus.IN_PROGRESS }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast({ title: "Approved", description: "Ticket is now in progress." });
      fetchTickets();
    } catch {
      toast({ variant: "destructive", title: "Could not approve ticket" });
    } finally {
      setUpdatingTicketId(null);
    }
  };

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
        <TabsList className="w-full md:w-auto grid grid-cols-5 md:inline-flex">
          <TabsTrigger value="all" className="text-sm">{t('all_tickets')}</TabsTrigger>
          <TabsTrigger value="open" className="text-sm">{t('open')}</TabsTrigger>
          <TabsTrigger value="in-progress" className="text-sm">{t('in_progress')}</TabsTrigger>
          <TabsTrigger value="resolved" className="text-sm">{t('resolved')}</TabsTrigger>
          <TabsTrigger value="portal" className="text-sm">Portal tickets</TabsTrigger>
        </TabsList>
        <TabsContent value="portal" className="mt-6">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b bg-muted/50 px-4 py-3">
              <h3 className="font-semibold text-foreground">Raised by users (Support Portal)</h3>
              <p className="text-sm text-muted-foreground">Approve and assign portal tickets to staff.</p>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : portalTickets.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No portal tickets yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-medium p-3">ID</th>
                      <th className="text-left font-medium p-3">Title</th>
                      <th className="text-left font-medium p-3">Status</th>
                      <th className="text-left font-medium p-3">Priority</th>
                      <th className="text-left font-medium p-3">Assign to</th>
                      <th className="text-left font-medium p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portalTickets.map((t) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 font-mono text-muted-foreground">{t.displayId || t.id.slice(0, 8)}</td>
                        <td className="p-3">
                          <Link href={`/tickets/${t.id}`} className="font-medium text-primary hover:underline">
                            {t.title}
                          </Link>
                        </td>
                        <td className="p-3">{t.status}</td>
                        <td className="p-3">{t.priority}</td>
                        <td className="p-3">
                          <Select
                            value={t.assignedToId || "unassigned"}
                            onValueChange={(v) => handleAssign(t.id, v === "unassigned" ? null : v)}
                            disabled={updatingTicketId === t.id}
                          >
                            <SelectTrigger className="w-[180px] h-9">
                              <SelectValue placeholder="Assign…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {staffMembers.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.email}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          {t.status === TicketStatus.OPEN && (
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              disabled={updatingTicketId === t.id}
                              onClick={() => handleApprove(t.id)}
                            >
                              {updatingTicketId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                              Approve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="all" className="mt-6">
          {viewMode === "card" ? (
            <TicketCardView tickets={sortedTickets} isLoading={isLoading} />
          ) : (
            <TicketListView tickets={sortedTickets} isLoading={isLoading} />
          )}
        </TabsContent>
        <TabsContent value="open" className="mt-6">
          {viewMode === "card" ? (
            <TicketCardView tickets={sortedTickets} isLoading={isLoading} />
          ) : (
            <TicketListView tickets={sortedTickets} isLoading={isLoading} />
          )}
        </TabsContent>
        <TabsContent value="in-progress" className="mt-6">
          {viewMode === "card" ? (
            <TicketCardView tickets={sortedTickets} isLoading={isLoading} />
          ) : (
            <TicketListView tickets={sortedTickets} isLoading={isLoading} />
          )}
        </TabsContent>
        <TabsContent value="resolved" className="mt-6">
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