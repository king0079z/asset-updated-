// @ts-nocheck
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  MapPin, Car, AlertTriangle, RefreshCw, BarChart3, Wifi, WifiOff,
  HardDrive, Search, CheckCircle2, Wrench, XCircle, AlertCircle,
  Activity, Navigation, Satellite, Clock, Truck, Bus, Bike, Radio,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import TrackingDeviceManager from "@/components/TrackingDeviceManager";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import VehicleMovementAnalysis from "@/components/VehicleMovementAnalysis";
import { MovementTypeIndicator } from "@/components/MovementTypeIndicator";
import { motion, AnimatePresence } from "framer-motion";

const VehicleMap = dynamic(() => import("@/components/VehicleMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <MapPin className="h-10 w-10 animate-bounce text-blue-500" />
        <p className="text-sm font-medium">Loading map…</p>
      </div>
    </div>
  ),
});

interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  status: "available" | "maintenance" | "rented" | "retired";
  type?: string;
  location?: { lat: number; lng: number; lastUpdated: string };
}

/* ── Static status helpers (no dynamic class names) ── */
function StatusDot({ status }: { status: string }) {
  if (status === "available") return <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />;
  if (status === "rented") return <span className="w-2 h-2 rounded-full bg-blue-500" />;
  if (status === "maintenance") return <span className="w-2 h-2 rounded-full bg-amber-500" />;
  return <span className="w-2 h-2 rounded-full bg-slate-400" />;
}

function StatusChip({ status }: { status: string }) {
  if (status === "available")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Available
      </span>
    );
  if (status === "rented")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Rented
      </span>
    );
  if (status === "maintenance")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Maintenance
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Retired
    </span>
  );
}

function VehicleIconCircle({ status }: { status: string }) {
  if (status === "available")
    return (
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 shadow">
        <Car className="h-6 w-6 text-white" />
      </div>
    );
  if (status === "rented")
    return (
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow">
        <Car className="h-6 w-6 text-white" />
      </div>
    );
  if (status === "maintenance")
    return (
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow">
        <Car className="h-6 w-6 text-white" />
      </div>
    );
  return (
    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shrink-0 shadow">
      <Car className="h-6 w-6 text-white" />
    </div>
  );
}

export default function VehicleTrackingPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("map");
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(true);
  const [trackingInterval, setTrackingInterval] = useState(30000);
  const [listSearch, setListSearch] = useState("");
  const [listFilter, setListFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);

  const {
    latitude,
    longitude,
    error: locationError,
    isTracking,
    lastUpdated,
    startTracking,
    stopTracking,
    isUsingFallbackLocation,
    accuracy,
  } = useBackgroundGeolocation({
    backgroundTracking: backgroundTrackingEnabled,
    trackingInterval,
    enableHighAccuracy: true,
  });

  const userLocation =
    latitude && longitude
      ? {
          coords: {
            latitude,
            longitude,
            accuracy: accuracy || 0,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: lastUpdated?.getTime() || Date.now(),
        }
      : null;

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/vehicles/tracking");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles);
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error || "Failed to fetch vehicles");
      }
    } catch {
      setError("Network error when fetching vehicle data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
    const id = setInterval(fetchVehicles, 30000);
    return () => clearInterval(id);
  }, [fetchVehicles]);

  const filteredList = vehicles.filter((v) => {
    const matchS =
      !listSearch ||
      v.name.toLowerCase().includes(listSearch.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(listSearch.toLowerCase());
    const matchF =
      listFilter === "ALL" || v.status === listFilter.toLowerCase();
    return matchS && matchF;
  });

  const liveCount = vehicles.filter((v) => v.location).length;
  const rentedCount = vehicles.filter((v) => v.status === "rented").length;
  const maintCount = vehicles.filter((v) => v.status === "maintenance").length;

  const LIST_FILTERS = [
    { key: "ALL", label: "All" },
    { key: "available", label: "Available" },
    { key: "rented", label: "Rented" },
    { key: "maintenance", label: "Maintenance" },
    { key: "retired", label: "Retired" },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6 pb-10">

          {/* ━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━ */}
          <div
            className="relative overflow-hidden rounded-3xl shadow-2xl"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f4c75 100%)" }}
          >
            {/* decorative blobs */}
            <div className="pointer-events-none absolute top-0 right-0 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl" />

            <div className="relative p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                    <Satellite className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-cyan-300 text-xs font-semibold tracking-wide uppercase">
                      Live Fleet Intelligence
                    </span>
                    {isTracking && (
                      <span className="ml-1 flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight">Vehicle Tracking</h1>
                  <p className="text-slate-400 mt-1.5">
                    Real-time GPS positions and fleet telemetry
                  </p>
                </div>
                <Button
                  onClick={fetchVehicles}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 gap-2 shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {/* metric tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  className="rounded-2xl p-4 bg-white/8 border border-white/12"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">Total</span>
                  </div>
                  <p className="text-4xl font-black text-white">{loading ? "–" : vehicles.length}</p>
                  <p className="text-slate-500 text-xs mt-1">Vehicles registered</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.07 }}
                  className="rounded-2xl p-4 bg-cyan-500/10 border border-cyan-400/25"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="h-4 w-4 text-cyan-400" />
                    <span className="text-cyan-300/80 text-[11px] font-semibold uppercase tracking-wider">Live on Map</span>
                  </div>
                  <p className="text-4xl font-black text-cyan-400">{loading ? "–" : liveCount}</p>
                  <p className="text-cyan-500/60 text-xs mt-1">GPS signal active</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                  className="rounded-2xl p-4 bg-blue-500/10 border border-blue-400/25"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-300/80 text-[11px] font-semibold uppercase tracking-wider">Rented</span>
                  </div>
                  <p className="text-4xl font-black text-blue-400">{loading ? "–" : rentedCount}</p>
                  <p className="text-blue-500/60 text-xs mt-1">Currently in use</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.21 }}
                  className="rounded-2xl p-4 bg-amber-500/10 border border-amber-400/25"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-300/80 text-[11px] font-semibold uppercase tracking-wider">Maintenance</span>
                  </div>
                  <p className="text-4xl font-black text-amber-400">{loading ? "–" : maintCount}</p>
                  <p className="text-amber-500/60 text-xs mt-1">Under service</p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━ TABS ━━━━━━━━━━━━━━ */}
          <Tabs defaultValue="map" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-12 p-1 gap-1 bg-muted/60 rounded-xl">
              {[
                { id: "map", label: "Map View", icon: MapPin },
                { id: "list", label: "Vehicle List", icon: Car },
                { id: "analysis", label: "Analysis", icon: BarChart3 },
                { id: "devices", label: "Devices", icon: HardDrive },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── MAP TAB ── */}
            <TabsContent value="map" className="mt-5 space-y-4">
              {/* GPS controls card */}
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Switch
                      id="bg-track"
                      checked={backgroundTrackingEnabled}
                      onCheckedChange={(checked) => {
                        setBackgroundTrackingEnabled(checked);
                        checked ? startTracking() : stopTracking();
                      }}
                    />
                    <Label htmlFor="bg-track" className="text-sm font-semibold cursor-pointer">
                      Background GPS
                    </Label>
                    {isTracking ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
                        <Wifi className="h-3 w-3" />
                        Tracking Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-muted text-muted-foreground border">
                        <WifiOff className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {latitude && longitude && (
                      <code className="text-xs font-mono bg-muted px-3 py-1.5 rounded-xl border text-muted-foreground">
                        {isUsingFallbackLocation ? "⚠ Network" : "📡 GPS"} {latitude.toFixed(4)},{" "}
                        {longitude.toFixed(4)}
                        {accuracy ? ` ±${Math.round(accuracy)}m` : ""}
                      </code>
                    )}
                    {isTracking && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setTrackingInterval((i) => Math.max(5000, i - 5000))}
                          disabled={trackingInterval <= 5000}
                        >
                          Faster
                        </Button>
                        <span className="text-xs text-muted-foreground w-8 text-center">
                          {trackingInterval / 1000}s
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setTrackingInterval((i) => i + 5000)}
                        >
                          Slower
                        </Button>
                      </div>
                    )}
                    {(() => {
                      try {
                        return <MovementTypeIndicator />;
                      } catch {
                        return null;
                      }
                    })()}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => router.push("/vehicle-tracking/movement-analysis")}
                    >
                      Analyze
                    </Button>
                  </div>
                </div>
              </div>

              {/* Error alert */}
              {(locationError || error) && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">
                      {locationError ? "Location unavailable" : "Data error"}
                    </p>
                    <p className="text-xs mt-0.5 opacity-80">{locationError || error}</p>
                    {error && (
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-xs mt-1 text-amber-800 dark:text-amber-300"
                        onClick={fetchVehicles}
                      >
                        Try again
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Map container */}
              <div className="rounded-2xl overflow-hidden border shadow-sm">
                <div className="h-[540px] w-full">
                  <VehicleMap
                    vehicles={vehicles}
                    userLocation={userLocation}
                    isLoading={loading}
                    isUsingNetworkLocation={isUsingFallbackLocation}
                  />
                </div>
                {/* Legend */}
                <div className="px-5 py-3 border-t bg-muted/30 flex items-center gap-5 flex-wrap text-xs">
                  <span className="font-semibold text-foreground">Legend:</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Rented
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Maintenance
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Retired
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> No GPS
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── LIST TAB ── */}
            <TabsContent value="list" className="mt-5">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
                <div className="flex gap-2 flex-wrap">
                  {LIST_FILTERS.map((f) => {
                    const cnt =
                      f.key === "ALL"
                        ? vehicles.length
                        : vehicles.filter((v) => v.status === f.key).length;
                    const isActive = listFilter === f.key;
                    if (f.key === "ALL")
                      return (
                        <button
                          key={f.key}
                          onClick={() => setListFilter(f.key)}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            isActive
                              ? "bg-slate-900 text-white border-slate-900 shadow dark:bg-white dark:text-slate-900 dark:border-white"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          All <span className="opacity-60 ml-1">{cnt}</span>
                        </button>
                      );
                    if (f.key === "available")
                      return (
                        <button
                          key={f.key}
                          onClick={() => setListFilter(f.key)}
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
                    if (f.key === "rented")
                      return (
                        <button
                          key={f.key}
                          onClick={() => setListFilter(f.key)}
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
                    if (f.key === "maintenance")
                      return (
                        <button
                          key={f.key}
                          onClick={() => setListFilter(f.key)}
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
                        key={f.key}
                        onClick={() => setListFilter(f.key)}
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
                    placeholder="Search name or plate…"
                    className="pl-10 h-10"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
              ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="p-6 rounded-3xl bg-muted mb-5">
                    <Car className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-xl font-bold mb-2">No vehicles found</p>
                  <p className="text-sm text-muted-foreground">
                    {listSearch || listFilter !== "ALL"
                      ? "Adjust filter or search"
                      : "No tracking data available"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {filteredList.map((v, i) => {
                      const mins = v.location
                        ? Math.floor(
                            (Date.now() - new Date(v.location.lastUpdated).getTime()) / 60000
                          )
                        : null;
                      const isLive = mins !== null && mins < 5;
                      return (
                        <motion.div
                          key={v.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                        >
                          <div className="flex items-center gap-3">
                            <VehicleIconCircle status={v.status} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-bold text-sm truncate">{v.name}</h3>
                                {isLive && (
                                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    LIVE
                                  </span>
                                )}
                              </div>
                              <code className="text-xs text-muted-foreground font-mono">{v.licensePlate}</code>
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                {v.location ? (
                                  <>
                                    <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                                    <span>
                                      {mins === 0
                                        ? "Just now"
                                        : mins !== null && mins < 60
                                        ? `${mins}m ago`
                                        : new Date(v.location.lastUpdated).toLocaleTimeString()}
                                    </span>
                                    <span className="opacity-40 mx-0.5">·</span>
                                    <span className="font-mono text-[10px]">
                                      {v.location.lat.toFixed(4)}, {v.location.lng.toFixed(4)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="h-3 w-3" /> No GPS data
                                  </span>
                                )}
                              </div>
                            </div>
                            <StatusChip status={v.status} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="mt-5">
              <VehicleMovementAnalysis vehicles={vehicles} isLoading={loading} />
            </TabsContent>

            <TabsContent value="devices" className="mt-5 space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => router.push("/vehicle-tracking/device-integration")}
                >
                  <HardDrive className="h-4 w-4" /> Device Integration Guide
                </Button>
              </div>
              <TrackingDeviceManager />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
