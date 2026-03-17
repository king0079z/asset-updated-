import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  PlusCircle,
  BarChart2,
  PieChart as PieChartIcon,
  Activity,
  Calendar,
  Tag,
  Link as LinkIcon,
  LayoutGrid
} from "lucide-react";
import Link from "next/link";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";

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

interface TicketStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  criticalTickets: number;
  highPriorityTickets: number;
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  recentTickets: {
    id: string;
    displayId: string | null;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
    createdAt: string;
    updatedAt: string;
    asset: {
      id: string;
      name: string;
      assetId: string;
    } | null;
  }[];
  ticketsOverTime: { date: string; count: number }[];
  ticketsWithAssets: number;
  ticketsWithoutAssets: number;
}

// Safely format date with fallback
const safeFormatDate = (dateString: string | null | undefined): string => {
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
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Date format error";
  }
};

export default function TicketDashboard() {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchTicketStats();
  }, []);

  const fetchTicketStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/tickets/stats");
      if (!response.ok) {
        throw new Error(`Failed to fetch ticket stats: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching ticket stats:", error);
      toast({
        title: "Error",
        description: "Failed to load ticket statistics. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  const formatStatusLabel = (status: string): string => {
    return status.replace("_", " ");
  };

  const formatPriorityLabel = (priority: string): string => {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  };

  // Colors for charts
  const STATUS_COLORS = {
    OPEN: "#ef4444",
    IN_PROGRESS: "#eab308",
    RESOLVED: "#22c55e",
    CLOSED: "#6b7280"
  };

  const PRIORITY_COLORS = {
    LOW: "#3b82f6",
    MEDIUM: "#eab308",
    HIGH: "#f97316",
    CRITICAL: "#ef4444"
  };

  // Prepare data for pie charts
  const prepareStatusData = () => {
    if (!stats?.ticketsByStatus) return [];
    return stats.ticketsByStatus.map(item => ({
      name: formatStatusLabel(item.status),
      value: item.count,
      status: item.status
    }));
  };

  const preparePriorityData = () => {
    if (!stats?.ticketsByPriority) return [];
    return stats.ticketsByPriority.map(item => ({
      name: formatPriorityLabel(item.priority),
      value: item.count,
      priority: item.priority
    }));
  };

  // Prepare data for time series chart
  const prepareTimeSeriesData = () => {
    if (!stats?.ticketsOverTime) return [];
    return stats.ticketsOverTime.map(item => ({
      date: item.date,
      tickets: item.count
    }));
  };

  // Prepare data for asset association chart
  const prepareAssetData = () => {
    if (!stats) return [];
    return [
      { name: "With Assets", value: stats.ticketsWithAssets },
      { name: "Without Assets", value: stats.ticketsWithoutAssets }
    ];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ticket Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive overview of your support tickets
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline"
            asChild
          >
            <Link href="/tickets/kanban">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Kanban Board
            </Link>
          </Button>
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Ticket
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full md:w-auto grid grid-cols-3 md:inline-flex">
          <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
          <TabsTrigger value="charts" className="text-sm">Charts & Analytics</TabsTrigger>
          <TabsTrigger value="recent" className="text-sm">Recent Tickets</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Tickets */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.totalTickets || 0}</div>
                )}
              </CardContent>
            </Card>

            {/* Open Tickets */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.openTickets || 0}</div>
                )}
              </CardContent>
            </Card>

            {/* In Progress Tickets */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.inProgressTickets || 0}</div>
                )}
              </CardContent>
            </Card>

            {/* Critical Tickets */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical Priority</CardTitle>
                <Activity className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.criticalTickets || 0}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            {/* Status Distribution */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Ticket Status Distribution</CardTitle>
                <CardDescription>Current status of all tickets</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prepareStatusData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {prepareStatusData().map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || "#6b7280"} 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Ticket Priority Distribution</CardTitle>
                <CardDescription>Breakdown by priority level</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={preparePriorityData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {preparePriorityData().map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={PRIORITY_COLORS[entry.priority as keyof typeof PRIORITY_COLORS] || "#6b7280"} 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Tickets Over Time */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Tickets Created Over Time</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={prepareTimeSeriesData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="tickets" fill="#3b82f6" name="Tickets Created" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Asset Association */}
            <Card>
              <CardHeader>
                <CardTitle>Asset Association</CardTitle>
                <CardDescription>Tickets with and without linked assets</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prepareAssetData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#6b7280" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Status Summary</CardTitle>
                <CardDescription>Current ticket status counts</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={stats?.ticketsByStatus.map(item => ({
                        status: formatStatusLabel(item.status),
                        count: item.count,
                        statusKey: item.status
                      })) || []}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="status" type="category" />
                      <Tooltip />
                      <Bar 
                        dataKey="count" 
                        name="Tickets" 
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                      >
                        {(stats?.ticketsByStatus || []).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || "#6b7280"} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Recent Tickets Tab */}
        <TabsContent value="recent" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tickets</CardTitle>
              <CardDescription>Your 5 most recently created tickets</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex space-x-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentTickets && stats.recentTickets.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentTickets.map((ticket) => (
                    <div key={ticket.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="space-y-2 mb-3 md:mb-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{ticket.title}</h3>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border border-blue-200">
                            {ticket.displayId || `ID-${ticket.id.substring(0, 8)}`}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            <span>{safeFormatDate(ticket.createdAt)}</span>
                          </div>
                          {ticket.asset && (
                            <div className="flex items-center">
                              <span>•</span>
                              <LinkIcon className="h-3.5 w-3.5 mx-1" />
                              <span>{ticket.asset.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                          {formatPriorityLabel(ticket.priority)}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`flex items-center gap-1 ${getStatusColor(ticket.status)}`}
                        >
                          {getStatusIcon(ticket.status)}
                          <span>{formatStatusLabel(ticket.status)}</span>
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/tickets/${ticket.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="bg-muted/30 p-4 rounded-full mb-4">
                    <AlertCircle className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No tickets found</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    You haven't created any tickets yet.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create your first ticket
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTicketCreated={() => {
          fetchTicketStats();
        }}
      />
    </div>
  );
}