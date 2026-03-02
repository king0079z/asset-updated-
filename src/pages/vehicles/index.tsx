// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { RegisterVehicleDialog } from "@/components/RegisterVehicleDialog";
import { VehicleDetailsDialog } from "@/components/VehicleDetailsDialog";
import { EditVehicleStatusDialog } from "@/components/EditVehicleStatusDialog";
import { AssignVehicleDialog } from "@/components/AssignVehicleDialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Car, Truck, Bus, Bike, Search, RefreshCw, UserPlus, Eye,
  DollarSign, Calendar, Settings, MoreHorizontal, ChevronRight,
  TrendingUp, Package, Gauge, Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
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
  status: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "RETIRED";
  type: "CAR" | "TRUCK" | "VAN" | "BUS" | "MOTORCYCLE";
  color?: string;
  mileage?: number;
  rentalAmount: number;
  imageUrl?: string;
}

const TYPE_ICONS: Record<string, any> = {
  CAR: Car, TRUCK: Truck, BUS: Bus, MOTORCYCLE: Bike, VAN: Car,
};

function StatusBadge({ status }: { status: Vehicle["status"] }) {
  if (status === "AVAILABLE")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Available
      </span>
    );
  if (status === "RENTED")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Rented
      </span>
    );
  if (status === "MAINTENANCE")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Maintenance
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Retired
    </span>
  );
}

function CardHeader({ status, Icon, imageUrl, plateNumber, type }: any) {
  if (status === "AVAILABLE")
    return (
      <div className="relative h-32 bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center overflow-hidden">
        {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-70" /> : <Icon className="h-16 w-16 text-white/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <code className="absolute bottom-2 left-3 text-white text-xs font-mono bg-black/40 backdrop-blur px-2 py-0.5 rounded-md">{plateNumber}</code>
        <span className="absolute top-2 right-2 text-[10px] font-bold text-white/80 bg-black/25 px-1.5 py-0.5 rounded backdrop-blur">{type}</span>
      </div>
    );
  if (status === "RENTED")
    return (
      <div className="relative h-32 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden">
        {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-70" /> : <Icon className="h-16 w-16 text-white/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <code className="absolute bottom-2 left-3 text-white text-xs font-mono bg-black/40 backdrop-blur px-2 py-0.5 rounded-md">{plateNumber}</code>
        <span className="absolute top-2 right-2 text-[10px] font-bold text-white/80 bg-black/25 px-1.5 py-0.5 rounded backdrop-blur">{type}</span>
      </div>
    );
  if (status === "MAINTENANCE")
    return (
      <div className="relative h-32 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden">
        {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-70" /> : <Icon className="h-16 w-16 text-white/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <code className="absolute bottom-2 left-3 text-white text-xs font-mono bg-black/40 backdrop-blur px-2 py-0.5 rounded-md">{plateNumber}</code>
        <span className="absolute top-2 right-2 text-[10px] font-bold text-white/80 bg-black/25 px-1.5 py-0.5 rounded backdrop-blur">{type}</span>
      </div>
    );
  return (
    <div className="relative h-32 bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center overflow-hidden">
      {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-70" /> : <Icon className="h-16 w-16 text-white/20" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <code className="absolute bottom-2 left-3 text-white text-xs font-mono bg-black/40 backdrop-blur px-2 py-0.5 rounded-md">{plateNumber}</code>
      <span className="absolute top-2 right-2 text-[10px] font-bold text-white/80 bg-black/25 px-1.5 py-0.5 rounded backdrop-blur">{type}</span>
    </div>
  );
}

const FILTER_TABS = [
  { key: "ALL", label: "All Vehicles" },
  { key: "AVAILABLE", label: "Available" },
  { key: "RENTED", label: "Rented" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "RETIRED", label: "Retired" },
] as const;

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [yearlyTotal, setYearlyTotal] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const [vRes, cRes] = await Promise.all([
        fetch("/api/vehicles"),
        fetch("/api/vehicles/rental-costs").catch(() => null),
      ]);
      if (!vRes.ok) throw new Error("Failed to fetch vehicles");
      const vData = await vRes.json();
      const cData = cRes?.ok ? await cRes.json() : { monthlyTotal: 0, yearlyTotal: 0 };
      setVehicles(vData.vehicles || []);
      setMonthlyTotal(cData.monthlyTotal || 0);
      setYearlyTotal(cData.yearlyTotal || 0);
    } catch {
      toast({ title: "Error", description: "Failed to load vehicles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.plateNumber.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q);
    const matchFilter = filter === "ALL" || v.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === "AVAILABLE").length,
    rented: vehicles.filter((v) => v.status === "RENTED").length,
    maintenance: vehicles.filter((v) => v.status === "MAINTENANCE").length,
  };
  const utilization = counts.total > 0 ? Math.round((counts.rented / counts.total) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">

        {/* ━━━━━━━━━━━━━━ PAGE HERO ━━━━━━━━━━━━━━ */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
          {/* decorative circles */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-violet-600/15 blur-3xl" />

          <div className="relative p-8">
            {/* title row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                  <Car className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-blue-300 text-xs font-semibold tracking-wide uppercase">Fleet Management</span>
                </div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Vehicle Rentals</h1>
                <p className="text-slate-400 mt-1.5">Manage, assign, and monitor your complete vehicle fleet</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href="/vehicles/rentals">
                  <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20 gap-2">
                    <Calendar className="h-4 w-4" />
                    Active Rentals
                  </Button>
                </Link>
                <Button
                  onClick={fetchVehicles}
                  disabled={loading}
                  size="sm"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 gap-2"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <RegisterVehicleDialog />
              </div>
            </div>

            {/* metric tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                className="bg-white/8 border border-white/12 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-slate-700">
                    <Package className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                  <span className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">Total Fleet</span>
                </div>
                <p className="text-4xl font-black text-white">{loading ? "–" : counts.total}</p>
                <p className="text-slate-500 text-xs mt-1">{utilization}% utilized</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.07 }}
                className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20">
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <span className="text-emerald-400/80 text-[11px] font-medium uppercase tracking-wider">Available</span>
                </div>
                <p className="text-4xl font-black text-emerald-400">{loading ? "–" : counts.available}</p>
                <p className="text-emerald-500/60 text-xs mt-1">Ready to assign</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/20">
                    <DollarSign className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="text-blue-400/80 text-[11px] font-medium uppercase tracking-wider">Monthly Cost</span>
                </div>
                <p className="text-2xl font-black text-blue-400">
                  {loading ? "–" : monthlyTotal ? `QAR ${monthlyTotal.toLocaleString()}` : "—"}
                </p>
                <p className="text-blue-500/60 text-xs mt-1">Fleet expense</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.21 }}
                className="bg-violet-500/10 border border-violet-500/25 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-violet-500/20">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <span className="text-violet-400/80 text-[11px] font-medium uppercase tracking-wider">Yearly Cost</span>
                </div>
                <p className="text-2xl font-black text-violet-400">
                  {loading ? "–" : yearlyTotal ? `QAR ${yearlyTotal.toLocaleString()}` : "—"}
                </p>
                <p className="text-violet-500/60 text-xs mt-1">Annual total</p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━ TOOLBAR ━━━━━━━━━━━━━━ */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* filter pills */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map((tab) => {
              const cnt =
                tab.key === "ALL" ? vehicles.length : vehicles.filter((v) => v.status === tab.key).length;
              const isActive = filter === tab.key;
              if (tab.key === "ALL")
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 shadow-md dark:bg-white dark:text-slate-900 dark:border-white"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    All <span className="ml-1 opacity-60">{cnt}</span>
                  </button>
                );
              if (tab.key === "AVAILABLE")
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                      isActive
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-emerald-500"}`} />
                    Available <span className="ml-0.5 opacity-70">{cnt}</span>
                  </button>
                );
              if (tab.key === "RENTED")
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-blue-500"}`} />
                    Rented <span className="ml-0.5 opacity-70">{cnt}</span>
                  </button>
                );
              if (tab.key === "MAINTENANCE")
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                      isActive
                        ? "bg-amber-600 text-white border-amber-600 shadow-md"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-amber-500"}`} />
                    Maintenance <span className="ml-0.5 opacity-70">{cnt}</span>
                  </button>
                );
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                    isActive
                      ? "bg-slate-600 text-white border-slate-600 shadow-md"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-slate-400"}`} />
                  Retired <span className="ml-0.5 opacity-70">{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, plate, model…"
              className="pl-10 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* result count */}
        <p className="text-xs text-muted-foreground -mt-2">
          Showing <strong>{filtered.length}</strong> of <strong>{vehicles.length}</strong> vehicles
          {search ? ` matching "${search}"` : ""}
        </p>

        {/* ━━━━━━━━━━━━━━ VEHICLE GRID ━━━━━━━━━━━━━━ */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="p-6 rounded-3xl bg-muted mb-5">
              <Car className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No vehicles found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {search || filter !== "ALL"
                ? "Try adjusting your search or filter criteria"
                : "Register your first vehicle to get started"}
            </p>
            {!search && filter === "ALL" && <RegisterVehicleDialog />}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {filtered.map((v, i) => {
                const Icon = TYPE_ICONS[v.type] ?? Car;
                const canAssign = v.status === "AVAILABLE" || v.status === "RENTED";
                return (
                  <motion.div
                    key={v.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04 }}
                    className="group rounded-2xl overflow-hidden border bg-card shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  >
                    <CardHeader
                      status={v.status}
                      Icon={Icon}
                      imageUrl={v.imageUrl}
                      plateNumber={v.plateNumber}
                      type={v.type}
                    />

                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-base leading-tight truncate">{v.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {v.model} · {v.year}
                            {v.color ? ` · ${v.color}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={v.status} />
                      </div>

                      {v.mileage != null && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                          <Gauge className="h-3.5 w-3.5" />
                          <span>{v.mileage.toLocaleString()} km</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div>
                          {v.rentalAmount ? (
                            <p className="text-sm font-bold">
                              QAR {v.rentalAmount.toLocaleString()}
                              <span className="text-xs font-normal text-muted-foreground">/mo</span>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">No rate set</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => {
                              setSelectedVehicle(v);
                              setIsDetailsOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {v.status === "AVAILABLE" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs rounded-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => {
                                setSelectedVehicle(v);
                                setIsAssignOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3" />
                              Assign
                            </Button>
                          )}
                          {v.status === "RENTED" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs rounded-full gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => {
                                setSelectedVehicle(v);
                                setIsAssignOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3" />
                              Reassign
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setIsDetailsOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setIsEditStatusOpen(true);
                                }}
                              >
                                <Settings className="h-4 w-4 mr-2" /> Edit Status
                              </DropdownMenuItem>
                              {canAssign && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedVehicle(v);
                                    setIsAssignOpen(true);
                                  }}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" /> Assign User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/vehicles/${v.id}`} className="flex items-center">
                                  <ChevronRight className="h-4 w-4 mr-2" /> Manage
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <VehicleDetailsDialog
        vehicle={selectedVehicle}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
      <EditVehicleStatusDialog
        vehicle={selectedVehicle}
        open={isEditStatusOpen}
        onOpenChange={setIsEditStatusOpen}
        onStatusUpdated={fetchVehicles}
      />
      <AssignVehicleDialog
        vehicle={selectedVehicle}
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        onAssigned={fetchVehicles}
      />
    </DashboardLayout>
  );
}
