import { useState, useEffect } from "react";
import { NextPage } from "next";
import Head from "next/head";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { AuditLogAdvancedSearch } from "@/components/AuditLogAdvancedSearch";
import { AuditLogReportGenerator } from "@/components/AuditLogReportGenerator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { 
  AlertTriangle, 
  CheckCircle2, 
  ClipboardList, 
  Download, 
  FileText, 
  Lock, 
  RefreshCw,
  Shield, 
  ShieldAlert, 
  User,
  Search,
  Filter
} from "lucide-react";
import { logComplianceEvent, getAuditLogs } from "@/lib/audit";

const CompliancePage: NextPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("audit-logs");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchFilters, setSearchFilters] = useState({
    resourceType: "",
    resourceId: "",
    type: "",
    severity: "",
    startDate: "",
    endDate: "",
    action: "",
    verified: undefined,
    userEmail: "",
    ipAddress: ""
  });
  const [savedSearches, setSavedSearches] = useState<{ name: string; filters: any }[]>([]);
  
  // Check if user is admin (simplified check - replace with your actual logic)
  const isAdmin = user?.email?.endsWith('@admin.com') || false;
  
  // Fetch audit logs based on filters
  const fetchAuditLogs = async (filters: any) => {
    try {
      const result = await getAuditLogs(filters, true);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
        setAuditLogs([]);
      } else {
        setAuditLogs(result.logs);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive"
      });
      setAuditLogs([]);
    }
  };
  
  // Load saved searches from localStorage on component mount
  useEffect(() => {
    const loadSavedSearches = () => {
      const savedSearchesJson = localStorage.getItem('auditLogSavedSearches');
      if (savedSearchesJson) {
        try {
          const parsed = JSON.parse(savedSearchesJson);
          setSavedSearches(parsed);
        } catch (error) {
          console.error("Error parsing saved searches:", error);
        }
      }
    };
    
    loadSavedSearches();
  }, []);
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: any) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
  };
  
  // Handle search button click
  const handleSearch = () => {
    fetchAuditLogs(searchFilters);
  };
  
  // Reset filters to default values
  const handleResetFilters = () => {
    setSearchFilters({
      resourceType: "",
      resourceId: "",
      type: "",
      severity: "",
      startDate: "",
      endDate: "",
      action: "",
      verified: undefined,
      userEmail: "",
      ipAddress: ""
    });
  };
  
  // Save current search to localStorage
  const handleSaveSearch = (name: string) => {
    const newSavedSearch = { name, filters: { ...searchFilters } };
    const updatedSavedSearches = [...savedSearches, newSavedSearch];
    
    setSavedSearches(updatedSavedSearches);
    localStorage.setItem('auditLogSavedSearches', JSON.stringify(updatedSavedSearches));
    
    toast({
      title: "Search Saved",
      description: `Search "${name}" has been saved successfully.`,
    });
  };
  
  // Load a saved search
  const handleLoadSavedSearch = (filters: any) => {
    setSearchFilters(filters);
    fetchAuditLogs(filters);
  };
  
  // Generate and download report
  const handleGenerateReport = async (format: string, options: any) => {
    try {
      // Show loading toast
      toast({
        title: "Generating Report",
        description: "Please wait while we generate your report...",
      });
      
      // Prepare request data
      const requestData = {
        filters: searchFilters,
        options: {
          ...options,
          format
        }
      };
      
      // Call the API to generate the report
      const response = await fetch('/api/audit/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }
      
      const data = await response.json();
      
      // Log the report generation
      await logComplianceEvent(
        "AUDIT_REPORT_GENERATED",
        {
          format,
          options,
          logCount: data.logs.length,
          timestamp: new Date().toISOString(),
        }
      );
      
      // Handle different report formats
      if (format === 'csv' || format === 'excel') {
        // Create CSV content
        const headers = options.columns.map((col: string) => {
          switch (col) {
            case 'timestamp': return 'Timestamp';
            case 'userEmail': return 'User';
            case 'action': return 'Action';
            case 'resourceType': return 'Resource Type';
            case 'resourceId': return 'Resource ID';
            case 'type': return 'Type';
            case 'severity': return 'Severity';
            case 'verified': return 'Verified';
            case 'ipAddress': return 'IP Address';
            case 'id': return 'Log ID';
            default: return col;
          }
        });
        
        const csvContent = [
          headers.join(','),
          ...data.logs.map((log: any) => {
            return options.columns.map((col: string) => {
              let value = log[col];
              
              // Format specific columns
              if (col === 'timestamp') {
                value = new Date(value).toISOString();
              } else if (col === 'verified') {
                value = value ? 'Yes' : 'No';
              } else if (value === null || value === undefined) {
                value = '';
              }
              
              // Escape commas and quotes for CSV
              if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`;
              }
              
              return value;
            }).join(',');
          })
        ].join('\n');
        
        // Create and download the file
        const blob = new Blob([csvContent], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Report Generated",
          description: `Your ${format.toUpperCase()} report has been downloaded.`,
          variant: "default"
        });
      } else if (format === 'pdf') {
        // For PDF, we'll use the print preview page
        localStorage.setItem('auditReportOptions', JSON.stringify(options));
        localStorage.setItem('auditReportFilters', JSON.stringify(searchFilters));
        localStorage.setItem('auditReportData', JSON.stringify(data.logs));
        
        // Open the print preview page in a new tab
        window.open('/reports/audit-print', '_blank');
        
        toast({
          title: "Report Generated",
          description: "Your PDF report has been prepared for printing.",
          variant: "default"
        });
      } else if (format === 'json') {
        // For JSON, just download the raw data
        const blob = new Blob([JSON.stringify(data.logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Report Generated",
          description: "Your JSON report has been downloaded.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate report",
        variant: "destructive"
      });
    }
  };

  // Log page access for compliance purposes
  useEffect(() => {
    const logAccess = async () => {
      if (user) {
        try {
          await logComplianceEvent(
            "COMPLIANCE_PAGE_ACCESS",
            {
              page: "compliance",
              timestamp: new Date().toISOString(),
            }
          );
        } catch (error) {
          console.error("Error logging compliance event:", error);
        }
      }
    };
    
    logAccess();
  }, [user]);

  const handleGenerateComplianceReport = async (reportType: string) => {
    try {
      await logComplianceEvent(
        "COMPLIANCE_REPORT_GENERATED",
        {
          reportType,
          generatedBy: user?.email,
          timestamp: new Date().toISOString(),
        }
      );
      
      // In a real implementation, you would generate and download the report here
      toast({
        title: "Report Generation",
        description: `${reportType} report would be generated here`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
    }
  };

  return (
    <>
      <Head>
        <title>Compliance & Audit | Enterprise Vehicle Rental Management</title>
      </Head>
      
      <DashboardLayout>
        <div className="container mx-auto py-6 space-y-6 px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Compliance & Audit</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Monitor system activity and ensure compliance with global standards
              </p>
            </div>
            
            {isAdmin && (
              <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-auto flex-1 sm:flex-none"
                  onClick={() => handleGenerateComplianceReport("GDPR Compliance")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">GDPR</span>
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-auto flex-1 sm:flex-none"
                  onClick={() => handleGenerateComplianceReport("SOC2 Compliance")}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">SOC2</span>
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-auto flex-1 sm:flex-none"
                  onClick={() => handleGenerateComplianceReport("ISO 27001")}
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">ISO</span>
                </Button>
              </div>
            )}
          </div>
          
          <Alert>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <div>
              <AlertTitle>Compliance Information</AlertTitle>
              <AlertDescription className="text-sm">
                This system maintains comprehensive audit logs for compliance with ISO 27001, GDPR, and SOC2 standards.
                All user actions, data access, and system events are recorded and can be reviewed by authorized personnel.
              </AlertDescription>
            </div>
          </Alert>
          
          <div className="flex flex-col gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full overflow-x-auto flex-nowrap">
                <TabsTrigger value="audit-logs" className="flex-1">Audit Logs</TabsTrigger>
                <TabsTrigger value="compliance-status" className="flex-1">Compliance</TabsTrigger>
                <TabsTrigger value="data-retention" className="flex-1">Retention</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {activeTab === "audit-logs" && (
              <Button 
                variant="outline" 
                size="sm"
                className="w-full sm:w-auto self-end min-h-9"
                onClick={() => {
                  // Force refresh the audit logs without reloading the page
                  const auditLogViewer = document.querySelector('div[role="tabpanel"][data-state="active"]');
                  if (auditLogViewer) {
                    const refreshButton = auditLogViewer.querySelector('button svg[data-lucide="refresh-cw"]')?.closest('button');
                    if (refreshButton) {
                      refreshButton.click();
                    } else {
                      // Fallback to page reload if refresh button not found
                      window.location.reload();
                    }
                  } else {
                    // Fallback to page reload if tab panel not found
                    window.location.reload();
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Logs
              </Button>
            )}
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="audit-logs" className="mt-6">
              {/* Advanced Search and Report Generation */}
              <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-xl font-semibold">Audit Log Search & Reporting</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                    className="min-h-10 w-full sm:w-auto"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {showAdvancedSearch ? "Hide Advanced Search" : "Advanced Search"}
                  </Button>
                  <AuditLogReportGenerator 
                    logs={auditLogs}
                    filters={searchFilters}
                    onGenerateReport={handleGenerateReport}
                  />
                </div>
              </div>
              
              {showAdvancedSearch && (
                <AuditLogAdvancedSearch 
                  filters={searchFilters}
                  onFilterChange={handleFilterChange}
                  onSearch={handleSearch}
                  onReset={handleResetFilters}
                  onSaveSearch={handleSaveSearch}
                  savedSearches={savedSearches}
                  onLoadSavedSearch={handleLoadSavedSearch}
                  isAdmin={isAdmin}
                />
              )}
              
              <AuditLogViewer 
                showFilters={!showAdvancedSearch}
                showPagination={true}
                limit={15}
              />
            </TabsContent>
            
            <TabsContent value="compliance-status" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-500" />
                      GDPR Compliance
                    </CardTitle>
                    <CardDescription>
                      General Data Protection Regulation compliance status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Data Processing Agreement</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Right to Access</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Right to be Forgotten</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Data Portability</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Privacy by Design</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      
                      <Separator />
                      
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground">
                          Last compliance check: <strong>March 10, 2025</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Next scheduled review: <strong>June 10, 2025</strong>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-blue-500" />
                      SOC2 Compliance
                    </CardTitle>
                    <CardDescription>
                      Service Organization Control 2 compliance status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Security</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Availability</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Processing Integrity</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Confidentiality</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Privacy</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      
                      <Separator />
                      
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground">
                          Last audit: <strong>February 15, 2025</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Certification valid until: <strong>February 15, 2026</strong>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-yellow-500" />
                      ISO 27001 Compliance
                    </CardTitle>
                    <CardDescription>
                      Information Security Management System compliance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Security Policy</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Asset Management</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Access Control</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Incident Management</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Business Continuity</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                        </Badge>
                      </div>
                      
                      <Separator />
                      
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground">
                          Certification date: <strong>January 20, 2025</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Next assessment: <strong>January 20, 2026</strong>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-purple-500" />
                      Data Subject Rights
                    </CardTitle>
                    <CardDescription>
                      Management of data subject access requests
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Access Requests</span>
                        <span className="text-sm font-medium">0 pending</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Deletion Requests</span>
                        <span className="text-sm font-medium">0 pending</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Rectification Requests</span>
                        <span className="text-sm font-medium">0 pending</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Portability Requests</span>
                        <span className="text-sm font-medium">0 pending</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground">
                          Average response time: <strong>24 hours</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Compliance rate: <strong>100%</strong>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="data-retention" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Retention Policies</CardTitle>
                  <CardDescription>
                    Information about how long different types of data are retained in the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">User Data</h3>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Account Information</span>
                          <span className="text-sm">Retained until account deletion</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Authentication Logs</span>
                          <span className="text-sm">90 days</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Activity Logs</span>
                          <span className="text-sm">1 year</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Asset Data</h3>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Asset Records</span>
                          <span className="text-sm">7 years after disposal</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Movement History</span>
                          <span className="text-sm">5 years</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Location Data</span>
                          <span className="text-sm">2 years</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Vehicle Data</h3>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Vehicle Records</span>
                          <span className="text-sm">10 years</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Rental History</span>
                          <span className="text-sm">7 years</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Maintenance Records</span>
                          <span className="text-sm">5 years</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Compliance Data</h3>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Audit Logs</span>
                          <span className="text-sm">7 years</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Security Incidents</span>
                          <span className="text-sm">10 years</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b gap-1">
                          <span className="font-medium">Compliance Reports</span>
                          <span className="text-sm">7 years</span>
                        </div>
                      </div>
                    </div>
                    
                    <Alert>
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <div>
                        <AlertTitle>Data Retention Notice</AlertTitle>
                        <AlertDescription className="text-sm">
                          Data retention periods may be extended in case of legal holds or ongoing investigations.
                          Contact your compliance officer for more information about data retention exceptions.
                        </AlertDescription>
                      </div>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
};

export default CompliancePage;