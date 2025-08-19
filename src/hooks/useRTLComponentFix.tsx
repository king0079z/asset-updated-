import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { 
  applyRTLComponentFixes,
  fixRTLDropdown,
  fixRTLDialog,
  fixRTLForm,
  fixRTLTable,
  fixRTLCard,
  fixRTLNavigation
} from '@/lib/rtl-component-fixes';

/**
 * Hook to apply RTL fixes to specific UI components
 * @param componentType The type of component to fix ('dropdown', 'dialog', 'form', 'table', 'card', 'navigation', or 'auto')
 * @returns Object with ref and utility functions
 */
export function useRTLComponentFix(componentType: 'dropdown' | 'dialog' | 'form' | 'table' | 'card' | 'navigation' | 'auto' = 'auto') {
  const { dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const elementRef = useRef<HTMLElement | null>(null);
  
  // Apply fixes when the component mounts or direction changes
  useEffect(() => {
    if (!isRtl || !elementRef.current) return;
    
    // Apply component-specific fixes
    switch (componentType) {
      case 'dropdown':
        fixRTLDropdown(elementRef.current);
        break;
      case 'dialog':
        fixRTLDialog(elementRef.current);
        break;
      case 'form':
        fixRTLForm(elementRef.current);
        break;
      case 'table':
        fixRTLTable(elementRef.current);
        break;
      case 'card':
        fixRTLCard(elementRef.current);
        break;
      case 'navigation':
        fixRTLNavigation(elementRef.current);
        break;
      case 'auto':
      default:
        applyRTLComponentFixes(elementRef.current);
        break;
    }
  }, [dir, componentType, isRtl]);
  
  // Function to set the element ref
  const setRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
    
    // Apply fixes immediately if element is set and direction is RTL
    if (element && isRtl) {
      switch (componentType) {
        case 'dropdown':
          fixRTLDropdown(element);
          break;
        case 'dialog':
          fixRTLDialog(element);
          break;
        case 'form':
          fixRTLForm(element);
          break;
        case 'table':
          fixRTLTable(element);
          break;
        case 'card':
          fixRTLCard(element);
          break;
        case 'navigation':
          fixRTLNavigation(element);
          break;
        case 'auto':
        default:
          applyRTLComponentFixes(element);
          break;
      }
    }
  }, [isRtl, componentType]);
  
  // Function to manually apply fixes to an element
  const applyFixes = useCallback((element: HTMLElement) => {
    if (!isRtl || !element) return;
    
    switch (componentType) {
      case 'dropdown':
        fixRTLDropdown(element);
        break;
      case 'dialog':
        fixRTLDialog(element);
        break;
      case 'form':
        fixRTLForm(element);
        break;
      case 'table':
        fixRTLTable(element);
        break;
      case 'card':
        fixRTLCard(element);
        break;
      case 'navigation':
        fixRTLNavigation(element);
        break;
      case 'auto':
      default:
        applyRTLComponentFixes(element);
        break;
    }
  }, [isRtl, componentType]);
  
  return {
    isRTL: isRtl,
    setRef,
    elementRef,
    applyFixes
  };
}

export default useRTLComponentFix;