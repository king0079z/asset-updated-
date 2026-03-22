import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Check, Merge, AlertTriangle, Loader2, RefreshCw, Building2, Ticket, Package, Shield } from 'lucide-react';

type OrgMember = {
  id: string;
  userId: string;
  email: string;
  userStatus: string;
  isAdmin: boolean;
  role: string;
  inviteAccepted: boolean;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  members: OrgMember[];
};

type User = {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  role: string;
};

type MergePreview = {
  targetOrg: { id: string; name: string };
  organizationsToDelete: { id: string; name: string }[];
  willMigrate: Record<string, number>;
};

export default function AdminOrganizationsPage() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('MEMBER');
  const [assigning, setAssigning] = useState(false);

  // merge dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/organizations').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
    ]).then(([orgRes, userRes]) => {
      const orgs: Organization[] = orgRes.organizations || [];
      orgs.sort((a, b) => b.assetCount - a.assetCount || b.members.length - a.members.length);
      setOrganizations(orgs);
      setUsers(userRes || []);
      if (orgs.length > 0 && !mergeTargetId) setMergeTargetId(orgs[0].id);
      setLoading(false);
    });
  }, [mergeTargetId]);

  useEffect(() => { load(); }, []);

  /* ── Preview merge ─────────────────────────────────────────────────── */
  const openMergeDialog = () => {
    setMergePreview(null);
    setMergeDialogOpen(true);
  };

  useEffect(() => {
    if (!mergeDialogOpen || !mergeTargetId) return;
    setPreviewLoading(true);
    fetch(`/api/admin/merge-organizations?targetOrgId=${mergeTargetId}`)
      .then(r => r.json())
      .then(d => { setMergePreview(d); setPreviewLoading(false); })
      .catch(() => setPreviewLoading(false));
  }, [mergeDialogOpen, mergeTargetId]);

  /* ── Execute merge ─────────────────────────────────────────────────── */
  const handleMerge = async () => {
    if (!mergeTargetId) return;
    setMerging(true);
    try {
      const res = await fetch('/api/admin/merge-organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetOrgId: mergeTargetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Merge failed');
      toast({
        title: 'Merge complete',
        description: `All data moved to "${data.targetOrg.name}". ${data.deletedOrgs.length} old org(s) deleted.`,
      });
      setMergeDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Merge failed', description: err.message, variant: 'destructive' });
    } finally {
      setMerging(false);
    }
  };

  /* ── Assign user ───────────────────────────────────────────────────── */
  const handleAssign = async () => {
    if (!selectedOrg || !selectedUserId || !selectedRole) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/admin/organizations/assign-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrg.id, userId: selectedUserId, role: selectedRole }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast({ title: 'User assigned', description: 'User moved to organization.' });
      setAssignDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const mainOrg = organizations.find(o => o.id === mergeTargetId) ?? organizations[0];

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Organizations Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {organizations.length} organization{organizations.length !== 1 ? 's' : ''} in the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {organizations.length > 1 && (
            <Button onClick={openMergeDialog} className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700">
              <Merge className="h-4 w-4" /> Merge All Into One
            </Button>
          )}
        </div>
      </div>

      {/* ── Alert banner if multiple orgs ── */}
      {organizations.length > 1 && (
        <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">Multiple organizations detected</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Users in separate organizations cannot see each other's tickets or assets.
              Use <strong>Merge All Into One</strong> to consolidate everything under your main organization.
            </p>
          </div>
        </div>
      )}

      {/* ── Org cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {organizations.map(org => {
          const isMain = org.id === organizations[0].id;
          return (
            <Card key={org.id} className={`overflow-hidden border-2 ${isMain ? 'border-indigo-300 dark:border-indigo-700' : 'border-border'}`}>
              <CardHeader className={`${isMain ? 'bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40' : 'bg-muted/20'} pb-3`}>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {org.name}
                      {isMain && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">MAIN</span>}
                    </CardTitle>
                    <CardDescription>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{org.slug}</code>
                    </CardDescription>
                  </div>
                  <Badge variant={org.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-xs">
                    {org.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {/* stats row */}
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Package className="h-4 w-4 text-indigo-500" />
                    <strong className="text-foreground">{org.assetCount}</strong> assets
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 text-violet-500" />
                    <strong className="text-foreground">{org.members.length}</strong> member{org.members.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* members list */}
                {org.members.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
                    {org.members.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                          {(m.email ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium flex-1 truncate">{m.email}</span>
                        <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                        {m.isAdmin && <Shield className="h-3 w-3 text-amber-500" title="Admin" />}
                        {!m.inviteAccepted && <span className="text-[10px] text-amber-600">Pending</span>}
                      </div>
                    ))}
                  </div>
                )}

                <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => { setSelectedOrg(org); setSelectedUserId(''); setSelectedRole('MEMBER'); setAssignDialogOpen(true); }}>
                  <Plus className="h-4 w-4" /> Assign User to This Org
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══════════════════════════ MERGE DIALOG ═══════════════════════════ */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5 text-indigo-600" /> Merge All Organizations
            </DialogTitle>
            <DialogDescription>
              All users, tickets, assets and data from every other organization will be moved into the selected target. The other organizations will then be deleted. <strong>This cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* target picker */}
            <div>
              <label className="text-sm font-semibold mb-1 block">Keep this organization (target)</label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pick the organization to keep" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} — {o.assetCount} assets, {o.members.length} members
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">The organization with the most assets is pre-selected.</p>
            </div>

            {/* preview */}
            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
              </div>
            )}

            {mergePreview && !previewLoading && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-semibold">What will happen:</p>

                {/* orgs being deleted */}
                {mergePreview.organizationsToDelete.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Organizations to be deleted ({mergePreview.organizationsToDelete.length}):</p>
                    <ul className="space-y-1">
                      {mergePreview.organizationsToDelete.map(o => (
                        <li key={o.id} className="flex items-center gap-2 text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block shrink-0" />
                          <span className="font-medium text-red-700 dark:text-red-400">{o.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-600">Nothing to merge — only one org exists.</p>
                )}

                {/* migration counts */}
                {mergePreview.organizationsToDelete.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(mergePreview.willMigrate).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between bg-background rounded-lg px-2.5 py-1.5 border border-border text-xs">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-bold text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* warning */}
            {mergePreview && mergePreview.organizationsToDelete.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>This action is <strong>permanent</strong>. Make sure the target organization is correct before proceeding.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} disabled={merging}>Cancel</Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !mergeTargetId || !mergePreview || mergePreview.organizationsToDelete.length === 0}
              className="gap-2 bg-red-600 hover:bg-red-700 text-white"
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
              {merging ? 'Merging…' : 'Confirm Merge & Delete Others'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════ ASSIGN DIALOG ═══════════════════════════ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to "{selectedOrg?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block mb-1 text-sm font-medium">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email} {u.isAdmin ? '(Admin)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedUserId} className="gap-2">
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
