import { useEffect, useState, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Car, AlertTriangle, MapPin, Navigation } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    } else {
      console.log('Mapbox token is configured correctly');
    }
  } catch (error) {
    console.error('Error initializing mapbox-gl:', error);
    // Create a fallback mapboxgl object to prevent crashes
    mapboxgl = {
      Map: function() { return { on: () => {}, remove: () => {} }; },
      NavigationControl: function() { return {}; },
      FullscreenControl: function() { return {}; },
      GeolocateControl: function() { return {}; },
      AttributionControl: function() { return {}; },
      ScaleControl: function() { return {}; },
      Marker: function() { return { setLngLat: () => this, setPopup: () => this, addTo: () => this, remove: () => {}, togglePopup: () => {} }; },
      Popup: function() { return { setHTML: () => this }; },
      LngLatBounds: function() { return { extend: () => {} }; },
      accessToken: ''
    };
  }
}

interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  status: "available" | "maintenance" | "rented";
  location?: {
    lat: number;
    lng: number;
    lastUpdated: string;
  };
}

interface VehicleMapProps {
  vehicles: Vehicle[];
  userLocation?: {
    coords: {
      latitude: number;
      longitude: number;
      accuracy: number;
      altitude: number | null;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  } | null;
  isLoading?: boolean;
  onVehicleSelect?: (vehicleId: string) => void;
  isUsingNetworkLocation?: boolean; // Flag to indicate if we're using IP-based location
}

export default function VehicleMap({ vehicles, userLocation, isLoading = false, onVehicleSelect, isUsingNetworkLocation = false }: VehicleMapProps) {
  console.log('VehicleMap rendering with isUsingNetworkLocation:', isUsingNetworkLocation);
  const { t } = useTranslation();
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [markers, setMarkers] = useState<{ [key: string]: mapboxgl.Marker }>({});
  const mapContainer = useRef<HTMLDivElement>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapboxgl || !mapboxgl.accessToken) {
      console.error('Mapbox token is not set');
      return;
    }

    if (!mapContainer.current) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [0, 0],
      zoom: 2,
      attributionControl: false
    });

    // Store map instance in ref for cleanup
    const mapRef = mapInstance;

    // Wait for map to load before adding controls and setting state
    mapInstance.on('load', () => {
      // Add custom controls with better styling
      const navControl = new mapboxgl.NavigationControl({
        showCompass: true,
        visualizePitch: true
      });
      mapInstance.addControl(navControl, 'top-right');
      
      const fullscreenControl = new mapboxgl.FullscreenControl();
      mapInstance.addControl(fullscreenControl, 'top-right');
      
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      });
      mapInstance.addControl(geolocateControl, 'top-right');

      // Add attribution control in bottom-right
      mapInstance.addControl(new mapboxgl.AttributionControl(), 'bottom-right');

      // Add scale control
      const scale = new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
      });
      mapInstance.addControl(scale, 'bottom-left');

      setMap(mapInstance);
    });

    return () => {
      // Clean up map on unmount
      mapRef.remove();
    };
  }, []);

  // Handle vehicle selection
  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    if (onVehicleSelect) {
      onVehicleSelect(vehicleId);
    }
    
    // Find the vehicle and center the map on it
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle?.location && map) {
      map.flyTo({
        center: [vehicle.location.lng, vehicle.location.lat],
        zoom: 15,
        essential: true
      });
      
      // Open the popup for this vehicle
      const marker = markers[vehicleId];
      if (marker) {
        marker.togglePopup();
      }
    }
  };

  // Update markers when vehicles change
  useEffect(() => {
    if (!map || isLoading) return;
    
    // Log current state for debugging
    console.log('Updating map with:', {
      vehiclesCount: vehicles.length,
      userLocation: userLocation ? `${userLocation.coords.latitude}, ${userLocation.coords.longitude}` : 'none',
      isUsingNetworkLocation: isUsingNetworkLocation
    });

    // Remove old markers
    Object.values(markers).forEach(marker => marker.remove());
    const newMarkers: { [key: string]: mapboxgl.Marker } = {};

    // Add markers for vehicles with location data
    const vehiclesWithLocation = vehicles.filter(v => v.location);
    
    if (vehiclesWithLocation.length > 0) {
      // Create bounds to fit all markers
      const bounds = new mapboxgl.LngLatBounds();
      
      vehiclesWithLocation.forEach(vehicle => {
        if (!vehicle.location) return;
        
        // Create custom marker element with improved styling
        const el = document.createElement('div');
        el.className = 'vehicle-marker';
        el.style.width = '48px';
        el.style.height = '48px';
        el.style.borderRadius = '50%';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.boxShadow = '0 3px 6px rgba(0,0,0,0.3)';
        el.style.border = '3px solid white';
        el.style.cursor = 'pointer';
        el.style.transition = 'all 0.2s ease';
        el.style.position = 'relative'; // For badge positioning
        el.style.zIndex = selectedVehicleId === vehicle.id ? '10' : '1'; // Selected vehicle appears on top
        
        // Set background color based on status with improved colors
        if (vehicle.status === 'available') {
          el.style.backgroundColor = 'rgba(34, 197, 94, 0.95)'; // green
        } else if (vehicle.status === 'maintenance') {
          el.style.backgroundColor = 'rgba(234, 179, 8, 0.95)'; // yellow
        } else {
          el.style.backgroundColor = 'rgba(59, 130, 246, 0.95)'; // blue
        }
        
        // Add car icon with improved styling
        const icon = document.createElement('span');
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
        el.appendChild(icon);
        
        // Add a small badge with the vehicle's initials
        const badge = document.createElement('div');
        badge.style.position = 'absolute';
        badge.style.bottom = '-5px';
        badge.style.right = '-5px';
        badge.style.width = '22px';
        badge.style.height = '22px';
        badge.style.borderRadius = '50%';
        badge.style.backgroundColor = 'white';
        badge.style.color = '#1e293b'; // slate-800
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.fontSize = '10px';
        badge.style.fontWeight = 'bold';
        badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        badge.style.border = '1px solid #e2e8f0'; // slate-200
        
        // Get initials from vehicle name (up to 2 characters)
        const initials = vehicle.name
          .split(' ')
          .map(word => word[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();
        
        badge.textContent = initials;
        el.appendChild(badge);
        
        // Add hover effect without affecting position
        el.addEventListener('mouseenter', () => {
          // Use CSS transform with transform-origin center to prevent position shift
          el.style.transformOrigin = 'center center';
          el.style.transform = 'scale(1.1)';
          // Increase z-index on hover to ensure it appears above other markers
          el.style.zIndex = '20';
        });
        
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          // Reset z-index when not hovered
          el.style.zIndex = selectedVehicleId === vehicle.id ? '10' : '1';
        });
        
        // Add click handler
        el.addEventListener('click', () => {
          handleVehicleSelect(vehicle.id);
        });
        
        // Create popup with enhanced styling and more information
        const popup = new mapboxgl.Popup({ 
          offset: 25,
          closeButton: true,
          closeOnClick: false,
          maxWidth: '320px',
          className: 'vehicle-popup'
        }).setHTML(`
          <div class="p-3">
            <div class="flex items-start justify-between mb-2">
              <div>
                <h3 class="font-medium text-lg">${vehicle.name}</h3>
                <p class="text-sm text-gray-600">${vehicle.licensePlate}</p>
              </div>
              <div class="flex items-center justify-center rounded-full w-8 h-8 ${
                vehicle.status === 'available' ? 'bg-green-100 text-green-600' : 
                vehicle.status === 'maintenance' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
              }">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${vehicle.status === 'available' 
                    ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' // checkmark
                    : vehicle.status === 'maintenance'
                    ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' // alert
                    : '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>' // clock
                  }
                </svg>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 mb-3">
              <div class="bg-gray-50 p-2 rounded">
                <p class="text-xs text-gray-500">${t('status')}</p>
                <p class="text-sm font-medium ${
                  vehicle.status === 'available' ? 'text-green-600' : 
                  vehicle.status === 'maintenance' ? 'text-yellow-600' : 'text-blue-600'
                }">${t(vehicle.status)}</p>
              </div>
              <div class="bg-gray-50 p-2 rounded">
                <p class="text-xs text-gray-500">${t('last_updated')}</p>
                <p class="text-sm font-medium">${new Date(vehicle.location.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            </div>
            
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${new Date(vehicle.location.lastUpdated).toLocaleDateString()}
              </span>
              <span class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${t('view_details')}
              </span>
            </div>
          </div>
        `);
        
        // Create and add marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([vehicle.location.lng, vehicle.location.lat])
          .setPopup(popup)
          .addTo(map);
        
        newMarkers[vehicle.id] = marker;
        
        // Extend bounds to include this marker
        bounds.extend([vehicle.location.lng, vehicle.location.lat]);
      });
      
      // Add user location to bounds if available
      if (userLocation) {
        bounds.extend([userLocation.coords.longitude, userLocation.coords.latitude]);
        
        // Add user marker with pulsing effect
        const userEl = document.createElement('div');
        userEl.className = 'user-marker';
        userEl.style.width = '24px'; // Slightly larger for better visibility
        userEl.style.height = '24px';
        userEl.style.borderRadius = '50%';
        
        // Change the marker style if using network-based location
        if (isUsingNetworkLocation) {
          // Use a different color and border for network-based location
          userEl.style.backgroundColor = '#f97316'; // Orange for network location
          userEl.style.border = '3px dashed white';
          userEl.style.boxShadow = '0 0 0 2px rgb(249 115 22 / 0.5)';
        } else {
          // Standard blue for GPS location
          userEl.style.backgroundColor = '#3b82f6';
          userEl.style.border = '3px solid white';
          userEl.style.boxShadow = '0 0 0 2px rgb(59 130 246 / 0.5)';
        }
        
        userEl.style.animation = 'pulse 1.5s infinite';
        
        // Add pulsing animation
        const style = document.createElement('style');
        style.innerHTML = `
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 ${isUsingNetworkLocation ? 'rgba(249, 115, 22, 0.7)' : 'rgba(59, 130, 246, 0.7)'};
            }
            70% {
              box-shadow: 0 0 0 10px ${isUsingNetworkLocation ? 'rgba(249, 115, 22, 0)' : 'rgba(59, 130, 246, 0)'};
            }
            100% {
              box-shadow: 0 0 0 0 ${isUsingNetworkLocation ? 'rgba(249, 115, 22, 0)' : 'rgba(59, 130, 246, 0)'};
            }
          }
        `;
        document.head.appendChild(style);
        
        // Create a popup with more detailed location information
        const popupContent = isUsingNetworkLocation 
          ? `
            <div class="p-2">
              <p class="text-sm font-medium flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-orange-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                ${t('network_based_location')}
              </p>
              <div class="mt-1 text-xs text-orange-600">
                ${t('network_location_disclaimer') || 'This location is based on your network connection and may not be accurate.'}
              </div>
              <div class="mt-2 text-xs text-gray-500">
                ${t('approximate_accuracy') || 'Approximate accuracy'}: 3-5 km
              </div>
            </div>
          `
          : `
            <div class="p-2">
              <p class="text-sm font-medium flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
                ${t('gps_location')}
              </p>
              <div class="mt-1 text-xs text-gray-500">
                ${t('gps_accuracy') || 'GPS accuracy'}: ${userLocation.coords.accuracy ? `~${Math.round(userLocation.coords.accuracy)}m` : t('unknown')}
              </div>
              <div class="mt-1 text-xs text-blue-600">
                High-precision GPS tracking enabled
              </div>
            </div>
          `;
        
        const userMarker = new mapboxgl.Marker(userEl)
          .setLngLat([userLocation.coords.longitude, userLocation.coords.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(popupContent))
          .addTo(map);
        
        newMarkers['user'] = userMarker;
        
        // Add accuracy circle for both network and GPS location
        try {
          // Determine the appropriate accuracy radius
          let accuracyRadius = isUsingNetworkLocation ? 3000 : (userLocation.coords.accuracy || 50);
          
          // Ensure minimum visibility for very accurate GPS (at least 20 meters)
          if (!isUsingNetworkLocation && accuracyRadius < 20) {
            accuracyRadius = 20;
          }
          
          // Check if the source already exists and remove it if it does
          if (map.getLayer('accuracy-circle')) {
            map.removeLayer('accuracy-circle');
          }
          if (map.getSource('accuracy-circle')) {
            map.removeSource('accuracy-circle');
          }
          
          // Add a source for the accuracy circle
          map.addSource('accuracy-circle', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [userLocation.coords.longitude, userLocation.coords.latitude]
              },
              properties: {}
            }
          });
          
          // Add a circle layer with styling based on location type
          map.addLayer({
            id: 'accuracy-circle',
            type: 'circle',
            source: 'accuracy-circle',
            paint: {
              'circle-radius': {
                stops: [
                  [0, 0],
                  [10, accuracyRadius / 3], // Scale the radius based on zoom level
                  [15, accuracyRadius],
                  [20, accuracyRadius * 1.5] // Maintain visibility at high zoom
                ],
                base: 2
              },
              'circle-color': isUsingNetworkLocation 
                ? 'rgba(249, 115, 22, 0.1)' // Orange for network
                : 'rgba(59, 130, 246, 0.1)', // Blue for GPS
              'circle-stroke-width': 1,
              'circle-stroke-color': isUsingNetworkLocation
                ? 'rgba(249, 115, 22, 0.5)'
                : 'rgba(59, 130, 246, 0.5)'
            }
          });
          
          // For GPS location, add a more precise center point
          if (!isUsingNetworkLocation) {
            // Add a small dot at the exact GPS position
            if (map.getLayer('precise-location-point')) {
              map.removeLayer('precise-location-point');
            }
            if (map.getSource('precise-location-point')) {
              map.removeSource('precise-location-point');
            }
            
            map.addSource('precise-location-point', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [userLocation.coords.longitude, userLocation.coords.latitude]
                },
                properties: {}
              }
            });
            
            map.addLayer({
              id: 'precise-location-point',
              type: 'circle',
              source: 'precise-location-point',
              paint: {
                'circle-radius': 3,
                'circle-color': '#3b82f6',
                'circle-stroke-width': 2,
                'circle-stroke-color': 'white'
              }
            });
          }
        } catch (error) {
          console.error('Error adding accuracy circle:', error);
        }
      }
      
      // Fit map to bounds with padding
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    } else if (userLocation) {
      // If no vehicles with location but user location is available
      map.flyTo({
        center: [userLocation.coords.longitude, userLocation.coords.latitude],
        zoom: 12
      });
      
      // Add user marker
      const userEl = document.createElement('div');
      userEl.className = 'user-marker';
      userEl.style.width = '20px';
      userEl.style.height = '20px';
      userEl.style.borderRadius = '50%';
      userEl.style.backgroundColor = '#3b82f6';
      userEl.style.border = '3px solid white';
      userEl.style.boxShadow = '0 0 0 2px rgb(59 130 246 / 0.5)';
      
      const userMarker = new mapboxgl.Marker(userEl)
        .setLngLat([userLocation.coords.longitude, userLocation.coords.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`<p class="text-sm font-medium">${t('your_location')}</p>`))
        .addTo(map);
      
      newMarkers['user'] = userMarker;
    }
    
    setMarkers(newMarkers);
  }, [map, vehicles, userLocation, isLoading, t, onVehicleSelect]);

  // Create a list of vehicles for quick selection with status indicators
  const vehicleList = vehicles.filter(v => v.location).map(vehicle => (
    <div 
      key={vehicle.id} 
      className={`mb-2 p-2 rounded-md cursor-pointer transition-all ${
        selectedVehicleId === vehicle.id 
          ? 'bg-slate-100 shadow-sm' 
          : 'hover:bg-slate-50'
      }`}
      onClick={() => handleVehicleSelect(vehicle.id)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            vehicle.status === 'available' ? 'bg-green-500' : 
            vehicle.status === 'maintenance' ? 'bg-yellow-500' : 'bg-blue-500'
          }`}></div>
          <span className="font-medium text-sm truncate">{vehicle.name}</span>
        </div>
        <Car className={`h-3.5 w-3.5 ${
          vehicle.status === 'available' ? 'text-green-500' : 
          vehicle.status === 'maintenance' ? 'text-yellow-500' : 'text-blue-500'
        }`} />
      </div>
      <div className="text-xs text-gray-500 pl-4">
        {vehicle.licensePlate}
      </div>
      {vehicle.location && (
        <div className="text-xs text-gray-400 pl-4 mt-1 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          {new Date(vehicle.location.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      )}
    </div>
  ));

  if (!mapboxgl.accessToken) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 rounded-lg p-6">
        <div className="text-center">
          <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Mapbox token missing</h3>
          <p className="text-sm text-gray-500">
            Please set the NEXT_PUBLIC_MAPBOX_TOKEN environment variable.
          </p>
        </div>
      </div>
    );
  }

  // Group vehicles by status for the legend
  const vehiclesByStatus = {
    available: vehicles.filter(v => v.status === 'available' && v.location).length,
    maintenance: vehicles.filter(v => v.status === 'maintenance' && v.location).length,
    rented: vehicles.filter(v => v.status === 'rented' && v.location).length
  };

  return (
    <div className="relative w-full h-full">
      {/* Quick access vehicle list with improved styling */}
      <div className="absolute top-4 left-4 z-10 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-md max-h-[calc(100%-32px)] overflow-y-auto w-56 opacity-95 hover:opacity-100 transition-opacity">
        <div className="mb-3 font-medium text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Car className="h-4 w-4 mr-1.5" />
            {t('vehicles')}
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
            {vehicles.filter(v => v.location).length}
          </span>
        </div>
        
        {/* Status legend */}
        <div className="mb-3 grid grid-cols-3 gap-1 text-xs bg-slate-50 dark:bg-slate-900 rounded-md p-1.5">
          {vehiclesByStatus.available > 0 && (
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></div>
              <span>{vehiclesByStatus.available} {t('available')}</span>
            </div>
          )}
          {vehiclesByStatus.maintenance > 0 && (
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5"></div>
              <span>{vehiclesByStatus.maintenance} {t('maintenance')}</span>
            </div>
          )}
          {vehiclesByStatus.rented > 0 && (
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></div>
              <span>{vehiclesByStatus.rented} {t('rented')}</span>
            </div>
          )}
        </div>
        
        {/* Vehicle list */}
        <div className="space-y-0.5">
          {vehicleList.length > 0 ? (
            vehicleList
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2 opacity-70" />
              <p className="text-xs text-gray-500">{t('no_vehicles_with_location')}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Map controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        {/* View all vehicles button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-white dark:bg-slate-800 shadow-md hover:bg-blue-50 dark:hover:bg-slate-700"
                onClick={() => {
                  if (map && vehicles.filter(v => v.location).length > 0) {
                    // Create bounds to fit all markers
                    const bounds = new mapboxgl.LngLatBounds();
                    vehicles.forEach(vehicle => {
                      if (vehicle.location) {
                        bounds.extend([vehicle.location.lng, vehicle.location.lat]);
                      }
                    });
                    
                    // Add user location to bounds if available
                    if (userLocation) {
                      bounds.extend([userLocation.coords.longitude, userLocation.coords.latitude]);
                    }
                    
                    // Fit map to bounds with padding
                    map.fitBounds(bounds, {
                      padding: 50,
                      maxZoom: 15
                    });
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                  <path d="M3 21V10H8V21M10 21V6H15V21M17 21V3H22V21"></path>
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{t('view_all_vehicles')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* User location button */}
        {userLocation && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="bg-white dark:bg-slate-800 shadow-md hover:bg-blue-50 dark:hover:bg-slate-700"
                  onClick={() => {
                    if (map && userLocation) {
                      map.flyTo({
                        center: [userLocation.coords.longitude, userLocation.coords.latitude],
                        zoom: 15
                      });
                    }
                  }}
                >
                  <Navigation className="h-4 w-4 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{t('go_to_my_location')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white dark:bg-slate-900 bg-opacity-70 dark:bg-opacity-70 flex items-center justify-center z-10">
            <div className="flex flex-col items-center bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('loading_vehicle_data')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}