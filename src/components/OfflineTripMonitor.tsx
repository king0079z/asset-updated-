import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Smartphone, 
  Database, 
  Wifi, 
  WifiOff, 
  Zap, 
  ZapOff, 
  Car,
  Footprints,
  User,
  BarChart4,
  Battery,
  BatteryCharging,
  BatteryLow,
  Clock,
  MapPin,
  MemoryStick,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MovementType } from '@/hooks/useMovementTypeDetection';
import { getStorageUsagePercentage } from '@/util/offlineStorage';

interface OfflineTripMonitorProps {
  isMoving: boolean;
  isOnline: boolean;
  currentTripId: string | null;
  pendingSyncCount: number;
  motionConfidence: number;
  motionSupported: boolean | null;
  hasLocation: boolean;
  syncTrips: () => void;
  movementType?: MovementType;
  movementConfidence?: number;
  tripStartTime?: number | null;
  tripDuration?: number;
  batteryLevel?: number;
  className?: string;
  detailedView?: boolean;
}

export function OfflineTripMonitor({
  isMoving,
  isOnline,
  currentTripId,
  pendingSyncCount,
  motionConfidence,
  motionSupported,
  hasLocation,
  syncTrips,
  movementType = MovementType.UNKNOWN,
  movementConfidence = 0,
  tripStartTime = null,
  tripDuration = 0,
  batteryLevel,
  className = '',
  detailedView = false,
}: OfflineTripMonitorProps) {
  const [activeTab, setActiveTab] = useState('status');
  const storageUsage = getStorageUsagePercentage();
  
  // Format trip duration in minutes and seconds
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };
  
  // Get appropriate icon and color based on movement type
  const getMovementTypeDetails = () => {
    switch (movementType) {
      case MovementType.VEHICLE:
        return {
          icon: <Car className="h-5 w-5 text-green-600 dark:text-green-400" />,
          label: 'In Vehicle',
          color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800',
        };
      case MovementType.WALKING:
        return {
          icon: <Footprints className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
          label: 'Walking',
          color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        };
      case MovementType.STATIONARY:
        return {
          icon: <User className="h-5 w-5 text-slate-600 dark:text-slate-400" />,
          label: 'Stationary',
          color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700',
        };
      default:
        return {
          icon: <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
          label: 'Analyzing',
          color: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        };
    }
  };
  
  const movementDetails = getMovementTypeDetails();
  
  // Get battery icon based on level
  const getBatteryIcon = () => {
    if (!batteryLevel) return <Battery className="h-4 w-4 text-slate-600" />;
    
    if (batteryLevel > 0.7) {
      return <BatteryCharging className="h-4 w-4 text-green-600" />;
    } else if (batteryLevel > 0.3) {
      return <Battery className="h-4 w-4 text-amber-600" />;
    } else {
      return <BatteryLow className="h-4 w-4 text-red-600" />;
    }
  };

  // Simple view for non-detailed mode
  if (!detailedView) {
    return (
      <Card className={`shadow-sm ${className}`}>
        <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-amber-600" />
                Trip Monitoring
              </CardTitle>
              <CardDescription className="font-medium text-slate-600">
                {currentTripId ? 'Trip in progress' : 'Monitoring movement'}
              </CardDescription>
            </div>
            <Badge 
              variant={isOnline ? "outline" : "secondary"}
              className={`capitalize font-medium ${isOnline ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${movementDetails.color}`}>
                {movementDetails.icon}
              </div>
              <div>
                <p className="text-sm font-medium dark:text-slate-200">{movementDetails.label}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Progress 
                    value={movementConfidence * 100} 
                    className="h-1.5 w-20" 
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {Math.round(movementConfidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
            
            {currentTripId && (
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Trip duration</p>
                <p className="text-sm font-medium dark:text-slate-200">{formatDuration(tripDuration || 0)}</p>
              </div>
            )}
          </div>
          
          {pendingSyncCount > 0 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-amber-700">
                {pendingSyncCount} trip{pendingSyncCount > 1 ? 's' : ''} pending sync
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={syncTrips}
                disabled={!isOnline}
                className="text-xs"
              >
                Sync Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Detailed view with tabs
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-amber-600" />
              Advanced Trip Monitoring
            </CardTitle>
            <CardDescription className="font-medium text-slate-600">
              Intelligent movement detection and trip tracking
            </CardDescription>
          </div>
          <Badge 
            variant={isOnline ? "outline" : "secondary"}
            className={`capitalize font-medium ${isOnline ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>
      </CardHeader>
      
      <Tabs defaultValue="status" value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="status" className="flex-1">Status</TabsTrigger>
            <TabsTrigger value="sensors" className="flex-1">Sensors</TabsTrigger>
            <TabsTrigger value="data" className="flex-1">Data</TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent className="p-4">
          <TabsContent value="status" className="space-y-4 mt-0">
            {/* Movement Status */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${movementDetails.color}`}>
                  {movementDetails.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{movementDetails.label}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-slate-500">Confidence:</span>
                    <Progress 
                      value={movementConfidence * 100} 
                      className="h-1.5 w-20" 
                    />
                    <span className="text-xs text-slate-500">
                      {Math.round(movementConfidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isMoving ? 'bg-green-100' : 'bg-slate-100'}`}>
                      {isMoving ? (
                        <Zap className="h-4 w-4 text-green-600 animate-pulse" />
                      ) : (
                        <ZapOff className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isMoving ? 'Movement detected' : 'No movement detected'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Trip Status */}
            {currentTripId ? (
              <Alert className="bg-blue-50 border-blue-200">
                <Database className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700 flex items-center gap-2">
                  Trip in Progress
                  <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-800 ml-2">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDuration(tripDuration || 0)}
                  </Badge>
                </AlertTitle>
                <AlertDescription className="text-blue-600">
                  Trip data is being recorded{isOnline ? ' and synced in real-time' : ' locally'}.
                  {tripStartTime && (
                    <div className="mt-1 text-xs">
                      Started at {new Date(tripStartTime).toLocaleTimeString()}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-slate-50 border-slate-200">
                <Smartphone className="h-4 w-4 text-slate-600" />
                <AlertTitle className="text-slate-700">Monitoring Movement</AlertTitle>
                <AlertDescription className="text-slate-600">
                  Waiting to detect significant vehicle movement to start recording a trip.
                </AlertDescription>
              </Alert>
            )}

            {/* Connectivity Status */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isOnline ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {isOnline ? (
                    <Wifi className="h-5 w-5 text-green-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isOnline ? 'text-green-700' : 'text-amber-700'}`}>
                    {isOnline ? 'Online - Data syncing in real-time' : 'Offline - Data stored locally'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {pendingSyncCount > 0 
                      ? `${pendingSyncCount} trip${pendingSyncCount > 1 ? 's' : ''} pending sync` 
                      : 'All data synced'}
                  </p>
                </div>
              </div>
              {pendingSyncCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={syncTrips}
                  disabled={!isOnline}
                  className="text-xs"
                >
                  Sync Now
                </Button>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="sensors" className="space-y-4 mt-0">
            {/* Sensor Status Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="h-4 w-4 text-slate-600" />
                  <p className="text-xs font-medium text-slate-700">Motion Sensors</p>
                </div>
                <Badge variant={motionSupported ? "outline" : "destructive"} className="mt-1">
                  {motionSupported === null ? 'Checking...' : motionSupported ? 'Available' : 'Not Available'}
                </Badge>
                {motionSupported && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Sensitivity</span>
                      <span>{Math.round(motionConfidence * 100)}%</span>
                    </div>
                    <Progress value={motionConfidence * 100} className="h-1.5 mt-1" />
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-slate-600" />
                  <p className="text-xs font-medium text-slate-700">GPS Location</p>
                </div>
                <Badge variant={hasLocation ? "outline" : "secondary"} className="mt-1">
                  {hasLocation ? 'Available' : 'Not Available'}
                </Badge>
                {hasLocation && (
                  <p className="text-xs text-slate-500 mt-2">
                    Location tracking active
                  </p>
                )}
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  {getBatteryIcon()}
                  <p className="text-xs font-medium text-slate-700">Battery Status</p>
                </div>
                {batteryLevel !== undefined ? (
                  <>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Level</span>
                      <span>{Math.round(batteryLevel * 100)}%</span>
                    </div>
                    <Progress 
                      value={batteryLevel * 100} 
                      className={`h-1.5 mt-1 ${
                        batteryLevel > 0.7 ? 'bg-green-600' : 
                        batteryLevel > 0.3 ? 'bg-amber-600' : 'bg-red-600'
                      }`} 
                    />
                  </>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    Battery info not available
                  </p>
                )}
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart4 className="h-4 w-4 text-slate-600" />
                  <p className="text-xs font-medium text-slate-700">Movement Analysis</p>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Accuracy</span>
                  <span>{Math.round(movementConfidence * 100)}%</span>
                </div>
                <Progress 
                  value={movementConfidence * 100} 
                  className="h-1.5 mt-1" 
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="data" className="space-y-4 mt-0">
            {/* Storage Status */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <MemoryStick className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-medium text-slate-700">Local Storage Usage</p>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Used Space</span>
                <span>{Math.round(storageUsage)}%</span>
              </div>
              <Progress 
                value={storageUsage} 
                className={`h-2 mt-1 ${
                  storageUsage > 80 ? 'bg-red-600' : 
                  storageUsage > 50 ? 'bg-amber-600' : 'bg-green-600'
                }`} 
              />
              <p className="text-xs text-slate-500 mt-2">
                {pendingSyncCount > 0 
                  ? `${pendingSyncCount} trip${pendingSyncCount > 1 ? 's' : ''} stored locally` 
                  : 'No trips stored locally'}
              </p>
            </div>
            
            {/* Sync Status */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-600" />
                  <p className="text-sm font-medium text-slate-700">Data Synchronization</p>
                </div>
                <Badge variant={isOnline ? "outline" : "secondary"} className="text-xs">
                  {isOnline ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              
              {pendingSyncCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-700">
                    {pendingSyncCount} trip{pendingSyncCount > 1 ? 's' : ''} waiting to be synchronized
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={syncTrips}
                    disabled={!isOnline}
                    className="w-full text-xs"
                  >
                    {isOnline ? 'Synchronize Now' : 'Connect to Sync'}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-green-700">
                  All trip data is synchronized
                </p>
              )}
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500">
        {currentTripId ? (
          <div className="w-full flex justify-between items-center">
            <span>Trip ID: {currentTripId.substring(0, 8)}...</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(tripDuration || 0)}
            </Badge>
          </div>
        ) : (
          <span>Monitoring active - Waiting for vehicle movement</span>
        )}
      </CardFooter>
    </Card>
  );
}