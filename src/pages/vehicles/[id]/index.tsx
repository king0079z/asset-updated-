import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Car, Truck, Bus, Bike, AlertCircle, CheckCircle2, Wrench, XCircle, Clock, Calendar, FileText } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Barcode from "react-barcode";
import PrintBarcodeButton from "@/components/PrintBarcodeButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

const getVehicleIcon = (type: string) => {
  switch (type) {
    case 'CAR':
      return <Car className="h-6 w-6" />;
    case 'TRUCK':
      return <Truck className="h-6 w-6" />;
    case 'VAN':
      return <Car className="h-6 w-6" />;
    case 'BUS':
      return <Bus className="h-6 w-6" />;
    case 'MOTORCYCLE':
      return <Bike className="h-6 w-6" />;
    default:
      return <Car className="h-6 w-6" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'RENTED':
      return <AlertCircle className="h-5 w-5 text-blue-500" />;
    case 'MAINTENANCE':
      return <Wrench className="h-5 w-5 text-yellow-500" />;
    case 'RETIRED':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-100 text-green-800';
    case 'RENTED':
      return 'bg-blue-100 text-blue-800';
    case 'MAINTENANCE':
      return 'bg-yellow-100 text-yellow-800';
    case 'RETIRED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

interface RentalHistory {
  id: string;
  displayId?: string;
  startDate: string;
  endDate: string;
  status: string;
  vehicleId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
}

interface MaintenanceHistory {
  id: string;
  maintenanceType: string;
  description: string;
  maintenanceDate: string;
  cost: number;
  mileage?: number;
  vendor?: { id: string; name: string } | null;
  user?: { id: string; email: string } | null;
  receiptUrl?: string | null;
  createdAt: string;
  nextDueDate?: string | null;
  aiRecommendation?: string | null;
}

export default function VehicleDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [rentalHistory, setRentalHistory] = useState<RentalHistory[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchVehicleDetails();
      fetchRentalHistory();
      fetchMaintenanceHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchRentalHistory = async () => {
    try {
      const response = await fetch(`/api/vehicles/${id}/rental-history`);
      const data = await response.json();
      if (response.ok) {
        setRentalHistory(data.rentalHistory);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load rental history",
        variant: "destructive",
      });
    }
  };

  const fetchVehicleDetails = async () => {
    try {
      const response = await fetch(`/api/vehicles/${id}`);
      const data = await response.json();
      if (response.ok) {
        setVehicle(data.vehicle);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load vehicle details",
        variant: "destructive",
      });
    }
  };

  const fetchMaintenanceHistory = async () => {
    setLoadingMaintenance(true);
    try {
      const response = await fetch(`/api/vehicles/${id}/maintenance-history`);
      const data = await response.json();
      if (response.ok) {
        setMaintenanceHistory(data.maintenanceHistory);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load maintenance history",
        variant: "destructive",
      });
    } finally {
      setLoadingMaintenance(false);
    }
  };

  // Simple AI/Heuristic for vehicle health
  const getVehicleHealth = () => {
    if (!maintenanceHistory.length) return { score: 100, status: "Excellent", message: "No maintenance issues detected." };
    // Lower score for more frequent or expensive maintenance
    const now = new Date();
    const lastYearMaintenances = maintenanceHistory.filter(m => {
      const date = new Date(m.maintenanceDate);
      return now.getFullYear() === date.getFullYear();
    });
    const totalCost = lastYearMaintenances.reduce((sum, m) => sum + (m.cost || 0), 0);
    const count = lastYearMaintenances.length;
    let score = 100;
    let status = "Excellent";
    let message = "Vehicle is in excellent health.";
    if (count > 6 || totalCost > 5000) {
      score = 50;
      status = "Needs Attention";
      message = "Frequent or high-cost maintenance detected. Consider detailed inspection or replacement.";
    } else if (count > 3 || totalCost > 2000) {
      score = 75;
      status = "Good";
      message = "Moderate maintenance activity. Monitor vehicle health.";
    }
    return { score, status, message, count, totalCost };
  };

  if (!vehicle) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold">Loading vehicle details...</h2>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const vehicleHealth = getVehicleHealth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Vehicle Details</h1>
        </div>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-2 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignment">Assignment History</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
            <TabsTrigger value="health">Vehicle Health</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {vehicle.imageUrl ? (
                      <img
                        src={vehicle.imageUrl}
                        alt={vehicle.name}
                        className="w-32 h-32 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center">
                        {getVehicleIcon(vehicle.type)}
                      </div>
                    )}
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold">{vehicle.name}</h2>
                      <p className="text-muted-foreground">
                        {vehicle.model} ({vehicle.year})
                      </p>
                      <Badge variant="secondary" className={getStatusColor(vehicle.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(vehicle.status)}
                          {vehicle.status}
                        </span>
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium flex items-center gap-2">
                        {getVehicleIcon(vehicle.type)} {vehicle.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Plate Number</p>
                      <p className="font-medium">{vehicle.plateNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Color</p>
                      <p className="font-medium">{vehicle.color || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mileage</p>
                      <p className="font-medium">{vehicle.mileage ? `${vehicle.mileage} km` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Rental</p>
                      <p className="font-medium">${vehicle.rentalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Barcode</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <Barcode 
                      value={vehicle.plateNumber} 
                      width={1.5}
                      height={50}
                      format="CODE128"
                      displayValue={true}
                    />
                    <p className="text-center mt-2 text-sm text-muted-foreground">
                      Vehicle ID: {vehicle.plateNumber}
                    </p>
                  </div>
                  <PrintBarcodeButton
                    barcodeValue={vehicle.plateNumber}
                    displayText={vehicle.plateNumber}
                    title={`${vehicle.name} (${vehicle.model} ${vehicle.year})`}
                    subtitle={`Vehicle ID: ${vehicle.plateNumber}`}
                    variant="outline"
                    className="w-full"
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="assignment">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Assignment History</CardTitle>
              </CardHeader>
              <CardContent>
                {rentalHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentalHistory.map((rental) => {
                        // Format dates
                        const startDate = new Date(rental.startDate);
                        const endDate = new Date(rental.endDate);
                        // Calculate duration
                        const durationMs = endDate.getTime() - startDate.getTime();
                        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
                        const durationHours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                        let durationText = '';
                        if (durationDays > 0) {
                          durationText += `${durationDays}d `;
                        }
                        if (durationHours > 0 || durationDays > 0) {
                          durationText += `${durationHours}h `;
                        }
                        durationText += `${durationMinutes}m`;
                        return (
                          <TableRow key={rental.id}>
                            <TableCell>{rental.user.email}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {startDate.toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {startDate.toLocaleTimeString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {endDate.toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {endDate.toLocaleTimeString()}
                              </div>
                            </TableCell>
                            <TableCell>{durationText}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                rental.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                                rental.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' : 
                                'bg-gray-100 text-gray-800'
                              }>
                                {rental.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No assignment history found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance History</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMaintenance ? (
                  <div className="text-center py-4">Loading maintenance history...</div>
                ) : maintenanceHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceHistory.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            {new Date(m.maintenanceDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{m.maintenanceType}</TableCell>
                          <TableCell>
                            {m.description && m.description.startsWith('http') ? (
                              <span className="italic text-muted-foreground">Receipt attached</span>
                            ) : (
                              m.description
                            )}
                          </TableCell>
                          <TableCell>
                            {typeof m.cost === "number" ? `$${m.cost.toLocaleString()}` : "N/A"}
                          </TableCell>
                          <TableCell>
                            {m.receiptUrl ? (
                              <a
                                href={m.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <FileText className="h-4 w-4" /> View Invoice
                              </a>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No maintenance history found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="health">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Health (AI Analysis)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center gap-4 py-4">
                  <div className="text-5xl font-bold">
                    {vehicleHealth.score}%
                  </div>
                  <div className={`text-lg font-semibold ${vehicleHealth.score >= 90 ? "text-green-600" : vehicleHealth.score >= 75 ? "text-yellow-600" : "text-red-600"}`}>
                    {vehicleHealth.status}
                  </div>
                  <div className="text-center text-muted-foreground">{vehicleHealth.message}</div>
                  {maintenanceHistory.length > 0 && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <div>
                        <strong>Maintenance in last year:</strong> {vehicleHealth.count}
                      </div>
                      <div>
                        <strong>Total cost in last year:</strong> ${vehicleHealth.totalCost?.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}