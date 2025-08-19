import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { optimizeRTLAnimations } from '@/lib/rtl-performance';
import { createRTLAwareStyles } from '@/lib/rtl-utils';

/**
 * Hook to optimize animations for RTL layouts
 * @param elementId Optional identifier for the element
 * @returns Object with RTL animation utilities
 */
export function useRTLAnimation(elementId?: string) {
  const { dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const elementRef = useRef<HTMLElement | null>(null);
  
  /**
   * Returns the appropriate value based on the current text direction
   * @param ltrValue Value to use in left-to-right mode
   * @param rtlValue Value to use in right-to-left mode
   * @returns The appropriate value for the current direction
   */
  const getRTLValue = useCallback(<T,>(ltrValue: T, rtlValue: T): T => {
    return isRtl ? rtlValue : ltrValue;
  }, [isRtl]);
  
  // Apply optimizations when the component mounts or direction changes
  useEffect(() => {
    if (!isRtl || !elementRef.current) return;
    
    // Apply RTL animation optimizations
    optimizeRTLAnimations(elementRef.current);
    
    // Apply additional RTL-specific animation styles
    if (elementRef.current) {
      // Fix animation direction for RTL
      const computedStyle = window.getComputedStyle(elementRef.current);
      const animationName = computedStyle.animationName;
      
      if (animationName && animationName !== 'none') {
        // Add RTL-specific animation class if it exists
        const rtlAnimationClass = `rtl-${animationName}`;
        const hasRtlAnimation = document.querySelector(`.${rtlAnimationClass}`);
        
        if (hasRtlAnimation) {
          elementRef.current.classList.add(rtlAnimationClass);
        } else {
          // Apply reverse animation direction
          elementRef.current.style.animationDirection = 
            computedStyle.animationDirection === 'normal' ? 'reverse' : 
            computedStyle.animationDirection === 'reverse' ? 'normal' : 
            computedStyle.animationDirection === 'alternate' ? 'alternate-reverse' : 
            computedStyle.animationDirection === 'alternate-reverse' ? 'alternate' : 
            computedStyle.animationDirection;
        }
      }
    }
    
    // Log optimization for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RTL Animation] Applied optimizations to ${elementId || 'element'}`);
    }
  }, [dir, elementId, isRtl]);
  
  // Function to set the element ref
  const setRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
    
    // Apply optimizations immediately if element is set and direction is RTL
    if (element && isRtl) {
      optimizeRTLAnimations(element);
    }
  }, [isRtl]);
  
  // Function to get RTL-aware animation styles
  const getRTLAnimationStyles = useCallback((styles: Record<string, any>) => {
    if (!isRtl) return styles;
    
    // Create RTL-aware styles
    const rtlStyles = createRTLAwareStyles(styles);
    
    // Add specific animation optimizations
    if (styles.animation) {
      // Reverse animation direction if needed
      if (styles.animation.includes('normal')) {
        rtlStyles.animation = styles.animation.replace('normal', 'reverse');
      } else if (styles.animation.includes('reverse')) {
        rtlStyles.animation = styles.animation.replace('reverse', 'normal');
      }
    }
    
    return rtlStyles;
  }, [isRtl]);
  
  return {
    isRTL: isRtl,
    setRef,
    elementRef,
    getRTLAnimationStyles,
    getRTLValue
  };
}

export default useRTLAnimation;