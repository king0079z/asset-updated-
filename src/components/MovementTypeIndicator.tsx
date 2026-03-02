import React from 'react';
import { MovementType, MOVEMENT_TYPE_FALLBACK } from '@/hooks/useMovementTypeDetection';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Car, Footprints, User, HelpCircle, AlertTriangle } from 'lucide-react';

interface MovementTypeIndicatorProps {
  showDetails?: boolean;
  movementType?: MovementType | string | null;
  confidence?: number;
  lastUpdated?: Date | null;
  isSupported?: boolean | null;
}

export function MovementTypeIndicator({ 
  showDetails = false,
  movementType,
  confidence = 0,
  lastUpdated = null,
  isSupported = true
}: MovementTypeIndicatorProps) {
  // Safety check for undefined, null, or empty string movement type
  const safeMovementType = movementType && movementType !== '' ? movementType : MovementType.UNKNOWN;
  // Ensure confidence is a valid number
  const safeConfidence = typeof confidence === 'number' && !isNaN(confidence) ? confidence : 0;
  // Get appropriate icon and color based on movement type
  const getTypeDetails = () => {
    // Use string comparison to be more resilient against enum issues
    // Ensure we have a valid string to compare
    const movementTypeString = safeMovementType ? String(safeMovementType).toLowerCase() : 'unknown';
    
    if (movementTypeString === 'vehicle' || movementTypeString === MOVEMENT_TYPE_FALLBACK.VEHICLE) {
      return {
        icon: <Car className="h-4 w-4" />,
        label: 'In Vehicle',
        value: 'vehicle', // Ensure we have a valid value for Select.Item
        color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800',
        description: 'You appear to be in a moving vehicle'
      };
    } else if (movementTypeString === 'walking' || movementTypeString === MOVEMENT_TYPE_FALLBACK.WALKING) {
      return {
        icon: <Footprints className="h-4 w-4" />,
        label: 'Walking',
        value: 'walking', // Ensure we have a valid value for Select.Item
        color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        description: 'You appear to be walking'
      };
    } else if (movementTypeString === 'stationary' || movementTypeString === MOVEMENT_TYPE_FALLBACK.STATIONARY) {
      return {
        icon: <User className="h-4 w-4" />,
        label: 'Stationary',
        value: 'stationary', // Ensure we have a valid value for Select.Item
        color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700',
        description: 'You are not moving'
      };
    } else {
      // Default to unknown - ensure we always have a non-empty string value
      return {
        icon: <HelpCircle className="h-4 w-4" />,
        label: 'Unknown',
        value: 'unknown', // Ensure we have a valid value for Select.Item
        color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800',
        description: 'Analyzing your movement pattern...'
      };
    }
  };

  const { icon, label, color, description } = getTypeDetails();
  const confidencePercent = Math.round(safeConfidence * 100);

  // If not supported, show a message
  if (isSupported === false) {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Movement detection not supported on this device
      </Badge>
    );
  }
  
  // If we have an error state (confidence is 0 and type is unknown), show a warning
  if (safeConfidence === 0 && (safeMovementType === MovementType.UNKNOWN || String(safeMovementType).toLowerCase() === 'unknown')) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Sensor data unavailable
      </Badge>
    );
  }

  // Simple badge version
  if (!showDetails) {
    return (
      <Badge variant="outline" className={color}>
        {icon} {label}
      </Badge>
    );
  }

  // Detailed card version
  return (
    <Card className="p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">{icon}</span> {label}
        </h3>
        <Badge variant="outline" className={color}>
          {confidencePercent}% confidence
        </Badge>
      </div>
      
      <p className="text-sm text-gray-600 mb-2">{description}</p>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Confidence</span>
          <span>{confidencePercent}%</span>
        </div>
        <Progress value={confidencePercent} className="h-2" />
      </div>
      
      {lastUpdated && (
        <p className="text-xs text-gray-500 mt-2">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </Card>
  );
}