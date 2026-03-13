import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserCog, Save, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isCustomRoleSelected, setIsCustomRoleSelected] = useState(false);
  const { toast } = useToast();

  // Load available pages and role permissions
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load available pages
        const pagesResponse = await fetch("/api/admin/pages");
        const pagesData = await pagesResponse.json();
        setAvailablePages(pagesData);

        // Load custom roles
        const customRolesResponse = await fetch("/api/admin/custom-roles");
        const customRolesData = await customRolesResponse.json();
        setCustomRoles(customRolesData);

        // Load role permissions
        const permissionsResponse = await fetch("/api/admin/role-permissions");
        const permissionsData = await permissionsResponse.json();

        // Convert to a map for easier access
        const permissionsMap: Record<string, RolePermission> = {};
        permissionsData.forEach((permission: RolePermission) => {
          // For standard roles, use the role name as key
          if (permission.role) {
            permissionsMap[permission.role] = permission;
          }
          // For custom roles, use 'custom_' + id as key
          else if (permission.customRoleId) {
            permissionsMap[`custom_${permission.customRoleId}`] = permission;
          }
        });

        setRolePermissions(permissionsMap);

        // Set initial permission based on selected role
        if (permissionsMap[selectedRole]) {
          setCurrentPermission({
            pageAccess: permissionsMap[selectedRole].pageAccess,
            canDeleteDocuments: permissionsMap[selectedRole].canDeleteDocuments,
            buttonVisibility: permissionsMap[selectedRole].buttonVisibility || {},
          });
          
          // Check if this is a custom role
          setIsCustomRoleSelected(selectedRole.startsWith('custom_'));
        } else {
          // Default empty permissions if none exist for the role
          setCurrentPermission({
            pageAccess: {},
            canDeleteDocuments: false,
            buttonVisibility: {},
          });
          setIsCustomRoleSelected(selectedRole.startsWith('custom_'));
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: "Error",
          description: "Failed to load role permissions data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Update current permission when role changes
  useEffect(() => {
    if (rolePermissions[selectedRole]) {
      setCurrentPermission({
        pageAccess: rolePermissions[selectedRole].pageAccess,
        canDeleteDocuments: rolePermissions[selectedRole].canDeleteDocuments,
        buttonVisibility: rolePermissions[selectedRole].buttonVisibility || {},
      });
    } else {
      // Default empty permissions if none exist for the role
      setCurrentPermission({
        pageAccess: {},
        canDeleteDocuments: false,
        buttonVisibility: {},
      });
    }
    
    // Check if this is a custom role
    setIsCustomRoleSelected(selectedRole.startsWith('custom_'));
  }, [selectedRole, rolePermissions]);

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
  };
  
  const handleAddCustomRole = async () => {
    if (!newRoleName.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch("/api/admin/custom-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create custom role");
      }
      
      const newRole = await response.json();
      
      // Add the new role to the list
      setCustomRoles((prev) => [...prev, newRole]);
      
      // Reset form
      setNewRoleName("");
      setNewRoleDescription("");
      setIsAddingRole(false);
      
      // Select the new role
      setSelectedRole(`custom_${newRole.id}`);
      
      toast({
        title: "Success",
        description: `Custom role "${newRole.name}" created successfully.`,
      });
    } catch (error) {
      console.error("Error creating custom role:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create custom role",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteCustomRole = async (roleId: string) => {
    try {
      const response = await fetch("/api/admin/custom-roles", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: roleId,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete custom role");
      }
      
      // Remove the role from the list
      setCustomRoles((prev) => prev.filter((role) => role.id !== roleId));
      
      // If the deleted role was selected, switch to STAFF
      if (selectedRole === `custom_${roleId}`) {
        setSelectedRole("STAFF");
      }
      
      // Remove from permissions map
      const updatedPermissions = { ...rolePermissions };
      delete updatedPermissions[`custom_${roleId}`];
      setRolePermissions(updatedPermissions);
      
      toast({
        title: "Success",
        description: "Custom role deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting custom role:", error);
      toast({
        title: "Error",
        description: "Failed to delete custom role",
        variant: "destructive",
      });
    }
  };

  const handlePageAccessChange = (pagePath: string, enabled: boolean) => {
    setCurrentPermission((prev) => ({
      ...prev,
      pageAccess: {
        ...prev.pageAccess,
        [pagePath]: enabled,
      },
    }));
  };

  const handleDocumentDeletePermissionChange = (enabled: boolean) => {
    setCurrentPermission((prev) => ({
      ...prev,
      canDeleteDocuments: enabled,
    }));
  };
  
  const handleButtonVisibilityChange = (buttonId: string, enabled: boolean) => {
    setCurrentPermission((prev) => ({
      ...prev,
      buttonVisibility: {
        ...prev.buttonVisibility,
        [buttonId]: enabled,
      },
    }));
  };

  const handleSelectAll = (enabled: boolean) => {
    const newPageAccess: Record<string, boolean> = {};
    availablePages.forEach((page) => {
      newPageAccess[page.path] = enabled;
    });

    setCurrentPermission((prev) => ({
      ...prev,
      pageAccess: newPageAccess,
    }));
  };

  const saveRolePermissions = async () => {
    try {
      // Determine if we're saving for a standard role or custom role
      const isCustomRole = selectedRole.startsWith('custom_');
      let requestBody: any = {
        pageAccess: currentPermission.pageAccess,
        canDeleteDocuments: currentPermission.canDeleteDocuments,
        buttonVisibility: currentPermission.buttonVisibility,
      };
      
      if (isCustomRole) {
        // For custom roles, extract the ID from the selectedRole string
        const customRoleId = selectedRole.replace('custom_', '');
        requestBody.customRoleId = customRoleId;
      } else {
        // For standard roles, use the role name
        requestBody.role = selectedRole;
      }
      
      const response = await fetch("/api/admin/role-permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to save role permissions");
      }

      const savedPermission = await response.json();

      // Update local state
      setRolePermissions((prev) => ({
        ...prev,
        [selectedRole]: savedPermission,
      }));

      toast({
        title: "Success",
        description: isCustomRole
          ? `Default permissions for custom role saved successfully.`
          : `Default permissions for ${selectedRole} role saved successfully.`,
      });
    } catch (error) {
      console.error("Error saving role permissions:", error);
      toast({
        title: "Error",
        description: "Failed to save role permissions",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge variant="secondary">Admin</Badge>;
      case "MANAGER":
        return <Badge variant="outline">Manager</Badge>;
      case "STAFF":
        return <Badge>Staff</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Default Permissions</CardTitle>
        <CardDescription>
          Configure default page access permissions for each user role
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-3 border rounded-md bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <UserCog className="h-5 w-5 mr-2 text-slate-500" />
                  <Label className="font-medium">Select Role to Configure</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Select
                    value={selectedRole}
                    onValueChange={handleRoleChange}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                      
                      {customRoles.length > 0 && (
                        <>
                          <div className="py-2">
                            <div className="px-2 text-xs font-medium">Custom Roles</div>
                          </div>
                          {customRoles.map((role) => (
                            <SelectItem key={role.id} value={`custom_${role.id}`}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  
                  <Dialog open={isAddingRole} onOpenChange={setIsAddingRole}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Add Role
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Role</DialogTitle>
                        <DialogDescription>
                          Add a new custom role to the system. You'll be able to configure its permissions after creation.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="role-name">Role Name</Label>
                          <Input
                            id="role-name"
                            placeholder="Enter role name"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role-description">Description (Optional)</Label>
                          <Textarea
                            id="role-description"
                            placeholder="Enter role description"
                            value={newRoleDescription}
                            onChange={(e) => setNewRoleDescription(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingRole(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddCustomRole}>
                          Create Role
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              {isCustomRoleSelected ? (
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-slate-500">
                    {customRoles.find(r => `custom_${r.id}` === selectedRole)?.description || 
                    "Custom role with configurable permissions."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => {
                      const customRoleId = selectedRole.replace('custom_', '');
                      handleDeleteCustomRole(customRoleId);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete Role
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-slate-500 mt-2">
                  {selectedRole === "ADMIN"
                    ? "Admin can access all features and manage users."
                    : selectedRole === "MANAGER"
                    ? "Manager can access all features except admin settings."
                    : "Staff can only access features they have been granted permission to."}
                </p>
              )}
              
              <div className="mt-4 flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium">Current Role: </span>
                  {isCustomRoleSelected ? (
                    <Badge variant="default" className="bg-purple-500">
                      {customRoles.find(r => `custom_${r.id}` === selectedRole)?.name || "Custom Role"}
                    </Badge>
                  ) : (
                    getRoleBadge(selectedRole)
                  )}
                </div>
                <div className="space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectAll(true)}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectAll(false)}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            </div>

            <div className="mb-4 p-3 border rounded-md bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Document Delete Permission</Label>
                  <p className="text-sm text-slate-500 mt-1">
                    When enabled, users with this role can delete documents from assets
                  </p>
                </div>
                <Switch
                  checked={currentPermission.canDeleteDocuments}
                  onCheckedChange={handleDocumentDeletePermissionChange}
                />
              </div>
            </div>
            
            <div className="mb-4 p-3 border rounded-md bg-slate-50 dark:bg-slate-900">
              <div>
                <Label className="font-medium">Button Visibility Permissions</Label>
                <p className="text-sm text-slate-500 mt-1 mb-4">
                  Control which buttons are visible to users with this role
                </p>
                
                <div className="space-y-4">
                  <div className="p-2 border rounded-md">
                    <h4 className="font-medium mb-2">Assets Page Buttons</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between border p-2 rounded-md">
                        <Label htmlFor="dispose-asset-btn">Dispose Asset Button</Label>
                        <Switch
                          id="dispose-asset-btn"
                          checked={currentPermission.buttonVisibility?.['dispose_asset'] === true}
                          onCheckedChange={(checked) => handleButtonVisibilityChange('dispose_asset', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between border p-2 rounded-md">
                        <Label htmlFor="assets-button">Assets Button</Label>
                        <Switch
                          id="assets-button"
                          checked={currentPermission.buttonVisibility?.['assets_button'] === true}
                          onCheckedChange={(checked) => handleButtonVisibilityChange('assets_button', checked)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-2 border rounded-md">
                    <h4 className="font-medium mb-2">Food Supply Page Buttons</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between border p-2 rounded-md">
                        <Label htmlFor="edit-food-supply-btn">Edit Food Supply Button</Label>
                        <Switch
                          id="edit-food-supply-btn"
                          checked={currentPermission.buttonVisibility?.['edit_food_supply'] === true}
                          onCheckedChange={(checked) => handleButtonVisibilityChange('edit_food_supply', checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePages.map((page) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between border p-3 rounded-md"
                >
                  <Label htmlFor={`${selectedRole}-${page.path}`} className="flex-1">
                    {page.name}
                  </Label>
                  <Switch
                    id={`${selectedRole}-${page.path}`}
                    checked={currentPermission.pageAccess?.[page.path] === true}
                    onCheckedChange={(checked) =>
                      handlePageAccessChange(page.path, checked)
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={saveRolePermissions}
                className="flex items-center"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Default Permissions
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}