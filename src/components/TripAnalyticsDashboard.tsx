import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Car, 
  BarChart4, 
  Clock, 
  MapPin, 
  Calendar, 
  Zap, 
  Smartphone, 
  BarChart, 
  LineChart,
  Activity,
  Route,
  Gauge,
  Footprints,
  AlertTriangle
} from 'lucide-react';
import { MovementType } from '@/hooks/useMovementTypeDetection';

interface TripData {
  id: string;
  startTime: number;
  endTime?: number;
  duration: number;
  distance?: number;
  averageSpeed?: number;
  maxSpeed?: number;
  movementBreakdown: {
    vehicle: number;
    walking: number;
    stationary: number;
    unknown: number;
  };
  confidence: number;
  locationAccuracy?: number;
  batteryDrain?: number;
}

interface TripAnalyticsDashboardProps {
  trips: TripData[];
  loading?: boolean;
  className?: string;
  onViewTripDetails?: (tripId: string) => void;
}

export function TripAnalyticsDashboard({
  trips,
  loading = false,
  className = '',
  onViewTripDetails
}: TripAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  
  // Calculate summary statistics
  const totalTrips = trips.length;
  const totalDuration = trips.reduce((sum, trip) => sum + trip.duration, 0);
  const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
  const averageConfidence = trips.length > 0 
    ? trips.reduce((sum, trip) => sum + trip.confidence, 0) / trips.length 
    : 0;
  
  // Calculate movement type breakdown across all trips
  const movementBreakdown = trips.reduce((totals, trip) => {
    return {
      vehicle: totals.vehicle + trip.movementBreakdown.vehicle,
      walking: totals.walking + trip.movementBreakdown.walking,
      stationary: totals.stationary + trip.movementBreakdown.stationary,
      unknown: totals.unknown + trip.movementBreakdown.unknown
    };
  }, { vehicle: 0, walking: 0, stationary: 0, unknown: 0 });
  
  // Calculate total percentages
  const totalMovementTime = Object.values(movementBreakdown).reduce((sum, val) => sum + val, 0);
  const vehiclePercentage = totalMovementTime > 0 ? (movementBreakdown.vehicle / totalMovementTime) * 100 : 0;
  const walkingPercentage = totalMovementTime > 0 ? (movementBreakdown.walking / totalMovementTime) * 100 : 0;
  const stationaryPercentage = totalMovementTime > 0 ? (movementBreakdown.stationary / totalMovementTime) * 100 : 0;
  
  // Format duration in hours and minutes
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  
  // Format distance in km
  const formatDistance = (meters?: number) => {
    if (meters === undefined) return 'N/A';
    return (meters / 1000).toFixed(1) + ' km';
  };
  
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };
  
  // Format time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Get recent trips (last 5)
  const recentTrips = [...trips]
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 5);
  
  // Get trips for selected timeframe
  const getTimeframeTrips = () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    switch (selectedTimeframe) {
      case 'day':
        return trips.filter(trip => trip.startTime > now - day);
      case 'week':
        return trips.filter(trip => trip.startTime > now - 7 * day);
      case 'month':
        return trips.filter(trip => trip.startTime > now - 30 * day);
      default:
        return trips;
    }
  };
  
  const timeframeTrips = getTimeframeTrips();
  
  // Detect potential issues
  const detectIssues = () => {
    const issues = [];
    
    // Check for low confidence trips
    const lowConfidenceTrips = trips.filter(trip => trip.confidence < 0.6);
    if (lowConfidenceTrips.length > 0) {
      issues.push({
        type: 'lowConfidence',
        message: `${lowConfidenceTrips.length} trip${lowConfidenceTrips.length > 1 ? 's' : ''} with low confidence detection`,
        severity: 'warning'
      });
    }
    
    // Check for missing location data
    const missingLocationTrips = trips.filter(trip => trip.distance === undefined);
    if (missingLocationTrips.length > 0) {
      issues.push({
        type: 'missingLocation',
        message: `${missingLocationTrips.length} trip${missingLocationTrips.length > 1 ? 's' : ''} with missing location data`,
        severity: 'warning'
      });
    }
    
    // Check for high battery drain
    const highDrainTrips = trips.filter(trip => trip.batteryDrain !== undefined && trip.batteryDrain > 10);
    if (highDrainTrips.length > 0) {
      issues.push({
        type: 'highBatteryDrain',
        message: `${highDrainTrips.length} trip${highDrainTrips.length > 1 ? 's' : ''} with high battery consumption`,
        severity: 'info'
      });
    }
    
    return issues;
  };
  
  const issues = detectIssues();

  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart4 className="h-5 w-5 text-blue-600" />
              Trip Analytics Dashboard
            </CardTitle>
            <CardDescription className="font-medium text-slate-600">
              Comprehensive analysis of your vehicle movement patterns
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className={selectedTimeframe === 'day' ? 'bg-blue-100' : ''}
              onClick={() => setSelectedTimeframe('day')}
            >
              Day
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className={selectedTimeframe === 'week' ? 'bg-blue-100' : ''}
              onClick={() => setSelectedTimeframe('week')}
            >
              Week
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className={selectedTimeframe === 'month' ? 'bg-blue-100' : ''}
              onClick={() => setSelectedTimeframe('month')}
            >
              Month
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="trips" className="flex-1">Recent Trips</TabsTrigger>
            <TabsTrigger value="analysis" className="flex-1">Analysis</TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent className="p-4">
          <TabsContent value="overview" className="mt-0 space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Car className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-medium text-slate-700">Total Trips</p>
                </div>
                <p className="text-2xl font-bold text-slate-800">{totalTrips}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedTimeframe === 'day' ? 'Today' : 
                   selectedTimeframe === 'week' ? 'This week' : 'This month'}
                </p>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-medium text-slate-700">Total Duration</p>
                </div>
                <p className="text-2xl font-bold text-slate-800">{formatDuration(totalDuration)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Time spent in vehicle
                </p>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Route className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-medium text-slate-700">Total Distance</p>
                </div>
                <p className="text-2xl font-bold text-slate-800">{formatDistance(totalDistance)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Distance traveled
                </p>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Gauge className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-medium text-slate-700">Detection Accuracy</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-slate-800">{Math.round(averageConfidence * 100)}%</p>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                    {averageConfidence > 0.8 ? 'Excellent' : 
                     averageConfidence > 0.6 ? 'Good' : 'Fair'}
                  </Badge>
                </div>
                <Progress 
                  value={averageConfidence * 100} 
                  className="h-1.5 mt-1" 
                />
              </div>
            </div>
            
            {/* Movement Breakdown */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Movement Type Breakdown
              </h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <div className="flex items-center gap-1">
                      <Car className="h-3 w-3 text-green-600" />
                      <span>Vehicle</span>
                    </div>
                    <span>{Math.round(vehiclePercentage)}%</span>
                  </div>
                  <Progress value={vehiclePercentage} className="h-2 bg-slate-200" indicatorClassName="bg-green-600" />
                </div>
                
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <div className="flex items-center gap-1">
                      <Footprints className="h-3 w-3 text-blue-600" />
                      <span>Walking</span>
                    </div>
                    <span>{Math.round(walkingPercentage)}%</span>
                  </div>
                  <Progress value={walkingPercentage} className="h-2 bg-slate-200" indicatorClassName="bg-blue-600" />
                </div>
                
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-600" />
                      <span>Stationary</span>
                    </div>
                    <span>{Math.round(stationaryPercentage)}%</span>
                  </div>
                  <Progress value={stationaryPercentage} className="h-2 bg-slate-200" indicatorClassName="bg-slate-600" />
                </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-3">
                Based on {formatDuration(totalDuration)} of movement data
              </p>
            </div>
            
            {/* Issues and Recommendations */}
            {issues.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Detected Issues
                </h3>
                
                {issues.map((issue, index) => (
                  <Alert key={index} className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700">{issue.message}</AlertTitle>
                    <AlertDescription className="text-amber-600">
                      {issue.type === 'lowConfidence' && 
                        'Consider keeping your device in a stable position while driving for better detection.'}
                      {issue.type === 'missingLocation' && 
                        'Make sure location services are enabled for more accurate trip tracking.'}
                      {issue.type === 'highBatteryDrain' && 
                        'The app may be consuming more battery than usual during trips.'}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="trips" className="mt-0 space-y-4">
            {recentTrips.length === 0 ? (
              <div className="p-8 text-center">
                <Car className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-slate-700">No trips recorded</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Trip data will appear here once you start traveling
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTrips.map((trip) => (
                  <div 
                    key={trip.id} 
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    onClick={() => onViewTripDetails && onViewTripDetails(trip.id)}
                    role="button"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Car className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Trip on {formatDate(trip.startTime)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatTime(trip.startTime)} - {trip.endTime ? formatTime(trip.endTime) : 'In progress'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {formatDuration(trip.duration)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Distance</p>
                        <p className="font-medium">{formatDistance(trip.distance)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Avg. Speed</p>
                        <p className="font-medium">{trip.averageSpeed?.toFixed(1) || 'N/A'} km/h</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Confidence</p>
                        <div className="flex items-center gap-1">
                          <Progress value={trip.confidence * 100} className="h-1.5 w-12" />
                          <span>{Math.round(trip.confidence * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {trips.length > 5 && (
                  <Button 
                    variant="outline" 
                    className="w-full text-sm"
                    onClick={() => setActiveTab('analysis')}
                  >
                    View All {trips.length} Trips
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="analysis" className="mt-0 space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <BarChart className="h-4 w-4 text-blue-600" />
                Trip Detection Performance
              </h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Average Confidence</span>
                    <span>{Math.round(averageConfidence * 100)}%</span>
                  </div>
                  <Progress 
                    value={averageConfidence * 100} 
                    className="h-2" 
                    indicatorClassName={`${
                      averageConfidence > 0.8 ? 'bg-green-600' : 
                      averageConfidence > 0.6 ? 'bg-blue-600' : 'bg-amber-600'
                    }`}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Location Accuracy</span>
                    <span>{trips.some(t => t.locationAccuracy !== undefined) ? 
                      Math.round(trips.reduce((sum, t) => sum + (t.locationAccuracy || 0), 0) / 
                      trips.filter(t => t.locationAccuracy !== undefined).length) + 'm' : 
                      'N/A'}
                    </span>
                  </div>
                  <Progress 
                    value={trips.some(t => t.locationAccuracy !== undefined) ? 
                      Math.min(100, 100 - Math.min(50, trips.reduce((sum, t) => sum + (t.locationAccuracy || 0), 0) / 
                      trips.filter(t => t.locationAccuracy !== undefined).length)) : 
                      0} 
                    className="h-2" 
                  />
                </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-3">
                Based on {totalTrips} trip{totalTrips !== 1 ? 's' : ''} over {selectedTimeframe === 'day' ? 'today' : 
                selectedTimeframe === 'week' ? 'this week' : 'this month'}
              </p>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-600" />
                System Performance
              </h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Battery Efficiency</span>
                    <span>{trips.some(t => t.batteryDrain !== undefined) ? 
                      Math.round(trips.reduce((sum, t) => sum + (t.batteryDrain || 0), 0) / 
                      trips.filter(t => t.batteryDrain !== undefined).length) + '%/hr' : 
                      'N/A'}
                    </span>
                  </div>
                  <Progress 
                    value={trips.some(t => t.batteryDrain !== undefined) ? 
                      Math.min(100, 100 - Math.min(100, trips.reduce((sum, t) => sum + (t.batteryDrain || 0), 0) * 5 / 
                      trips.filter(t => t.batteryDrain !== undefined).length)) : 
                      0} 
                    className="h-2" 
                  />
                </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-3">
                Lower battery drain indicates better system efficiency
              </p>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500 flex justify-between">
        <span>Data from {formatDate(Math.min(...trips.map(t => t.startTime)))} to {formatDate(Math.max(...trips.map(t => t.startTime)))}</span>
        <span>{totalTrips} trip{totalTrips !== 1 ? 's' : ''} • {formatDistance(totalDistance)} total</span>
      </CardFooter>
    </Card>
  );
}