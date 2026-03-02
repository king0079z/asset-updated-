import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  Filter, 
  Search, 
  X, 
  Save, 
  Clock,
  User,
  FileText,
  Shield,
  ShieldAlert,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

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

interface AuditLogAdvancedSearchProps {
  filters: SearchFilters;
  onFilterChange: (key: string, value: any) => void;
  onSearch: () => void;
  onReset: () => void;
  onSaveSearch?: (name: string) => void;
  savedSearches?: { name: string; filters: SearchFilters }[];
  onLoadSavedSearch?: (filters: SearchFilters) => void;
  isAdmin: boolean;
}

export function AuditLogAdvancedSearch({
  filters,
  onFilterChange,
  onSearch,
  onReset,
  onSaveSearch,
  savedSearches = [],
  onLoadSavedSearch,
  isAdmin
}: AuditLogAdvancedSearchProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Track which filters are active for the filter badges
  const updateActiveFilters = () => {
    const active: string[] = [];
    if (filters.resourceType) active.push("Resource Type");
    if (filters.resourceId) active.push("Resource ID");
    if (filters.type) active.push("Type");
    if (filters.severity) active.push("Severity");
    if (filters.startDate || filters.endDate) active.push("Date Range");
    if (filters.action) active.push("Action");
    if (filters.verified !== undefined) active.push("Verification");
    if (filters.userEmail) active.push("User");
    if (filters.ipAddress) active.push("IP Address");
    
    setActiveFilters(active);
  };
  
  // Update active filters whenever filters change
  useEffect(() => {
    updateActiveFilters();
  }, [filters]);

  const handleSaveSearch = () => {
    if (searchName && onSaveSearch) {
      onSaveSearch(searchName);
      setSearchName("");
      setShowSaveDialog(false);
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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "INFO":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case "CRITICAL":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* First column */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="resourceType">Resource Type</Label>
                <Input
                  id="resourceType"
                  placeholder="e.g. ASSET, VEHICLE, USER"
                  value={filters.resourceType}
                  onChange={(e) => onFilterChange("resourceType", e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="resourceId">Resource ID</Label>
                <Input
                  id="resourceId"
                  placeholder="Resource identifier"
                  value={filters.resourceId}
                  onChange={(e) => onFilterChange("resourceId", e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="action">Action</Label>
                <Input
                  id="action"
                  placeholder="e.g. CREATE, UPDATE, DELETE"
                  value={filters.action}
                  onChange={(e) => onFilterChange("action", e.target.value)}
                />
              </div>
            </div>
            
            {/* Second column */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Log Type</Label>
                <Select
                  value={filters.type}
                  onValueChange={(value) => onFilterChange("type", value)}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select log type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_TYPES">All Types</SelectItem>
                    <SelectItem value="USER_ACTIVITY" className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-blue-500" />
                      <span>User Activity</span>
                    </SelectItem>
                    <SelectItem value="DATA_ACCESS" className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-green-500" />
                      <span>Data Access</span>
                    </SelectItem>
                    <SelectItem value="DATA_MODIFICATION" className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-purple-500" />
                      <span>Data Modification</span>
                    </SelectItem>
                    <SelectItem value="SECURITY_EVENT" className="flex items-center">
                      <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
                      <span>Security Event</span>
                    </SelectItem>
                    <SelectItem value="SYSTEM_EVENT" className="flex items-center">
                      <Info className="h-4 w-4 mr-2 text-gray-500" />
                      <span>System Event</span>
                    </SelectItem>
                    <SelectItem value="COMPLIANCE_EVENT" className="flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-yellow-500" />
                      <span>Compliance Event</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={filters.severity}
                  onValueChange={(value) => onFilterChange("severity", value)}
                >
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_SEVERITIES">All Severities</SelectItem>
                    <SelectItem value="INFO" className="flex items-center">
                      <Info className="h-4 w-4 mr-2 text-blue-500" />
                      <span>Info</span>
                    </SelectItem>
                    <SelectItem value="WARNING" className="flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                      <span>Warning</span>
                    </SelectItem>
                    <SelectItem value="ERROR" className="flex items-center">
                      <XCircle className="h-4 w-4 mr-2 text-orange-500" />
                      <span>Error</span>
                    </SelectItem>
                    <SelectItem value="CRITICAL" className="flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                      <span>Critical</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="userEmail">User Email</Label>
                <Input
                  id="userEmail"
                  placeholder="User email address"
                  value={filters.userEmail}
                  onChange={(e) => onFilterChange("userEmail", e.target.value)}
                />
              </div>
            </div>
            
            {/* Third column */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
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
                        {filters.startDate ? (
                          format(new Date(filters.startDate), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.startDate ? new Date(filters.startDate) : undefined}
                        onSelect={(date) => onFilterChange("startDate", date ? date.toISOString().split('T')[0] : "")}
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
                        {filters.endDate ? (
                          format(new Date(filters.endDate), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.endDate ? new Date(filters.endDate) : undefined}
                        onSelect={(date) => onFilterChange("endDate", date ? date.toISOString().split('T')[0] : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="verified"
                    checked={filters.verified === true}
                    onCheckedChange={(checked) => {
                      if (checked === true) onFilterChange("verified", true);
                      else if (checked === false) onFilterChange("verified", false);
                      else onFilterChange("verified", undefined);
                    }}
                  />
                  <label htmlFor="verified" className="text-sm font-medium">
                    Verified Only
                  </label>
                </div>
              )}
              
              <div>
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input
                  id="ipAddress"
                  placeholder="IP address"
                  value={filters.ipAddress}
                  onChange={(e) => onFilterChange("ipAddress", e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          {/* Active filters display */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="secondary">
                  {filter}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex flex-wrap gap-2 w-full">
              <Button variant="outline" onClick={onReset} className="flex-1 sm:flex-none min-h-10">
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
              
              {onSaveSearch && (
                <Popover open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 sm:flex-none min-h-10">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(80vw,320px)]">
                    <div className="space-y-4">
                      <h4 className="font-medium">Save Current Search</h4>
                      <Input
                        placeholder="Search name"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleSaveSearch} className="min-h-9">
                          Save
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              {savedSearches.length > 0 && onLoadSavedSearch && (
                <Select
                  onValueChange={(value) => {
                    const search = savedSearches.find((s) => s.name === value);
                    if (search) {
                      onLoadSavedSearch(search.filters);
                    }
                  }}
                  className="flex-1 sm:w-[180px]"
                >
                  <SelectTrigger className="min-h-10">
                    <SelectValue placeholder="Saved searches" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSearches.map((search) => (
                      <SelectItem key={search.name} value={search.name}>
                        {search.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <Button onClick={onSearch} className="w-full sm:w-auto min-h-10 mt-2 sm:mt-0">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}