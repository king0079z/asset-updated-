import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { MapPin, Car, AlertTriangle, RefreshCw, BarChart3, Radio, Wifi, WifiOff, HardDrive } from "lucide-react";
import TrackingDeviceManager from "@/components/TrackingDeviceManager";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import VehicleMovementAnalysis from "@/components/VehicleMovementAnalysis";
import { MovementTypeIndicator } from "@/components/MovementTypeIndicator";
import { fetchWithCache } from '@/lib/api-cache';

// Dynamically import the map component to avoid SSR issues
const VehicleMap = dynamic(() => import("@/components/VehicleMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-slate-100 rounded-lg flex items-center justify-center">
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  ),
});

interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  status: "available" | "maintenance" | "rented";
  location?: {
    lat: number;
    lng: number;
    lastUpdated: string;
  };
}

export default function VehicleTrackingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("map");
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(true);
  const [trackingInterval, setTrackingInterval] = useState(30000); // 30 seconds default

  // Use our enhanced background geolocation hook
  const {
    latitude,
    longitude,
    error: locationError,
    isLoading: locationLoading,
    isTracking,
    lastUpdated,
    startTracking,
    stopTracking,
    isUsingFallbackLocation,
    accuracy
  } = useBackgroundGeolocation({
    backgroundTracking: backgroundTrackingEnabled,
    trackingInterval: trackingInterval,
    enableHighAccuracy: true
  });

  // Create a GeolocationPosition-like object for the map component
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
  
  // Log the current location state for debugging
  useEffect(() => {
    if (userLocation) {
      console.log('User location updated:', {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        accuracy: userLocation.coords.accuracy,
        isUsingFallbackLocation
      });
    }
  }, [userLocation, isUsingFallbackLocation]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch vehicles data
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchWithCache("/api/vehicles/tracking");
        if (response.ok) {
          const data = await response.json();
          setVehicles(data.vehicles);
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Failed to fetch vehicles:", errorData);
          setError(errorData.error || "Failed to fetch vehicles");
        }
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        setError("Network error when fetching vehicle data");
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
    // Set up polling for vehicle locations (every 30 seconds)
    const intervalId = setInterval(fetchVehicles, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const refreshVehicleData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithCache("/api/vehicles/tracking");
      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to fetch vehicles:", errorData);
        setError(errorData.error || "Failed to fetch vehicles");
      }
    } catch (error) {
      console.error("Error refreshing vehicle data:", error);
      setError("Network error when fetching vehicle data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('vehicle_tracking_system')}</h1>
              <p className="text-muted-foreground">
                {t('vehicle_tracking_description')}
              </p>
            </div>
            <Button 
              onClick={refreshVehicleData} 
              variant="outline" 
              className="gap-2"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>

          <Tabs defaultValue="map" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="map">{t('map_view')}</TabsTrigger>
              <TabsTrigger value="list">{t('list_view')}</TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                {t('analysis')}
              </TabsTrigger>
              <TabsTrigger value="devices" className="flex items-center gap-1">
                <HardDrive className="h-4 w-4" />
                {t('devices') || 'Devices'}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="map" className="mt-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>{t('vehicle_locations')}</CardTitle>
                  <CardDescription>{t('real_time_vehicle_tracking')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {locationError && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2 text-yellow-800">
                      <AlertTriangle className="h-5 w-5" />
                      <p className="text-sm">{t('location_access_error')}</p>
                    </div>
                  )}
                  
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">{t('error_fetching_data')}</p>
                        <p className="text-xs">{error}</p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto text-xs text-red-800" 
                          onClick={refreshVehicleData}
                        >
                          {t('try_again')}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Background tracking controls */}
                  <div className="mb-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-sm font-medium mb-1">{t('background_gps_tracking')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('background_tracking_description')}</p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="background-tracking"
                            checked={backgroundTrackingEnabled}
                            onCheckedChange={(checked) => {
                              setBackgroundTrackingEnabled(checked);
                              if (checked) {
                                startTracking();
                              } else {
                                stopTracking();
                              }
                            }}
                          />
                          <Label htmlFor="background-tracking">
                            {backgroundTrackingEnabled ? t('enabled') : t('disabled')}
                          </Label>
                        </div>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-xs">
                                {isTracking ? (
                                  <Wifi className="h-4 w-4 text-green-500 animate-pulse" />
                                ) : (
                                  <WifiOff className="h-4 w-4 text-slate-400" />
                                )}
                                <span className={isTracking ? "text-green-600 dark:text-green-400" : "text-slate-500 dark:text-slate-400"}>
                                  {isTracking ? t('tracking_active') : t('tracking_inactive')}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isTracking 
                                ? t('location_updates_active') 
                                : t('location_updates_inactive')}
                              {lastUpdated && isTracking && (
                                <div className="text-xs mt-1">
                                  {t('last_update')}: {lastUpdated.toLocaleTimeString()}
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    {/* Movement Type Indicator */}
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h3 className="text-sm font-medium mb-1">{t('movement_detection') || 'Movement Detection'}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('movement_detection_description') || 'Automatically detects if you are in a vehicle or walking'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Wrap in try-catch to prevent errors if component is missing */}
                          {(() => {
                            try {
                              return <MovementTypeIndicator />;
                            } catch (error) {
                              console.error('Error rendering MovementTypeIndicator:', error);
                              return (
                                <div className="px-3 py-1 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-md border border-yellow-200 dark:border-yellow-800">
                                  Sensor unavailable
                                </div>
                              );
                            }
                          })()}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => window.location.href = '/vehicle-tracking/movement-analysis'}
                          >
                            {t('analyze') || 'Analyze'}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {isTracking && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {t('update_frequency')}:
                            <span className="ml-1 font-medium">
                              {trackingInterval / 1000} {t('seconds')}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setTrackingInterval(Math.max(5000, trackingInterval - 5000))}
                              disabled={trackingInterval <= 5000}
                            >
                              {t('more_frequent')}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setTrackingInterval(trackingInterval + 5000)}
                            >
                              {t('less_frequent')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {latitude && longitude && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{t('current_coordinates')}:</span> {latitude.toFixed(6)}, {longitude.toFixed(6)}
                        {isUsingFallbackLocation ? (
                          <div className="mt-2">
                            <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                              <Radio className="h-3 w-3 mr-1 text-orange-500" />
                              {t('network_location') || 'Network Location'}
                            </Badge>
                            <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-md text-orange-800 dark:text-orange-300">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium">{t('network_location_accuracy_warning') || 'Network-based location has limited accuracy'}</p>
                                  <p className="mt-1">{t('network_location_explanation') || 'Your current location is determined by your network connection (IP address) rather than GPS. This is typically accurate only to the city or neighborhood level (3-5km).'}</p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => {
                                        if (navigator.permissions) {
                                          navigator.permissions.query({ name: 'geolocation' }).then(result => {
                                            if (result.state === 'prompt' || result.state === 'granted') {
                                              startTracking();
                                            } else {
                                              window.open('https://support.google.com/chrome/answer/142065', '_blank');
                                            }
                                          });
                                        } else {
                                          startTracking();
                                        }
                                      }}
                                    >
                                      {t('try_gps_location') || 'Try GPS Location'}
                                    </Button>
                                    <Button 
                                      variant="link" 
                                      size="sm"
                                      className="h-7 text-xs p-0"
                                      onClick={() => window.open('https://support.google.com/chrome/answer/142065', '_blank')}
                                    >
                                      {t('how_to_enable_location') || 'How to enable location services'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                              <MapPin className="h-3 w-3 mr-1 text-green-500" />
                              {t('gps_location') || 'GPS Location'}
                            </Badge>
                            <div className="mt-1 text-xs text-green-700 dark:text-green-400">
                              {t('gps_accuracy') || 'GPS accuracy'}: {accuracy ? `~${Math.round(accuracy)}m` : t('unknown')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="h-[600px] w-full rounded-lg overflow-hidden border">
                    <VehicleMap 
                      vehicles={vehicles} 
                      userLocation={userLocation} 
                      isLoading={loading}
                      isUsingNetworkLocation={isUsingFallbackLocation}
                    />
                  </div>
                  
                  <div className="mt-4 flex gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm">{t('available')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm">{t('maintenance')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm">{t('rented')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      <span className="text-sm">{t('no_location_data')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="list" className="mt-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>{t('vehicle_list')}</CardTitle>
                  <CardDescription>{t('all_tracked_vehicles')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center p-4 border rounded-lg">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="ml-4 space-y-2 flex-1">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : vehicles.length === 0 ? (
                    <div className="text-center py-10">
                      <Car className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-semibold text-gray-900">{t('no_vehicles_found')}</h3>
                      <p className="mt-1 text-sm text-gray-500">{t('no_vehicles_description')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="flex items-center p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                              <Car className="h-5 w-5 text-slate-600" />
                            </div>
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium">{vehicle.name}</h3>
                              <Badge 
                                variant={
                                  vehicle.status === "available" ? "success" : 
                                  vehicle.status === "maintenance" ? "warning" : "default"
                                }
                              >
                                {t(vehicle.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{vehicle.licensePlate}</p>
                            <div className="mt-1 flex items-center text-xs text-gray-500">
                              {vehicle.location ? (
                                <>
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span>
                                    {t('last_updated')}: {new Date(vehicle.location.lastUpdated).toLocaleString()}
                                  </span>
                                </>
                              ) : (
                                <span className="flex items-center">
                                  <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
                                  {t('no_location_data')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="analysis" className="mt-4">
              <VehicleMovementAnalysis vehicles={vehicles} isLoading={loading} />
            </TabsContent>
            
            <TabsContent value="devices" className="mt-4">
              <div className="mb-4 flex justify-end">
                <Button variant="outline" onClick={() => window.location.href = '/vehicle-tracking/device-integration'}>
                  <HardDrive className="h-4 w-4 mr-2" />
                  Device Integration Guide
                </Button>
              </div>
              <TrackingDeviceManager />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}