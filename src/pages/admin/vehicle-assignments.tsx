import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AssignVehicleDialog } from "@/components/AssignVehicleDialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, User, Search, Filter, Loader2, CheckCircle2, AlertCircle, Wrench, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { formatUserId } from "@/util/user";
import { useTranslation } from "@/contexts/TranslationContext";

interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: number;
  plateNumber: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
  type: 'CAR' | 'TRUCK' | 'VAN' | 'BUS' | 'MOTORCYCLE';
  color?: string;
  mileage?: number;
  rentalAmount: number;
  imageUrl?: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

interface VehicleAssignment {
  id: string;
  vehicle: Vehicle;
  user: User;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

const getVehicleIcon = (type: string) => {
  switch (type) {
    case 'CAR':
      return <Car className="h-5 w-5" />;
    case 'TRUCK':
      return <Car className="h-5 w-5" />;
    case 'VAN':
      return <Car className="h-5 w-5" />;
    case 'BUS':
      return <Car className="h-5 w-5" />;
    case 'MOTORCYCLE':
      return <Car className="h-5 w-5" />;
    default:
      return <Car className="h-5 w-5" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'RENTED':
      return <AlertCircle className="h-4 w-4 text-blue-500" />;
    case 'MAINTENANCE':
      return <Wrench className="h-4 w-4 text-yellow-500" />;
    case 'RETIRED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'RENTED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'MAINTENANCE':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'RETIRED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};

export default function VehicleAssignmentsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterVehicles();
  }, [searchTerm, statusFilter, vehicles]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch vehicles
      const vehiclesResponse = await fetch('/api/vehicles');
      const vehiclesData = await vehiclesResponse.json();
      
      // Fetch users
      const usersResponse = await fetch('/api/planner/users');
      const usersData = await usersResponse.json();
      
      // Fetch active rentals
      const rentalsResponse = await fetch('/api/vehicles/rentals');
      let rentalsData = { rentals: [] };
      
      try {
        rentalsData = await rentalsResponse.json();
      } catch (error) {
        console.error('Error parsing rentals response:', error);
      }
      
      if (vehiclesResponse.ok) {
        setVehicles(vehiclesData.vehicles);
        setFilteredVehicles(vehiclesData.vehicles);
      }
      
      if (usersResponse.ok) {
        setUsers(usersData.users);
      }
      
      if (rentalsResponse.ok && rentalsData.rentals) {
        // Map rentals to assignments
        const mappedAssignments = rentalsData.rentals.map((rental: any) => ({
          id: rental.id,
          vehicle: vehiclesData.vehicles.find((v: Vehicle) => v.id === rental.vehicleId) || {},
          user: usersData.users.find((u: User) => u.id === rental.userId) || {},
          startDate: rental.startDate,
          endDate: rental.endDate,
          status: rental.status
        }));
        
        setAssignments(mappedAssignments);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterVehicles = () => {
    let filtered = vehicles;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (vehicle) =>
          vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehicle.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((vehicle) => vehicle.status === statusFilter);
    }
    
    setFilteredVehicles(filtered);
  };

  const handleAssignVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsAssignDialogOpen(true);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('vehicle_assignments')}</h1>
              <p className="text-muted-foreground">
                {t('assign_vehicles_to_staff_members')}
              </p>
            </div>
            <Button 
              onClick={fetchData} 
              variant="outline"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('refresh')}
            </Button>
          </div>

          <Tabs defaultValue="vehicles">
            <TabsList className="mb-4">
              <TabsTrigger value="vehicles">{t('available_vehicles')}</TabsTrigger>
              <TabsTrigger value="assignments">{t('current_assignments')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="vehicles">
              <Card>
                <CardHeader>
                  <CardTitle>{t('vehicles_available_for_assignment')}</CardTitle>
                  <CardDescription>
                    {t('select_vehicle_to_assign')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('search_by_name_plate_model')}
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder={t('filter_by_status')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">{t('all_statuses')}</SelectItem>
                        <SelectItem value="AVAILABLE">{t('available')}</SelectItem>
                        <SelectItem value="RENTED">{t('rented')}</SelectItem>
                        <SelectItem value="MAINTENANCE">{t('in_maintenance')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredVehicles.length === 0 ? (
                    <div className="text-center py-12">
                      <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">{t('no_vehicles_found')}</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm 
                          ? t('try_adjusting_search_terms')
                          : t('no_vehicles_available_for_assignment')}
                      </p>
                    </div>
                  ) : (
                    <div className="relative overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('vehicle')}</TableHead>
                            <TableHead>{t('type')}</TableHead>
                            <TableHead>{t('plate_number')}</TableHead>
                            <TableHead>{t('status')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredVehicles.map((vehicle) => (
                            <TableRow key={vehicle.id} className="group hover:bg-muted/50">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {vehicle.imageUrl ? (
                                    <img
                                      src={vehicle.imageUrl}
                                      alt={vehicle.name}
                                      className="w-10 h-10 rounded-full object-cover ring-2 ring-background"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                      {getVehicleIcon(vehicle.type)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium">{vehicle.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {vehicle.model} ({vehicle.year})
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getVehicleIcon(vehicle.type)}
                                  <span className="text-sm">{t(vehicle.type.toLowerCase())}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="rounded bg-muted px-2 py-1 text-sm">
                                  {vehicle.plateNumber}
                                </code>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={`${getStatusColor(vehicle.status)}`}>
                                  <span className="flex items-center gap-1">
                                    {getStatusIcon(vehicle.status)}
                                    {t(vehicle.status.toLowerCase())}
                                  </span>
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAssignVehicle(vehicle)}
                                  className={vehicle.status === 'AVAILABLE' ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : ""}
                                  disabled={vehicle.status !== 'AVAILABLE' && vehicle.status !== 'RENTED'}
                                >
                                  {vehicle.status === 'RENTED' ? t('reassign') : t('assign_to_user')}
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
            
            <TabsContent value="assignments">
              <Card>
                <CardHeader>
                  <CardTitle>{t('current_assignments')}</CardTitle>
                  <CardDescription>
                    {t('view_and_manage_active_vehicle_assignments')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="text-center py-12">
                      <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">{t('no_active_assignments')}</h3>
                      <p className="text-muted-foreground mb-4">
                        {t('no_vehicles_assigned_to_users')}
                      </p>
                    </div>
                  ) : (
                    <div className="relative overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('user')}</TableHead>
                            <TableHead>{t('vehicle')}</TableHead>
                            <TableHead>{t('start_date')}</TableHead>
                            <TableHead>{t('end_date')}</TableHead>
                            <TableHead>{t('status')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignments.map((assignment) => (
                            <TableRow key={assignment.id} className="group hover:bg-muted/50">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">{assignment.user.name || 'N/A'}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {assignment.user.email || t('unknown_user')}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getVehicleIcon(assignment.vehicle?.type || 'CAR')}
                                  <div>
                                    <div className="font-medium">{assignment.vehicle?.name || 'N/A'}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {assignment.vehicle?.model} ({assignment.vehicle?.year})
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {new Date(assignment.startDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {new Date(assignment.endDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={`${getStatusColor(assignment.status)}`}>
                                  {t(assignment.status.toLowerCase())}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {assignment.status === 'ACTIVE' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAssignVehicle(assignment.vehicle)}
                                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                    >
                                      {t('reassign')}
                                    </Button>
                                  )}
                                  <Link href={`/vehicles/${assignment.vehicle?.id}`}>
                                    <Button variant="outline" size="sm">
                                      {t('view_vehicle')}
                                    </Button>
                                  </Link>
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
          </Tabs>
        </div>

        <AssignVehicleDialog
          vehicle={selectedVehicle}
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          onAssigned={fetchData}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}