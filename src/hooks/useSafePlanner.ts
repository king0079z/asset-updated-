import { useState, useEffect } from 'react';
import { useIsIFrame } from './useIsIFrame';

// This hook is a safe alternative to useGeolocation for the planner page
// It doesn't attempt to access geolocation APIs that might be restricted
export const useSafePlanner = () => {
  const [isReady, setIsReady] = useState(false);
  const { isIframe } = useIsIFrame();
  
  useEffect(() => {
    // Simply mark as ready after component mounts
    // No geolocation access attempted
    setIsReady(true);
    
    // Log if we're in an iframe for debugging
    if (isIframe) {
      console.log('Planner is running in an iframe - geolocation access may be restricted');
    }
  }, [isIframe]);
  
  return { isReady, isIframe };
};