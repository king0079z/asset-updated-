import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, X, Users, Package, ChevronRight, UserCheck,
  CheckCircle2, AlertCircle, XCircle, Building2, DollarSign,
  Calendar, ArrowLeft, Loader2, User, Tag, MapPin, Clock,
  ShieldAlert,
} from "lucide-react";
import { UserClearanceDialog } from "./UserClearanceDialog";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface UserSummary {
  userId: string;
  name: string | null;
  email: string | null;
  total: number;
  active: number;
}

interface Asset {
  id: string; assetId: string; name: string; type: string;
  status: "ACTIVE" | "IN_TRANSIT" | "DISPOSED";
  imageUrl?: string | null;
  floorNumber?: string | null; roomNumber?: string | null;
  purchaseAmount?: number | null; purchaseDate?: string | null;
  barcode?: string | null; createdAt: string;
  assignedToName?: string | null; assignedToEmail?: string | null;
  assignedAt?: string | null;
  vendor?: { name: string } | null;
}

interface UserAssetsPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called when user clicks "View Details" on an asset */
  onViewAsset?: (asset: Asset) => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  "from-indigo-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-blue-500 to-cyan-600",
  "from-purple-500 to-fuchsia-600",
];

function avatarGradient(id: string) {
  let n = 0;
  for (const c of id) n += c.charCodeAt(0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function initials(name: string | null, email: string | null) {
  if (name) return name.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function isValidImage(url?: string | null): url is string {
  if (!url) return false;
  try { const p = new URL(url); return p.protocol === "http:" || p.protocol === "https:"; }
  catch { return false; }
}

const STATUS_CFG = {
  ACTIVE:     { label: "Active",     dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800" },
  IN_TRANSIT: { label: "In Transit", dot: "bg-amber-500",   cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" },
  DISPOSED:   { label: "Disposed",   dot: "bg-red-500",     cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800" },
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function UserAvatar({ userId, name, email, size = "md" }: { userId: string; name: string | null; email: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${avatarGradient(userId)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials(name, email)}
    </div>
  );
}

function AssetCard({ asset, onView }: { asset: Asset; onView: () => void }) {
  const st = STATUS_CFG[asset.status] ?? STATUS_CFG.ACTIVE;
  const hasImg = isValidImage(asset.imageUrl);

  return (
    <div className="group rounded-2xl border border-border bg-card hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Image strip */}
      <div className="h-28 relative overflow-hidden">
        {hasImg ? (
          <img src={asset.imageUrl!} alt={asset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
            <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${st.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${asset.status === "ACTIVE" ? "animate-pulse" : ""}`} />
            {st.label}
          </span>
        </div>
        {/* Type chip */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
            {asset.type}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <div>
          <h4 className="font-bold text-sm leading-tight line-clamp-1">{asset.name}</h4>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{asset.assetId}</p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground">
          {(asset.floorNumber || asset.roomNumber) && (
            <span className="flex items-center gap-1 col-span-2">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              {[asset.floorNumber && `Floor ${asset.floorNumber}`, asset.roomNumber && `Room ${asset.roomNumber}`].filter(Boolean).join(" · ")}
            </span>
          )}
          {asset.purchaseAmount && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 flex-shrink-0" />
              QAR {asset.purchaseAmount.toLocaleString()}
            </span>
          )}
          {asset.vendor?.name && (
            <span className="flex items-center gap-1 truncate">
              <Tag className="h-3 w-3 flex-shrink-0" />
              {asset.vendor.name}
            </span>
          )}
          {asset.assignedAt && (
            <span className="flex items-center gap-1 col-span-2">
              <Clock className="h-3 w-3 flex-shrink-0" />
              Assigned {new Date(asset.assignedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onView}
          className="w-full h-7 text-xs rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
        >
          View Details <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function UserAssetsPanel({ open, onOpenChange, onViewAsset }: UserAssetsPanelProps) {
  const [userSearch, setUserSearch]     = useState("");
  const [users, setUsers]               = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [assets, setAssets]             = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetSearch, setAssetSearch]   = useState("");
  const [clearanceOpen, setClearanceOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Fetch user list */
  const loadUsers = useCallback(async (q: string) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("search", q.trim());
      const r = await fetch(`/api/assets/by-user?${params}`);
      if (r.ok) setUsers((await r.json()).users ?? []);
    } catch { /* ignore */ } finally { setUsersLoading(false); }
  }, []);

  /* Fetch assets for selected user */
  const loadAssets = useCallback(async (uid: string) => {
    setAssetsLoading(true);
    setAssets([]);
    try {
      const r = await fetch(`/api/assets/by-user?userId=${uid}`);
      if (r.ok) setAssets((await r.json()).assets ?? []);
    } catch { /* ignore */ } finally { setAssetsLoading(false); }
  }, []);

  /* On open → load users */
  useEffect(() => {
    if (open) { setSelectedUser(null); setAssetSearch(""); loadUsers(""); }
  }, [open]);

  /* Debounced user search */
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadUsers(userSearch), 300);
  }, [userSearch, open]);

  /* Load assets when user selected */
  useEffect(() => {
    if (selectedUser) loadAssets(selectedUser.userId);
  }, [selectedUser]);

  /* Filtered assets by name/id */
  const filteredAssets = assets.filter(a => {
    if (!assetSearch.trim()) return true;
    const q = assetSearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.assetId.toLowerCase().includes(q) || (a.type || "").toLowerCase().includes(q);
  });

  const totalAssigned = users.reduce((s, u) => s + u.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[90dvh] flex flex-col">
        <VisuallyHidden>
          <DialogTitle>User Asset Assignments</DialogTitle>
          <DialogDescription>Search for users and view the assets assigned to them.</DialogDescription>
        </VisuallyHidden>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div className="relative flex-shrink-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 pb-5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {selectedUser ? (
                <button
                  onClick={() => { setSelectedUser(null); setAssets([]); setAssetSearch(""); }}
                  className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                {selectedUser ? (
                  <>
                    <p className="text-white/60 text-xs font-medium mb-0.5">Assets assigned to</p>
                    <div className="flex items-center gap-2">
                      <UserAvatar userId={selectedUser.userId} name={selectedUser.name} email={selectedUser.email} size="sm" />
                      <div>
                        <h2 className="text-lg font-bold text-white leading-tight">
                          {selectedUser.name || selectedUser.email || "Unknown User"}
                        </h2>
                        {selectedUser.name && selectedUser.email && (
                          <p className="text-white/50 text-xs">{selectedUser.email}</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-white">User Asset Assignments</h2>
                    <p className="text-white/60 text-xs mt-0.5">
                      {users.length} users · {totalAssigned} total assignments
                    </p>
                  </>
                )}
              </div>
            </div>

              {/* Summary chips + Clearance button */}
              {selectedUser && (
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  <div className="rounded-xl bg-white/15 border border-white/20 px-3 py-1.5 text-center">
                    <p className="text-white font-bold text-lg leading-none">{selectedUser.total}</p>
                    <p className="text-white/60 text-[10px] mt-0.5">Total</p>
                  </div>
                  <div className="rounded-xl bg-emerald-400/20 border border-emerald-300/30 px-3 py-1.5 text-center">
                    <p className="text-white font-bold text-lg leading-none">{selectedUser.active}</p>
                    <p className="text-white/60 text-[10px] mt-0.5">Active</p>
                  </div>
                  {assets.length > 0 && (
                    <button
                      onClick={() => setClearanceOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/30 hover:bg-red-500/50 border border-red-400/40 text-white text-xs font-bold transition-all"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Start Clearance</span>
                      <span className="sm:hidden">Clearance</span>
                    </button>
                  )}
                </div>
              )}
          </div>

          {/* Search bar */}
          <div className="relative mt-4 z-10">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
            {selectedUser ? (
              <Input
                placeholder="Filter assets by name or ID…"
                value={assetSearch}
                onChange={e => setAssetSearch(e.target.value)}
                className="pl-9 h-10 bg-white/15 border-white/20 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-white/30 focus-visible:bg-white/20"
              />
            ) : (
              <Input
                placeholder="Search users by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="pl-9 h-10 bg-white/15 border-white/20 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-white/30 focus-visible:bg-white/20"
              />
            )}
            {(selectedUser ? assetSearch : userSearch) && (
              <button
                onClick={() => selectedUser ? setAssetSearch("") : setUserSearch("")}
                className="absolute right-3 top-2.5 text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* USER LIST */}
          {!selectedUser && (
            <div className="p-4 space-y-2">
              {usersLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-muted" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center">
                    <Users className="h-9 w-9 text-indigo-300 dark:text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-base">No Users Found</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      {userSearch ? `No users match "${userSearch}"` : "No assets have been assigned to any users yet."}
                    </p>
                  </div>
                </div>
              ) : (
                users.map(u => (
                  <button
                    key={u.userId}
                    onClick={() => setSelectedUser(u)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 hover:shadow-sm transition-all duration-150 text-left group"
                  >
                    <UserAvatar userId={u.userId} name={u.name} email={u.email} />

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">
                        {u.name || u.email || "Unknown User"}
                      </p>
                      {u.name && u.email && (
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      )}
                    </div>

                    {/* Stats chips */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-sm font-bold tabular-nums">{u.total}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Assets</p>
                      </div>
                      <div className="w-px h-8 bg-border/60" />
                      <div className="text-center">
                        <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{u.active}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Active</p>
                      </div>
                      <div className="w-px h-8 bg-border/60" />
                      <div className="text-center">
                        <p className="text-sm font-bold tabular-nums text-rose-500">{u.total - u.active}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Other</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all ml-1" />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* ASSET GRID for selected user */}
          {selectedUser && (
            <div className="p-4">
              {assetsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-muted" />)}
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                    <Package className="h-9 w-9 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="font-bold text-base">No Assets Found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {assetSearch ? `No assets match "${assetSearch}"` : "This user has no assets assigned."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status summary bar */}
                  {!assetSearch && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: "Active",     count: assets.filter(a => a.status === "ACTIVE").length,     cls: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300" },
                        { label: "In Transit", count: assets.filter(a => a.status === "IN_TRANSIT").length, cls: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300" },
                        { label: "Disposed",   count: assets.filter(a => a.status === "DISPOSED").length,   cls: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300" },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl border p-3 text-center ${s.cls}`}>
                          <p className="text-2xl font-bold tabular-nums">{s.count}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredAssets.map(asset => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        onView={() => onViewAsset?.(asset)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border/50 px-4 py-3 bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {selectedUser
              ? `${filteredAssets.length} of ${assets.length} assets`
              : `${users.length} users with assigned assets`}
          </p>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs rounded-lg">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Clearance wizard */}
    {selectedUser && (
      <UserClearanceDialog
        open={clearanceOpen}
        onOpenChange={setClearanceOpen}
        user={selectedUser}
        assets={assets}
        onClearanceComplete={() => {
          loadAssets(selectedUser.userId);
          loadUsers(userSearch);
        }}
      />
    )}
  );
}
