import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Utensils,
  Car,
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
} from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNavBar } from "./MobileNavBar";
import Link from "next/link";
import { useRouter } from "next/router";
import Logo from "./Logo";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { usePageAccess } from "@/hooks/usePageAccess";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SimpleDashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark } = useTheme();
  const { t, dir } = useTranslation();
  const isRtl = dir === 'rtl';
  
  // Toggle sidebar for mobile view
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  return (
    <div 
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
      <SimpleSidebar 
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

function SimpleSidebar({ className }: SidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, dir } = useTranslation();
  const isRtl = dir === 'rtl';
  const { isDark } = useTheme();
  const { hasAccess, isAdmin, loading } = usePageAccess();
  
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
          <div 
            className={`text-2xl font-bold ${
              isDark 
                ? "text-primary" 
                : isRtl
                  ? "text-indigo-700" // Solid color for RTL to ensure visibility
                  : `bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent`
            }`}
          >
            {isRtl ? t('enterprise_asset_management') : 'Enterprise Asset'}
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* User Profile Section */}
      <div 
        className="px-6 py-4 border-b bg-card text-card-foreground"
      >
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${dir === 'rtl' ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
            <Avatar className={`h-10 w-10 border-2 ${
              isDark ? "border-primary/20" : "border-indigo-100"
            } shadow-sm`}>
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email ? user.email.split('@')[0] : 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-none max-h-[calc(100vh-200px)]">
        {/* Get page access information once for all sections */}
        {(() => {
          // Don't render any menu sections until permissions are loaded
          if (loading) {
            return (
              <div className="flex items-center justify-center h-32">
                <div
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
                  <div 
                    className="space-y-2"
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold",
                          isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('main')}
                        </h2>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.main.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <SimpleMenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname === item.href}
                          />
                        )
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Assets Section */}
              {(() => {
                // Check if any assets menu items are accessible
                const hasAssetsAccess = isAdmin || menuItems.assets.some(item => hasAccess(item.href));
                
                // Only render the section if at least one item is accessible
                if (!hasAssetsAccess) return null;
                
                return (
                  <div 
                    className="space-y-2"
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold",
                          isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('assets')}
                        </h2>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.assets.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <SimpleMenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname.startsWith(item.href)}
                          />
                        )
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Tracking Section */}
              {(() => {
                // Check if any tracking menu items are accessible
                const hasTrackingAccess = isAdmin || menuItems.tracking.some(item => hasAccess(item.href));
                
                // Only render the section if at least one item is accessible
                if (!hasTrackingAccess) return null;
                
                return (
                  <div 
                    className="space-y-2"
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold",
                          isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('tracking')}
                        </h2>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.tracking.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <SimpleMenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname.startsWith(item.href)}
                          />
                        )
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Support Section */}
              {(() => {
                // Check if any support menu items are accessible
                const hasSupportAccess = isAdmin || menuItems.support.some(item => hasAccess(item.href));
                
                // Only render the section if at least one item is accessible
                if (!hasSupportAccess) return null;
                
                return (
                  <div 
                    className="space-y-2"
                  >
                    <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <h2 className={cn(
                          "text-xs uppercase tracking-wider font-semibold",
                          isDark ? "text-muted-foreground" : "text-slate-500"
                        )}>
                          {t('support')}
                        </h2>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {menuItems.support.map((item) => (
                        (isAdmin || hasAccess(item.href)) && (
                          <SimpleMenuItem
                            key={item.href}
                            item={item}
                            isActive={router.pathname.startsWith(item.href)}
                          />
                        )
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="px-2 py-2">
                <Separator className="opacity-50" />
              </div>

              {/* System Section - Always show for sign out button */}
              <div 
                className="space-y-2"
              >
                <div className={`px-4 mb-3 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
                  <div>
                    <h2 className={cn(
                      "text-xs uppercase tracking-wider font-semibold",
                      isDark ? "text-muted-foreground" : "text-slate-500"
                    )}>
                      {t('system')}
                    </h2>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {/* Only render system menu items if user has access */}
                  {menuItems.system.map((item) => (
                    (isAdmin || hasAccess(item.href)) && (
                      <SimpleMenuItem
                        key={item.href}
                        item={item}
                        isActive={router.pathname.startsWith(item.href)}
                      />
                    )
                  ))}
                  
                  {/* Always show sign out button */}
                  <button
                    onClick={() => signOut && signOut()}
                    className={cn(
                      "group relative flex w-full items-center rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                      isDark 
                        ? "text-muted-foreground hover:text-red-400 hover:bg-red-500/10" 
                        : "text-slate-600 hover:text-red-600 hover:bg-red-50"
                    )}
                  >
                    {/* Sign out button content with proper RTL layout */}
                    <div className={`flex items-center justify-between w-full ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Icon */}
                      <div className={`flex items-center justify-center ${isRtl ? 'ml-3' : 'mr-3'}`}>
                        <LogOut className={cn(
                          "h-5 w-5",
                          isDark 
                            ? "text-muted-foreground group-hover:text-red-400" 
                            : "text-slate-500 group-hover:text-red-500"
                        )} />
                      </div>
                      
                      {/* Sign out text */}
                      <span className={`flex-grow ${isRtl ? 'text-right' : 'text-left'}`}>
                        {t('sign_out')}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
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

function SimpleMenuItem({ item, isActive }: MenuItemProps) {
  const { isDark } = useTheme();
  const { dir } = useTranslation();
  const isRtl = dir === 'rtl';
  
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center rounded-md px-4 py-2.5 text-sm font-medium",
        isActive
          ? isDark 
            ? `bg-gradient-to-${isRtl ? 'l' : 'r'} from-primary/10 to-primary/5 text-primary` 
            : `bg-gradient-to-${isRtl ? 'l' : 'r'} from-indigo-50 to-blue-50 text-indigo-700`
          : isDark
            ? "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            : "text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-700"
      )}
    >
      {/* Menu item content with proper RTL layout */}
      <div className={`flex items-center justify-between w-full ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Icon */}
        <div className={`flex items-center justify-center ${isRtl ? 'ml-3' : 'mr-3'}`}>
          <item.icon className={cn(
            "h-5 w-5",
            isActive 
              ? isDark ? "text-primary" : "text-indigo-600" 
              : isDark 
                ? "text-muted-foreground group-hover:text-primary" 
                : "text-slate-500 group-hover:text-indigo-600"
          )} />
        </div>
        
        {/* Menu item text */}
        <span className={`flex-grow ${isRtl ? 'text-right' : 'text-left'}`}>
          {item.title}
        </span>
        
        {/* Active indicator dot */}
        {isActive && (
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isDark ? "bg-primary" : "bg-indigo-500"
            }`}
          />
        )}
      </div>
    </Link>
  );
}