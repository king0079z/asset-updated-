import React, { useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, Package, Brain, Calendar, Shield, ArrowRight, ArrowLeft, Sparkles, BarChart2, Users, Languages, Home, LogIn, User, Utensils, Car } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/contexts/TranslationContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

const Header = () => {
  const { user, initializing, signOut } = useContext(AuthContext);
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const isExtraSmall = useMediaQuery('(max-width: 360px)');
  const isSmall = useMediaQuery('(max-width: 480px)');
  const isMedium = useMediaQuery('(max-width: 640px)');
  const isLandscape = useMediaQuery('(orientation: landscape) and (max-width: 900px)');
  
  // Performance optimization
  const { setRef: setHeaderRef, registerScrollListener } = usePerformanceOptimization('Header');
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Set the ref for performance optimization
  useEffect(() => {
    if (headerRef.current) {
      setHeaderRef(headerRef.current);
    }
  }, [setHeaderRef]);
  
  // Prevent body scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);
  
  // Close mobile menu when route changes
  useEffect(() => {
    const handleRouteChange = () => {
      setMobileMenuOpen(false);
    };
    
    router.events.on('routeChangeStart', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router]);
  
  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (mobileMenuOpen && !target.closest('.mobile-menu-container') && !target.closest('.mobile-menu-button')) {
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);
  
  // Handle smooth scrolling for anchor links
  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Only apply to anchor links that start with # and only on the landing page
    if (href.startsWith('#') && router.pathname === '/') {
      e.preventDefault();
      
      // Get the target element
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      
      // Log for debugging
      console.log(`Trying to scroll to element with id: ${targetId}`);
      
      if (targetElement) {
        console.log(`Found element with id: ${targetId}, scrolling...`);
        // Close mobile menu if open
        setMobileMenuOpen(false);
        
        // Scroll to the element with smooth behavior
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Update URL without page reload
        window.history.pushState({}, '', href);
      } else {
        console.log(`Element with id: ${targetId} not found`);
        
        // Try to find the section by other means (sometimes sections have different IDs)
        // For example, if looking for "features" but the section is named "main-features"
        const sections = document.querySelectorAll('section');
        let found = false;
        
        sections.forEach((section) => {
          // Check if section has an id that contains our target
          if (section.id && section.id.includes(targetId)) {
            console.log(`Found similar section with id: ${section.id}`);
            setMobileMenuOpen(false);
            section.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
            window.history.pushState({}, '', `#${section.id}`);
            found = true;
          }
        });
        
        // If still not found, just scroll to the first matching heading
        if (!found) {
          const headings = document.querySelectorAll('h1, h2, h3');
          headings.forEach((heading) => {
            if (heading.textContent && 
                heading.textContent.toLowerCase().includes(targetId.replace('-', ' '))) {
              console.log(`Found heading containing: ${targetId}`);
              setMobileMenuOpen(false);
              heading.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              });
              found = true;
            }
          });
        }
      }
    } else if (href.startsWith('#') && router.pathname !== '/') {
      // If we're not on the landing page, navigate to the landing page with the hash
      e.preventDefault();
      router.push(`/${href}`);
    }
  }, [router]);

  const handleButtonClick = () => {
    if (user && router.pathname === '/dashboard') {
      signOut();
      router.push('/');
    } else {
      router.push(user ? "/dashboard" : "/login");
    }
  };

  const buttonText = () => {
    if (user && router.pathname === '/dashboard') {
      return t('sign_out');
    }
    return user ? t('dashboard') : t('log_in');
  };

  // Updated navItems to match the actual section IDs in the landing page
  const navItems = [
    { 
      name: t('key_features'), 
      href: "#hero", // Main hero section
      icon: <Sparkles className="w-5 h-5" />,
      submenu: [
        { name: t('asset_management'), href: "#hero", icon: <Package className="w-4 h-4" /> },
        { name: t('ticketing_system'), href: "#ticketing-task-planning", icon: <Shield className="w-4 h-4" /> },
        { name: t('task_planner'), href: "#ticketing-task-planning", icon: <Calendar className="w-4 h-4" /> },
        { name: t('food_supply_management'), href: "#hero", icon: <Package className="w-4 h-4" /> },
        { name: t('vehicle_fleet_management'), href: "#hero", icon: <Package className="w-4 h-4" /> }
      ]
    },
    { 
      name: t('ai_powered_insights'), 
      href: "#ai-powered-insights-analytics", // AI capabilities section
      icon: <Brain className="w-5 h-5" />
    },
    { 
      name: t('how_it_works'), 
      href: "#how-it-works", // How it works section
      icon: <BarChart2 className="w-5 h-5" />
    },
    { 
      name: t('enterprise_solutions'), 
      href: "#enterprise_solution", // Enterprise solution badge in hero section
      icon: <Users className="w-5 h-5" />
    }
  ];

  // Function to get safe area insets for mobile devices
  const getSafeAreaStyles = () => {
    return {
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      paddingTop: 'env(safe-area-inset-top, 0px)'
    };
  };
  
  // Calculate bottom spacing for content to prevent overlap with bottom navigation
  const getBottomSpacing = () => {
    // Base height plus safe area inset
    return 'calc(60px + env(safe-area-inset-bottom, 0px))';
  };

  // Get dynamic menu height based on screen orientation and size
  const getMenuHeight = () => {
    if (isLandscape) {
      return '85vh'; // Slightly taller in landscape to accommodate the shorter height
    }
    if (isExtraSmall) {
      return '75vh';
    }
    return '80vh';
  };

  // Memoize the header style for better performance
  const headerStyle = useMemo(() => ({
    ...getSafeAreaStyles(),
    // Apply hardware acceleration for smoother rendering
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden' as 'hidden',
    // Improve animation performance
    willChange: 'transform',
  }), []);

  return (
    <header 
      ref={headerRef}
      className="w-full sticky top-0 z-50 backdrop-blur-md bg-background/95 border-b border-border/40 shadow-sm" 
      style={headerStyle}
    >
      {/* Add padding to the bottom of the page to prevent content from being hidden behind the mobile navigation */}
      <style jsx global>{`
        @media (max-width: 768px) {
          body {
            padding-bottom: ${getBottomSpacing()};
          }
        }
      `}</style>
      {/* Mobile header - simplified for better mobile experience */}
      <div className="md:hidden w-full">
        <div className="flex items-center justify-between py-3 px-4">
          {/* Logo area */}
          <motion.div 
            className="cursor-pointer" 
            onClick={() => router.push("/")}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
          >
            <Logo />
          </motion.div>
          
          {/* Mobile action buttons */}
          <div className="flex items-center space-x-3">
            {!initializing && (
              <motion.div
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
              >
                <Button 
                  onClick={handleButtonClick}
                  variant="default"
                  size="sm"
                  className="rounded-full h-9 px-4 flex items-center gap-1.5 text-sm font-medium shadow-md shadow-primary/20"
                >
                  <div className="bg-white/10 rounded-full p-0.5">
                    {user ? (
                      <User className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <LogIn className="h-3.5 w-3.5 mr-1" />
                    )}
                  </div>
                  <span>{buttonText()}</span>
                </Button>
              </motion.div>
            )}
            
            <motion.div
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
            >
              <Button 
                variant={mobileMenuOpen ? "default" : "outline"}
                size="sm"
                className={`h-9 mobile-menu-button rounded-full flex items-center gap-1.5 px-3.5 ${mobileMenuOpen ? 'shadow-md shadow-primary/20' : 'border-primary/20 bg-background/80 shadow-sm'}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle features menu"
              >
                {mobileMenuOpen ? (
                  <>
                    <div className="bg-white/10 rounded-full p-0.5">
                      <X className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium">{t('close')}</span>
                  </>
                ) : (
                  <>
                    <div className="bg-primary/10 rounded-full p-0.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{t('features')}</span>
                    <ChevronDown className="h-3 w-3 ml-0.5 text-primary/70" />
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </div>
        
        {/* Mobile bottom navigation bar - improved with better visual styling */}
        <motion.div 
          className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/40 z-40 py-2 px-2 shadow-lg"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
        >
          <div className="flex items-center justify-around max-w-md mx-auto">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              whileHover={{ y: -2 }}
              className="flex flex-col items-center py-1.5 px-3 relative group"
              onClick={handleButtonClick}
            >
              <div className="relative">
                <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  {user ? (
                    <User className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                  ) : (
                    <LogIn className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <motion.div 
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-1 bg-primary rounded-full"
                  initial={{ width: '4px', opacity: 0 }}
                  animate={{ 
                    width: router.pathname === '/dashboard' || router.pathname === '/login' ? '16px' : '4px',
                    opacity: router.pathname === '/dashboard' || router.pathname === '/login' ? 1 : 0
                  }}
                  whileHover={{ width: '16px', opacity: 1 }}
                  transition={{ duration: 0.2 }}
                ></motion.div>
              </div>
              <span className={`text-xs mt-1.5 font-medium ${(router.pathname === '/dashboard' || router.pathname === '/login') ? 'text-primary' : 'text-foreground/80'} group-hover:text-primary transition-colors`}>
                {user ? t('dashboard') : t('log_in')}
              </span>
            </motion.button>
            
            <motion.button 
              whileTap={{ scale: 0.9 }}
              whileHover={{ y: -2 }}
              className="flex flex-col items-center py-1.5 px-3 relative group"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <div className="relative">
                <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Sparkles className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <motion.div 
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-1 bg-primary rounded-full"
                  initial={{ width: '4px', opacity: 0 }}
                  animate={{ 
                    width: mobileMenuOpen ? '16px' : '4px',
                    opacity: mobileMenuOpen ? 1 : 0
                  }}
                  whileHover={{ width: '16px', opacity: 1 }}
                  transition={{ duration: 0.2 }}
                ></motion.div>
              </div>
              <span className={`text-xs mt-1.5 font-medium ${mobileMenuOpen ? 'text-primary' : 'text-foreground/80'} group-hover:text-primary transition-colors`}>
                {t('features')}
              </span>
            </motion.button>
            
            <ThemeToggle showLabel={true} />
            
            <LanguageSwitcher showLabel={true} />
          </div>
        </motion.div>
      </div>
      
      {/* Desktop header */}
      <div className="hidden md:block container mx-auto">
        <div className="flex justify-between items-center py-3 px-4">
          <div className="flex items-center">
            <motion.div 
              className="cursor-pointer" 
              onClick={() => router.push("/")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Logo />
            </motion.div>
            
            {/* Desktop Navigation */}
            <nav className="flex ml-10 space-x-8">
              {navItems.map((item) => (
                <div key={item.name} className="relative group">
                  <Link 
                    href={item.href}
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center py-2 text-sm font-medium"
                    onClick={(e) => handleAnchorClick(e, item.href)}
                  >
                    {item.icon && <span className="mr-1.5 text-primary/80">{React.cloneElement(item.icon, { className: 'w-4 h-4' })}</span>}
                    {item.name}
                    {item.submenu && (
                      <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </Link>
                  
                  {item.submenu && (
                    <div className="absolute left-0 mt-2 w-56 rounded-xl shadow-lg bg-card/95 backdrop-blur-sm border border-border/50 overflow-hidden opacity-0 translate-y-1 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200 z-50">
                      <div className="py-2">
                        {item.submenu.map((subitem) => (
                          <Link
                            key={subitem.name}
                            href={subitem.href}
                            className="flex items-center px-4 py-2.5 text-sm text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-colors"
                            onClick={(e) => handleAnchorClick(e, subitem.href)}
                          >
                            {subitem.icon && <span className="mr-2 text-primary/70">{subitem.icon}</span>}
                            {subitem.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Animated underline effect */}
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </div>
              ))}
            </nav>
          </div>
          
          {/* Right side controls */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 border-r border-border/50 pr-4">
              <ThemeToggle />
              <LanguageSwitcher />
              {user && (
                <Link href="/translation-editor">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" title="Edit Translations">
                    <Languages className="h-5 w-5" />
                  </Button>
                </Link>
              )}
            </div>
            
            {/* Auth buttons */}
            {!initializing && (
              <div className="flex items-center space-x-3">
                <Link href="/signup">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full px-4 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors shadow-sm"
                  >
                    {t('sign_up_now')}
                  </Button>
                </Link>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    onClick={handleButtonClick}
                    variant="default"
                    size="default"
                    className="rounded-full px-5 py-2 flex items-center gap-2 shadow-md shadow-primary/20"
                  >
                    {user ? (
                      <User className="h-4 w-4 mr-1" />
                    ) : (
                      <LogIn className="h-4 w-4 mr-1" />
                    )}
                    <span className="font-medium">{buttonText()}</span>
                    {isRtl ? 
                      <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> : 
                      <ArrowRight className="h-4 w-4" />}
                  </Button>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile menu dropdown - improved for better mobile experience */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Overlay for mobile menu */}
            <motion.div 
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Menu container with dropdown animation */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden bg-card/95 backdrop-blur-md border border-border/50 shadow-xl fixed z-50 w-full mobile-menu-container overflow-hidden rounded-b-2xl"
              style={{
                top: '60px', // Position right below the header
                left: 0,
                right: 0,
                maxHeight: 'calc(85vh - 60px)', // Limit height to prevent covering the entire screen
                ...getSafeAreaStyles(),
                // Apply hardware acceleration for smoother rendering
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                // Improve animation performance
                willChange: 'transform, opacity',
                // Fix z-index stacking context
                zIndex: 60
              }}
            >
              {/* Menu header with close button - improved styling */}
              <div className="flex items-center justify-between p-4 border-b border-border/30 bg-primary/5">
                <div className="flex items-center">
                  <div className="p-1.5 rounded-full bg-primary/10 mr-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-medium">{t('features')}</h3>
                </div>
                <motion.div whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }}>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-background/50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
              
              {/* Scrollable content area with improved styling */}
              <div className="h-full overflow-y-auto overscroll-contain pb-safe" style={{ maxHeight: getMenuHeight() }}>
                <div className="p-4 space-y-4">
                  {/* Feature sections list */}
                  <div className="space-y-3">
                    {/* Core Features */}
                    <motion.div 
                      className="rounded-xl overflow-hidden mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="bg-primary/5 rounded-xl p-3 mb-2">
                        <h3 className="text-sm font-medium flex items-center">
                          <Package className="h-4 w-4 mr-2 text-primary/70" />
                          {t('core_capabilities')}
                        </h3>
                      </div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }}
                        style={{
                          // Apply hardware acceleration for smoother rendering
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          // Improve animation performance
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#hero"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-blue-500/5 rounded-xl active:bg-blue-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#hero");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-blue-500/10 mr-3 flex-shrink-0">
                            <Package className="w-5 h-5 text-blue-500" />
                          </div>
                          <span className="truncate">{t('asset_management_title')}</span>
                        </Link>
                      </motion.div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }} 
                        className="mt-2"
                        style={{
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#ticketing-task-planning"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-indigo-500/5 rounded-xl active:bg-indigo-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#ticketing-task-planning");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-indigo-500/10 mr-3 flex-shrink-0">
                            <Shield className="w-5 h-5 text-indigo-500" />
                          </div>
                          <span className="truncate">{t('ticketing_system_title')}</span>
                        </Link>
                      </motion.div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }} 
                        className="mt-2"
                        style={{
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#ticketing-task-planning"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-cyan-500/5 rounded-xl active:bg-cyan-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#ticketing-task-planning");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-cyan-500/10 mr-3 flex-shrink-0">
                            <Calendar className="w-5 h-5 text-cyan-500" />
                          </div>
                          <span className="truncate">{t('task_planner_title')}</span>
                        </Link>
                      </motion.div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }} 
                        className="mt-2"
                        style={{
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#hero"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-green-500/5 rounded-xl active:bg-green-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#hero");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-green-500/10 mr-3 flex-shrink-0">
                            <Utensils className="w-5 h-5 text-green-500" />
                          </div>
                          <span className="truncate">{t('food_supply_management_title')}</span>
                        </Link>
                      </motion.div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }} 
                        className="mt-2"
                        style={{
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#hero"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-purple-500/5 rounded-xl active:bg-purple-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#hero");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-purple-500/10 mr-3 flex-shrink-0">
                            <Car className="w-5 h-5 text-purple-500" />
                          </div>
                          <span className="truncate">{t('vehicle_fleet_management_title')}</span>
                        </Link>
                      </motion.div>
                    </motion.div>
                    
                    {/* AI Capabilities */}
                    <motion.div 
                      className="rounded-xl overflow-hidden mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                    >
                      <div className="bg-violet-500/5 rounded-xl p-3 mb-2">
                        <h3 className="text-sm font-medium flex items-center">
                          <Brain className="h-4 w-4 mr-2 text-violet-500/70" />
                          {t('advanced_intelligence')}
                        </h3>
                      </div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }}
                        style={{
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#ai-powered-insights-analytics"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-violet-500/5 rounded-xl active:bg-violet-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#ai-powered-insights-analytics");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-violet-500/10 mr-3 flex-shrink-0">
                            <Brain className="w-5 h-5 text-violet-500" />
                          </div>
                          <span className="truncate">{t('ai_powered_insights_title')}</span>
                        </Link>
                      </motion.div>
                    </motion.div>
                    
                    {/* How It Works */}
                    <motion.div 
                      className="rounded-xl overflow-hidden mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.2 }}
                    >
                      <div className="bg-amber-500/5 rounded-xl p-3 mb-2">
                        <h3 className="text-sm font-medium flex items-center">
                          <BarChart2 className="h-4 w-4 mr-2 text-amber-500/70" />
                          {t('how_it_works')}
                        </h3>
                      </div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }}
                        style={{
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#how-it-works"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-amber-500/5 rounded-xl active:bg-amber-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#how-it-works");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-amber-500/10 mr-3 flex-shrink-0">
                            <BarChart2 className="w-5 h-5 text-amber-500" />
                          </div>
                          <span className="truncate">{t('how_it_works')}</span>
                        </Link>
                      </motion.div>
                    </motion.div>
                    
                    {/* Enterprise Solutions */}
                    <motion.div 
                      className="rounded-xl overflow-hidden mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.3 }}
                    >
                      <div className="bg-blue-500/5 rounded-xl p-3 mb-2">
                        <h3 className="text-sm font-medium flex items-center">
                          <Users className="h-4 w-4 mr-2 text-blue-500/70" />
                          {t('enterprise_solutions')}
                        </h3>
                      </div>
                      
                      <motion.div 
                        whileHover={{ x: 5 }} 
                        whileTap={{ scale: 0.98 }}
                        style={{
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          willChange: 'transform'
                        }}
                      >
                        <Link
                          href="#enterprise_solution"
                          className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:bg-blue-500/5 rounded-xl active:bg-blue-500/10 transition-colors"
                          onClick={(e) => {
                            handleAnchorClick(e, "#enterprise_solution");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <div className="p-2 rounded-full bg-blue-500/10 mr-3 flex-shrink-0">
                            <Users className="w-5 h-5 text-blue-500" />
                          </div>
                          <span className="truncate">{t('enterprise_solution')}</span>
                        </Link>
                      </motion.div>
                    </motion.div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="pt-4 mt-4 border-t border-border/30 space-y-3">
                    {/* Sign up button */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="w-full"
                    >
                      <Link
                        href="/signup"
                        className="block w-full"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Button 
                          variant="outline" 
                          className="w-full justify-center rounded-xl border-primary/20 hover:bg-primary/5 py-6 text-base"
                        >
                          {t('sign_up_now')}
                          {isRtl ? <ArrowLeft className="mr-2 h-4 w-4 rtl:rotate-180" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                      </Link>
                    </motion.div>
                    
                    {/* Login/Dashboard button */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="w-full"
                    >
                      <Button 
                        variant="default" 
                        className="w-full justify-center rounded-xl py-6 text-base shadow-md shadow-primary/20"
                        onClick={() => {
                          handleButtonClick();
                          setMobileMenuOpen(false);
                        }}
                      >
                        {user ? (
                          <User className="h-5 w-5 mr-2" />
                        ) : (
                          <LogIn className="h-5 w-5 mr-2" />
                        )}
                        <span className="font-medium">{buttonText()}</span>
                        {isRtl ? <ArrowLeft className="ml-2 h-4 w-4 rtl:rotate-180" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                    </motion.div>
                  </div>
                  
                  {/* Additional mobile-only actions */}
                  {user && (
                    <div className="pt-4 mt-4 border-t border-border/30">
                      <Link
                        href="/translation-editor"
                        className="flex items-center px-4 py-3 text-sm text-muted-foreground hover:bg-primary/5 rounded-xl transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Languages className="h-5 w-5 mr-3 text-primary/70" />
                        {t('edit_translations')}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;