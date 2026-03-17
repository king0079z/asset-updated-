// @ts-nocheck
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Package, User, Search, RefreshCw, Loader2,
  MapPin, DollarSign, Calendar, Tag, Boxes, ChevronRight,
  AlertCircle, CheckCircle2, Clock, XCircle, Wrench,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Asset {
  id: string; assetId: string; name: string; type: string; status: string;
  imageUrl?: string; floorNumber?: string; roomNumber?: string;
  purchaseAmount?: number; purchaseDate?: string; barcode?: string;
  createdAt: string; lastMovedAt?: string;
  assignedToName?: string; assignedToEmail?: string; assignedToId?: string;
  assignedAt?: string; vendor?: { name: string };
}

const STATUS_CFG = {
  ACTIVE:      { label: "Active",      color: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: CheckCircle2 },
  INACTIVE:    { label: "Inactive",    color: "text-slate-500 dark:text-slate-400",     border: "border-slate-200 dark:border-slate-600",     bg: "bg-slate-50 dark:bg-slate-800",          icon: XCircle },
  MAINTENANCE: { label: "Maintenance", color: "text-amber-700 dark:text-amber-300",     border: "border-amber-200 dark:border-amber-700",     bg: "bg-amber-50 dark:bg-amber-950/40",       icon: Wrench },
  DISPOSED:    { label: "Disposed",    color: "text-red-600 dark:text-red-400",         border: "border-red-200 dark:border-red-700",         bg: "bg-red-50 dark:bg-red-950/40",           icon: XCircle },
};

function fmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function currency(n?: number) {
  if (!n) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function timeAgo(d?: string) {
  if (!d) return "—";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

export default function StaffAssetsPage() {
  const router = useRouter();
  const { userId } = router.query as { userId?: string };

  const [assets, setAssets]       = useState<Asset[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");

  const fetchAssets = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/assets/by-user?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Failed to load assets");
      const data = await res.json();
      const list: Asset[] = data.assets ?? [];
      setAssets(list);
      if (list.length > 0) {
        setStaffName(list[0].assignedToName ?? "");
        setStaffEmail(list[0].assignedToEmail ?? "");
      }
    } catch (e: any) { setError(e.message ?? "Something went wrong"); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const filtered = assets.filter(a => {
    const q = search.toLowerCase();
    return (
      (!q || a.name?.toLowerCase().includes(q) || (a.assetId ?? "").toLowerCase().includes(q) || (a.type ?? "").toLowerCase().includes(q)) &&
      (!statusFilter || a.status === statusFilter)
    );
  });

  const stats = {
    total:       assets.length,
    active:      assets.filter(a => a.status === "ACTIVE").length,
    maintenance: assets.filter(a => a.status === "MAINTENANCE").length,
    inactive:    assets.filter(a => a.status === "INACTIVE" || a.status === "DISPOSED").length,
  };

  const initials = staffName
    ? staffName.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)
    : (staffEmail?.[0] ?? "?").toUpperCase();

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6 p-6">
          {/* Back */}
          <Link href="/tickets"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Tickets
          </Link>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-xl font-black text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {loading && !staffName ? "Loading…" : staffName || "Staff Member"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{staffEmail || (loading ? "" : "No email")}</p>
              </div>
            </div>
            <Button variant="outline" onClick={fetchAssets} disabled={loading} className="gap-2 self-start md:self-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Assets",  value: stats.total,       from: "from-slate-50 dark:from-slate-800",          text: "text-slate-700 dark:text-slate-200" },
              { label: "Active",        value: stats.active,      from: "from-emerald-50 dark:from-emerald-950/50",    text: "text-emerald-700 dark:text-emerald-300" },
              { label: "Maintenance",   value: stats.maintenance, from: "from-amber-50 dark:from-amber-950/50",        text: "text-amber-700 dark:text-amber-300" },
              { label: "Inactive",      value: stats.inactive,    from: "from-slate-50 dark:from-slate-800",           text: "text-slate-500 dark:text-slate-400" },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.from} to-white dark:to-slate-900 border border-slate-100 dark:border-slate-700 p-4`}>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.label}</p>
                <p className={`mt-1 text-3xl font-black ${s.text}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input placeholder="Search by name, ID or type…" className="pl-10 rounded-xl"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700">
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DISPOSED">Disposed</option>
            </select>
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/30 py-16 text-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="font-semibold text-red-700 dark:text-red-300">{error}</p>
              <Button variant="outline" onClick={fetchAssets} className="gap-2"><RefreshCw className="h-4 w-4" /> Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 py-16 text-center">
              <Boxes className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {assets.length === 0 ? "No assets assigned to this staff member" : "No assets match your filters"}
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                {assets.length === 0 ? "Assign assets in the Assets section to see them here" : "Try adjusting your search or filter"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(asset => {
                const cfg = STATUS_CFG[asset.status] ?? STATUS_CFG.INACTIVE;
                const Icon = cfg.icon;
                return (
                  <Link key={asset.id} href={`/assets/${asset.id}`}
                    className="group flex flex-col rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all overflow-hidden">

                    {/* Image */}
                    <div className="relative h-36 w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 overflow-hidden">
                      {asset.imageUrl ? (
                        // Use plain <img> to avoid Next.js domain restrictions + CORS issues
                        <img
                          src={asset.imageUrl}
                          alt={asset.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-12 w-12 text-slate-200 dark:text-slate-600" />
                        </div>
                      )}
                      {/* Status badge */}
                      <span className={`absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </span>
                      {/* Type badge */}
                      {asset.type && (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          <Tag className="h-2.5 w-2.5" /> {asset.type}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{asset.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{asset.assetId || asset.id.slice(0, 8)}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 shrink-0 mt-1 transition-colors" />
                      </div>
                      <div className="mt-auto space-y-1.5">
                        {(asset.floorNumber || asset.roomNumber) && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            Floor {asset.floorNumber}{asset.roomNumber ? ` · Room ${asset.roomNumber}` : ""}
                          </div>
                        )}
                        {asset.purchaseAmount && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <DollarSign className="h-3.5 w-3.5 shrink-0" /> {currency(asset.purchaseAmount)}
                          </div>
                        )}
                        {asset.assignedAt && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Calendar className="h-3.5 w-3.5 shrink-0" /> Assigned {timeAgo(asset.assignedAt)}
                          </div>
                        )}
                        {asset.vendor?.name && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{asset.vendor.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
