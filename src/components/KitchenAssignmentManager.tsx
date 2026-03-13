import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from "@/contexts/TranslationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

interface User {
  id: string;
  email: string;
}

interface Kitchen {
  id: string;
  name: string;
  floorNumber: string;
}

interface KitchenAssignment {
  id: string;
  userId: string;
  kitchenId: string;
  assignedById: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
  kitchen: {
    id: string;
    name: string;
    floorNumber: string;
  };
}

export function KitchenAssignmentManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [assignments, setAssignments] = useState<KitchenAssignment[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedKitchen, setSelectedKitchen] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const fetchUsers = async () => {
    const data = await fetchWithErrorHandling('/api/admin/users', {}, []);
    if (data) {
      // Filter only approved users
      const approvedUsers = data.filter((user: any) => user.status === 'APPROVED');
      setUsers(approvedUsers);
    } else {
      toast({
        title: t('error'),
        description: t('failed_to_fetch_users'),
        variant: 'destructive',
      });
    }
  };

  const fetchKitchens = async () => {
    const data = await fetchWithErrorHandling('/api/kitchens', {}, []);
    if (data) {
      setKitchens(data);
    } else {
      toast({
        title: t('error'),
        description: t('failed_to_fetch_kitchens'),
        variant: 'destructive',
      });
    }
  };

  const fetchAssignments = async () => {
    const data = await fetchWithErrorHandling('/api/kitchens/assignments', {}, []);
    if (data) {
      setAssignments(data);
    } else {
      toast({
        title: t('error'),
        description: t('failed_to_fetch_kitchen_assignments'),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchKitchens();
    fetchAssignments();
  }, []);

  const handleSubmit = async () => {
    if (!selectedUser || !selectedKitchen) {
      toast({
        title: t('error'),
        description: t('please_select_user_and_kitchen'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser,
          kitchenId: selectedKitchen,
        }),
      };
      
      const data = await fetchWithErrorHandling('/api/kitchens/assignments', options, null);
      
      if (data) {
        toast({
          title: t('success'),
          description: t('kitchen_assignment_created_successfully'),
        });
        setIsOpen(false);
        setSelectedUser('');
        setSelectedKitchen('');
        fetchAssignments();
      } else {
        toast({
          title: t('error'),
          description: t('failed_to_create_kitchen_assignment'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating kitchen assignment:', error);
      toast({
        title: t('error'),
        description: t('failed_to_create_kitchen_assignment'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm(t('confirm_delete_kitchen_assignment'))) {
      return;
    }

    const options = {
      method: 'DELETE',
    };
    
    const data = await fetchWithErrorHandling(`/api/kitchens/assignments?id=${assignmentId}`, options, null);
    
    if (data) {
      toast({
        title: t('success'),
        description: t('kitchen_assignment_deleted_successfully'),
      });
      fetchAssignments();
    } else {
      toast({
        title: t('error'),
        description: t('failed_to_delete_kitchen_assignment'),
        variant: 'destructive',
      });
    }
  };

  // Group assignments by user
  const assignmentsByUser: Record<string, KitchenAssignment[]> = {};
  assignments.forEach(assignment => {
    if (!assignmentsByUser[assignment.userId]) {
      assignmentsByUser[assignment.userId] = [];
    }
    assignmentsByUser[assignment.userId].push(assignment);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('kitchen_assignment_management')}</h2>
          <p className="text-muted-foreground mt-2">
            {t('manage_user_kitchen_assignments')}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <UserPlus className="h-5 w-5 mr-2" />
              {t('assign_kitchen')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('assign_kitchen_to_user')}</DialogTitle>
              <DialogDescription>
                {t('select_user_and_kitchen_to_create_assignment')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user">{t('select_user')}</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger id="user">
                    <SelectValue placeholder={t('select_user')} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kitchen">{t('select_kitchen')}</Label>
                <Select value={selectedKitchen} onValueChange={setSelectedKitchen}>
                  <SelectTrigger id="kitchen">
                    <SelectValue placeholder={t('select_kitchen')} />
                  </SelectTrigger>
                  <SelectContent>
                    {kitchens.map((kitchen) => (
                      <SelectItem key={kitchen.id} value={kitchen.id}>
                        {kitchen.name} (Floor {kitchen.floorNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : null}
                {t('create_assignment')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      <div className="space-y-6">
        {Object.keys(assignmentsByUser).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {t('no_kitchen_assignments_found')}
              </p>
              <Button className="mt-4" onClick={() => setIsOpen(true)}>
                <UserPlus className="h-5 w-5 mr-2" />
                {t('create_first_assignment')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          Object.entries(assignmentsByUser).map(([userId, userAssignments]) => {
            const userEmail = userAssignments[0]?.user?.email || 'Unknown User';
            
            return (
              <Card key={userId} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{userEmail}</CardTitle>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                      {userAssignments.length} {t('assigned_kitchens')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {userAssignments.map((assignment) => (
                      <div 
                        key={assignment.id} 
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium">{assignment.kitchen.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Floor {assignment.kitchen.floorNumber} • {t('assigned_on')} {format(new Date(assignment.createdAt), 'PPP')}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-100"
                          onClick={() => handleDelete(assignment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}