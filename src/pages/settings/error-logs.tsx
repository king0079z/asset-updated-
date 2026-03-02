import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AlertTriangle, CheckCircle, Clock, Info, RefreshCw, Search, XCircle } from "lucide-react";

type ErrorLog = {
  id: string;
  message: string;
  stack?: string;
  context?: any;
  url?: string;
  userAgent?: string;
  userId?: string;
  userEmail?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'IGNORED';
  solution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  occurrences: number;
  lastOccurredAt: string;
  createdAt: string;
};

type PaginationInfo = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export default function ErrorLogsPage() {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [solution, setSolution] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("NEW");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pageSize: 10,
    pageCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const loadErrorLogs = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      
      if (statusFilter && statusFilter !== "ALL") {
        queryParams.append('status', statusFilter);
      }
      
      if (severityFilter && severityFilter !== "ALL") {
        queryParams.append('severity', severityFilter);
      }
      
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.pageSize.toString());
      
      const response = await fetch(`/api/admin/error-logs?${queryParams.toString()}`, {
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "You need to be logged in to view error logs",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 403) {
          const errorData = await response.json();
          toast({
            title: "Access Denied",
            description: errorData.error || "You don't have permission to view error logs",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Failed to fetch error logs');
      }
      
      const data = await response.json();
      setErrorLogs(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error loading error logs:', error);
      toast({
        title: "Error",
        description: "Failed to load error logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadErrorLogs();
  }, [statusFilter, severityFilter, pagination.page]);

  const handleViewDetails = (error: ErrorLog) => {
    setSelectedError(error);
    setSolution(error.solution || "");
    setIsDialogOpen(true);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/error-logs?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "You need to be logged in to update error logs",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 403) {
          const errorData = await response.json();
          toast({
            title: "Access Denied",
            description: errorData.error || "You don't have permission to update error logs",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Failed to update error status');
      }
      
      toast({
        title: "Success",
        description: "Error status updated successfully",
      });
      
      loadErrorLogs();
    } catch (error) {
      console.error('Error updating error status:', error);
      toast({
        title: "Error",
        description: "Failed to update error status",
        variant: "destructive",
      });
    }
  };

  const handleSaveSolution = async () => {
    if (!selectedError) return;
    
    try {
      const response = await fetch(`/api/admin/error-logs?id=${selectedError.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solution,
          status: 'RESOLVED',
        }),
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "You need to be logged in to update error logs",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 403) {
          const errorData = await response.json();
          toast({
            title: "Access Denied",
            description: errorData.error || "You don't have permission to update error logs",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Failed to save solution');
      }
      
      toast({
        title: "Success",
        description: "Solution saved successfully",
      });
      
      setIsDialogOpen(false);
      loadErrorLogs();
    } catch (error) {
      console.error('Error saving solution:', error);
      toast({
        title: "Error",
        description: "Failed to save solution",
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeError = async () => {
    if (!selectedError) return;
    
    try {
      setIsAnalyzing(true);
      
      const response = await fetch('/api/admin/error-logs/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorId: selectedError.id,
        }),
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "You need to be logged in to analyze error logs",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 403) {
          const errorData = await response.json();
          toast({
            title: "Access Denied",
            description: errorData.error || "You don't have permission to analyze error logs",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Failed to analyze error');
      }
      
      const data = await response.json();
      setSolution(data.solution);
      
      toast({
        title: "Analysis Complete",
        description: "AI has suggested a possible solution",
      });
    } catch (error) {
      console.error('Error analyzing error:', error);
      toast({
        title: "Error",
        description: "Failed to analyze error",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">Low</Badge>;
      case 'MEDIUM':
        return <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">Medium</Badge>;
      case 'HIGH':
        return <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">High</Badge>;
      case 'CRITICAL':
        return <Badge variant="outline" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Badge className="bg-blue-500">New</Badge>;
      case 'INVESTIGATING':
        return <Badge className="bg-yellow-500">Investigating</Badge>;
      case 'RESOLVED':
        return <Badge className="bg-green-500">Resolved</Badge>;
      case 'IGNORED':
        return <Badge className="bg-gray-500">Ignored</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'INVESTIGATING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'RESOLVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'IGNORED':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const truncateMessage = (message: string, maxLength: number = 100) => {
    return message.length > maxLength
      ? `${message.substring(0, maxLength)}...`
      : message;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Error Logs</h1>
          <Button onClick={loadErrorLogs} variant="outline" className="flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Application Errors</CardTitle>
                <CardDescription>Monitor and manage application errors</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select 
                  value={statusFilter || "ALL"} 
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="IGNORED">Ignored</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={severityFilter || "ALL"} 
                  onValueChange={setSeverityFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Severities</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
              </div>
            ) : errorLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                <p>No error logs found with the current filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Error</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Occurrences</TableHead>
                    <TableHead>Last Occurred</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorLogs.map((error) => (
                    <TableRow key={error.id}>
                      <TableCell className="font-medium">
                        {truncateMessage(error.message)}
                      </TableCell>
                      <TableCell>{getSeverityBadge(error.severity)}</TableCell>
                      <TableCell>{getStatusBadge(error.status)}</TableCell>
                      <TableCell>{error.userEmail || 'Unknown'}</TableCell>
                      <TableCell>{error.occurrences}</TableCell>
                      <TableCell>{formatDate(error.lastOccurredAt)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(error)}
                          >
                            <Search className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {pagination.pageCount > 1 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: pagination.pageCount }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and pages around current page
                        return page === 1 || 
                               page === pagination.pageCount || 
                               Math.abs(page - pagination.page) <= 1;
                      })
                      .map((page, index, array) => {
                        // Add ellipsis between non-consecutive pages
                        if (index > 0 && page - array[index - 1] > 1) {
                          return (
                            <PaginationItem key={`ellipsis-${page}`}>
                              <span className="px-4">...</span>
                            </PaginationItem>
                          );
                        }
                        
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink 
                              isActive={page === pagination.page}
                              onClick={() => setPagination(prev => ({ ...prev, page }))}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pageCount, prev.page + 1) }))}
                        className={pagination.page >= pagination.pageCount ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedError && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Error Details</DialogTitle>
                <DialogDescription>
                  Detailed information about the error
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {getStatusIcon(selectedError.status)}
                    Error Message
                  </h3>
                  <p className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    {selectedError.message}
                  </p>
                </div>
                
                {selectedError.stack && (
                  <div>
                    <h3 className="text-lg font-semibold">Stack Trace</h3>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                      {selectedError.stack}
                    </pre>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Metadata</h3>
                    <div className="mt-1 space-y-2">
                      <p><span className="font-medium">Severity:</span> {selectedError.severity}</p>
                      <p><span className="font-medium">Status:</span> {selectedError.status}</p>
                      <p><span className="font-medium">Occurrences:</span> {selectedError.occurrences}</p>
                      <p><span className="font-medium">First Occurred:</span> {formatDate(selectedError.createdAt)}</p>
                      <p><span className="font-medium">Last Occurred:</span> {formatDate(selectedError.lastOccurredAt)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold">User Information</h3>
                    <div className="mt-1 space-y-2">
                      <p><span className="font-medium">User:</span> {selectedError.userEmail || 'Unknown'}</p>
                      <p><span className="font-medium">URL:</span> {selectedError.url || 'Unknown'}</p>
                      <p><span className="font-medium">User Agent:</span> {selectedError.userAgent || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
                
                {selectedError.context && (
                  <div>
                    <h3 className="text-lg font-semibold">Context</h3>
                    
                    <Tabs defaultValue="overview" className="mt-2">
                      <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="component">Component Info</TabsTrigger>
                        <TabsTrigger value="device">Device Info</TabsTrigger>
                        <TabsTrigger value="user">User Actions</TabsTrigger>
                        <TabsTrigger value="sensors">Sensor Data</TabsTrigger>
                        <TabsTrigger value="performance">Performance</TabsTrigger>
                        <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="overview" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-medium">Component Information</h4>
                            <p><span className="font-medium">Component:</span> {selectedError.context.componentName || 'Unknown'}</p>
                            <p><span className="font-medium">Function:</span> {selectedError.context.functionName || 'Unknown'}</p>
                            {selectedError.context.userAction && (
                              <p><span className="font-medium">Last User Action:</span> {selectedError.context.userAction}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-medium">Error Source</h4>
                            {selectedError.context.additionalInfo?.consoleError && <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">Console Error</Badge>}
                            {selectedError.context.additionalInfo?.unhandledRejection && <Badge variant="outline" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">Unhandled Promise Rejection</Badge>}
                            {selectedError.context.additionalInfo?.uncaughtException && <Badge variant="outline" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">Uncaught Exception</Badge>}
                            {selectedError.context.additionalInfo?.errorType && <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">{selectedError.context.additionalInfo.errorType}</Badge>}
                            {selectedError.context.additionalInfo?.errorSource && <p className="mt-1"><span className="font-medium">Source:</span> {selectedError.context.additionalInfo.errorSource}</p>}
                            {selectedError.context.additionalInfo?.fileName && <p className="mt-1"><span className="font-medium">File:</span> {selectedError.context.additionalInfo.fileName}</p>}
                            {selectedError.context.additionalInfo?.lineNumber && <p className="mt-1"><span className="font-medium">Line:</span> {selectedError.context.additionalInfo.lineNumber}</p>}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="component">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium">Component Details</h4>
                            <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                              <p><span className="font-medium">Component Name:</span> {selectedError.context.componentName || 'Unknown'}</p>
                              <p><span className="font-medium">Function Name:</span> {selectedError.context.functionName || 'Unknown'}</p>
                              {selectedError.context.params && (
                                <div className="mt-2">
                                  <p className="font-medium">Function Parameters:</p>
                                  <pre className="mt-1 p-2 bg-gray-200 dark:bg-gray-700 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(selectedError.context.params, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {selectedError.context.appState && (
                            <div>
                              <h4 className="font-medium">Application State</h4>
                              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                                {JSON.stringify(selectedError.context.appState, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="device">
                        {selectedError.context.deviceInfo ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium">Device Information</h4>
                                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                  <p><span className="font-medium">Platform:</span> {selectedError.context.deviceInfo.platform || 'Unknown'}</p>
                                  <p><span className="font-medium">Screen Size:</span> {selectedError.context.deviceInfo.screenSize || 'Unknown'}</p>
                                  <p><span className="font-medium">Orientation:</span> {selectedError.context.deviceInfo.orientation || 'Unknown'}</p>
                                  <p><span className="font-medium">Memory:</span> {selectedError.context.deviceInfo.memoryInfo || 'Unknown'}</p>
                                  <p><span className="font-medium">Connection:</span> {selectedError.context.deviceInfo.connectionType || 'Unknown'}</p>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="font-medium">Browser Information</h4>
                                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                  <p className="break-words text-xs">{selectedError.context.deviceInfo.browser || selectedError.userAgent || 'Unknown'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            <p>No detailed device information available</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="user">
                        <div className="space-y-4">
                          {selectedError.context.userAction && (
                            <div>
                              <h4 className="font-medium">Last User Action</h4>
                              <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                <p>{selectedError.context.userAction}</p>
                              </div>
                            </div>
                          )}
                          
                          {selectedError.context.additionalInfo?.recentUserActions && selectedError.context.additionalInfo.recentUserActions.length > 0 && (
                            <div>
                              <h4 className="font-medium">Recent User Actions</h4>
                              <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                <ol className="list-decimal pl-5 space-y-1">
                                  {selectedError.context.additionalInfo.recentUserActions.map((action: string, index: number) => (
                                    <li key={index}>{action || 'Unknown Action'}</li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          )}
                          
                          {selectedError.context.additionalInfo?.recentUrls && selectedError.context.additionalInfo.recentUrls.length > 0 && (
                            <div>
                              <h4 className="font-medium">Recent Navigation</h4>
                              <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                <ol className="list-decimal pl-5 space-y-1">
                                  {selectedError.context.additionalInfo.recentUrls.map((url: string, index: number) => (
                                    <li key={index} className="break-all text-xs">{url || 'Unknown URL'}</li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="sensors">
                        {selectedError.context.sensorData ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium">Sensor Availability</h4>
                              <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                <p>
                                  <span className="font-medium">Accelerometer:</span> 
                                  {selectedError.context.sensorData.accelerometer ? 
                                    <Badge className="ml-2 bg-green-500">Available</Badge> : 
                                    <Badge className="ml-2 bg-red-500">Not Available</Badge>}
                                </p>
                                <p>
                                  <span className="font-medium">Gyroscope:</span> 
                                  {selectedError.context.sensorData.gyroscope ? 
                                    <Badge className="ml-2 bg-green-500">Available</Badge> : 
                                    <Badge className="ml-2 bg-red-500">Not Available</Badge>}
                                </p>
                                <p>
                                  <span className="font-medium">Magnetometer:</span> 
                                  {selectedError.context.sensorData.magnetometer ? 
                                    <Badge className="ml-2 bg-green-500">Available</Badge> : 
                                    <Badge className="ml-2 bg-red-500">Not Available</Badge>}
                                </p>
                              </div>
                            </div>
                            
                            {selectedError.context.sensorData.lastReadings && (
                              <div>
                                <h4 className="font-medium">Last Sensor Readings</h4>
                                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                                  {JSON.stringify(selectedError.context.sensorData.lastReadings, null, 2)}
                                </pre>
                              </div>
                            )}
                            
                            {selectedError.context.sensorData.deviceOrientation && (
                              <div>
                                <h4 className="font-medium">Device Orientation</h4>
                                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                  <p><span className="font-medium">Type:</span> {selectedError.context.sensorData.deviceOrientation.type || 'Unknown'}</p>
                                  <p><span className="font-medium">Angle:</span> {selectedError.context.sensorData.deviceOrientation.angle || 'Unknown'}</p>
                                </div>
                              </div>
                            )}
                            
                            {selectedError.context.sensorData.batteryInfo && (
                              <div>
                                <h4 className="font-medium">Battery Information</h4>
                                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                  <p><span className="font-medium">Level:</span> {(selectedError.context.sensorData.batteryInfo.level * 100).toFixed(0)}%</p>
                                  <p><span className="font-medium">Charging:</span> {selectedError.context.sensorData.batteryInfo.charging ? 'Yes' : 'No'}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            <p>No sensor data available</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="performance">
                        {selectedError.context.performanceMetrics ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium">Memory Usage</h4>
                                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                  {selectedError.context.performanceMetrics.memoryUsage !== undefined ? (
                                    <div className="space-y-2">
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                        <div 
                                          className="bg-blue-600 h-2.5 rounded-full" 
                                          style={{ width: `${(selectedError.context.performanceMetrics.memoryUsage * 100).toFixed(0)}%` }}
                                        ></div>
                                      </div>
                                      <p className="text-sm">{(selectedError.context.performanceMetrics.memoryUsage * 100).toFixed(0)}% used</p>
                                      
                                      {selectedError.context.performanceMetrics.memoryDetails && (
                                        <div className="text-xs space-y-1 mt-2">
                                          <p><span className="font-medium">Total Heap:</span> {Math.round(selectedError.context.performanceMetrics.memoryDetails.totalJSHeapSize / (1024 * 1024))} MB</p>
                                          <p><span className="font-medium">Used Heap:</span> {Math.round(selectedError.context.performanceMetrics.memoryDetails.usedJSHeapSize / (1024 * 1024))} MB</p>
                                          <p><span className="font-medium">Heap Limit:</span> {Math.round(selectedError.context.performanceMetrics.memoryDetails.jsHeapSizeLimit / (1024 * 1024))} MB</p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p>Memory usage data not available</p>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="font-medium">Page Performance</h4>
                                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                  {selectedError.context.performanceMetrics.loadTime !== undefined && (
                                    <p><span className="font-medium">Load Time:</span> {(selectedError.context.performanceMetrics.loadTime / 1000).toFixed(2)} seconds</p>
                                  )}
                                  {selectedError.context.performanceMetrics.networkLatency !== undefined && (
                                    <p><span className="font-medium">Network Latency:</span> {selectedError.context.performanceMetrics.networkLatency.toFixed(0)} ms</p>
                                  )}
                                  {selectedError.context.performanceMetrics.cpuUsage !== undefined && (
                                    <p><span className="font-medium">CPU Usage:</span> {(selectedError.context.performanceMetrics.cpuUsage * 100).toFixed(0)}%</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            <p>No performance metrics available</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="raw">
                        <pre className="p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                          {JSON.stringify(selectedError.context, null, 2)}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
                
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Solution</h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAnalyzeError}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>AI Analyze</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    className="mt-1"
                    placeholder="Enter a solution or click 'AI Analyze' for suggestions"
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className="flex justify-between">
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedError.id, 'INVESTIGATING')}
                      disabled={selectedError.status === 'INVESTIGATING'}
                    >
                      Mark as Investigating
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedError.id, 'IGNORED')}
                      disabled={selectedError.status === 'IGNORED'}
                    >
                      Ignore
                    </Button>
                  </div>
                  <Button onClick={handleSaveSolution}>
                    Save Solution & Resolve
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}