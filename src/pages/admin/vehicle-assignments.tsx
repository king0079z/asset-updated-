// @ts-nocheck
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AssignVehicleDialog } from "@/components/AssignVehicleDialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Car, Truck, Bus, Bike, User, Users, Search, RefreshCw,
  CheckCircle2, Wrench, XCircle, UserPlus, Calendar,
  ArrowLeftRight, Eye, Clock, Activity, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useTranslation } from "@/contexts/TranslationContext";
import { motion, AnimatePresence } from "framer-motion";

interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: number;
  plateNumber: string;
  status: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "RETIRED";
  type: "CAR" | "TRUCK" | "VAN" | "BUS" | "MOTORCYCLE";
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
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
}

const TYPE_ICONS: Record<string, any> = {
  CAR: Car,
  TRUCK: Truck,
  BUS: Bus,
  MOTORCYCLE: Bike,
  VAN: Car,
};

/* ── static vehicle header colours ── */
function VehicleCardTop({ v }: { v: Vehicle }) {
  const Icon = TYPE_ICONS[v.type] ?? Car;
  let bg = "bg-gradient-to-br from-slate-400 to-slate-600";
  if (v.status === "AVAILABLE") bg = "bg-gradient-to-br from-emerald-500 to-green-600";
  else if (v.status === "RENTED") bg = "bg-gradient-to-br from-blue-500 to-indigo-600";
  else if (v.status === "MAINTENANCE") bg = "bg-gradient-to-br from-amber-500 to-orange-600";

  return (
    <div className={`relative h-24 ${bg} flex items-center justify-center overflow-hidden`}>
      {v.imageUrl ? (
        <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover opacity-75" />
      ) : (
        <Icon className="h-12 w-12 text-white/20" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <code className="absolute bottom-2 left-3 text-white text-xs font-mono bg-black/35 backdrop-blur px-2 py-0.5 rounded">
        {v.plateNumber}
      </code>
      <span className="absolute top-2 right-2 text-[10px] font-bold text-white/80 bg-black/25 px-1.5 py-0.5 rounded">
        {v.type}
      </span>
    </div>
  );
}

function VehicleStatusPill({ status }: { status: Vehicle["status"] }) {
  if (status === "AVAILABLE")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Available
      </span>
    );
  if (status === "RENTED")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Rented
      </span>
    );
  if (status === "MAINTENANCE")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Maintenance
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Retired
    </span>
  );
}

function VehicleIconBox({ vehicle }: { vehicle: Vehicle }) {
  const Icon = TYPE_ICONS[vehicle?.type] ?? Car;
  let bg = "bg-gradient-to-br from-slate-400 to-slate-600";
  if (vehicle?.status === "AVAILABLE") bg = "bg-gradient-to-br from-emerald-500 to-green-600";
  else if (vehicle?.status === "RENTED") bg = "bg-gradient-to-br from-blue-500 to-indigo-600";
  else if (vehicle?.status === "MAINTENANCE") bg = "bg-gradient-to-br from-amber-500 to-orange-600";
  return (
    <div className={`h-12 w-12 rounded-xl ${bg} flex items-center justify-center shrink-0 shadow`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
  );
}

const FILTERS = ["ALL", "AVAILABLE", "RENTED", "MAINTENANCE", "RETIRED"] as const;

export default function VehicleAssignmentsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [search, setSearch] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vRes, uRes, rRes] = await Promise.all([
        fetch("/api/vehicles"),
        fetch("/api/planner/users"),
        fetch("/api/vehicles/rentals"),
      ]);
      const vData = vRes.ok ? await vRes.json() : { vehicles: [] };
      const uData = uRes.ok ? await uRes.json() : { users: [] };
      const rData = rRes.ok ? await rRes.json().catch(() => ({ rentals: [] })) : { rentals: [] };
      const vArr: Vehicle[] = vData.vehicles || [];
      const uArr: StaffUser[] = uData.users || [];
      setVehicles(vArr);
      setAssignments(
        (rData.rentals || []).map((r: any) => ({
          id: r.id,
          vehicle: vArr.find((v) => v.id === r.vehicleId) || ({} as Vehicle),
          user: uArr.find((u) => u.id === r.userId) || ({} as StaffUser),
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
        }))
      );
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.plateNumber.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q);
    const matchFilter = filter === "ALL" || v.status === filter;
    return matchSearch && matchFilter;
  });

  const filteredAssignments = assignments.filter((a) => {
    if (!assignSearch) return true;
    const q = assignSearch.toLowerCase();
    return (
      (a.user?.email || "").toLowerCase().includes(q) ||
      (a.user?.name || "").toLowerCase().includes(q) ||
      (a.vehicle?.name || "").toLowerCase().includes(q) ||
      (a.vehicle?.plateNumber || "").toLowerCase().includes(q)
    );
  });

  const counts = {
    available: vehicles.filter((v) => v.status === "AVAILABLE").length,
    rented: vehicles.filter((v) => v.status === "RENTED").length,
    maintenance: vehicles.filter((v) => v.status === "MAINTENANCE").length,
    activeAssignments: assignments.filter((a) => a.status === "ACTIVE").length,
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6 pb-10">

          {/* ━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━ */}
          <div className="relative overflow-hidden rounded-3xl shadow-2xl" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%)" }}>
            <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5 blur-2xl" />

            <div className="relative p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
            <div>
                  <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-3 py-1 mb-3">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-200" />
                    <span className="text-indigo-200 text-xs font-semibold tracking-wide uppercase">Fleet Operations</span>
                  </div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight">Vehicle Assignments</h1>
                  <p className="text-indigo-200/80 mt-1.5">Assign and manage vehicles across your staff members</p>
            </div>
            <Button 
              onClick={fetchData} 
                  disabled={loading}
              variant="outline"
                  size="sm"
                  className="border-white/25 bg-white/15 text-white hover:bg-white/25 gap-2 shrink-0"
            >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
            </Button>
              </div>

              {/* metric tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Available",
                    value: counts.available,
                    icon: CheckCircle2,
                    cls: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300",
                  },
                  {
                    label: "Rented",
                    value: counts.rented,
                    icon: Activity,
                    cls: "bg-blue-500/15 border-blue-400/30 text-blue-300",
                  },
                  {
                    label: "Maintenance",
                    value: counts.maintenance,
                    icon: Wrench,
                    cls: "bg-amber-500/15 border-amber-400/30 text-amber-300",
                  },
                  {
                    label: "Active Assignments",
                    value: counts.activeAssignments,
                    icon: Users,
                    cls: "bg-violet-500/15 border-violet-400/30 text-violet-300",
                  },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={`rounded-2xl p-4 border ${s.cls}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{s.label}</span>
                    </div>
                    <p className="text-4xl font-black text-white">{loading ? "–" : s.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━ TABS ━━━━━━━━━━━━━━ */}
          <Tabs defaultValue="vehicles">
            <TabsList className="h-12 p-1 gap-1 bg-muted/60 rounded-xl">
              <TabsTrigger
                value="vehicles"
                className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-sm"
              >
                <Car className="h-4 w-4" />
                Fleet Vehicles
                {counts.available > 0 && !loading && (
                  <span className="ml-1 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {counts.available}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="assignments"
                className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-sm"
              >
                <Users className="h-4 w-4" />
                Current Assignments
                {counts.activeAssignments > 0 && !loading && (
                  <span className="ml-1 bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {counts.activeAssignments}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            
            {/* ── VEHICLES TAB ── */}
            <TabsContent value="vehicles" className="mt-5">
              {/* toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
                <div className="flex gap-2 flex-wrap">
                  {FILTERS.map((f) => {
                    const cnt = f === "ALL" ? vehicles.length : vehicles.filter((v) => v.status === f).length;
                    const isActive = filter === f;
                    if (f === "ALL")
                      return (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            isActive
                              ? "bg-slate-900 text-white border-slate-900 shadow dark:bg-white dark:text-slate-900 dark:border-white"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          All <span className="opacity-60 ml-1">{cnt}</span>
                        </button>
                      );
                    if (f === "AVAILABLE")
                      return (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            isActive
                              ? "bg-emerald-600 text-white border-emerald-600 shadow"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-emerald-500"}`} />
                          Available <span className="opacity-70 ml-0.5">{cnt}</span>
                        </button>
                      );
                    if (f === "RENTED")
                      return (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            isActive
                              ? "bg-blue-600 text-white border-blue-600 shadow"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-blue-500"}`} />
                          Rented <span className="opacity-70 ml-0.5">{cnt}</span>
                        </button>
                      );
                    if (f === "MAINTENANCE")
                      return (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            isActive
                              ? "bg-amber-600 text-white border-amber-600 shadow"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-amber-500"}`} />
                          Maintenance <span className="opacity-70 ml-0.5">{cnt}</span>
                        </button>
                      );
                    return (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                          isActive
                            ? "bg-slate-600 text-white border-slate-600 shadow"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-slate-400"}`} />
                        Retired <span className="opacity-70 ml-0.5">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                    placeholder="Search vehicles…"
                    className="pl-10 h-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-56 rounded-2xl" />
                  ))}
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="p-6 rounded-3xl bg-muted mb-5">
                    <Car className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No vehicles found</h3>
                  <p className="text-sm text-muted-foreground">
                    {search || filter !== "ALL" ? "Try adjusting filters" : "No vehicles registered"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <AnimatePresence>
                    {filteredVehicles.map((v, i) => {
                      const canAssign = v.status === "AVAILABLE" || v.status === "RENTED";
                      return (
                        <motion.div
                          key={v.id}
                          layout
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-2xl overflow-hidden border bg-card shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                        >
                          <VehicleCardTop v={v} />
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm leading-tight truncate">{v.name}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {v.model} · {v.year}
                                  {v.color ? ` · ${v.color}` : ""}
                                </p>
                              </div>
                              <VehicleStatusPill status={v.status} />
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t">
                              <span className="text-xs text-muted-foreground">
                                {v.rentalAmount ? (
                                  <>
                                    <span className="font-bold text-foreground">
                                      QAR {v.rentalAmount.toLocaleString()}
                                    </span>
                                    /mo
                                  </>
                                ) : (
                                  "No rate set"
                                )}
                              </span>
                              <div className="flex gap-1.5">
                                <Link href={`/vehicles/${v.id}`}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                                {v.status === "AVAILABLE" && (
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 text-xs rounded-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => {
                                      setSelectedVehicle(v);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <UserPlus className="h-3 w-3" /> Assign
                                  </Button>
                                )}
                                {v.status === "RENTED" && (
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 text-xs rounded-full gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => {
                                      setSelectedVehicle(v);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <ArrowLeftRight className="h-3 w-3" /> Reassign
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* ── ASSIGNMENTS TAB ── */}
            <TabsContent value="assignments" className="mt-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{filteredAssignments.length}</span> assignment
                  {filteredAssignments.length !== 1 ? "s" : ""} ·{" "}
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {counts.activeAssignments} active
                  </span>
                </p>
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search user or vehicle…"
                    className="pl-10 h-10"
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                  />
                          </div>
                        </div>

              {loading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-2xl" />
                      ))}
                    </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="p-6 rounded-3xl bg-muted mb-5">
                    <Users className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No assignments found</h3>
                  <p className="text-sm text-muted-foreground">
                    {assignSearch ? "Try adjusting your search" : "No vehicles are currently assigned to staff"}
                      </p>
                    </div>
                  ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredAssignments.map((a, i) => {
                      const isActive = a.status === "ACTIVE";
                      const daysActive = a.startDate
                        ? Math.floor((Date.now() - new Date(a.startDate).getTime()) / 86400000)
                        : 0;
                      return (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`rounded-2xl border bg-card p-5 transition-all hover:shadow-lg ${
                            isActive
                              ? "ring-1 ring-emerald-200 dark:ring-emerald-800"
                              : "opacity-70"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            {/* User */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shrink-0 shadow">
                                {(a.user?.name || a.user?.email || "?")[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">
                                  {a.user?.name || a.user?.email || "Unknown"}
                                </p>
                                {a.user?.name && (
                                  <p className="text-xs text-muted-foreground truncate">{a.user.email}</p>
                                )}
                                <div className="mt-1">
                                  {isActive ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Active · {daysActive}d
                                    </span>
                                  ) : (
                                    <span className="inline-block text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">
                                      {a.status.toLowerCase()}
                                    </span>
                                  )}
                                    </div>
                                  </div>
                                </div>

                            {/* Arrow */}
                            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-muted border">
                              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                                </div>

                            {/* Vehicle */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <VehicleIconBox vehicle={a.vehicle} />
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">
                                  {a.vehicle?.name || "Unknown Vehicle"}
                                </p>
                                <code className="text-xs text-muted-foreground font-mono">
                                  {a.vehicle?.plateNumber || "—"}
                                </code>
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {new Date(a.startDate).toLocaleDateString()} →{" "}
                                    {a.endDate ? new Date(a.endDate).toLocaleDateString() : "Open-ended"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                              {isActive && a.vehicle?.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 gap-1.5 text-xs border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                  onClick={() => {
                                    setSelectedVehicle(a.vehicle);
                                    setDialogOpen(true);
                                  }}
                                >
                                  <ArrowLeftRight className="h-3.5 w-3.5" /> Reassign
                                </Button>
                              )}
                              {a.vehicle?.id && (
                                <Link href={`/vehicles/${a.vehicle.id}`}>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                    </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                    </div>
                  )}
            </TabsContent>
          </Tabs>
        </div>

        <AssignVehicleDialog
          vehicle={selectedVehicle}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAssigned={fetchData}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
