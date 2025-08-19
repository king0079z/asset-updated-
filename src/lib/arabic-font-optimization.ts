/**
 * Arabic Font Optimization Utilities
 * 
 * This file contains utilities to optimize Arabic text rendering
 * and font display throughout the application.
 */

/**
 * Gets the appropriate font class based on text type
 * @param type The type of text element
 * @returns CSS class string for the appropriate font
 */
export function getArabicFontClass(type: 'heading' | 'body' | 'button' | 'input' = 'body'): string {
  switch (type) {
    case 'heading':
      return 'font-arabic font-bold';
    case 'button':
      return 'font-arabic font-medium';
    case 'input':
      return 'font-arabic';
    case 'body':
    default:
      return 'font-arabic';
  }
}

/**
 * Optimizes Arabic text for display
 * @param text The text to optimize
 * @returns Optimized text with proper spacing and formatting
 */
export function optimizeArabicText(text: string): string {
  if (!text) return '';
  
  // Replace multiple spaces with a single space
  let optimized = text.replace(/\s+/g, ' ');
  
  // Ensure proper spacing around punctuation
  optimized = optimized
    .replace(/([،؛؟!])\s*/g, '$1 ')  // Add space after Arabic punctuation
    .replace(/\s+([،؛؟!])/g, '$1')   // Remove space before Arabic punctuation
    
  return optimized.trim();
}

/**
 * Determines if text contains Arabic characters
 * @param text The text to check
 * @returns Boolean indicating if text contains Arabic
 */
export function containsArabic(text: string): boolean {
  if (!text) return false;
  
  // Arabic Unicode range
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicPattern.test(text);
}

/**
 * Gets appropriate text direction based on content
 * @param text The text to analyze
 * @returns 'rtl' if text is primarily Arabic, 'ltr' otherwise
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text) return 'ltr';
  
  // Count Arabic characters
  const arabicCount = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  
  // Count Latin characters
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;
  
  // If more Arabic than Latin, use RTL
  return arabicCount > latinCount ? 'rtl' : 'ltr';
}

/**
 * Applies appropriate font styling based on text content
 * @param text The text content
 * @param type The type of text element
 * @returns CSS class string for styling
 */
export function getTextStyling(text: string, type: 'heading' | 'body' | 'button' | 'input' = 'body'): string {
  const hasArabic = containsArabic(text);
  const direction = getTextDirection(text);
  
  let classes = '';
  
  if (hasArabic) {
    classes += getArabicFontClass(type);
    classes += direction === 'rtl' ? ' text-right' : '';
  } else {
    classes += 'font-sans';
    classes += direction === 'rtl' ? ' text-right' : ' text-left';
  }
  
  return classes;
}