import { useState, useEffect } from "react";
import { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditLogs } from "@/lib/audit";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  FileText,
  User,
  Shield,
  ShieldAlert,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";

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
  type: string;
  severity: string;
  relatedLogId: string | null;
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  retentionDate: string | null;
  metadata: any;
}

interface ReportOptions {
  title: string;
  includeDetails: boolean;
  includeChanges: boolean;
  dateRange: boolean;
  startDate: string;
  endDate: string;
  groupBy: string;
  sortBy: string;
  sortOrder: string;
  format: string;
  columns: string[];
}

interface SearchFilters {
  resourceType: string;
  resourceId: string;
  type: string;
  severity: string;
  startDate: string;
  endDate: string;
  action: string;
  verified: boolean | undefined;
  userEmail: string;
  ipAddress: string;
}

const AuditReportPrintPage: NextPage = () => {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedLogs, setGroupedLogs] = useState<Record<string, AuditLog[]>>({});

  useEffect(() => {
    // Retrieve report options and filters from localStorage
    const storedOptions = localStorage.getItem('auditReportOptions');
    const storedFilters = localStorage.getItem('auditReportFilters');
    
    if (storedOptions && storedFilters) {
      try {
        const parsedOptions = JSON.parse(storedOptions);
        const parsedFilters = JSON.parse(storedFilters);
        
        setOptions(parsedOptions);
        setFilters(parsedFilters);
        
        // Fetch logs based on the filters
        fetchLogs(parsedFilters);
      } catch (err) {
        console.error('Error parsing stored options or filters:', err);
        setError('Failed to load report configuration');
        setLoading(false);
      }
    } else {
      setError('No report configuration found');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (logs.length > 0 && options) {
      // Group logs if grouping is enabled
      if (options.groupBy !== 'none') {
        const grouped: Record<string, AuditLog[]> = {};
        
        logs.forEach(log => {
          let groupKey = '';
          
          switch (options.groupBy) {
            case 'type':
              groupKey = log.type || 'Unknown';
              break;
            case 'severity':
              groupKey = log.severity || 'Unknown';
              break;
            case 'resourceType':
              groupKey = log.resourceType || 'Unknown';
              break;
            case 'userEmail':
              groupKey = log.userEmail || 'System';
              break;
            case 'date':
              groupKey = new Date(log.timestamp).toLocaleDateString();
              break;
            default:
              groupKey = 'All Logs';
          }
          
          if (!grouped[groupKey]) {
            grouped[groupKey] = [];
          }
          
          grouped[groupKey].push(log);
        });
        
        setGroupedLogs(grouped);
      } else {
        // If no grouping, put all logs under a single group
        setGroupedLogs({ 'All Logs': logs });
      }
    }
  }, [logs, options]);

  const fetchLogs = async (filters: SearchFilters) => {
    setLoading(true);
    
    try {
      const queryFilters: Record<string, any> = {
        ...filters,
        limit: 1000 // Set a high limit to get all logs that match the filters
      };
      
      const result = await getAuditLogs(queryFilters);
      
      if (result.error) {
        setError(result.error);
        setLogs([]);
      } else {
        // Sort logs based on options
        let sortedLogs = [...result.logs];
        
        if (options) {
          sortedLogs.sort((a, b) => {
            const sortField = options.sortBy as keyof AuditLog;
            const aValue = a[sortField];
            const bValue = b[sortField];
            
            if (aValue === null || aValue === undefined) return options.sortOrder === 'asc' ? -1 : 1;
            if (bValue === null || bValue === undefined) return options.sortOrder === 'asc' ? 1 : -1;
            
            if (sortField === 'timestamp') {
              return options.sortOrder === 'asc'
                ? new Date(aValue as string).getTime() - new Date(bValue as string).getTime()
                : new Date(bValue as string).getTime() - new Date(aValue as string).getTime();
            }
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
              return options.sortOrder === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
            }
            
            return options.sortOrder === 'asc'
              ? (aValue as number) - (bValue as number)
              : (bValue as number) - (aValue as number);
          });
        }
        
        setLogs(sortedLogs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to fetch audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), "PPpp");
    } catch (error) {
      return "Invalid date";
    }
  };

  const formatId = (id: string | null): string => {
    if (!id) return "N/A";
    if (id.length > 8 && id.includes("-")) {
      return id.split("-")[0];
    }
    return id.substring(0, 8);
  };

  const getSeverityBadge = (severity: string) => {
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "USER_ACTIVITY":
        return <User className="h-4 w-4 text-blue-500" />;
      case "DATA_ACCESS":
        return <FileText className="h-4 w-4 text-green-500" />;
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

  if (loading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Loading Report...</h1>
        <p>Please wait while we prepare your report.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-500">{error}</p>
        <Button className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  if (!options || !filters) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Missing Configuration</h1>
        <p>Report configuration is missing. Please generate a new report.</p>
        <Button className="mt-4" onClick={() => router.push('/settings/compliance')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Return to Compliance Page
        </Button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{options.title || 'Audit Log Report'}</title>
        <style>{`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              font-size: 12px;
            }
            .page-break {
              page-break-after: always;
            }
          }
        `}</style>
      </Head>
      
      <div className="container mx-auto py-8">
        <div className="no-print flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{options.title}</h1>
          <p className="text-muted-foreground mt-2">
            Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Report Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logs.length}</div>
                <p className="text-xs text-muted-foreground">Total audit logs</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Date Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {options.dateRange && options.startDate && options.endDate ? (
                    <>
                      {new Date(options.startDate).toLocaleDateString()} to {new Date(options.endDate).toLocaleDateString()}
                    </>
                  ) : (
                    <>All available dates</>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Applied Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {Object.entries(filters).some(([_, value]) => value !== "" && value !== undefined) ? (
                    <div className="flex flex-wrap gap-1">
                      {filters.type && <Badge variant="outline">{filters.type}</Badge>}
                      {filters.severity && <Badge variant="outline">{filters.severity}</Badge>}
                      {filters.resourceType && <Badge variant="outline">{filters.resourceType}</Badge>}
                      {filters.action && <Badge variant="outline">{filters.action}</Badge>}
                      {filters.userEmail && <Badge variant="outline">{filters.userEmail}</Badge>}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No filters applied</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <Separator className="my-6" />
        
        {Object.entries(groupedLogs).map(([groupName, groupLogs], groupIndex) => (
          <div key={groupName} className={groupIndex > 0 ? 'mt-8 page-break' : ''}>
            <h2 className="text-xl font-bold mb-4">{groupName}</h2>
            
            <Table>
              <TableHeader>
                {options.columns.includes("timestamp") && <TableHead>Timestamp</TableHead>}
                {options.columns.includes("userEmail") && <TableHead>User</TableHead>}
                {options.columns.includes("action") && <TableHead>Action</TableHead>}
                {options.columns.includes("resourceType") && <TableHead>Resource Type</TableHead>}
                {options.columns.includes("resourceId") && <TableHead>Resource ID</TableHead>}
                {options.columns.includes("type") && <TableHead>Type</TableHead>}
                {options.columns.includes("severity") && <TableHead>Severity</TableHead>}
                {options.columns.includes("verified") && <TableHead>Verified</TableHead>}
                {options.columns.includes("ipAddress") && <TableHead>IP Address</TableHead>}
                {options.columns.includes("id") && <TableHead>Log ID</TableHead>}
              </TableHeader>
              <TableBody>
                {groupLogs.map((log) => (
                  <TableRow key={log.id}>
                    {options.columns.includes("timestamp") && (
                      <TableCell>{formatDate(log.timestamp)}</TableCell>
                    )}
                    {options.columns.includes("userEmail") && (
                      <TableCell>{log.userEmail || "System"}</TableCell>
                    )}
                    {options.columns.includes("action") && (
                      <TableCell>{log.action}</TableCell>
                    )}
                    {options.columns.includes("resourceType") && (
                      <TableCell>{log.resourceType}</TableCell>
                    )}
                    {options.columns.includes("resourceId") && (
                      <TableCell>{formatId(log.resourceId)}</TableCell>
                    )}
                    {options.columns.includes("type") && (
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {getTypeIcon(log.type)}
                          <span>{log.type}</span>
                        </div>
                      </TableCell>
                    )}
                    {options.columns.includes("severity") && (
                      <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                    )}
                    {options.columns.includes("verified") && (
                      <TableCell>
                        {log.verified ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Yes</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-gray-400" />
                            <span>No</span>
                          </div>
                        )}
                      </TableCell>
                    )}
                    {options.columns.includes("ipAddress") && (
                      <TableCell>{log.ipAddress || "N/A"}</TableCell>
                    )}
                    {options.columns.includes("id") && (
                      <TableCell className="font-mono text-xs">{log.id}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {options.includeDetails && (
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4">Detailed Log Information</h3>
                
                {groupLogs.map((log) => (
                  <div key={`details-${log.id}`} className="mb-6 pb-6 border-b">
                    <h4 className="font-medium mb-2">
                      {log.action} - {formatDate(log.timestamp)}
                    </h4>
                    
                    {log.details && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-1">Details</h5>
                        <pre className="bg-muted/30 p-3 rounded-md text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {options.includeChanges && log.changes && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-1">Changes</h5>
                        <pre className="bg-muted/30 p-3 rounded-md text-xs overflow-x-auto">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>End of Report</p>
          <p>Generated from Enterprise Vehicle Rental Management System</p>
          <p>{new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </>
  );
};

export default AuditReportPrintPage;