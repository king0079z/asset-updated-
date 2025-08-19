import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useOrganization, Organization, Subscription } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, CreditCard, Edit, Key, Mail, Plus, Trash, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OrganizationSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    organization, 
    subscription, 
    members, 
    isLoading,
    createOrganization,
    updateOrganization,
    inviteMember,
    removeMember,
    updateMemberRole,
    updateSubscription,
    getUsageLimits
  } = useOrganization();

  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [editedOrgName, setEditedOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(12);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showRenewDialog, setShowRenewDialog] = useState(false);

  const usageLimits = getUsageLimits();

  const handleCreateOrganization = async () => {
    if (!newOrgName) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await createOrganization(newOrgName);
      setNewOrgName('');
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating organization:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateOrganization = async () => {
    if (!editedOrgName) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updateOrganization({ name: editedOrgName });
      setShowEditDialog(false);
    } catch (error) {
      console.error('Error updating organization:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    setIsInviting(true);
    try {
      await inviteMember(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('MEMBER');
      setShowInviteDialog(false);
    } catch (error) {
      console.error('Error inviting member:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpgradeSubscription = async () => {
    if (!selectedPlan) {
      toast({
        title: "Error",
        description: "Please select a plan",
        variant: "destructive",
      });
      return;
    }

    setIsUpgrading(true);
    try {
      await updateSubscription(selectedPlan, selectedDuration);
      setShowUpgradeDialog(false);
    } catch (error) {
      console.error('Error upgrading subscription:', error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleRenewSubscription = async () => {
    setIsUpgrading(true);
    try {
      await renewSubscription(selectedDuration);
      setShowRenewDialog(false);
    } catch (error) {
      console.error('Error renewing subscription:', error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      try {
        await removeMember(memberId);
      } catch (error) {
        console.error('Error removing member:', error);
      }
    }
  };

  const handleUpdateMemberRole = async (memberId: string, role: string) => {
    try {
      await updateMemberRole(memberId, role);
    } catch (error) {
      console.error('Error updating member role:', error);
    }
  };

  const openEditDialog = () => {
    if (organization) {
      setEditedOrgName(organization.name);
      setShowEditDialog(true);
    }
  };

  const openUpgradeDialog = () => {
    if (subscription) {
      setSelectedPlan(subscription.plan);
      setSelectedDuration(12);
      setShowUpgradeDialog(true);
    }
  };

  const openRenewDialog = () => {
    if (subscription) {
      setSelectedDuration(12);
      setShowRenewDialog(true);
    }
  };

  const getPlanDetails = (plan: string) => {
    switch (plan) {
      case 'FREE':
        return {
          name: 'Free',
          price: '$0',
          description: 'Basic features for small kitchens',
          features: [
            '5 users',
            '2 kitchens',
            '50 recipes',
            '100 assets',
            'Basic reporting',
          ],
        };
      case 'BASIC':
        return {
          name: 'Basic',
          price: '$29',
          description: 'Essential features for growing kitchens',
          features: [
            '10 users',
            '5 kitchens',
            '100 recipes',
            '250 assets',
            'AI analysis',
            'Barcode scanning',
          ],
        };
      case 'PROFESSIONAL':
        return {
          name: 'Professional',
          price: '$99',
          description: 'Advanced features for professional kitchens',
          features: [
            '25 users',
            '15 kitchens',
            '500 recipes',
            '1,000 assets',
            'Advanced reporting',
            'API access',
          ],
        };
      case 'ENTERPRISE':
        return {
          name: 'Enterprise',
          price: '$299',
          description: 'Complete solution for large operations',
          features: [
            '100 users',
            '50 kitchens',
            '2,000 recipes',
            '5,000 assets',
            'Custom integrations',
            'Dedicated support',
          ],
        };
      default:
        return {
          name: 'Unknown',
          price: '$0',
          description: '',
          features: [],
        };
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!organization) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Create an Organization</CardTitle>
            <CardDescription>
              Create an organization to manage your kitchens, recipes, and team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  placeholder="Enter organization name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleCreateOrganization} 
                disabled={isCreating}
              >
                {isCreating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Organization Settings</CardTitle>
                  <CardDescription>
                    Manage your organization details
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <div className="text-lg font-medium">{organization.name}</div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div>
                    <Badge variant={organization.status === 'ACTIVE' ? 'success' : 'destructive'}>
                      {organization.status}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Organization ID</Label>
                  <div className="font-mono text-sm bg-muted p-2 rounded">{organization.id}</div>
                </div>
                <div className="space-y-2">
                  <Label>Organization URL</Label>
                  <div className="font-mono text-sm bg-muted p-2 rounded">
                    {typeof window !== 'undefined' ? `${window.location.origin}/${organization.slug}` : `/${organization.slug}`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage your team members and their roles
                  </CardDescription>
                </div>
                <Button onClick={() => setShowInviteDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {members.length} of {subscription?.maxUsers || 0} members
                  </div>
                  <Progress 
                    value={(members.length / (subscription?.maxUsers || 1)) * 100} 
                    className="w-64"
                  />
                </div>
                
                <div className="border rounded-md">
                  <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium">
                    <div className="col-span-5">User</div>
                    <div className="col-span-3">Role</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  
                  {members.map((member) => (
                    <div key={member.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 items-center">
                      <div className="col-span-5 flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.email.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.email}</div>
                          {member.userId === user?.id && (
                            <div className="text-xs text-muted-foreground">You</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="col-span-3">
                        {member.userId === user?.id ? (
                          <Badge variant="outline">{member.role}</Badge>
                        ) : (
                          <Select
                            defaultValue={member.role}
                            onValueChange={(value) => handleUpdateMemberRole(member.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OWNER">Owner</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="MEMBER">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      <div className="col-span-2">
                        {member.inviteAccepted ? (
                          <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            Pending
                          </Badge>
                        )}
                      </div>
                      
                      <div className="col-span-2 text-right">
                        {member.userId !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>
                    Manage your subscription and billing
                  </CardDescription>
                </div>
                <Button onClick={openUpgradeDialog}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Change Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-col p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-lg">Current Plan</h3>
                      <div className="flex items-center mt-1">
                        <Badge className="mr-2" variant={subscription?.plan === 'FREE' ? 'outline' : 'default'}>
                          {getPlanDetails(subscription?.plan || 'FREE').name}
                        </Badge>
                        <span className="text-muted-foreground">
                          {getPlanDetails(subscription?.plan || 'FREE').price}/month
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {subscription?.isActive ? 'Active' : 'Inactive'}
                      </div>
                      {subscription?.endDate && (
                        <div className="text-sm text-muted-foreground">
                          Expires: {new Date(subscription.endDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {subscription?.licenseKey && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Key className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm font-medium">License Key</span>
                        </div>
                        {subscription?.endDate && new Date(subscription.endDate) < new Date() && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={openRenewDialog}
                          >
                            Renew License
                          </Button>
                        )}
                      </div>
                      <div className="mt-2 p-2 bg-muted rounded font-mono text-sm break-all">
                        {subscription.licenseKey}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Generated on: {new Date(subscription.licenseKeyCreatedAt || '').toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-medium">Usage Limits</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Users</span>
                        <span className="text-sm">{usageLimits.usersUsed} of {usageLimits.usersLimit}</span>
                      </div>
                      <Progress 
                        value={(usageLimits.usersUsed / usageLimits.usersLimit) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Kitchens</span>
                        <span className="text-sm">{usageLimits.kitchensUsed} of {usageLimits.kitchensLimit}</span>
                      </div>
                      <Progress 
                        value={(usageLimits.kitchensUsed / usageLimits.kitchensLimit) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Recipes</span>
                        <span className="text-sm">{usageLimits.recipesUsed} of {usageLimits.recipesLimit}</span>
                      </div>
                      <Progress 
                        value={(usageLimits.recipesUsed / usageLimits.recipesLimit) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Assets</span>
                        <span className="text-sm">{usageLimits.assetsUsed} of {usageLimits.assetsLimit}</span>
                      </div>
                      <Progress 
                        value={(usageLimits.assetsUsed / usageLimits.assetsLimit) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-medium">Features</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(subscription?.features || {}).map(([feature, enabled]) => (
                      <div key={feature} className="flex items-center">
                        <div className={`h-4 w-4 rounded-full mr-2 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="capitalize">{feature.replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Edit Organization Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update your organization details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Organization Name</Label>
              <Input
                id="edit-name"
                placeholder="Enter organization name"
                value={editedOrgName}
                onChange={(e) => setEditedOrgName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateOrganization} 
              disabled={isUpdating}
            >
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Invite a new member to your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={setInviteRole}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground mt-1">
                <strong>Owner:</strong> Full access to all settings and billing
                <br />
                <strong>Admin:</strong> Can manage users and content
                <br />
                <strong>Member:</strong> Can view and edit content
              </div>
            </div>
            
            {members.length >= (subscription?.maxUsers || 0) && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have reached your user limit. Upgrade your plan to add more members.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteMember} 
              disabled={isInviting || members.length >= (subscription?.maxUsers || 0)}
            >
              {isInviting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Upgrade Subscription Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Choose the plan that best fits your needs
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'].map((plan) => {
                const details = getPlanDetails(plan);
                const isCurrentPlan = subscription?.plan === plan;
                
                return (
                  <div 
                    key={plan}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPlan === plan 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <div className="font-medium text-lg">{details.name}</div>
                    <div className="text-2xl font-bold my-2">{details.price}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                    <div className="text-sm text-muted-foreground mb-4">{details.description}</div>
                    
                    {isCurrentPlan && (
                      <Badge className="mb-3" variant="outline">Current Plan</Badge>
                    )}
                    
                    <ul className="space-y-2 text-sm">
                      {details.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            
            {selectedPlan !== 'FREE' && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-medium mb-2">Subscription Duration</h3>
                <div className="flex flex-wrap gap-2">
                  {[3, 6, 12, 24].map((months) => (
                    <div 
                      key={months}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedDuration === months 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedDuration(months)}
                    >
                      <div className="font-medium">{months} months</div>
                      <div className="text-sm text-muted-foreground">
                        {months === 12 && "Best value"}
                        {months === 24 && "Save 10%"}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex justify-between">
                    <span>Subscription cost:</span>
                    <span className="font-medium">
                      ${parseInt(getPlanDetails(selectedPlan).price.replace('$', '')) * selectedDuration}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Your subscription will be valid until {new Date(new Date().setMonth(new Date().getMonth() + selectedDuration)).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpgradeSubscription} 
              disabled={isUpgrading || (selectedPlan === subscription?.plan && selectedPlan !== 'FREE')}
            >
              {isUpgrading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              {selectedPlan === 'FREE' ? 'Downgrade' : 'Upgrade'} to {getPlanDetails(selectedPlan).name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Renew Subscription Dialog */}
      <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew Subscription</DialogTitle>
            <DialogDescription>
              Renew your {getPlanDetails(subscription?.plan || 'BASIC').name} plan subscription
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <h3 className="font-medium mb-2">Renewal Duration</h3>
            <div className="flex flex-wrap gap-2">
              {[3, 6, 12, 24].map((months) => (
                <div 
                  key={months}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedDuration === months 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedDuration(months)}
                >
                  <div className="font-medium">{months} months</div>
                  <div className="text-sm text-muted-foreground">
                    {months === 12 && "Best value"}
                    {months === 24 && "Save 10%"}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between">
                <span>Renewal cost:</span>
                <span className="font-medium">
                  ${parseInt(getPlanDetails(subscription?.plan || 'BASIC').price.replace('$', '')) * selectedDuration}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Your subscription will be valid until {new Date(new Date().setMonth(new Date().getMonth() + selectedDuration)).toLocaleDateString()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRenewSubscription} 
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Renew Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}