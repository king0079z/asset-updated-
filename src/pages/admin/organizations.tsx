import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Check } from 'lucide-react';

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  members: {
    id: string;
    userId: string;
    email: string;
    userStatus: string;
    isAdmin: boolean;
    role: string;
    inviteAccepted: boolean;
  }[];
};

type User = {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  role: string;
  customRoleId?: string;
  customRoleName?: string;
  createdAt: string;
};

export default function AdminOrganizationsPage() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('MEMBER');
  const [assigning, setAssigning] = useState(false);

  // Fetch organizations and users
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/organizations').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
    ]).then(([orgRes, userRes]) => {
      setOrganizations(orgRes.organizations || []);
      setUsers(userRes || []);
      setLoading(false);
    });
  }, []);

  const openAssignDialog = (org: Organization) => {
    setSelectedOrg(org);
    setSelectedUserId('');
    setSelectedRole('MEMBER');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedOrg || !selectedUserId || !selectedRole) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/admin/organizations/assign-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          userId: selectedUserId,
          role: selectedRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to assign user');
      }
      toast({ title: 'User assigned', description: 'User successfully assigned to organization.' });
      // Refresh organizations
      const orgRes = await fetch('/api/admin/organizations').then(r => r.json());
      setOrganizations(orgRes.organizations || []);
      setAssignDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Organizations Management
        </h1>
        <p className="text-muted-foreground mt-1">
          View all organizations, their asset counts, and assign users to organizations.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {organizations.map(org => (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{org.name}</CardTitle>
                  <CardDescription>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{org.slug}</span>
                  </CardDescription>
                </div>
                <Badge variant={org.status === 'ACTIVE' ? 'success' : 'destructive'}>
                  {org.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <span className="font-medium">Assets:</span>{' '}
                <span className="font-mono">{org.assetCount}</span>
              </div>
              <div className="mb-2">
                <span className="font-medium">Members:</span>
                <ul className="ml-4 mt-1 space-y-1">
                  {org.members.map(m => (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="font-mono text-xs">{m.email}</span>
                      <Badge variant="outline">{m.role}</Badge>
                      {m.inviteAccepted ? (
                        <Badge variant="success" className="ml-1">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-1">Pending</Badge>
                      )}
                      {m.isAdmin && (
                        <Badge variant="secondary" className="ml-1">Admin</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <Button size="sm" onClick={() => openAssignDialog(org)}>
                <Plus className="h-4 w-4 mr-1" />
                Assign User
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assign User Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block mb-1 font-medium">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
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
              <label className="block mb-1 font-medium">Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
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
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedUserId || !selectedRole}>
              {assigning ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}