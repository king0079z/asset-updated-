import React, { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Settings, 
  Users, 
  Crown,
  Shield,
  User
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export const OrganizationSwitcher: React.FC = () => {
  const { user } = useAuth();
  const { 
    currentOrganization, 
    userOrganizations, 
    subscription,
    switchOrganization, 
    createOrganization,
    loading 
  } = useOrganization();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSwitchOrganization = async (organizationId: string) => {
    try {
      await switchOrganization(organizationId);
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization name is required",
      });
      return;
    }

    setCreating(true);
    try {
      await createOrganization(newOrgName.trim());
      setNewOrgName('');
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating organization:', error);
    } finally {
      setCreating(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="h-3 w-3 text-blue-500" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default';
      case 'ADMIN':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!user || loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center space-x-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={currentOrganization?.logo} />
                <AvatarFallback>
                  <Building2 className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-32">
                {currentOrganization?.name || 'Select Organization'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="start">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Organizations</p>
              <p className="text-xs leading-none text-muted-foreground">
                Switch between your organizations
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {userOrganizations.map((membership) => (
            <DropdownMenuItem
              key={membership.organizationId}
              onClick={() => handleSwitchOrganization(membership.organizationId)}
              className="flex items-center justify-between p-3 cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={membership.organization.logo} />
                  <AvatarFallback>
                    <Building2 className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {membership.organization.name}
                  </span>
                  <div className="flex items-center space-x-1">
                    {getRoleIcon(membership.role)}
                    <span className="text-xs text-muted-foreground">
                      {membership.role.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
              {currentOrganization?.id === membership.organizationId && (
                <Badge variant="default" className="text-xs">
                  Current
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center space-x-2 p-3 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Organization</span>
          </DropdownMenuItem>
          
          {currentOrganization && (
            <DropdownMenuItem className="flex items-center space-x-2 p-3 cursor-pointer">
              <Settings className="h-4 w-4" />
              <span>Organization Settings</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Current Organization Info */}
      {currentOrganization && subscription && (
        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Plan:</span>
            <Badge variant={getRoleBadgeVariant(subscription.plan)}>
              {subscription.plan}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={subscription.isActive ? "default" : "destructive"}>
              {subscription.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      )}

      {/* Create Organization Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to manage your team and resources separately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="col-span-3"
                placeholder="Enter organization name"
                disabled={creating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateOrganization}
              disabled={creating || !newOrgName.trim()}
            >
              {creating ? "Creating..." : "Create Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrganizationSwitcher;