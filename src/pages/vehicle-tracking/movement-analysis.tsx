import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMovementTypeDetection, MovementType } from "@/hooks/useMovementTypeDetection";
import { MovementTypeIndicator } from "@/components/MovementTypeIndicator";
import { Info, Car, AlertTriangle, PersonStanding, Pause } from "lucide-react";

export default function MovementAnalysisPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Use our movement type detection hook with more frequent updates for analysis
  const movementState = useMovementTypeDetection({
    sampleSize: 30,
    updateInterval: 1000,
  });
  
  // Store movement history for the chart
  const [movementHistory, setMovementHistory] = useState<Array<{
    timestamp: Date;
    type: MovementType;
    confidence: number;
  }>>([]);
  
  // Update history when movement type changes
  useEffect(() => {
    if (movementState.lastUpdated) {
      setMovementHistory(prev => {
        // Keep only the last 60 data points (1 minute with 1s updates)
        const newHistory = [...prev, {
          timestamp: new Date(movementState.lastUpdated as Date),
          type: movementState.type,
          confidence: movementState.confidence
        }];
        
        if (newHistory.length > 60) {
          return newHistory.slice(newHistory.length - 60);
        }
        return newHistory;
      });
    }
  }, [movementState.lastUpdated, movementState.type, movementState.confidence]);
  
  // Calculate statistics
  const getTypePercentage = (type: MovementType) => {
    if (movementHistory.length === 0) return 0;
    const count = movementHistory.filter(h => h.type === type).length;
    return Math.round((count / movementHistory.length) * 100);
  };
  
  const vehiclePercentage = getTypePercentage(MovementType.VEHICLE);
  const walkingPercentage = getTypePercentage(MovementType.WALKING);
  const stationaryPercentage = getTypePercentage(MovementType.STATIONARY);
  
  // Get icon for movement type
  const getTypeIcon = (type: MovementType) => {
    switch (type) {
      case MovementType.VEHICLE:
        return <Car className="h-5 w-5" />;
      case MovementType.WALKING:
        return <PersonStanding className="h-5 w-5" />;
      case MovementType.STATIONARY:
        return <Pause className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('movement_analysis') || 'Movement Analysis'}</h1>
            <p className="text-muted-foreground">
              {t('movement_analysis_description') || 'Analyze and understand your movement patterns'}
            </p>
          </div>

          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="overview">{t('overview') || 'Overview'}</TabsTrigger>
              <TabsTrigger value="details">{t('details') || 'Details'}</TabsTrigger>
              <TabsTrigger value="help">{t('help') || 'Help'}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>{t('current_movement') || 'Current Movement'}</CardTitle>
                    <CardDescription>
                      {t('current_movement_description') || 'Your current detected movement pattern'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MovementTypeIndicator showDetails={true} />
                  </CardContent>
                </Card>
                
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>{t('movement_summary') || 'Movement Summary'}</CardTitle>
                    <CardDescription>
                      {t('last_minute_analysis') || 'Analysis of your movement in the last minute'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {movementHistory.length === 0 ? (
                      <div className="text-center py-6 text-slate-500">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                        <p>{t('collecting_data') || 'Collecting movement data...'}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Car className="h-5 w-5 text-green-600" />
                            <span>{t('in_vehicle') || 'In Vehicle'}</span>
                          </div>
                          <div className="w-1/2 bg-slate-100 rounded-full h-2.5">
                            <div 
                              className="bg-green-600 h-2.5 rounded-full" 
                              style={{ width: `${vehiclePercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{vehiclePercentage}%</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PersonStanding className="h-5 w-5 text-blue-600" />
                            <span>{t('walking') || 'Walking'}</span>
                          </div>
                          <div className="w-1/2 bg-slate-100 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${walkingPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{walkingPercentage}%</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Pause className="h-5 w-5 text-slate-600" />
                            <span>{t('stationary') || 'Stationary'}</span>
                          </div>
                          <div className="w-1/2 bg-slate-100 rounded-full h-2.5">
                            <div 
                              className="bg-slate-600 h-2.5 rounded-full" 
                              style={{ width: `${stationaryPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{stationaryPercentage}%</span>
                        </div>
                        
                        <div className="text-xs text-slate-500 mt-4">
                          {t('data_points') || 'Data points'}: {movementHistory.length}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <Card className="shadow-sm mt-6">
                <CardHeader>
                  <CardTitle>{t('movement_timeline') || 'Movement Timeline'}</CardTitle>
                  <CardDescription>
                    {t('recent_movement_history') || 'Your recent movement history'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {movementHistory.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                      <p>{t('no_movement_data') || 'No movement data available yet'}</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute top-0 bottom-0 left-4 w-0.5 bg-slate-200"></div>
                      <ul className="space-y-4">
                        {movementHistory.slice(-10).reverse().map((entry, index) => (
                          <li key={index} className="ml-6 relative">
                            <span className="absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200">
                              {getTypeIcon(entry.type)}
                            </span>
                            <div className="flex justify-between items-center">
                              <div>
                                <h3 className="text-sm font-medium">
                                  {entry.type === MovementType.VEHICLE && (t('in_vehicle') || 'In Vehicle')}
                                  {entry.type === MovementType.WALKING && (t('walking') || 'Walking')}
                                  {entry.type === MovementType.STATIONARY && (t('stationary') || 'Stationary')}
                                  {entry.type === MovementType.UNKNOWN && (t('unknown') || 'Unknown')}
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {t('confidence') || 'Confidence'}: {Math.round(entry.confidence * 100)}%
                                </p>
                              </div>
                              <time className="text-xs text-slate-500">
                                {entry.timestamp.toLocaleTimeString()}
                              </time>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="details" className="mt-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>{t('how_it_works') || 'How It Works'}</CardTitle>
                  <CardDescription>
                    {t('technical_details') || 'Technical details about movement detection'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    {t('movement_detection_explanation') || 
                      'Our system uses your device\'s motion sensors to analyze movement patterns and determine if you are in a vehicle or walking.'}
                  </p>
                  
                  <h3 className="text-lg font-medium mt-4">{t('detection_factors') || 'Detection Factors'}</h3>
                  
                  <div className="space-y-3">
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium">{t('acceleration_patterns') || 'Acceleration Patterns'}</h4>
                      <p className="text-sm text-slate-600">
                        {t('acceleration_explanation') || 
                          'Vehicles typically produce different acceleration patterns than walking. Vehicle movement has higher magnitude but lower frequency.'}
                      </p>
                    </div>
                    
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium">{t('movement_frequency') || 'Movement Frequency'}</h4>
                      <p className="text-sm text-slate-600">
                        {t('frequency_explanation') || 
                          'Walking produces a rhythmic pattern at around 1.5-2.5 Hz (steps per second), while vehicles have more variable, lower frequency movements.'}
                      </p>
                    </div>
                    
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium">{t('confidence_score') || 'Confidence Score'}</h4>
                      <p className="text-sm text-slate-600">
                        {t('confidence_explanation') || 
                          'Our algorithm calculates a confidence score based on how closely your movement matches known patterns for different transportation modes.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="help" className="mt-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>{t('troubleshooting') || 'Troubleshooting'}</CardTitle>
                  <CardDescription>
                    {t('common_issues') || 'Common issues and how to resolve them'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('detection_not_working') || 'Detection Not Working'}</AlertTitle>
                    <AlertDescription>
                      {t('detection_troubleshooting') || 
                        'Make sure your device has motion sensors and they are enabled. Keep your device in a stable position while in the vehicle.'}
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('incorrect_detection') || 'Incorrect Detection'}</AlertTitle>
                    <AlertDescription>
                      {t('incorrect_detection_explanation') || 
                        'Some activities like riding a bus on a bumpy road might be confused with walking. Try to keep your device in a stable position.'}
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('battery_usage') || 'Battery Usage'}</AlertTitle>
                    <AlertDescription>
                      {t('battery_explanation') || 
                        'Continuous motion detection can increase battery usage. Consider disabling it when not needed.'}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="mt-6">
                    <h3 className="text-lg font-medium">{t('tips_for_accuracy') || 'Tips for Better Accuracy'}</h3>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                      <li>{t('tip_1') || 'Keep your device in a stable position while in the vehicle'}</li>
                      <li>{t('tip_2') || 'Avoid placing the device where it will experience excessive vibration'}</li>
                      <li>{t('tip_3') || 'The detection works best when the device is in your pocket or mounted on a dashboard'}</li>
                      <li>{t('tip_4') || 'Allow a few seconds for the system to detect changes in movement type'}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}