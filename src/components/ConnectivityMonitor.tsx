import { useEffect, useState } from 'react';
import { useNetworkStatus, useGPSStatus, connectivityManager } from '@/util/connectivity';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, MapPin, AlertTriangle, CheckCircle, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectivityMonitorProps {
  className?: string;
  showDetailed?: boolean;
}

export function ConnectivityMonitor({ className = '', showDetailed = false }: ConnectivityMonitorProps) {
  const { isOnline, pendingUpdates } = useNetworkStatus();
  const { hasGPS, timeSinceLastGPS } = useGPSStatus();
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showGPSAlert, setShowGPSAlert] = useState(false);
  const [syncingData, setSyncingData] = useState(false);

  // Format time since last GPS update
  const formatTimeSince = (ms: number | null): string => {
    if (ms === null) return 'Never';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s ago`;
  };

  // Show alerts when connectivity issues persist
  useEffect(() => {
    let offlineTimer: NodeJS.Timeout;
    let gpsTimer: NodeJS.Timeout;

    // Only show offline alert after 10 seconds of being offline
    if (!isOnline) {
      offlineTimer = setTimeout(() => {
        setShowOfflineAlert(true);
      }, 10000);
    } else {
      setShowOfflineAlert(false);
    }

    // Only show GPS alert after 15 seconds of no GPS
    if (!hasGPS) {
      gpsTimer = setTimeout(() => {
        setShowGPSAlert(true);
      }, 15000);
    } else {
      setShowGPSAlert(false);
    }

    return () => {
      clearTimeout(offlineTimer);
      clearTimeout(gpsTimer);
    };
  }, [isOnline, hasGPS]);

  // Handle manual sync
  const handleManualSync = async () => {
    if (!isOnline || pendingUpdates === 0) return;
    
    setSyncingData(true);
    try {
      await connectivityManager.syncOfflineData();
    } finally {
      setSyncingData(false);
    }
  };

  // If everything is fine and not showing detailed view, return minimal indicator
  if (isOnline && hasGPS && !showDetailed) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1.5 py-1">
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="text-xs">All systems online</span>
        </Badge>
      </div>
    );
  }

  // If showing detailed view or there are issues, show full component
  return (
    <div className={`space-y-3 ${className}`}>
      <AnimatePresence>
        {/* Network Status */}
        {(!isOnline || showDetailed) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Alert variant={isOnline ? "default" : "destructive"} className={isOnline ? "bg-green-50 border-green-200" : ""}>
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              <AlertTitle>{isOnline ? "Connected" : "No Internet Connection"}</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {isOnline ? (
                  <span>Your device is connected to the internet.</span>
                ) : (
                  <span>Your device is currently offline. Location updates will be saved and synced when connection is restored.</span>
                )}
                
                {pendingUpdates > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Pending updates: {pendingUpdates}</span>
                      {isOnline && <span>Ready to sync</span>}
                    </div>
                    <Progress value={isOnline ? 100 : 0} className="h-1.5" />
                    
                    {isOnline && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-2 h-8 text-xs"
                        onClick={handleManualSync}
                        disabled={syncingData}
                      >
                        {syncingData ? (
                          <>
                            <RotateCw className="h-3 w-3 mr-1 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RotateCw className="h-3 w-3 mr-1" />
                            Sync Now
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* GPS Status */}
        {(!hasGPS || showDetailed) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Alert variant={hasGPS ? "default" : "destructive"} className={hasGPS ? "bg-green-50 border-green-200" : ""}>
              {hasGPS ? (
                <MapPin className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>{hasGPS ? "GPS Available" : "GPS Signal Lost"}</AlertTitle>
              <AlertDescription>
                {hasGPS ? (
                  <span>GPS signal is available. Last update: {formatTimeSince(timeSinceLastGPS)}</span>
                ) : (
                  <>
                    <span>Unable to get your location. Please check if:</span>
                    <ul className="list-disc pl-5 mt-1 text-sm">
                      <li>Location services are enabled on your device</li>
                      <li>You've granted location permissions to this app</li>
                      <li>You're not in an area with poor GPS reception</li>
                    </ul>
                  </>
                )}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}