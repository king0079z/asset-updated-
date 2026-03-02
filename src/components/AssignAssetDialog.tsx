// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  UserCheck, Search, Loader2, X, Check, User, Mail, UserX, Building2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SystemUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
}

interface AssignAssetDialogProps {
  asset: { id: string; name: string; assignedToName?: string | null; assignedToEmail?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export function AssignAssetDialog({ asset, open, onOpenChange, onAssigned }: AssignAssetDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"system" | "manual">("system");
  const [searchQuery, setSearchQuery] = useState("");
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);

  // Manual entry state
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualNote, setManualNote] = useState("");

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedUser(null);
      setManualName("");
      setManualEmail("");
      setManualNote("");
      setTab("system");
    }
  }, [open]);

  // Load system users
  useEffect(() => {
    if (open && tab === "system") {
      setLoadingUsers(true);
      fetch("/api/users?limit=50")
        .then(r => r.ok ? r.json() : [])
        .then(data => setSystemUsers(Array.isArray(data) ? data : data.users || []))
        .catch(() => setSystemUsers([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [open, tab]);

  const filteredUsers = systemUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    return !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const handleAssign = async () => {
    if (!asset) return;

    let payload: any = {};
    if (tab === "system") {
      if (!selectedUser) {
        toast({ title: "Select a person", description: "Please select a system user to assign.", variant: "destructive" });
        return;
      }
      payload = {
        assignedToName: selectedUser.name || selectedUser.email,
        assignedToEmail: selectedUser.email,
        assignedToId: selectedUser.id,
      };
    } else {
      if (!manualName.trim()) {
        toast({ title: "Name required", description: "Please enter the person's name.", variant: "destructive" });
        return;
      }
      payload = {
        assignedToName: manualName.trim(),
        assignedToEmail: manualEmail.trim() || null,
        assignedToId: null,
      };
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to assign");
      toast({ title: "Asset assigned", description: `${asset.name} is now assigned to ${payload.assignedToName}.` });
      onAssigned();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Assignment failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUnassign = async () => {
    if (!asset) return;
    setUnassigning(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/assign`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unassign");
      toast({ title: "Asset unassigned", description: `${asset.name} is now unassigned.` });
      onAssigned();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Failed to unassign", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setUnassigning(false); }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-slate-700" style={{ background: "#0f172a" }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-white" />
              </div>
              Assign Asset
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Assign <strong className="text-slate-200">{asset.name}</strong> to a registered user or enter staff details manually.
            </DialogDescription>
          </DialogHeader>

          {/* Current assignment banner */}
          {asset.assignedToName && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-950/50 border border-amber-700/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-widest">Currently Assigned To</p>
                  <p className="text-sm font-bold text-amber-200">{asset.assignedToName}</p>
                  {asset.assignedToEmail && <p className="text-xs text-amber-400/70">{asset.assignedToEmail}</p>}
                </div>
              </div>
              <button
                onClick={handleUnassign}
                disabled={unassigning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {unassigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                Unassign
              </button>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-4 flex gap-1 rounded-none border-b border-slate-700/50 pb-0">
          <button
            onClick={() => setTab("system")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${tab === "system" ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <User className="h-4 w-4 inline mr-1.5" />
            System Users
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${tab === "manual" ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <Building2 className="h-4 w-4 inline mr-1.5" />
            Staff / Manual
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {tab === "system" ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* User list */}
              <ScrollArea className="h-52">
                {loadingUsers ? (
                  <div className="flex items-center justify-center h-32 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                    <User className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No users found</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pr-2">
                    {filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${selectedUser?.id === u.id ? "border-indigo-500 bg-indigo-500/15" : "border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800"}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-600/40 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
                          {(u.name || u.email)[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-200 text-sm truncate">{u.name || "—"}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          {u.role && <span className="text-[10px] text-indigo-400 uppercase font-semibold">{u.role}</span>}
                        </div>
                        {selectedUser?.id === u.id && (
                          <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {selectedUser && (
                <div className="rounded-xl bg-indigo-950/50 border border-indigo-700/40 px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(selectedUser.name || selectedUser.email)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-indigo-400 font-semibold uppercase tracking-widest">Selected</p>
                    <p className="text-sm font-bold text-white">{selectedUser.name || selectedUser.email}</p>
                    <p className="text-xs text-indigo-400/70">{selectedUser.email}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-500/30 bg-blue-950/30 px-4 py-3 text-sm text-blue-300 flex items-start gap-2">
                <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Enter staff details manually. Active Directory integration will be available once connected.</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="e.g. Ahmed Al-Rashid"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={e => setManualEmail(e.target.value)}
                    placeholder="e.g. ahmed@company.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">Department / Note (optional)</label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={e => setManualNote(e.target.value)}
                  placeholder="e.g. IT Department, Floor 3"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-between gap-3 border-t border-slate-700/50 pt-4">
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || (tab === "system" && !selectedUser) || (tab === "manual" && !manualName.trim())}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            {saving ? "Assigning..." : "Assign Asset"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
