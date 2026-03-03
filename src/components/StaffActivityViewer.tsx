// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { format } from 'date-fns';
import {
  CalendarIcon, Search, UserIcon, PackageIcon, CarIcon, TicketIcon,
  RefreshCw, Download, Filter, X, Clock, ShoppingCart, AlertCircle,
  Activity, PlusCircle, Pencil, Trash2, MoveRight, Link, Eye, Zap,
  FileIcon, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { ActionDetailsDisplay } from '@/components/ActionDetailsDisplay';
import { AssignedItemsList } from '@/components/AssignedItemsList';
import { DateRange } from 'react-day-picker';
import { toast } from '@/components/ui/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StaffActivity {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
}

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

// ── Visual config ──────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; icon: any; cls: string; dot: string }> = {
  CREATE:  { label: 'Create',  icon: PlusCircle, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',  dot: 'bg-emerald-500' },
  UPDATE:  { label: 'Update',  icon: Pencil,     cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',                    dot: 'bg-blue-500' },
  DELETE:  { label: 'Delete',  icon: Trash2,     cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',                         dot: 'bg-red-500' },
  MOVE:    { label: 'Move',    icon: MoveRight,  cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',              dot: 'bg-amber-500' },
  ASSIGN:  { label: 'Assign',  icon: Link,       cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',        dot: 'bg-violet-500' },
  VIEW:    { label: 'View',    icon: Eye,        cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',             dot: 'bg-slate-400' },
  CONSUME: { label: 'Consume', icon: Zap,        cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',        dot: 'bg-orange-500' },
};

const ACTION_LEFT_BORDER: Record<string, string> = {
  CREATE:  'border-l-emerald-400',
  UPDATE:  'border-l-blue-400',
  DELETE:  'border-l-red-400',
  MOVE:    'border-l-amber-400',
  ASSIGN:  'border-l-violet-400',
  VIEW:    'border-l-slate-300',
  CONSUME: 'border-l-orange-400',
};

const RESOURCE_CONFIG: Record<string, { icon: any; cls: string }> = {
  USER:        { icon: UserIcon,     cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
  ASSET:       { icon: PackageIcon,  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  VEHICLE:     { icon: CarIcon,      cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' },
  TICKET:      { icon: TicketIcon,   cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
  FOOD_SUPPLY: { icon: ShoppingCart, cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
};

// ── Helper atoms ───────────────────────────────────────────────────────────────

const ActionBadge = ({ action }: { action: string }) => {
  const key = Object.keys(ACTION_CONFIG).find(k => action?.toUpperCase().includes(k)) ?? 'VIEW';
  const cfg = ACTION_CONFIG[key];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Icon className="h-2.5 w-2.5" /> {cfg.label}
    </span>
  );
};

const ResourceBadge = ({ type }: { type: string }) => {
  const cfg = RESOURCE_CONFIG[type?.toUpperCase()] ?? { icon: FileIcon, cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Icon className="h-2.5 w-2.5" /> {type}
    </span>
  );
};

const UserAvatar = ({ email }: { email: string }) => {
  const initials = (email ?? '??').slice(0, 2).toUpperCase();
  const colors = [
    'from-violet-500 to-purple-600', 'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600',
  ];
  const idx = (email?.charCodeAt(0) ?? 0) % colors.length;
  return (
    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}>
      {initials}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export function StaffActivityViewer({
  title = 'Staff Activity',
  description = 'Track and monitor staff actions across the system',
  showExport = true,
  initialFilters = {},
  initialTab = 'all',
  className = '',
}: StaffActivityViewerProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search:       initialFilters.search       ?? '',
    resourceType: initialFilters.resourceType ?? 'ALL',
    dateRange:    initialFilters.dateRange,
    page:         initialFilters.page         ?? 1,
    actionType:   initialFilters.actionType   ?? 'ALL',
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const buildParams = useCallback((overrides: Partial<typeof filters> = {}, extra: Record<string, string> = {}) => {
    const f = { ...filters, ...overrides };
    const q = new URLSearchParams();
    q.append('page',  f.page.toString());
    q.append('limit', pagination.limit.toString());
    q.append('type',  'USER_ACTIVITY');
    if (f.search)                          q.append('action',       f.search);
    if (f.resourceType && f.resourceType !== 'ALL') q.append('resourceType', f.resourceType);
    if (f.dateRange?.from)                 q.append('startDate',    f.dateRange.from.toISOString());
    if (f.dateRange?.to)                   q.append('endDate',      f.dateRange.to.toISOString());
    if (activeTab === 'my')                q.append('userId',       user?.id ?? '');
    if (f.actionType && f.actionType !== 'ALL') q.append('actionType', f.actionType);
    Object.entries(extra).forEach(([k, v]) => q.append(k, v));
    return q;
  }, [filters, pagination.limit, activeTab, user?.id]);

  const fetchActivities = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const q = buildParams({}, forceRefresh ? { forceRefresh: 'true' } : {});
      const res = await fetch(`/api/staff-activity?${q}`);
      if (!res.ok) throw new Error('Failed to fetch staff activities');
      const data = await res.json();
      setActivities(data.activities ?? []);
      setPagination(data.pagination);
    } catch {
      setError('Failed to load staff activities. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchActivities(); }, [filters.page, activeTab]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSearch = () => { setFilters(p => ({ ...p, page: 1 })); fetchActivities(); };

  const handleReset = () => {
    setFilters({ search: '', resourceType: 'ALL', dateRange: undefined, page: 1, actionType: 'ALL' });
    fetchActivities(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActivities(true);
    setIsRefreshing(false);
    toast({ title: 'Refreshed', description: 'Activity log refreshed.' });
  };

  const exportActivities = async () => {
    setIsExporting(true);
    try {
      const q = buildParams({}, { export: 'true', limit: '1000' });
      const res = await fetch(`/api/staff-activity?${q}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'Details'];
      const rows = (data.activities ?? []).map((a: StaffActivity) => [
        new Date(a.timestamp).toLocaleString(),
        a.userEmail,
        a.action,
        a.resourceType,
        a.resourceId ?? '',
        JSON.stringify(a.details ?? {}),
      ].map(cell => typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `staff-activity-${new Date().toISOString().split('T')[0]}.csv`;
      a.style.visibility = 'hidden'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast({ title: 'Export Successful', description: `Exported ${data.activities?.length ?? 0} activities.` });
    } catch {
      toast({ title: 'Export Failed', description: 'Failed to export activities.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Smart pagination ───────────────────────────────────────────────────────

  const buildPageNumbers = () => {
    const { pages } = pagination;
    const cur = filters.page;
    const nums: number[] = [1];
    for (let p = Math.max(2, cur - 1); p <= Math.min(pages - 1, cur + 1); p++) {
      if (!nums.includes(p)) nums.push(p);
    }
    if (pages > 1) nums.push(pages);
    return nums.sort((a, b) => a - b);
  };

  const PaginationRow = () => {
    if (pagination.pages <= 1) return null;
    const nums = buildPageNumbers();
    return (
      <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page {filters.page} of {pagination.pages} · {pagination.total} total
        </p>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setFilters(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                className={filters.page === 1 || loading ? 'pointer-events-none opacity-40' : ''}
              />
            </PaginationItem>
            {nums.map((n, i) => (
              <React.Fragment key={n}>
                {i > 0 && n - nums[i - 1] > 1 && (
                  <PaginationItem><span className="px-2 py-2 text-sm text-muted-foreground">…</span></PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    isActive={n === filters.page}
                    onClick={() => setFilters(p => ({ ...p, page: n }))}
                    className={loading ? 'pointer-events-none' : ''}
                  >{n}</PaginationLink>
                </PaginationItem>
              </React.Fragment>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setFilters(p => ({ ...p, page: Math.min(pagination.pages, p.page + 1) }))}
                className={filters.page === pagination.pages || loading ? 'pointer-events-none opacity-40' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  // ── Filter panel (shared between tabs) ────────────────────────────────────

  const FilterPanel = () => {
    const hasFilters = filters.search || filters.resourceType !== 'ALL' || filters.actionType !== 'ALL' || filters.dateRange?.from;
    return (
      <div className="px-6 py-4 border-b border-border bg-muted/20 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by action…"
              className="pl-9 rounded-xl"
              value={filters.search}
              onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Resource Type */}
          <Select value={filters.resourceType} onValueChange={v => setFilters(p => ({ ...p, resourceType: v }))}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Resource Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Resource Types</SelectItem>
              <SelectItem value="ASSET">Asset</SelectItem>
              <SelectItem value="VEHICLE">Vehicle</SelectItem>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="TICKET">Ticket</SelectItem>
              <SelectItem value="FOOD_SUPPLY">Food Supply</SelectItem>
            </SelectContent>
          </Select>

          {/* Action Type */}
          <Select value={filters.actionType} onValueChange={v => setFilters(p => ({ ...p, actionType: v }))}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Action Types</SelectItem>
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

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Date range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-xl gap-2 text-sm">
                <CalendarIcon className="h-4 w-4" />
                {filters.dateRange?.from
                  ? filters.dateRange.to
                    ? `${format(filters.dateRange.from, 'LLL dd, y')} – ${format(filters.dateRange.to, 'LLL dd, y')}`
                    : format(filters.dateRange.from, 'LLL dd, y')
                  : 'Select date range'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus mode="range"
                defaultMonth={filters.dateRange?.from}
                selected={filters.dateRange}
                onSelect={range => setFilters(p => ({ ...p, dateRange: range }))}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="rounded-xl gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
            <Button size="sm" onClick={handleSearch} className="rounded-xl gap-1.5">
              <Filter className="h-4 w-4" /> Apply Filters
            </Button>
          </div>
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5">
            {filters.search && (
              <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800 px-2.5 py-1 rounded-full font-medium">
                Search: "{filters.search}"
                <button onClick={() => setFilters(p => ({ ...p, search: '' }))} className="ml-0.5 hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filters.resourceType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 px-2.5 py-1 rounded-full font-medium">
                {filters.resourceType}
                <button onClick={() => setFilters(p => ({ ...p, resourceType: 'ALL' }))} className="ml-0.5 hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filters.actionType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800 px-2.5 py-1 rounded-full font-medium">
                {filters.actionType}
                <button onClick={() => setFilters(p => ({ ...p, actionType: 'ALL' }))} className="ml-0.5 hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filters.dateRange?.from && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-full font-medium">
                <CalendarIcon className="h-2.5 w-2.5" />
                {format(filters.dateRange.from, 'LLL dd')}
                {filters.dateRange.to ? ` – ${format(filters.dateRange.to, 'LLL dd')}` : ''}
                <button onClick={() => setFilters(p => ({ ...p, dateRange: undefined }))} className="ml-0.5 hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Activity list ──────────────────────────────────────────────────────────

  const ActivityList = ({ showUser }: { showUser: boolean }) => {
    if (loading) {
      return (
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <p className="font-semibold text-foreground">Error loading activities</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="rounded-xl mt-2" onClick={() => fetchActivities(true)}>
            Try Again
          </Button>
        </div>
      );
    }

    if (activities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Activity className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-muted-foreground">No activities found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          <Button variant="outline" size="sm" className="rounded-xl mt-2" onClick={handleReset}>
            Reset Filters
          </Button>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border">
        {activities.map(activity => {
          const actionKey = Object.keys(ACTION_CONFIG).find(k => activity.action?.toUpperCase().includes(k)) ?? 'VIEW';
          const leftBorder = ACTION_LEFT_BORDER[actionKey] ?? 'border-l-slate-300';

          return (
            <div key={activity.id} className={`flex items-start gap-4 px-6 py-4 hover:bg-muted/20 transition-colors border-l-4 ${leftBorder} group`}>
              {showUser && <UserAvatar email={activity.userEmail} />}

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <ActionBadge action={activity.action} />
                  <ResourceBadge type={activity.resourceType} />
                  {activity.resourceId && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[80px] inline-block">
                            {activity.resourceId}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent><p className="font-mono text-xs">{activity.resourceId}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                <div className="text-sm text-foreground">
                  <ActionDetailsDisplay
                    action={activity.action}
                    resourceType={activity.resourceType}
                    resourceId={activity.resourceId}
                    details={activity.details}
                  />
                </div>

                {showUser && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{activity.userEmail}</p>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                <Clock className="h-3 w-3" />
                {new Date(activity.timestamp).toLocaleString(undefined, {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Toolbar (top-right) ────────────────────────────────────────────────────

  const Toolbar = () => (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleRefresh} disabled={isRefreshing}>
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {t('refresh')}
      </Button>
      {showExport && (
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={exportActivities} disabled={isExporting || activities.length === 0}>
          <Download className="h-4 w-4" />
          {isExporting ? t('exporting') : t('export_csv')}
        </Button>
      )}
    </div>
  );

  // ── Table meta bar ─────────────────────────────────────────────────────────

  const MetaBar = () => (
    <div className="px-6 py-3 flex items-center justify-between border-b border-border bg-muted/10">
      <p className="text-xs text-muted-foreground">
        {loading ? 'Loading…' : `${activities.length} of ${pagination.total} activities`}
      </p>
      <Select
        value={pagination.limit.toString()}
        onValueChange={v => {
          const lim = parseInt(v);
          setPagination(p => ({ ...p, limit: lim }));
          setFilters(p => ({ ...p, page: 1 }));
          fetchActivities();
        }}
      >
        <SelectTrigger className="w-24 h-7 rounded-lg text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10 rows</SelectItem>
          <SelectItem value="20">20 rows</SelectItem>
          <SelectItem value="50">50 rows</SelectItem>
          <SelectItem value="100">100 rows</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-2xl border border-border bg-card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Toolbar />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setFilters(p => ({ ...p, page: 1 })); }}>
        <div className="px-6 pt-4 border-b border-border">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto gap-1">
            {[
              { value: 'all',         label: t('all_activities'),  icon: Activity },
              { value: 'my',          label: t('my_activities'),   icon: UserIcon },
              { value: 'assignments', label: t('my_assignments'),  icon: PackageIcon },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="assignments" className="mt-0 p-6">
          <AssignedItemsList />
        </TabsContent>

        <TabsContent value="all" className="mt-0">
          <FilterPanel />
          <MetaBar />
          <ActivityList showUser={true} />
          <PaginationRow />
        </TabsContent>

        <TabsContent value="my" className="mt-0">
          <FilterPanel />
          <MetaBar />
          <ActivityList showUser={false} />
          <PaginationRow />
        </TabsContent>
      </Tabs>
    </div>
  );
}
