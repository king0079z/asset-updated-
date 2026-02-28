// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { 
  CalendarIcon, 
  Search, 
  UserIcon, 
  FileIcon, 
  PackageIcon, 
  CarIcon, 
  TicketIcon, 
  RefreshCw, 
  Download, 
  Filter, 
  X, 
  Clock, 
  ShoppingCart,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { ActionDetailsDisplay } from '@/components/ActionDetailsDisplay';
import { AssignedItemsList } from '@/components/AssignedItemsList';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';
import { toast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Define the staff activity interface
interface StaffActivity {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
}

// Define filter state interface
interface FilterState {
  search: string;
  resourceType: string;
  dateRange: DateRange | undefined;
  page: number;
  actionType: string;
}

interface StaffActivityViewerProps {
  title?: string;
  description?: string;
  showExport?: boolean;
  initialFilters?: Partial<FilterState>;
  initialTab?: 'all' | 'my';
  className?: string;
}

export function StaffActivityViewer({
  title = "Staff Activity",
  description = "Track and monitor staff actions across the system",
  showExport = true,
  initialFilters = {},
  initialTab = 'all',
  className = ''
}: StaffActivityViewerProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1
  });
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: initialFilters.search || '',
    resourceType: initialFilters.resourceType || 'ALL',
    dateRange: initialFilters.dateRange,
    page: initialFilters.page || 1,
    actionType: initialFilters.actionType || 'ALL'
  });

  // Fetch staff activities
  const fetchActivities = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('page', filters.page.toString());
      queryParams.append('limit', pagination.limit.toString());
      queryParams.append('type', 'USER_ACTIVITY');
      
      if (filters.search) {
        queryParams.append('action', filters.search);
      }
      
      if (filters.resourceType && filters.resourceType !== 'ALL') {
        queryParams.append('resourceType', filters.resourceType);
      }
      
      if (filters.dateRange?.from) {
        queryParams.append('startDate', filters.dateRange.from.toISOString());
      }
      
      if (filters.dateRange?.to) {
        queryParams.append('endDate', filters.dateRange.to.toISOString());
      }
      
      if (activeTab === 'my') {
        queryParams.append('userId', user?.id || '');
      }
      
      if (filters.actionType && filters.actionType !== 'ALL') {
        queryParams.append('actionType', filters.actionType);
      }
      
      if (forceRefresh) {
        queryParams.append('forceRefresh', 'true');
      }
      
      const response = await fetch(`/api/staff-activity?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch staff activities');
      }
      
      const data = await response.json();
      setActivities(data.activities);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching staff activities:', err);
      setError('Failed to load staff activities. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchActivities();
  }, [filters.page, activeTab]);
  
  // Handle search
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    fetchActivities();
  };
  
  // Handle filter reset
  const handleReset = () => {
    setFilters({
      search: '',
      resourceType: 'ALL',
      dateRange: undefined,
      page: 1,
      actionType: 'ALL'
    });
    fetchActivities(true);
  };
  
  // Get resource type icon
  const getResourceIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'USER':
        return <UserIcon className="h-4 w-4 text-blue-500" />;
      case 'ASSET':
        return <PackageIcon className="h-4 w-4 text-green-500" />;
      case 'VEHICLE':
        return <CarIcon className="h-4 w-4 text-purple-500" />;
      case 'TICKET':
        return <TicketIcon className="h-4 w-4 text-orange-500" />;
      case 'FOOD_SUPPLY':
        return <ShoppingCart className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  // Export activities to CSV
  const exportActivities = async () => {
    setIsExporting(true);
    try {
      // Build query parameters for export (no pagination)
      const queryParams = new URLSearchParams();
      queryParams.append('type', 'USER_ACTIVITY');
      queryParams.append('export', 'true');
      queryParams.append('limit', '1000'); // Get more records for export
      
      if (filters.search) {
        queryParams.append('action', filters.search);
      }
      
      if (filters.resourceType && filters.resourceType !== 'ALL') {
        queryParams.append('resourceType', filters.resourceType);
      }
      
      if (filters.dateRange?.from) {
        queryParams.append('startDate', filters.dateRange.from.toISOString());
      }
      
      if (filters.dateRange?.to) {
        queryParams.append('endDate', filters.dateRange.to.toISOString());
      }
      
      if (activeTab === 'my') {
        queryParams.append('userId', user?.id || '');
      }
      
      if (filters.actionType && filters.actionType !== 'ALL') {
        queryParams.append('actionType', filters.actionType);
      }
      
      const response = await fetch(`/api/staff-activity?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to export staff activities');
      }
      
      const data = await response.json();
      
      // Convert to CSV
      const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'Details'];
      const csvRows = [headers];
      
      data.activities.forEach((activity: StaffActivity) => {
        csvRows.push([
          new Date(activity.timestamp).toLocaleString(),
          activity.userEmail,
          activity.action,
          activity.resourceType,
          activity.resourceId || '',
          JSON.stringify(activity.details || {})
        ]);
      });
      
      const csvContent = csvRows.map(row => row.map(cell => 
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(',')).join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `staff-activity-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Successful",
        description: `Exported ${data.activities.length} activities to CSV`,
        duration: 3000,
      });
    } catch (err) {
      console.error('Error exporting activities:', err);
      toast({
        title: "Export Failed",
        description: "Failed to export activities. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Render activity table
  const renderActivityTable = () => {
    const tableColumns = activeTab === 'my' 
      ? ['Timestamp', 'Action', 'Resource Type', 'Resource ID'] 
      : ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID'];
    
    const colSpan = activeTab === 'my' ? 4 : 5;
    
    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {tableColumns.map((column, index) => (
                <TableHead key={index} className={column === 'Action' ? 'w-1/3' : ''}>
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: colSpan }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No activities found</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleReset}
                      className="mt-2"
                    >
                      Reset Filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow key={activity.id} className="group hover:bg-muted/50">
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </TableCell>
                  
                  {activeTab !== 'my' && (
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="h-3.5 w-3.5 text-blue-500" />
                        <span className="truncate max-w-[150px]" title={activity.userEmail}>
                          {activity.userEmail}
                        </span>
                      </div>
                    </TableCell>
                  )}
                  
                  <TableCell>
                    <ActionDetailsDisplay 
                      action={activity.action}
                      resourceType={activity.resourceType}
                      resourceId={activity.resourceId}
                      details={activity.details}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {getResourceIcon(activity.resourceType)}
                      <Badge variant="outline" className="font-normal">
                        {activity.resourceType}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  <TableCell className="font-mono text-xs">
                    {activity.resourceId ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate max-w-[100px] inline-block">
                              {activity.resourceId}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{activity.resourceId}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            <p className="text-muted-foreground mt-1">
              {description}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchActivities(true)}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              {t('refresh')}
            </Button>
            
            {showExport && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportActivities}
                disabled={isExporting || activities.length === 0}
                className="flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                {isExporting ? t('exporting') : t('export_csv')}
              </Button>
            )}
          </div>
        </div>
        
        <Tabs 
          defaultValue={initialTab} 
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            setFilters(prev => ({ ...prev, page: 1 }));
          }}
          className="w-full"
        >
          <TabsList className="mb-6 grid w-full grid-cols-3 md:w-auto md:inline-flex">
            <TabsTrigger value="all">{t('all_activities')}</TabsTrigger>
            <TabsTrigger value="my">{t('my_activities')}</TabsTrigger>
            <TabsTrigger value="assignments">{t('my_assignments')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="assignments" className="mt-0">
            <div className="pt-2">
              <AssignedItemsList />
            </div>
          </TabsContent>
          
          <TabsContent value="all" className="mt-0">
            <div className="space-y-6">
            <div className="flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      type="text"
                      placeholder="Search by action..."
                      className="pl-8"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                    />
                  </div>
                </div>
                
                <Select
                  value={filters.resourceType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, resourceType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Resource Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="ASSET">Asset</SelectItem>
                    <SelectItem value="VEHICLE">Vehicle</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="TICKET">Ticket</SelectItem>
                    <SelectItem value="FOOD_SUPPLY">Food Supply</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select
                  value={filters.actionType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, actionType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Actions</SelectItem>
                    <SelectItem value="CREATE">Create</SelectItem>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                    <SelectItem value="MOVE">Move</SelectItem>
                    <SelectItem value="ASSIGN">Assign</SelectItem>
                    <SelectItem value="VIEW">View</SelectItem>
                    <SelectItem value="CONSUME">Consume</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full md:w-auto justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange?.from ? (
                        filters.dateRange.to ? (
                          <>
                            {format(filters.dateRange.from, 'LLL dd, y')} -{' '}
                            {format(filters.dateRange.to, 'LLL dd, y')}
                          </>
                        ) : (
                          format(filters.dateRange.from, 'LLL dd, y')
                        )
                      ) : (
                        'Select date range'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={filters.dateRange?.from}
                      selected={filters.dateRange}
                      onSelect={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button 
                    onClick={handleSearch}
                    className="flex items-center gap-1"
                  >
                    <Filter className="h-4 w-4" />
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error loading activities</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {!loading && (
                    <span>
                      Showing {activities.length} of {pagination.total} activities
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Select
                    value={pagination.limit.toString()}
                    onValueChange={(value) => {
                      const newLimit = parseInt(value);
                      setPagination(prev => ({ ...prev, limit: newLimit }));
                      setFilters(prev => ({ ...prev, page: 1 }));
                      fetchActivities();
                    }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Page size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 rows</SelectItem>
                      <SelectItem value="20">20 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {renderActivityTable()}
              
              {pagination.pages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={filters.page === 1 || loading}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      // Show first page, last page, current page, and pages around current
                      const pageNumbers = [];
                      
                      // Always show first page
                      pageNumbers.push(1);
                      
                      // Pages around current
                      for (let p = Math.max(2, filters.page - 1); p <= Math.min(pagination.pages - 1, filters.page + 1); p++) {
                        if (!pageNumbers.includes(p)) {
                          pageNumbers.push(p);
                        }
                      }
                      
                      // Always show last page if more than 1 page
                      if (pagination.pages > 1) {
                        pageNumbers.push(pagination.pages);
                      }
                      
                      // Sort page numbers
                      pageNumbers.sort((a, b) => a - b);
                      
                      // Add ellipsis indicators
                      const pageItems = [];
                      for (let i = 0; i < pageNumbers.length; i++) {
                        if (i > 0 && pageNumbers[i] > pageNumbers[i-1] + 1) {
                          pageItems.push(
                            <PaginationItem key={`ellipsis-${i}`}>
                              <span className="px-2">...</span>
                            </PaginationItem>
                          );
                        }
                        
                        pageItems.push(
                          <PaginationItem key={pageNumbers[i]}>
                            <PaginationLink
                              isActive={pageNumbers[i] === filters.page}
                              onClick={() => setFilters(prev => ({ ...prev, page: pageNumbers[i] }))}
                              disabled={loading}
                            >
                              {pageNumbers[i]}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      
                      return pageItems;
                    }).flat()}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                        disabled={filters.page === pagination.pages || loading}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
            </div>
          </TabsContent>
          
          <TabsContent value="my" className="mt-0">
            <div className="space-y-6">
            <div className="flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      type="text"
                      placeholder="Search by action..."
                      className="pl-8"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                    />
                  </div>
                </div>
                
                <Select
                  value={filters.resourceType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, resourceType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Resource Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="ASSET">Asset</SelectItem>
                    <SelectItem value="VEHICLE">Vehicle</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="TICKET">Ticket</SelectItem>
                    <SelectItem value="FOOD_SUPPLY">Food Supply</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select
                  value={filters.actionType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, actionType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Actions</SelectItem>
                    <SelectItem value="CREATE">Create</SelectItem>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                    <SelectItem value="MOVE">Move</SelectItem>
                    <SelectItem value="ASSIGN">Assign</SelectItem>
                    <SelectItem value="VIEW">View</SelectItem>
                    <SelectItem value="CONSUME">Consume</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full md:w-auto justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange?.from ? (
                        filters.dateRange.to ? (
                          <>
                            {format(filters.dateRange.from, 'LLL dd, y')} -{' '}
                            {format(filters.dateRange.to, 'LLL dd, y')}
                          </>
                        ) : (
                          format(filters.dateRange.from, 'LLL dd, y')
                        )
                      ) : (
                        'Select date range'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={filters.dateRange?.from}
                      selected={filters.dateRange}
                      onSelect={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button 
                    onClick={handleSearch}
                    className="flex items-center gap-1"
                  >
                    <Filter className="h-4 w-4" />
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error loading activities</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {!loading && (
                    <span>
                      Showing {activities.length} of {pagination.total} activities
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Select
                    value={pagination.limit.toString()}
                    onValueChange={(value) => {
                      const newLimit = parseInt(value);
                      setPagination(prev => ({ ...prev, limit: newLimit }));
                      setFilters(prev => ({ ...prev, page: 1 }));
                      fetchActivities();
                    }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Page size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 rows</SelectItem>
                      <SelectItem value="20">20 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {renderActivityTable()}
              
              {pagination.pages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={filters.page === 1 || loading}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      // Show first page, last page, current page, and pages around current
                      const pageNumbers = [];
                      
                      // Always show first page
                      pageNumbers.push(1);
                      
                      // Pages around current
                      for (let p = Math.max(2, filters.page - 1); p <= Math.min(pagination.pages - 1, filters.page + 1); p++) {
                        if (!pageNumbers.includes(p)) {
                          pageNumbers.push(p);
                        }
                      }
                      
                      // Always show last page if more than 1 page
                      if (pagination.pages > 1) {
                        pageNumbers.push(pagination.pages);
                      }
                      
                      // Sort page numbers
                      pageNumbers.sort((a, b) => a - b);
                      
                      // Add ellipsis indicators
                      const pageItems = [];
                      for (let i = 0; i < pageNumbers.length; i++) {
                        if (i > 0 && pageNumbers[i] > pageNumbers[i-1] + 1) {
                          pageItems.push(
                            <PaginationItem key={`ellipsis-${i}`}>
                              <span className="px-2">...</span>
                            </PaginationItem>
                          );
                        }
                        
                        pageItems.push(
                          <PaginationItem key={pageNumbers[i]}>
                            <PaginationLink
                              isActive={pageNumbers[i] === filters.page}
                              onClick={() => setFilters(prev => ({ ...prev, page: pageNumbers[i] }))}
                              disabled={loading}
                            >
                              {pageNumbers[i]}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      
                      return pageItems;
                    }).flat()}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                        disabled={filters.page === pagination.pages || loading}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}