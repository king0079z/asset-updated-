// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovementTypeDetection, MovementType } from "@/hooks/useMovementTypeDetection";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Car, PersonStanding, Pause, HelpCircle, AlertTriangle,
  Zap, BarChart2, Clock, Route, MapPin, RefreshCw, Wifi, WifiOff,
  SatelliteDish, TrendingUp, Shield, Navigation, Play, CheckCircle,
  Timer, Gauge,
} from "lucide-react";

/* ─── helpers ─── */
function fmtDuration(minutes: number): string {
  if (!minutes || minutes < 1) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ─── movement config ─── */
const MOVEMENT_CONFIG = {
  [MovementType.VEHICLE]: {
    label: "In Vehicle",
    icon: Car,
    gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    badgeBg: "bg-emerald-500/20 text-emerald-300",
    pulse: "bg-emerald-400",
    description: "Moving in a vehicle",
  },
  [MovementType.WALKING]: {
    label: "Walking",
    icon: PersonStanding,
    gradient: "from-blue-500 to-indigo-600",
    bg: "bg-blue-500/10 border-blue-500/30",
    text: "text-blue-400",
    badgeBg: "bg-blue-500/20 text-blue-300",
    pulse: "bg-blue-400",
    description: "Moving on foot",
  },
  [MovementType.STATIONARY]: {
    label: "Stationary",
    icon: Pause,
    gradient: "from-slate-500 to-slate-600",
    bg: "bg-slate-500/10 border-slate-500/30",
    text: "text-slate-400",
    badgeBg: "bg-slate-500/20 text-slate-300",
    pulse: "bg-slate-400",
    description: "Not moving",
  },
  [MovementType.UNKNOWN]: {
    label: "Analyzing…",
    icon: HelpCircle,
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    badgeBg: "bg-amber-500/20 text-amber-300",
    pulse: "bg-amber-400",
    description: "Collecting sensor data",
  },
};

/* ─── small bar chart for live sensor ─── */
function AccelBar({ label, value, max = 3, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-slate-400 w-4">{label}</span>
      <div className="flex-1 h-2 bg-slate-700/60 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.15 }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-300 w-10 text-right">{value.toFixed(2)}</span>
    </div>
  );
}

/* ─── history dot row ─── */
function HistoryDot({ type }: { type: MovementType }) {
  const c = {
    [MovementType.VEHICLE]: "bg-emerald-400",
    [MovementType.WALKING]: "bg-blue-400",
    [MovementType.STATIONARY]: "bg-slate-500",
    [MovementType.UNKNOWN]: "bg-amber-400",
  };
  return <div className={`w-2 h-2 rounded-full shrink-0 ${c[type] || "bg-slate-500"}`} />;
}

/* ─── main page ─── */
export default function MovementAnalysisPage() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [liveAccel, setLiveAccel] = useState({ x: 0, y: 0, z: 0, magnitude: 0 });
  const [sensorTab, setSensorTab] = useState<"live" | "analysis" | "tips">("live");

  /* movement history: last 60s at 1s intervals */
  const [movementHistory, setMovementHistory] = useState<Array<{
    timestamp: Date; type: MovementType; confidence: number;
  }>>([]);

  /* GPS speed for movement classification */
  const [gpsSpeedKmh, setGpsSpeedKmh] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.speed !== null && pos.coords.speed >= 0) {
          setGpsSpeedKmh(pos.coords.speed * 3.6); // m/s → km/h
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const movementState = useMovementTypeDetection({
    sampleSize: 50,
    updateInterval: 1000,
    temporalSmoothing: true,
    gpsSpeedKmh,
  });

  /* live raw acceleration from DeviceMotion */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration || e.accelerationIncludingGravity;
      if (!acc) return;
      const x = acc.x ?? 0, y = acc.y ?? 0, z = acc.z ?? 0;
      setLiveAccel({ x, y, z, magnitude: Math.sqrt(x * x + y * y + z * z) });
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, []);

  /* record movement history */
  useEffect(() => {
    if (!movementState.lastUpdated) return;
    setMovementHistory(prev => {
      const next = [...prev, {
        timestamp: new Date(movementState.lastUpdated as Date),
        type: movementState.type,
        confidence: movementState.confidence,
      }];
      return next.length > 60 ? next.slice(-60) : next;
    });
  }, [movementState.lastUpdated, movementState.type]);

  /* fetch vehicle + analysis data */
  const fetchData = useCallback(async () => {
    try {
      const vRes = await fetch("/api/vehicles/my-vehicle");
      if (!vRes.ok) return;
      const vData = await vRes.json();
      setVehicleData(vData.vehicle);

      if (vData.vehicle?.id) {
        setAnalysisLoading(true);
        const aRes = await fetch(`/api/vehicles/movement-analysis?vehicleId=${vData.vehicle.id}&period=${period}`);
        if (aRes.ok) setAnalysisData(await aRes.json());
        setAnalysisLoading(false);
      }
    } catch { setAnalysisLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* summary stats */
  const vehiclePct = movementHistory.length
    ? Math.round(movementHistory.filter(h => h.type === MovementType.VEHICLE).length / movementHistory.length * 100) : 0;
  const walkingPct = movementHistory.length
    ? Math.round(movementHistory.filter(h => h.type === MovementType.WALKING).length / movementHistory.length * 100) : 0;
  const statPct = movementHistory.length
    ? Math.round(movementHistory.filter(h => h.type === MovementType.STATIONARY).length / movementHistory.length * 100) : 0;

  const currentCfg = MOVEMENT_CONFIG[movementState.type] ?? MOVEMENT_CONFIG[MovementType.UNKNOWN];
  const CurrentIcon = currentCfg.icon;

  const sensorAvailable = movementState.isSupported &&
    (movementState.permissionGranted !== false) &&
    movementState.lastUpdated !== null;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6 pb-10">

          {/* ━━━━━━━━━━━━━━ HERO BANNER ━━━━━━━━━━━━━━ */}
          <div
            className="relative overflow-hidden rounded-3xl shadow-2xl"
            style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 40%,#1e3a5f 100%)" }}
          >
            <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-blue-500/8 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 w-60 h-60 rounded-full bg-indigo-600/10 blur-3xl" />
            <div className="relative p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                    <Activity className="h-3.5 w-3.5 text-blue-300" />
                    <span className="text-blue-200 text-xs font-semibold tracking-wide uppercase">Movement Analysis</span>
                    {sensorAvailable && (
                      <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-black ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight">Movement Intelligence</h1>
                  <p className="text-indigo-200/70 mt-1.5 text-sm">
                    Real-time sensor analysis · Vehicle trip tracking · Pattern insights
                  </p>
                </div>
                <Button
                  onClick={fetchData}
                  disabled={analysisLoading}
                  variant="outline"
                  size="sm"
                  className="border-white/25 bg-white/10 text-white hover:bg-white/20 gap-2 shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${analysisLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {/* Hero KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    icon: CurrentIcon, label: "Current Mode", color: currentCfg.text,
                    value: currentCfg.label,
                    sub: movementState.lastUpdated
                      ? `${Math.round(movementState.confidence * 100)}% confidence`
                      : "Awaiting sensor data",
                    bg: "bg-white/8 border-white/12",
                  },
                  {
                    icon: Route, label: "Distance Today",
                    value: analysisData?.totalDistance != null ? `${analysisData.totalDistance} km` : "—",
                    sub: vehicleData?.name || "No active vehicle",
                    color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-400/25",
                  },
                  {
                    icon: Timer, label: "Drive Time",
                    value: analysisData?.totalDrivingTime != null ? fmtDuration(analysisData.totalDrivingTime) : "—",
                    sub: `${period === "day" ? "Last 24h" : period === "week" ? "Last 7d" : "Last 30d"}`,
                    color: "text-violet-400", bg: "bg-violet-500/10 border-violet-400/25",
                  },
                  {
                    icon: MapPin, label: "Stops Detected",
                    value: analysisData?.destinations != null ? String(analysisData.destinations.length) : "—",
                    sub: "location stops",
                    color: "text-amber-400", bg: "bg-amber-500/10 border-amber-400/25",
                  },
                ].map(({ icon: Icon, label, value, sub, color, bg }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={`rounded-2xl p-4 border ${bg}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${color || "text-slate-400"}`} />
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${color || "text-slate-400"} opacity-80`}>{label}</span>
                    </div>
                    <p className={`text-2xl font-black ${color || "text-white"}`}>{value}</p>
                    <p className="text-slate-400 text-xs mt-1">{sub}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━ TABS ━━━━━━━━━━━━━━ */}
          <div className="flex gap-1 bg-muted/40 border rounded-2xl p-1 w-fit">
            {(["live", "analysis", "tips"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSensorTab(tab)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
                  sensorTab === tab
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "live" ? "Live Sensor" : tab === "analysis" ? "Trip Analysis" : "Tips & Help"}
              </button>
            ))}
          </div>

          {/* ━━━━━━━━━━━━━━ LIVE SENSOR TAB ━━━━━━━━━━━━━━ */}
          {sensorTab === "live" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Current Movement State */}
              <div className={`rounded-3xl border p-6 ${currentCfg.bg} relative overflow-hidden`}>
                <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-2xl"
                  style={{ background: `radial-gradient(circle, var(--tw-gradient-stops))` }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Current Movement</p>
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl bg-gradient-to-br ${currentCfg.gradient} shadow-lg`}>
                          <CurrentIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-extrabold">{currentCfg.label}</h2>
                          <p className="text-sm text-muted-foreground">{currentCfg.description}</p>
                        </div>
                      </div>
                    </div>
                    {sensorAvailable && (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${currentCfg.pulse} animate-pulse`} />
                        <span className="text-xs font-semibold text-muted-foreground">LIVE</span>
                      </div>
                    )}
                  </div>

                  {/* Sensor permission / support states */}
                  {!movementState.isSupported && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 mb-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-300">Motion sensors unavailable</p>
                          <p className="text-xs text-amber-400/70 mt-0.5">
                            This device or browser doesn't support motion sensors. Trip analysis below uses GPS data instead.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {movementState.isSupported && movementState.permissionGranted === false && (
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <SatelliteDish className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-300">Motion permission denied</p>
                          <p className="text-xs text-red-400/70 mt-0.5">Please allow motion sensor access in your browser settings.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {movementState.isSupported && movementState.permissionGranted === null && (
                    <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-4 mb-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-blue-300">Enable Motion Sensors</p>
                          <p className="text-xs text-blue-400/70 mt-0.5">Tap below to allow real-time movement detection.</p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shrink-0"
                          onClick={movementState.requestPermission}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Enable
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Confidence bar */}
                  {movementState.lastUpdated && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Detection confidence</span>
                        <span className={`font-bold ${currentCfg.text}`}>{Math.round(movementState.confidence * 100)}%</span>
                      </div>
                      <Progress value={movementState.confidence * 100} className="h-2.5 rounded-full" />
                    </div>
                  )}

                  {/* Mode breakdown */}
                  {movementState.details && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { label: "Vehicle", value: movementState.details.vehicleConfidence, color: "bg-emerald-500" },
                        { label: "Walking", value: movementState.details.walkingConfidence, color: "bg-blue-500" },
                        { label: "Still", value: movementState.details.stationaryConfidence, color: "bg-slate-500" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-xl bg-muted/40 border p-2 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                          <div className="h-1.5 bg-muted rounded-full mb-1">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${(value || 0) * 100}%` }} />
                          </div>
                          <p className="text-xs font-bold">{Math.round((value || 0) * 100)}%</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {movementState.lastUpdated && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Last reading: {fmtTime(movementState.lastUpdated)} · {movementHistory.length} samples
                    </p>
                  )}
                </div>
              </div>

              {/* Live Accelerometer */}
              <div className="rounded-3xl border bg-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Accelerometer</p>
                    <h3 className="text-lg font-bold">Live Sensor Data</h3>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    movementState.isSupported && movementState.lastUpdated
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground border"
                  }`}>
                    {movementState.isSupported && movementState.lastUpdated
                      ? <><Wifi className="h-3 w-3" /> Active</>
                      : <><WifiOff className="h-3 w-3" /> Inactive</>
                    }
                  </div>
                </div>

                {movementState.isSupported && movementState.lastUpdated ? (
                  <div className="space-y-3">
                    <AccelBar label="X" value={liveAccel.x} color="bg-red-400" />
                    <AccelBar label="Y" value={liveAccel.y} color="bg-green-400" />
                    <AccelBar label="Z" value={liveAccel.z} color="bg-blue-400" />
                    <div className="h-px bg-border my-2" />
                    <AccelBar label="Σ" value={liveAccel.magnitude} max={5} color="bg-violet-400" />

                    {movementState.details?.frequency != null && (
                      <div className="flex items-center justify-between mt-3 p-3 rounded-xl bg-muted/40 border">
                        <span className="text-xs text-muted-foreground">Step frequency</span>
                        <span className="text-sm font-bold">{movementState.details.frequency.toFixed(1)} Hz</span>
                      </div>
                    )}
                    {movementState.details?.avgMagnitude != null && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                        <span className="text-xs text-muted-foreground">Dynamic magnitude</span>
                        <span className="text-sm font-bold">{movementState.details.avgMagnitude.toFixed(3)} m/s²</span>
                      </div>
                    )}

                    {/* GPS speed */}
                    {gpsSpeedKmh !== undefined && (
                      <div className={`flex items-center justify-between p-3 rounded-xl border ${
                        gpsSpeedKmh >= 15 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/40'
                      }`}>
                        <span className="text-xs text-muted-foreground">GPS speed</span>
                        <span className={`text-sm font-bold ${gpsSpeedKmh >= 15 ? 'text-emerald-400' : ''}`}>
                          {gpsSpeedKmh.toFixed(1)} km/h
                          {gpsSpeedKmh >= 15 && <span className="ml-1 text-[10px] font-semibold opacity-70">→ Vehicle</span>}
                        </span>
                      </div>
                    )}

                    {/* Algorithm diagnostics */}
                    {movementState.details?.diagnostics && (
                      <div className="mt-1 space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-0.5">Algorithm signals</p>
                        {[
                          { label: "Step autocorrelation", value: movementState.details.diagnostics.autocorrelation, hint: ">0.35 = walking" },
                          { label: "Step regularity", value: movementState.details.diagnostics.stepRegularity, hint: ">0.5 = walking" },
                          { label: "Jerk (impulsiveness)", value: movementState.details.diagnostics.jerkScore, hint: ">0.4 = walking" },
                          { label: "Horizontal dominance", value: movementState.details.diagnostics.horizontalDominance, hint: ">0.6 = vehicle" },
                        ].map(({ label, value, hint }) => (
                          <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border">
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground">{label}</p>
                              <p className="text-[9px] text-muted-foreground/50">{hint}</p>
                            </div>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, value * 100)}%` }} />
                            </div>
                            <span className="text-xs font-mono font-bold w-8 text-right">{(value * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-2xl bg-muted mb-4">
                      <Gauge className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="font-semibold mb-1">No sensor data</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {!movementState.isSupported
                        ? "This device doesn't have motion sensors. Use the Trip Analysis tab."
                        : "Enable motion sensor access to see live readings."}
                    </p>
                    {movementState.isSupported && movementState.permissionGranted === null && (
                      <Button className="mt-4 gap-2" size="sm" onClick={movementState.requestPermission}>
                        <Play className="h-3.5 w-3.5" /> Enable Sensors
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* 60-second timeline */}
              <div className="lg:col-span-2 rounded-3xl border bg-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Last 60 seconds</p>
                    <h3 className="text-lg font-bold">Movement Timeline</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {[
                      { label: "Vehicle", color: "bg-emerald-400" },
                      { label: "Walking", color: "bg-blue-400" },
                      { label: "Still", color: "bg-slate-500" },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-muted-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {movementHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-4 rounded-2xl bg-muted mb-4">
                      <BarChart2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-semibold mb-1">Collecting movement data…</p>
                    <p className="text-sm text-muted-foreground">
                      {movementState.isSupported
                        ? "Sensor is active. History will appear here within a few seconds."
                        : "Enable sensors or check the Trip Analysis tab for historical data."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Dot chart */}
                    <div className="flex gap-0.5 items-end h-10 mb-4">
                      {movementHistory.map((h, i) => {
                        const colors = {
                          [MovementType.VEHICLE]: "bg-emerald-400",
                          [MovementType.WALKING]: "bg-blue-400",
                          [MovementType.STATIONARY]: "bg-slate-500",
                          [MovementType.UNKNOWN]: "bg-amber-400/40",
                        };
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm ${colors[h.type] || "bg-muted"}`}
                            style={{ height: `${20 + h.confidence * 20}px`, opacity: 0.7 + h.confidence * 0.3 }}
                            title={`${h.type} @ ${h.confidence.toFixed(2)}`}
                          />
                        );
                      })}
                    </div>

                    {/* Summary bars */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "In Vehicle", pct: vehiclePct, color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
                        { label: "Walking", pct: walkingPct, color: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
                        { label: "Stationary", pct: statPct, color: "bg-slate-500", text: "text-slate-600 dark:text-slate-400" },
                      ].map(({ label, pct, color, text }) => (
                        <div key={label} className="rounded-xl bg-muted/40 border p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                          <div className="h-1.5 bg-muted rounded-full mb-2">
                            <motion.div
                              className={`h-full rounded-full ${color}`}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <p className={`text-xl font-black ${text}`}>{pct}%</p>
                        </div>
                      ))}
                    </div>

                    {/* Recent entries */}
                    <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
                      {movementHistory.slice(-10).reverse().map((entry, i) => {
                        const cfg = MOVEMENT_CONFIG[entry.type] ?? MOVEMENT_CONFIG[MovementType.UNKNOWN];
                        const EntryIcon = cfg.icon;
                        return (
                          <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-muted/40 transition-colors">
                            <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                              <EntryIcon className={`h-3.5 w-3.5 ${cfg.text}`} />
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-semibold">{cfg.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">{Math.round(entry.confidence * 100)}% confidence</span>
                            </div>
                            <time className="text-xs text-muted-foreground">{fmtTime(entry.timestamp)}</time>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ━━━━━━━━━━━━━━ TRIP ANALYSIS TAB ━━━━━━━━━━━━━━ */}
          {sensorTab === "analysis" && (
            <div className="space-y-5">
              {/* Period selector */}
              <div className="flex items-center gap-2">
                {(["day", "week", "month"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      period === p
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {p === "day" ? "Last 24h" : p === "week" ? "Last 7 days" : "Last 30 days"}
                  </button>
                ))}
              </div>

              {!vehicleData ? (
                <div className="rounded-3xl border bg-card p-10 flex flex-col items-center justify-center text-center gap-4">
                  <div className="p-5 rounded-3xl bg-muted">
                    <Car className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">No Vehicle Assigned</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">You need an active vehicle rental to see trip analysis data.</p>
                  </div>
                </div>
              ) : analysisLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
                </div>
              ) : analysisData ? (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        icon: Route, label: "Total Distance",
                        value: `${analysisData.totalDistance} km`,
                        sub: "driven in period",
                        gradient: "from-cyan-500 to-blue-600",
                        bg: "bg-cyan-500/10 border-cyan-400/30",
                        text: "text-cyan-400",
                      },
                      {
                        icon: Clock, label: "Drive Time",
                        value: fmtDuration(analysisData.totalDrivingTime),
                        sub: "total driving time",
                        gradient: "from-violet-500 to-purple-600",
                        bg: "bg-violet-500/10 border-violet-400/30",
                        text: "text-violet-400",
                      },
                      {
                        icon: MapPin, label: "Stops",
                        value: String(analysisData.destinations?.length ?? 0),
                        sub: "unique locations",
                        gradient: "from-amber-500 to-orange-600",
                        bg: "bg-amber-500/10 border-amber-400/30",
                        text: "text-amber-400",
                      },
                    ].map(({ icon: Icon, label, value, sub, gradient, bg, text }, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-3xl border p-6 ${bg}`}
                      >
                        <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg mb-4`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                        <p className={`text-3xl font-black ${text}`}>{value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Vehicle info */}
                  <div className="rounded-3xl border bg-card p-5 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 shadow">
                      <Car className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{vehicleData.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {vehicleData.plateNumber} · {vehicleData.make} {vehicleData.model} {vehicleData.year}
                      </p>
                    </div>
                    {analysisData.firstTimestamp && (
                      <div className="ml-auto text-right">
                        <p className="text-xs text-muted-foreground">Data from</p>
                        <p className="text-sm font-semibold">
                          {fmtDate(analysisData.firstTimestamp)} → {fmtDate(analysisData.lastTimestamp)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stops / Destinations */}
                  {analysisData.destinations && analysisData.destinations.length > 0 ? (
                    <div className="rounded-3xl border bg-card overflow-hidden">
                      <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                          <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-bold">Location Stops</h3>
                          <p className="text-xs text-muted-foreground">{analysisData.destinations.length} stops detected</p>
                        </div>
                      </div>
                      <div className="divide-y">
                        {analysisData.destinations.map((dest: any, i: number) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold text-sm shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">
                                {fmtTime(dest.startTime)} → {fmtTime(dest.endTime)}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {dest.latitude?.toFixed(4)}, {dest.longitude?.toFixed(4)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold">{fmtDuration(dest.duration)}</p>
                              <p className="text-xs text-muted-foreground">
                                {dest.isCompletedTrip ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-500">
                                    <CheckCircle className="h-3 w-3" /> Trip end
                                  </span>
                                ) : "Stop"}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border bg-card p-10 flex flex-col items-center justify-center text-center gap-3">
                      <div className="p-4 rounded-2xl bg-muted">
                        <Navigation className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-semibold">No stops recorded</p>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        {analysisData.totalDistance > 0
                          ? "No stops long enough (10+ min) were detected in this period."
                          : analysisData.message || "No movement data recorded in this period."}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-3xl border bg-card p-10 flex flex-col items-center justify-center text-center gap-3">
                  <div className="p-4 rounded-2xl bg-muted">
                    <BarChart2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-semibold">No trip data available</p>
                  <p className="text-sm text-muted-foreground">Trip analysis will appear once location tracking records data.</p>
                </div>
              )}
            </div>
          )}

          {/* ━━━━━━━━━━━━━━ TIPS TAB ━━━━━━━━━━━━━━ */}
          {sensorTab === "tips" && (
            <div className="space-y-4">
              {[
                {
                  icon: Gauge, title: "How Movement Is Detected",
                  gradient: "from-blue-500 to-indigo-600",
                  items: [
                    "Your device's accelerometer measures motion in 3 axes (X, Y, Z) at 40Hz",
                    "Vehicle movement shows lower frequency with horizontal dominance",
                    "Walking produces a rhythmic 1.5–2.5 Hz pattern with vertical dominance",
                    "Stationary state detected when acceleration is below 0.3 m/s²",
                    "A confidence score of 50%+ is required to report a state",
                  ],
                },
                {
                  icon: Shield, title: "Tips for Better Accuracy",
                  gradient: "from-emerald-500 to-teal-600",
                  items: [
                    "Keep your phone in your pocket or mounted on the dashboard",
                    "Avoid holding the phone loose during vehicle movement",
                    "Allow 3–5 seconds after starting to move for detection to settle",
                    "Keep the app in the foreground for the most responsive updates",
                    "On iOS 13+, tap 'Enable Sensors' to grant motion permission",
                  ],
                },
                {
                  icon: AlertTriangle, title: "Known Limitations",
                  gradient: "from-amber-500 to-orange-600",
                  items: [
                    "Desktop browsers don't have motion sensors — use Trip Analysis instead",
                    "Rough roads may briefly show 'walking' while in a vehicle",
                    "Sensor data is not stored on server; it's processed locally in your browser",
                    "iOS requires explicit permission to access motion sensors",
                    "Some older Android devices may have lower sensor precision",
                  ],
                },
              ].map(({ icon: Icon, title, gradient, items }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-3xl border bg-card overflow-hidden"
                >
                  <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-bold text-base">{title}</h3>
                  </div>
                  <div className="p-5 space-y-2">
                    {items.map((item, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
