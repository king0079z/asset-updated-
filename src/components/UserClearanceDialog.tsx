import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Package,
  RotateCcw, UserCheck, Trash2, Search, X, ChevronDown,
  ClipboardList, ShieldAlert, Loader2, FileText, Users,
  Calendar, MessageSquare, CircleCheck, AlertCircle, Info,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type ClearanceReason = "TERMINATED" | "RESIGNED" | "TRANSFERRED" | "SUSPENDED" | "OTHER";
type AssetAction = "RETURN_TO_STOCK" | "REASSIGN" | "DISPOSE" | null;

interface Asset {
  id: string; assetId: string; name: string; type: string;
  status: string; imageUrl?: string | null;
  floorNumber?: string | null; roomNumber?: string | null;
  purchaseAmount?: number | null;
  assignedToName?: string | null; assignedToEmail?: string | null;
  vendor?: { name: string } | null;
}

interface SystemUser {
  id: string; email: string; role?: string;
}

interface AssetDecision {
  asset: Asset;
  action: AssetAction;
  newUserId?: string;
  newUserName?: string;
  newUserEmail?: string;
}

interface UserClearanceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: { userId: string; name: string | null; email: string | null };
  assets: Asset[];
  onClearanceComplete?: () => void;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const REASONS: { value: ClearanceReason; label: string; desc: string; color: string; icon: any }[] = [
  { value: "TERMINATED", label: "Terminated",   desc: "Employment was ended by the organization", color: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300",    icon: AlertTriangle },
  { value: "RESIGNED",   label: "Resigned",     desc: "Employee voluntarily left the organization", color: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300", icon: ArrowLeft },
  { value: "TRANSFERRED",label: "Transferred",  desc: "Moved to another department or branch", color: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300",   icon: ArrowRight },
  { value: "SUSPENDED",  label: "Suspended",    desc: "Temporarily suspended from duties", color: "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300", icon: AlertCircle },
  { value: "OTHER",      label: "Other",        desc: "Another reason not listed above", color: "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300",       icon: Info },
];

const ACTION_CONFIG = {
  RETURN_TO_STOCK: { label: "Return to Stock",  icon: RotateCcw, color: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500" },
  REASSIGN:        { label: "Reassign",          icon: UserCheck,  color: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300",                   dot: "bg-blue-500" },
  DISPOSE:         { label: "Dispose",           icon: Trash2,     color: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300",                         dot: "bg-red-500" },
};

function isValidImage(url?: string | null): url is string {
  if (!url) return false;
  try { const p = new URL(url); return p.protocol === "http:" || p.protocol === "https:"; }
  catch { return false; }
}

/* ─── Step progress bar ──────────────────────────────────────────────────── */
function StepBar({ current, total }: { current: number; total: number }) {
  const steps = ["Reason", "Review Assets", "Confirm & Submit", "Complete"];
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                done   ? "bg-emerald-500 border-emerald-500 text-white" :
                active ? "bg-white border-indigo-500 text-indigo-600" :
                         "bg-white/10 border-white/30 text-white/40"
              }`}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap hidden sm:block ${active ? "text-white" : done ? "text-emerald-300" : "text-white/40"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-all ${done ? "bg-emerald-400" : "bg-white/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Reassign picker ────────────────────────────────────────────────────── */
function ReassignPicker({ onSelect, excludeUserId }: { onSelect: (u: SystemUser) => void; excludeUserId: string }) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/users")
      .then(r => r.ok ? r.json() : { users: [], data: [] })
      .then(d => {
        const list: SystemUser[] = d.users ?? d.data ?? d ?? [];
        setUsers(list.filter(u => u.id !== excludeUserId));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [excludeUserId]);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="mt-2 rounded-xl border border-border bg-background shadow-lg overflow-hidden z-50">
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            className="pl-7 h-8 text-xs rounded-lg"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
        ) : (
          filtered.map(u => (
            <button key={u.id} onClick={() => onSelect(u)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-left transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                {(u.email ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{u.email}</p>
                {u.role && <p className="text-[10px] text-muted-foreground">{u.role}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Single asset decision card ─────────────────────────────────────────── */
function AssetDecisionCard({
  decision, onChange, excludeUserId,
}: { decision: AssetDecision; onChange: (d: AssetDecision) => void; excludeUserId: string }) {
  const [showPicker, setShowPicker] = useState(false);
  const { asset, action } = decision;
  const hasImg = isValidImage(asset.imageUrl);

  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
      action === "RETURN_TO_STOCK" ? "border-emerald-300 dark:border-emerald-800" :
      action === "REASSIGN"        ? "border-blue-300 dark:border-blue-800" :
      action === "DISPOSE"         ? "border-red-300 dark:border-red-800" :
      "border-border"
    }`}>
      {/* Asset header */}
      <div className="flex items-center gap-3 p-3 bg-muted/30">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-border/50">
          {hasImg ? (
            <img src={asset.imageUrl!} alt={asset.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              <Package className="h-4 w-4 text-slate-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{asset.name}</p>
          <p className="text-[10px] font-mono text-muted-foreground">{asset.assetId} · {asset.type}</p>
        </div>
        {!action && (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex-shrink-0">
            Pending decision
          </span>
        )}
        {action && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${ACTION_CONFIG[action].color}`}>
            {ACTION_CONFIG[action].label}
          </span>
        )}
      </div>

      {/* Action selector */}
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {(["RETURN_TO_STOCK", "REASSIGN", "DISPOSE"] as const).map(a => {
            const cfg = ACTION_CONFIG[a];
            const Icon = cfg.icon;
            const selected = action === a;
            return (
              <button
                key={a}
                onClick={() => {
                  onChange({ ...decision, action: a, newUserId: undefined, newUserName: undefined, newUserEmail: undefined });
                  if (a !== "REASSIGN") setShowPicker(false);
                  if (a === "REASSIGN") setShowPicker(true);
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-center transition-all duration-150 ${
                  selected ? cfg.color + " border-current" : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-bold leading-tight">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Reassign picker */}
        {action === "REASSIGN" && (
          <div className="relative">
            {decision.newUserName ? (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                  {(decision.newUserName).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-blue-700 dark:text-blue-300">{decision.newUserName}</p>
                  {decision.newUserEmail && <p className="text-[10px] text-blue-500 truncate">{decision.newUserEmail}</p>}
                </div>
                <button onClick={() => { onChange({ ...decision, newUserId: undefined, newUserName: undefined, newUserEmail: undefined }); setShowPicker(true); }}
                  className="text-blue-400 hover:text-blue-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPicker(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
              >
                <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Select new assignee</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
            {showPicker && !decision.newUserName && (
              <div className="absolute z-50 w-full top-full mt-1">
                <ReassignPicker
                  excludeUserId={excludeUserId}
                  onSelect={u => {
                    onChange({ ...decision, action: "REASSIGN", newUserId: u.id, newUserName: u.email, newUserEmail: u.email });
                    setShowPicker(false);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Dialog ─────────────────────────────────────────────────────────── */
export function UserClearanceDialog({ open, onOpenChange, user, assets, onClearanceComplete }: UserClearanceDialogProps) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState<ClearanceReason | null>(null);
  const [clearanceDate, setClearanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [decisions, setDecisions] = useState<AssetDecision[]>([]);
  const [assetFilter, setAssetFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [applyAll, setApplyAll] = useState<AssetAction>(null);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setStep(1); setReason(null); setNotes(""); setResult(null); setAssetFilter(""); setApplyAll(null);
      setClearanceDate(new Date().toISOString().split("T")[0]);
      setDecisions(assets.map(a => ({ asset: a, action: null })));
    }
  }, [open, assets]);

  const updateDecision = useCallback((assetId: string, update: Partial<AssetDecision>) => {
    setDecisions(prev => prev.map(d => d.asset.id === assetId ? { ...d, ...update } : d));
  }, []);

  const applyAllAction = (action: AssetAction) => {
    setApplyAll(action);
    setDecisions(prev => prev.map(d => ({ ...d, action, newUserId: undefined, newUserName: undefined, newUserEmail: undefined })));
  };

  const pendingCount = decisions.filter(d => !d.action).length;
  const allDecided = pendingCount === 0;

  const filteredDecisions = decisions.filter(d => {
    if (!assetFilter) return true;
    const q = assetFilter.toLowerCase();
    return d.asset.name.toLowerCase().includes(q) || d.asset.assetId.toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    if (!reason || !allDecided) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/assets/clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          userName: user.name || user.email || user.userId,
          userEmail: user.email || "",
          reason,
          notes,
          clearanceDate,
          actions: decisions.map(d => ({
            assetId: d.asset.id,
            action: d.action,
            newUserId: d.newUserId,
            newUserName: d.newUserName,
            newUserEmail: d.newUserEmail,
          })),
        }),
      });
      const data = await r.json();
      setResult(data);
      setStep(4);
      onClearanceComplete?.();
    } catch {
      setResult({ success: false, error: "Network error. Please try again." });
      setStep(4);
    } finally {
      setSubmitting(false);
    }
  };

  const reasonMeta = REASONS.find(r => r.value === reason);

  return (
    <Dialog open={open} onOpenChange={v => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="w-[95vw] max-w-3xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[92dvh] flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Asset Clearance Process</DialogTitle>
          <DialogDescription>Multi-step process to clear and reassign assets from a departing user.</DialogDescription>
        </VisuallyHidden>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div className={`relative flex-shrink-0 p-5 pb-4 ${
          step === 4 && result?.success ? "bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700" :
          step === 4                    ? "bg-gradient-to-br from-red-600 via-rose-600 to-red-700" :
          "bg-gradient-to-br from-rose-700 via-red-700 to-orange-700"
        }`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_55%)]" />
          <div className="relative z-10 space-y-4">
            {/* User info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Asset Clearance Process</p>
                <p className="text-white font-bold truncate">{user.name || user.email || "Unknown User"}</p>
                {user.name && user.email && <p className="text-white/50 text-xs truncate">{user.email}</p>}
              </div>
              <div className="text-center bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 flex-shrink-0">
                <p className="text-white font-bold text-lg leading-none">{assets.length}</p>
                <p className="text-white/60 text-[10px] mt-0.5">Assets</p>
              </div>
            </div>
            {/* Step bar */}
            {step < 4 && <StepBar current={step} total={4} />}
            {step === 4 && (
              <div className={`flex items-center gap-2 ${result?.success ? "text-emerald-200" : "text-red-200"}`}>
                {result?.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <span className="font-bold">{result?.success ? "Clearance Completed Successfully" : "Clearance Encountered Errors"}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP 1 – Reason */}
          {step === 1 && (
            <div className="p-5 space-y-5">
              <div>
                <h3 className="font-bold text-base mb-1">Select Clearance Reason</h3>
                <p className="text-sm text-muted-foreground">This will be recorded in the audit trail for compliance purposes.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REASONS.map(r => {
                  const Icon = r.icon;
                  const selected = reason === r.value;
                  return (
                    <button key={r.value} onClick={() => setReason(r.value)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-150 ${
                        selected ? r.color + " border-current shadow-sm" : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                      }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? "bg-current/10" : "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{r.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Date + Notes */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Clearance Date</label>
                  <Input type="date" value={clearanceDate} onChange={e => setClearanceDate(e.target.value)}
                    className="h-10 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Notes <span className="font-normal normal-case">(optional)</span></label>
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)}
                    rows={3} placeholder="Add any relevant notes about this clearance..."
                    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 – Review assets */}
          {step === 2 && (
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-bold text-base mb-0.5">Review {assets.length} Asset{assets.length !== 1 ? "s" : ""}</h3>
                  <p className="text-sm text-muted-foreground">Choose what to do with each asset. {pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-semibold">{pendingCount} still pending.</span>}</p>
                </div>
                {/* Quick apply all */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-semibold">Apply all:</span>
                  {(["RETURN_TO_STOCK", "REASSIGN", "DISPOSE"] as const).map(a => {
                    const cfg = ACTION_CONFIG[a]; const Icon = cfg.icon;
                    return (
                      <button key={a} onClick={() => applyAllAction(a)} title={`${cfg.label} all`}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${applyAll === a ? cfg.color + " border-current" : "border-border hover:border-muted-foreground/40"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Filter assets…" value={assetFilter} onChange={e => setAssetFilter(e.target.value)}
                  className="pl-9 h-9 rounded-xl text-sm" />
                {assetFilter && <button onClick={() => setAssetFilter("")} className="absolute right-3 top-2.5 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
              </div>

              {/* Asset decision list */}
              <div className="space-y-3">
                {filteredDecisions.map(d => (
                  <AssetDecisionCard
                    key={d.asset.id}
                    decision={d}
                    excludeUserId={user.userId}
                    onChange={updated => updateDecision(updated.asset.id, updated)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 – Confirm */}
          {step === 3 && (
            <div className="p-5 space-y-5">
              <div>
                <h3 className="font-bold text-base mb-1">Review & Confirm</h3>
                <p className="text-sm text-muted-foreground">Review all decisions before submitting. This action will be permanently recorded in the audit trail.</p>
              </div>

              {/* Clearance info card */}
              <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2"><ClipboardList className="h-3.5 w-3.5" /> Clearance Summary</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">User</p><p className="font-semibold">{user.name || user.email}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Reason</p><p className="font-semibold">{reasonMeta?.label}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Date</p><p className="font-semibold">{new Date(clearanceDate).toLocaleDateString()}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Assets</p><p className="font-semibold">{assets.length}</p></div>
                </div>
                {notes && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Notes</p><p className="text-sm mt-0.5">{notes}</p></div>}
              </div>

              {/* Action summary tiles */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { action: "RETURN_TO_STOCK" as const, count: decisions.filter(d => d.action === "RETURN_TO_STOCK").length },
                  { action: "REASSIGN"         as const, count: decisions.filter(d => d.action === "REASSIGN").length },
                  { action: "DISPOSE"          as const, count: decisions.filter(d => d.action === "DISPOSE").length },
                ].map(({ action, count }) => {
                  const cfg = ACTION_CONFIG[action]; const Icon = cfg.icon;
                  return (
                    <div key={action} className={`rounded-2xl border-2 p-4 text-center ${count > 0 ? cfg.color + " border-current" : "border-border bg-muted/20 text-muted-foreground"}`}>
                      <Icon className="h-6 w-6 mx-auto mb-2 opacity-80" />
                      <p className="text-2xl font-bold tabular-nums">{count}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{cfg.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Asset list preview */}
              <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl">
                {decisions.map(d => {
                  const cfg = d.action ? ACTION_CONFIG[d.action] : null;
                  const Icon = cfg?.icon;
                  return (
                    <div key={d.asset.id} className={`flex items-center gap-3 p-3 rounded-xl border ${cfg ? cfg.color + " border-current/30" : "border-border bg-muted/20"}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg ? "bg-current/10" : "bg-muted"}`}>
                        {Icon ? <Icon className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{d.asset.name}</p>
                        {d.action === "REASSIGN" && d.newUserName && (
                          <p className="text-[10px] text-muted-foreground">→ {d.newUserName}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold flex-shrink-0">{cfg?.label ?? "—"}</span>
                    </div>
                  );
                })}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This action is <strong>irreversible</strong>. Disposed assets will be permanently marked as disposed. All changes will be recorded in the system's compliance audit trail.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4 – Complete */}
          {step === 4 && result && (
            <div className="p-5 space-y-5">
              {result.success ? (
                <>
                  <div className="flex flex-col items-center text-center py-4 gap-3">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <CircleCheck className="h-10 w-10 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl">Clearance Complete</h3>
                      <p className="text-sm text-muted-foreground mt-1">All asset decisions have been processed and recorded.</p>
                    </div>
                  </div>

                  {/* Results tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total",      value: result.summary.total,      cls: "bg-muted/40 border-border" },
                      { label: "Returned",   value: result.summary.returned,   cls: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300" },
                      { label: "Reassigned", value: result.summary.reassigned, cls: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300" },
                      { label: "Disposed",   value: result.summary.disposed,   cls: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300" },
                    ].map(t => (
                      <div key={t.label} className={`rounded-2xl border-2 p-4 text-center ${t.cls}`}>
                        <p className="text-3xl font-bold tabular-nums">{t.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider mt-1">{t.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
                    <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      A full audit record has been created under <strong>Compliance &amp; Audit</strong>. All individual asset history records have also been updated.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center py-6 gap-3">
                  <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <AlertTriangle className="h-10 w-10 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">Clearance Failed</h3>
                    <p className="text-sm text-muted-foreground mt-1">{result.error || "An unexpected error occurred. Please try again."}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-border/50 px-5 py-3 bg-muted/20 flex items-center justify-between gap-3">
          {/* Left */}
          <div>
            {step > 1 && step < 4 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={submitting}
                className="gap-1.5 h-8 rounded-xl text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {step === 4 && (
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 rounded-xl text-xs">
                Close
              </Button>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {step < 4 && (
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}
                className="h-8 rounded-xl text-xs">
                Cancel
              </Button>
            )}
            {step === 1 && (
              <Button size="sm" onClick={() => setStep(2)} disabled={!reason}
                className="gap-1.5 h-8 rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white border-0">
                Next: Review Assets <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 2 && (
              <Button size="sm" onClick={() => setStep(3)} disabled={!allDecided || decisions.some(d => d.action === "REASSIGN" && !d.newUserName)}
                className="gap-1.5 h-8 rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white border-0">
                Next: Confirm <ArrowRight className="h-3.5 w-3.5" />
                {pendingCount > 0 && <span className="ml-1 bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 py-0 rounded-full">{pendingCount}</span>}
              </Button>
            )}
            {step === 3 && (
              <Button size="sm" onClick={handleSubmit} disabled={submitting}
                className="gap-1.5 h-8 rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white border-0 min-w-[130px]">
                {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</> : <><ShieldAlert className="h-3.5 w-3.5" /> Execute Clearance</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
