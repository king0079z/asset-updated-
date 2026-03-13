import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MovementTypeIndicator } from '@/components/MovementTypeIndicator';
import { OfflineTripMonitor } from '@/components/OfflineTripMonitor';
import { TripAnalyticsDashboard } from '@/components/TripAnalyticsDashboard';
import { useOfflineTripDetection } from '@/hooks/useOfflineTripDetection';
import { useMovementTypeDetection } from '@/hooks/useMovementTypeDetection';
import {
  Car, 
  AlertTriangle, 
  Info, 
  Smartphone, 
  Zap, 
  Shield, 
  Settings,
  BarChart4,
  Gauge
} from 'lucide-react';

export default function AdvancedMonitoringPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('monitoring');
  const [batteryLevel, setBatteryLevel] = useState<number | undefined>(undefined);
  const [mockTripData, setMockTripData] = useState<any[]>([]);
  
  // Get movement type detection
  const movementDetection = useMovementTypeDetection({
    sampleSize: 30,
    updateInterval: 1000,
    temporalSmoothing: true,
    adaptiveThresholds: true
  });
  
  // Get offline trip detection
  const tripDetection = useOfflineTripDetection({
    vehicleId: 'demo-vehicle-1',
    motionThreshold: 1.2,
    samplingInterval: 1000,
    minStationaryTime: 120000,
    minMovingTime: 30000
  });
  
  // Calculate trip duration
  const [tripDuration, setTripDuration] = useState(0);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (tripDetection.currentTripId) {
      timer = setInterval(() => {
        if (tripDetection.tripStartTime) {
          setTripDuration(Date.now() - tripDetection.tripStartTime);
        }
      }, 1000);
    } else {
      setTripDuration(0);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [tripDetection.currentTripId, tripDetection.tripStartTime]);
  
  // Get battery level
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(battery.level);
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(battery.level);
        });
      });
    }
  }, []);
  
  // Generate mock trip data for demo purposes
  useEffect(() => {
    const generateMockTrips = () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const trips = [];
      
      // Generate 10 mock trips over the past month
      for (let i = 0; i < 10; i++) {
        const startTime = now - (Math.random() * 30 * day);
        const duration = Math.random() * 120 * 60 * 1000; // 0-120 minutes
        const distance = Math.random() * 50 * 1000; // 0-50 km in meters
        
        trips.push({
          id: `trip-${i}`,
          startTime,
          endTime: startTime + duration,
          duration,
          distance,
          averageSpeed: (distance / 1000) / (duration / 3600000),
          maxSpeed: ((distance / 1000) / (duration / 3600000)) * (1 + Math.random()),
          movementBreakdown: {
            vehicle: Math.random() * 0.7 * duration,
            walking: Math.random() * 0.1 * duration,
            stationary: Math.random() * 0.2 * duration,
            unknown: Math.random() * 0.05 * duration
          },
          confidence: 0.6 + Math.random() * 0.4,
          locationAccuracy: 5 + Math.random() * 20,
          batteryDrain: 2 + Math.random() * 10
        });
      }
      
      return trips;
    };
    
    setMockTripData(generateMockTrips());
  }, []);
  
  // Redirect to login if not authenticated
  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Advanced Vehicle Monitoring</h1>
            <p className="text-slate-600 mt-1">
              Intelligent movement detection and trip tracking system
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={() => router.push('/vehicle-tracking/movement-analysis')}
            >
              <BarChart4 className="h-4 w-4" />
              Movement Analysis
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={() => router.push('/settings')}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="monitoring" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Live Monitoring
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart4 className="h-4 w-4" />
              Trip Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="monitoring" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Movement Type Card */}
              <Card className="md:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-blue-600" />
                    Movement Detection
                  </CardTitle>
                  <CardDescription>
                    Real-time movement classification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MovementTypeIndicator showDetails={true} />
                </CardContent>
              </Card>
              
              {/* Trip Monitor Card */}
              <Card className="md:col-span-2">
                <CardContent className="p-0">
                  <OfflineTripMonitor 
                    isMoving={tripDetection.isMoving}
                    isOnline={tripDetection.isOnline}
                    currentTripId={tripDetection.currentTripId}
                    pendingSyncCount={tripDetection.pendingSyncCount}
                    motionConfidence={tripDetection.motionConfidence}
                    motionSupported={tripDetection.motionSupported}
                    hasLocation={tripDetection.hasLocation}
                    syncTrips={tripDetection.syncTrips}
                    movementType={movementDetection.type}
                    movementConfidence={movementDetection.confidence}
                    tripStartTime={tripDetection.tripStartTime}
                    tripDuration={tripDuration}
                    batteryLevel={batteryLevel}
                    detailedView={true}
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* System Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  System Status
                </CardTitle>
                <CardDescription>
                  Current status of all monitoring systems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="h-5 w-5 text-blue-600" />
                      <h3 className="text-sm font-medium">Motion Sensors</h3>
                    </div>
                    <p className={`text-sm ${tripDetection.motionSupported ? 'text-green-600' : 'text-red-600'}`}>
                      {tripDetection.motionSupported ? 'Available and functioning' : 'Not available on this device'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-blue-600" />
                      <h3 className="text-sm font-medium">Movement Detection</h3>
                    </div>
                    <p className="text-sm text-green-600">
                      Active with {Math.round(movementDetection.confidence * 100)}% confidence
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Car className="h-5 w-5 text-blue-600" />
                      <h3 className="text-sm font-medium">Trip Tracking</h3>
                    </div>
                    <p className={`text-sm ${tripDetection.currentTripId ? 'text-green-600' : 'text-blue-600'}`}>
                      {tripDetection.currentTripId ? 'Trip in progress' : 'Ready to detect trips'}
                    </p>
                  </div>
                </div>
                
                {!tripDetection.motionSupported && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Motion sensors not available</AlertTitle>
                    <AlertDescription>
                      This device does not support the motion sensors required for accurate movement detection.
                      Some features may not work as expected.
                    </AlertDescription>
                  </Alert>
                )}
                
                {!tripDetection.hasLocation && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Location services not available</AlertTitle>
                    <AlertDescription>
                      Enable location services for more accurate trip tracking and distance calculation.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-6">
            <TripAnalyticsDashboard 
              trips={mockTripData}
              onViewTripDetails={(tripId) => console.log('View trip details:', tripId)}
            />
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Configure the behavior of the movement detection and trip tracking system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="text-sm font-medium mb-2">Movement Detection Settings</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Configure how the system detects and classifies different types of movement
                    </p>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="text-sm font-medium mb-2">Trip Tracking Settings</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Configure when trips start and end, and how data is collected
                    </p>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="text-sm font-medium mb-2">Data Storage Settings</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Configure how trip data is stored and synced with the server
                    </p>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="text-sm font-medium mb-2">Battery Optimization</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Configure settings to optimize battery usage during trip tracking
                    </p>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Advanced Settings</AlertTitle>
                  <AlertDescription>
                    These settings are for advanced users. Incorrect configuration may affect the accuracy
                    of movement detection and trip tracking.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}