import React, { useState, useEffect } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Target, RotateCw, Clock, Pause } from 'lucide-react';

interface AutomaticTripManagerProps {
  destinationLatitude?: number;
  destinationLongitude?: number;
  autoStartDistance?: number;
  autoEndDistance?: number;
  backgroundTracking?: boolean;
}

export function AutomaticTripManager({
  backgroundTracking = true,
}: AutomaticTripManagerProps) {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [startLocation, setStartLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [targetEndLocation, setTargetEndLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [showEndPointDialog, setShowEndPointDialog] = useState(false);
  const [endLatitude, setEndLatitude] = useState<string>('');
  const [endLongitude, setEndLongitude] = useState<string>('');
  const [useCurrentLocationAsEnd, setUseCurrentLocationAsEnd] = useState(false);
  
  // Use geolocation for tracking with enhanced accuracy settings
  const location = useGeolocation({
    enableHighAccuracy: true,
    maximumAge: 0, // Always get fresh location data
    timeout: 30000, // Longer timeout for better accuracy
  });
  
  // Check for active trip on mount
  useEffect(() => {
    fetchActiveTripDetails();
  }, []);
  
  // State for stop points
  const [stopPoints, setStopPoints] = useState<Array<{
    latitude: number;
    longitude: number;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
  }>>([]);
  
  // Function to fetch active trip details
  const fetchActiveTripDetails = async () => {
    try {
      const response = await fetch('/api/vehicles/active-trip');
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.trip) {
          setIsActive(true);
          setTripId(data.trip.id);
          setStartTime(new Date(data.trip.startTime));
          setStartLocation({
            latitude: data.trip.startLatitude,
            longitude: data.trip.startLongitude,
          });
          setDistance(data.trip.distance || 0);
          
          // Set stop points if available
          if (data.trip.stopPoints && Array.isArray(data.trip.stopPoints)) {
            setStopPoints(data.trip.stopPoints.map((stop: any) => ({
              latitude: stop.latitude,
              longitude: stop.longitude,
              startTime: new Date(stop.startTime),
              endTime: new Date(stop.endTime),
              durationMinutes: stop.durationMinutes
            })));
          } else {
            setStopPoints([]);
          }
          
          // Set target end location if available
          if (data.trip.targetEndLatitude && data.trip.targetEndLongitude) {
            setTargetEndLocation({
              latitude: data.trip.targetEndLatitude,
              longitude: data.trip.targetEndLongitude,
            });
          } else {
            setTargetEndLocation(null);
          }
        } else {
          setIsActive(false);
          setTripId(null);
          setStartTime(null);
          setStartLocation(null);
          setTargetEndLocation(null);
          setDistance(0);
          setStopPoints([]);
        }
      }
    } catch (error) {
      console.error('Error fetching active trip:', error);
    }
  };
  
  // Set target end point for the trip
  const setTripEndPoint = async () => {
    if (!tripId) return false;
    
    try {
      let targetLat: number | null = null;
      let targetLng: number | null = null;
      
      if (useCurrentLocationAsEnd && location.latitude && location.longitude) {
        targetLat = location.latitude;
        targetLng = location.longitude;
      } else if (endLatitude && endLongitude) {
        targetLat = parseFloat(endLatitude);
        targetLng = parseFloat(endLongitude);
        
        // Validate coordinates
        if (isNaN(targetLat) || isNaN(targetLng) || 
            targetLat < -90 || targetLat > 90 || 
            targetLng < -180 || targetLng > 180) {
          setLastError('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.');
          return false;
        }
      } else {
        setLastError('Please provide valid coordinates or use current location');
        return false;
      }
      
      const response = await fetch(`/api/vehicles/set-trip-endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId,
          targetEndLatitude: targetLat,
          targetEndLongitude: targetLng
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTargetEndLocation({
          latitude: targetLat,
          longitude: targetLng
        });
        setShowEndPointDialog(false);
        setLastError(null);
        return true;
      } else {
        setLastError(data.error || 'Failed to set trip end point');
        return false;
      }
    } catch (error) {
      console.error('Error setting trip end point:', error);
      setLastError('Failed to set trip end point');
      return false;
    }
  };
  
  // Clear target end point
  const clearTripEndPoint = async () => {
    if (!tripId) return false;
    
    try {
      const response = await fetch(`/api/vehicles/set-trip-endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId,
          targetEndLatitude: null,
          targetEndLongitude: null
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTargetEndLocation(null);
        setLastError(null);
        return true;
      } else {
        setLastError(data.error || 'Failed to clear trip end point');
        return false;
      }
    } catch (error) {
      console.error('Error clearing trip end point:', error);
      setLastError('Failed to clear trip end point');
      return false;
    }
  };

  // Manual trip start function
  const startTrip = async () => {
    if (!location.latitude || !location.longitude || isActive) {
      return false;
    }
    
    try {
      const response = await fetch('/api/vehicles/start-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startTime: new Date(),
          startLatitude: location.latitude,
          startLongitude: location.longitude,
          accuracy: location.accuracy,
          locationSource: location.locationSource,
          isAutoStarted: false
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsActive(true);
        setTripId(data.tripId);
        setStartTime(new Date(data.startTime));
        setStartLocation({
          latitude: data.startLocation.latitude,
          longitude: data.startLocation.longitude,
        });
        setDistance(0);
        setLastError(null);
        
        // If location quality is poor, show a warning
        if (data.locationQuality === 'poor') {
          console.warn('Starting trip with poor location quality');
          setLastError('Trip started with poor location accuracy. This may affect trip tracking quality.');
          setTimeout(() => {
            setLastError(null);
          }, 5000);
        }
        
        return true;
      } else {
        setLastError(data.error || 'Failed to start trip');
        return false;
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      setLastError('Failed to start trip');
      return false;
    }
  };
  
  // Manual trip end function
  const endTrip = async () => {
    if (!location.latitude || !location.longitude || !isActive) {
      return false;
    }
    
    try {
      console.log('Ending trip with data:', {
        endTime: new Date(),
        endLatitude: location.latitude,
        endLongitude: location.longitude,
        accuracy: location.accuracy,
        locationSource: location.locationSource
      });
      
      const response = await fetch('/api/vehicles/end-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endTime: new Date(),
          endLatitude: location.latitude,
          endLongitude: location.longitude,
          accuracy: location.accuracy,
          locationSource: location.locationSource,
          isAutoEnded: false
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Trip ended successfully:', data);
        setIsActive(false);
        setTripId(null);
        setStartTime(null);
        setStartLocation(null);
        setDistance(data.distance || 0);
        setLastError(null);
        
        // If stop points were detected, show a success message
        if (data.stopPoints && data.stopPoints.length > 0) {
          setLastError(`Trip ended successfully with ${data.stopPoints.length} stop point(s) detected.`);
          setTimeout(() => {
            setLastError(null);
          }, 5000);
        }
        
        // Force refresh active trip details to ensure UI is updated
        setTimeout(() => {
          fetchActiveTripDetails();
        }, 500);
        
        return true;
      } else {
        console.error('Failed to end trip:', data);
        setLastError(data.error || 'Failed to end trip');
        return false;
      }
    } catch (error) {
      console.error('Error ending trip:', error);
      setLastError('Failed to end trip');
      return false;
    }
  };
  
  // Format distance to 1 decimal place
  const formatDistance = (distance: number | null) => {
    if (distance === null) return '0.0';
    return distance.toFixed(1);
  };
  
  // Format duration in hours and minutes
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };
  
  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Trip Status
            {isActive ? (
              <Badge variant="default" className="bg-green-600">Active</Badge>
            ) : (
              <Badge variant="outline">Inactive</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isActive 
              ? 'Your trip is currently in progress' 
              : 'Click the Start Trip button to begin tracking'}
          </CardDescription>
        </CardHeader>
      
      <CardContent className="space-y-4">        
        {/* Location Info */}
        <div>
          <h3 className="text-sm font-medium flex items-center gap-1">
            Current Location
            {location.isUsingFallbackLocation ? (
              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                {location.locationSource ? location.locationSource.toUpperCase() : 'Network'}
              </Badge>
            ) : !location.isLoading && location.latitude ? (
              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-200">GPS</Badge>
            ) : null}
          </h3>
          {location.isLoading ? (
            <p className="text-sm text-muted-foreground">Getting location...</p>
          ) : location.error ? (
            <p className="text-sm text-red-500">{location.error}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
              </p>
              {!location.isUsingFallbackLocation && location.latitude && (
                <p className="text-xs text-blue-600 mt-1">
                  High-precision GPS tracking enabled
                </p>
              )}
              {location.isUsingFallbackLocation && location.latitude && (
                <p className="text-xs text-orange-600 mt-1">
                  {location.locationAccuracyDescription || 
                   (location.locationSource === 'fusion' 
                    ? 'Enhanced network location (multiple sources)' 
                    : location.locationSource === 'wifi'
                      ? 'Using WiFi-based location'
                      : location.locationSource === 'cell'
                        ? 'Using cellular network location'
                        : location.locationSource === 'ip'
                          ? 'Using IP-based location (approximate)'
                          : 'Using network-based location')}
                </p>
              )}
            </>
          )}
        </div>
        
        {/* Trip Details */}
        {isActive && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Distance</h3>
                <p className="text-lg font-semibold">{formatDistance(distance)} km</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Duration</h3>
                <p className="text-lg font-semibold">
                  {formatDuration(
                    startTime 
                      ? Math.floor((new Date().getTime() - startTime.getTime()) / (1000 * 60)) 
                      : 0
                  )}
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium">Start Location</h3>
              <p className="text-sm text-muted-foreground">
                {startLocation?.latitude.toFixed(6)}, {startLocation?.longitude.toFixed(6)}
              </p>
            </div>
            
            {/* Stop Points */}
            {stopPoints.length > 0 && (
              <div className="mt-2">
                <h3 className="text-sm font-medium flex items-center gap-1">
                  <Pause className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Stop Points Detected ({stopPoints.length})
                </h3>
                <div className="mt-1 max-h-24 overflow-y-auto">
                  {stopPoints.map((stop, index) => (
                    <div key={index} className="text-xs text-muted-foreground mb-1 border-l-2 border-amber-200 dark:border-amber-800 pl-2">
                      <span className="font-medium">Stop {index + 1}:</span> {stop.durationMinutes} min at {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Manual Trip Instructions */}
        {!isActive && (
          <Alert className="bg-blue-50 dark:bg-blue-950">
            <AlertTitle>
              Manual Trip Tracking
            </AlertTitle>
            <AlertDescription>
              Trips will only start when you click the Start Trip button. Make sure your location is available before starting.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Error Message */}
        {lastError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchActiveTripDetails}
            disabled={location.isLoading}
            size="sm"
          >
            Refresh
          </Button>
          
          {isActive && (
            <Button
              variant="outline"
              onClick={() => setShowEndPointDialog(true)}
              disabled={location.isLoading}
              size="sm"
              className="flex items-center gap-1"
            >
              <Target className="h-4 w-4" />
              {targetEndLocation ? 'Change End Point' : 'Set End Point'}
            </Button>
          )}
        </div>
        
        {isActive ? (
          <Button 
            variant="destructive" 
            onClick={endTrip}
            disabled={location.isLoading}
          >
            End Trip
          </Button>
        ) : (
          <Button 
            variant="default" 
            onClick={startTrip}
            disabled={location.isLoading || !location.latitude}
          >
            Start Trip
          </Button>
        )}
      </CardFooter>
    </Card>
    
    {/* Target End Point Display */}
    {isActive && targetEndLocation && (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-1">
            <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Trip End Point
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
            onClick={clearTripEndPoint}
          >
            Clear
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {targetEndLocation.latitude.toFixed(6)}, {targetEndLocation.longitude.toFixed(6)}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Trip will automatically end when you reach this location
        </p>
      </div>
    )}
    
    {/* End Point Dialog */}
    <Dialog open={showEndPointDialog} onOpenChange={setShowEndPointDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Trip End Point</DialogTitle>
          <DialogDescription>
            Define where your trip should automatically end. You can use your current location or enter coordinates manually.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <input
              id="use-current-location"
              type="checkbox"
              className="rounded border-gray-300 dark:border-gray-600 dark:bg-slate-800 h-4 w-4"
              checked={useCurrentLocationAsEnd}
              onChange={(e) => setUseCurrentLocationAsEnd(e.target.checked)}
            />
            <Label htmlFor="use-current-location">Use my current location</Label>
          </div>
          
          {!useCurrentLocationAsEnd && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  placeholder="e.g. 25.286106"
                  value={endLatitude}
                  onChange={(e) => setEndLatitude(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  placeholder="e.g. 51.534817"
                  value={endLongitude}
                  onChange={(e) => setEndLongitude(e.target.value)}
                />
              </div>
            </div>
          )}
          
          {useCurrentLocationAsEnd && location.latitude && location.longitude && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">Current Location</span>
              </div>
              <p className="text-sm">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowEndPointDialog(false)}>Cancel</Button>
          <Button onClick={setTripEndPoint}>Save End Point</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}