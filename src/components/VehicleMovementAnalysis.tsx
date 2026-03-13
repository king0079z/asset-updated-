import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Car, Clock, MapPin, BarChart3, Calendar, RefreshCw, Route, Info, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VehicleMovementAnalysisProps {
  vehicles: any[];
  isLoading?: boolean;
}

export default function VehicleMovementAnalysis({ vehicles, isLoading = false }: VehicleMovementAnalysisProps) {
  const { t } = useTranslation();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('day');
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tripHistory, setTripHistory] = useState<any[]>([]);
  const [tripHistoryLoading, setTripHistoryLoading] = useState<boolean>(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<string>('overview');

  // Set first vehicle as default when vehicles are loaded
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // Fetch analysis data when vehicle or period changes
  useEffect(() => {
    if (!selectedVehicleId) return;
    
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/vehicles/movement-analysis?vehicleId=${selectedVehicleId}&period=${selectedPeriod}`);
        
        if (response.ok) {
          const data = await response.json();
          setAnalysisData(data);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to fetch analysis data:', errorData);
          setError(errorData.error || 'Failed to fetch analysis data');
        }
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        setError('Network error when fetching analysis data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalysisData();
  }, [selectedVehicleId, selectedPeriod]);

  // Fetch trip history
  useEffect(() => {
    const fetchTripHistory = async () => {
      try {
        setTripHistoryLoading(true);
        
        const response = await fetch('/api/vehicles/trip-history');
        
        if (response.ok) {
          const data = await response.json();
          // Filter trips for the selected vehicle if a vehicle is selected
          const filteredTrips = selectedVehicleId 
            ? data.vehicleTrips.filter((trip: any) => trip.vehicleId === selectedVehicleId)
            : data.vehicleTrips;
            
          setTripHistory(filteredTrips);
        } else {
          console.error('Failed to fetch trip history');
        }
      } catch (error) {
        console.error('Error fetching trip history:', error);
      } finally {
        setTripHistoryLoading(false);
      }
    };
    
    fetchTripHistory();
  }, [selectedVehicleId]);

  const refreshAnalysis = () => {
    if (!selectedVehicleId) return;
    
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/vehicles/movement-analysis?vehicleId=${selectedVehicleId}&period=${selectedPeriod}`);
        
        if (response.ok) {
          const data = await response.json();
          setAnalysisData(data);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to fetch analysis data:', errorData);
          setError(errorData.error || 'Failed to fetch analysis data');
        }
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        setError('Network error when fetching analysis data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalysisData();
  };

  // Format time from minutes to hours and minutes
  const formatDrivingTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours === 0) {
      return `${mins} ${t('minutes')}`;
    } else if (mins === 0) {
      return `${hours} ${hours === 1 ? t('hour') : t('hours')}`;
    } else {
      return `${hours} ${hours === 1 ? t('hour') : t('hours')} ${mins} ${t('minutes')}`;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Calculate trip duration in minutes
  const calculateTripDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    return Math.round(durationMs / (1000 * 60)); // Convert to minutes
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('vehicle_movement_analysis')}
            </CardTitle>
            <CardDescription>{t('ai_powered_movement_insights')}</CardDescription>
          </div>
          <Button 
            onClick={refreshAnalysis} 
            variant="outline" 
            size="sm"
            className="gap-2"
            disabled={loading || !selectedVehicleId}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="w-full md:w-1/2">
            <label className="text-sm font-medium mb-2 block">{t('select_vehicle')}</label>
            <Select 
              value={selectedVehicleId} 
              onValueChange={setSelectedVehicleId}
              disabled={isLoading || vehicles.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select_vehicle')} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(vehicle => (
                  <SelectItem key={vehicle.id} value={vehicle.id || 'unknown-vehicle-id'}>
                    {vehicle.name} ({vehicle.licensePlate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full md:w-1/2">
            <label className="text-sm font-medium mb-2 block">{t('time_period')}</label>
            <Select 
              value={selectedPeriod} 
              onValueChange={setSelectedPeriod}
              disabled={isLoading || !selectedVehicleId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select_time_period')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('last_24_hours')}</SelectItem>
                <SelectItem value="week">{t('last_7_days')}</SelectItem>
                <SelectItem value="month">{t('last_30_days')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeAnalysisTab} onValueChange={setActiveAnalysisTab} className="mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="trips">{t('trip_history')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : !analysisData ? (
              <div className="text-center py-10 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
                <Car className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('no_analysis_data')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('select_vehicle_and_period')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Vehicle info */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border dark:border-slate-800">
                  <div>
                    <h3 className="font-medium">{analysisData.vehicleName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{analysisData.licensePlate}</p>
                  </div>
                  <Badge variant={
                    analysisData.totalDistance > 50 ? "default" : 
                    analysisData.totalDistance > 20 ? "secondary" : "outline"
                  }>
                    {analysisData.period === 'day' ? t('daily_analysis') : 
                     analysisData.period === 'week' ? t('weekly_analysis') : t('monthly_analysis')}
                  </Badge>
                </div>
                
                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Route className="h-5 w-5 text-blue-500" />
                      <h3 className="font-medium">{t('total_distance')}</h3>
                    </div>
                    <p className="text-2xl font-bold">{analysisData.totalDistance} km</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(analysisData.firstTimestamp)} - {formatDate(analysisData.lastTimestamp)}
                    </p>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-green-500" />
                      <h3 className="font-medium">{t('driving_time')}</h3>
                    </div>
                    <p className="text-2xl font-bold">{formatDrivingTime(analysisData.totalDrivingTime)}</p>
                    <Progress 
                      value={Math.min((analysisData.totalDrivingTime / (60 * 8)) * 100, 100)} 
                      className="h-2 mt-2" 
                    />
                  </div>
                </div>
                
                {/* Destinations and Completed Trips */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-red-500" />
                    {t('identified_destinations_and_trips')}
                  </h3>
                  
                  {analysisData.destinations && analysisData.destinations.length === 0 ? (
                    <div className="text-center py-6 border rounded-lg bg-slate-50">
                      <p className="text-sm text-gray-500">{t('no_significant_stops_or_trips')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analysisData.destinations && analysisData.destinations.map((dest: any, index: number) => (
                        <div key={index} className="flex items-start border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                          <div className={`flex-shrink-0 ${dest.isCompletedTrip ? 'bg-green-100' : 'bg-red-100'} rounded-full p-2 mr-3`}>
                            {dest.isCompletedTrip ? (
                              <Car className="h-4 w-4 text-green-500" />
                            ) : (
                              <MapPin className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <h4 className="font-medium">
                                {dest.isCompletedTrip ? t('completed_trip') : `${t('destination')} #${index + 1}`}
                              </h4>
                              <Badge variant={dest.isCompletedTrip ? "success" : "outline"}>
                                {Math.round(dest.duration)} {t('minutes')}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              {formatDate(dest.startTime)} - {formatDate(dest.endTime)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {dest.latitude.toFixed(6)}, {dest.longitude.toFixed(6)}
                            </p>
                            {dest.isCompletedTrip && dest.tripMetadata && dest.tripMetadata.completionStatus && (
                              <div className="mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {dest.tripMetadata.completionStatus}
                                </Badge>
                                {dest.tripMetadata.distanceToStart !== undefined && (
                                  <span className="text-xs ml-2 text-gray-500">
                                    {(dest.tripMetadata.distanceToStart * 1000).toFixed(0)}m {t('from_start')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="trips">
            {tripHistoryLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : tripHistory.length === 0 ? (
              <div className="text-center py-10 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
                <Car className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('no_trip_history')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selectedVehicleId 
                    ? t('no_trips_for_selected_vehicle') 
                    : t('no_trips_recorded')}
                </p>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg flex items-center gap-2 text-sm border dark:border-slate-800">
                  <Info className="h-4 w-4 text-blue-500" />
                  <p>{t('showing_trips_for_selected_vehicle')}</p>
                </div>
                
                {tripHistory.map((trip: any) => (
                  <div key={trip.id} className="border dark:border-slate-800 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <Car className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                          <h3 className="font-medium">{trip.vehicle.name}</h3>
                          <Badge variant="outline">{trip.vehicle.licensePlate}</Badge>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(trip.startTime)} - {formatDate(trip.endTime)}
                        </p>
                      </div>
                      <Badge variant={
                        trip.isAutoStarted && trip.isAutoEnded ? "success" : 
                        trip.isAutoStarted || trip.isAutoEnded ? "secondary" : "outline"
                      }>
                        {trip.isAutoStarted && trip.isAutoEnded 
                          ? t('auto_detected') 
                          : trip.isAutoStarted 
                            ? t('auto_started') 
                            : trip.isAutoEnded 
                              ? t('auto_ended') 
                              : t('manual')}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('distance')}</p>
                        <p className="font-medium">{trip.distance.toFixed(1)} km</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('duration')}</p>
                        <p className="font-medium">
                          {formatDrivingTime(calculateTripDuration(trip.startTime, trip.endTime))}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-red-500" />
                          <span className="text-xs">
                            {trip.startLatitude.toFixed(6)}, {trip.startLongitude.toFixed(6)}
                          </span>
                        </div>
                        <Activity className="h-4 w-4 text-slate-400" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs">
                            {trip.endLatitude.toFixed(6)}, {trip.endLongitude.toFixed(6)}
                          </span>
                          <MapPin className="h-4 w-4 text-green-500" />
                        </div>
                      </div>
                      
                      {trip.completionStatus && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium">{t('status')}:</span> {trip.completionStatus}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="border-t pt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{t('data_updated')}: {new Date().toLocaleString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}