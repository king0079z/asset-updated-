import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, User, Car, AlertTriangle, ArrowLeft,
  MapPin, Clock, Calendar, Route, Sparkles,
  ChevronDown, ChevronUp, Navigation, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import dynamic from "next/dynamic";
import { DriverRouteAnalysis } from "@/components/DriverRouteAnalysis";

const TripRouteMap = dynamic(() => import("@/components/TripRouteMap"), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[300px] rounded-xl" />,
});

interface Driver  { id: string; email: string; createdAt: string; }
interface Vehicle {
  id: string; name: string; make: string; model: string; year: number;
  plateNumber: string; status: string; type: string; color: string;
  mileage: number; rentalAmount: number; imageUrl: string;
}
interface Trip {
  id: string; vehicleId: string; startTime: string; endTime: string;
  startLatitude: number; startLongitude: number;
  endLatitude: number; endLongitude: number;
  distance: number; isAutoStarted: boolean; isAutoEnded: boolean;
  completionStatus: string; routePoints: any; createdAt: string; updatedAt: string;
}
interface VehicleWithTrips { vehicle: Vehicle; trips: Trip[]; assignmentDate: string; }

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700", "from-blue-500 to-indigo-700",
  "from-emerald-500 to-teal-700", "from-rose-500 to-pink-700",
  "from-amber-500 to-orange-600", "from-cyan-500 to-sky-700",
];

const DriverAvatar = ({ email, size = "lg" }: { email: string; size?: "sm" | "md" | "lg" }) => {
  const initials = (email ?? "??").slice(0, 2).toUpperCase();
  const idx = (email?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  const dim = size === "lg" ? "w-20 h-20 text-2xl" : size === "md" ? "w-12 h-12 text-base" : "w-8 h-8 text-xs";
  return (
    <div className={`${dim} rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[idx]} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}>
      {initials}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, string> = {
    AVAILABLE:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    MAINTENANCE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    IN_USE:      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status.replace("_", " ")}
    </span>
  );
};

const formatDuration = (start: string, end: string) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

export default function DriverDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehiclesWithTrips, setVehiclesWithTrips] = useState<VehicleWithTrips[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { if (id) fetchDriverDetails(); }, [id]);

  const fetchDriverDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/drivers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDriver(data.driver);
        setVehiclesWithTrips(data.vehiclesWithTrips ?? []);
      } else {
        const d = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(d.error || "Failed to fetch driver details");
      }
    } catch {
      setError("Network error when fetching driver data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDriverDetails();
    setIsRefreshing(false);
  };

  const stats = (() => {
    let trips = 0, distance = 0, hours = 0;
    vehiclesWithTrips.forEach(({ trips: t }) => {
      trips += t.length;
      t.forEach(tr => {
        distance += tr.distance ?? 0;
        if (tr.endTime && tr.startTime)
          hours += (new Date(tr.endTime).getTime() - new Date(tr.startTime).getTime()) / 3600000;
      });
    });
    return { trips, distance, hours };
  })();

  const idx = (driver?.email?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  const gradient = AVATAR_GRADIENTS[idx];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-8">

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.3),transparent_70%)]" />
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5 blur-2xl" />

            <div className="relative z-10 px-8 py-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 border flex-shrink-0"
                    onClick={() => router.push("/drivers")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>

                  {loading ? (
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-20 h-20 rounded-2xl" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                  ) : driver ? (
                    <div className="flex items-center gap-4">
                      <DriverAvatar email={driver.email} size="lg" />
                      <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">{driver.email}</h1>
                        <p className="text-white/70 text-sm mt-1">
                          {t('joined')}: {new Date(driver.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h1 className="text-2xl font-bold text-white">{t('driver_details')}</h1>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleRefresh}
                  disabled={loading || isRefreshing}
                  className="bg-white/15 hover:bg-white/25 text-white border-white/20 border gap-2 rounded-xl backdrop-blur self-start lg:self-auto"
                >
                  <RefreshCw className={`h-4 w-4 ${(loading || isRefreshing) ? "animate-spin" : ""}`} />
                  {t('refresh')}
                </Button>
              </div>

              {/* Stats row */}
              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: t('vehicles_assigned'), value: loading ? "—" : vehiclesWithTrips.length, icon: Car },
                  { label: t('total_trips'),        value: loading ? "—" : stats.trips,              icon: Route },
                  { label: `${t('total_distance')} (km)`, value: loading ? "—" : stats.distance.toFixed(1), icon: MapPin },
                  { label: t('total_hours'),        value: loading ? "—" : `${stats.hours.toFixed(1)} h`, icon: Clock },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 backdrop-blur border border-white/15 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/70 font-medium">{s.label}</span>
                      <s.icon className="h-4 w-4 text-white/60" />
                    </div>
                    <p className="text-2xl font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Error ─────────────────────────────────────────────────── */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{t('error_fetching_data')}</p>
                <p className="text-xs mt-0.5">{error}</p>
                <button onClick={fetchDriverDetails} className="text-xs underline mt-1 hover:opacity-75">{t('try_again')}</button>
              </div>
            </div>
          )}

          {/* ── Loading skeleton ─────────────────────────────────────── */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          )}

          {/* ── Content ───────────────────────────────────────────────── */}
          {!loading && driver && (
            <>
              {/* AI Route Analysis */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/50 dark:to-indigo-950/50">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm">AI Route Analysis</h2>
                    <p className="text-xs text-muted-foreground">Performance insights powered by AI</p>
                  </div>
                </div>
                <div className="p-4">
                  <DriverRouteAnalysis driverId={id as string} />
                </div>
              </div>

              {/* Vehicles + Trips */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Car className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm">{t('assigned_vehicles_and_trips')}</h2>
                    <p className="text-xs text-muted-foreground">{t('vehicles_and_trip_history')}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    {vehiclesWithTrips.length} vehicle{vehiclesWithTrips.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {vehiclesWithTrips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                      <Car className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                    <p className="font-semibold text-muted-foreground">{t('no_vehicles_assigned')}</p>
                    <p className="text-sm text-muted-foreground">{t('no_vehicles_assigned_description')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {vehiclesWithTrips.map(({ vehicle, trips, assignmentDate }) => (
                      <div key={vehicle.id} className="p-6 space-y-5">

                        {/* Vehicle header */}
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-shrink-0">
                            {vehicle.imageUrl ? (
                              <img src={vehicle.imageUrl} alt={vehicle.name}
                                className="w-full sm:w-48 h-32 object-cover rounded-xl border border-border" />
                            ) : (
                              <div className="w-full sm:w-48 h-32 rounded-xl bg-muted flex items-center justify-center border border-border">
                                <Car className="h-10 w-10 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold">{vehicle.name}</h3>
                              <StatusBadge status={vehicle.status} />
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {vehicle.make} {vehicle.model} ({vehicle.year}) · {vehicle.plateNumber}
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                { label: t('type'),          value: vehicle.type },
                                { label: t('color'),         value: vehicle.color },
                                { label: t('mileage'),       value: `${vehicle.mileage} km` },
                                { label: t('rental_amount'), value: `$${vehicle.rentalAmount}` },
                              ].map(s => (
                                <div key={s.label} className="bg-muted/40 rounded-xl p-3">
                                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                                  <p className="text-sm font-semibold mt-0.5">{s.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Trip history */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <Route className="h-4 w-4 text-blue-500" />
                              {t('trip_history')}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {trips.length} trip{trips.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>

                          {trips.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 bg-muted/20 rounded-xl border border-dashed border-border">
                              <Route className="h-7 w-7 text-muted-foreground/40" />
                              <p className="text-sm text-muted-foreground">{t('no_trips_recorded')}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {t('assigned_on')}: {new Date(assignmentDate).toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {trips.map(trip => {
                                const isSelected = selectedTripId === trip.id;
                                return (
                                  <div
                                    key={trip.id}
                                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                                      isSelected
                                        ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30"
                                        : "border-border hover:border-blue-200 dark:hover:border-blue-800 hover:bg-muted/20"
                                    }`}
                                  >
                                    {/* Trip header row */}
                                    <div
                                      className="p-4 cursor-pointer"
                                      onClick={() => setSelectedTripId(isSelected ? null : trip.id)}
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                          <div className="flex items-center gap-1.5 text-sm">
                                            <Calendar className="h-4 w-4 text-blue-500" />
                                            <span className="font-semibold">
                                              {new Date(trip.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5" />
                                            {new Date(trip.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            {" → "}
                                            {new Date(trip.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                          </div>
                                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                            trip.isAutoEnded
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                          }`}>
                                            {trip.isAutoEnded ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                                            {trip.isAutoEnded ? t('auto_completed') : t('manually_ended')}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-sm">
                                          <span className="flex items-center gap-1 text-muted-foreground">
                                            <MapPin className="h-3.5 w-3.5" /> {trip.distance.toFixed(1)} km
                                          </span>
                                          <span className="flex items-center gap-1 text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5" /> {formatDuration(trip.startTime, trip.endTime)}
                                          </span>
                                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ml-1 ${
                                            isSelected ? "bg-blue-100 dark:bg-blue-900" : "bg-muted"
                                          }`}>
                                            {isSelected
                                              ? <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
                                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Coordinates */}
                                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <MapPin className="h-3 w-3 text-red-400 flex-shrink-0" />
                                          Start: {trip.startLatitude.toFixed(5)}, {trip.startLongitude.toFixed(5)}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <MapPin className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                                          End: {trip.endLatitude?.toFixed(5) ?? "N/A"}, {trip.endLongitude?.toFixed(5) ?? "N/A"}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Expanded map */}
                                    {isSelected && trip.routePoints && (
                                      <div className="px-4 pb-4 space-y-3 border-t border-blue-100 dark:border-blue-900 pt-3">
                                        <div className="rounded-xl overflow-hidden border border-border h-[380px]">
                                          <TripRouteMap
                                            startLatitude={trip.startLatitude}
                                            startLongitude={trip.startLongitude}
                                            endLatitude={trip.endLatitude}
                                            endLongitude={trip.endLongitude}
                                            routePoints={trip.routePoints}
                                            height="380px"
                                            darkMode={true}
                                          />
                                        </div>

                                        {trip.routePoints?.length > 0 ? (
                                          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 px-3 py-2 rounded-lg">
                                            <Navigation className="h-3.5 w-3.5 flex-shrink-0" />
                                            Route contains {trip.routePoints.length} tracking points
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 px-3 py-2 rounded-lg">
                                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                            No detailed route data available for this trip
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
