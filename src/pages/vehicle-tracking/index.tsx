import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  MapPin, Car, AlertTriangle, RefreshCw, BarChart3, Radio,
  Wifi, WifiOff, HardDrive, Search, Filter, Navigation,
  CheckCircle2, Wrench, XCircle, AlertCircle, Activity, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TrackingDeviceManager from "@/components/TrackingDeviceManager";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import VehicleMovementAnalysis from "@/components/VehicleMovementAnalysis";
import { MovementTypeIndicator } from "@/components/MovementTypeIndicator";

const VehicleMap = dynamic(() => import("@/components/VehicleMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] bg-muted rounded-xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <MapPin className="h-8 w-8 animate-pulse" />
        <p className="text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  status: "available" | "maintenance" | "rented" | "retired";
  make?: string;
  model?: string;
  year?: number;
  type?: string;
  location?: { lat: number; lng: number; lastUpdated: string };
}

const STATUS_CFG = {
  available:   { label: 'Available',   dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> },
  rented:      { label: 'Rented',      dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300',       bg: 'bg-blue-50 dark:bg-blue-900/30',       icon: <AlertCircle className="h-3.5 w-3.5 text-blue-500" /> },
  maintenance: { label: 'Maintenance', dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300',     bg: 'bg-amber-50 dark:bg-amber-900/30',     icon: <Wrench className="h-3.5 w-3.5 text-amber-500" /> },
  retired:     { label: 'Retired',     dot: 'bg-red-400',     text: 'text-red-700 dark:text-red-300',         bg: 'bg-red-50 dark:bg-red-900/30',         icon: <XCircle className="h-3.5 w-3.5 text-red-400" /> },
};

export default function VehicleTrackingPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("map");
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(true);
  const [trackingInterval, setTrackingInterval] = useState(30000);
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  const {
    latitude, longitude, error: locationError, isTracking,
    lastUpdated, startTracking, stopTracking, isUsingFallbackLocation, accuracy
  } = useBackgroundGeolocation({
    backgroundTracking: backgroundTrackingEnabled,
    trackingInterval,
    enableHighAccuracy: true,
  });

  const userLocation = latitude && longitude ? {
    coords: { latitude, longitude, accuracy: accuracy || 0, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: lastUpdated?.getTime() || Date.now(),
  } : null;

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

  const filteredListVehicles = vehicles.filter(v => {
    const matchesSearch = !listSearch ||
      v.name.toLowerCase().includes(listSearch.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(listSearch.toLowerCase());
    const matchesFilter = listFilter === 'ALL' || v.status === listFilter;
    return matchesSearch && matchesFilter;
  });

  // summary counts
  const counts = {
    total: vehicles.length,
    withLocation: vehicles.filter(v => v.location).length,
    available: vehicles.filter(v => v.status === 'available').length,
    rented: vehicles.filter(v => v.status === 'rented').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6 pb-8">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Navigation className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Vehicle Tracking</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-11">Live fleet positions and GPS telemetry</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Live indicator */}
              {isTracking && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                  {lastUpdated && <span className="opacity-70 ml-1">{lastUpdated.toLocaleTimeString()}</span>}
                </div>
              )}
              <Button onClick={fetchVehicles} variant="outline" size="sm" className="gap-2" disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* ── Quick Stats Bar ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Vehicles', value: counts.total, icon: <Car className="h-4 w-4 text-slate-500" />, color: 'bg-slate-50 dark:bg-slate-800' },
              { label: 'Live on Map', value: counts.withLocation, icon: <MapPin className="h-4 w-4 text-emerald-500" />, color: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Currently Rented', value: counts.rented, icon: <Activity className="h-4 w-4 text-blue-500" />, color: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'In Maintenance', value: counts.maintenance, icon: <Wrench className="h-4 w-4 text-amber-500" />, color: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map((s, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${s.color}`}>
                <div className="p-1.5 rounded-lg bg-white/60 dark:bg-black/20">{s.icon}</div>
                <div>
                  <p className="text-lg font-bold leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main Tabs ── */}
          <Tabs defaultValue="map" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-10 p-1 gap-1">
              <TabsTrigger value="map" className="gap-1.5 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                Map View
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 text-sm">
                <Car className="h-3.5 w-3.5" />
                List View
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-1.5 text-sm">
                <BarChart3 className="h-3.5 w-3.5" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="devices" className="gap-1.5 text-sm">
                <HardDrive className="h-3.5 w-3.5" />
                Devices
              </TabsTrigger>
            </TabsList>

            {/* MAP TAB */}
            <TabsContent value="map" className="mt-4 space-y-4">
              {/* GPS Controls strip */}
              <Card className="shadow-sm">
                <CardContent className="py-3 px-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                    {/* Left: toggle */}
                    <div className="flex items-center gap-3">
                      <Switch
                        id="bg-track"
                        checked={backgroundTrackingEnabled}
                        onCheckedChange={checked => {
                          setBackgroundTrackingEnabled(checked);
                          checked ? startTracking() : stopTracking();
                        }}
                      />
                      <Label htmlFor="bg-track" className="text-sm cursor-pointer">
                        Background GPS
                      </Label>
                      <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${isTracking ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' : 'bg-muted text-muted-foreground border-border'}`}>
                        {isTracking ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {isTracking ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    {/* Right: coords + movement */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {latitude && longitude && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                          {isUsingFallbackLocation ? '⚠ Network' : '📡 GPS'} {latitude.toFixed(4)}, {longitude.toFixed(4)}
                          {accuracy ? ` ±${Math.round(accuracy)}m` : ''}
                        </span>
                      )}
                      {isTracking && (
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setTrackingInterval(i => Math.max(5000, i - 5000))} disabled={trackingInterval <= 5000}>
                            Faster
                          </Button>
                          <span className="text-xs text-muted-foreground">{trackingInterval / 1000}s</span>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setTrackingInterval(i => i + 5000)}>
                            Slower
                          </Button>
                        </div>
                      )}
                      {(() => {
                        try { return <MovementTypeIndicator />; }
                        catch { return <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">Sensor N/A</span>; }
                      })()}
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push('/vehicle-tracking/movement-analysis')}>
                        Analyze
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Errors */}
              {(locationError || error) && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{locationError ? 'Location unavailable' : 'Data error'}</p>
                    <p className="text-xs opacity-80 mt-0.5">{locationError || error}</p>
                    {error && <Button variant="link" size="sm" className="p-0 h-auto text-xs mt-1" onClick={fetchVehicles}>Try again</Button>}
                  </div>
                </div>
              )}

              {/* Map */}
              <Card className="shadow-sm overflow-hidden">
                <div className="h-[540px] w-full">
                  <VehicleMap
                    vehicles={vehicles}
                    userLocation={userLocation}
                    isLoading={loading}
                    isUsingNetworkLocation={isUsingFallbackLocation}
                  />
                </div>
                {/* Legend */}
                <div className="px-4 py-3 border-t flex items-center gap-4 flex-wrap text-xs text-muted-foreground bg-muted/30">
                  <span className="font-medium text-foreground">Legend:</span>
                  {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    No GPS data
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* LIST TAB */}
            <TabsContent value="list" className="mt-4">
              <Card className="shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Vehicle List</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {filteredListVehicles.length} of {vehicles.length} vehicles
                        {listFilter !== 'ALL' ? ` · ${STATUS_CFG[listFilter]?.label || listFilter}` : ''}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Name or plate…"
                          className="pl-8 h-8 w-44 text-sm"
                          value={listSearch}
                          onChange={e => setListSearch(e.target.value)}
                        />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                            <Filter className="h-3.5 w-3.5" />
                            {listFilter === 'ALL' ? 'All' : STATUS_CFG[listFilter]?.label || listFilter}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setListFilter('ALL')} className={listFilter === 'ALL' ? 'bg-muted' : ''}>
                            All Vehicles
                          </DropdownMenuItem>
                          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                            <DropdownMenuItem key={key} onClick={() => setListFilter(key)} className={listFilter === key ? 'bg-muted' : ''}>
                              <span className={`w-2 h-2 rounded-full ${cfg.dot} mr-2`} />
                              {cfg.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="divide-y">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4">
                          <Skeleton className="h-10 w-10 rounded-xl" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : filteredListVehicles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="p-4 rounded-full bg-muted mb-3">
                        <Car className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-sm">No vehicles found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {listSearch || listFilter !== 'ALL' ? 'Adjust your filter or search' : 'No vehicles available'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredListVehicles.map(vehicle => {
                        const cfg = STATUS_CFG[vehicle.status];
                        const mins = vehicle.location
                          ? Math.floor((Date.now() - new Date(vehicle.location.lastUpdated).getTime()) / 60000)
                          : null;
                        return (
                          <div key={vehicle.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors group">
                            {/* Icon */}
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center ring-1 ring-border shrink-0">
                              <Car className="h-5 w-5 text-muted-foreground" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate">{vehicle.name}</span>
                                {vehicle.location && mins !== null && mins < 5 && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                                    Live
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{vehicle.licensePlate}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                {vehicle.location ? (
                                  <>
                                    <MapPin className="h-3 w-3 text-emerald-500" />
                                    <span>
                                      {mins === 0 ? 'Just now' : mins !== null && mins < 60 ? `${mins}m ago` : vehicle.location ? new Date(vehicle.location.lastUpdated).toLocaleTimeString() : ''}
                                    </span>
                                    <span className="opacity-50 mx-0.5">·</span>
                                    <span className="font-mono">{vehicle.location.lat.toFixed(4)}, {vehicle.location.lng.toFixed(4)}</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                    <span>No GPS data</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Status pill */}
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg?.bg} ${cfg?.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                              {cfg?.label || vehicle.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ANALYSIS TAB */}
            <TabsContent value="analysis" className="mt-4">
              <VehicleMovementAnalysis vehicles={vehicles} isLoading={loading} />
            </TabsContent>

            {/* DEVICES TAB */}
            <TabsContent value="devices" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/vehicle-tracking/device-integration')}>
                  <HardDrive className="h-4 w-4" />
                  Device Integration Guide
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
