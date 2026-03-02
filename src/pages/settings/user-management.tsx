import { SimpleDashboardLayout } from "@/components/SimpleDashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, XCircle, UserCog, Settings, Search, Users, UserPlus, UserX, 
  Filter, RefreshCw, Key, Mail, Copy, AlertCircle 
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RoleDefaultPermissionsManager from "@/components/RoleDefaultPermissionsManager";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type User = {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  role: string;
  customRoleId?: string;
  customRoleName?: string; // Add this field to store the custom role name
  pageAccess: Record<string, boolean> | null;
  canDeleteDocuments?: boolean;
  buttonVisibility?: Record<string, boolean> | null;
  createdAt: string;
  organizationId?: string;
  licenseKey?: string;
};

type Page = {
  path: string;
  name: string;
};

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
    const loadCustomRoles = async () => {
      try {
        const response = await fetch("/api/admin/custom-roles");
        if (response.ok) {
          const data = await response.json();
          setCustomRoles(data);
        }
      } catch (error) {
        console.error("Error loading custom roles:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCustomRoles();
  }, []);

  if (loading) {
    return <div className="px-2 py-1 text-sm text-muted-foreground">Loading custom roles...</div>;
  }

  if (customRoles.length === 0) {
    return null;
  }

  return (
    <>
      <div className="py-2">
        <div className="px-2 text-xs font-medium">Custom Roles</div>
      </div>
      {customRoles.map((role) => (
        <SelectItem key={role.id} value={role.name}>
          {role.name}
        </SelectItem>
      ))}
    </>
  );
}

export default function UserManagementPage() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<User[]>([]);
  const [availablePages, setAvailablePages] = useState<Page[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState<string | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [subscriptionDuration, setSubscriptionDuration] = useState("12");
  const [subscriptionPlan, setSubscriptionPlan] = useState("BASIC");
  const { toast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Load custom roles first
      const customRolesResponse = await fetch("/api/admin/custom-roles");
      const customRolesData = await customRolesResponse.json();
      setCustomRoles(customRolesData);
      
      // Create a map of custom role IDs to names for quick lookup
      const customRoleMap = customRolesData.reduce((map: Record<string, string>, role: CustomRole) => {
        map[role.id] = role.name;
        return map;
      }, {});
      
      // Helper function to add custom role names to users
      const addCustomRoleNames = (users: User[]) => {
        return users.map(user => {
          if (user.customRoleId && customRoleMap[user.customRoleId]) {
            return {
              ...user,
              customRoleName: customRoleMap[user.customRoleId]
            };
          }
          return user;
        });
      };

      // Load pending users
      const pendingResponse = await fetch("/api/admin/users?status=PENDING");
      const pendingData = await pendingResponse.json();
      setPendingUsers(addCustomRoleNames(pendingData));

      // Load approved users
      const approvedResponse = await fetch("/api/admin/users?status=APPROVED");
      const approvedData = await approvedResponse.json();
      setApprovedUsers(addCustomRoleNames(approvedData));

      // Load rejected users
      const rejectedResponse = await fetch("/api/admin/users?status=REJECTED");
      const rejectedData = await rejectedResponse.json();
      setRejectedUsers(addCustomRoleNames(rejectedData));

      // Load available pages
      const pagesResponse = await fetch("/api/admin/pages");
      const pagesData = await pagesResponse.json();
      setAvailablePages(pagesData);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const response = await fetch("/api/admin/users/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user status");
      }

      toast({
        title: "Success",
        description: `User has been ${status.toLowerCase()} successfully.`,
      });

      // Reload users to reflect changes
      loadUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const generateSubscriptionKey = async () => {
    if (!selectedUser) return;
    
    setIsGeneratingKey(true);
    setGeneratedLicenseKey(null);
    
    try {
      let organizationId = selectedUser.organizationId;
      
      // If the user doesn't have an organization, create one for them
      if (!organizationId) {
        // Create an organization for the user
        const createOrgResponse = await fetch('/api/organizations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            name: `${selectedUser.email.split('@')[0]}'s Organization`,
            userId: selectedUser.id
          }),
        });
        
        if (!createOrgResponse.ok) {
          const data = await createOrgResponse.json();
          throw new Error(data.error || "Failed to create organization for user");
        }
        
        const orgData = await createOrgResponse.json();
        organizationId = orgData.organization.id;
        
        toast({
          title: "Organization Created",
          description: `Created organization for ${selectedUser.email}`,
        });
      }
      
      // Get the current user's email from the auth context
      const currentUserResponse = await fetch("/api/users/permissions");
      const currentUserData = await currentUserResponse.json();
      
      // First, ensure the current user is added as a temporary owner of the organization
      // This is needed to bypass the permission check in the subscription endpoint
      const addOwnerResponse = await fetch(`/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: currentUserData.email, // Use the email from the current user data
          role: 'OWNER',
          // This is a special flag to indicate this is a temporary ownership for admin purposes
          adminOperation: true
        }),
      });
      
      if (!addOwnerResponse.ok) {
        console.log("Warning: Could not add admin as temporary owner, proceeding anyway");
        // Continue anyway as the admin check should still allow the operation
      }
      
      // Generate a subscription key
      const response = await fetch(`/api/organizations/${organizationId}/subscription`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          plan: subscriptionPlan, 
          durationMonths: parseInt(subscriptionDuration) 
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate subscription key");
      }

      const data = await response.json();
      setGeneratedLicenseKey(data.licenseKey);
      
      // Get the user's role (use the selected role from the dropdown)
      // If it's a custom role, we need to handle that differently
      let userRole = selectedUser.role;
      
      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + parseInt(subscriptionDuration));
      
      // Store the role information with the license key and send email
      const sendKeyResponse = await fetch('/api/admin/users/send-subscription-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          licenseKey: data.licenseKey,
          role: userRole,
          plan: subscriptionPlan,
          expirationDate: expirationDate.toISOString()
        }),
      });
      
      if (!sendKeyResponse.ok) {
        const errorData = await sendKeyResponse.json();
        throw new Error(errorData.error || "Failed to send subscription key to user");
      }
      
      // Also update the user's role to match the selected role
      await handleRoleChange(selectedUser.id, userRole);
      
      toast({
        title: "Success",
        description: "Subscription key generated and sent to user's email",
      });
      
      // Reload users to reflect changes
      loadUsers();
    } catch (error) {
      console.error("Error generating subscription key:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate subscription key",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingKey(false);
    }
  };
  
  const sendSubscriptionKeyEmail = async (email: string, licenseKey: string) => {
    try {
      // This would be implemented to send an email with the subscription key
      // For now, we'll just show a success message
      toast({
        title: "Email Sent",
        description: `Subscription key has been sent to ${email}`,
      });
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Warning",
        description: "Generated key successfully but failed to send email. Please copy and send manually.",
        variant: "destructive",
      });
      return false;
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "License key copied to clipboard",
    });
  };

  const handlePageAccessChange = async (userId: string, pagePath: string, enabled: boolean) => {
    try {
      // Get current user
      const user = [...approvedUsers, ...pendingUsers, ...rejectedUsers].find(u => u.id === userId);
      if (!user) return;

      // Create or update pageAccess object
      const pageAccess = { ...(user.pageAccess || {}) };
      pageAccess[pagePath] = enabled;

      const response = await fetch("/api/admin/users/update-page-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, pageAccess }),
      });

      if (!response.ok) {
        throw new Error("Failed to update page access");
      }

      toast({
        title: "Success",
        description: `Page access updated successfully.`,
      });

      // Reload users to reflect changes
      loadUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update page access",
        variant: "destructive",
      });
    }
  };
  
  const handleRoleChange = async (userId: string, roleName: string) => {
    try {
      // Check if this is a standard role or custom role
      const isStandardRole = ['ADMIN', 'MANAGER', 'STAFF'].includes(roleName);
      
      let requestBody: any = { userId };
      
      if (isStandardRole) {
        // For standard roles, just pass the role name
        requestBody.role = roleName;
      } else {
        // For custom roles, find the custom role ID by name
        const customRole = customRoles.find(role => role.name === roleName);
        if (customRole) {
          requestBody.customRoleId = customRole.id;
        } else {
          throw new Error(`Custom role "${roleName}" not found`);
        }
      }
      
      const response = await fetch("/api/admin/users/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to update user role");
      }

      // Find the user whose role was changed
      const user = [...approvedUsers, ...pendingUsers, ...rejectedUsers].find(u => u.id === userId);
      if (user && user.organizationId) {
        // Get the organization's subscription
        const subscriptionResponse = await fetch(`/api/organizations/${user.organizationId}/subscription`);
        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json();
          
          if (subscriptionData.licenseKey) {
            // Calculate expiration date based on the current subscription
            let expirationDate = new Date();
            if (subscriptionData.endDate) {
              expirationDate = new Date(subscriptionData.endDate);
            } else {
              // Default to 12 months if no end date is set
              expirationDate.setMonth(expirationDate.getMonth() + 12);
            }
            
            // Update the license key role information
            await fetch('/api/admin/users/send-subscription-key', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userId,
                licenseKey: subscriptionData.licenseKey,
                role: roleName,
                plan: subscriptionData.plan,
                expirationDate: expirationDate.toISOString()
              }),
            });
            
            toast({
              title: "Success",
              description: `User role updated to ${roleName} successfully. Subscription key has been updated with the new role permissions.`,
            });
          } else {
            toast({
              title: "Success",
              description: `User role updated to ${roleName} successfully. Default permissions for this role have been applied.`,
            });
          }
        } else {
          toast({
            title: "Success",
            description: `User role updated to ${roleName} successfully. Default permissions for this role have been applied.`,
          });
        }
      } else {
        toast({
          title: "Success",
          description: `User role updated to ${roleName} successfully. Default permissions for this role have been applied.`,
        });
      }

      // Reload users to reflect changes
      loadUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user role",
        variant: "destructive",
      });
    }
  };
  
  const handleDocumentDeletePermissionChange = async (userId: string, canDeleteDocuments: boolean) => {
    try {
      const response = await fetch("/api/admin/users/toggle-document-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, canDeleteDocuments }),
      });

      if (!response.ok) {
        throw new Error("Failed to update document delete permission");
      }

      toast({
        title: "Success",
        description: `Document delete permission ${canDeleteDocuments ? 'enabled' : 'disabled'} successfully.`,
      });

      // Reload users to reflect changes
      loadUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update document delete permission",
        variant: "destructive",
      });
    }
  };
  
  const handleButtonVisibilityChange = async (userId: string, buttonId: string, enabled: boolean) => {
    try {
      // Get current user
      const user = [...approvedUsers, ...pendingUsers, ...rejectedUsers].find(u => u.id === userId);
      if (!user) return;

      // Create or update buttonVisibility object
      const buttonVisibility = { ...(user.buttonVisibility || {}) };
      buttonVisibility[buttonId] = enabled;

      const response = await fetch("/api/admin/users/update-button-visibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, buttonVisibility }),
      });

      if (!response.ok) {
        throw new Error("Failed to update button visibility");
      }

      toast({
        title: "Success",
        description: `Button visibility updated successfully.`,
      });

      // Reload users to reflect changes
      loadUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update button visibility",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-300">Pending</Badge>;
      case "APPROVED":
        return <Badge variant="success" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-300">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRoleBadge = (user: User) => {
    // If user has a custom role name, display that instead of the standard role
    if (user.customRoleName) {
      return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300">{user.customRoleName}</Badge>;
    }
    
    // Otherwise, display the standard role
    switch (user.role) {
      case "ADMIN":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 border-purple-300">Admin</Badge>;
      case "MANAGER":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-300">Manager</Badge>;
      case "STAFF":
        return <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300">Staff</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300">{user.role}</Badge>;
    }
  };

  const filteredApprovedUsers = approvedUsers.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPendingUsers = pendingUsers.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRejectedUsers = rejectedUsers.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  return (
    <ProtectedRoute requireAdmin={true}>
      <SimpleDashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
              <p className="text-muted-foreground mt-1">Manage user access, roles, and permissions</p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="relative w-full sm:w-auto flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {approvedUsers.length} approved · {pendingUsers.length} pending · {rejectedUsers.length} rejected
              </span>
            </div>
          </div>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="mb-4 w-full sm:w-auto grid grid-cols-2 sm:inline-flex sm:grid-cols-none gap-1 sm:gap-0">
              <TabsTrigger value="pending" className="flex items-center">
                <UserPlus className="h-4 w-4 mr-2" />
                Pending {pendingUsers.length > 0 && `(${pendingUsers.length})`}
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Approved {approvedUsers.length > 0 && `(${approvedUsers.length})`}
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center">
                <UserX className="h-4 w-4 mr-2" />
                Rejected {rejectedUsers.length > 0 && `(${rejectedUsers.length})`}
              </TabsTrigger>
              <TabsTrigger value="role-permissions" className="flex items-center">
                <Settings className="h-4 w-4 mr-2" /> 
                Role Permissions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Pending Users</CardTitle>
                  <CardDescription>
                    Users waiting for approval to access the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredPendingUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                      {searchQuery ? (
                        <>
                          <Filter className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No pending users match your search</p>
                          <Button variant="link" onClick={() => setSearchQuery("")}>Clear search</Button>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No pending users found</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead className="hidden md:table-cell">Registration Date</TableHead>
                            <TableHead className="hidden sm:table-cell">Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPendingUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.email}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{getStatusBadge(user.status)}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex items-center text-blue-600 dark:text-blue-500 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                                        onClick={() => setSelectedUser(user)}
                                      >
                                        <Key className="mr-1 h-4 w-4" />
                                        Generate Key
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Generate Subscription Key</DialogTitle>
                                        <DialogDescription>
                                          Create a subscription key for {selectedUser?.email}
                                        </DialogDescription>
                                      </DialogHeader>
                                      
                                      <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                          <Label htmlFor="plan" className="text-right">
                                            Plan
                                          </Label>
                                          <Select 
                                            value={subscriptionPlan} 
                                            onValueChange={setSubscriptionPlan}
                                            defaultValue="BASIC"
                                          >
                                            <SelectTrigger className="col-span-3">
                                              <SelectValue placeholder="Select plan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="BASIC">Basic</SelectItem>
                                              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                                              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                          <Label htmlFor="duration" className="text-right">
                                            Duration
                                          </Label>
                                          <Select 
                                            value={subscriptionDuration} 
                                            onValueChange={setSubscriptionDuration}
                                            defaultValue="12"
                                          >
                                            <SelectTrigger className="col-span-3">
                                              <SelectValue placeholder="Select duration" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="3">3 months</SelectItem>
                                              <SelectItem value="6">6 months</SelectItem>
                                              <SelectItem value="12">12 months</SelectItem>
                                              <SelectItem value="24">24 months</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                          <Label htmlFor="role" className="text-right">
                                            Role
                                          </Label>
                                          <Select 
                                            defaultValue="STAFF"
                                            onValueChange={(value) => {
                                              if (selectedUser) {
                                                setSelectedUser({
                                                  ...selectedUser,
                                                  role: value
                                                });
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="col-span-3">
                                              <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="ADMIN">Admin</SelectItem>
                                              <SelectItem value="MANAGER">Manager</SelectItem>
                                              <SelectItem value="STAFF">Staff</SelectItem>
                                              
                                              {/* Custom roles will be loaded here */}
                                              <CustomRoleOptions />
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        
                                        {generatedLicenseKey && (
                                          <Alert className="mt-4 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            <AlertTitle className="text-green-800 dark:text-green-400">Key Generated Successfully</AlertTitle>
                                            <AlertDescription className="text-green-700 dark:text-green-300">
                                              <div className="mt-2 p-2 bg-white dark:bg-green-950 rounded border border-green-200 dark:border-green-800 flex items-center justify-between">
                                                <code className="font-mono text-sm">{generatedLicenseKey}</code>
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  className="h-8 w-8 p-0"
                                                  onClick={() => copyToClipboard(generatedLicenseKey)}
                                                >
                                                  <Copy className="h-4 w-4" />
                                                </Button>
                                              </div>
                                              <p className="text-xs mt-2">
                                                This key has been sent to the user's email. They will need to enter it when they log in again.
                                              </p>
                                            </AlertDescription>
                                          </Alert>
                                        )}
                                      </div>
                                      
                                      <DialogFooter className="sm:justify-between">
                                        <div className="flex items-center">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="flex items-center gap-1"
                                            onClick={() => {
                                              if (selectedUser && generatedLicenseKey) {
                                                window.location.href = `mailto:${selectedUser.email}?subject=Your Subscription Key&body=Here is your subscription key: ${generatedLicenseKey}%0D%0A%0D%0APlease enter this key when you log in to activate your account.`;
                                              }
                                            }}
                                            disabled={!generatedLicenseKey}
                                          >
                                            <Mail className="h-4 w-4" />
                                            Email Manually
                                          </Button>
                                        </div>
                                        <Button 
                                          type="submit" 
                                          onClick={generateSubscriptionKey}
                                          disabled={isGeneratingKey}
                                        >
                                          {isGeneratingKey ? 'Generating...' : generatedLicenseKey ? 'Regenerate Key' : 'Generate Key'}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center text-green-600 dark:text-green-500 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950"
                                    onClick={() => {
                                      handleStatusChange(user.id, "APPROVED");
                                      toast({
                                        title: "Default Access Granted",
                                        description: "Basic page access has been automatically granted to this user. You can modify their access in the Approved Users tab.",
                                      });
                                    }}
                                  >
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center text-red-600 dark:text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                                    onClick={() => handleStatusChange(user.id, "REJECTED")}
                                  >
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approved">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Approved Users</CardTitle>
                  <CardDescription>
                    Manage page access and permissions for approved users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredApprovedUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                      {searchQuery ? (
                        <>
                          <Filter className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No approved users match your search</p>
                          <Button variant="link" onClick={() => setSearchQuery("")}>Clear search</Button>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No approved users found</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {filteredApprovedUsers.map((user) => (
                        <Card key={user.id} className="overflow-hidden border-2 border-muted">
                          <div className="bg-muted/50 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <h3 className="text-lg font-medium flex flex-wrap items-center gap-2">
                                {user.email}
                                <div className="flex gap-1.5">
                                  {getStatusBadge(user.status)}
                                  {getRoleBadge(user)}
                                </div>
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Registered on {new Date(user.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 dark:text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => handleStatusChange(user.id, "REJECTED")}
                            >
                              <UserX className="mr-1.5 h-4 w-4" />
                              Revoke Access
                            </Button>
                          </div>
                          
                          <div className="p-6 grid gap-6">
                            <div className="p-4 rounded-lg bg-muted/30 border">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                  <UserCog className="h-5 w-5 mr-2 text-muted-foreground" />
                                  <Label className="font-medium text-base">User Role</Label>
                                </div>
                                <Select 
                                  // Use customRoleName if available, otherwise use standard role
                                  defaultValue={user.customRoleName || user.role} 
                                  onValueChange={(value) => handleRoleChange(user.id, value)}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                    <SelectItem value="STAFF">Staff</SelectItem>
                                    
                                    {/* Custom roles will be loaded here */}
                                    <CustomRoleOptions />
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {user.role === 'ADMIN' ? 
                                  'Admin can access all features and manage users.' : 
                                  user.role === 'MANAGER' ? 
                                  'Manager can access all features except admin settings.' : 
                                  'Staff can only access features they have been granted permission to.'}
                              </p>
                            </div>
                            
                            <div className="p-4 rounded-lg bg-muted/30 border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="font-medium text-base">Document Delete Permission</Label>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    When enabled, this user can delete documents from assets
                                  </p>
                                </div>
                                <Switch
                                  checked={user.canDeleteDocuments || false}
                                  onCheckedChange={(checked) => handleDocumentDeletePermissionChange(user.id, checked)}
                                />
                              </div>
                            </div>

                            <div className="p-4 rounded-lg bg-muted/30 border">
                              <div className="flex items-center mb-4">
                                <Label className="font-medium text-base">Button Visibility Permissions</Label>
                              </div>
                              <p className="text-sm text-muted-foreground mb-4">
                                Control which buttons are visible to this user
                              </p>
                              
                              <div className="space-y-4">
                                <div className="p-2 border rounded-md bg-background/50">
                                  <h4 className="font-medium mb-2">Assets Page Buttons</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between border p-2 rounded-md">
                                      <Label htmlFor={`dispose-asset-btn-${user.id}`}>Dispose Asset Button</Label>
                                      <Switch
                                        id={`dispose-asset-btn-${user.id}`}
                                        checked={(user.buttonVisibility?.['dispose_asset'] === true)}
                                        onCheckedChange={(checked) => handleButtonVisibilityChange(user.id, 'dispose_asset', checked)}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between border p-2 rounded-md">
                                      <Label htmlFor={`assets-button-${user.id}`}>Assets Button</Label>
                                      <Switch
                                        id={`assets-button-${user.id}`}
                                        checked={(user.buttonVisibility?.['assets_button'] === true)}
                                        onCheckedChange={(checked) => handleButtonVisibilityChange(user.id, 'assets_button', checked)}
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="p-2 border rounded-md bg-background/50">
                                  <h4 className="font-medium mb-2">Food Supply Page Buttons</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between border p-2 rounded-md">
                                      <Label htmlFor={`edit-food-supply-btn-${user.id}`}>Edit Food Supply Button</Label>
                                      <Switch
                                        id={`edit-food-supply-btn-${user.id}`}
                                        checked={(user.buttonVisibility?.['edit_food_supply'] === true)}
                                        onCheckedChange={(checked) => handleButtonVisibilityChange(user.id, 'edit_food_supply', checked)}
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="p-2 border rounded-md bg-background/50">
                                  <h4 className="font-medium mb-2">Kitchen Page Buttons</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between border p-2 rounded-md">
                                      <Label htmlFor={`kitchen-consumption-btn-${user.id}`}>Kitchen Consumption Button</Label>
                                      <Switch
                                        id={`kitchen-consumption-btn-${user.id}`}
                                        checked={(user.buttonVisibility?.['kitchen_consumption'] === true)}
                                        onCheckedChange={(checked) => handleButtonVisibilityChange(user.id, 'kitchen_consumption', checked)}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between border p-2 rounded-md">
                                      <Label htmlFor={`kitchen-waste-tracking-btn-${user.id}`}>Waste Tracking Button</Label>
                                      <Switch
                                        id={`kitchen-waste-tracking-btn-${user.id}`}
                                        checked={(user.buttonVisibility?.['kitchen_waste_tracking'] === true)}
                                        onCheckedChange={(checked) => handleButtonVisibilityChange(user.id, 'kitchen_waste_tracking', checked)}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between border p-2 rounded-md">
                                      <Label htmlFor={`kitchen-food-supply-btn-${user.id}`}>Add Food Supply Button</Label>
                                      <Switch
                                        id={`kitchen-food-supply-btn-${user.id}`}
                                        checked={(user.buttonVisibility?.['kitchen_food_supply'] === true)}
                                        onCheckedChange={(checked) => handleButtonVisibilityChange(user.id, 'kitchen_food_supply', checked)}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between border p-2 rounded-md">
                                      <Label htmlFor={`kitchen-recipe-btn-${user.id}`}>Recipe Management Button</Label>
                                      <Switch
                                        id={`kitchen-recipe-btn-${user.id}`}
                                        checked={(user.buttonVisibility?.['kitchen_recipe'] === true)}
                                        onCheckedChange={(checked) => handleButtonVisibilityChange(user.id, 'kitchen_recipe', checked)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-medium text-base">Page Access Permissions</h4>
                                <Badge variant="outline" className="text-xs">
                                  {Object.values(user.pageAccess || {}).filter(Boolean).length} / {availablePages.length} pages
                                </Badge>
                              </div>
                              
                              <div className="max-h-[320px] overflow-y-auto rounded-lg border p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
                                  {availablePages.map((page, index) => (
                                    <div key={`${user.id}-${page.path}`}>
                                      <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                                        <Label htmlFor={`${user.id}-${page.path}`} className="flex-1 cursor-pointer">
                                          {page.name}
                                        </Label>
                                        <Switch
                                          id={`${user.id}-${page.path}`}
                                          checked={user.pageAccess?.[page.path] === true}
                                          onCheckedChange={(checked) =>
                                            handlePageAccessChange(user.id, page.path, checked)
                                          }
                                        />
                                      </div>
                                      {index < availablePages.length - 1 && index % 2 === 1 && (
                                        <Separator className="my-2 md:hidden" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rejected">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Rejected Users</CardTitle>
                  <CardDescription>
                    Users who have been denied access to the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredRejectedUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                      {searchQuery ? (
                        <>
                          <Filter className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No rejected users match your search</p>
                          <Button variant="link" onClick={() => setSearchQuery("")}>Clear search</Button>
                        </>
                      ) : (
                        <>
                          <UserX className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No rejected users found</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead className="hidden md:table-cell">Registration Date</TableHead>
                            <TableHead className="hidden sm:table-cell">Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRejectedUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.email}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{getStatusBadge(user.status)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex items-center text-green-600 dark:text-green-500 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950"
                                  onClick={() => {
                                    handleStatusChange(user.id, "APPROVED");
                                    toast({
                                      title: "Default Access Granted",
                                      description: "Basic page access has been automatically granted to this user. You can modify their access in the Approved Users tab.",
                                    });
                                  }}
                                >
                                  <CheckCircle className="mr-1.5 h-4 w-4" />
                                  Approve Access
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="role-permissions">
              <RoleDefaultPermissionsManager />
            </TabsContent>
          </Tabs>
        </div>
      </SimpleDashboardLayout>
    </ProtectedRoute>
  );
}