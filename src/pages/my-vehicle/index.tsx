import { useEffect, useState, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { MapPin, Car, AlertTriangle, Gauge, Clock, RotateCw, Wifi, WifiOff, Route, Home, Navigation, History, CheckCircle, XCircle, AlertCircle, Zap, ZapOff, Database, Smartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRentalId } from "@/util/rental";
import { formatUserId } from "@/util/user";
import { motion } from "framer-motion";
import { ConnectivityMonitor } from "@/components/ConnectivityMonitor";
import { useNetworkStatus, useGPSStatus, connectivityManager } from "@/util/connectivity";
import { AutomaticTripManager } from "@/components/AutomaticTripManager";
import { TripDetailsDialog } from "@/components/TripDetailsDialog";

// Dynamically import the map components to avoid SSR issues
const VehicleMap = dynamic(() => import("@/components/VehicleMap").then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-slate-100 rounded-lg flex items-center justify-center">
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  ),
});

const TripRouteMap = dynamic(() => import("@/components/TripRouteMap").then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  ),
});

interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface VehicleRental {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  vehicleId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: User;
}

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model: string;
  year: number;
  plateNumber: string;
  licensePlate?: string;
  status: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "RETIRED";
  type: string;
  color?: string;
  mileage?: number;
  rentalAmount: number;
  insuranceInfo?: string;
  registrationExp?: string;
  imageUrl?: string;
  rentals?: VehicleRental[];
}

interface TripData {
  startTime: Date;
  startLatitude: number;
  startLongitude: number;
  currentDistance: number; // in kilometers
  isActive: boolean;
}

// Vehicle Trip History Component
function VehicleAssignmentHistory({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const [vehicleTrips, setVehicleTrips] = useState<Array<{
    id: string;
    startTime: string;
    endTime: string;
    distance: number;
    startLatitude: number;
    startLongitude: number;
    endLatitude: number;
    endLongitude: number;
    completionStatus: string;
    vehicleId: string;
    vehicle: Vehicle;
    createdAt: string;
    routePoints?: Array<{
      latitude: number;
      longitude: number;
      timestamp: string;
    }> | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [showTripDetails, setShowTripDetails] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchTripHistory = async () => {
      try {
        setLoading(true);
        console.log("Fetching trip history for user:", userId);
        const response = await fetch("/api/vehicles/trip-history");
        
        if (response.ok) {
          const data = await response.json();
          console.log("Trip history data:", data);
          setVehicleTrips(data.vehicleTrips || []);
          
          // If no trips found, fetch diagnostic data
          if (!data.vehicleTrips || data.vehicleTrips.length === 0) {
            try {
              const diagResponse = await fetch("/api/vehicles/trip-diagnostic");
              if (diagResponse.ok) {
                const diagData = await diagResponse.json();
                console.log("Diagnostic data:", diagData);
                setDiagnosticData(diagData);
              }
            } catch (diagError) {
              console.error("Error fetching diagnostic data:", diagError);
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Failed to fetch trip history:", errorData);
          setError(errorData.error || "Failed to fetch trip history");
        }
      } catch (error) {
        console.error("Error fetching trip history:", error);
        setError("Network error when fetching trip history");
      } finally {
        setLoading(false);
      }
    };

    fetchTripHistory();
  }, [userId]);

  // Calculate trip duration in days, hours, and minutes
  const calculateTripDuration = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let durationMs = end.getTime() - start.getTime();
    
    // Handle case where endDate might be before startDate (data inconsistency)
    if (durationMs < 0) {
      console.warn('Trip duration calculation resulted in negative value, using absolute value instead');
      durationMs = Math.abs(durationMs);
    }
    
    // Convert to days, hours, minutes
    const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getCompletionStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Completed</Badge>;
      case 'INCOMPLETE':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Incomplete</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date and time
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 bg-slate-50 dark:bg-slate-800 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              {t('trip_history')}
            </CardTitle>
            <CardDescription>{t('previous_vehicle_trips')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : vehicleTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Route className="h-16 w-16 text-slate-200 mb-4" />
            <p className="text-center text-slate-500 max-w-md mb-4">
              {t('no_trip_history')}
            </p>
            {diagnosticData && (
              <div className="w-full max-w-md p-4 bg-slate-50 rounded-lg text-sm">
                <details>
                  <summary className="cursor-pointer font-medium text-primary mb-2">Show Diagnostic Information</summary>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="font-medium">User ID: {diagnosticData.userInfo?.id}</p>
                      <p>Email: {diagnosticData.userInfo?.email}</p>
                    </div>
                    <div>
                      <p className="font-medium">Assigned Vehicles: {diagnosticData.userVehicles?.length || 0}</p>
                      {diagnosticData.userVehicles?.map((v: any) => (
                        <p key={v.id}>- {v.name} ({v.plateNumber}): {v.status}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium">Active Rentals: {diagnosticData.userRentals?.length || 0}</p>
                    </div>
                    <div>
                      <p className="font-medium">User Trips: {diagnosticData.userTripCount || 0}</p>
                      <p>Total Trips in System: {diagnosticData.tripCount || 0}</p>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <TableHead className="font-semibold">{t('vehicle')}</TableHead>
                  <TableHead className="font-semibold">{t('start_time')}</TableHead>
                  <TableHead className="font-semibold">{t('end_time')}</TableHead>
                  <TableHead className="font-semibold">{t('distance')}</TableHead>
                  <TableHead className="font-semibold">{t('duration')}</TableHead>
                  <TableHead className="font-semibold">{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleTrips.map((trip) => (
                  <>
                    <TableRow 
                      key={trip.id} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      onClick={() => setExpandedTripId(expandedTripId === trip.id ? null : trip.id)}
                    >
                      <TableCell className="font-medium">
                        {trip.vehicle.name}
                        <div className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="font-mono bg-slate-50">
                            {trip.vehicle.plateNumber}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatDateTime(trip.startTime)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatDateTime(trip.endTime)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {trip.distance !== undefined && trip.distance !== null ? trip.distance.toFixed(2) : '0.00'} km
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium">
                          {calculateTripDuration(trip.startTime, trip.endTime)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCompletionStatusBadge(trip.completionStatus)}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedTripId(expandedTripId === trip.id ? null : trip.id);
                            }}
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                              className={`transition-transform ${expandedTripId === trip.id ? 'rotate-180' : ''}`}
                            >
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTrip(trip);
                              setShowTripDetails(true);
                            }}
                          >
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Trip Details with Route Map */}
                    {expandedTripId === trip.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0 border-t-0">
                          <div className="p-4 bg-slate-50 dark:bg-slate-800">
                            <h4 className="text-sm font-medium mb-2">Trip Route</h4>
                            
                            {/* Trip Route Map */}
                            {trip.routePoints && trip.routePoints.length > 0 ? (
                              <div className="h-[400px] w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-2">
                                <TripRouteMap
                                  startLatitude={trip.startLatitude}
                                  startLongitude={trip.startLongitude}
                                  endLatitude={trip.endLatitude || null}
                                  endLongitude={trip.endLongitude || null}
                                  routePoints={trip.routePoints}
                                  height="400px"
                                  darkMode={true}
                                />
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-md text-center text-sm text-slate-600 dark:text-slate-300 mb-2">
                                No route data available for visualization
                              </div>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                              <div className="p-3 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Start Location</div>
                                <div className="text-sm font-medium">
                                  {trip.startLatitude !== undefined && trip.startLatitude !== null ? trip.startLatitude.toFixed(6) : '0.000000'}, 
                                  {trip.startLongitude !== undefined && trip.startLongitude !== null ? trip.startLongitude.toFixed(6) : '0.000000'}
                                </div>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">End Location</div>
                                <div className="text-sm font-medium">
                                  {trip.endLatitude !== undefined && trip.endLatitude !== null ? trip.endLatitude.toFixed(6) : 'N/A'}, 
                                  {trip.endLongitude !== undefined && trip.endLongitude !== null ? trip.endLongitude.toFixed(6) : 'N/A'}
                                </div>
                              </div>
                            </div>
                            
                            {!trip.routePoints || trip.routePoints.length === 0 ? (
                              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-md text-sm text-amber-700 dark:text-amber-400">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  <span>No detailed route data available for this trip.</span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-400">
                                <div className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                                    <path d="M3 3v18h18"></path>
                                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                                  </svg>
                                  <span>Route contains {trip.routePoints.length} tracking points.</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-slate-50 dark:bg-slate-800 border-t py-3 flex flex-col sm:flex-row justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {vehicleTrips.length > 0 ? `Showing ${vehicleTrips.length} trips` : 'No trips found'}
        </p>
        <Button variant="outline" size="sm" className="gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export History
        </Button>
      </CardFooter>
      
      {/* Trip Details Dialog */}
      <TripDetailsDialog 
        open={showTripDetails}
        onOpenChange={setShowTripDetails}
        trip={selectedTrip}
      />
    </Card>
  );
}

export default function MyVehiclePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [totalTripDuration, setTotalTripDuration] = useState<string | null>(null);
  const [trip, setTrip] = useState<TripData | null>(null);
  const [trackingInterval, setTrackingInterval] = useState(10000); // 10 seconds default
  const previousCoordinatesRef = useRef<{lat: number, lng: number} | null>(null);
  const [completionStatus, setCompletionStatus] = useState<string | null>(null);
  const [lastTripEndTime, setLastTripEndTime] = useState<Date | null>(null);
  const [isStationaryTime, setIsStationaryTime] = useState<Date | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);
  const [autoEndEnabled, setAutoEndEnabled] = useState(true);
  const [lastMovementTime, setLastMovementTime] = useState<Date | null>(null);

  // Use our enhanced background geolocation hook for location tracking with Google-level accuracy
  const {
    latitude,
    longitude,
    error: locationError,
    isLoading: locationLoading,
    isTracking,
    lastUpdated,
    startTracking,
    stopTracking,
    accuracy,
    isUsingFallbackLocation,
    gpsStatus
  } = useBackgroundGeolocation({
    backgroundTracking: true, // Always enable background tracking on this page
    trackingInterval: trackingInterval,
    enableHighAccuracy: true, // Request highest possible accuracy
    fallbackToLastLocation: true, // Use last known location if GPS fails
    timeout: 30000, // Longer timeout for better GPS acquisition
    maximumAge: 0, // Always get fresh location data
    safeMode: true // Enable safe mode to prevent crashes
  });

  // Create a compatible object for the map component
  const userLocation = latitude && longitude ? {
    coords: {
      latitude,
      longitude,
      accuracy: accuracy || 0,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    },
    timestamp: lastUpdated?.getTime() || Date.now()
  } : null;

  // Function to calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  // Fetch assigned vehicle data
  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/vehicles/my-vehicle");
        
        if (response.ok) {
          const data = await response.json();
          setVehicle(data.vehicle);
          setTotalDistance(data.totalDistance || 0);
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Failed to fetch vehicle:", errorData);
          setError(errorData.error || "Failed to fetch vehicle data");
        }
      } catch (error) {
        console.error("Error fetching vehicle:", error);
        setError("Network error when fetching vehicle data");
      } finally {
        setLoading(false);
      }
    };

    // Fetch trip statistics
    const fetchTripStats = async () => {
      try {
        const response = await fetch("/api/vehicles/trip-stats");
        
        if (response.ok) {
          const data = await response.json();
          setTotalTripDuration(data.totalDuration);
          // We can also update total distance from here if needed
          // setTotalDistance(data.totalDistance || 0);
        } else {
          console.error("Failed to fetch trip statistics");
          // Don't set error here to avoid blocking the UI
        }
      } catch (error) {
        console.error("Error fetching trip statistics:", error);
      }
    };

    // Check for active trip
    const checkActiveTrip = async () => {
      try {
        const response = await fetch("/api/vehicles/active-trip");
        
        if (response.ok) {
          const data = await response.json();
          if (data.hasActiveTrip && data.trip) {
            console.log("Active trip found:", data.trip);
            // Parse the startTime string into a Date object
            const tripWithDateObject = {
              ...data.trip,
              startTime: new Date(data.trip.startTime)
            };
            setTrip(tripWithDateObject);
            previousCoordinatesRef.current = { 
              lat: data.trip.startLatitude, 
              lng: data.trip.startLongitude 
            };
            setLastMovementTime(new Date());
          }
        } else {
          console.error("Failed to check active trip");
          // Don't set error here to avoid blocking the UI
        }
      } catch (error) {
        console.error("Error checking active trip:", error);
      }
    };

    fetchVehicleData();
    fetchTripStats();
    checkActiveTrip();
    
    // Refresh data every 2 minutes
    const vehicleIntervalId = setInterval(fetchVehicleData, 120000);
    const statsIntervalId = setInterval(fetchTripStats, 120000);
    
    return () => {
      clearInterval(vehicleIntervalId);
      clearInterval(statsIntervalId);
    };
  }, []);

  // Function to start a new trip
  const startTrip = useCallback(async (isAutoStarted = false) => {
    if (!latitude || !longitude) return;
    
    try {
      // Send trip start data to server
      const response = await fetch("/api/vehicles/start-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startTime: new Date(),
          startLatitude: latitude,
          startLongitude: longitude,
          isAutoStarted
        })
      });
      
      if (response.ok) {
        // Set trip state
        setTrip({
          startTime: new Date(),
          startLatitude: latitude,
          startLongitude: longitude,
          currentDistance: 0,
          isActive: true
        });
        previousCoordinatesRef.current = { lat: latitude, lng: longitude };
        setCompletionStatus(null);
        setIsStationaryTime(null);
        setLastMovementTime(new Date());
        
        console.log(`Trip ${isAutoStarted ? 'auto-started' : 'manually started'}`);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to start trip:", errorData);
        setError(errorData.error || "Failed to start trip");
      }
    } catch (error) {
      console.error("Error starting trip:", error);
      setError("Network error when starting trip");
    }
  }, [latitude, longitude]);

  // Function to end the current trip
  const endTrip = async (isAutoEnded = false) => {
    if (!trip || !latitude || !longitude) return;
    
    try {
      // Send trip data to server
      const response = await fetch("/api/vehicles/end-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startTime: trip.startTime,
          endTime: new Date(),
          distance: trip.currentDistance,
          startLatitude: trip.startLatitude,
          startLongitude: trip.startLongitude,
          endLatitude: latitude,
          endLongitude: longitude,
          isAutoEnded
        })
      });
      
      if (response.ok) {
        // Update total distance and completion status
        const data = await response.json();
        setTotalDistance(data.totalDistance || 0);
        setCompletionStatus(data.completionStatus);
        setLastTripEndTime(new Date());
        
        // Reset trip
        setTrip(null);
        setIsStationaryTime(null);
        
        console.log(`Trip ${isAutoEnded ? 'auto-ended' : 'manually ended'} with status: ${data.completionStatus}`);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to end trip:", errorData);
        setError(errorData.error || "Failed to end trip");
      }
    } catch (error) {
      console.error("Error ending trip:", error);
      setError("Network error when ending trip");
    }
  };

  // Function to check if current location is close to starting point
  const isNearStartingPoint = (): boolean => {
    if (!trip || !latitude || !longitude) return false;
    
    const distance = calculateDistance(
      trip.startLatitude,
      trip.startLongitude,
      latitude,
      longitude
    );
    
    // If within 100 meters of starting point
    return distance < 0.1;
  };

  // Format time duration from milliseconds
  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Check if current time is within duty hours
  const isDutyHours = useCallback(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute; // Convert to minutes since midnight
    
    // Duty hours: Sunday to Thursday, 8:00 AM to 2:30 PM
    const isDutyDay = dayOfWeek >= 0 && dayOfWeek <= 4; // Sunday to Thursday
    const dutyStartTime = 8 * 60; // 8:00 AM in minutes
    const dutyEndTime = 14 * 60 + 30; // 2:30 PM in minutes
    
    return isDutyDay && currentTime >= dutyStartTime && currentTime <= dutyEndTime;
  }, []);

  // Function to auto-complete a trip
  const autoCompleteTrip = useCallback(async (reason: string) => {
    if (!trip || !latitude || !longitude) return;
    
    try {
      // Send auto-complete request to server
      const response = await fetch("/api/vehicles/auto-complete-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          reason
        })
      });
      
      if (response.ok) {
        // Update total distance and completion status
        const data = await response.json();
        setTotalDistance(data.totalDistance || 0);
        setCompletionStatus(data.completionStatus);
        setLastTripEndTime(new Date());
        
        // Reset trip
        setTrip(null);
        setIsStationaryTime(null);
        
        console.log(`Trip auto-completed with reason: ${reason}, status: ${data.completionStatus}`);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to auto-complete trip:", errorData);
        setError(errorData.error || "Failed to auto-complete trip");
      }
    } catch (error) {
      console.error("Error auto-completing trip:", error);
      setError("Network error when auto-completing trip");
    }
  }, [trip, latitude, longitude]);

  // Function to auto-detect and start a trip
  const autoDetectTrip = useCallback(async () => {
    if (!latitude || !longitude || trip?.isActive || !autoStartEnabled) return;
    
    try {
      // Send auto-detect request to server
      const response = await fetch("/api/vehicles/auto-detect-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          timestamp: new Date()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.tripDetected) {
          // Set trip state
          setTrip({
            startTime: new Date(data.startTime),
            startLatitude: data.startLocation.latitude,
            startLongitude: data.startLocation.longitude,
            currentDistance: 0,
            isActive: true
          });
          previousCoordinatesRef.current = { lat: latitude, lng: longitude };
          setCompletionStatus(null);
          setIsStationaryTime(null);
          setLastMovementTime(new Date());
          
          console.log('Trip auto-detected and started');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to auto-detect trip:", errorData);
        // Don't set error to avoid UI disruption
      }
    } catch (error) {
      console.error("Error auto-detecting trip:", error);
      // Don't set error to avoid UI disruption
    }
  }, [latitude, longitude, trip?.isActive, autoStartEnabled]);

  // Detect movement and update trip distance with improved auto-end functionality
  useEffect(() => {
    if (!latitude || !longitude || !previousCoordinatesRef.current) return;

    const prevCoords = previousCoordinatesRef.current;
    const distance = calculateDistance(
      prevCoords.lat,
      prevCoords.lng,
      latitude,
      longitude
    );

    // Detect if vehicle is moving (more than 5 meters)
    const significantMovement = distance > 0.005;

    if (significantMovement) {
      setLastMovementTime(new Date());
      setIsStationaryTime(null);
      setIsMoving(true);
    } else {
      // If not moving significantly, update stationary time
      if (!isStationaryTime) {
        setIsStationaryTime(new Date());
      } else if (trip?.isActive && autoEndEnabled) {
        // Check if vehicle has been stationary for more than 1 minute
        const stationaryDuration = new Date().getTime() - isStationaryTime.getTime();
        
        // If stationary for more than 1 minute, check if near starting point
        if (stationaryDuration > 60000) {
          const isNearStart = isNearStartingPoint();
          console.log('Checking if near starting point:', isNearStart, 'Stationary duration:', stationaryDuration / 1000, 'seconds');
          
          // If near starting point, auto-end trip
          if (isNearStart) {
            console.log('Vehicle is near starting point and stationary - auto-ending trip');
            autoCompleteTrip('returned_to_start');
          }
        }
      }
      
      setIsMoving(false);
    }

    // Update trip distance if active
    if (trip?.isActive && significantMovement) {
      setTrip(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentDistance: prev.currentDistance + distance
        };
      });
    }

    // Update previous coordinates
    previousCoordinatesRef.current = { lat: latitude, lng: longitude };
  }, [latitude, longitude, trip?.isActive, autoEndEnabled, autoCompleteTrip]);

  // Update tracking interval based on movement - using a more reasonable interval to prevent excessive refreshes
  useEffect(() => {
    // If moving, track more frequently (every 15 seconds)
    // If stationary, track less frequently (every 60 seconds)
    const newInterval = isMoving ? 15000 : 60000;
    
    if (newInterval !== trackingInterval) {
      setTrackingInterval(newInterval);
    }
  }, [isMoving, trackingInterval]);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight dark:text-slate-100">{t('my_vehicle')}</h1>
              <p className="text-muted-foreground dark:text-slate-300">
                {t('my_vehicle_description')}
              </p>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="gap-2"
              disabled={loading}
            >
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-[300px] w-full rounded-lg" />
              <Skeleton className="h-[300px] w-full rounded-lg" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
          ) : !vehicle ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('no_vehicle_assigned')}</CardTitle>
                <CardDescription>{t('no_vehicle_assigned_description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Car className="h-16 w-16 text-slate-300 mb-4" />
                <p className="text-center text-slate-500 max-w-md mb-6">
                  {t('contact_admin_for_vehicle')}
                </p>
                <div className="flex justify-center">
                  <Link href="/admin/vehicle-assignments">
                    <Button variant="outline">
                      Go to Vehicle Assignments
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle Details Card */}
                <Card className="shadow-md overflow-hidden border-slate-200 transition-all hover:shadow-lg">
                  <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Car className="h-5 w-5 text-primary" />
                          {vehicle.name}
                        </CardTitle>
                        <CardDescription className="font-medium text-slate-600">
                          {vehicle.make} {vehicle.model} ({vehicle.year})
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={vehicle.status === "RENTED" ? "default" : "outline"}
                        className="capitalize font-medium animate-fade-in"
                      >
                        {vehicle.status.toLowerCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {vehicle.imageUrl && (
                      <div className="w-full h-48 relative">
                        <img 
                          src={vehicle.imageUrl} 
                          alt={vehicle.name} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <Badge className="bg-white/90 text-black hover:bg-white/100 border-none">
                            {vehicle.plateNumber}
                          </Badge>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
                          <div className="flex items-center gap-2 mb-1">
                            <Car className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('plate_number')}</span>
                          </div>
                          <p className="text-sm font-semibold dark:text-slate-200">{vehicle.plateNumber}</p>
                        </div>
                        
                        {vehicle.color && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 transition-colors hover:bg-slate-100">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: vehicle.color }}></div>
                              <span className="text-xs font-medium text-slate-500">{t('color')}</span>
                            </div>
                            <p className="text-sm font-semibold capitalize">{vehicle.color}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {vehicle.mileage !== undefined && vehicle.mileage !== null && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 transition-colors hover:bg-slate-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Gauge className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium text-slate-500">{t('mileage')}</span>
                            </div>
                            <p className="text-sm font-semibold">{vehicle.mileage.toLocaleString()} km</p>
                          </div>
                        )}
                        
                        {vehicle.registrationExp && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 transition-colors hover:bg-slate-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium text-slate-500">{t('registration_expires')}</span>
                            </div>
                            <p className="text-sm font-semibold">{new Date(vehicle.registrationExp).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                      
                      {!vehicle.imageUrl && (
                        <div className="flex items-center justify-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          <div className="flex flex-col items-center text-center">
                            <Car className="h-12 w-12 text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500">No vehicle image available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Current Trip Card with Automatic Trip Management */}
                <Card className="shadow-md overflow-hidden border-slate-200 transition-all hover:shadow-lg">
                  <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Route className="h-5 w-5 text-primary" />
                          {t('current_trip')}
                        </CardTitle>
                        <CardDescription className="font-medium text-slate-600">
                          {t('automatic_trip_management')}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant="outline"
                        className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                      >
                        Enhanced
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <AutomaticTripManager 
                      backgroundTracking={true}
                      autoStartDistance={0.8} // 800 meters
                      autoEndDistance={0.1} // 100 meters
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Account Details Card - Moved to top with improved UI */}
              <Card className="shadow-sm border-primary/10">
                <CardHeader className="pb-3 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        {t('account_details')}
                      </CardTitle>
                      <CardDescription>{t('rental_information')}</CardDescription>
                    </div>
                    {vehicle.rentals && vehicle.rentals.length > 0 && (
                      <Badge className="capitalize bg-primary/20 text-primary hover:bg-primary/30 border-none">
                        {vehicle.rentals[0].status.toLowerCase()}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {vehicle.rentals && vehicle.rentals.length > 0 ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-lg">{vehicle.rentals[0].user.email}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs font-normal">
                              ID: {formatUserId(vehicle.rentals[0].user.id)}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-normal">
                              {t('account_created')}: {new Date(vehicle.rentals[0].user.createdAt).toLocaleDateString()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-card rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium text-muted-foreground">{t('rental_start')}</p>
                          </div>
                          <p className="text-lg font-semibold">
                            {new Date(vehicle.rentals[0].startDate).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="p-4 bg-card rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium text-muted-foreground">{t('rental_end')}</p>
                          </div>
                          <p className="text-lg font-semibold">
                            {new Date(vehicle.rentals[0].endDate).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="p-4 bg-card rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <p className="text-sm font-medium text-muted-foreground">{t('rental_id')}</p>
                          </div>
                          <p className="text-sm font-medium bg-muted p-1 rounded overflow-hidden text-ellipsis">
                            {formatRentalId(vehicle.rentals[0].startDate, vehicle.rentals[0].id, vehicle.rentals[0].displayId)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                          <span className="text-sm font-medium text-primary">{t('rental_information')}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 p-2 h-8">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      </div>
                      <p className="text-center text-slate-500 max-w-md">
                        {t('no_rental_information')}
                      </p>
                      <Button variant="outline" className="mt-4">
                        {t('contact_support')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Connectivity Monitor - Removed Offline Trip Monitor as it depends on removed functionality */}
              {/* Note: OfflineTripMonitor was removed because it depends on useOfflineTripDetection which was removed */}
              
              {/* Connectivity Monitor */}
              <ConnectivityMonitor className="mb-6" />
              
              {/* Map Card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{t('live_location')}</CardTitle>
                      <CardDescription>{t('your_current_location')}</CardDescription>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => connectivityManager.syncOfflineData()}
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Sync Data
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Manually sync any stored offline location data</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] w-full rounded-lg overflow-hidden border">
                    <VehicleMap 
                      vehicles={vehicle ? [{
                        id: vehicle.id,
                        name: vehicle.name,
                        licensePlate: vehicle.licensePlate || vehicle.plateNumber,
                        status: vehicle.status === "AVAILABLE" ? "available" : 
                               vehicle.status === "MAINTENANCE" ? "maintenance" : "rented",
                        location: latitude && longitude ? {
                          lat: latitude,
                          lng: longitude,
                          lastUpdated: lastUpdated?.toISOString() || new Date().toISOString()
                        } : undefined
                      }] : []}
                      userLocation={userLocation} 
                      isLoading={locationLoading}
                      isUsingNetworkLocation={isUsingFallbackLocation || false}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Trip Statistics Card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>{t('trip_statistics')}</CardTitle>
                  <CardDescription>{t('trip_statistics_description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Total Distance */}
                    <div className="flex flex-col items-center py-4 border-r">
                      <div className="text-sm text-slate-500 mb-1">Total Distance</div>
                      <div className="text-4xl font-bold mb-2">
                        {totalDistance !== null && totalDistance !== undefined ? totalDistance.toFixed(1) : '0'} <span className="text-xl font-normal">km</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {trip?.isActive && trip.currentDistance !== undefined && trip.currentDistance !== null && (
                          <span className="text-blue-600">
                            +{trip.currentDistance.toFixed(1)} km {t('in_current_trip')}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    {/* Total Duration */}
                    <div className="flex flex-col items-center py-4">
                      <div className="text-sm text-slate-500 mb-1">Total Duration</div>
                      <div className="text-4xl font-bold mb-2">
                        {totalTripDuration || '0h 0m'} 
                      </div>
                      <p className="text-sm text-slate-500">
                        {trip?.isActive && (
                          <span className="text-blue-600">
                            +{formatDuration(Date.now() - trip.startTime.getTime())} {t('in_current_trip')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {trip?.isActive && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{t('trip_progress')}</span>
                        <span>{formatDuration(Date.now() - trip.startTime.getTime())}</span>
                      </div>
                      <Progress value={Math.min(100, (trip.currentDistance / 10) * 100)} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Vehicle Assignment History Card */}
              <VehicleAssignmentHistory userId={user?.id} />
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}