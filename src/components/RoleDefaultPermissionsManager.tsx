import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  UserCog, Save, Plus, Trash2, ShieldCheck, Eye, Layout,
  MousePointerClick, Settings2, ChevronRight, Check, X,
} from "lucide-react";

type Page = { path: string; name: string };

type CustomRole = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type RolePermission = {
  id: string;
  role: string | null;
  customRoleId: string | null;
  customRoleName: string | null;
  isCustomRole?: boolean;
  pageAccess: Record<string, boolean>;
  canDeleteDocuments: boolean;
  buttonVisibility?: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

const ROLE_META: Record<string, { label: string; description: string; gradient: string; badge: string }> = {
  ADMIN:    { label: "Admin",    description: "Full access to all features and user management.",        gradient: "from-rose-500 to-pink-600",    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  MANAGER:  { label: "Manager",  description: "Access to all features except admin settings.",           gradient: "from-violet-500 to-purple-600", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  STAFF:    { label: "Staff",    description: "Access only to features explicitly granted.",             gradient: "from-blue-500 to-indigo-600",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  HANDHELD: { label: "Handheld", description: "Mobile handheld device user with limited access.",       gradient: "from-emerald-500 to-teal-600",  badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

const BUTTON_GROUPS = [
  {
    label: "Assets",
    icon: Layout,
    buttons: [
      { id: "dispose_asset",  label: "Dispose Asset" },
      { id: "assets_button",  label: "Assets Button" },
    ],
  },
  {
    label: "Food Supply",
    icon: Settings2,
    buttons: [
      { id: "edit_food_supply", label: "Edit Food Supply" },
    ],
  },
];

export default function RoleDefaultPermissionsManager() {
  const [selectedRole, setSelectedRole] = useState<string>("STAFF");
  const [availablePages, setAvailablePages] = useState<Page[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermission>>({});
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [currentPermission, setCurrentPermission] = useState<{
    pageAccess: Record<string, boolean>;
    canDeleteDocuments: boolean;
    buttonVisibility: Record<string, boolean>;
  }>({ pageAccess: {}, canDeleteDocuments: false, buttonVisibility: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isCustomRoleSelected, setIsCustomRoleSelected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [pagesData, customRolesData, permissionsData] = await Promise.all([
          fetch("/api/admin/pages").then(r => r.json()),
          fetch("/api/admin/custom-roles").then(r => r.json()),
          fetch("/api/admin/role-permissions").then(r => r.json()),
        ]);
        setAvailablePages(pagesData);
        setCustomRoles(customRolesData);

        const permissionsMap: Record<string, RolePermission> = {};
        permissionsData.forEach((p: RolePermission) => {
          if (p.role) permissionsMap[p.role] = p;
          else if (p.customRoleId) permissionsMap[`custom_${p.customRoleId}`] = p;
        });
        setRolePermissions(permissionsMap);

        if (permissionsMap["STAFF"]) {
          setCurrentPermission({
            pageAccess: permissionsMap["STAFF"].pageAccess,
            canDeleteDocuments: permissionsMap["STAFF"].canDeleteDocuments,
            buttonVisibility: permissionsMap["STAFF"].buttonVisibility || {},
          });
        }
      } catch {
        toast({ title: "Error", description: "Failed to load role permissions data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (rolePermissions[selectedRole]) {
      setCurrentPermission({
        pageAccess: rolePermissions[selectedRole].pageAccess,
        canDeleteDocuments: rolePermissions[selectedRole].canDeleteDocuments,
        buttonVisibility: rolePermissions[selectedRole].buttonVisibility || {},
      });
    } else {
      setCurrentPermission({ pageAccess: {}, canDeleteDocuments: false, buttonVisibility: {} });
    }
    setIsCustomRoleSelected(selectedRole.startsWith('custom_'));
  }, [selectedRole, rolePermissions]);

  const handleAddCustomRole = async () => {
    if (!newRoleName.trim()) {
      toast({ title: "Error", description: "Role name is required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch("/api/admin/custom-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim(), description: newRoleDescription.trim() || null }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create custom role");
      }
      const newRole = await response.json();
      setCustomRoles(prev => [...prev, newRole]);
      setNewRoleName("");
      setNewRoleDescription("");
      setIsAddingRole(false);
      setSelectedRole(`custom_${newRole.id}`);
      toast({ title: "Role Created", description: `"${newRole.name}" is ready to configure.` });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create role", variant: "destructive" });
    }
  };

  const handleDeleteCustomRole = async (roleId: string) => {
    try {
      const response = await fetch("/api/admin/custom-roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roleId }),
      });
      if (!response.ok) throw new Error("Failed to delete custom role");
      setCustomRoles(prev => prev.filter(r => r.id !== roleId));
      if (selectedRole === `custom_${roleId}`) setSelectedRole("STAFF");
      const updated = { ...rolePermissions };
      delete updated[`custom_${roleId}`];
      setRolePermissions(updated);
      toast({ title: "Role Deleted", description: "Custom role removed successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to delete custom role", variant: "destructive" });
    }
  };

  const handleSelectAll = (enabled: boolean) => {
    const newPageAccess: Record<string, boolean> = {};
    availablePages.forEach(page => { newPageAccess[page.path] = enabled; });
    setCurrentPermission(prev => ({ ...prev, pageAccess: newPageAccess }));
  };

  const saveRolePermissions = async () => {
    setSaving(true);
    try {
      const isCustom = selectedRole.startsWith('custom_');
      const body: Record<string, unknown> = {
        pageAccess: currentPermission.pageAccess,
        canDeleteDocuments: currentPermission.canDeleteDocuments,
        buttonVisibility: currentPermission.buttonVisibility,
      };
      if (isCustom) body.customRoleId = selectedRole.replace('custom_', '');
      else body.role = selectedRole;

      const response = await fetch("/api/admin/role-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to save");
      const saved = await response.json();
      setRolePermissions(prev => ({ ...prev, [selectedRole]: saved }));
      toast({ title: "Permissions Saved", description: `Default permissions for ${isCustom ? customRoles.find(r => `custom_${r.id}` === selectedRole)?.name : selectedRole} updated.` });
    } catch {
      toast({ title: "Error", description: "Failed to save role permissions", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const enabledPageCount = availablePages.filter(p => currentPermission.pageAccess?.[p.path]).length;
  const roleMeta = ROLE_META[selectedRole] ?? {
    label: customRoles.find(r => `custom_${r.id}` === selectedRole)?.name ?? selectedRole,
    description: customRoles.find(r => `custom_${r.id}` === selectedRole)?.description ?? "Custom role with configurable permissions.",
    gradient: "from-slate-500 to-gray-600",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading permissions…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Role Selector Header ──────────────────────────────────── */}
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${roleMeta.gradient} p-px`}>
        <div className="rounded-2xl bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold tracking-tight">Role Default Permissions</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure what each role can see and access by default
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-44 rounded-xl border-border bg-background">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="HANDHELD">Handheld</SelectItem>
                  {customRoles.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">
                        Custom Roles
                      </div>
                      {customRoles.map(role => (
                        <SelectItem key={role.id} value={`custom_${role.id}`}>{role.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>

              <Dialog open={isAddingRole} onOpenChange={setIsAddingRole}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
                    <Plus className="h-4 w-4" /> New Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Custom Role</DialogTitle>
                    <DialogDescription>Define a new role and configure its permissions after creation.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="role-name">Role Name</Label>
                      <Input id="role-name" placeholder="e.g. Supervisor" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
                      <Textarea id="role-desc" placeholder="Describe the purpose of this role…" value={newRoleDescription} onChange={e => setNewRoleDescription(e.target.value)} className="rounded-xl resize-none" rows={3} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsAddingRole(false)}>Cancel</Button>
                    <Button className="rounded-xl" onClick={handleAddCustomRole}>Create Role</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Role info strip */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-border">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${roleMeta.badge}`}>
              <UserCog className="h-3.5 w-3.5" />
              {roleMeta.label}
            </span>
            <p className="text-sm text-muted-foreground flex-1">{roleMeta.description}</p>
            {isCustomRoleSelected && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl gap-1.5 text-xs"
                onClick={() => handleDeleteCustomRole(selectedRole.replace('custom_', ''))}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Role
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Three column grid: General | Buttons | Pages ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* General Permissions */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-semibold text-sm">General Permissions</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Document Delete</p>
                <p className="text-xs text-muted-foreground mt-0.5">Allow deleting asset documents</p>
              </div>
              <Switch
                checked={currentPermission.canDeleteDocuments}
                onCheckedChange={v => setCurrentPermission(p => ({ ...p, canDeleteDocuments: v }))}
              />
            </div>
          </div>
        </div>

        {/* Button Visibility */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <MousePointerClick className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-semibold text-sm">Button Visibility</h3>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {BUTTON_GROUPS.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                </div>
                <div className="space-y-2">
                  {group.buttons.map(btn => (
                    <div key={btn.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                      <span className="text-xs font-medium">{btn.label}</span>
                      <Switch
                        checked={currentPermission.buttonVisibility?.[btn.id] === true}
                        onCheckedChange={v => setCurrentPermission(p => ({
                          ...p,
                          buttonVisibility: { ...p.buttonVisibility, [btn.id]: v },
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Page Access summary */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-semibold text-sm">Page Access</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {enabledPageCount}/{availablePages.length}
              </span>
            </div>
          </div>
          <div className="p-4 space-y-1.5">
            <div className="flex gap-2 mb-3">
              <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2.5 flex-1 gap-1" onClick={() => handleSelectAll(true)}>
                <Check className="h-3 w-3" /> All
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2.5 flex-1 gap-1" onClick={() => handleSelectAll(false)}>
                <X className="h-3 w-3" /> None
              </Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {availablePages.map(page => (
                <div key={page.path} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                    <span className="text-xs text-foreground truncate">{page.name}</span>
                  </div>
                  <Switch
                    checked={currentPermission.pageAccess?.[page.path] === true}
                    onCheckedChange={v => setCurrentPermission(p => ({ ...p, pageAccess: { ...p.pageAccess, [page.path]: v } }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Page Access grid (detailed) ─────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <Layout className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">All Pages</h3>
              <p className="text-xs text-muted-foreground">{enabledPageCount} of {availablePages.length} pages enabled</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1" onClick={() => handleSelectAll(true)}>
              <Check className="h-3.5 w-3.5" /> Enable All
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1" onClick={() => handleSelectAll(false)}>
              <X className="h-3.5 w-3.5" /> Disable All
            </Button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {availablePages.map(page => {
              const enabled = currentPermission.pageAccess?.[page.path] === true;
              return (
                <div
                  key={page.path}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                    enabled
                      ? "border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                  onClick={() => setCurrentPermission(p => ({ ...p, pageAccess: { ...p.pageAccess, [page.path]: !enabled } }))}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${enabled ? "bg-blue-500" : "bg-muted-foreground/30"}`} />
                    <Label className="text-xs font-medium cursor-pointer truncate">{page.name}</Label>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={v => setCurrentPermission(p => ({ ...p, pageAccess: { ...p.pageAccess, [page.path]: v } }))}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Save Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border">
        <div>
          <p className="text-sm font-medium">Save Changes</p>
          <p className="text-xs text-muted-foreground">Applying to all new users assigned the <span className="font-semibold">{roleMeta.label}</span> role</p>
        </div>
        <Button
          onClick={saveRolePermissions}
          disabled={saving}
          className="rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm"
        >
          {saving ? (
            <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Permissions
        </Button>
      </div>
    </div>
  );
}
