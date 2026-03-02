// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { RegisterVehicleDialog } from "@/components/RegisterVehicleDialog";
import { VehicleDetailsDialog } from "@/components/VehicleDetailsDialog";
import { EditVehicleStatusDialog } from "@/components/EditVehicleStatusDialog";
import { AssignVehicleDialog } from "@/components/AssignVehicleDialog";
import { VehicleMobileCard } from "@/components/VehicleMobileCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Car,
  PlusCircle,
  Truck,
  Bus,
  Bike,
  AlertCircle,
  CheckCircle2,
  Wrench,
  XCircle,
  Search,
  Filter,
  Loader2,
  User,
  Calendar,
  Menu,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";

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
  location?: string;
  lastMaintenance?: string;
}

interface DashboardStats {
  total: number;
  available: number;
  monthlyTotal: number;
  yearlyTotal: number;
}

const getVehicleIcon = (type: string) => {
  switch (type) {
    case 'CAR':
      return <Car className="h-5 w-5" />;
    case 'TRUCK':
      return <Truck className="h-5 w-5" />;
    case 'VAN':
      return <Car className="h-5 w-5" />;
    case 'BUS':
      return <Bus className="h-5 w-5" />;
    case 'MOTORCYCLE':
      return <Bike className="h-5 w-5" />;
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
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    available: 0,
    monthlyTotal: 0,
    yearlyTotal: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicles();
  }, []);

  // Composed search + status filter — both apply together
  useEffect(() => {
    let result = vehicles;
    if (activeFilter !== 'ALL') {
      result = result.filter(v => v.status === activeFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.plateNumber.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        (v.color || '').toLowerCase().includes(q)
      );
    }
    setFilteredVehicles(result);
  }, [searchTerm, activeFilter, vehicles]);

  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      
      // Fetch vehicles with better error handling
      let vehiclesData;
      let costsData;
      
      try {
        const vehiclesResponse = await fetch('/api/vehicles');
        if (!vehiclesResponse.ok) {
          const errorData = await vehiclesResponse.json().catch(() => ({}));
          console.error('Vehicles API error:', errorData);
          throw new Error(`Failed to fetch vehicles: ${vehiclesResponse.status} ${vehiclesResponse.statusText}`);
        }
        vehiclesData = await vehiclesResponse.json();
      } catch (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError);
        toast({
          title: "Error",
          description: vehiclesError instanceof Error ? vehiclesError.message : "Failed to load vehicles",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Fetch rental costs with better error handling
      try {
        const costsResponse = await fetch('/api/vehicles/rental-costs');
        if (!costsResponse.ok) {
          const errorData = await costsResponse.json().catch(() => ({}));
          console.error('Rental costs API error:', errorData);
          throw new Error(`Failed to fetch rental costs: ${costsResponse.status} ${costsResponse.statusText}`);
        }
        costsData = await costsResponse.json();
      } catch (costsError) {
        console.error('Error fetching rental costs:', costsError);
        toast({
          title: "Warning",
          description: "Vehicle data loaded, but rental costs could not be retrieved",
          variant: "default",
        });
        // Continue with just the vehicles data
        costsData = { monthlyTotal: 0, yearlyTotal: 0 };
      }
      
      // Update state with fetched data
      setVehicles(vehiclesData.vehicles);
      setFilteredVehicles(vehiclesData.vehicles);
      calculateStats(vehiclesData.vehicles, costsData);
      
    } catch (error) {
      console.error('Unexpected error in fetchVehicles:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading vehicle data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (vehicleData: Vehicle[], costsData: { monthlyTotal: number; yearlyTotal: number; isPotentialExpense?: boolean; isPotentialRevenue?: boolean }) => {
    const newStats = {
      total: vehicleData.length,
      available: vehicleData.filter(v => v.status === 'AVAILABLE').length,
      monthlyTotal: costsData.monthlyTotal || 0,
      yearlyTotal: costsData.yearlyTotal || 0,
      isPotentialExpense: costsData.isPotentialExpense || costsData.isPotentialRevenue || false
    };
    setStats(newStats);
  };

  const handleViewDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsDetailsOpen(true);
  };

  const filterByStatus = (status: string) => {
    setActiveFilter(status);
    // The useEffect above will re-run and apply both search + status filter
  };

  const statsCards = [
    { title: 'Total Vehicles', value: stats.total, color: 'bg-gray-100 dark:bg-gray-800', icon: <Car className="h-5 w-5 text-gray-600 dark:text-gray-300" />, description: 'All registered vehicles' },
    { title: 'Available Vehicles', value: stats.available, color: 'bg-green-100 dark:bg-green-900', icon: <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-300" />, description: 'Ready for rental' },
    { 
      title: 'Monthly Rental Cost', 
      value: `QAR ${stats.monthlyTotal?.toLocaleString() || 0}`, 
      color: 'bg-blue-100 dark:bg-blue-900', 
      icon: <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-300" />, 
      description: 'Total monthly rental expense for all vehicles'
    },
    { 
      title: 'Yearly Rental Cost', 
      value: `QAR ${stats.yearlyTotal?.toLocaleString() || 0}`, 
      color: 'bg-purple-100 dark:bg-purple-900', 
      icon: <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-300" />, 
      description: 'Total yearly rental expense (monthly × 12)'
    },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vehicle Rentals Management</h1>
            <p className="text-muted-foreground">Manage and track your vehicle fleet efficiently</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link href="/vehicles/rentals" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                <Calendar className="h-4 w-4 mr-2" />
                <span className="sm:inline">View Active Rentals</span>
              </Button>
            </Link>
            <div className="w-full sm:w-auto">
              <RegisterVehicleDialog />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </CardContent>
              </Card>
            ))
          ) : (
            statsCards.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`${stat.color} transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        {stat.badge && (
                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                            {stat.badge}
                          </Badge>
                        )}
                      </div>
                      {stat.icon}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    <CardDescription>{stat.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vehicles List</CardTitle>
                <CardDescription>
                  Showing {filteredVehicles.length} of {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
                  {activeFilter !== 'ALL' ? ` · ${activeFilter}` : ''}
                  {searchTerm ? ` · "${searchTerm}"` : ''}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchVehicles} disabled={isLoading}>
                <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : 'opacity-0'}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, plate number, or model..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">
                    <Filter className="h-4 w-4 mr-2" />
                    {activeFilter === 'ALL' ? 'All Vehicles' : activeFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => filterByStatus('ALL')}
                    className={activeFilter === 'ALL' ? 'bg-muted' : ''}
                  >
                    All Vehicles
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => filterByStatus('AVAILABLE')}
                    className={activeFilter === 'AVAILABLE' ? 'bg-muted' : ''}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    Available
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => filterByStatus('RENTED')}
                    className={activeFilter === 'RENTED' ? 'bg-muted' : ''}
                  >
                    <AlertCircle className="h-4 w-4 mr-2 text-blue-500" />
                    Rented
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => filterByStatus('MAINTENANCE')}
                    className={activeFilter === 'MAINTENANCE' ? 'bg-muted' : ''}
                  >
                    <Wrench className="h-4 w-4 mr-2 text-yellow-500" />
                    In Maintenance
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => filterByStatus('RETIRED')}
                    className={activeFilter === 'RETIRED' ? 'bg-muted' : ''}
                  >
                    <XCircle className="h-4 w-4 mr-2 text-red-500" />
                    Retired
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                <h3 className="text-lg font-medium mb-2">No vehicles found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm 
                    ? "Try adjusting your search terms or filters"
                    : "Start by adding your first vehicle to the fleet"}
                </p>
                <RegisterVehicleDialog />
              </div>
            ) : (
              <>
                {/* Mobile View - Card Layout */}
                <div className="md:hidden space-y-4">
                  <AnimatePresence>
                    {filteredVehicles.map((vehicle, index) => (
                      <motion.div
                        key={vehicle.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <VehicleMobileCard
                          vehicle={vehicle}
                          onViewDetails={handleViewDetails}
                          onEditStatus={() => {
                            setSelectedVehicle(vehicle);
                            setIsEditStatusOpen(true);
                          }}
                          onAssignUser={() => {
                            setSelectedVehicle(vehicle);
                            setIsAssignDialogOpen(true);
                          }}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Desktop View - Table Layout */}
                <div className="hidden md:block relative overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Plate Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Monthly Rental</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredVehicles.map((vehicle, index) => (
                          <motion.tr
                            key={vehicle.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.05 }}
                            className="group hover:bg-muted/50"
                          >
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
                                <span className="text-sm">{vehicle.type}</span>
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
                                  {vehicle.status}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                QAR {vehicle.rentalAmount.toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(vehicle)}
                                  className="flex items-center"
                                >
                                  View Details
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedVehicle(vehicle);
                                    setIsEditStatusOpen(true);
                                  }}
                                  className={vehicle.status === 'RENTED' ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400" : ""}
                                >
                                  {vehicle.status === 'RENTED' ? "Edit Rental" : "Edit Status"}
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedVehicle(vehicle);
                                    setIsAssignDialogOpen(true);
                                  }}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <User className="h-4 w-4 mr-2" />
                                  Assign to User
                                </Button>
                                <Link href={`/vehicles/${vehicle.id}`}>
                                  <Button variant="outline" size="sm">
                                    Manage
                                  </Button>
                                </Link>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <VehicleDetailsDialog
        vehicle={selectedVehicle}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
      
      <EditVehicleStatusDialog
        vehicle={selectedVehicle}
        open={isEditStatusOpen}
        onOpenChange={setIsEditStatusOpen}
        onStatusUpdated={fetchVehicles}
      />
      
      <AssignVehicleDialog
        vehicle={selectedVehicle}
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        onAssigned={fetchVehicles}
      />
    </DashboardLayout>
  );
}