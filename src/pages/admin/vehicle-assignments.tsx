import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AssignVehicleDialog } from "@/components/AssignVehicleDialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Car, Truck, Bus, Bike, User, Users, Search, RefreshCw,
  CheckCircle2, AlertCircle, Wrench, XCircle, UserPlus, Calendar,
  ArrowLeftRight, Eye, MoreHorizontal, Clock, Activity,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { formatUserId } from "@/util/user";
import { useTranslation } from "@/contexts/TranslationContext";
import { motion, AnimatePresence } from "framer-motion";

interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: number;
  plateNumber: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
  type: 'CAR' | 'TRUCK' | 'VAN' | 'BUS' | 'MOTORCYCLE';
  color?: string;
  mileage?: number;
  rentalAmount: number;
  imageUrl?: string;
}

interface StaffUser {
  id: string;
  email: string;
  name?: string;
}

interface VehicleAssignment {
  id: string;
  vehicle: Vehicle;
  user: StaffUser;
  startDate: string;
  endDate?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

const VEHICLE_TYPE_ICON: Record<string, JSX.Element> = {
  CAR: <Car className="h-5 w-5" />,
  TRUCK: <Truck className="h-5 w-5" />,
  BUS: <Bus className="h-5 w-5" />,
  MOTORCYCLE: <Bike className="h-5 w-5" />,
};
const getVehicleIcon = (type: string, cls = "h-5 w-5") =>
  VEHICLE_TYPE_ICON[type] ?? <Car className={cls} />;

const VEHICLE_STATUS = {
  AVAILABLE:   { label: 'Available',   dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' },
  RENTED:      { label: 'Rented',      dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  MAINTENANCE: { label: 'Maintenance', dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
  RETIRED:     { label: 'Retired',     dot: 'bg-red-400',     pill: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
};

const ASSIGNMENT_STATUS = {
  ACTIVE:    { label: 'Active',    pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' },
  COMPLETED: { label: 'Completed', pill: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  CANCELLED: { label: 'Cancelled', pill: 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
};

const STATUS_FILTERS = ['ALL', 'AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED'] as const;

export default function VehicleAssignmentsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    let result = vehicles;
    if (statusFilter !== 'ALL') result = result.filter(v => v.status === statusFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.plateNumber.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q)
      );
    }
    setFilteredVehicles(result);
  }, [searchTerm, statusFilter, vehicles]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [vehiclesRes, usersRes, rentalsRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/planner/users'),
        fetch('/api/vehicles/rentals'),
      ]);

      const vehiclesData = vehiclesRes.ok ? await vehiclesRes.json() : { vehicles: [] };
      const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
      const rentalsData = rentalsRes.ok ? await rentalsRes.json().catch(() => ({ rentals: [] })) : { rentals: [] };

      const vArr: Vehicle[] = vehiclesData.vehicles || [];
      const uArr: StaffUser[] = usersData.users || [];
      setVehicles(vArr);
      setFilteredVehicles(vArr);

      const mapped: VehicleAssignment[] = (rentalsData.rentals || []).map((r: any) => ({
        id: r.id,
        vehicle: vArr.find(v => v.id === r.vehicleId) || ({} as Vehicle),
        user: uArr.find(u => u.id === r.userId) || ({} as StaffUser),
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
      }));
      setAssignments(mapped);
    } catch {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Stats
  const available = vehicles.filter(v => v.status === 'AVAILABLE').length;
  const rented = vehicles.filter(v => v.status === 'RENTED').length;
  const maintenance = vehicles.filter(v => v.status === 'MAINTENANCE').length;
  const activeAssignments = assignments.filter(a => a.status === 'ACTIVE').length;

  const filteredAssignments = assignments.filter(a => {
    if (!assignSearch.trim()) return true;
    const q = assignSearch.toLowerCase();
    return (
      (a.user?.email || '').toLowerCase().includes(q) ||
      (a.user?.name || '').toLowerCase().includes(q) ||
      (a.vehicle?.name || '').toLowerCase().includes(q) ||
      (a.vehicle?.plateNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6 pb-8">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Vehicle Assignments</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-11">Assign and manage vehicle assignments across your staff</p>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm" className="gap-2" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Available',        value: available,         icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' },
              { label: 'Currently Rented', value: rented,            icon: <Activity className="h-4 w-4 text-blue-500" />,        color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' },
              { label: 'In Maintenance',   value: maintenance,       icon: <Wrench className="h-4 w-4 text-amber-500" />,         color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' },
              { label: 'Active Assignments', value: activeAssignments, icon: <Users className="h-4 w-4 text-violet-500" />,       color: 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800' },
            ].map((s, i) => (
              <div key={i} className={`flex items-center gap-3 p-4 rounded-xl border ${s.color}`}>
                <div className="p-2 rounded-lg bg-white/60 dark:bg-black/20">{s.icon}</div>
                <div>
                  <p className="text-xl font-bold leading-none">{isLoading ? '—' : s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main Tabs ── */}
          <Tabs defaultValue="vehicles" className="w-full">
            <TabsList className="h-10 p-1 gap-1">
              <TabsTrigger value="vehicles" className="gap-1.5 text-sm">
                <Car className="h-3.5 w-3.5" />
                Available Vehicles
                {available > 0 && (
                  <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                    {available}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-1.5 text-sm">
                <Users className="h-3.5 w-3.5" />
                Current Assignments
                {activeAssignments > 0 && (
                  <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                    {activeAssignments}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* VEHICLES TAB */}
            <TabsContent value="vehicles" className="mt-4">
              <Card className="shadow-sm overflow-hidden">
                <CardHeader className="pb-0 border-b">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-4">
                    <div>
                      <CardTitle className="text-base">Fleet Overview</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {isLoading ? 'Loading…' : `${filteredVehicles.length} of ${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}${statusFilter !== 'ALL' ? ` · ${VEHICLE_STATUS[statusFilter]?.label || statusFilter}` : ''}${searchTerm ? ` · "${searchTerm}"` : ''}`}
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search name, plate, model…"
                        className="pl-9 h-9 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Status filter pills */}
                  <div className="flex gap-1.5 pb-3 overflow-x-auto scrollbar-hide">
                    {STATUS_FILTERS.map(f => {
                      const count = f === 'ALL' ? vehicles.length : vehicles.filter(v => v.status === f).length;
                      const isActive = statusFilter === f;
                      const cfg = f !== 'ALL' ? VEHICLE_STATUS[f] : null;
                      return (
                        <button
                          key={f}
                          onClick={() => setStatusFilter(f)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                            isActive
                              ? f === 'ALL'
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : `${cfg?.pill} shadow-sm`
                              : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:border-muted'
                          }`}
                        >
                          {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                          {f === 'ALL' ? 'All' : cfg?.label}
                          <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 dark:bg-black/20">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6 space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                          <Skeleton className="h-10 w-10 rounded-xl" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-8 w-28 rounded-md" />
                        </div>
                      ))}
                    </div>
                  ) : filteredVehicles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Car className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold mb-1">No vehicles found</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        {searchTerm || statusFilter !== 'ALL' ? 'Try adjusting your search or filter' : 'No vehicles have been registered yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wide">Vehicle</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide">Plate</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide">Rate / mo</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-right pr-6">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {filteredVehicles.map((vehicle, index) => {
                              const vcfg = VEHICLE_STATUS[vehicle.status];
                              const canAssign = vehicle.status === 'AVAILABLE' || vehicle.status === 'RENTED';
                              return (
                                <motion.tr
                                  key={vehicle.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: index * 0.03 }}
                                  className="group border-b last:border-0 hover:bg-muted/40 transition-colors"
                                >
                                  <TableCell className="pl-6 py-4">
                                    <div className="flex items-center gap-3">
                                      {vehicle.imageUrl ? (
                                        <img src={vehicle.imageUrl} alt={vehicle.name} className="h-10 w-10 rounded-xl object-cover ring-1 ring-border" />
                                      ) : (
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center ring-1 ring-border">
                                          {getVehicleIcon(vehicle.type, "h-5 w-5 text-muted-foreground")}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="font-semibold text-sm">{vehicle.name}</p>
                                        <p className="text-xs text-muted-foreground">{vehicle.type} · {vehicle.year}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <code className="text-xs font-mono bg-muted px-2.5 py-1 rounded-md border">{vehicle.plateNumber}</code>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${vcfg?.pill}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${vcfg?.dot}`} />
                                      {vcfg?.label || vehicle.status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <span className="text-sm font-semibold">
                                      {vehicle.rentalAmount ? `QAR ${vehicle.rentalAmount.toLocaleString()}` : '—'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4 pr-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {canAssign && (
                                        <Button
                                          size="sm"
                                          className={`h-8 px-3 text-xs gap-1.5 ${vehicle.status === 'AVAILABLE' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                          onClick={() => { setSelectedVehicle(vehicle); setIsAssignDialogOpen(true); }}
                                        >
                                          <UserPlus className="h-3.5 w-3.5" />
                                          {vehicle.status === 'RENTED' ? 'Reassign' : 'Assign'}
                                        </Button>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                          <DropdownMenuItem asChild>
                                            <Link href={`/vehicles/${vehicle.id}`} className="flex items-center gap-2">
                                              <Eye className="h-4 w-4" /> View Details
                                            </Link>
                                          </DropdownMenuItem>
                                          {canAssign && (
                                            <DropdownMenuItem onClick={() => { setSelectedVehicle(vehicle); setIsAssignDialogOpen(true); }}>
                                              <UserPlus className="h-4 w-4 mr-2" />
                                              {vehicle.status === 'RENTED' ? 'Reassign' : 'Assign'}
                                            </DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>
                                </motion.tr>
                              );
                            })}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ASSIGNMENTS TAB */}
            <TabsContent value="assignments" className="mt-4">
              <Card className="shadow-sm overflow-hidden">
                <CardHeader className="pb-4 border-b">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Current Assignments</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {isLoading ? 'Loading…' : `${filteredAssignments.length} assignment${filteredAssignments.length !== 1 ? 's' : ''} · ${activeAssignments} active`}
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search user or vehicle…"
                        className="pl-9 h-9 text-sm"
                        value={assignSearch}
                        onChange={e => setAssignSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6 space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : filteredAssignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold mb-1">No assignments found</h3>
                      <p className="text-sm text-muted-foreground">
                        {assignSearch ? 'Try adjusting your search' : 'No vehicles are currently assigned'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredAssignments.map((assignment, index) => {
                        const acfg = ASSIGNMENT_STATUS[assignment.status] || ASSIGNMENT_STATUS.ACTIVE;
                        const daysActive = assignment.startDate
                          ? Math.floor((Date.now() - new Date(assignment.startDate).getTime()) / 86400000)
                          : 0;
                        return (
                          <motion.div
                            key={assignment.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.04 }}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors group"
                          >
                            {/* User */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/40 dark:to-violet-800/40 flex items-center justify-center ring-1 ring-border shrink-0">
                                <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{assignment.user?.name || assignment.user?.email || 'Unknown User'}</p>
                                {assignment.user?.name && (
                                  <p className="text-xs text-muted-foreground truncate">{assignment.user.email}</p>
                                )}
                              </div>
                            </div>

                            {/* Arrow */}
                            <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />

                            {/* Vehicle */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center ring-1 ring-border shrink-0">
                                <Car className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{assignment.vehicle?.name || 'Unknown Vehicle'}</p>
                                <code className="text-[10px] text-muted-foreground font-mono">{assignment.vehicle?.plateNumber || '—'}</code>
                              </div>
                            </div>

                            {/* Dates */}
                            <div className="text-xs text-muted-foreground shrink-0 hidden lg:block">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(assignment.startDate).toLocaleDateString()}</span>
                                <span className="opacity-50">→</span>
                                <span>{assignment.endDate ? new Date(assignment.endDate).toLocaleDateString() : 'Open-ended'}</span>
                              </div>
                              {assignment.status === 'ACTIVE' && (
                                <div className="flex items-center gap-1 mt-0.5 text-emerald-600 dark:text-emerald-400">
                                  <Clock className="h-3 w-3" />
                                  <span>{daysActive} day{daysActive !== 1 ? 's' : ''} active</span>
                                </div>
                              )}
                            </div>

                            {/* Status */}
                            <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${acfg.pill}`}>
                              {acfg.label}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {assignment.status === 'ACTIVE' && assignment.vehicle?.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-3 text-xs gap-1.5 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/30"
                                  onClick={() => { setSelectedVehicle(assignment.vehicle); setIsAssignDialogOpen(true); }}
                                >
                                  <ArrowLeftRight className="h-3.5 w-3.5" />
                                  Reassign
                                </Button>
                              )}
                              {assignment.vehicle?.id && (
                                <Link href={`/vehicles/${assignment.vehicle.id}`}>
                                  <Button variant="ghost" size="sm" className="h-8 px-3 text-xs gap-1">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <AssignVehicleDialog
          vehicle={selectedVehicle}
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          onAssigned={fetchData}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
