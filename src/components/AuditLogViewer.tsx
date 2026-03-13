// @ts-nocheck
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuditLogs, verifyAuditLog } from "@/lib/audit";
import { AuditLogType, AuditLogSeverity } from "@prisma/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { ActionDetailsDisplay } from "@/components/ActionDetailsDisplay";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Download, 
  Eye, 
  Filter, 
  Info, 
  Search, 
  Shield, 
  ShieldAlert, 
  User, 
  FileText,
  Calendar,
  RefreshCw,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: any;
  changes: any;
  status: string | null;
  type: AuditLogType;
  severity: AuditLogSeverity;
  relatedLogId: string | null;
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  retentionDate: string | null;
  metadata: any;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface AuditLogViewerProps {
  defaultResourceType?: string;
  defaultResourceId?: string;
  showFilters?: boolean;
  showPagination?: boolean;
  limit?: number;
  className?: string;
  title?: string;
  description?: string;
}

export function AuditLogViewer({
  defaultResourceType,
  defaultResourceId,
  showFilters = true,
  showPagination = true,
  limit = 10,
  className = "",
  title = "Audit Logs",
  description = "View and manage system audit logs for compliance and security monitoring."
}: AuditLogViewerProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit,
    pages: 0
  });
  
  // Filters
  const [filters, setFilters] = useState<Record<string, any>>({
    resourceType: defaultResourceType || "",
    resourceId: defaultResourceId || "",
    type: "",
    severity: "",
    startDate: "",
    endDate: "",
    action: "",
    verified: undefined
  });
  
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Check if user is admin (simplified check - replace with your actual logic)
  const isAdmin = user?.email?.endsWith('@admin.com') || false;

  // Set up automatic refresh interval for audit logs
  useEffect(() => {
    fetchLogs();
    
    // Set up a reasonable interval to refresh logs (once per minute)
    const refreshInterval = setInterval(() => {
      console.log("Auto-refreshing audit logs...");
      fetchLogs();
    }, 60000); // Changed from 15000 (15 seconds) to 60000 (1 minute)
    
    // Clean up interval on component unmount
    return () => clearInterval(refreshInterval);
  }, [pagination.page, filters, activeTab]);
  
  // Handle initial setup when user tab is selected
  useEffect(() => {
    if (activeTab === "user") {
      // Reset to first page when switching to user activity tab
      setPagination(prev => ({ ...prev, page: 1 }));
      // Set type filter to USER_ACTIVITY for user activity tab
      setFilters(prev => ({ ...prev, type: "USER_ACTIVITY" }));
      // Immediate fetch with force refresh
      fetchLogs(true);
      
      // No additional interval for user activity tab - we'll use the main refresh interval
    }
  }, [activeTab]);

  const fetchLogs = async (forceRefresh: boolean = false) => {
    setLoading(true);
    
    // Prepare filters based on active tab and current filters
    const queryFilters: Record<string, any> = {
      ...filters,
      page: pagination.page,
      limit: pagination.limit
    };
    
    // Apply tab-specific filters
    if (activeTab === "security") {
      queryFilters.type = "SECURITY_EVENT";
    } else if (activeTab === "compliance") {
      queryFilters.type = "COMPLIANCE_EVENT";
    } else if (activeTab === "data") {
      queryFilters.type = "DATA_MODIFICATION";
    } else if (activeTab === "user") {
      queryFilters.type = "USER_ACTIVITY";
      // For user activity tab, always force refresh
      forceRefresh = true;
    }
    
    try {
      console.log(`Fetching logs with forceRefresh=${forceRefresh}`);
      const result = await getAuditLogs(queryFilters, forceRefresh);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
        setLogs([]);
      } else {
        setLogs(result.logs);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive"
      });
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLog = async (id: string, verified: boolean) => {
    if (!isAdmin) return;
    
    try {
      const result = await verifyAuditLog(id, verified);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
      } else {
        // Update the log in the current list
        setLogs(logs.map(log => 
          log.id === id ? { ...log, verified, verifiedAt: new Date().toISOString(), verifiedBy: user?.id } : log
        ));
        
        toast({
          title: "Success",
          description: `Log ${verified ? 'verified' : 'unverified'} successfully`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Error verifying log:", error);
      toast({
        title: "Error",
        description: "Failed to verify log",
        variant: "destructive"
      });
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setFilters({
      resourceType: defaultResourceType || "",
      resourceId: defaultResourceId || "",
      type: "",
      severity: "",
      startDate: "",
      endDate: "",
      action: "",
      verified: undefined
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const exportLogs = () => {
    // Create CSV content
    const headers = [
      "ID", "Timestamp", "User", "IP Address", 
      "Action", "Resource Type", "Resource ID", 
      "Type", "Severity", "Verified"
    ];
    
    const csvContent = [
      headers.join(","),
      ...logs.map(log => [
        formatId(log.id),
        new Date(log.timestamp).toISOString(),
        log.userEmail || "System",
        log.ipAddress || "N/A",
        log.action,
        log.resourceType,
        formatId(log.resourceId),
        log.type,
        log.severity,
        log.verified ? "Yes" : "No"
      ].join(","))
    ].join("\n");
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityBadge = (severity: AuditLogSeverity) => {
    switch (severity) {
      case "INFO":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Info</Badge>;
      case "WARNING":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Warning</Badge>;
      case "ERROR":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Error</Badge>;
      case "CRITICAL":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getTypeIcon = (type: AuditLogType) => {
    switch (type) {
      case "USER_ACTIVITY":
        return <User className="h-4 w-4 text-blue-500" />;
      case "DATA_ACCESS":
        return <Eye className="h-4 w-4 text-green-500" />;
      case "DATA_MODIFICATION":
        return <FileText className="h-4 w-4 text-purple-500" />;
      case "SECURITY_EVENT":
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case "SYSTEM_EVENT":
        return <Info className="h-4 w-4 text-gray-500" />;
      case "COMPLIANCE_EVENT":
        return <Shield className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), "PPpp");
    } catch (error) {
      return "Invalid date";
    }
  };
  
  // Format IDs to be more readable (first 8 characters)
  const formatId = (id: string | null): string => {
    if (!id) return "N/A";
    // If ID is a UUID, show first 8 characters
    if (id.length > 8 && id.includes("-")) {
      return id.split("-")[0];
    }
    // For other formats, show first 8 characters
    return id.substring(0, 8);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {showFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="flex-1 sm:flex-none min-h-9"
              >
                <Filter className="h-4 w-4 mr-2" />
                <span className="whitespace-nowrap">Filters</span>
              </Button>
            )}
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportLogs}
                className="flex-1 sm:flex-none min-h-9"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="whitespace-nowrap">Export</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchLogs}
              className="flex-1 sm:flex-none min-h-9 px-3"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {showFilters && showFilterPanel && (
          <div className="mt-4 p-4 border rounded-md bg-muted/20 overflow-x-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Resource Type</label>
                <Input 
                  placeholder="Resource Type" 
                  value={filters.resourceType} 
                  onChange={(e) => handleFilterChange("resourceType", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Resource ID</label>
                <Input 
                  placeholder="Resource ID" 
                  value={filters.resourceId} 
                  onChange={(e) => handleFilterChange("resourceId", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Action</label>
                <Input 
                  placeholder="Action" 
                  value={filters.action} 
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select 
                  value={filters.type} 
                  onValueChange={(value) => handleFilterChange("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_TYPES">All Types</SelectItem>
                    <SelectItem value="USER_ACTIVITY">User Activity</SelectItem>
                    <SelectItem value="DATA_ACCESS">Data Access</SelectItem>
                    <SelectItem value="DATA_MODIFICATION">Data Modification</SelectItem>
                    <SelectItem value="SECURITY_EVENT">Security Event</SelectItem>
                    <SelectItem value="SYSTEM_EVENT">System Event</SelectItem>
                    <SelectItem value="COMPLIANCE_EVENT">Compliance Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Severity</label>
                <Select 
                  value={filters.severity} 
                  onValueChange={(value) => handleFilterChange("severity", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_SEVERITIES">All Severities</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Start Date</label>
                <Input 
                  type="date" 
                  value={filters.startDate} 
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">End Date</label>
                <Input 
                  type="date" 
                  value={filters.endDate} 
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                />
              </div>
              {isAdmin && (
                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="verified" 
                      checked={filters.verified === true}
                      onCheckedChange={(checked) => {
                        if (checked === true) handleFilterChange("verified", true);
                        else if (checked === false) handleFilterChange("verified", false);
                        else handleFilterChange("verified", undefined);
                      }}
                    />
                    <label htmlFor="verified" className="text-sm font-medium">
                      Verified Only
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetFilters} className="w-full sm:w-auto">
                Reset
              </Button>
              <Button size="sm" onClick={fetchLogs} className="w-full sm:w-auto">
                Apply Filters
              </Button>
            </div>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full overflow-x-auto flex-nowrap">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
            <TabsTrigger value="compliance" className="flex-1">Compliance</TabsTrigger>
            <TabsTrigger value="data" className="flex-1">Data</TabsTrigger>
            <TabsTrigger value="user" className="flex-1">User</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-md">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Info className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No audit logs found</h3>
            <p className="text-muted-foreground mt-2">
              {filters.resourceType || filters.resourceId || filters.type || filters.severity || filters.action || filters.startDate || filters.endDate
                ? "Try adjusting your filters to see more results"
                : "There are no audit logs matching your criteria"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-4 border rounded-md hover:bg-muted/20 transition-colors cursor-pointer ${selectedLog?.id === log.id ? 'bg-muted/30 border-primary' : ''}`}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                title={`Log ID: ${log.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-muted/30">
                      {getTypeIcon(log.type)}
                    </div>
                    <div>
                      <ActionDetailsDisplay 
                        action={log.action}
                        resourceType={log.resourceType}
                        resourceId={log.resourceId}
                        details={log.details}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(log.severity)}
                    {log.verified && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    <span>{log.userEmail || 'System'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(log.timestamp)}</span>
                  </div>
                </div>
                
                {selectedLog?.id === log.id && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Log ID</h4>
                      <div className="bg-muted/30 p-3 rounded-md text-xs">
                        {log.id}
                      </div>
                    </div>
                    {log.details && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Details</h4>
                        <pre className="bg-muted/30 p-3 rounded-md text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {log.changes && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Changes</h4>
                        <pre className="bg-muted/30 p-3 rounded-md text-xs overflow-x-auto">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {log.ipAddress && (
                        <div>
                          <span className="font-medium">IP Address:</span> {log.ipAddress}
                        </div>
                      )}
                      {log.userAgent && (
                        <div>
                          <span className="font-medium">User Agent:</span> {log.userAgent}
                        </div>
                      )}
                      {log.verified && log.verifiedAt && (
                        <div>
                          <span className="font-medium">Verified At:</span> {formatDate(log.verifiedAt)}
                        </div>
                      )}
                      {log.relatedLogId && (
                        <div>
                          <span className="font-medium">Related Log ID:</span> {formatId(log.relatedLogId)}
                        </div>
                      )}
                    </div>
                    
                    {isAdmin && (
                      <div className="mt-4 flex justify-end">
                        <Button
                          variant={log.verified ? "outline" : "default"}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerifyLog(log.id, !log.verified);
                          }}
                        >
                          {log.verified ? (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Unverify
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Verify
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {showPagination && pagination.pages > 1 && (
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center border-t pt-6 gap-4">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {logs.length} of {pagination.total} results
          </div>
          <Pagination className="flex flex-wrap justify-center gap-2">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
                className="px-2 sm:px-3 min-h-9"
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-2 sm:px-3 min-h-9"
              >
                Prev
              </Button>
            </div>
            <span className="flex items-center text-sm px-1">
              {pagination.page}/{pagination.pages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="px-2 sm:px-3 min-h-9"
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.pages)}
                disabled={pagination.page === pagination.pages}
                className="px-2 sm:px-3 min-h-9"
              >
                Last
              </Button>
            </div>
          </Pagination>
        </CardFooter>
      )}
    </Card>
  );
}