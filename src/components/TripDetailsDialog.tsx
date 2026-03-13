import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, MapPin, Route, Fuel, DollarSign, Car } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const TripRouteMap = dynamic(() => import("@/components/TripRouteMap").then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  ),
});

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  duration?: number;
}

interface TripDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: {
    id: string;
    startTime: string;
    endTime: string;
    distance: number;
    startLatitude: number;
    startLongitude: number;
    endLatitude?: number | null;
    endLongitude?: number | null;
    completionStatus?: string | null;
    routePoints?: RoutePoint[] | null;
    vehicle: {
      name: string;
      plateNumber: string;
      mileage?: number;
    };
  } | null;
}

export function TripDetailsDialog({ open, onOpenChange, trip }: TripDetailsDialogProps) {
  if (!trip) return null;
  
  // Calculate trip duration in minutes
  const startTime = new Date(trip.startTime);
  const endTime = new Date(trip.endTime);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  
  // Format duration in hours and minutes
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours} hours ${mins} minutes` : `${mins} minutes`;
  };
  
  // Format date and time
  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Calculate fuel cost (approximate)
  // Assuming average fuel consumption of 10 km/liter and fuel price of 2.05 QAR/liter
  const calculateFuelCost = (distance: number): number => {
    const fuelConsumption = 10; // km per liter
    const fuelPrice = 2.05; // QAR per liter
    
    const litersUsed = distance / fuelConsumption;
    return litersUsed * fuelPrice;
  };
  
  const fuelCost = calculateFuelCost(trip.distance);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Trip Details
          </DialogTitle>
          <DialogDescription>
            Detailed information about your trip on {formatDateTime(startTime)}
          </DialogDescription>
        </DialogHeader>
        
        {/* Trip Map */}
        <div className="h-[300px] w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-4">
          <TripRouteMap
            startLatitude={trip.startLatitude}
            startLongitude={trip.startLongitude}
            endLatitude={trip.endLatitude || null}
            endLongitude={trip.endLongitude || null}
            routePoints={trip.routePoints || []}
            height="300px"
            darkMode={true}
          />
        </div>
        
        {/* Trip Summary */}
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
          <h3 className="text-lg font-semibold mb-2">Trip Summary</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            You traveled <span className="font-semibold">{trip.distance.toFixed(2)} kilometers</span> in {formatDuration(durationMinutes)} with {trip.vehicle.name} ({trip.vehicle.plateNumber}).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">Start Time</div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{formatDateTime(startTime)}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">End Time</div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">{formatDateTime(endTime)}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">Status</div>
              <div className="flex items-center gap-2">
                {trip.completionStatus === 'COMPLETED' ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Completed</Badge>
                ) : trip.completionStatus === 'INCOMPLETE' ? (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Incomplete</Badge>
                ) : (
                  <Badge variant="outline">{trip.completionStatus || 'Unknown'}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Trip Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Locations
            </h4>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Start Location</div>
                <div className="text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded-md">
                  {trip.startLatitude.toFixed(6)}, {trip.startLongitude.toFixed(6)}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">End Location</div>
                <div className="text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded-md">
                  {trip.endLatitude ? `${trip.endLatitude.toFixed(6)}, ${trip.endLongitude?.toFixed(6)}` : 'N/A'}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Route Points</div>
                <div className="text-sm font-medium">
                  {trip.routePoints ? trip.routePoints.length : 0} tracking points recorded
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Fuel className="h-4 w-4 text-primary" />
              Trip Metrics
            </h4>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Distance</div>
                <div className="text-lg font-semibold text-primary">
                  {trip.distance.toFixed(2)} km
                </div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Duration</div>
                <div className="text-lg font-semibold text-primary">
                  {formatDuration(durationMinutes)}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Estimated Fuel Cost</div>
                <div className="text-lg font-semibold text-primary flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {fuelCost.toFixed(2)} QAR
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Based on average consumption of 10 km/liter at 2.05 QAR/liter
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Vehicle Information */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            Vehicle Information
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Vehicle</div>
              <div className="text-sm font-medium">{trip.vehicle.name}</div>
            </div>
            
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Plate Number</div>
              <div className="text-sm font-medium">{trip.vehicle.plateNumber}</div>
            </div>
            
            {trip.vehicle.mileage !== undefined && trip.vehicle.mileage !== null && (
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Vehicle Mileage</div>
                <div className="text-sm font-medium">{trip.vehicle.mileage.toLocaleString()} km</div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}