import { useEffect, useState, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { MapPin, Navigation, Flag, Clock, Car, Info } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// We'll initialize mapboxgl only on the client side
let mapboxgl: any = null;
if (typeof window !== 'undefined') {
  try {
    // Dynamic import to ensure it only runs on client
    mapboxgl = require('mapbox-gl');
    
    // Set mapbox token from env variable
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    mapboxgl.accessToken = token;
    
    if (!token) {
      console.error('Mapbox token is not set in environment variables');
    }
  } catch (error) {
    console.error('Error initializing mapbox-gl:', error);
  }
}

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  duration?: number; // Duration in seconds at this point (for stop detection)
}

interface TripRouteMapProps {
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number | null;
  endLongitude?: number | null;
  routePoints?: RoutePoint[] | null;
  className?: string;
  height?: string;
  darkMode?: boolean;
}

export default function TripRouteMap({ 
  startLatitude, 
  startLongitude, 
  endLatitude, 
  endLongitude,
  routePoints,
  className = '',
  height = '400px', // Increased default height for better visibility
  darkMode = true
}: TripRouteMapProps) {
  const { t } = useTranslation();
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapboxgl || !mapboxgl.accessToken) {
      console.error('Mapbox token is not set');
      return;
    }

    if (!mapContainer.current) return;

    // Create map instance with appropriate style based on dark mode
    const mapStyle = darkMode 
      ? 'mapbox://styles/mapbox/dark-v11' 
      : 'mapbox://styles/mapbox/streets-v11';

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [startLongitude, startLatitude],
      zoom: 13,
      attributionControl: false,
      interactive: true // Allow zooming and panning
    });

    // Store reference to map instance
    mapInstanceRef.current = mapInstance;

    // Wait for map to load before setting state and adding controls
    mapInstance.on('load', () => {
      // Add navigation control
      const navControl = new mapboxgl.NavigationControl({
        showCompass: true,
        visualizePitch: true
      });
      mapInstance.addControl(navControl, 'top-right');

      // Add scale control
      const scaleControl = new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
      });
      mapInstance.addControl(scaleControl, 'bottom-left');

      // Add attribution control in bottom-right
      mapInstance.addControl(new mapboxgl.AttributionControl(), 'bottom-right');

      // Set map state only after it's fully loaded
      setMap(mapInstance);
      setMapLoaded(true);
    });

    // Clean up on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [startLatitude, startLongitude, darkMode]); // Recreate map if start coordinates or dark mode changes

  // Add markers and route line when map is ready and loaded
  useEffect(() => {
    if (!map || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Create bounds to fit all points
    const bounds = new mapboxgl.LngLatBounds();
    
    // Function to create enhanced popup content
    const createEnhancedPopup = (title: string, timestamp: string, coordinates: [number, number], additionalInfo: Record<string, any> = {}) => {
      const popupContent = document.createElement('div');
      popupContent.className = 'enhanced-popup';
      
      // Prevent click events from propagating to parent elements
      popupContent.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      // Create card-like container
      const card = document.createElement('div');
      card.className = 'bg-background rounded-md shadow-md overflow-hidden max-w-[300px]';
      
      // Header
      const header = document.createElement('div');
      header.className = 'bg-primary/10 p-3 border-b';
      
      const titleRow = document.createElement('div');
      titleRow.className = 'flex items-center gap-2';
      
      const titleText = document.createElement('h3');
      titleText.className = 'font-bold text-sm';
      titleText.textContent = title;
      
      titleRow.appendChild(titleText);
      header.appendChild(titleRow);
      
      const timestampEl = document.createElement('p');
      timestampEl.className = 'text-xs text-muted-foreground mt-1';
      timestampEl.textContent = new Date(timestamp).toLocaleString();
      header.appendChild(timestampEl);
      
      // Content
      const content = document.createElement('div');
      content.className = 'p-3';
      
      // Coordinates
      const coordSection = document.createElement('div');
      coordSection.className = 'mb-2';
      
      const coordTitle = document.createElement('p');
      coordTitle.className = 'text-xs font-medium mb-1';
      coordTitle.textContent = 'Location';
      coordSection.appendChild(coordTitle);
      
      const coordValue = document.createElement('div');
      coordValue.className = 'bg-accent/50 p-2 rounded-md text-xs';
      coordValue.textContent = `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`;
      coordSection.appendChild(coordValue);
      
      content.appendChild(coordSection);
      
      // Additional info
      if (Object.keys(additionalInfo).length > 0) {
        const additionalSection = document.createElement('div');
        additionalSection.className = 'border-t pt-2 mt-2';
        
        const additionalTitle = document.createElement('p');
        additionalTitle.className = 'text-xs font-medium mb-1';
        additionalTitle.textContent = 'Details';
        additionalSection.appendChild(additionalTitle);
        
        const infoGrid = document.createElement('div');
        infoGrid.className = 'grid grid-cols-2 gap-2';
        
        Object.entries(additionalInfo).forEach(([key, value]) => {
          const infoItem = document.createElement('div');
          infoItem.className = 'bg-accent/50 p-2 rounded-md';
          
          const infoLabel = document.createElement('p');
          infoLabel.className = 'text-xs text-muted-foreground';
          infoLabel.textContent = key;
          infoItem.appendChild(infoLabel);
          
          const infoValue = document.createElement('p');
          infoValue.className = 'text-xs font-medium';
          infoValue.textContent = String(value);
          infoItem.appendChild(infoValue);
          
          infoGrid.appendChild(infoItem);
        });
        
        additionalSection.appendChild(infoGrid);
        content.appendChild(additionalSection);
      }
      
      card.appendChild(header);
      card.appendChild(content);
      popupContent.appendChild(card);
      
      return popupContent;
    };

    // Add start marker with custom element
    const startEl = document.createElement('div');
    startEl.className = 'start-marker flex items-center justify-center';
    startEl.style.width = '36px';
    startEl.style.height = '36px';
    startEl.style.borderRadius = '50%';
    startEl.style.backgroundColor = '#22c55e'; // Green
    startEl.style.border = '3px solid white';
    startEl.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
    
    // Add flag icon to start marker
    const flagIcon = document.createElement('div');
    flagIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
    startEl.appendChild(flagIcon);

    // Create enhanced popup for start marker
    const startTimestamp = routePoints?.[0]?.timestamp || new Date().toISOString();
    const startPopup = new mapboxgl.Popup({ 
      offset: 25, 
      maxWidth: '300px',
      closeButton: true,
      closeOnClick: false // Prevent popup from closing when clicking inside it
    });
    
    // Create enhanced popup content
    const startPopupContent = createEnhancedPopup(
      t('trip_start'),
      startTimestamp,
      [startLatitude, startLongitude],
      {
        'Type': 'Starting Point',
        'Time': new Date(startTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }
    );
    
    startPopup.setDOMContent(startPopupContent);
    
    const startMarker = new mapboxgl.Marker(startEl)
      .setLngLat([startLongitude, startLatitude])
      .setPopup(startPopup)
      .addTo(map);
      
    // Prevent click events from propagating to parent elements
    startEl.addEventListener('click', (e) => {
      e.stopPropagation();
      // Explicitly open the popup when marker is clicked
      startMarker.togglePopup();
    });
    
    markersRef.current.push(startMarker);
    bounds.extend([startLongitude, startLatitude]);

    // Add end marker if available
    if (endLatitude && endLongitude) {
      const endEl = document.createElement('div');
      endEl.className = 'end-marker flex items-center justify-center';
      endEl.style.width = '36px';
      endEl.style.height = '36px';
      endEl.style.borderRadius = '50%';
      endEl.style.backgroundColor = '#ef4444'; // Red
      endEl.style.border = '3px solid white';
      endEl.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
      
      // Add destination icon to end marker
      const destinationIcon = document.createElement('div');
      destinationIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`;
      endEl.appendChild(destinationIcon);

      const lastTimestamp = routePoints && routePoints.length > 0 
        ? routePoints[routePoints.length - 1].timestamp 
        : new Date().toISOString();
      
      // Create enhanced popup for end marker
      const endPopup = new mapboxgl.Popup({ 
        offset: 25, 
        maxWidth: '300px',
        closeButton: true,
        closeOnClick: false // Prevent popup from closing when clicking inside it
      });
      
      // Calculate trip duration in minutes
      const tripDurationMins = routePoints && routePoints.length > 0 
        ? Math.round((new Date(lastTimestamp).getTime() - new Date(routePoints[0].timestamp).getTime()) / 60000)
        : 0;
      
      // Create enhanced popup content with trip summary
      const endPopupContent = createEnhancedPopup(
        t('trip_end'),
        lastTimestamp,
        [endLatitude, endLongitude],
        {
          'Type': 'Destination Point',
          'Time': new Date(lastTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          'Duration': `${tripDurationMins} min`,
          'Points': routePoints ? routePoints.length : 0
        }
      );
      
      endPopup.setDOMContent(endPopupContent);
      
      const endMarker = new mapboxgl.Marker(endEl)
        .setLngLat([endLongitude, endLatitude])
        .setPopup(endPopup)
        .addTo(map);
      
      // Prevent click events from propagating to parent elements
      endEl.addEventListener('click', (e) => {
        e.stopPropagation();
        // Explicitly open the popup when marker is clicked
        endMarker.togglePopup();
      });
      
      markersRef.current.push(endMarker);
      bounds.extend([endLongitude, endLatitude]);
    }

    // Process route points to identify stops (points where driver stayed for more than 10 minutes)
    const stopPoints: RoutePoint[] = [];
    if (routePoints && routePoints.length > 0) {
      // Find points where duration exceeds 10 minutes (600 seconds)
      routePoints.forEach(point => {
        if (point.duration && point.duration >= 600) {
          stopPoints.push(point);
        }
      });

      // Add stop markers
      stopPoints.forEach((point, index) => {
        const stopEl = document.createElement('div');
        stopEl.className = 'stop-marker flex items-center justify-center';
        stopEl.style.width = '30px';
        stopEl.style.height = '30px';
        stopEl.style.borderRadius = '50%';
        stopEl.style.backgroundColor = '#f59e0b'; // Amber
        stopEl.style.border = '3px solid white';
        stopEl.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
        
        // Add clock icon to stop marker
        const clockIcon = document.createElement('div');
        clockIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        stopEl.appendChild(clockIcon);

        // Calculate stop duration in minutes
        const stopDurationMins = point.duration ? Math.floor(point.duration / 60) : 0;
        
        // Determine stop reason based on duration
        const stopReason = stopDurationMins > 30 
          ? 'Extended Break' 
          : stopDurationMins > 15 
            ? 'Short Break' 
            : 'Traffic/Brief Stop';
        
        // Create enhanced popup for stop marker
        const stopPopup = new mapboxgl.Popup({ 
          offset: 25, 
          maxWidth: '300px',
          closeButton: true,
          closeOnClick: false // Prevent popup from closing when clicking inside it
        });
        
        // Create enhanced popup content
        const stopPopupContent = createEnhancedPopup(
          `${t('stop_point')} #${index + 1}`,
          point.timestamp,
          [point.latitude, point.longitude],
          {
            'Duration': `${stopDurationMins} ${t('minutes')}`,
            'Reason': stopReason,
            'Time': new Date(point.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            'Status': stopDurationMins > 15 ? 'Significant Stop' : 'Brief Stop'
          }
        );
        
        stopPopup.setDOMContent(stopPopupContent);
        
        const stopMarker = new mapboxgl.Marker(stopEl)
          .setLngLat([point.longitude, point.latitude])
          .setPopup(stopPopup)
          .addTo(map);
        
        // Prevent click events from propagating to parent elements
        stopEl.addEventListener('click', (e) => {
          e.stopPropagation();
          // Explicitly open the popup when marker is clicked
          stopMarker.togglePopup();
        });
        
        markersRef.current.push(stopMarker);
        bounds.extend([point.longitude, point.latitude]);
      });

      // Create a GeoJSON object with the route line
      const routeGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routePoints.map(point => [point.longitude, point.latitude])
        }
      };

      // Add all route points to bounds
      routePoints.forEach(point => {
        bounds.extend([point.longitude, point.latitude]);
      });

      try {
        // Remove existing route source and layer if they exist
        if (map.getLayer('route-arrows')) {
          map.removeLayer('route-arrows');
        }
        if (map.getLayer('route')) {
          map.removeLayer('route');
        }
        if (map.getSource('route')) {
          map.removeSource('route');
        }

        // Add the route source and layer
        map.addSource('route', {
          type: 'geojson',
          data: routeGeoJSON as any,
          lineMetrics: true // Enable line metrics for gradient
        });

        // Add route glow effect (wider line underneath for glow effect)
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-width': 8,
            'line-opacity': 0.4,
            'line-blur': 3,
            'line-color-transition': { duration: 0 },
            'line-gradient': [
              'interpolate',
              ['linear'],
              ['line-progress'],
              0, '#22c55e', // Start with green
              0.5, '#3b82f6', // Middle with blue
              1, '#ef4444'  // End with red
            ]
          }
        });

        // Add main route line with gradient styling
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-width': 5,
            'line-opacity': 0.9,
            'line-color-transition': { duration: 0 },
            'line-gradient': [
              'interpolate',
              ['linear'],
              ['line-progress'],
              0, '#22c55e', // Start with green
              0.5, '#3b82f6', // Middle with blue
              1, '#ef4444'  // End with red
            ]
          }
        });

        // Add route direction arrows
        map.addLayer({
          id: 'route-arrows',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 100,
            'text-field': '→',
            'text-font': ['Open Sans Regular'],
            'text-size': 16,
            'text-offset': [0, 0],
            'text-anchor': 'center'
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#3b82f6',
            'text-halo-width': 1
          }
        });
      } catch (error) {
        console.error('Error adding route to map:', error);
      }
    }

    // Fit map to bounds with padding
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 60,
        maxZoom: 15
      });
    }

    // Clean up function to remove layers and sources when component updates
    return () => {
      if (map) {
        try {
          if (map.getLayer('route-arrows')) {
            map.removeLayer('route-arrows');
          }
          if (map.getLayer('route')) {
            map.removeLayer('route');
          }
          if (map.getLayer('route-glow')) {
            map.removeLayer('route-glow');
          }
          if (map.getSource('route')) {
            map.removeSource('route');
          }
          
          // Clear all markers
          markersRef.current.forEach(marker => marker.remove());
          markersRef.current = [];
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
    };
  }, [map, mapLoaded, startLatitude, startLongitude, endLatitude, endLongitude, routePoints, t]);

  // Stop propagation of click events on the map container
  const handleMapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className={`relative rounded-lg overflow-hidden border border-slate-700 shadow-lg ${className}`} 
      style={{ height }}
      onClick={handleMapClick}
    >
      <div ref={mapContainer} className="w-full h-full">
        {!mapboxgl?.accessToken && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-300 text-sm">
            Map token not configured
          </div>
        )}
      </div>
      {!mapLoaded && mapboxgl?.accessToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 text-slate-300 text-sm">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            <span>Loading map...</span>
          </div>
        </div>
      )}
      
      {/* Map legend */}
      {mapLoaded && (
        <div 
          className="absolute bottom-2 left-2 bg-slate-800/80 text-white text-xs p-2 rounded-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span>{t('trip_start')}</span>
          </div>
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span>{t('trip_end')}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
            <span>{t('stop_point')} ({'>'}10 {t('minutes')})</span>
          </div>
        </div>
      )}
    </div>
  );
}