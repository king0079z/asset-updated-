import { useState, useEffect, useMemo } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const DRIVERS_KEY = "/api/drivers";
const DRIVERS_TTL = 60_000;
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, User, Car, AlertTriangle, Search, MapPin,
  Clock, Route, TrendingUp, Users, ArrowRight, X,
} from "lucide-react";
import { useRouter } from "next/router";

interface Driver {
  id: string;
  email: string;
  createdAt: string;
  vehicleCount: number;
  tripCount: number;
  totalDistance: number;
  totalHours: number;
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-indigo-700",
  "from-emerald-500 to-teal-700",
  "from-rose-500 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-sky-700",
];

const DriverAvatar = ({ email, size = "md" }: { email: string; size?: "sm" | "md" | "lg" }) => {
  const initials = (email ?? "??").slice(0, 2).toUpperCase();
  const idx = (email?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  const dim = size === "lg" ? "w-16 h-16 text-xl" : size === "md" ? "w-12 h-12 text-base" : "w-9 h-9 text-xs";
  return (
    <div className={`${dim} rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[idx]} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md`}>
      {initials}
    </div>
  );
};

const StatChip = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) => (
  <div className="flex items-center gap-2">
    <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
      <Icon className="h-3.5 w-3.5 text-white" />
    </div>
    <div>
      <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
      <p className="text-sm font-semibold leading-tight">{value}</p>
    </div>
  </div>
);

export default function DriversPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>(() => getFromCache<any>(DRIVERS_KEY, DRIVERS_TTL)?.drivers ?? []);
  const [loading, setLoading] = useState(() => !getFromCache(DRIVERS_KEY, DRIVERS_TTL));
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (getFromCache(DRIVERS_KEY, DRIVERS_TTL)) {
      setTimeout(() => fetchDrivers(true), 300);
    } else {
      fetchDrivers(false);
    }
  }, []);

  const fetchDrivers = async (background = false) => {
    if (!background) { setLoading(true); setError(null); }
    try {
      const data = await fetchWithCache<any>(DRIVERS_KEY, { maxAge: DRIVERS_TTL });
      setDrivers(data?.drivers ?? []);
    } catch {
      if (!background) setError("Failed to fetch drivers");
    } finally {
      if (!background) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDrivers();
    setIsRefreshing(false);
  };

  // Summary stats
  const stats = useMemo(() => ({
    total:    drivers.length,
    trips:    drivers.reduce((s, d) => s + d.tripCount, 0),
    distance: drivers.reduce((s, d) => s + d.totalDistance, 0),
    hours:    drivers.reduce((s, d) => s + d.totalHours, 0),
  }), [drivers]);

  // Filtered
  const filtered = useMemo(() =>
    drivers.filter(d => d.email.toLowerCase().includes(search.toLowerCase())),
    [drivers, search]
  );

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-8">

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-violet-800 to-slate-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.3),transparent_60%)]" />
            <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-violet-400/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-64 h-24 rounded-full bg-indigo-400/10 blur-2xl" />

            <div className="relative z-10 px-8 pt-8 pb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">{t('drivers_management')}</h1>
                  <p className="text-violet-200 text-sm mt-0.5">{t('drivers_management_description')}</p>
                </div>
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
            <div className="relative z-10 px-8 pb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Drivers",   value: loading ? "—" : stats.total,                    icon: Users,      color: "text-violet-300" },
                { label: "Total Trips",     value: loading ? "—" : stats.trips,                    icon: Route,      color: "text-blue-300" },
                { label: "Total Distance",  value: loading ? "—" : `${stats.distance.toFixed(0)} km`, icon: MapPin,  color: "text-emerald-300" },
                { label: "Total Hours",     value: loading ? "—" : `${stats.hours.toFixed(1)} h`,  icon: Clock,      color: "text-amber-300" },
              ].map(s => (
                <div key={s.label} className="bg-white/8 backdrop-blur border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-violet-200 font-medium">{s.label}</span>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Search ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers by email…"
                className="pl-9 rounded-xl"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSearch("")}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              {filtered.length} driver{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* ── Error ──────────────────────────────────────────────────── */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{t('error_fetching_data')}</p>
                <p className="text-xs mt-0.5">{error}</p>
                <button onClick={() => fetchDrivers()} className="text-xs underline mt-1 hover:opacity-75">{t('try_again')}</button>
              </div>
            </div>
          )}

          {/* ── Driver Cards ────────────────────────────────────────────── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-14 rounded-xl" />
                  </div>
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search ? "No drivers match your search" : t('no_drivers_found')}
              </p>
              <p className="text-sm text-muted-foreground">{t('no_drivers_description')}</p>
              {search && (
                <Button variant="outline" size="sm" className="rounded-xl mt-2" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(driver => {
                const idx = (driver.email?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length;
                return (
                  <div
                    key={driver.id}
                    className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 cursor-pointer"
                    onClick={() => router.push(`/drivers/${driver.id}`)}
                  >
                    {/* Card header strip */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${AVATAR_GRADIENTS[idx]}`} />

                    <div className="p-5 space-y-4">
                      {/* Driver identity */}
                      <div className="flex items-center gap-3">
                        <DriverAvatar email={driver.email} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{driver.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Joined {new Date(driver.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                          {driver.vehicleCount} {driver.vehicleCount === 1 ? "vehicle" : "vehicles"}
                        </Badge>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: t('total_trips'),    value: driver.tripCount,                    icon: Route,   color: "bg-blue-500" },
                          { label: t('vehicles_assigned'), value: driver.vehicleCount,              icon: Car,     color: "bg-violet-500" },
                          { label: `${t('total_distance')} (km)`, value: driver.totalDistance.toFixed(1), icon: MapPin, color: "bg-emerald-500" },
                          { label: t('total_hours'),    value: `${driver.totalHours.toFixed(1)} h`, icon: Clock,   color: "bg-amber-500" },
                        ].map(s => (
                          <div key={s.label} className="bg-muted/40 rounded-xl p-3">
                            <StatChip label={s.label} value={s.value} icon={s.icon} color={s.color} />
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl gap-2 group-hover:bg-indigo-50 group-hover:border-indigo-300 group-hover:text-indigo-700 dark:group-hover:bg-indigo-950 dark:group-hover:border-indigo-700 dark:group-hover:text-indigo-300 transition-colors"
                        onClick={e => { e.stopPropagation(); router.push(`/drivers/${driver.id}`); }}
                      >
                        {t('view_details')}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
