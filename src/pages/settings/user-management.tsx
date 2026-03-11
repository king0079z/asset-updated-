import { SimpleDashboardLayout } from "@/components/SimpleDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const CUSTOM_ROLES_KEY = "/api/admin/custom-roles";
const USERS_PENDING_KEY = "/api/admin/users?status=PENDING";
const USERS_APPROVED_KEY = "/api/admin/users?status=APPROVED";
const USERS_REJECTED_KEY = "/api/admin/users?status=REJECTED";
const PAGES_KEY = "/api/admin/pages";
const ADMIN_TTL = 2 * 60_000;
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
  const { toast } = useToast();

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

  useEffect(() => {
    if (hasCachedUsers) { setTimeout(() => loadUsers(true), 300); }
    else { loadUsers(false); }
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
      const isStandard = ["ADMIN", "MANAGER", "STAFF"].includes(roleName);
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
      case "ADMIN":   return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300";
      case "MANAGER": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      default:        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
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
                  onClick={() => { setRefreshing(true); loadUsers(); }} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
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
                              <p className="text-xs text-muted-foreground">Registered {new Date(user.createdAt).toLocaleDateString()}</p>
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
                  <div className="space-y-5">
                    {filteredApproved.map(user => (
                      <div key={user.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                        {/* User Header */}
                        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-muted/50 to-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar email={user.email} />
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <p className="font-bold">{user.email}</p>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeClass(user)}`}>
                                  {user.customRoleName ?? user.role}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 gap-1.5"
                            onClick={() => handleStatusChange(user.id, "REJECTED")}>
                            <UserX className="h-4 w-4" /> Revoke Access
                          </Button>
                        </div>

                        {/* Permissions Grid */}
                        <div className="p-6 space-y-5">
                          {/* Role */}
                          <div className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-violet-500" />
                                <div>
                                  <Label className="font-semibold text-base">Role Assignment</Label>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {user.role === "ADMIN" ? "Full system access including admin settings" :
                                      user.role === "MANAGER" ? "All features except admin settings" :
                                        "Limited access based on page permissions"}
                                  </p>
                                </div>
                              </div>
                              <Select defaultValue={user.customRoleName ?? user.role} onValueChange={v => handleRoleChange(user.id, v)}>
                                <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                  <SelectItem value="MANAGER">Manager</SelectItem>
                                  <SelectItem value="STAFF">Staff</SelectItem>
                                  <CustomRoleOptions />
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Doc Delete */}
                          <div className="rounded-xl border border-border p-4 flex items-center justify-between">
                            <div>
                              <Label className="font-semibold">Document Delete Permission</Label>
                              <p className="text-xs text-muted-foreground mt-0.5">Allow this user to delete documents from assets</p>
                            </div>
                            <Switch checked={user.canDeleteDocuments ?? false}
                              onCheckedChange={v => handleDocumentDeletePermissionChange(user.id, v)} />
                          </div>

                          {/* Button Visibility */}
                          <div className="rounded-xl border border-border p-4">
                            <Label className="font-semibold text-base mb-3 block">Button Visibility</Label>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assets</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <PermissionToggle label="Dispose Asset" userId={user.id} field="dispose_asset" value={user.buttonVisibility?.["dispose_asset"] === true} />
                                  <PermissionToggle label="Assets Button" userId={user.id} field="assets_button" value={user.buttonVisibility?.["assets_button"] === true} />
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Food Supply</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <PermissionToggle label="Edit Food Supply" userId={user.id} field="edit_food_supply" value={user.buttonVisibility?.["edit_food_supply"] === true} />
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kitchen</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <PermissionToggle label="Consumption" userId={user.id} field="kitchen_consumption" value={user.buttonVisibility?.["kitchen_consumption"] === true} />
                                  <PermissionToggle label="Waste Tracking" userId={user.id} field="kitchen_waste_tracking" value={user.buttonVisibility?.["kitchen_waste_tracking"] === true} />
                                  <PermissionToggle label="Add Food Supply" userId={user.id} field="kitchen_food_supply" value={user.buttonVisibility?.["kitchen_food_supply"] === true} />
                                  <PermissionToggle label="Recipe Management" userId={user.id} field="kitchen_recipe" value={user.buttonVisibility?.["kitchen_recipe"] === true} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Page Access */}
                          <div className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="font-semibold text-base">Page Access</Label>
                              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                                {Object.values(user.pageAccess ?? {}).filter(Boolean).length} / {availablePages.length} pages
                              </span>
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                                {availablePages.map(page => (
                                  <div key={`${user.id}-${page.path}`} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/30 transition-colors">
                                    <Label className="text-sm cursor-pointer">{page.name}</Label>
                                    <Switch
                                      checked={user.pageAccess?.[page.path] === true}
                                      onCheckedChange={checked => handlePageAccessChange(user.id, page.path, checked)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </TabsContent>

            {/* ── Rejected Tab ────────────────────────────────────────── */}
            <TabsContent value="rejected" className="mt-6">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-lg font-bold">Rejected Users</h2>
                  <p className="text-sm text-muted-foreground">Users denied access — re-approve to grant entry</p>
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
                          <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 gap-1.5"
                            onClick={() => { handleStatusChange(user.id, "APPROVED"); toast({ title: "Access Restored", description: "Default page access granted." }); }}>
                            <CheckCircle className="h-4 w-4" /> Approve Access
                          </Button>
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
    </ProtectedRoute>
  );
}
