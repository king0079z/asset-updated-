import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { 
  isRTL, 
  optimizeRTLText, 
  optimizeRTLLayout, 
  applyRTLOptimizations,
  optimizeRTLPage,
  optimizeRTLAnimations,
  chunkRTLUpdates
} from '@/lib/rtl-performance';

/**
 * Hook to apply RTL optimizations to a component
 * @param pageId Optional identifier for page-specific optimizations
 * @returns Object with RTL-related utilities and state
 */
export function useRTLOptimization(pageId?: string) {
  const { dir } = useTranslation();
  const elementRef = useRef<HTMLElement | null>(null);
  const [isOptimized, setIsOptimized] = useState(false);
  
  // Apply optimizations when the component mounts or direction changes
  useEffect(() => {
    const isRightToLeft = dir === 'rtl';
    
    if (!isRightToLeft) {
      setIsOptimized(false);
      return;
    }
    
    // Apply page-level optimizations if pageId is provided
    if (pageId) {
      optimizeRTLPage(pageId);
    }
    
    // Apply element-level optimizations if ref is set
    if (elementRef.current) {
      applyRTLOptimizations(elementRef.current);
    }
    
    setIsOptimized(true);
    
    // Cleanup function
    return () => {
      setIsOptimized(false);
    };
  }, [dir, pageId]);
  
  // Function to set the element ref
  const setRef = (element: HTMLElement | null) => {
    elementRef.current = element;
    
    // Apply optimizations immediately if element is set and direction is RTL
    if (element && dir === 'rtl') {
      applyRTLOptimizations(element);
      setIsOptimized(true);
    }
  };
  
  return {
    isRTL: dir === 'rtl',
    isOptimized,
    setRef,
    optimizeText: optimizeRTLText,
    optimizeLayout: optimizeRTLLayout,
    applyOptimizations: applyRTLOptimizations,
    elementRef
  };
}

/**
 * Hook to optimize RTL text rendering for a component
 * @returns Ref callback to attach to the component
 */
export function useRTLTextOptimization() {
  const { dir } = useTranslation();
  
  return (element: HTMLElement | null) => {
    if (element && dir === 'rtl') {
      optimizeRTLText(element);
    }
  };
}

/**
 * Hook to optimize RTL layout rendering for a component
 * @returns Ref callback to attach to the component
 */
export function useRTLLayoutOptimization() {
  const { dir } = useTranslation();
  
  return (element: HTMLElement | null) => {
    if (element && dir === 'rtl') {
      optimizeRTLLayout(element);
    }
  };
}

/**
 * Hook to detect if the current layout is RTL
 * @returns Boolean indicating if the current layout is RTL
 */
export function useIsRTL() {
  const { dir } = useTranslation();
  return dir === 'rtl';
}

export default useRTLOptimization;