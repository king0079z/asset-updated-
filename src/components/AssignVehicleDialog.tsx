import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Car, User, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatUserId } from "@/util/user";

interface Vehicle {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
  [key: string]: any;
}

interface User {
  id: string;
  email: string;
}

interface AssignVehicleDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export function AssignVehicleDialog({ vehicle, open, onOpenChange, onAssigned }: AssignVehicleDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch users when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers();
      
      // Set default end date to 30 days from now
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      setEndDate(thirtyDaysFromNow.toISOString().split('T')[0]);
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/planner/users');
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!vehicle || !selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user to assign the vehicle to",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/vehicles/${vehicle.id}/assign-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: selectedUserId,
          endDate: endDate || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to assign vehicle');
      }

      // Show appropriate toast based on whether previous rentals were cancelled
      if (data.previousRentalsCancelled > 0) {
        toast({
          title: "Vehicle Assigned",
          description: data.message,
          variant: "default",
          duration: 5000, // Show for longer since it's important information
        });
      } else {
        toast({
          title: "Vehicle Assigned",
          description: "Vehicle has been assigned successfully",
        });
      }

      onOpenChange(false);
      onAssigned();
    } catch (error) {
      console.error('Error assigning vehicle:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign vehicle",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Vehicle to User</DialogTitle>
          <DialogDescription>
            Assign {vehicle.name} to a staff member
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
            <Car className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <div>
              <p className="font-medium">{vehicle.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{vehicle.make} {vehicle.model} ({vehicle.year})</p>
            </div>
            <Badge className="ml-auto" variant={vehicle.status === 'AVAILABLE' ? 'default' : 'outline'}>
              {vehicle.status}
            </Badge>
          </div>

          {vehicle.status !== 'AVAILABLE' && vehicle.status !== 'RENTED' && (
            <Alert variant="destructive">
              <AlertDescription>
                This vehicle is currently {vehicle.status.toLowerCase()}. It should be marked as AVAILABLE before assigning.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="user">Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading users...
                  </div>
                ) : !users || users.length === 0 ? (
                  <div className="p-2 text-center text-sm text-slate-500">No users found</div>
                ) : (
                  users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{user.email}</span>
                        <Badge variant="outline" className="ml-1 text-xs">
                          {formatUserId(user.id)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Rental End Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-slate-500">
              The vehicle will be assigned until this date. Default is 30 days from now.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedUserId || (vehicle.status !== 'AVAILABLE' && vehicle.status !== 'RENTED')}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign Vehicle'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}