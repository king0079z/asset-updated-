// @ts-nocheck
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Utensils,
  Car,
  TicketIcon,
  BrainCircuit,
  Settings,
  Menu,
  MapPin,
  Calendar,
  Users,
  Activity,
  Shield,
  X,
  ChevronUp,
  LogOut,
  Building2
} from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useRTLOptimization } from "@/hooks/useRTLOptimization";
import { useRTLAnimation } from "@/hooks/useRTLAnimation";
import { useRTLComponentFix } from "@/hooks/useRTLComponentFix";
import { usePerformanceOptimization } from "@/hooks/usePerformanceOptimization";
import { memoize } from "@/lib/performance";
import { usePageAccess } from "@/hooks/usePageAccess";
import { optimizeRTLAnimations } from "@/lib/rtl-performance";
import { createRTLAwareGradient, createRTLAwareStyles, getRTLPosition } from "@/lib/rtl-utils";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive: boolean;
  compact?: boolean;
  badge?: number | null;
}

// Memoized NavItem component for better performance
const NavItem = React.memo(({ icon: Icon, label, href, isActive, compact = false, badge = null }: NavItemProps) => {
  const router = useRouter();
  const { dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const { signOut } = useAuth();
  const { setRef: setPerformanceRef } = usePerformanceOptimization(`NavItem-${href}`);
  const { setRef: setRTLRef } = useRTLOptimization(`NavItem-${href}`);
  const { setRef: setRTLAnimationRef } = useRTLAnimation(`NavItem-${href}`);
  const itemRef = useRef<HTMLButtonElement>(null);
  
  // Set the refs for optimization
  useEffect(() => {
    if (itemRef.current) {
      setPerformanceRef(itemRef.current);
      setRTLRef(itemRef.current);
      setRTLAnimationRef(itemRef.current);
    }
  }, [setPerformanceRef, setRTLRef, setRTLAnimationRef]);
  
  // Memoize the navigation handler
  const handleNavigation = useCallback(() => {
    // Add haptic feedback on mobile devices if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10); // Subtle 10ms vibration
    }
    
    // Special case for sign out
    if (href === '#sign-out') {
      signOut && signOut();
      return;
    }
    
    router.push(href);
  }, [router, href, signOut]);
  
  // Memoize the style objects for better performance
  const containerStyle = useMemo(() => {
    // Use RTL-aware gradient for active state
    const baseStyles = {
      // Apply hardware acceleration for smoother rendering
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
      willChange: 'transform, opacity'
    };
    
    // Special styling for sign out button
    if (href === '#sign-out') {
      return {
        ...baseStyles,
        background: isActive 
          ? createRTLAwareGradient('to right', ['#ef4444', '#f87171']) 
          : undefined
      };
    }
    
    if (isActive) {
      return {
        ...baseStyles,
        background: createRTLAwareGradient(
          'to right',
          ['#4f46e5', '#3b82f6']
        )
      };
    }
    
    return baseStyles;
  }, [isActive, href]);
  
  // Create RTL-aware text styles
  const textStyle = useMemo(() => createRTLAwareStyles({
    textRendering: 'optimizeLegibility',
    fontKerning: 'normal',
    direction: 'ltr',
    textAlign: 'center',
    unicodeBidi: 'embed'
  }), []);
  
  // Determine correct positioning for indicators based on RTL
  const indicatorPosition = getRTLPosition('left') === 'left' ? '-left-1' : '-right-1';
  const activeIndicatorPosition = getRTLPosition('right') === 'right' ? '-right-1' : '-left-1';
  
  return (
    <motion.button
      ref={itemRef}
      whileTap={{ scale: 0.9 }}
      className="flex flex-col items-center justify-center"
      onClick={handleNavigation}
      dir={dir}
      aria-label={label}
      role="link"
    >
      <motion.div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          compact ? "w-12 h-12" : "w-14 h-14",
          href === '#sign-out'
            ? isActive 
              ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/30"
              : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : isActive 
              ? "bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/30" 
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        )}
        style={containerStyle}
        whileHover={{ 
          scale: 1.05
        }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 20 
        }}
      >
        <Icon className={cn(compact ? "w-5 h-5" : "w-6 h-6")} />
        {isActive && (
          <motion.div
            className={`absolute -top-1 ${activeIndicatorPosition} w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          />
        )}
        
        {/* Badge indicator */}
        {badge !== null && badge > 0 && (
          <motion.div 
            className={`absolute -top-1 ${indicatorPosition} min-w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-medium px-1 border border-white dark:border-slate-900`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            {badge > 99 ? '99+' : badge}
          </motion.div>
        )}
      </motion.div>
      <span 
        className={cn(
          "mt-1 font-medium truncate max-w-full text-center",
          compact ? "text-[10px]" : "text-xs",
          href === '#sign-out'
            ? "text-red-600 dark:text-red-400"
            : isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"
        )}
        style={textStyle}
      >
        {label}
      </span>
    </motion.button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these props change
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.label === nextProps.label &&
    prevProps.href === nextProps.href &&
    prevProps.compact === nextProps.compact &&
    prevProps.badge === nextProps.badge
  );
});
NavItem.displayName = "NavItem";

export function MobileNavBar() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const [isOpen, setIsOpen] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const navBarRef = useRef<HTMLDivElement>(null);
  const { setRef, isRTL } = useRTLOptimization('mobile-nav');
  const { 
    setRef: setPerformanceRef, 
    registerScrollListener,
    createOptimizedScrollHandler
  } = usePerformanceOptimization('MobileNavBar');
  const { hasAccess, isAdmin, loading } = usePageAccess();
  const { signOut } = useAuth();
  
  // Media queries for responsive design
  const isExtraSmall = useMediaQuery('(max-width: 360px)');
  const isSmall = useMediaQuery('(max-width: 480px)');
  
  // Set the refs for optimization
  useEffect(() => {
    if (navBarRef.current) {
      setRef(navBarRef.current);
      setPerformanceRef(navBarRef.current);
      
      // Apply RTL animation optimizations
      if (isRtl && navBarRef.current) {
        optimizeRTLAnimations(navBarRef.current);
      }
    }
  }, [setRef, setPerformanceRef, navBarRef, isRtl]);
  
  // Memoized scroll handler for better performance
  const handleScroll = useMemo(() => 
    createOptimizedScrollHandler(() => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY <= 10) {
        setIsScrollingUp(true);
      } else {
        setIsScrollingUp(currentScrollY < lastScrollY);
      }
      
      setLastScrollY(currentScrollY);
    }),
  [createOptimizedScrollHandler, lastScrollY]);
  
  // Register optimized scroll listener
  useEffect(() => {
    return registerScrollListener(handleScroll);
  }, [registerScrollListener, handleScroll]);
  
  // Close menu when route changes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsOpen(false);
    };

    router.events.on('routeChangeStart', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router.events]);
  
  // Determine how many items to show based on screen size
  const getVisibleItemCount = () => {
    if (isExtraSmall) return 3;
    if (isSmall) return 4;
    return 5;
  };
  
  // Ensure safe area insets are respected on mobile devices
  const getSafeAreaStyles = useCallback(() => ({
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)'
  }), []);
  
  const navItems = [
    {
      icon: LayoutDashboard,
      label: t("dashboard"),
      href: "/dashboard",
      badge: null
    },
    {
      icon: Package,
      label: t("assets"),
      href: "/assets",
      badge: null
    },
    {
      icon: Utensils,
      label: t("food_supply"),
      href: "/food-supply",
      badge: null
    },
    {
      icon: Building2,
      label: t("kitchens"),
      href: "/kitchens",
      badge: null
    },
    {
      icon: Car,
      label: t("vehicles"),
      href: "/vehicles",
      badge: null
    },
    {
      icon: BrainCircuit,
      label: t("ai_analysis"),
      href: "/ai-analysis",
      badge: null
    },
    {
      icon: Settings,
      label: t("settings"),
      href: "/settings",
      badge: null
    },
    {
      icon: LogOut,
      label: t("sign_out"),
      href: "#sign-out", // Special case for sign out
      badge: null
    },
  ];
  
  // Additional navigation items for the "More" section
  const moreNavItems = [
    {
      icon: MapPin,
      label: t("asset_location"),
      href: "/asset-location",
      badge: null
    },
    {
      icon: Car,
      label: t("my_vehicle"),
      href: "/my-vehicle",
      badge: null
    },
    {
      icon: Car,
      label: t("vehicle_tracking"),
      href: "/vehicle-tracking",
      badge: null
    },
    {
      icon: Calendar,
      label: t("planner"),
      href: "/planner",
      badge: null
    },
    {
      icon: Users,
      label: t("staff_activity"),
      href: "/staff-activity",
      badge: null
    },
    {
      icon: TicketIcon,
      label: t("ticket_dashboard"),
      href: "/tickets/dashboard",
      badge: null
    },
    {
      icon: Car,
      label: t("vehicle_rentals"),
      href: "/vehicles/rentals",
      badge: null
    },
    {
      icon: Activity,
      label: t("movement_analysis"),
      href: "/vehicle-tracking/movement-analysis",
      badge: null
    },
    {
      icon: Shield,
      label: t("compliance"),
      href: "/settings/compliance",
      badge: null
    },
  ];
  
  // Toggle the more menu with haptic feedback
  const toggleMenu = useCallback(() => {
    // Add haptic feedback on mobile devices if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15); // Slightly stronger vibration for menu toggle
    }
    setIsOpen(!isOpen);
  }, [isOpen]);

  // Determine visible items and overflow items
  const visibleItemCount = getVisibleItemCount();
  const visibleItems = navItems.slice(0, visibleItemCount);
  const overflowItems = navItems.slice(visibleItemCount);
  
  // Memoize the style objects for better performance
  const navBarStyle = useMemo(() => ({
    // Ensure the navbar is always fixed to the bottom of the screen
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    // Apply hardware acceleration for smoother rendering
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    // Ensure proper text rendering in RTL mode
    textRendering: isRTL ? 'optimizeLegibility' : undefined,
    fontKerning: isRTL ? 'normal' : undefined,
    // Improve animation performance
    willChange: 'transform, opacity',
    // Fix z-index stacking context
    zIndex: 50
  }), [isRTL]);
  
  // Memoize the expanded menu style for better performance
  const expandedMenuStyle = useMemo(() => ({
    // Apply hardware acceleration for smoother rendering
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    // Ensure proper text rendering in RTL mode
    textRendering: isRTL ? 'optimizeLegibility' : undefined,
    fontKerning: isRTL ? 'normal' : undefined,
    // Ensure proper direction
    direction: isRTL ? 'rtl' : 'ltr',
    // Ensure safe area insets are respected
    ...getSafeAreaStyles(),
    // Improve animation performance
    willChange: 'transform, opacity'
  }), [isRTL, getSafeAreaStyles]);

  // Spring animation configuration for smoother animations
  const springConfig = { type: "spring", stiffness: 400, damping: 30 };

  return (
    <>
      {/* Main navigation bar */}
      <AnimatePresence>
        {/* Always show the navigation bar regardless of scroll direction */}
        <motion.div
          ref={navBarRef}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={springConfig}
          className="fixed bottom-0 left-0 right-0 z-50 w-full lg:hidden"
          style={navBarStyle}
          dir={dir}
          aria-label="Mobile Navigation"
        >
          <div 
            className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-2 py-2 w-full transition-all duration-200" 
            style={getSafeAreaStyles()}
          >
            <div className={cn(
              "flex items-center w-full",
              isRtl ? "flex-row-reverse" : "flex-row", // Fix RTL layout
              isExtraSmall ? "justify-between px-1" : "justify-around px-3"
            )}>
              {/* Only show navigation items when permissions are loaded */}
              {!loading && (
                // Filter items based on access permissions
                visibleItems
                  .filter(item => isAdmin || hasAccess(item.href))
                  .map((item) => (
                    <NavItem
                      key={item.href}
                      icon={item.icon}
                      label={item.label}
                      href={item.href}
                      isActive={router.pathname === item.href || router.pathname.startsWith(`${item.href}/`)}
                      compact={isExtraSmall || isSmall}
                      badge={item.badge}
                    />
                  ))
              )}
              
              {/* Only show the "More" button if there are accessible items in the overflow or moreNavItems */}
              {!loading && (
                (() => {
                  // Check if there are any accessible items in either overflow or moreNavItems
                  const accessibleOverflowItems = overflowItems.filter(item => isAdmin || hasAccess(item.href));
                  const accessibleMoreNavItems = moreNavItems.filter(item => isAdmin || hasAccess(item.href));
                  const hasAccessibleItems = accessibleOverflowItems.length > 0 || accessibleMoreNavItems.length > 0;
                  
                  // Only render the "More" button if there are accessible items
                  return hasAccessibleItems ? (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className="flex flex-col items-center justify-center"
                      onClick={toggleMenu}
                      dir={dir}
                      aria-label={t("more")}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                    >
                      <motion.div
                        className={cn(
                          "relative flex items-center justify-center rounded-full",
                          (isExtraSmall || isSmall) ? "w-12 h-12" : "w-14 h-14",
                          isOpen 
                            ? "bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/30" 
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        )}
                        style={{
                          // Use RTL-aware gradient
                          background: isOpen 
                            ? createRTLAwareGradient('to right', ['#4f46e5', '#3b82f6'])
                            : undefined,
                          // Apply hardware acceleration for smoother rendering
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform, opacity'
                        }}
                        whileHover={{ 
                          scale: 1.05
                        }}
                        animate={isOpen ? { 
                          rotate: 180
                        } : {}}
                        transition={{
                          ...springConfig,
                          // Improve animation performance
                          velocity: 2
                        }}
                      >
                        {isOpen ? <X className={(isExtraSmall || isSmall) ? "w-5 h-5" : "w-6 h-6"} /> : <Menu className={(isExtraSmall || isSmall) ? "w-5 h-5" : "w-6 h-6"} />}
                        {isOpen && (
                          <motion.div
                            className={`absolute -top-1 ${getRTLPosition('right') === 'right' ? '-right-1' : '-left-1'} w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 500, 
                              damping: 15,
                              // Improve animation performance
                              velocity: 2
                            }}
                          />
                        )}
                      </motion.div>
                      <span className={cn(
                        "mt-1 font-medium truncate max-w-full text-center",
                        (isExtraSmall || isSmall) ? "text-[10px]" : "text-xs",
                        isOpen ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"
                      )}
                      style={createRTLAwareStyles({
                        textRendering: 'optimizeLegibility',
                        fontKerning: 'normal',
                        direction: 'ltr',
                        textAlign: 'center',
                        unicodeBidi: 'embed'
                      })}>
                        {t("more")}
                      </span>
                    </motion.button>
                  ) : null;
                })()
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Expanded menu (when "More" is clicked) */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={springConfig}
              className="fixed bottom-24 left-4 right-4 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl p-4 lg:hidden overflow-y-auto max-h-[70vh]"
              style={expandedMenuStyle}
              dir={dir}
              role="dialog"
              aria-modal="true"
              aria-label={t("more_menu")}
            >
              <div className={`absolute top-2 ${isRtl ? 'left-2' : 'right-2'}`}>
                <motion.button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  whileTap={{ scale: 0.9 }}
                  aria-label={t("close")}
                >
                  <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </motion.button>
              </div>
              
              <div className="space-y-6">
                {/* Main menu items section - only show if there are accessible items */}
                {!loading && (() => {
                  const accessibleOverflowItems = overflowItems.filter(item => isAdmin || hasAccess(item.href));
                  
                  return accessibleOverflowItems.length > 0 ? (
                    <div>
                      <h3 className={`text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 px-2 ${isRtl ? 'text-right' : 'text-left'}`}
                        style={createRTLAwareStyles({
                          textRendering: 'optimizeLegibility',
                          fontKerning: 'normal',
                          direction: 'ltr',
                          textAlign: isRtl ? 'right' : 'left',
                          unicodeBidi: 'embed'
                        })}
                      >{t("main_menu")}</h3>
                      <div className={cn(
                        "grid gap-4",
                        isExtraSmall ? "grid-cols-2" : isSmall ? "grid-cols-3" : "grid-cols-4"
                      )}>
                        {accessibleOverflowItems.map((item) => (
                          <NavItem
                            key={item.href}
                            icon={item.icon}
                            label={item.label}
                            href={item.href}
                            isActive={router.pathname === item.href || router.pathname.startsWith(`${item.href}/`)}
                            compact={isExtraSmall || isSmall}
                            badge={item.badge}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                
                {/* Additional pages section - only show if there are accessible items */}
                {!loading && (() => {
                  const accessibleMoreNavItems = moreNavItems.filter(item => isAdmin || hasAccess(item.href));
                  
                  return accessibleMoreNavItems.length > 0 ? (
                    <div>
                      <h3 className={`text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 px-2 ${isRtl ? 'text-right' : 'text-left'}`}
                        style={createRTLAwareStyles({
                          textRendering: 'optimizeLegibility',
                          fontKerning: 'normal',
                          direction: 'ltr',
                          textAlign: isRtl ? 'right' : 'left',
                          unicodeBidi: 'embed'
                        })}
                      >{t("additional_pages")}</h3>
                      <div className={cn(
                        "grid gap-4",
                        isExtraSmall ? "grid-cols-2" : isSmall ? "grid-cols-3" : "grid-cols-4"
                      )}>
                        {accessibleMoreNavItems.map((item) => (
                          <NavItem
                            key={item.href}
                            icon={item.icon}
                            label={item.label}
                            href={item.href}
                            isActive={router.pathname === item.href || router.pathname.startsWith(`${item.href}/`)}
                            compact={isExtraSmall || isSmall}
                            badge={item.badge}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Sign Out Button - Always visible */}
                <div>
                  <h3 className={`text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 px-2 ${isRtl ? 'text-right' : 'text-left'}`}
                    style={createRTLAwareStyles({
                      textRendering: 'optimizeLegibility',
                      fontKerning: 'normal',
                      direction: 'ltr',
                      textAlign: isRtl ? 'right' : 'left',
                      unicodeBidi: 'embed'
                    })}
                  >{t("system")}</h3>
                  <div className="flex justify-center">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className="flex flex-col items-center justify-center"
                      onClick={() => signOut && signOut()}
                      dir={dir}
                      aria-label={t("sign_out")}
                    >
                      <motion.div
                        className={cn(
                          "relative flex items-center justify-center rounded-full",
                          (isExtraSmall || isSmall) ? "w-12 h-12" : "w-14 h-14",
                          "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        )}
                        whileHover={{ 
                          scale: 1.05
                        }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 400, 
                          damping: 20 
                        }}
                      >
                        <LogOut className={(isExtraSmall || isSmall) ? "w-5 h-5" : "w-6 h-6"} />
                      </motion.div>
                      <span 
                        className={cn(
                          "mt-1 font-medium truncate max-w-full text-center",
                          (isExtraSmall || isSmall) ? "text-[10px]" : "text-xs",
                          "text-red-600 dark:text-red-400"
                        )}
                        style={createRTLAwareStyles({
                          textRendering: 'optimizeLegibility',
                          fontKerning: 'normal',
                          direction: 'ltr',
                          textAlign: 'center',
                          unicodeBidi: 'embed'
                        })}
                      >
                        {t("sign_out")}
                      </span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}