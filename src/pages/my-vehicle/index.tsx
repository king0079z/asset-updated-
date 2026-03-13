// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const MY_VEHICLE_KEY = "/api/vehicles/my-vehicle";
const TRIP_STATS_KEY = "/api/vehicles/trip-stats";
const ACTIVE_TRIP_KEY = "/api/vehicles/active-trip";
const MY_VEHICLE_TTL = 60_000;
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  MapPin, Car, AlertTriangle, Gauge, Clock, RotateCw, Wifi, WifiOff,
  Route, Navigation, History, CheckCircle, User, Download,
  ChevronDown, ChevronUp, ExternalLink, Activity, Calendar,
  TrendingUp, Shield, Zap, SatelliteDish, Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRentalId } from "@/util/rental";
import { formatUserId } from "@/util/user";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectivityMonitor } from "@/components/ConnectivityMonitor";
import { connectivityManager } from "@/util/connectivity";
import { AutomaticTripManager } from "@/components/AutomaticTripManager";
import { TripDetailsDialog } from "@/components/TripDetailsDialog";

const VehicleMap = dynamic(() => import("@/components/VehicleMap").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center">
      <Skeleton className="w-full h-full rounded-2xl" />
    </div>
  ),
});

const TripRouteMap = dynamic(() => import("@/components/TripRouteMap").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
      <Skeleton className="w-full h-full rounded-2xl" />
    </div>
  ),
});

interface UserObj {
  id: string;
  email: string;
  createdAt: string;
}
interface VehicleRental {
  id: string;
  startDate: string;
  endDate: string | null;
  status: string;
  vehicleId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: UserObj;
  displayId?: string;
}
interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model: string;
  year: number;
  plateNumber: string;
  licensePlate?: string;
  status: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "RETIRED";
  type: string;
  color?: string;
  mileage?: number;
  rentalAmount: number;
  insuranceInfo?: string;
  registrationExp?: string;
  imageUrl?: string;
  rentals?: VehicleRental[];
}
interface TripData {
  startTime: Date;
  startLatitude: number;
  startLongitude: number;
  currentDistance: number;
  isActive: boolean;
}
interface TripRecord {
  id: string;
  startTime: string;
  endTime: string;
  distance: number;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  completionStatus: string;
  vehicleId: string;
  vehicle: Vehicle;
  createdAt: string;
  routePoints?: Array<{ latitude: number; longitude: number; timestamp: string }> | null;
}

/* ─────────────────────────────────────────────
   Trip History Sub-Component
───────────────────────────────────────────── */
function TripHistorySection({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/vehicles/trip-history");
        if (res.ok) {
          const data = await res.json();
          setTrips(data.vehicleTrips || []);
        } else {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          setError(err.error || "Failed to fetch trip history");
        }
      } catch {
        setError("Network error when fetching trip history");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const duration = (start: string, end: string) => {
    let ms = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  function TripStatusBadge({ status }: { status: string }) {
    const s = (status || "").toUpperCase();
    if (s === "COMPLETED")
      return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle className="h-3 w-3" />Completed</span>;
    if (s === "INCOMPLETE")
      return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />Incomplete</span>;
    if (s === "CANCELLED")
      return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"><AlertTriangle className="h-3 w-3" />Cancelled</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{status}</span>;
  }

  const exportCsv = () => {
    if (trips.length === 0) return;
    const headers = ["Vehicle", "Plate", "Start Time", "End Time", "Distance (km)", "Duration", "Status"];
    const rows = trips.map((t) => [
      t.vehicle.name, t.vehicle.plateNumber,
      new Date(t.startTime).toLocaleString(),
      t.endTime ? new Date(t.endTime).toLocaleString() : "Active",
      (t.distance || 0).toFixed(2),
      t.endTime ? duration(t.startTime, t.endTime) : "In Progress",
      t.completionStatus || "UNKNOWN",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `trip-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Route className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-base">{t("trip_history")}</h3>
            <p className="text-xs text-muted-foreground">{t("previous_vehicle_trips")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={trips.length === 0} className="gap-2 text-xs">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl text-red-800 dark:text-red-300 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-5 rounded-3xl bg-muted mb-4">
            <Route className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="font-bold text-base mb-1">{t("no_trip_history")}</p>
          <p className="text-sm text-muted-foreground">Complete trips will appear here</p>
        </div>
      ) : (
        <div className="divide-y">
          {trips.map((trip, idx) => (
            <div key={trip.id}>
              {/* trip row */}
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Car className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{trip.vehicle.name}</p>
                    <code className="text-xs text-muted-foreground font-mono">{trip.vehicle.plateNumber}</code>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 flex-1 text-center sm:text-left">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Distance</p>
                    <p className="text-sm font-bold">{(trip.distance || 0).toFixed(2)} km</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Duration</p>
                    <p className="text-sm font-bold">{duration(trip.startTime, trip.endTime)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Status</p>
                    <TripStatusBadge status={trip.completionStatus} />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={(e) => { e.stopPropagation(); setSelectedTrip(trip); setShowDetails(true); }}
                  >
                    Details
                  </Button>
                  {expandedId === trip.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* expanded route view */}
              <AnimatePresence>
                {expandedId === trip.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pt-2 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Trip Route · {fmtDate(trip.startTime)} → {fmtDate(trip.endTime)}
                      </p>

                      {trip.routePoints && trip.routePoints.length > 0 ? (
                        <div className="h-[360px] w-full rounded-2xl overflow-hidden border mb-3">
                          <TripRouteMap
                            startLatitude={trip.startLatitude}
                            startLongitude={trip.startLongitude}
                            endLatitude={trip.endLatitude || null}
                            endLongitude={trip.endLongitude || null}
                            routePoints={trip.routePoints}
                            height="360px"
                            darkMode={true}
                          />
                        </div>
                      ) : (
                        <div className="h-28 rounded-2xl bg-muted border flex items-center justify-center mb-3 text-sm text-muted-foreground">
                          No route data available for visualization
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border bg-card p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Start Location</p>
                          <code className="text-xs font-mono">
                            {trip.startLatitude?.toFixed(6) ?? "—"}, {trip.startLongitude?.toFixed(6) ?? "—"}
                          </code>
                        </div>
                        <div className="rounded-xl border bg-card p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">End Location</p>
                          <code className="text-xs font-mono">
                            {trip.endLatitude?.toFixed(6) ?? "—"}, {trip.endLongitude?.toFixed(6) ?? "—"}
                          </code>
                        </div>
                      </div>

                      {trip.routePoints && trip.routePoints.length > 0 && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          {trip.routePoints.length} GPS tracking points recorded
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {trips.length > 0 && (
        <div className="px-6 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
          Showing {trips.length} trips
        </div>
      )}

      <TripDetailsDialog open={showDetails} onOpenChange={setShowDetails} trip={selectedTrip} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function MyVehiclePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const cachedVehicleData = getFromCache<any>(MY_VEHICLE_KEY, MY_VEHICLE_TTL);
  const [vehicle, setVehicle] = useState<Vehicle | null>(() => cachedVehicleData?.vehicle ?? null);
  const [loading, setLoading] = useState(() => !cachedVehicleData);
  const [error, setError] = useState<string | null>(null);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [totalTripDuration, setTotalTripDuration] = useState<string | null>(null);
  const [trip, setTrip] = useState<TripData | null>(null);
  const [trackingInterval, setTrackingInterval] = useState(10000);
  const previousCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [autoStartEnabled] = useState(true);
  const [autoEndEnabled] = useState(true);
  const [isStationaryTime, setIsStationaryTime] = useState<Date | null>(null);
  const [lastMovementTime, setLastMovementTime] = useState<Date | null>(null);

  const {
    latitude, longitude,
    error: locationError,
    isLoading: locationLoading,
    isTracking,
    lastUpdated,
    startTracking,
    stopTracking,
    accuracy,
    isUsingFallbackLocation,
  } = useBackgroundGeolocation({
    backgroundTracking: true,
    trackingInterval,
    enableHighAccuracy: true,
    fallbackToLastLocation: true,
    timeout: 30000,
    maximumAge: 0,
    safeMode: true,
  });

  const userLocation = latitude && longitude
    ? {
        coords: {
          latitude, longitude, accuracy: accuracy || 0,
          altitude: null, altitudeAccuracy: null, heading: null, speed: null,
        },
        timestamp: lastUpdated?.getTime() || Date.now(),
      }
    : null;

  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchAll = useCallback(async (background = false) => {
    if (!background) { setLoading(true); setError(null); }
    try {
      const [vData, sData, aData] = await Promise.all([
        fetchWithCache<any>(MY_VEHICLE_KEY, { maxAge: MY_VEHICLE_TTL }),
        fetchWithCache<any>(TRIP_STATS_KEY, { maxAge: MY_VEHICLE_TTL }).catch(() => null),
        fetchWithCache<any>(ACTIVE_TRIP_KEY, { maxAge: 30_000 }).catch(() => null),
      ]);
      if (vData?.vehicle) { setVehicle(vData.vehicle); setTotalDistance(vData.totalDistance || 0); }
      if (sData?.totalDuration) setTotalTripDuration(sData.totalDuration);
      if (aData?.hasActiveTrip && aData.trip) {
        setTrip({ ...aData.trip, startTime: new Date(aData.trip.startTime) });
        previousCoordinatesRef.current = { lat: aData.trip.startLatitude, lng: aData.trip.startLongitude };
        setLastMovementTime(new Date());
      }
    } catch {
      if (!background) setError("Failed to fetch vehicle data");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedVehicleData) fetchAll(false);
    const id = setInterval(() => fetchAll(true), 120000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const startTrip = useCallback(async (isAuto = false) => {
    if (!latitude || !longitude) return;
    const res = await fetch("/api/vehicles/start-trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: new Date(), startLatitude: latitude, startLongitude: longitude, isAutoStarted: isAuto }),
    });
    if (res.ok) {
      setTrip({ startTime: new Date(), startLatitude: latitude, startLongitude: longitude, currentDistance: 0, isActive: true });
      previousCoordinatesRef.current = { lat: latitude, lng: longitude };
      setIsStationaryTime(null);
      setLastMovementTime(new Date());
    }
  }, [latitude, longitude]);

  const endTrip = async (isAuto = false) => {
    if (!trip || !latitude || !longitude) return;
    const res = await fetch("/api/vehicles/end-trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: trip.startTime, endTime: new Date(), distance: trip.currentDistance,
        startLatitude: trip.startLatitude, startLongitude: trip.startLongitude,
        endLatitude: latitude, endLongitude: longitude, isAutoEnded: isAuto,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setTotalDistance(d.totalDistance || 0);
      setTrip(null);
      setIsStationaryTime(null);
    }
  };

  const autoCompleteTrip = useCallback(async (reason: string) => {
    if (!trip || !latitude || !longitude) return;
    const res = await fetch("/api/vehicles/auto-complete-trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, reason }),
    });
    if (res.ok) {
      const d = await res.json();
      setTotalDistance(d.totalDistance || 0);
      setTrip(null);
      setIsStationaryTime(null);
    }
  }, [trip, latitude, longitude]);

  // Movement detection
  useEffect(() => {
    if (!latitude || !longitude || !previousCoordinatesRef.current) return;
    const prev = previousCoordinatesRef.current;
    const dist = calcDistance(prev.lat, prev.lng, latitude, longitude);
    const moved = dist > 0.005;

    if (moved) {
      setLastMovementTime(new Date());
      setIsStationaryTime(null);
      setIsMoving(true);
      if (trip?.isActive) {
        setTrip((p) => p ? { ...p, currentDistance: p.currentDistance + dist } : null);
      }
    } else {
      if (!isStationaryTime) setIsStationaryTime(new Date());
      else if (trip?.isActive && autoEndEnabled) {
        const statDur = Date.now() - isStationaryTime.getTime();
        if (statDur > 60000) {
          const nearStart = calcDistance(trip.startLatitude, trip.startLongitude, latitude, longitude) < 0.1;
          if (nearStart) autoCompleteTrip("returned_to_start");
        }
      }
      setIsMoving(false);
    }

    previousCoordinatesRef.current = { lat: latitude, lng: longitude };
  }, [latitude, longitude]);

  // Adaptive tracking interval
  useEffect(() => {
    const newInterval = isMoving ? 15000 : 60000;
    if (newInterval !== trackingInterval) setTrackingInterval(newInterval);
  }, [isMoving]);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  /* ── Vehicle header color ── */
  function VehicleHeroHeader({ vehicle }: { vehicle: Vehicle }) {
    const content = (
      <div className="relative overflow-hidden rounded-3xl shadow-2xl">
        {/* Background */}
        {vehicle.imageUrl ? (
          <>
            <img src={vehicle.imageUrl} alt={vehicle.name} className="w-full h-56 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </>
        ) : (
          <div className="relative h-48 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-blue-600/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-indigo-600/15 blur-2xl" />
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <Car className="h-32 w-32 text-white" />
            </div>
          </div>
        )}

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {vehicle.status === "RENTED" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-500/25 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    RENTED
                  </span>
                )}
                {vehicle.status === "AVAILABLE" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-white/15 border border-white/25 px-2 py-0.5 rounded-full">
                    Available
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-white leading-tight">{vehicle.name}</h2>
              <p className="text-white/70 text-sm mt-0.5">
                {vehicle.make} {vehicle.model} · {vehicle.year}
                {vehicle.color ? ` · ${vehicle.color}` : ""}
              </p>
            </div>
            <code className="shrink-0 text-white font-mono text-sm bg-black/40 backdrop-blur border border-white/20 px-3 py-1.5 rounded-xl">
              {vehicle.plateNumber}
            </code>
          </div>
        </div>
      </div>
    );
    return content;
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6 pb-10">

          {/* ━━━━━━━━━━━━━━ HERO BANNER ━━━━━━━━━━━━━━ */}
          <div
            className="relative overflow-hidden rounded-3xl shadow-2xl"
            style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e40af 100%)" }}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-8 w-60 h-60 rounded-full bg-indigo-600/10 blur-3xl" />

            <div className="relative p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                    <Car className="h-3.5 w-3.5 text-blue-300" />
                    <span className="text-blue-200 text-xs font-semibold tracking-wide uppercase">
                      {t("my_vehicle")}
                    </span>
                    {isTracking && (
                      <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-black ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        GPS LIVE
                      </span>
                    )}
                  </div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight">
                    {vehicle ? vehicle.name : t("my_vehicle")}
                  </h1>
                  <p className="text-indigo-200/80 mt-1.5">
                    {vehicle
                      ? `${vehicle.make || ""} ${vehicle.model} · ${vehicle.year} · ${vehicle.plateNumber}`
                      : t("my_vehicle_description")}
                  </p>
                </div>
                <Button
                  onClick={fetchAll}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="border-white/25 bg-white/10 text-white hover:bg-white/20 gap-2 shrink-0"
                >
                  <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {/* Metric tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
                  className="rounded-2xl p-4 bg-white/8 border border-white/12">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">Total Distance</span>
                  </div>
                  <p className="text-3xl font-black text-white">{(totalDistance || 0).toFixed(1)}</p>
                  <p className="text-slate-500 text-xs mt-1">kilometres driven</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
                  className="rounded-2xl p-4 bg-blue-500/10 border border-blue-400/25">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-300/80 text-[11px] font-semibold uppercase tracking-wider">Rental Rate</span>
                  </div>
                  <p className="text-2xl font-black text-blue-400">
                    {vehicle?.rentalAmount ? `QAR ${vehicle.rentalAmount.toLocaleString()}` : "—"}
                  </p>
                  <p className="text-blue-500/60 text-xs mt-1">per month</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                  className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-400/25">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300/80 text-[11px] font-semibold uppercase tracking-wider">Status</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-400 capitalize">
                    {vehicle?.status?.toLowerCase() || "—"}
                  </p>
                  <p className="text-emerald-500/60 text-xs mt-1">vehicle state</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}
                  className={`rounded-2xl p-4 border ${isTracking ? "bg-cyan-500/10 border-cyan-400/25" : "bg-white/8 border-white/12"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {isTracking ? <Wifi className="h-4 w-4 text-cyan-400" /> : <WifiOff className="h-4 w-4 text-slate-400" />}
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${isTracking ? "text-cyan-300/80" : "text-slate-400"}`}>GPS</span>
                  </div>
                  <p className={`text-2xl font-black ${isTracking ? "text-cyan-400" : "text-slate-400"}`}>
                    {isTracking ? "Live" : "Off"}
                  </p>
                  <p className={`text-xs mt-1 ${isTracking ? "text-cyan-500/60" : "text-slate-500"}`}>
                    {isTracking
                      ? accuracy ? `±${Math.round(accuracy)}m accuracy` : "tracking active"
                      : "location inactive"}
                  </p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl text-red-800 dark:text-red-300 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
            </div>
          ) : !vehicle ? (
            /* ── No vehicle state ── */
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="p-8 rounded-3xl bg-muted mb-6">
                <Car className="h-16 w-16 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-extrabold mb-3">{t("no_vehicle_assigned")}</h2>
              <p className="text-muted-foreground max-w-sm mb-8 text-sm">{t("contact_admin_for_vehicle")}</p>
              <Link href="/admin/vehicle-assignments">
                <Button className="gap-2">
                  <Car className="h-4 w-4" />
                  Go to Vehicle Assignments
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* ━━━━━━━━━━━━━━ TWO-COLUMN ROW ━━━━━━━━━━━━━━ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Vehicle Details */}
                <div className="space-y-4">
                  <VehicleHeroHeader vehicle={vehicle} />

                  {/* Info grid */}
                  <div className="rounded-3xl border bg-card shadow-sm p-5">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Vehicle Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-muted/50 border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Plate Number</p>
                        <code className="text-sm font-bold font-mono">{vehicle.plateNumber}</code>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/50 border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Type</p>
                        <p className="text-sm font-bold capitalize">{vehicle.type?.toLowerCase() || "—"}</p>
                      </div>
                      {vehicle.color && (
                        <div className="p-3 rounded-xl bg-muted/50 border">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Color</p>
                          <p className="text-sm font-bold capitalize">{vehicle.color}</p>
                        </div>
                      )}
                      {vehicle.mileage != null && (
                        <div className="p-3 rounded-xl bg-muted/50 border">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Mileage</p>
                          <p className="text-sm font-bold">{vehicle.mileage.toLocaleString()} km</p>
                        </div>
                      )}
                      {vehicle.registrationExp && (
                        <div className="p-3 rounded-xl bg-muted/50 border col-span-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Registration Expires</p>
                          <p className="text-sm font-bold">{new Date(vehicle.registrationExp).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right column: Trip + Stats */}
                <div className="space-y-4">

                  {/* Current Trip */}
                  <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Route className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{t("current_trip")}</p>
                            <p className="text-xs text-muted-foreground">{t("automatic_trip_management")}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                          Auto
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <AutomaticTripManager
                        backgroundTracking={true}
                        autoStartDistance={0.8}
                        autoEndDistance={0.1}
                      />
                    </div>
                  </div>

                  {/* Trip Statistics */}
                  <div className="rounded-3xl border bg-card shadow-sm p-5">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
                      {t("trip_statistics")}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-4 rounded-2xl bg-muted/40 border">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Total Distance</p>
                        <p className="text-3xl font-black">{(totalDistance || 0).toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground mt-1">km</p>
                        {trip?.isActive && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-semibold">
                            +{trip.currentDistance.toFixed(2)} km current
                          </p>
                        )}
                      </div>
                      <div className="text-center p-4 rounded-2xl bg-muted/40 border">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Total Duration</p>
                        <p className="text-3xl font-black">{totalTripDuration || "0h"}</p>
                        <p className="text-xs text-muted-foreground mt-1">time driven</p>
                        {trip?.isActive && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-semibold">
                            +{formatDuration(Date.now() - trip.startTime.getTime())} current
                          </p>
                        )}
                      </div>
                    </div>
                    {trip?.isActive && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span>Trip progress</span>
                          <span>{formatDuration(Date.now() - trip.startTime.getTime())}</span>
                        </div>
                        <Progress value={Math.min(100, (trip.currentDistance / 10) * 100)} className="h-2 rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ━━━━━━━━━━━━━━ ACCOUNT DETAILS ━━━━━━━━━━━━━━ */}
              {vehicle.rentals && vehicle.rentals.length > 0 && (
                <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                        <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="font-bold text-base">{t("account_details")}</p>
                        <p className="text-xs text-muted-foreground">{t("rental_information")}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 capitalize">
                      {vehicle.rentals[0].status.toLowerCase()}
                    </span>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* User profile */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40 border">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shrink-0 shadow">
                        {(vehicle.rentals[0].user.email || "U")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate">{vehicle.rentals[0].user.email}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded border text-muted-foreground">
                            {formatUserId(vehicle.rentals[0].user.id)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Joined {new Date(vehicle.rentals[0].user.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rental dates + ID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-muted/40 border">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground font-medium">{t("rental_start")}</p>
                        </div>
                        <p className="font-bold">{new Date(vehicle.rentals[0].startDate).toLocaleDateString()}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/40 border">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground font-medium">{t("rental_end")}</p>
                        </div>
                        <p className="font-bold">
                          {vehicle.rentals[0].endDate
                            ? new Date(vehicle.rentals[0].endDate).toLocaleDateString()
                            : "Open-ended"}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/40 border">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground font-medium">{t("rental_id")}</p>
                        </div>
                        <code className="text-xs font-mono font-semibold break-all">
                          {formatRentalId(vehicle.rentals[0].startDate, vehicle.rentals[0].id, vehicle.rentals[0].displayId)}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ━━━━━━━━━━━━━━ CONNECTIVITY + MAP ━━━━━━━━━━━━━━ */}
              <ConnectivityMonitor className="mb-0" />

              {/* GPS Status Banner */}
              {isUsingFallbackLocation && !latitude && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 shrink-0">
                    <SatelliteDish className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-amber-800 dark:text-amber-300">GPS Signal Unavailable</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Your device could not get a precise GPS fix.
                      {accuracy ? ` Network estimate accuracy is only ~${Math.round(accuracy / 1000)} km — too low to show on map.` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg">
                        <Info className="h-3 w-3" />
                        Open your browser settings and allow precise location access
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg">
                        <Info className="h-3 w-3" />
                        Move outdoors for a better GPS signal
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/40 gap-1.5 text-xs shrink-0"
                    onClick={() => startTracking()}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Retry GPS
                  </Button>
                </div>
              )}

              {isTracking && latitude && accuracy && accuracy < 50 && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    High-accuracy GPS active · ±{Math.round(accuracy)} m precision
                  </p>
                </div>
              )}

              {isTracking && latitude && accuracy && accuracy >= 50 && accuracy < 500 && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                    GPS active · ±{Math.round(accuracy)} m accuracy
                  </p>
                </div>
              )}

              <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${latitude ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"}`}>
                      <MapPin className={`h-4 w-4 ${latitude ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-bold text-base">{t("live_location")}</p>
                      <p className="text-xs text-muted-foreground">
                        {latitude
                          ? `Tracking active${accuracy ? ` · ±${Math.round(accuracy)}m` : ""}`
                          : isUsingFallbackLocation
                          ? "GPS unavailable — enable location on your device"
                          : "Location inactive"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => connectivityManager.syncOfflineData()}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Sync Data
                  </Button>
                </div>
                <div className={`w-full ${latitude ? "h-[420px]" : "h-[220px] flex flex-col items-center justify-center bg-muted/30"}`}>
                  {latitude ? (
                    <VehicleMap
                      vehicles={[{
                        id: vehicle.id,
                        name: vehicle.name,
                        licensePlate: vehicle.licensePlate || vehicle.plateNumber,
                        status: vehicle.status === "AVAILABLE" ? "available" : vehicle.status === "MAINTENANCE" ? "maintenance" : "rented",
                        location: latitude && longitude
                          ? { lat: latitude, lng: longitude, lastUpdated: lastUpdated?.toISOString() || new Date().toISOString() }
                          : undefined,
                      }]}
                      userLocation={userLocation}
                      isLoading={locationLoading}
                      isUsingNetworkLocation={isUsingFallbackLocation || false}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-center px-6">
                      <div className="p-4 rounded-2xl bg-muted">
                        <SatelliteDish className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Waiting for GPS signal…</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The map will appear once your device gets a precise location fix.
                          {locationLoading ? " Searching for GPS…" : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2 mt-1" onClick={() => startTracking()}>
                        <RotateCw className="h-3.5 w-3.5" />
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
                {locationError && latitude && (
                  <div className="px-5 py-3 border-t flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {locationError}
                  </div>
                )}
              </div>

              {/* ━━━━━━━━━━━━━━ TRIP HISTORY ━━━━━━━━━━━━━━ */}
              <TripHistorySection userId={user?.id} />
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
