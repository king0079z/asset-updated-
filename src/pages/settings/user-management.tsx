import { SimpleDashboardLayout } from "@/components/SimpleDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { fetchWithCache, getFromCache, invalidateCache } from "@/lib/api-cache";
const CUSTOM_ROLES_KEY = "/api/admin/custom-roles";
const USERS_PENDING_KEY = "/api/admin/users?status=PENDING";
const USERS_APPROVED_KEY = "/api/admin/users?status=APPROVED";
const USERS_REJECTED_KEY = "/api/admin/users?status=REJECTED";
const PAGES_KEY = "/api/admin/pages";
const ADMIN_TTL = 2 * 60_000;
const PENDING_AUTO_REFRESH_MS = 30_000; // Re-check for new signups every 30 s
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RoleDefaultPermissionsManager from "@/components/RoleDefaultPermissionsManager";
import {
  CheckCircle, XCircle, UserCog, Settings, Search, Users, UserPlus, UserX,
  Filter, RefreshCw, Key, Mail, Copy, AlertCircle, ShieldCheck, Building2,
  ChevronDown, ChevronUp, Lock, Eye, ToggleLeft, KeyRound, EyeOff,
} from "lucide-react";

type User = {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  role: string;
  customRoleId?: string;
  customRoleName?: string;
  pageAccess: Record<string, boolean> | null;
  canDeleteDocuments?: boolean;
  buttonVisibility?: Record<string, boolean> | null;
  createdAt: string;
  organizationId?: string;
  organization?: { id: string; name: string; slug: string } | null;
  licenseKey?: string;
};

type Page = { path: string; name: string };

type CustomRole = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

function CustomRoleOptions() {
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/custom-roles")
      .then(r => r.ok ? r.json() : [])
      .then(setCustomRoles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || customRoles.length === 0) return null;
  return (
    <>
      <div className="py-2">
        <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Roles</div>
      </div>
      {customRoles.map(role => (
        <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
      ))}
    </>
  );
}

const UserAvatar = ({ email }: { email: string }) => {
  const initials = email.slice(0, 2).toUpperCase();
  const colors = [
    "from-violet-500 to-purple-600", "from-blue-500 to-indigo-600", "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600", "from-amber-500 to-orange-600",
  ];
  const colorIdx = email.charCodeAt(0) % colors.length;
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
      {initials}
    </div>
  );
};

export default function UserManagementPage() {
  const hasCachedUsers = !!(getFromCache(USERS_APPROVED_KEY, ADMIN_TTL));
  const [pendingUsers, setPendingUsers] = useState<User[]>(() => getFromCache<User[]>(USERS_PENDING_KEY, ADMIN_TTL) ?? []);
  const [approvedUsers, setApprovedUsers] = useState<User[]>(() => getFromCache<User[]>(USERS_APPROVED_KEY, ADMIN_TTL) ?? []);
  const [rejectedUsers, setRejectedUsers] = useState<User[]>(() => getFromCache<User[]>(USERS_REJECTED_KEY, ADMIN_TTL) ?? []);
  const [availablePages, setAvailablePages] = useState<Page[]>(() => getFromCache<Page[]>(PAGES_KEY, ADMIN_TTL) ?? []);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(() => getFromCache<CustomRole[]>(CUSTOM_ROLES_KEY, ADMIN_TTL) ?? []);
  const [loading, setLoading] = useState(() => !hasCachedUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState<string | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [subscriptionDuration, setSubscriptionDuration] = useState("12");
  const [subscriptionPlan, setSubscriptionPlan] = useState("BASIC");
  const [syncing, setSyncing] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [resetTab, setResetTab] = useState<"password" | "link">("link");
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLoginLink, setGeneratedLoginLink] = useState<string | null>(null);
  const { toast } = useToast();

  const toggleExpanded = (userId: string) =>
    setExpandedUsers(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });

  const safeJson = async (res: Response | null): Promise<any[]> => {
    if (!res || !res.ok) return [];
    try {
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  };

  const loadUsers = async (background = false) => {
    if (!background) setLoading(true);
    try {
      const [customRolesData, pendData, appData, rejData, pagesData] = await Promise.all([
        fetchWithCache<CustomRole[]>(CUSTOM_ROLES_KEY, { maxAge: ADMIN_TTL }).catch(() => []),
        fetchWithCache<User[]>(USERS_PENDING_KEY, { maxAge: ADMIN_TTL }).catch(() => []),
        fetchWithCache<User[]>(USERS_APPROVED_KEY, { maxAge: ADMIN_TTL }).catch(() => []),
        fetchWithCache<User[]>(USERS_REJECTED_KEY, { maxAge: ADMIN_TTL }).catch(() => []),
        fetchWithCache<Page[]>(PAGES_KEY, { maxAge: ADMIN_TTL }).catch(() => []),
      ]);
      const roles = Array.isArray(customRolesData) ? customRolesData : [];
      setCustomRoles(roles);
      const roleMap = roles.reduce((m: Record<string, string>, r: CustomRole) => { m[r.id] = r.name; return m; }, {});
      const addRoleNames = (users: User[]) => (Array.isArray(users) ? users : []).map(u =>
        u.customRoleId && roleMap[u.customRoleId] ? { ...u, customRoleName: roleMap[u.customRoleId] } : u);
      setPendingUsers(addRoleNames(pendData as User[]));
      setApprovedUsers(addRoleNames(appData as User[]));
      setRejectedUsers(addRoleNames(rejData as User[]));
      setAvailablePages(Array.isArray(pagesData) ? pagesData as Page[] : []);
    } catch (err) {
      if (!background) toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      if (!background) { setLoading(false); setRefreshing(false); }
    }
  };

  // Retroactively provision any Supabase auth user not yet in the DB.
  const handleSyncFromAuth = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/users/sync-from-auth', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      if (data.synced === 0) {
        toast({ title: 'Already up to date', description: 'All registered accounts are already in the system.' });
      } else {
        toast({
          title: `${data.synced} account${data.synced > 1 ? 's' : ''} recovered`,
          description: data.users.map((u: any) => u.email).join(', '),
        });
      }
      // Force-refresh the pending list so recovered accounts appear immediately.
      [USERS_PENDING_KEY, USERS_APPROVED_KEY].forEach(invalidateCache);
      await loadUsers(false);
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !tempPassword) return;
    if (tempPassword.length < 8) {
      toast({ title: 'Too short', description: 'Temporary password must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetPasswordUser.id, tempPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      toast({
        title: 'Temporary password set',
        description: `Share the temporary password with ${resetPasswordUser.email}. They will be prompted to create a new password on next login.`,
      });
      setResetPasswordUser(null);
      setTempPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleGenerateLoginLink = async () => {
    if (!resetPasswordUser) return;
    setGeneratingLink(true);
    setGeneratedLoginLink(null);
    try {
      const res = await fetch('/api/admin/users/generate-login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetPasswordUser.id, email: resetPasswordUser.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate link');
      setGeneratedLoginLink(data.link);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingLink(false);
    }
  };

  useEffect(() => {
    if (hasCachedUsers) { setTimeout(() => loadUsers(true), 300); }
    else { loadUsers(false); }

    // Auto-refresh pending users every 30 s so new signups appear without manual action.
    const pendingTimer = setInterval(async () => {
      try {
        invalidateCache(USERS_PENDING_KEY);
        const fresh = await fetchWithCache<User[]>(USERS_PENDING_KEY, { maxAge: 0 }).catch(() => null);
        if (Array.isArray(fresh)) setPendingUsers(fresh);
      } catch { /* silent */ }
    }, PENDING_AUTO_REFRESH_MS);

    return () => clearInterval(pendingTimer);
  }, []);

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/users/update-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Success", description: `User ${status.toLowerCase()} successfully.` });
      loadUsers();
    } catch {
      toast({ title: "Error", description: "Failed to update user status", variant: "destructive" });
    }
  };

  const generateSubscriptionKey = async () => {
    if (!selectedUser) return;
    setIsGeneratingKey(true);
    setGeneratedLicenseKey(null);
    try {
      let organizationId = selectedUser.organizationId;
      if (!organizationId) {
        const orgRes = await fetch("/api/organizations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `${selectedUser.email.split("@")[0]}'s Organization`, userId: selectedUser.id }),
        });
        if (!orgRes.ok) { const d = await orgRes.json(); throw new Error(d.error || "Failed to create organization"); }
        const orgData = await orgRes.json();
        organizationId = orgData.organization.id;
        toast({ title: "Organization Created", description: `Created org for ${selectedUser.email}` });
      }
      const curUserRes = await fetch("/api/users/permissions");
      const curUser = await curUserRes.json();
      await fetch(`/api/organizations/${organizationId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: curUser.email, role: "OWNER", adminOperation: true }),
      });
      const subRes = await fetch(`/api/organizations/${organizationId}/subscription`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: subscriptionPlan, durationMonths: parseInt(subscriptionDuration) }),
      });
      if (!subRes.ok) { const d = await subRes.json(); throw new Error(d.error || "Failed to generate key"); }
      const subData = await subRes.json();
      setGeneratedLicenseKey(subData.licenseKey);
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + parseInt(subscriptionDuration));
      const sendRes = await fetch("/api/admin/users/send-subscription-key", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, licenseKey: subData.licenseKey, role: selectedUser.role, plan: subscriptionPlan, expirationDate: expDate.toISOString() }),
      });
      if (!sendRes.ok) { const d = await sendRes.json(); throw new Error(d.error || "Failed to send key"); }
      await handleRoleChange(selectedUser.id, selectedUser.role);
      toast({ title: "Success", description: "Subscription key generated and emailed to user" });
      loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate key", variant: "destructive" });
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "License key copied to clipboard" });
  };

  const handlePageAccessChange = async (userId: string, pagePath: string, enabled: boolean) => {
    const u = [...approvedUsers, ...pendingUsers, ...rejectedUsers].find(u => u.id === userId);
    if (!u) return;
    const pageAccess = { ...(u.pageAccess || {}), [pagePath]: enabled };
    try {
      const res = await fetch("/api/admin/users/update-page-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pageAccess }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Updated", description: "Page access updated" });
      loadUsers();
    } catch {
      toast({ title: "Error", description: "Failed to update page access", variant: "destructive" });
    }
  };

  const handleRoleChange = async (userId: string, roleName: string) => {
    try {
      const isStandard = ["ADMIN", "MANAGER", "STAFF", "HANDHELD"].includes(roleName);
      let body: any = { userId };
      if (isStandard) {
        body.role = roleName;
      } else {
        const cr = customRoles.find(r => r.name === roleName);
        if (cr) body.customRoleId = cr.id;
        else throw new Error(`Custom role "${roleName}" not found`);
      }
      const res = await fetch("/api/admin/users/update-role", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const u = [...approvedUsers, ...pendingUsers, ...rejectedUsers].find(u => u.id === userId);
      if (u?.organizationId) {
        const subRes = await fetch(`/api/organizations/${u.organizationId}/subscription`);
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.licenseKey) {
            const expDate = subData.endDate ? new Date(subData.endDate) : (() => { const d = new Date(); d.setMonth(d.getMonth() + 12); return d; })();
            await fetch("/api/admin/users/send-subscription-key", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, licenseKey: subData.licenseKey, role: roleName, plan: subData.plan, expirationDate: expDate.toISOString() }),
            });
          }
        }
      }
      toast({ title: "Success", description: `Role updated to ${roleName}` });
      loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update role", variant: "destructive" });
    }
  };

  const handleDocumentDeletePermissionChange = async (userId: string, canDeleteDocuments: boolean) => {
    try {
      const res = await fetch("/api/admin/users/toggle-document-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, canDeleteDocuments }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Updated", description: `Document delete ${canDeleteDocuments ? "enabled" : "disabled"}` });
      loadUsers();
    } catch {
      toast({ title: "Error", description: "Failed to update permission", variant: "destructive" });
    }
  };

  const handleButtonVisibilityChange = async (userId: string, buttonId: string, enabled: boolean) => {
    const u = [...approvedUsers, ...pendingUsers, ...rejectedUsers].find(u => u.id === userId);
    if (!u) return;
    const buttonVisibility = { ...(u.buttonVisibility || {}), [buttonId]: enabled };
    try {
      const res = await fetch("/api/admin/users/update-button-visibility", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, buttonVisibility }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Updated", description: "Button visibility updated" });
      loadUsers();
    } catch {
      toast({ title: "Error", description: "Failed to update button visibility", variant: "destructive" });
    }
  };

  const getRoleBadgeClass = (user: User) => {
    if (user.customRoleName) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300";
    switch (user.role) {
      case "ADMIN":    return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300";
      case "MANAGER":  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      case "HANDHELD": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300";
      default:         return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const filteredApproved = approvedUsers.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPending = pendingUsers.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredRejected = rejectedUsers.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()));

  const PermissionToggle = ({ label, userId, field, value }: { label: string; userId: string; field: string; value: boolean }) => (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
      <Label className="text-sm cursor-pointer">{label}</Label>
      <Switch checked={value} onCheckedChange={checked => handleButtonVisibilityChange(userId, field, checked)} />
    </div>
  );

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-500 border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading users...</p>
    </div>
  );

  const EmptyState = ({ icon: Icon, message, onClear }: { icon: any; message: string; onClear?: () => void }) => (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-muted text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="font-medium text-muted-foreground">{message}</p>
      {onClear && <Button variant="link" className="mt-2 text-xs" onClick={onClear}>Clear search</Button>}
    </div>
  );

  return (
    <ProtectedRoute requireAdmin={true}>
      <SimpleDashboardLayout>
        <div className="space-y-8">

          {/* ── Hero ───────────────────────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
            <div className="absolute -bottom-10 -left-10 w-52 h-52 rounded-full bg-white/10 blur-3xl" />

            <div className="relative z-10 px-8 py-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">User Management</h1>
                  <p className="text-violet-200 text-sm mt-0.5">Manage access, roles, and permissions across your organization</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    placeholder="Search users..."
                    className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 w-64 rounded-xl"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/15 rounded-xl"
                  onClick={() => {
                    setRefreshing(true);
                    // Clear client-side cache so the fetch actually hits the server.
                    [USERS_PENDING_KEY, USERS_APPROVED_KEY, USERS_REJECTED_KEY, CUSTOM_ROLES_KEY, PAGES_KEY].forEach(invalidateCache);
                    loadUsers();
                  }} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/15 rounded-xl flex items-center gap-1.5 text-xs px-3"
                  onClick={handleSyncFromAuth}
                  disabled={syncing}
                  title="Scan Supabase auth for registered accounts not yet in the pending list"
                >
                  {syncing
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <UserPlus className="h-3.5 w-3.5" />}
                  {syncing ? 'Syncing…' : 'Sync Accounts'}
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="relative z-10 px-8 pb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Users", value: pendingUsers.length + approvedUsers.length + rejectedUsers.length, icon: Users },
                { label: "Approved", value: approvedUsers.length, icon: CheckCircle },
                { label: "Pending", value: pendingUsers.length, icon: UserPlus },
                { label: "Rejected", value: rejectedUsers.length, icon: UserX },
              ].map(s => (
                <div key={s.label} className="bg-white/15 backdrop-blur border border-white/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-violet-200 font-medium">{s.label}</span>
                    <s.icon className="h-4 w-4 text-white/60" />
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────────────── */}
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="bg-muted/60 p-1 rounded-2xl h-auto gap-1 flex flex-wrap">
              {[
                { value: "pending", icon: UserPlus, label: "Pending", count: pendingUsers.length, color: "data-[state=active]:text-amber-700" },
                { value: "approved", icon: CheckCircle, label: "Approved", count: approvedUsers.length, color: "data-[state=active]:text-emerald-700" },
                { value: "rejected", icon: UserX, label: "Rejected", count: rejectedUsers.length, color: "data-[state=active]:text-red-700" },
                { value: "role-permissions", icon: Settings, label: "Role Permissions", count: null, color: "" },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${tab.color}`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className="ml-1 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Pending Tab ─────────────────────────────────────────── */}
            <TabsContent value="pending" className="mt-6">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-lg font-bold">Pending Users</h2>
                  <p className="text-sm text-muted-foreground">Users awaiting approval to access the system</p>
                </div>
                {loading ? <LoadingState /> :
                  filteredPending.length === 0 ? (
                    <div className="p-6">
                      <EmptyState icon={searchQuery ? Filter : UserPlus}
                        message={searchQuery ? "No pending users match your search" : "No pending users — you're all caught up!"}
                        onClear={searchQuery ? () => setSearchQuery("") : undefined} />
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredPending.map(user => (
                        <div key={user.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <UserAvatar email={user.email} />
                            <div>
                              <p className="font-semibold text-sm">{user.email}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-muted-foreground">Registered {new Date(user.createdAt).toLocaleDateString()}</p>
                                {user.organization ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                                    🏢 {user.organization.name}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                                    ⚠ No org
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Generate Key Dialog */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950 gap-1.5"
                                  onClick={() => setSelectedUser(user)}>
                                  <Key className="h-4 w-4" /> Generate Key
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Generate Subscription Key</DialogTitle>
                                  <DialogDescription>Create a subscription key for {selectedUser?.email}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right text-sm">Plan</Label>
                                    <Select value={subscriptionPlan} onValueChange={setSubscriptionPlan}>
                                      <SelectTrigger className="col-span-3 rounded-xl"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="BASIC">Basic</SelectItem>
                                        <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                                        <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right text-sm">Duration</Label>
                                    <Select value={subscriptionDuration} onValueChange={setSubscriptionDuration}>
                                      <SelectTrigger className="col-span-3 rounded-xl"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="3">3 months</SelectItem>
                                        <SelectItem value="6">6 months</SelectItem>
                                        <SelectItem value="12">12 months</SelectItem>
                                        <SelectItem value="24">24 months</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right text-sm">Role</Label>
                                    <Select defaultValue="STAFF" onValueChange={v => selectedUser && setSelectedUser({ ...selectedUser, role: v })}>
                                      <SelectTrigger className="col-span-3 rounded-xl"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="MANAGER">Manager</SelectItem>
                                        <SelectItem value="STAFF">Staff</SelectItem>
                                        <SelectItem value="HANDHELD">Handheld</SelectItem>
                                        <CustomRoleOptions />
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {generatedLicenseKey && (
                                    <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 rounded-xl">
                                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                                      <AlertTitle className="text-emerald-800 dark:text-emerald-300">Key Generated!</AlertTitle>
                                      <AlertDescription>
                                        <div className="mt-2 flex items-center gap-2 bg-white dark:bg-emerald-900 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-700">
                                          <code className="font-mono text-sm flex-1 break-all">{generatedLicenseKey}</code>
                                          <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0"
                                            onClick={() => copyToClipboard(generatedLicenseKey)}>
                                            <Copy className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <p className="text-xs mt-2 text-emerald-700 dark:text-emerald-400">Key sent to user's email automatically.</p>
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </div>
                                <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
                                  <Button type="button" variant="outline" size="sm" className="rounded-xl gap-2"
                                    disabled={!generatedLicenseKey}
                                    onClick={() => selectedUser && generatedLicenseKey && (window.location.href = `mailto:${selectedUser.email}?subject=Your Subscription Key&body=Here is your subscription key: ${generatedLicenseKey}`)}>
                                    <Mail className="h-4 w-4" /> Email Manually
                                  </Button>
                                  <Button onClick={generateSubscriptionKey} disabled={isGeneratingKey} className="rounded-xl">
                                    {isGeneratingKey ? "Generating…" : generatedLicenseKey ? "Regenerate" : "Generate Key"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950 gap-1.5"
                              onClick={() => { handleStatusChange(user.id, "APPROVED"); toast({ title: "Access Granted", description: "Default page access granted. Modify in Approved tab." }); }}>
                              <CheckCircle className="h-4 w-4" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 gap-1.5"
                              onClick={() => handleStatusChange(user.id, "REJECTED")}>
                              <XCircle className="h-4 w-4" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </TabsContent>

            {/* ── Approved Tab ────────────────────────────────────────── */}
            <TabsContent value="approved" className="mt-6">
              {loading ? <LoadingState /> :
                filteredApproved.length === 0 ? (
                  <EmptyState icon={searchQuery ? Filter : CheckCircle}
                    message={searchQuery ? "No approved users match your search" : "No approved users found"}
                    onClear={searchQuery ? () => setSearchQuery("") : undefined} />
                ) : (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    {/* Table header */}
                    <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>User</span>
                      <span className="text-center w-28">Role</span>
                      <span className="text-center w-32">Org</span>
                      <span className="text-center w-28">Actions</span>
                    </div>

                    <div className="divide-y divide-border">
                      {filteredApproved.map(user => {
                        const isExpanded = expandedUsers.has(user.id);
                        const accessedPages = Object.values(user.pageAccess ?? {}).filter(Boolean).length;
                        return (
                          <div key={user.id}>
                            {/* ── Compact row ── */}
                            <div
                              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/20 transition-colors cursor-pointer"
                              onClick={() => toggleExpanded(user.id)}
                            >
                              {/* Avatar + info */}
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <UserAvatar email={user.email} />
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate">{user.email}</p>
                                  <p className="text-xs text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                                </div>
                              </div>

                              {/* Role badge */}
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border w-28 text-center flex-shrink-0 ${getRoleBadgeClass(user)}`}>
                                {user.customRoleName ?? user.role}
                              </span>

                              {/* Org */}
                              <div className="w-32 flex-shrink-0">
                                {user.organization ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 truncate max-w-full">
                                    🏢 {user.organization.name}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                                    ⚠ No org
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 w-36 justify-end flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" className="rounded-xl h-8 px-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                                  title="Account access recovery"
                                  onClick={() => { setResetPasswordUser(user); setTempPassword(''); setShowTempPassword(false); setGeneratedLoginLink(null); setResetTab("link"); }}>
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="rounded-xl h-8 px-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                  onClick={() => handleStatusChange(user.id, "REJECTED")}>
                                  <UserX className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="rounded-xl h-8 px-2 text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950"
                                  onClick={() => toggleExpanded(user.id)}>
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            {/* ── Expanded permissions panel ── */}
                            {isExpanded && (
                              <div className="bg-muted/10 border-t border-border px-6 py-5 space-y-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                                  {/* Col 1 — Role + Doc Delete */}
                                  <div className="space-y-3">
                                    {/* Role */}
                                    <div className="rounded-xl border border-border bg-card p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <ShieldCheck className="h-4 w-4 text-violet-500 flex-shrink-0" />
                                        <span className="text-sm font-semibold">Role Assignment</span>
                                      </div>
                                      <Select defaultValue={user.customRoleName ?? user.role} onValueChange={v => handleRoleChange(user.id, v)}>
                                        <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ADMIN">Admin</SelectItem>
                                          <SelectItem value="MANAGER">Manager</SelectItem>
                                          <SelectItem value="STAFF">Staff</SelectItem>
                                          <SelectItem value="HANDHELD">Handheld</SelectItem>
                                          <CustomRoleOptions />
                                        </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground mt-2">
                                        {user.role === "ADMIN" ? "Full system access including admin settings" :
                                          user.role === "MANAGER" ? "All features except admin settings" :
                                            user.role === "HANDHELD" ? "Handheld app only — scan, tickets, tasks" :
                                              "Limited access based on page permissions"}
                                      </p>
                                    </div>

                                    {/* Doc delete */}
                                    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Lock className="h-4 w-4 text-rose-500 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold">Document Delete</p>
                                          <p className="text-xs text-muted-foreground">Allow deleting asset documents</p>
                                        </div>
                                      </div>
                                      <Switch checked={user.canDeleteDocuments ?? false}
                                        onCheckedChange={v => handleDocumentDeletePermissionChange(user.id, v)} />
                                    </div>
                                  </div>

                                  {/* Col 2 — Button Visibility */}
                                  <div className="rounded-xl border border-border bg-card p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <ToggleLeft className="h-4 w-4 text-sky-500" />
                                      <span className="text-sm font-semibold">Button Visibility</span>
                                    </div>
                                    <div className="space-y-3">
                                      {[
                                        { section: "Assets", items: [
                                          { label: "Dispose Asset", field: "dispose_asset" },
                                          { label: "Assets Button", field: "assets_button" },
                                        ]},
                                        { section: "Food Supply", items: [
                                          { label: "Edit Food Supply", field: "edit_food_supply" },
                                        ]},
                                        { section: "Kitchen", items: [
                                          { label: "Consumption", field: "kitchen_consumption" },
                                          { label: "Waste Tracking", field: "kitchen_waste_tracking" },
                                          { label: "Add Food Supply", field: "kitchen_food_supply" },
                                          { label: "Recipe Mgmt", field: "kitchen_recipe" },
                                        ]},
                                      ].map(({ section, items }) => (
                                        <div key={section}>
                                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{section}</p>
                                          <div className="space-y-1">
                                            {items.map(item => (
                                              <div key={item.field} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                                                <span className="text-xs text-foreground">{item.label}</span>
                                                <Switch
                                                  checked={user.buttonVisibility?.[item.field] === true}
                                                  onCheckedChange={v => handleButtonVisibilityChange(user.id, item.field, v)}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Col 3 — Page Access */}
                                  <div className="rounded-xl border border-border bg-card p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <Eye className="h-4 w-4 text-emerald-500" />
                                        <span className="text-sm font-semibold">Page Access</span>
                                      </div>
                                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                        {accessedPages}/{availablePages.length}
                                      </span>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                                      {availablePages.map(page => (
                                        <div key={`${user.id}-${page.path}`} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                                          <span className="text-xs text-foreground">{page.name}</span>
                                          <Switch
                                            checked={user.pageAccess?.[page.path] === true}
                                            onCheckedChange={checked => handlePageAccessChange(user.id, page.path, checked)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Revoke footer */}
                                <div className="flex justify-end pt-1">
                                  <Button size="sm" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 gap-1.5"
                                    onClick={() => handleStatusChange(user.id, "REJECTED")}>
                                    <UserX className="h-4 w-4" /> Revoke Access
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </TabsContent>

            {/* ── Rejected Tab ────────────────────────────────────────── */}
            <TabsContent value="rejected" className="mt-6">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-lg font-bold">Rejected Users</h2>
                  <p className="text-sm text-muted-foreground">Rejected users are blocked from the app. Unblock to move them to Pending so they can request access again, or Approve to grant access directly.</p>
                </div>
                {loading ? <LoadingState /> :
                  filteredRejected.length === 0 ? (
                    <div className="p-6">
                      <EmptyState icon={searchQuery ? Filter : UserX}
                        message={searchQuery ? "No rejected users match your search" : "No rejected users"}
                        onClear={searchQuery ? () => setSearchQuery("") : undefined} />
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredRejected.map(user => (
                        <div key={user.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <UserAvatar email={user.email} />
                            <div>
                              <p className="font-semibold text-sm">{user.email}</p>
                              <p className="text-xs text-muted-foreground">Registered {new Date(user.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 gap-1.5"
                              onClick={() => { handleStatusChange(user.id, "PENDING"); toast({ title: "Unblocked", description: "User moved to Pending. They can sign in and request access again." }); }}>
                              Unblock
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 gap-1.5"
                              onClick={() => { handleStatusChange(user.id, "APPROVED"); toast({ title: "Access Restored", description: "Default page access granted." }); }}>
                              <CheckCircle className="h-4 w-4" /> Approve Access
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </TabsContent>

            {/* ── Role Permissions Tab ────────────────────────────────── */}
            <TabsContent value="role-permissions" className="mt-6">
              <RoleDefaultPermissionsManager />
            </TabsContent>
          </Tabs>
        </div>
      </SimpleDashboardLayout>

      {/* ── Reset Password / Login Link Dialog ───────────────────── */}
      <Dialog open={!!resetPasswordUser} onOpenChange={open => {
        if (!open) { setResetPasswordUser(null); setTempPassword(''); setGeneratedLoginLink(null); setResetTab("link"); }
      }}>
        <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white font-bold">Account Access Recovery</DialogTitle>
                <DialogDescription className="text-amber-100 text-xs mt-0.5 font-medium">
                  {resetPasswordUser?.email}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-border bg-muted/30">
            <button
              className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${resetTab === "link" ? "border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 bg-background" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setResetTab("link"); setGeneratedLoginLink(null); }}
            >
              <Mail className="h-4 w-4" /> Magic Login Link
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Recommended</span>
            </button>
            <button
              className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${resetTab === "password" ? "border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 bg-background" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setResetTab("password")}
            >
              <KeyRound className="h-4 w-4" /> Set Temp Password
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {resetTab === "link" ? (
              <>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
                  Generate a one-time magic link for this user. They click it to sign in instantly — no password needed. After login, they will be prompted to set their permanent password.
                </div>

                {!generatedLoginLink ? (
                  <Button
                    className="w-full rounded-xl h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold gap-2"
                    onClick={handleGenerateLoginLink}
                    disabled={generatingLink}
                  >
                    {generatingLink
                      ? <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generating…</>
                      : <><Mail className="h-4 w-4" /> Generate Magic Login Link</>}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      Link generated! Copy and share it securely with {resetPasswordUser?.email}. It expires after one use.
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground font-mono break-all select-all">
                        {generatedLoginLink}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl flex-shrink-0 gap-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedLoginLink);
                          toast({ title: 'Copied!', description: 'Login link copied to clipboard.' });
                        }}
                      >
                        <Copy className="h-4 w-4" /> Copy
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-xl text-muted-foreground"
                      onClick={() => { setGeneratedLoginLink(null); }}
                    >
                      Generate new link
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                  Set a temporary password and share it with the user. They will be required to set a new permanent password immediately after logging in.
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Temporary Password</Label>
                  <div className="relative">
                    <Input
                      type={showTempPassword ? 'text' : 'password'}
                      placeholder="Enter a temporary password (min 8 chars)"
                      value={tempPassword}
                      onChange={e => setTempPassword(e.target.value)}
                      className="pr-10 rounded-xl"
                      autoFocus={resetTab === "password"}
                      onKeyDown={e => { if (e.key === 'Enter') handleResetPassword(); }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowTempPassword(v => !v)}
                    >
                      {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 8 characters. Share this securely with the user.</p>
                </div>
                <Button
                  className="w-full rounded-xl h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold gap-2"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || tempPassword.length < 8}
                >
                  {resettingPassword
                    ? <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Setting…</>
                    : <><KeyRound className="h-4 w-4" /> Set Temporary Password</>}
                </Button>
              </>
            )}
          </div>

          <DialogFooter className="px-6 pb-5">
            <Button variant="outline" className="rounded-xl" onClick={() => { setResetPasswordUser(null); setTempPassword(''); setGeneratedLoginLink(null); setResetTab("link"); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
