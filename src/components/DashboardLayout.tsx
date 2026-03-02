import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Utensils,
  Car,
  BarcodeIcon,
  MapPin,
  Settings,
  LineChart,
  TicketIcon,
  BrainCircuit,
  LogOut,
  User,
  Printer,
  Calendar,
  Navigation,
  Building2,
} from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNavBar } from "./MobileNavBar";
import Link from "next/link";
import { useRouter } from "next/router";
import Logo from "./Logo";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useRTLOptimization } from "@/hooks/useRTLOptimization";
import { ThemeToggle } from "./ThemeToggle";
import { usePageAccess } from "@/hooks/usePageAccess";
import { createClient } from "@/util/supabase/component";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark } = useTheme();
  const { t, dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const { setRef } = useRTLOptimization('dashboard-layout');
  
  // Toggle sidebar for mobile view
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  // Reference for the main container
  const mainContainerRef = useRef<HTMLDivElement>(null);
  
  // Set the ref for RTL optimization
  useEffect(() => {
    if (mainContainerRef.current) {
      setRef(mainContainerRef.current);
    }
  }, [setRef]);
  
  return (
    <div 
      ref={mainContainerRef}
      className="flex min-h-screen bg-background transition-colors duration-300 overflow-hidden"
      dir={dir}
    >
      {/* Mobile sidebar backdrop - only shown when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - completely hidden on mobile, only shown when explicitly opened via toggle */}
      <Sidebar 
        className={`fixed ${isRtl ? 'right-0' : 'left-0'} top-0 z-40 h-screen w-[280px] bg-card shadow-sm transition-all duration-300 ease-in-out transform ${
          sidebarOpen 
            ? 'translate-x-0' 
            : isRtl 
              ? 'translate-x-full' 
              : '-translate-x-full'
        } lg:translate-x-0 hidden lg:block`} 
      />
      
      {/* Main content area with responsive padding and margin */}
      <main className={`flex-1 ${isRtl ? 'lg:mr-[280px]' : 'lg:ml-[280px]'} w-full h-screen overflow-y-auto`}>
        <div className="p-4 md:p-6 lg:p-8 pt-6 pb-28 lg:pb-8">
          {/* Mobile header without menu button - improved for RTL */}
          <div className="lg:hidden flex flex-col mb-6 bg-card p-3 rounded-lg shadow-sm">
            {/* Add Logo to mobile view */}
            <div className={`mb-2 ${isRtl ? 'flex justify-end' : ''}`}>
              <Logo />
            </div>
            <div className="flex items-center justify-between">
              <div className={`text-xl font-bold ${isDark ? 'text-primary' : isRtl ? 'text-indigo-700' : `bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent`} ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? t('enterprise_asset_management') : 'Enterprise Asset'}
              </div>
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </div>
          
          {children}
        </div>
        
        {/* Mobile Navigation Bar */}
        <MobileNavBar />
      </main>
    </div>
  );
}

function Sidebar({ className }: SidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const { isDark, theme, toggleTheme } = useTheme();
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const { setRef } = useRTLOptimization('sidebar');
  const { hasAccess, isAdmin, loading } = usePageAccess();
  
  // Reference for the sidebar container
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Set the ref for RTL optimization
  useEffect(() => {
    if (sidebarRef.current) {
      setRef(sidebarRef.current);
    }
  }, [setRef]);

  const menuItems = {
    main: [
      {
        title: t("dashboard"),
        icon: LayoutDashboard,
        href: "/dashboard",
      },
      {
        title: t("ai_analysis"),
        icon: BrainCircuit,
        href: "/ai-analysis",
      },
      {
        title: t("print_reports"),
        icon: Printer,
        href: "/reports/print",
      },
      {
        title: t("planner"),
        icon: Calendar,
        href: "/planner",
      },
      {
        title: t("vehicle_assignments"),
        icon: User,
        href: "/admin/vehicle-assignments",
      },
      {
        title: t("staff_activity"),
        icon: User,
        href: "/staff-activity",
      },
      {
        title: t("drivers"),
        icon: User,
        href: "/drivers",
      },
    ],
    assets: [
      {
        title: t("assets"),
        icon: Package,
        href: "/assets",
      },
      {
        title: t("food_supply"),
        icon: Utensils,
        href: "/food-supply",
      },
      {
        title: t("kitchens"),
        icon: Building2,
        href: "/kitchens",
      },
      {
        title: t("vehicle_rentals_sidebar"),
        icon: Car,
        href: "/vehicles",
      },
    ],
    tracking: [
      {
        title: t("asset_location"),
        icon: MapPin,
        href: "/asset-location",
      },
      {
        title: t("vehicle_tracking_system"),
        icon: Car,
        href: "/vehicle-tracking",
      },
      {
        title: t("my_vehicle"),
        icon: Navigation,
        href: "/my-vehicle",
      },
    ],
    support: [
      {
        title: t("tickets"),
        icon: TicketIcon,
        href: "/tickets",
      },
    ],
    system: [
      {
        title: t("settings"),
        icon: Settings,
        href: "/settings",
      },
      {
        title: t("compliance_audit"),
        icon: LineChart,
        href: "/settings/compliance",
      },
    ],
  };

  return (
    <div 
      ref={sidebarRef}
      className={cn("pb-12 flex flex-col", className)}
      dir={dir}
    >
      {/* Logo Section */}
      <div className={`relative px-6 py-6 flex items-center justify-between border-b ${
        isDark 
          ? `bg-gradient-to-${isRtl ? 'l' : 'r'} from-gray-900 to-gray-800` 
          : `bg-gradient-to-${isRtl ? 'l' : 'r'} from-white to-indigo-50/30`
      }`}>
        <div className={`relative ${isRtl ? 'text-right' : 'text-left'} w-full`}>
          {/* Logo component displayed above the text */}
          <div className={`mb-3 ${isRtl ? 'flex justify-end' : ''}`}>
            <Logo />
          </div>
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`text-2xl font-bold ${
              isDark 
                ? "text-primary" 
                : isRtl
                  ? "text-indigo-700" // Solid color for RTL to ensure visibility
                  : `bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent`
            }`}
          >
            {isRtl ? t('enterprise_asset_management') : 'Enterprise Asset'}
          </motion.div>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "12rem" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute -bottom-2 ${isRtl ? 'left-auto right-0' : 'right-auto left-0'} h-[3px] ${
              isDark 
                ? `bg-gradient-to-${isRtl ? 'l' : 'r'} from-primary via-primary/70 to-transparent` 
                : `bg-gradient-to-${isRtl ? 'l' : 'r'} from-indigo-600 via-blue-500 to-transparent`
            } rounded-full`} 
          />
        </div>
        <ThemeToggle />
      </div>

      {/* User Profile Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="px-6 py-4 border-b bg-card text-card-foreground"
      >
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${dir === 'rtl' ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Avatar className={`h-10 w-10 border-2 ${
                isDark ? "border-primary/20" : "border-indigo-100"
              } shadow-sm`}>
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white">
                  {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email ? user.email.split('@')[0] : 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || 'user@example.com'}
              </p>
              <UserRoleDisplay />
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </motion.div>

      {/* Menu Items */}
      <div className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-none max-h-[calc(100vh-200px)]">
        {/* Get page access information once for all sections */}
        {(() => {
          // Don't render any menu sections until permissions are loaded
          if (loading) {
            return (
              <div className="flex items-center justify-center h-32">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
                />
              </div>
            );
          }
          
          return (
            <>
              {/* Main Section */}
              {(() => {
                // Check if any main menu items are accessible
                const hasMainAccess = isAdmin || menuItems.main.some(item => hasAccess(item.href));
                
                // Only render the section if at least one item is accessible
                if (!hasMainAccess) return null;
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="space-y-2"
                    onMouseEnter={() => setHoveredSection('main')}
                    onMouseLeave={() => setHoveredSection(null)}
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative ${hoveredSection === 'main' ? 'scale-105' : ''} transition-transform duration-300`}>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold transition-colors duration-300",
                          hoveredSection === 'main' 
                            ? isDark ? "text-primary" : "text-indigo-600" 
                            : isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('main')}
                        </h2>
                        {hoveredSection === 'main' && (
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.3 }}
                            className={`absolute -bottom-1 ${isRtl ? 'right-0' : 'left-0'} h-[2px] rounded-full ${isDark ? 'bg-primary/70' : 'bg-indigo-500/70'}`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.main.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <MenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname === item.href}
                          />
                        )
                      ))}
                    </div>
                  </motion.div>
                );
              })()}

              {/* Assets Section */}
              {(() => {
                // Check if any assets menu items are accessible
                const hasAssetsAccess = isAdmin || menuItems.assets.some(item => hasAccess(item.href));
                
                // Only render the section if at least one item is accessible
                if (!hasAssetsAccess) return null;
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="space-y-2"
                    onMouseEnter={() => setHoveredSection('assets')}
                    onMouseLeave={() => setHoveredSection(null)}
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative ${hoveredSection === 'assets' ? 'scale-105' : ''} transition-transform duration-300`}>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold transition-colors duration-300",
                          hoveredSection === 'assets' 
                            ? isDark ? "text-primary" : "text-indigo-600" 
                            : isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('assets')}
                        </h2>
                        {hoveredSection === 'assets' && (
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.3 }}
                            className={`absolute -bottom-1 ${isRtl ? 'right-0' : 'left-0'} h-[2px] rounded-full ${isDark ? 'bg-primary/70' : 'bg-indigo-500/70'}`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.assets.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <MenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname.startsWith(item.href)}
                          />
                        )
                      ))}
                    </div>
                  </motion.div>
                );
              })()}

              {/* Tracking Section */}
              {(() => {
                // Check if any tracking menu items are accessible
                const hasTrackingAccess = isAdmin || menuItems.tracking.some(item => hasAccess(item.href));
                
                // Only render the section if at least one item is accessible
                if (!hasTrackingAccess) return null;
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="space-y-2"
                    onMouseEnter={() => setHoveredSection('tracking')}
                    onMouseLeave={() => setHoveredSection(null)}
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative ${hoveredSection === 'tracking' ? 'scale-105' : ''} transition-transform duration-300`}>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold transition-colors duration-300",
                          hoveredSection === 'tracking' 
                            ? isDark ? "text-primary" : "text-indigo-600" 
                            : isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('tracking')}
                        </h2>
                        {hoveredSection === 'tracking' && (
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.3 }}
                            className={`absolute -bottom-1 ${isRtl ? 'right-0' : 'left-0'} h-[2px] rounded-full ${isDark ? 'bg-primary/70' : 'bg-indigo-500/70'}`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.tracking.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <MenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname.startsWith(item.href)}
                          />
                        )
                      ))}
                    </div>
                  </motion.div>
                );
              })()}

              {/* Support Section */}
              {(() => {
                // Check if any support menu items are accessible
                const hasSupportAccess = isAdmin || menuItems.support.some(item => hasAccess(item.href));
                
                // Only render the section if at least one item is accessible
                if (!hasSupportAccess) return null;
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="space-y-2"
                    onMouseEnter={() => setHoveredSection('support')}
                    onMouseLeave={() => setHoveredSection(null)}
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative ${hoveredSection === 'support' ? 'scale-105' : ''} transition-transform duration-300`}>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold transition-colors duration-300",
                          hoveredSection === 'support' 
                            ? isDark ? "text-primary" : "text-indigo-600" 
                            : isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('support')}
                        </h2>
                        {hoveredSection === 'support' && (
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.3 }}
                            className={`absolute -bottom-1 ${isRtl ? 'right-0' : 'left-0'} h-[2px] rounded-full ${isDark ? 'bg-primary/70' : 'bg-indigo-500/70'}`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.support.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <MenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname.startsWith(item.href)}
                          />
                        )
                      ))}
                    </div>
                  </motion.div>
                );
              })()}

              <div className="px-2 py-2">
                <Separator className={`opacity-50 ${hoveredSection ? 'opacity-70' : ''} transition-opacity duration-300`} />
              </div>

              {/* System Section - Always show for sign out button */}
              <motion.div 
                initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="space-y-2"
                onMouseEnter={() => setHoveredSection('system')}
                onMouseLeave={() => setHoveredSection(null)}
              >
                <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative ${hoveredSection === 'system' ? 'scale-105' : ''} transition-transform duration-300`}>
                    <h2 className={cn(
                      "text-xs uppercase tracking-wider font-semibold transition-colors duration-300",
                      hoveredSection === 'system' 
                        ? isDark ? "text-primary" : "text-indigo-600" 
                        : isDark ? "text-muted-foreground" : "text-slate-500"
                    )}>
                      {t('system')}
                    </h2>
                    {hoveredSection === 'system' && (
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 0.3 }}
                        className={`absolute -bottom-1 ${isRtl ? 'right-0' : 'left-0'} h-[2px] rounded-full ${isDark ? 'bg-primary/70' : 'bg-indigo-500/70'}`}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {/* Only render system menu items if user has access */}
                  {menuItems.system.map((item) => (
                    (isAdmin || hasAccess(item.href)) && (
                      <MenuItem
                        key={item.href}
                        item={item}
                        isActive={router.pathname.startsWith(item.href)}
                      />
                    )
                  ))}
                  
                  {/* Always show sign out button */}
                  <motion.div
                    whileHover={{ 
                      x: isRtl ? -3 : 3,
                      transition: { duration: 0.2 }
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <button
                      onClick={() => signOut && signOut()}
                      className={cn(
                        "group relative flex w-full items-center rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                        isDark 
                          ? "text-muted-foreground hover:text-red-400 hover:bg-red-500/10" 
                          : "text-slate-600 hover:text-red-600 hover:bg-red-50"
                      )}
                    >
                      {/* Active/hover indicator bar */}
                      <motion.div 
                        className={`absolute ${isRtl ? 'right-0' : 'left-0'} rounded-full transition-all duration-300 w-1 h-5 bg-transparent group-hover:bg-red-500`}
                        whileHover={{ height: "60%" }}
                        transition={{ duration: 0.2 }}
                      />
                      
                      {/* Sign out button content with proper RTL layout */}
                      <div className={`flex items-center justify-between w-full ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Icon with animation */}
                        <motion.div
                          whileHover={{ rotate: isRtl ? -5 : 5, scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          className={`flex items-center justify-center ${isRtl ? 'ml-3' : 'mr-3'}`}
                        >
                          <LogOut className={cn(
                            "h-5 w-5 transition-colors duration-200",
                            isDark 
                              ? "text-muted-foreground group-hover:text-red-400" 
                              : "text-slate-500 group-hover:text-red-500"
                          )} />
                        </motion.div>
                        
                        {/* Sign out text */}
                        <span className={`transition-all duration-200 flex-grow ${isRtl ? 'text-right' : 'text-left'}`}>
                          {t('sign_out')}
                        </span>
                      </div>
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

interface MenuItemProps {
  item: {
    title: string;
    icon: any;
    href: string;
  };
  isActive: boolean;
}

function MenuItem({ item, isActive }: MenuItemProps) {
  const { isDark } = useTheme();
  const { t, dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const { setRef } = useRTLOptimization(`menu-item-${item.href}`);
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Set the ref for RTL optimization
  useEffect(() => {
    if (itemRef.current) {
      setRef(itemRef.current);
    }
  }, [setRef]);
  
  return (
    <motion.div
      ref={itemRef}
      whileHover={{ 
        x: isRtl ? -3 : 3,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href={item.href}
        className={cn(
          "group relative flex items-center rounded-md px-4 py-2.5 text-sm font-medium transition-all",
          isActive
            ? isDark 
              ? `bg-gradient-to-${isRtl ? 'l' : 'r'} from-primary/10 to-primary/5 text-primary` 
              : `bg-gradient-to-${isRtl ? 'l' : 'r'} from-indigo-50 to-blue-50 text-indigo-700`
            : isDark
              ? "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              : "text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-700"
        )}
      >
        {/* Active/hover indicator bar */}
        <motion.div 
          className={cn(
            `absolute ${isRtl ? 'right-0' : 'left-0'} rounded-full transition-all duration-300`,
            isActive 
              ? `w-1.5 h-5/6 ${
                  isDark 
                    ? "bg-gradient-to-b from-primary via-primary/80 to-primary/60" 
                    : "bg-gradient-to-b from-indigo-600 to-blue-500"
                }` 
              : `w-1 h-5 bg-transparent ${
                  isDark 
                    ? "group-hover:bg-primary/40" 
                    : "group-hover:bg-indigo-300"
                }`
          )}
          whileHover={{ 
            height: isActive ? "90%" : "60%",
            width: isActive ? "6px" : "4px"
          }}
          animate={{ 
            height: isActive ? "80%" : "0%",
            width: isActive ? "5px" : "0px",
            opacity: isActive ? 1 : 0
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Menu item content with proper RTL layout */}
        <div className={`flex items-center justify-between w-full ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Icon with animation */}
          <motion.div
            whileHover={{ rotate: isActive ? 0 : isRtl ? -5 : 5, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className={`flex items-center justify-center ${isRtl ? 'ml-3' : 'mr-3'}`}
          >
            <item.icon className={cn(
              "h-5 w-5 transition-all duration-300",
              isActive 
                ? isDark ? "text-primary" : "text-indigo-600" 
                : isDark 
                  ? "text-muted-foreground group-hover:text-primary" 
                  : "text-slate-500 group-hover:text-indigo-600"
            )} />
          </motion.div>
          
          {/* Menu item text */}
          <span className={`transition-all duration-200 flex-grow ${isRtl ? 'text-right' : 'text-left'}`}>
            {item.title}
          </span>
          
          {/* Active indicator dot */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`w-1.5 h-1.5 rounded-full ${
                isDark ? "bg-primary" : "bg-indigo-500"
              }`}
            />
          )}
        </div>
      </Link>
    </motion.div>
  );
}

// Component to display the user's role
function UserRoleDisplay() {
  // Import usePageAccess directly instead of requiring it
  const { role, isAdmin, isManager, loading } = usePageAccess();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [customRoleName, setCustomRoleName] = useState<string | null>(null);
  
  // Fetch custom role name if user has a customRoleId
  useEffect(() => {
    const fetchCustomRoleName = async () => {
      if (!user) return;
      
      try {
        const supabase = createClient();
        // First get the user to check if they have a customRoleId
        const { data: userData, error: userError } = await supabase
          .from('User')
          .select('customRoleId, role')
          .eq('id', user.id)
          .single();
        
        if (userError) {
          console.error('[UserRoleDisplay] Error fetching user data:', userError);
          return;
        }
        
        // Clear custom role name if user doesn't have a customRoleId
        if (!userData?.customRoleId) {
          if (customRoleName) {
            console.log('[UserRoleDisplay] User no longer has a custom role, clearing custom role name');
            setCustomRoleName(null);
          }
          return;
        }
        
        // If user has a customRoleId, fetch the custom role name
        const { data: roleData, error: roleError } = await supabase
          .from('CustomRole')
          .select('name')
          .eq('id', userData.customRoleId)
          .single();
        
        if (!roleError && roleData) {
          console.log(`[UserRoleDisplay] Found custom role: ${roleData.name}`);
          setCustomRoleName(roleData.name);
        } else if (roleError) {
          console.error('[UserRoleDisplay] Error fetching custom role:', roleError);
          setCustomRoleName(null);
        }
      } catch (error) {
        console.error('Error fetching custom role:', error);
        setCustomRoleName(null);
      }
    };
    
    fetchCustomRoleName();
    
    // Set up a refresh interval to periodically check for role changes
    const refreshInterval = setInterval(fetchCustomRoleName, 30000); // Check every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [user, customRoleName]);
  
  if (loading) {
    return null;
  }
  
  // Format the role name for display
  let displayRole = role || 'STAFF';
  if (isAdmin) {
    displayRole = 'ADMIN';
  } else if (isManager) {
    displayRole = 'MANAGER';
  } else if (customRoleName) {
    // Use the custom role name if available
    displayRole = customRoleName;
  }
  
  // Get the translated role name
  const getRoleTranslation = (role: string) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return t('role_admin');
      case 'MANAGER':
        return t('role_manager');
      case 'STAFF':
        return t('role_staff');
      default:
        // For custom roles, display the role name as is
        return role;
    }
  };
  
  // Determine the color based on role
  const getRoleColor = () => {
    if (isAdmin) {
      return {
        text: isDark ? "text-primary" : "text-indigo-700",
        bg: isDark ? "bg-primary/10" : "bg-indigo-100"
      };
    } else if (isManager) {
      return {
        text: isDark ? "text-blue-400" : "text-blue-600",
        bg: isDark ? "bg-blue-500/10" : "bg-blue-100"
      };
    } else if (customRoleName) {
      // Custom role color - slightly different from staff
      return {
        text: isDark ? "text-amber-400" : "text-amber-600",
        bg: isDark ? "bg-amber-500/10" : "bg-amber-100"
      };
    } else {
      // For staff, use a neutral color
      return {
        text: isDark ? "text-gray-400" : "text-gray-500",
        bg: isDark ? "bg-gray-500/10" : "bg-gray-100"
      };
    }
  };
  
  const roleColor = getRoleColor();
  
  return (
    <motion.p
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`text-xs mt-1 font-medium ${roleColor.text} px-1.5 py-0.5 rounded-sm inline-block ${roleColor.bg}`}
    >
      {getRoleTranslation(displayRole)}
    </motion.p>
  );
}