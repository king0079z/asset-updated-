/**
 * Utility functions for RTL layout and positioning
 */

/**
 * Checks if the current layout is RTL
 * @returns boolean indicating if the current layout is RTL
 */
export const isRTL = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dir === 'rtl';
};

/**
 * Swaps left/right positioning for RTL layouts
 * @param position The original position value (e.g., 'left', 'right')
 * @returns The swapped position for RTL layouts, or the original for LTR
 */
export const getRTLPosition = (position: 'left' | 'right'): 'left' | 'right' => {
  if (!isRTL()) return position;
  return position === 'left' ? 'right' : 'left';
};

/**
 * Gets the correct flex direction for RTL layouts
 * @param direction The original flex direction
 * @returns The adjusted flex direction for RTL layouts, or the original for LTR
 */
export const getRTLFlexDirection = (
  direction: 'row' | 'row-reverse' | 'column' | 'column-reverse'
): 'row' | 'row-reverse' | 'column' | 'column-reverse' => {
  if (!isRTL()) return direction;
  
  switch (direction) {
    case 'row':
      return 'row-reverse';
    case 'row-reverse':
      return 'row';
    default:
      return direction;
  }
};

/**
 * Gets the correct text alignment for RTL layouts
 * @param alignment The original text alignment
 * @returns The adjusted text alignment for RTL layouts, or the original for LTR
 */
export const getRTLTextAlign = (
  alignment: 'left' | 'right' | 'center' | 'justify'
): 'left' | 'right' | 'center' | 'justify' => {
  if (!isRTL()) return alignment;
  
  switch (alignment) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return alignment;
  }
};

/**
 * Gets the correct margin or padding for RTL layouts
 * @param side The original side ('left' or 'right')
 * @param value The margin or padding value
 * @returns An object with the correct RTL-aware margin or padding
 */
export const getRTLSpacing = (
  side: 'left' | 'right',
  value: string | number
): { [key: string]: string | number } => {
  if (!isRTL()) {
    return { [`margin${side.charAt(0).toUpperCase() + side.slice(1)}`]: value };
  }
  
  const rtlSide = side === 'left' ? 'right' : 'left';
  return { [`margin${rtlSide.charAt(0).toUpperCase() + rtlSide.slice(1)}`]: value };
};

/**
 * Gets the correct gradient direction for RTL layouts
 * @param direction The original gradient direction
 * @returns The adjusted gradient direction for RTL layouts, or the original for LTR
 */
export const getRTLGradientDirection = (direction: string): string => {
  if (!isRTL()) return direction;
  
  // Handle common gradient directions
  switch (direction) {
    case 'to right':
      return 'to left';
    case 'to left':
      return 'to right';
    case 'to top right':
      return 'to top left';
    case 'to top left':
      return 'to top right';
    case 'to bottom right':
      return 'to bottom left';
    case 'to bottom left':
      return 'to bottom right';
    default:
      return direction;
  }
};

/**
 * Creates a linear gradient with RTL-aware direction
 * @param direction The original gradient direction
 * @param colors Array of color stops
 * @returns A CSS linear-gradient string with RTL-aware direction
 */
export const createRTLAwareGradient = (direction: string, colors: string[]): string => {
  const rtlDirection = getRTLGradientDirection(direction);
  return `linear-gradient(${rtlDirection}, ${colors.join(', ')})`;
};

/**
 * Gets the correct transform origin for RTL layouts
 * @param origin The original transform origin
 * @returns The adjusted transform origin for RTL layouts, or the original for LTR
 */
export const getRTLTransformOrigin = (origin: string): string => {
  if (!isRTL()) return origin;
  
  // Handle common transform origins
  if (origin.includes('left')) {
    return origin.replace('left', 'right');
  } else if (origin.includes('right')) {
    return origin.replace('right', 'left');
  }
  
  return origin;
};

/**
 * Gets the correct animation direction for RTL layouts
 * @param direction The original animation direction
 * @returns The adjusted animation direction for RTL layouts, or the original for LTR
 */
export const getRTLAnimationDirection = (
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
): 'normal' | 'reverse' | 'alternate' | 'alternate-reverse' => {
  if (!isRTL()) return direction;
  
  switch (direction) {
    case 'normal':
      return 'reverse';
    case 'reverse':
      return 'normal';
    case 'alternate':
      return 'alternate-reverse';
    case 'alternate-reverse':
      return 'alternate';
    default:
      return direction as any;
  }
};

/**
 * Creates RTL-aware styles for an element
 * @param styles The original styles object
 * @returns A new styles object with RTL adjustments
 */
export const createRTLAwareStyles = (styles: Record<string, any>): Record<string, any> => {
  if (!isRTL()) return styles;
  
  const rtlStyles = { ...styles };
  
  // Handle common CSS properties that need RTL adjustments
  if ('left' in styles && !('right' in styles)) {
    rtlStyles.right = styles.left;
    delete rtlStyles.left;
  } else if ('right' in styles && !('left' in styles)) {
    rtlStyles.left = styles.right;
    delete rtlStyles.right;
  }
  
  if ('textAlign' in styles) {
    rtlStyles.textAlign = getRTLTextAlign(styles.textAlign);
  }
  
  if ('flexDirection' in styles) {
    rtlStyles.flexDirection = getRTLFlexDirection(styles.flexDirection);
  }
  
  if ('transformOrigin' in styles) {
    rtlStyles.transformOrigin = getRTLTransformOrigin(styles.transformOrigin);
  }
  
  if ('animationDirection' in styles) {
    rtlStyles.animationDirection = getRTLAnimationDirection(styles.animationDirection);
  }
  
  // Handle margin and padding properties
  if ('marginLeft' in styles && !('marginRight' in styles)) {
    rtlStyles.marginRight = styles.marginLeft;
    delete rtlStyles.marginLeft;
  } else if ('marginRight' in styles && !('marginLeft' in styles)) {
    rtlStyles.marginLeft = styles.marginRight;
    delete rtlStyles.marginRight;
  }
  
  if ('paddingLeft' in styles && !('paddingRight' in styles)) {
    rtlStyles.paddingRight = styles.paddingLeft;
    delete rtlStyles.paddingLeft;
  } else if ('paddingRight' in styles && !('paddingLeft' in styles)) {
    rtlStyles.paddingLeft = styles.paddingRight;
    delete rtlStyles.paddingRight;
  }
  
  // Handle border properties
  if ('borderLeft' in styles && !('borderRight' in styles)) {
    rtlStyles.borderRight = styles.borderLeft;
    delete rtlStyles.borderLeft;
  } else if ('borderRight' in styles && !('borderLeft' in styles)) {
    rtlStyles.borderLeft = styles.borderRight;
    delete rtlStyles.borderRight;
  }
  
  // Add RTL-specific properties
  rtlStyles.direction = 'rtl';
  
  // Optimize Arabic text rendering
  rtlStyles.textRendering = 'optimizeLegibility';
  rtlStyles.fontKerning = 'normal';
  rtlStyles.fontFeatureSettings = '"kern", "liga", "clig", "calt"';
  
  return rtlStyles;
};

export default {
  isRTL,
  getRTLPosition,
  getRTLFlexDirection,
  getRTLTextAlign,
  getRTLSpacing,
  getRTLGradientDirection,
  createRTLAwareGradient,
  getRTLTransformOrigin,
  getRTLAnimationDirection,
  createRTLAwareStyles
};