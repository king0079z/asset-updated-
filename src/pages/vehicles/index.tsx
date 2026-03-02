// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { RegisterVehicleDialog } from "@/components/RegisterVehicleDialog";
import { VehicleDetailsDialog } from "@/components/VehicleDetailsDialog";
import { EditVehicleStatusDialog } from "@/components/EditVehicleStatusDialog";
import { AssignVehicleDialog } from "@/components/AssignVehicleDialog";
import { VehicleMobileCard } from "@/components/VehicleMobileCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Car,
  Truck,
  Bus,
  Bike,
  AlertCircle,
  CheckCircle2,
  Wrench,
  XCircle,
  Search,
  Loader2,
  User,
  Calendar,
  TrendingUp,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Settings,
  UserPlus,
  ChevronRight,
  DollarSign,
  Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
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

interface DashboardStats {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
  retired: number;
  monthlyTotal: number;
  yearlyTotal: number;
}

const getVehicleIcon = (type: string, cls = "h-5 w-5") => {
  switch (type) {
    case 'TRUCK':   return <Truck className={cls} />;
    case 'BUS':     return <Bus className={cls} />;
    case 'MOTORCYCLE': return <Bike className={cls} />;
    default:        return <Car className={cls} />;
  }
};

const STATUS_CONFIG = {
  AVAILABLE:   { label: 'Available',    dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  RENTED:      { label: 'Rented',       dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',       icon: <AlertCircle className="h-3.5 w-3.5" /> },
  MAINTENANCE: { label: 'Maintenance',  dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',  icon: <Wrench className="h-3.5 w-3.5" /> },
  RETIRED:     { label: 'Retired',      dot: 'bg-red-400',     pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',            icon: <XCircle className="h-3.5 w-3.5" /> },
};

const STATUS_FILTERS = ['ALL', 'AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED'] as const;

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, available: 0, rented: 0, maintenance: 0, retired: 0, monthlyTotal: 0, yearlyTotal: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const { toast } = useToast();

  useEffect(() => { fetchVehicles(); }, []);

  useEffect(() => {
    let result = vehicles;
    if (activeFilter !== 'ALL') result = result.filter(v => v.status === activeFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.plateNumber.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        (v.color || '').toLowerCase().includes(q)
      );
    }
    setFilteredVehicles(result);
  }, [searchTerm, activeFilter, vehicles]);

  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      const [vehiclesRes, costsRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/vehicles/rental-costs').catch(() => null),
      ]);
      if (!vehiclesRes.ok) throw new Error('Failed to fetch vehicles');
      const vehiclesData = await vehiclesRes.json();
      const costsData = costsRes?.ok ? await costsRes.json() : { monthlyTotal: 0, yearlyTotal: 0 };
      const vArr: Vehicle[] = vehiclesData.vehicles || [];
      setVehicles(vArr);
      setFilteredVehicles(vArr);
      setStats({
        total: vArr.length,
        available: vArr.filter(v => v.status === 'AVAILABLE').length,
        rented: vArr.filter(v => v.status === 'RENTED').length,
        maintenance: vArr.filter(v => v.status === 'MAINTENANCE').length,
        retired: vArr.filter(v => v.status === 'RETIRED').length,
        monthlyTotal: costsData.monthlyTotal || 0,
        yearlyTotal: costsData.yearlyTotal || 0,
      });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load vehicles', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const utilizationRate = stats.total > 0 ? Math.round((stats.rented / stats.total) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-8">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Fleet Management</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-11">Manage and assign your organization's vehicle fleet</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link href="/vehicles/rentals" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full gap-2">
                <Calendar className="h-4 w-4" />
                Active Rentals
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={fetchVehicles} disabled={isLoading} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <RegisterVehicleDialog />
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="pt-6 pb-4">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              {/* Total Vehicles */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Fleet</p>
                        <p className="text-3xl font-bold mt-1">{stats.total}</p>
                        <p className="text-xs text-muted-foreground mt-1">{stats.retired > 0 ? `${stats.retired} retired` : 'All active'}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700">
                        <Car className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                      </div>
                    </div>
                    {/* Mini utilization bar */}
                    <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${utilizationRate}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{utilizationRate}% utilization</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Available */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-900/30">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Available</p>
                        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{stats.available}</p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">Ready to assign</p>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-1">
                      {stats.available > 0 && [...Array(Math.min(stats.available, 6))].map((_, i) => (
                        <div key={i} className="h-1.5 flex-1 rounded-full bg-emerald-400 dark:bg-emerald-500" />
                      ))}
                      {stats.available < 6 && [...Array(Math.max(0, 6 - stats.available))].map((_, i) => (
                        <div key={i} className="h-1.5 flex-1 rounded-full bg-emerald-200 dark:bg-emerald-800/50" />
                      ))}
                    </div>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                      {stats.rented} currently rented
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Monthly Cost */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Monthly Cost</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 truncate">
                          {stats.monthlyTotal > 0 ? `QAR ${stats.monthlyTotal.toLocaleString()}` : '—'}
                        </p>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Fleet rental expense</p>
                      </div>
                      <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 shrink-0">
                        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <TrendingUp className="h-3 w-3" />
                      <span>QAR {stats.yearlyTotal.toLocaleString()} / year</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Maintenance */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/30">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">In Maintenance</p>
                        <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1">{stats.maintenance}</p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">Under repair / service</p>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                        <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Activity className="h-3 w-3" />
                      <span>
                        {stats.maintenance === 0 ? 'All vehicles operational' : `${stats.maintenance} offline`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </div>

        {/* ── Vehicle List Card ── */}
        <Card className="shadow-sm border overflow-hidden">
          {/* Toolbar */}
          <CardHeader className="pb-0 border-b">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base">Vehicles</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {isLoading ? 'Loading...' : `${filteredVehicles.length} of ${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}${activeFilter !== 'ALL' ? ` · ${STATUS_CONFIG[activeFilter]?.label || activeFilter}` : ''}${searchTerm ? ` · "${searchTerm}"` : ''}`}
                </CardDescription>
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, plate, model…"
                  className="pl-9 h-9 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-1.5 pb-3 overflow-x-auto scrollbar-hide">
              {STATUS_FILTERS.map(f => {
                const count = f === 'ALL' ? vehicles.length : vehicles.filter(v => v.status === f).length;
                const isActive = activeFilter === f;
                const cfg = f !== 'ALL' ? STATUS_CONFIG[f] : null;
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                      isActive
                        ? f === 'ALL'
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : `${cfg?.pill} border shadow-sm`
                        : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:border-muted'
                    }`}
                  >
                    {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                    {f === 'ALL' ? 'All' : cfg?.label}
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-muted'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                ))}
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Car className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No vehicles found</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  {searchTerm || activeFilter !== 'ALL'
                    ? 'Try adjusting your search or filter'
                    : 'Add your first vehicle to get started'}
                </p>
                {!searchTerm && activeFilter === 'ALL' && <RegisterVehicleDialog />}
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y">
                  <AnimatePresence>
                    {filteredVehicles.map((vehicle, index) => (
                      <motion.div
                        key={vehicle.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <VehicleMobileCard
                          vehicle={vehicle}
                          onViewDetails={() => { setSelectedVehicle(vehicle); setIsDetailsOpen(true); }}
                          onEditStatus={() => { setSelectedVehicle(vehicle); setIsEditStatusOpen(true); }}
                          onAssignUser={() => { setSelectedVehicle(vehicle); setIsAssignDialogOpen(true); }}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="pl-6 font-semibold text-xs uppercase tracking-wide">Vehicle</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide">Plate</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide">Status</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide">Monthly Rate</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredVehicles.map((vehicle, index) => {
                          const cfg = STATUS_CONFIG[vehicle.status];
                          return (
                            <motion.tr
                              key={vehicle.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className="group border-b last:border-0 hover:bg-muted/40 transition-colors"
                            >
                              {/* Vehicle info */}
                              <TableCell className="pl-6 py-4">
                                <div className="flex items-center gap-3">
                                  {vehicle.imageUrl ? (
                                    <img src={vehicle.imageUrl} alt={vehicle.name} className="h-10 w-10 rounded-xl object-cover ring-2 ring-border" />
                                  ) : (
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center ring-1 ring-border">
                                      {getVehicleIcon(vehicle.type, "h-5 w-5 text-muted-foreground")}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">{vehicle.name}</p>
                                    <p className="text-xs text-muted-foreground">{vehicle.type} · {vehicle.year}{vehicle.color ? ` · ${vehicle.color}` : ''}</p>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Plate */}
                              <TableCell className="py-4">
                                <code className="text-xs font-mono bg-muted px-2.5 py-1 rounded-md border">
                                  {vehicle.plateNumber}
                                </code>
                              </TableCell>

                              {/* Status */}
                              <TableCell className="py-4">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg?.pill}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                                  {cfg?.label || vehicle.status}
                                </span>
                              </TableCell>

                              {/* Rate */}
                              <TableCell className="py-4">
                                <span className="text-sm font-semibold">QAR {(vehicle.rentalAmount || 0).toLocaleString()}</span>
                                <span className="text-xs text-muted-foreground"> /mo</span>
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="py-4 pr-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-xs gap-1.5"
                                    onClick={() => { setSelectedVehicle(vehicle); setIsDetailsOpen(true); }}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    View
                                  </Button>

                                  {vehicle.status === 'AVAILABLE' && (
                                    <Button
                                      size="sm"
                                      className="h-8 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={() => { setSelectedVehicle(vehicle); setIsAssignDialogOpen(true); }}
                                    >
                                      <UserPlus className="h-3.5 w-3.5" />
                                      Assign
                                    </Button>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      <DropdownMenuItem onClick={() => { setSelectedVehicle(vehicle); setIsDetailsOpen(true); }}>
                                        <Eye className="h-4 w-4 mr-2" /> View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => { setSelectedVehicle(vehicle); setIsEditStatusOpen(true); }}>
                                        <Settings className="h-4 w-4 mr-2" /> Edit Status
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => { setSelectedVehicle(vehicle); setIsAssignDialogOpen(true); }}>
                                        <UserPlus className="h-4 w-4 mr-2" /> Assign User
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild>
                                        <Link href={`/vehicles/${vehicle.id}`} className="flex items-center">
                                          <ChevronRight className="h-4 w-4 mr-2" /> Manage
                                        </Link>
                                      </DropdownMenuItem>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <VehicleDetailsDialog vehicle={selectedVehicle} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
      <EditVehicleStatusDialog vehicle={selectedVehicle} open={isEditStatusOpen} onOpenChange={setIsEditStatusOpen} onStatusUpdated={fetchVehicles} />
      <AssignVehicleDialog vehicle={selectedVehicle} open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen} onAssigned={fetchVehicles} />
    </DashboardLayout>
  );
}
