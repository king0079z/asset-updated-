import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, User, Car, AlertTriangle, ArrowLeft, MapPin, Clock, Calendar, Route, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import dynamic from "next/dynamic";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { DriverRouteAnalysis } from "@/components/DriverRouteAnalysis";

// Dynamically import the map component to avoid SSR issues
const TripRouteMap = dynamic(() => import("@/components/TripRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-accent/50 rounded-lg flex items-center justify-center">
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  ),
});

interface Driver {
  id: string;
  email: string;
  createdAt: string;
}

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  status: string;
  type: string;
  color: string;
  mileage: number;
  rentalAmount: number;
  imageUrl: string;
}

interface Trip {
  id: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  distance: number;
  isAutoStarted: boolean;
  isAutoEnded: boolean;
  completionStatus: string;
  routePoints: any;
  createdAt: string;
  updatedAt: string;
}

interface VehicleWithTrips {
  vehicle: Vehicle;
  trips: Trip[];
  assignmentDate: string;
}

export default function DriverDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehiclesWithTrips, setVehiclesWithTrips] = useState<VehicleWithTrips[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isSmallMobile = useMediaQuery("(max-width: 480px)");

  useEffect(() => {
    if (id) {
      fetchDriverDetails();
    }
  }, [id]);

  const fetchDriverDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/drivers/${id}`);
      if (response.ok) {
        const data = await response.json();
        setDriver(data.driver);
        setVehiclesWithTrips(data.vehiclesWithTrips);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to fetch driver details:", errorData);
        setError(errorData.error || "Failed to fetch driver details");
      }
    } catch (error) {
      console.error("Error fetching driver details:", error);
      setError("Network error when fetching driver data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate total statistics for this driver
  const calculateTotalStats = () => {
    let totalTrips = 0;
    let totalDistance = 0;
    let totalHours = 0;

    vehiclesWithTrips.forEach(({ trips }) => {
      totalTrips += trips.length;
      
      trips.forEach(trip => {
        totalDistance += trip.distance || 0;
        
        if (trip.endTime && trip.startTime) {
          const durationMs = new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime();
          const durationHours = durationMs / (1000 * 60 * 60);
          totalHours += durationHours;
        }
      });
    });

    return {
      totalTrips,
      totalDistance,
      totalHours
    };
  };

  const stats = calculateTotalStats();

  // Format duration from milliseconds to readable format
  const formatDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => router.push("/drivers")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('driver_details')}</h1>
                <p className="text-muted-foreground">
                  {driver?.email || t('loading_driver_information')}
                </p>
              </div>
            </div>
            <Button 
              onClick={fetchDriverDetails} 
              variant="outline" 
              className="gap-2 w-full sm:w-auto"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium">{t('error_fetching_data')}</p>
                <p className="text-xs">{error}</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 h-auto text-xs text-destructive" 
                  onClick={fetchDriverDetails}
                >
                  {t('try_again')}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-[100px] w-full rounded-lg" />
                <Skeleton className="h-[100px] w-full rounded-lg" />
                <Skeleton className="h-[100px] w-full rounded-lg" />
              </div>
              <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
          ) : driver ? (
            <>
              {/* Driver Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('driver_information')}</CardTitle>
                  <CardDescription>{t('personal_and_account_details')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div className="h-24 w-24 rounded-full bg-accent flex items-center justify-center">
                        <User className="h-12 w-12 text-accent-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-lg font-medium">{driver.email}</h3>
                        <p className="text-sm text-muted-foreground">{t('joined')}: {new Date(driver.createdAt).toLocaleDateString()}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-accent/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Car className="h-5 w-5 text-primary" />
                            <h4 className="font-medium">{t('vehicles_assigned')}</h4>
                          </div>
                          <p className="text-2xl font-bold">{vehiclesWithTrips.length}</p>
                        </div>
                        
                        <div className="bg-accent/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Route className="h-5 w-5 text-primary" />
                            <h4 className="font-medium">{t('total_trips')}</h4>
                          </div>
                          <p className="text-2xl font-bold">{stats.totalTrips}</p>
                        </div>
                        
                        <div className="bg-accent/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            <h4 className="font-medium">{t('total_distance')} (km)</h4>
                          </div>
                          <p className="text-2xl font-bold">{stats.totalDistance.toFixed(1)}</p>
                        </div>
                      </div>
                      
                      <div className="bg-accent/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-5 w-5 text-primary" />
                          <h4 className="font-medium">{t('total_hours_spent')}</h4>
                        </div>
                        <p className="text-2xl font-bold">{stats.totalHours.toFixed(1)} {t('hours')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* AI Route Analysis */}
              <DriverRouteAnalysis driverId={id as string} />

              {/* Vehicles and Trips Section */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('assigned_vehicles_and_trips')}</CardTitle>
                  <CardDescription>{t('vehicles_and_trip_history')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {vehiclesWithTrips.length === 0 ? (
                    <div className="text-center py-10">
                      <Car className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-2 text-sm font-semibold">{t('no_vehicles_assigned')}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t('no_vehicles_assigned_description')}</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {vehiclesWithTrips.map(({ vehicle, trips, assignmentDate }) => (
                        <div key={vehicle.id} className="border rounded-lg p-4">
                          <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <div className="flex-shrink-0 w-full md:w-auto flex justify-center md:block">
                              {vehicle.imageUrl ? (
                                <img 
                                  src={vehicle.imageUrl} 
                                  alt={vehicle.name} 
                                  className="h-32 w-48 object-cover rounded-md"
                                />
                              ) : (
                                <div className="h-32 w-48 bg-accent/50 rounded-md flex items-center justify-center">
                                  <Car className="h-12 w-12 text-accent-foreground" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                                <h3 className="text-lg font-medium">{vehicle.name}</h3>
                                <Badge 
                                  variant={vehicle.status === "AVAILABLE" ? "success" : 
                                          vehicle.status === "MAINTENANCE" ? "warning" : "default"}
                                >
                                  {t(vehicle.status.toLowerCase())}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground mb-3">
                                {vehicle.make} {vehicle.model} ({vehicle.year}) - {vehicle.plateNumber}
                              </p>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('type')}</p>
                                  <p className="text-sm font-medium">{t(vehicle.type.toLowerCase())}</p>
                                </div>
                                
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('color')}</p>
                                  <p className="text-sm font-medium">{vehicle.color}</p>
                                </div>
                                
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('mileage')}</p>
                                  <p className="text-sm font-medium">{vehicle.mileage} km</p>
                                </div>
                                
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('rental_amount')}</p>
                                  <p className="text-sm font-medium">${vehicle.rentalAmount}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <Separator className="my-4" />
                          
                          <h4 className="font-medium mb-3">{t('trip_history')}</h4>
                          
                          {trips.length === 0 ? (
                            <div className="text-center py-6 bg-accent/50 rounded-lg">
                              <Route className="mx-auto h-8 w-8 text-muted-foreground" />
                              <p className="mt-2 text-sm text-muted-foreground">{t('no_trips_recorded')}</p>
                              <div className="mt-3 flex items-center justify-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">
                                  {t('assigned_on')}: {new Date(assignmentDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {trips.map((trip) => (
                                <div 
                                  key={trip.id} 
                                  className={`border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                                    selectedTrip?.id === trip.id ? 'ring-2 ring-primary bg-primary/10' : ''
                                  }`}
                                  onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
                                >
                                  <div className="flex flex-col sm:flex-row justify-between mb-2 gap-2">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-primary" />
                                      <span className="font-medium">
                                        {new Date(trip.startTime).toLocaleDateString()}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-primary" />
                                      <span>
                                        {new Date(trip.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                        {new Date(trip.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                                    <div className="bg-accent/50 p-2 rounded">
                                      <p className="text-xs text-muted-foreground">{t('distance')}</p>
                                      <p className="text-sm font-medium">{trip.distance.toFixed(1)} km</p>
                                    </div>
                                    
                                    <div className="bg-accent/50 p-2 rounded">
                                      <p className="text-xs text-muted-foreground">{t('duration')}</p>
                                      <p className="text-sm font-medium">{formatDuration(trip.startTime, trip.endTime)}</p>
                                    </div>
                                    
                                    <div className="bg-accent/50 p-2 rounded">
                                      <p className="text-xs text-muted-foreground">{t('completion')}</p>
                                      <div className="flex items-center gap-1">
                                        {trip.isAutoEnded ? (
                                          <Badge variant="secondary">
                                            {t('auto_completed')}
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary">
                                            {t('manually_ended')}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className={cn(
                                    "flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm gap-2",
                                    isSmallMobile ? "space-y-2" : ""
                                  )}>
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3 text-destructive" />
                                      <span className="text-muted-foreground">
                                        {t('start')}: {trip.startLatitude.toFixed(6)}, {trip.startLongitude.toFixed(6)}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3 text-primary" />
                                      <span className="text-muted-foreground">
                                        {t('end')}: {trip.endLatitude.toFixed(6)}, {trip.endLongitude.toFixed(6)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {selectedTrip?.id === trip.id && trip.routePoints && (
                                    <div className="mt-3">
                                      <p className="text-sm font-medium mb-2">{t('trip_route')}</p>
                                      <div className="h-[400px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                                        <TripRouteMap 
                                          startLatitude={trip.startLatitude}
                                          startLongitude={trip.startLongitude}
                                          endLatitude={trip.endLatitude}
                                          endLongitude={trip.endLongitude}
                                          routePoints={trip.routePoints}
                                          height="400px"
                                          darkMode={true}
                                        />
                                      </div>
                                      
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                        <div className="p-3 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Start Location</div>
                                          <div className="text-sm font-medium">
                                            {trip.startLatitude.toFixed(6)}, {trip.startLongitude.toFixed(6)}
                                          </div>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">End Location</div>
                                          <div className="text-sm font-medium">
                                            {trip.endLatitude?.toFixed(6) || 'N/A'}, {trip.endLongitude?.toFixed(6) || 'N/A'}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {trip.routePoints && trip.routePoints.length > 0 ? (
                                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-400">
                                          <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                                              <path d="M3 3v18h18"></path>
                                              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                                            </svg>
                                            <span>Route contains {trip.routePoints.length} tracking points.</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-md text-sm text-amber-700 dark:text-amber-400">
                                          <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            <span>No detailed route data available for this trip.</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}