/**
 * RTL-specific performance optimizations
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
 * Optimizes RTL text rendering by applying specific styles
 * @param element The DOM element to optimize
 */
export const optimizeRTLText = (element: HTMLElement): void => {
  if (!isRTL()) return;
  
  // Apply optimizations for Arabic text rendering
  element.style.textRendering = 'optimizeLegibility';
  element.style.fontKerning = 'normal';
  element.style.fontVariantLigatures = 'common-ligatures contextual';
  element.style.fontFeatureSettings = '"kern", "liga", "clig", "calt"';
  
  // Ensure proper text direction
  element.style.direction = 'rtl';
  element.style.unicodeBidi = 'embed';
};

/**
 * Optimizes RTL layout rendering by applying hardware acceleration
 * @param element The DOM element to optimize
 */
export const optimizeRTLLayout = (element: HTMLElement): void => {
  if (!isRTL()) return;
  
  // Apply hardware acceleration for smoother RTL layout rendering
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  element.style.willChange = 'transform, opacity';
  
  // Fix RTL layout issues
  element.style.direction = 'rtl';
  
  // Fix RTL positioning issues with flexbox
  if (getComputedStyle(element).display === 'flex') {
    const flexDirection = getComputedStyle(element).flexDirection;
    
    // Reverse flex direction for RTL layout
    if (flexDirection === 'row') {
      element.style.flexDirection = 'row-reverse';
    } else if (flexDirection === 'row-reverse') {
      element.style.flexDirection = 'row';
    }
  }
};

/**
 * Applies RTL-specific optimizations to a DOM element
 * @param element The DOM element to optimize
 */
export const applyRTLOptimizations = (element: HTMLElement): void => {
  if (!isRTL()) return;
  
  optimizeRTLText(element);
  optimizeRTLLayout(element);
  
  // Fix RTL positioning for absolute/fixed elements
  const position = getComputedStyle(element).position;
  if (position === 'absolute' || position === 'fixed') {
    // Swap left/right positioning
    const left = element.style.left;
    const right = element.style.right;
    
    if (left && !right) {
      element.style.right = left;
      element.style.left = 'auto';
    } else if (right && !left) {
      element.style.left = right;
      element.style.right = 'auto';
    }
  }
  
  // Apply to children recursively
  Array.from(element.children).forEach(child => {
    if (child instanceof HTMLElement) {
      applyRTLOptimizations(child);
    }
  });
};

/**
 * Optimizes RTL layout transitions by temporarily disabling transitions
 * @param callback The function to execute during optimization
 */
export const optimizeRTLTransition = (callback: () => void): void => {
  if (!isRTL()) {
    callback();
    return;
  }
  
  // Get all elements with transitions
  const elements = document.querySelectorAll<HTMLElement>('[style*="transition"]');
  const originalTransitions: { element: HTMLElement; transition: string }[] = [];
  
  // Store original transitions and temporarily disable them
  elements.forEach((element) => {
    originalTransitions.push({
      element,
      transition: element.style.transition
    });
    element.style.transition = 'none';
  });
  
  // Force a reflow to apply the transition changes
  document.body.offsetHeight;
  
  // Execute the callback
  callback();
  
  // Force a reflow to ensure changes are applied before re-enabling transitions
  document.body.offsetHeight;
  
  // Restore original transitions
  originalTransitions.forEach(({ element, transition }) => {
    element.style.transition = transition;
  });
};

/**
 * Chunks RTL layout updates to avoid blocking the main thread
 * @param elements Array of elements to update
 * @param updateFn Function to apply to each element
 * @param chunkSize Number of elements to process in each chunk
 */
export const chunkRTLUpdates = (
  elements: HTMLElement[],
  updateFn: (element: HTMLElement) => void,
  chunkSize = 10
): void => {
  if (!isRTL() || elements.length === 0) return;
  
  let index = 0;
  
  const processChunk = () => {
    const endIndex = Math.min(index + chunkSize, elements.length);
    
    for (let i = index; i < endIndex; i++) {
      updateFn(elements[i]);
    }
    
    index = endIndex;
    
    if (index < elements.length) {
      requestAnimationFrame(processChunk);
    }
  };
  
  processChunk();
};

/**
 * Optimizes RTL animations for smoother performance
 * @param element The DOM element to optimize
 */
export const optimizeRTLAnimations = (element: HTMLElement): void => {
  if (!isRTL()) return;
  
  // Apply optimizations for animations in RTL mode
  element.style.willChange = 'transform, opacity';
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  
  // Fix animation direction for RTL
  const animationDirection = getComputedStyle(element).animationDirection;
  if (animationDirection === 'normal') {
    element.style.animationDirection = 'reverse';
  } else if (animationDirection === 'reverse') {
    element.style.animationDirection = 'normal';
  } else if (animationDirection === 'alternate') {
    element.style.animationDirection = 'alternate-reverse';
  } else if (animationDirection === 'alternate-reverse') {
    element.style.animationDirection = 'alternate';
  }
};

/**
 * Optimizes RTL layout for a specific page or component
 * @param pageId Identifier for the page or component
 */
export const optimizeRTLPage = (pageId: string): void => {
  if (!isRTL()) return;
  
  // Apply page-specific optimizations based on the page ID
  switch (pageId) {
    case 'dashboard':
      // Dashboard-specific RTL optimizations
      optimizeRTLDashboard();
      break;
    case 'assets':
      // Assets page-specific RTL optimizations
      optimizeRTLAssetsPage();
      break;
    case 'vehicles':
      // Vehicles page-specific RTL optimizations
      optimizeRTLVehiclesPage();
      break;
    case 'mobile-nav':
      // Mobile navigation specific RTL optimizations
      optimizeRTLMobileNav();
      break;
    default:
      // Default optimizations for all pages
      optimizeRTLGeneral();
      break;
  }
};

/**
 * Mobile navigation specific RTL optimizations
 */
const optimizeRTLMobileNav = (): void => {
  // Find and optimize mobile navigation elements
  const mobileNav = document.querySelector<HTMLElement>('[aria-label="Mobile Navigation"]');
  if (mobileNav) {
    optimizeRTLLayout(mobileNav);
    optimizeRTLAnimations(mobileNav);
    
    // Find and optimize navigation items
    const navItems = mobileNav.querySelectorAll<HTMLElement>('[role="link"]');
    navItems.forEach(item => {
      optimizeRTLText(item);
      optimizeRTLAnimations(item);
      
      // Fix icon alignment in RTL mode
      const icons = item.querySelectorAll('svg');
      icons.forEach(icon => {
        if (icon instanceof HTMLElement) {
          icon.style.marginLeft = '0';
          icon.style.marginRight = '0';
        }
      });
    });
    
    // Find and optimize more menu
    const moreMenu = document.querySelector<HTMLElement>('[aria-label="more_menu"]');
    if (moreMenu) {
      optimizeRTLLayout(moreMenu);
      optimizeRTLAnimations(moreMenu);
    }
    
    // Fix quick actions menu in RTL mode
    const quickActions = document.querySelector<HTMLElement>('[aria-label="Quick Actions"]');
    if (quickActions) {
      optimizeRTLLayout(quickActions);
      optimizeRTLAnimations(quickActions);
      
      // Fix button positioning
      const buttons = quickActions.querySelectorAll('button');
      buttons.forEach(button => {
        if (button instanceof HTMLElement) {
          optimizeRTLText(button);
          optimizeRTLAnimations(button);
        }
      });
    }
  }
};

/**
 * Dashboard-specific RTL optimizations
 */
const optimizeRTLDashboard = (): void => {
  // Find and optimize chart containers
  const chartContainers = document.querySelectorAll<HTMLElement>('.chart-container');
  chartContainers.forEach(optimizeRTLLayout);
  
  // Find and optimize stat cards
  const statCards = document.querySelectorAll<HTMLElement>('.stat-card');
  statCards.forEach(optimizeRTLText);
};

/**
 * Assets page-specific RTL optimizations
 */
const optimizeRTLAssetsPage = (): void => {
  // Find and optimize asset list
  const assetList = document.querySelector<HTMLElement>('.asset-list');
  if (assetList) optimizeRTLLayout(assetList);
  
  // Find and optimize asset cards
  const assetCards = document.querySelectorAll<HTMLElement>('.asset-card');
  chunkRTLUpdates(Array.from(assetCards), (element) => {
    optimizeRTLText(element);
    optimizeRTLLayout(element);
  });
};

/**
 * Vehicles page-specific RTL optimizations
 */
const optimizeRTLVehiclesPage = (): void => {
  // Find and optimize vehicle list
  const vehicleList = document.querySelector<HTMLElement>('.vehicle-list');
  if (vehicleList) optimizeRTLLayout(vehicleList);
  
  // Find and optimize vehicle cards
  const vehicleCards = document.querySelectorAll<HTMLElement>('.vehicle-card');
  chunkRTLUpdates(Array.from(vehicleCards), (element) => {
    optimizeRTLText(element);
    optimizeRTLLayout(element);
  });
  
  // Find and optimize map container
  const mapContainer = document.querySelector<HTMLElement>('.map-container');
  if (mapContainer) optimizeRTLLayout(mapContainer);
};

/**
 * General RTL optimizations for all pages
 */
const optimizeRTLGeneral = (): void => {
  // Find and optimize main content area
  const mainContent = document.querySelector<HTMLElement>('main');
  if (mainContent) optimizeRTLLayout(mainContent);
  
  // Find and optimize all headings
  const headings = document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
  headings.forEach(optimizeRTLText);
  
  // Find and optimize all paragraphs
  const paragraphs = document.querySelectorAll<HTMLElement>('p');
  chunkRTLUpdates(Array.from(paragraphs), optimizeRTLText);
};