import React, { useEffect, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';

interface AssetLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationSource: string;
  locationAccuracyDescription: string;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const AssetLocationMap: React.FC<AssetLocationMapProps> = ({
  latitude,
  longitude,
  accuracy,
  locationSource,
  locationAccuracyDescription,
  isLoading,
  isRefreshing,
  onRefresh
}) => {
  const { t } = useTranslation();
  const [mapUrl, setMapUrl] = useState<string>('');
  const [showMap, setShowMap] = useState<boolean>(false);

  // Generate map URL when coordinates change
  useEffect(() => {
    if (latitude && longitude) {
      // Use Mapbox static map if token is available
      if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
        const zoom = getZoomLevelFromAccuracy(accuracy);
        const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/pin-s+f00(${longitude},${latitude})/${longitude},${latitude},${zoom},0/400x200@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
        setMapUrl(mapboxUrl);
      } else {
        // Fallback to OpenStreetMap
        const zoom = getZoomLevelFromAccuracy(accuracy);
        const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-0.01},${latitude-0.01},${longitude+0.01},${latitude+0.01}&layer=mapnik&marker=${latitude},${longitude}`;
        setMapUrl(osmUrl);
      }
      setShowMap(true);
    } else {
      setShowMap(false);
    }
  }, [latitude, longitude, accuracy]);

  // Helper function to determine appropriate zoom level based on accuracy
  const getZoomLevelFromAccuracy = (accuracy: number | null): number => {
    if (!accuracy) return 14; // Default zoom level
    
    if (accuracy < 10) return 18; // Very high accuracy
    if (accuracy < 50) return 17; // High accuracy
    if (accuracy < 100) return 16; // Good accuracy
    if (accuracy < 500) return 15; // Medium accuracy
    if (accuracy < 1000) return 14; // Low accuracy
    if (accuracy < 5000) return 12; // Very low accuracy
    return 10; // Extremely low accuracy
  };

  // Get status color based on location source and accuracy
  const getStatusColor = (): string => {
    if (isLoading || isRefreshing) return 'bg-yellow-500 animate-pulse';
    if (!latitude || !longitude) return 'bg-red-500';
    
    if (locationSource === 'gps') {
      if (accuracy && accuracy < 50) return 'bg-green-500';
      if (accuracy && accuracy < 100) return 'bg-green-400';
      return 'bg-green-300';
    }
    
    if (locationSource === 'wifi') return 'bg-blue-500';
    if (locationSource === 'cell') return 'bg-blue-400';
    if (locationSource === 'fusion') return 'bg-purple-500';
    if (locationSource === 'last_gps') return 'bg-yellow-500';
    
    return 'bg-orange-500'; // IP or other sources
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-yellow-600 font-medium">{t("detecting_location")}</span>
            </div>
          ) : latitude && longitude ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
                <span className="font-medium">{locationAccuracyDescription}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-red-600 font-medium">{t("location_not_available")}</span>
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">{t("refresh_location")}</span>
        </Button>
      </div>
      
      {showMap && (
        <div className="relative h-[200px] w-full overflow-hidden rounded-md border">
          {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
            // Static Mapbox image
            <img 
              src={mapUrl} 
              alt="Asset location map" 
              className="w-full h-full object-cover"
            />
          ) : (
            // OpenStreetMap iframe fallback
            <iframe
              title="Asset location map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={mapUrl}
            />
          )}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <MapPin className="h-8 w-8 text-red-500 drop-shadow-lg" />
          </div>
          {accuracy && accuracy > 100 && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-1 rounded">
              {t("location_accuracy_warning")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetLocationMap;