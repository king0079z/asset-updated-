import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatUserId } from "@/util/user";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Car,
  Calendar,
  Hash,
  DollarSign,
  Gauge,
  Palette,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Wrench,
  XCircle,
  Truck,
  Bus,
  Bike,
  Printer,
  History,
  User,
  FileText,
  HeartPulse,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import Barcode from "react-barcode";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface VehicleDetailsDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function VehicleDetailsDialog({ vehicle, open, onOpenChange }: VehicleDetailsDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [rentalHistory, setRentalHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  // Fetch vehicle rental history and maintenance history when the dialog is opened and vehicle is selected
  useEffect(() => {
    if (!open || !vehicle) return;

    const fetchRentalHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        
        const response = await fetch(`/api/vehicles/${vehicle.id}/rental-history`);
        
        if (response.ok) {
          const data = await response.json();
          setRentalHistory(data.rentalHistory);
        } else {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
          console.error("Failed to fetch rental history:", errorData);
          setHistoryError(errorData.message || "Failed to fetch rental history");
        }
      } catch (error) {
        console.error("Error fetching rental history:", error);
        setHistoryError("Network error when fetching rental history");
      } finally {
        setHistoryLoading(false);
      }
    };

    const fetchMaintenanceHistory = async () => {
      try {
        setMaintenanceLoading(true);
        setMaintenanceError(null);

        const response = await fetch(`/api/vehicles/${vehicle.id}/maintenance-history`);
        if (response.ok) {
          const data = await response.json();
          setMaintenanceHistory(data.maintenanceHistory);
        } else {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
          setMaintenanceError(errorData.message || "Failed to fetch maintenance history");
        }
      } catch (error) {
        setMaintenanceError("Network error when fetching maintenance history");
      } finally {
        setMaintenanceLoading(false);
      }
    };

    fetchRentalHistory();
    fetchMaintenanceHistory();
  }, [open, vehicle]);

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

  if (!vehicle) return null;

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Completed</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vehicle Details</DialogTitle>
        </DialogHeader>

        {/* Barcode Section */}
        <div className="mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <div ref={printRef} className="flex flex-col items-center">
                  <Barcode 
                    value={vehicle.plateNumber} 
                    width={1.5}
                    height={50}
                    format="CODE128"
                    displayValue={true}
                  />
                  <div className="text-sm text-muted-foreground mt-2">
                    Vehicle ID: {vehicle.plateNumber}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Barcode
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Vehicle Details
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Usage History
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Maintenance History
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4" />
              Vehicle Health
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {vehicle.imageUrl ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden">
                    <img
                      src={vehicle.imageUrl}
                      alt={vehicle.name}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    {getVehicleIcon(vehicle.type)}
                  </div>
                )}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-semibold">{vehicle.name}</h3>
                      <Badge className={getStatusColor(vehicle.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(vehicle.status)}
                          {vehicle.status}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {vehicle.model} ({vehicle.year})
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center gap-2">
                        {getVehicleIcon(vehicle.type)}
                        <span className="font-medium">{vehicle.type}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span>Plate Number: {vehicle.plateNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Year: {vehicle.year}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>Monthly Rental: QAR {vehicle.rentalAmount.toLocaleString()}</span>
                      </div>
                      {vehicle.mileage && (
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-muted-foreground" />
                          <span>Mileage: {vehicle.mileage.toLocaleString()} km</span>
                        </div>
                      )}
                      {vehicle.color && (
                        <div className="flex items-center gap-2">
                          <Palette className="h-4 w-4 text-muted-foreground" />
                          <span>Color: {vehicle.color}</span>
                        </div>
                      )}
                      {vehicle.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>Location: {vehicle.location}</span>
                        </div>
                      )}
                      {vehicle.lastMaintenance && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Last Maintenance: {new Date(vehicle.lastMaintenance).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Vehicle Usage History</h3>
                </div>
                
                {historyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : historyError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{historyError}</AlertDescription>
                  </Alert>
                ) : rentalHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <User className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-center text-slate-500 dark:text-slate-400">
                      No usage history found for this vehicle
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rentalHistory.map((rental) => (
                          <TableRow key={rental.id}>
                            <TableCell className="font-medium">
                              {rental.user.email}
                              <div className="text-xs text-muted-foreground">
                                ID: {formatUserId(rental.user.id)}
                              </div>
                            </TableCell>
                            <TableCell>{new Date(rental.startDate).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(rental.endDate).toLocaleDateString()}</TableCell>
                            <TableCell>{getStatusBadge(rental.status)}</TableCell>
                            <TableCell>{new Date(rental.createdAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="maintenance" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Maintenance History</h3>
                </div>
                {maintenanceLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : maintenanceError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{maintenanceError}</AlertDescription>
                  </Alert>
                ) : maintenanceHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Wrench className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-center text-slate-500 dark:text-slate-400">
                      No maintenance history found for this vehicle
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                              {typeof m.cost === "number" ? `QAR ${m.cost.toLocaleString()}` : "N/A"}
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="health" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center gap-4 py-4">
                  <div className="text-5xl font-bold">
                    {getVehicleHealth().score}%
                  </div>
                  <div className={`text-lg font-semibold ${getVehicleHealth().score >= 90 ? "text-green-600" : getVehicleHealth().score >= 75 ? "text-yellow-600" : "text-red-600"}`}>
                    {getVehicleHealth().status}
                  </div>
                  <div className="text-center text-muted-foreground">{getVehicleHealth().message}</div>
                  {maintenanceHistory.length > 0 && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <div>
                        <strong>Maintenance in last year:</strong> {getVehicleHealth().count}
                      </div>
                      <div>
                        <strong>Total cost in last year:</strong> QAR {getVehicleHealth().totalCost?.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}