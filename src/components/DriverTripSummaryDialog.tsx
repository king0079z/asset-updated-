import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Car, User, Calendar, Clock, Route, Fuel, Printer, Download, RefreshCw, FileText } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { PrintLoadingAnimation } from "@/components/PrintLoadingAnimation";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  rentalAmount: number;
}

interface DriverSummary {
  driver: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  tripCount: number;
  totalDistance: number;
  totalDurationMs: number;
  totalDuration: string;
  approximateFuelCost: number;
  vehicles: Vehicle[];
  vehicleCount: number;
}

interface OverallSummary {
  totalDrivers: number;
  totalTrips: number;
  totalDistance: number;
  totalDurationMs: number;
  totalApproximateFuelCost: number;
  uniqueVehicleCount: number;
}

interface DriverTripSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriverTripSummaryDialog({ open, onOpenChange }: DriverTripSummaryDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState<{
    driverSummaries: DriverSummary[];
    overallSummary: OverallSummary;
    totalDuration: string;
  } | null>(null);
  
  const { toast } = useToast();
  const { t, dir } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/vehicles/driver-trip-summary');
      if (!response.ok) {
        throw new Error('Failed to fetch driver trip summary');
      }
      const data = await response.json();
      setData(data);
    } catch (error) {
      console.error('Error fetching driver trip summary:', error);
      toast({
        title: "Error",
        description: "Failed to load driver trip summary data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const formatDistance = (distance: number) => {
    return `${distance.toFixed(1)} km`;
  };
  
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      try {
        const printContent = printRef.current;
        if (!printContent) return;
        
        const printStyles = `
          <style>
            @media print {
              body { font-family: Arial, sans-serif; color: #000; background: #fff; }
              .print-header { text-align: center; margin-bottom: 20px; }
              .print-header h1 { font-size: 24px; margin-bottom: 5px; }
              .print-header p { font-size: 14px; color: #666; }
              .print-section { margin-bottom: 30px; }
              .print-section h2 { font-size: 18px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
              .print-card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
              .print-card h3 { font-size: 16px; margin-top: 0; margin-bottom: 10px; }
              .print-stats { display: flex; flex-wrap: wrap; }
              .print-stat { width: 50%; margin-bottom: 10px; }
              .print-stat-label { font-size: 12px; color: #666; }
              .print-stat-value { font-size: 16px; font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .print-footer { text-align: center; font-size: 12px; color: #666; margin-top: 30px; }
            }
          </style>
        `;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast({
            title: "Error",
            description: "Could not open print window. Please check your popup settings.",
            variant: "destructive",
          });
          setIsPrinting(false);
          return;
        }
        
        printWindow.document.write('<html><head><title>Driver Trip Summary Report</title>');
        printWindow.document.write(printStyles);
        printWindow.document.write('</head><body>');
        
        // Add report header
        printWindow.document.write(`
          <div class="print-header">
            <h1>Driver Trip Summary Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
        `);
        
        // Add overall summary section
        if (data?.overallSummary) {
          const summary = data.overallSummary;
          printWindow.document.write(`
            <div class="print-section">
              <h2>Overall Summary</h2>
              <div class="print-card">
                <div class="print-stats">
                  <div class="print-stat">
                    <div class="print-stat-label">Total Drivers</div>
                    <div class="print-stat-value">${summary.totalDrivers}</div>
                  </div>
                  <div class="print-stat">
                    <div class="print-stat-label">Total Vehicles</div>
                    <div class="print-stat-value">${summary.uniqueVehicleCount}</div>
                  </div>
                  <div class="print-stat">
                    <div class="print-stat-label">Total Trips</div>
                    <div class="print-stat-value">${summary.totalTrips}</div>
                  </div>
                  <div class="print-stat">
                    <div class="print-stat-label">Total Distance</div>
                    <div class="print-stat-value">${formatDistance(summary.totalDistance)}</div>
                  </div>
                  <div class="print-stat">
                    <div class="print-stat-label">Total Duration</div>
                    <div class="print-stat-value">${data.totalDuration}</div>
                  </div>
                  <div class="print-stat">
                    <div class="print-stat-label">Approximate Fuel Cost</div>
                    <div class="print-stat-value">${formatCurrency(summary.totalApproximateFuelCost)}</div>
                  </div>
                </div>
              </div>
            </div>
          `);
        }
        
        // Add driver details section
        if (data?.driverSummaries && data.driverSummaries.length > 0) {
          printWindow.document.write(`
            <div class="print-section">
              <h2>Driver Details</h2>
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Trips</th>
                    <th>Distance</th>
                    <th>Duration</th>
                    <th>Vehicles Used</th>
                    <th>Est. Fuel Cost</th>
                  </tr>
                </thead>
                <tbody>
          `);
          
          data.driverSummaries.forEach(driver => {
            printWindow.document.write(`
              <tr>
                <td>${driver.driver.name}</td>
                <td>${driver.tripCount}</td>
                <td>${formatDistance(driver.totalDistance)}</td>
                <td>${driver.totalDuration}</td>
                <td>${driver.vehicleCount}</td>
                <td>${formatCurrency(driver.approximateFuelCost)}</td>
              </tr>
            `);
          });
          
          printWindow.document.write('</tbody></table>');
          
          // Add vehicle details for each driver
          data.driverSummaries.forEach(driver => {
            if (driver.vehicles.length > 0) {
              printWindow.document.write(`
                <div class="print-card">
                  <h3>Vehicles Used by ${driver.driver.name}</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Year</th>
                        <th>Plate Number</th>
                        <th>Monthly Rental</th>
                      </tr>
                    </thead>
                    <tbody>
              `);
              
              driver.vehicles.forEach(vehicle => {
                printWindow.document.write(`
                  <tr>
                    <td>${vehicle.make} ${vehicle.model}</td>
                    <td>${vehicle.year}</td>
                    <td>${vehicle.plateNumber}</td>
                    <td>${formatCurrency(vehicle.rentalAmount)}</td>
                  </tr>
                `);
              });
              
              printWindow.document.write('</tbody></table></div>');
            }
          });
          
          printWindow.document.write('</div>');
        }
        
        // Add footer
        printWindow.document.write(`
          <div class="print-footer">
            <p>This report is generated automatically by the Vehicle Fleet Management System.</p>
          </div>
        `);
        
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        // Print the document
        printWindow.onload = () => {
          printWindow.print();
          printWindow.close();
        };
      } catch (error) {
        console.error('Error printing report:', error);
        toast({
          title: "Error",
          description: "Failed to print report",
          variant: "destructive",
        });
      } finally {
        setIsPrinting(false);
      }
    }, 1000);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Car className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-5 w-5 text-primary`} />
            {t('driver_trip_summary')}
          </DialogTitle>
          <DialogDescription>
            {t('comprehensive_overview_of_all_driver_trips')}
          </DialogDescription>
        </DialogHeader>
        
        {isPrinting && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <PrintLoadingAnimation message={t('preparing_report_for_printing')} />
          </div>
        )}
        
        <div className="flex-1 overflow-hidden" ref={printRef}>
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-2" />
                <p className="text-muted-foreground">{t('loading_trip_summary_data')}</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="flex-1">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="overview">
                        <FileText className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
                        {t('overview')}
                      </TabsTrigger>
                      <TabsTrigger value="drivers">
                        <User className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
                        {t('drivers')}
                      </TabsTrigger>
                      <TabsTrigger value="vehicles">
                        <Car className={`${dir === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
                        {t('vehicles')}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchData}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`${dir === 'rtl' ? 'ml-1' : 'mr-1'} h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('refresh')}
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handlePrint}
                    disabled={isLoading || isPrinting}
                  >
                    <Printer className={`${dir === 'rtl' ? 'ml-1' : 'mr-1'} h-4 w-4`} />
                    {t('print_report')}
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <Tabs value={activeTab} className="h-full">
                  <ScrollArea className="h-full pr-4">
                    <TabsContent value="overview" className="mt-0 space-y-4">
                      {data?.overallSummary && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-background to-background/80">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-30 rounded-lg"></div>
                              <CardHeader className="pb-1 pt-3 relative">
                                <CardTitle className="text-base flex items-center">
                                  <div className="p-1.5 rounded-full bg-primary/10 mr-2">
                                    <User className="h-4 w-4 text-primary" />
                                  </div>
                                  {t('drivers_vehicles')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="relative pt-1 pb-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50">
                                    <div className="flex items-center">
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <User className="h-3 w-3 mr-1 opacity-70" />
                                        {t('total_drivers')}
                                      </p>
                                    </div>
                                    <p className="text-xl font-medium text-foreground">{data.overallSummary.totalDrivers}</p>
                                  </div>
                                  <div className="space-y-1 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50">
                                    <div className="flex items-center">
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <Car className="h-3 w-3 mr-1 opacity-70" />
                                        {t('total_vehicles')}
                                      </p>
                                    </div>
                                    <p className="text-xl font-medium text-foreground">{data.overallSummary.uniqueVehicleCount}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            
                            <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-background to-background/80">
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-30 rounded-lg"></div>
                              <CardHeader className="pb-1 pt-3 relative">
                                <CardTitle className="text-base flex items-center">
                                  <div className="p-1.5 rounded-full bg-blue-500/10 mr-2">
                                    <Route className="h-4 w-4 text-blue-500" />
                                  </div>
                                  {t('trip_statistics')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="relative pt-1 pb-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50">
                                    <div className="flex items-center">
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <Route className="h-3 w-3 mr-1 opacity-70" />
                                        {t('total_trips')}
                                      </p>
                                    </div>
                                    <p className="text-xl font-medium text-foreground">{data.overallSummary.totalTrips}</p>
                                  </div>
                                  <div className="space-y-1 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50">
                                    <div className="flex items-center">
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <Route className="h-3 w-3 mr-1 opacity-70" />
                                        {t('total_distance')}
                                      </p>
                                    </div>
                                    <p className="text-xl font-medium text-foreground">{formatDistance(data.overallSummary.totalDistance)}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            
                            <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-background to-background/80">
                              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-30 rounded-lg"></div>
                              <CardHeader className="pb-1 pt-3 relative">
                                <CardTitle className="text-base flex items-center">
                                  <div className="p-1.5 rounded-full bg-amber-500/10 mr-2">
                                    <Fuel className="h-4 w-4 text-amber-500" />
                                  </div>
                                  {t('cost_duration')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="relative pt-1 pb-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50">
                                    <div className="flex items-center">
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <Fuel className="h-3 w-3 mr-1 opacity-70" />
                                        {t('est_fuel_cost')}
                                      </p>
                                    </div>
                                    <p className="text-xl font-medium text-foreground">{formatCurrency(data.overallSummary.totalApproximateFuelCost)}</p>
                                  </div>
                                  <div className="space-y-1 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50">
                                    <div className="flex items-center">
                                      <p className="text-xs text-muted-foreground flex items-center">
                                        <Clock className="h-3 w-3 mr-1 opacity-70" />
                                        {t('total_duration')}
                                      </p>
                                    </div>
                                    <p className="text-xl font-medium text-foreground">{data.totalDuration}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                          
                          <Card>
                            <CardHeader>
                              <CardTitle>{t('top_drivers_by_distance')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t('driver')}</TableHead>
                                    <TableHead>{t('trips')}</TableHead>
                                    <TableHead>{t('distance')}</TableHead>
                                    <TableHead>{t('duration')}</TableHead>
                                    <TableHead>{t('vehicles_used')}</TableHead>
                                    <TableHead>{t('est_fuel_cost')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.driverSummaries.slice(0, 5).map((driver) => (
                                    <TableRow key={driver.driver.id}>
                                      <TableCell className="font-medium">{driver.driver.name}</TableCell>
                                      <TableCell>{driver.tripCount}</TableCell>
                                      <TableCell>{formatDistance(driver.totalDistance)}</TableCell>
                                      <TableCell>{driver.totalDuration}</TableCell>
                                      <TableCell>{driver.vehicleCount}</TableCell>
                                      <TableCell>{formatCurrency(driver.approximateFuelCost)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="drivers" className="mt-0 space-y-4">
                      {data?.driverSummaries && data.driverSummaries.length > 0 ? (
                        <div className="space-y-6">
                          {data.driverSummaries.map((driver) => (
                            <Card key={driver.driver.id}>
                              <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <User className="mr-2 h-5 w-5 text-primary" />
                                    {driver.driver.name}
                                  </div>
                                  <Badge variant="outline" className="ml-2">
                                    {driver.driver.role}
                                  </Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">{t('total_trips')}</p>
                                    <p className="text-xl font-bold">{driver.tripCount}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">{t('total_distance')}</p>
                                    <p className="text-xl font-bold">{formatDistance(driver.totalDistance)}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">{t('total_duration')}</p>
                                    <p className="text-xl font-bold">{driver.totalDuration}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">{t('est_fuel_cost')}</p>
                                    <p className="text-xl font-bold">{formatCurrency(driver.approximateFuelCost)}</p>
                                  </div>
                                </div>
                                
                                <Separator className="my-4" />
                                
                                <div>
                                  <h4 className="text-sm font-semibold mb-2">{t('vehicles_used')} ({driver.vehicleCount})</h4>
                                  {driver.vehicles.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {driver.vehicles.map((vehicle) => (
                                        <div 
                                          key={vehicle.id} 
                                          className="flex items-center p-2 rounded-md border bg-muted/50"
                                        >
                                          <Car className="mr-2 h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="text-sm font-medium">{vehicle.make} {vehicle.model} ({vehicle.year})</p>
                                            <p className="text-xs text-muted-foreground">{vehicle.plateNumber}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">{t('no_vehicle_data_available')}</p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">{t('no_driver_data_available')}</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="vehicles" className="mt-0">
                      {data?.driverSummaries && data.driverSummaries.length > 0 ? (
                        <Card>
                          <CardHeader>
                            <CardTitle>{t('vehicle_usage_summary')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t('vehicle')}</TableHead>
                                  <TableHead>{t('plate_number')}</TableHead>
                                  <TableHead>{t('year')}</TableHead>
                                  <TableHead>{t('monthly_rental')}</TableHead>
                                  <TableHead>{t('used_by')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {/* Create a unique list of vehicles from all drivers */}
                                {Array.from(
                                  new Map(
                                    data.driverSummaries
                                      .flatMap(driver => driver.vehicles)
                                      .map(vehicle => [vehicle.id, { vehicle, drivers: data.driverSummaries.filter(d => d.vehicles.some(v => v.id === vehicle.id)).map(d => d.driver) }])
                                  ).values()
                                ).map(({ vehicle, drivers }) => (
                                  <TableRow key={vehicle.id}>
                                    <TableCell className="font-medium">{vehicle.make} {vehicle.model}</TableCell>
                                    <TableCell>{vehicle.plateNumber}</TableCell>
                                    <TableCell>{vehicle.year}</TableCell>
                                    <TableCell>{formatCurrency(vehicle.rentalAmount)}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {drivers.map(driver => (
                                          <Badge key={driver.id} variant="outline" className="text-xs">
                                            {driver.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">{t('no_vehicle_data_available')}</p>
                        </div>
                      )}
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}