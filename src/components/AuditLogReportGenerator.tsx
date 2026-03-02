import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  Download, 
  FileText, 
  Printer, 
  Save,
  FileOutput
} from "lucide-react";
import { useRouter } from "next/router";

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

interface AuditLogReportGeneratorProps {
  logs: AuditLog[];
  filters: SearchFilters;
  onGenerateReport: (format: string, options: ReportOptions) => void;
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

export function AuditLogReportGenerator({
  logs,
  filters,
  onGenerateReport
}: AuditLogReportGeneratorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReportOptions>({
    title: `Audit Log Report - ${new Date().toLocaleDateString()}`,
    includeDetails: true,
    includeChanges: true,
    dateRange: false,
    startDate: filters.startDate || "",
    endDate: filters.endDate || "",
    groupBy: "none",
    sortBy: "timestamp",
    sortOrder: "desc",
    format: "pdf",
    columns: ["timestamp", "userEmail", "action", "resourceType", "resourceId", "type", "severity", "verified"]
  });

  const handleOptionChange = (key: string, value: any) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleColumnToggle = (column: string) => {
    setOptions((prev) => {
      const columns = [...prev.columns];
      if (columns.includes(column)) {
        return { ...prev, columns: columns.filter((c) => c !== column) };
      } else {
        return { ...prev, columns: [...columns, column] };
      }
    });
  };

  const handleGenerateReport = () => {
    onGenerateReport(options.format, options);
    setOpen(false);
  };

  const handlePrintPreview = () => {
    // Store report options in localStorage to retrieve them on the print page
    localStorage.setItem('auditReportOptions', JSON.stringify(options));
    localStorage.setItem('auditReportFilters', JSON.stringify(filters));
    
    // Open the print preview page in a new tab
    window.open('/reports/print?type=audit', '_blank');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-10 w-full sm:w-auto">
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Audit Log Report</DialogTitle>
          <DialogDescription>
            Customize your report options and generate a downloadable report or print preview.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 overflow-y-auto max-h-[70vh]">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="reportTitle">Report Title</Label>
              <Input
                id="reportTitle"
                value={options.title}
                onChange={(e) => handleOptionChange("title", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="format">Report Format</Label>
              <Select
                value={options.format}
                onValueChange={(value) => handleOptionChange("format", value)}
              >
                <SelectTrigger id="format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                  <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                  <SelectItem value="json">JSON Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="groupBy">Group Results By</Label>
              <Select
                value={options.groupBy}
                onValueChange={(value) => handleOptionChange("groupBy", value)}
              >
                <SelectTrigger id="groupBy">
                  <SelectValue placeholder="Select grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="type">Log Type</SelectItem>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="resourceType">Resource Type</SelectItem>
                  <SelectItem value="userEmail">User</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="sortBy">Sort Results By</Label>
              <div className="flex gap-2">
                <Select
                  value={options.sortBy}
                  onValueChange={(value) => handleOptionChange("sortBy", value)}
                  className="flex-1"
                >
                  <SelectTrigger id="sortBy">
                    <SelectValue placeholder="Select sort field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timestamp">Timestamp</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                    <SelectItem value="severity">Severity</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="resourceType">Resource Type</SelectItem>
                    <SelectItem value="userEmail">User</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select
                  value={options.sortOrder}
                  onValueChange={(value) => handleOptionChange("sortOrder", value)}
                >
                  <SelectTrigger id="sortOrder">
                    <SelectValue placeholder="Order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="dateRange"
                  checked={options.dateRange}
                  onCheckedChange={(checked) => handleOptionChange("dateRange", !!checked)}
                />
                <Label htmlFor="dateRange">Custom Date Range</Label>
              </div>
              
              {options.dateRange && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          id="startDate"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {options.startDate ? (
                            format(new Date(options.startDate), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={options.startDate ? new Date(options.startDate) : undefined}
                          onSelect={(date) => handleOptionChange("startDate", date ? date.toISOString().split('T')[0] : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          id="endDate"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {options.endDate ? (
                            format(new Date(options.endDate), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={options.endDate ? new Date(options.endDate) : undefined}
                          onSelect={(date) => handleOptionChange("endDate", date ? date.toISOString().split('T')[0] : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right column */}
          <div className="space-y-4">
            <div>
              <Label className="block mb-2">Include in Report</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeDetails"
                    checked={options.includeDetails}
                    onCheckedChange={(checked) => handleOptionChange("includeDetails", !!checked)}
                  />
                  <Label htmlFor="includeDetails">Include Log Details</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeChanges"
                    checked={options.includeChanges}
                    onCheckedChange={(checked) => handleOptionChange("includeChanges", !!checked)}
                  />
                  <Label htmlFor="includeChanges">Include Data Changes</Label>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <Label className="block mb-2">Columns to Include</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-timestamp"
                    checked={options.columns.includes("timestamp")}
                    onCheckedChange={() => handleColumnToggle("timestamp")}
                  />
                  <Label htmlFor="col-timestamp">Timestamp</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-userEmail"
                    checked={options.columns.includes("userEmail")}
                    onCheckedChange={() => handleColumnToggle("userEmail")}
                  />
                  <Label htmlFor="col-userEmail">User</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-action"
                    checked={options.columns.includes("action")}
                    onCheckedChange={() => handleColumnToggle("action")}
                  />
                  <Label htmlFor="col-action">Action</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-resourceType"
                    checked={options.columns.includes("resourceType")}
                    onCheckedChange={() => handleColumnToggle("resourceType")}
                  />
                  <Label htmlFor="col-resourceType">Resource Type</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-resourceId"
                    checked={options.columns.includes("resourceId")}
                    onCheckedChange={() => handleColumnToggle("resourceId")}
                  />
                  <Label htmlFor="col-resourceId">Resource ID</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-type"
                    checked={options.columns.includes("type")}
                    onCheckedChange={() => handleColumnToggle("type")}
                  />
                  <Label htmlFor="col-type">Log Type</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-severity"
                    checked={options.columns.includes("severity")}
                    onCheckedChange={() => handleColumnToggle("severity")}
                  />
                  <Label htmlFor="col-severity">Severity</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-verified"
                    checked={options.columns.includes("verified")}
                    onCheckedChange={() => handleColumnToggle("verified")}
                  />
                  <Label htmlFor="col-verified">Verification</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-ipAddress"
                    checked={options.columns.includes("ipAddress")}
                    onCheckedChange={() => handleColumnToggle("ipAddress")}
                  />
                  <Label htmlFor="col-ipAddress">IP Address</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-id"
                    checked={options.columns.includes("id")}
                    onCheckedChange={() => handleColumnToggle("id")}
                  />
                  <Label htmlFor="col-id">Log ID</Label>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            {logs.length} logs will be included in this report
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handlePrintPreview} className="w-full sm:w-auto">
              <Printer className="h-4 w-4 mr-2" />
              Print Preview
            </Button>
            <Button onClick={handleGenerateReport} className="w-full sm:w-auto">
              <FileOutput className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}