import React, { useState, useEffect } from "react";
import { useRTLAnimation } from "@/hooks/useRTLAnimation";
import { usePageAccess } from "@/hooks/usePageAccess";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRTLComponentFix } from "@/hooks/useRTLComponentFix";
import { createRTLAwareStyles } from "@/lib/rtl-utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  ChevronUp,
  ChevronDown,
  Scan,
  Package,
  Utensils,
  ShoppingBag,
  Car,
  TicketIcon,
  CalendarPlus,
  Plus,
  X,
  ListTodo,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BarcodeScanner from "@/components/BarcodeScanner2";
import BarcodeScannerFood from "@/components/BarcodeScannerFood";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import { RegisterVehicleDialog } from "@/components/RegisterVehicleDialog";
import { EditFoodSupplyDialog } from "@/components/EditFoodSupplyDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskDialog } from "@/components/TaskDialog";
import { RegisterAssetForm } from "@/components/RegisterAssetForm";
import { RegisterFoodSupplyForm } from "@/components/RegisterFoodSupplyForm";
import { AssignedItemsList } from "@/components/AssignedItemsList";
import { ChangeAssetStatusDialog } from "@/components/ChangeAssetStatusDialog";
import { useAuth } from "@/contexts/AuthContext";

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  description?: string;
  badge?: string;
  pagePath?: string; // Optional path to check access for
  pageAccessData?: {
    hasAccess: (path: string) => boolean;
    isAdmin: boolean;
    loading: boolean;
  };
}

const QuickAction: React.FC<QuickActionProps> = ({
  icon,
  label,
  color,
  onClick,
  description,
  badge,
  pagePath,
  pageAccessData,
}) => {
  const { dir } = useTranslation();
  const isRtl = dir === "rtl";
  const { theme, isDark } = useTheme();
  
  // Use the passed pageAccessData if available, otherwise use the hook directly
  // This allows the component to be used both inside and outside the QuickActionsMenu
  const fallbackPageAccessData = usePageAccess();
  const accessData = pageAccessData || fallbackPageAccessData;
  const { hasAccess, isAdmin, loading } = accessData;
  
  // Check if user has access to this action's page
  // If no pagePath is provided, always show the action
  const hasPageAccess = !pagePath || isAdmin || hasAccess(pagePath);
  
  // Don't render action if user doesn't have access and we're done loading
  if (pagePath && !loading && !hasPageAccess) {
    return null;
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-slate-800/90 shadow-sm hover:shadow-md transition-all group relative overflow-hidden border border-slate-100 dark:border-slate-700"
      onClick={onClick}
      aria-label={label}
      style={{
        boxShadow: isDark 
          ? `0 4px 12px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.3)` 
          : `0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)`,
      }}
    >
      {/* Background glow effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl" 
        style={{ backgroundColor: color }}
      ></div>
      
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-transparent dark:from-slate-800/50 dark:to-transparent opacity-50 rounded-2xl"></div>
      
      {/* Icon container with improved visual effects */}
      <div
        className="flex items-center justify-center w-14 h-14 rounded-full mb-3 transition-all duration-300 group-hover:shadow-lg relative"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
          boxShadow: isDark
            ? `0 4px 10px ${color}60, 0 0 0 4px ${color}25`
            : `0 4px 10px ${color}40, 0 0 0 4px ${color}15`,
        }}
      >
        {/* Pulsing background effect */}
        <div 
          className="absolute inset-0 rounded-full animate-pulse opacity-70" 
          style={{ 
            background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
            animationDuration: '3s' 
          }}
        ></div>
        
        <motion.div
          whileHover={{ rotate: 15, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="relative z-10"
        >
          {icon}
        </motion.div>
      </div>
      
      <div className="flex flex-col items-center text-center z-10">
        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
          {label}
        </span>
        {description && (
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 max-w-[95%]">
            {description}
          </span>
        )}
      </div>
      
      {badge && (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className={cn(
            "absolute top-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md",
            isRtl ? "left-2" : "right-2"
          )}
        >
          {badge}
        </motion.div>
      )}
    </motion.button>
  );
};

interface ActionSectionProps {
  title: string;
  color: string;
  children: React.ReactNode;
}

const ActionSection: React.FC<ActionSectionProps> = ({
  title,
  color,
  children,
}) => {
  const { dir } = useTranslation();
  const isRtl = dir === "rtl";
  const { theme, isDark } = useTheme();

  return (
    <div className="mb-6 last:mb-0">
      <h3
        className={cn(
          "text-sm font-semibold mb-4 flex items-center",
          isRtl ? "flex-row-reverse text-right" : "flex-row text-left"
        )}
      >
        <div
          className={cn(
            "w-3 h-3 rounded-full transition-all",
            isRtl ? "ml-2" : "mr-2"
          )}
          style={{ 
            backgroundColor: color,
            boxShadow: isDark 
              ? `0 0 8px ${color}90` 
              : `0 0 8px ${color}80`
          }}
        ></div>
        <span
          className="relative"
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {title}
          <span 
            className="absolute bottom-0 left-0 w-full h-0.5 opacity-70"
            style={{ backgroundColor: color }}
          ></span>
        </span>
      </h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
};

export function QuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const { t, dir } = useTranslation();
  const isRtl = dir === "rtl";
  const { toast } = useToast();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  // Move usePageAccess hook to the top level
  const pageAccessData = usePageAccess();
  
  // Dialog states
  const [showAssetScanner, setShowAssetScanner] = useState(false);
  const [showFoodScanner, setShowFoodScanner] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showRegisterVehicle, setShowRegisterVehicle] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showRegisterSupply, setShowRegisterSupply] = useState(false);
  const [showRegisterAsset, setShowRegisterAsset] = useState(false);
  
  // Fetch assignment count when user is available
  useEffect(() => {
    if (user) {
      fetchAssignmentCount();
    }
  }, [user]);
  
  // Refresh assignment count when sheet is opened or every 5 seconds when open
  useEffect(() => {
    if (sheetOpen && user) {
      // Fetch immediately when opened
      fetchAssignmentCount();
      
      // Set up periodic refresh while sheet is open
      const refreshInterval = setInterval(() => {
        fetchAssignmentCount();
      }, 5000);
      
      // Clean up interval when sheet is closed
      return () => clearInterval(refreshInterval);
    }
  }, [sheetOpen, user]);
  
  // Apply RTL fixes to sheet content
  const { setRef: setSheetRef } = useRTLComponentFix('dialog');
  const { setRef: setTabsRef } = useRTLComponentFix('navigation');
  
  const fetchAssignmentCount = async () => {
    if (isLoadingCount) return;
    
    setIsLoadingCount(true);
    try {
      const response = await fetch("/api/assignments/count", {
        // Add cache control headers to prevent caching issues
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        // Add credentials to ensure cookies are sent
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssignmentCount(data.total || 0);
      } else {
        console.error("Failed to fetch assignment count:", await response.text());
        // Set a default value on error
        setAssignmentCount(0);
      }
    } catch (error) {
      console.error("Error fetching assignment count:", error);
      // Set a default value on network error
      setAssignmentCount(0);
    } finally {
      setIsLoadingCount(false);
    }
  };

  // Define public routes where the quick actions menu should not appear
  const publicRoutes = ['/', '/login', '/signup', '/forgot-password', '/magic-link-login', '/reset-password'];
  
  // Check if we're on a public route
  const isPublicRoute = typeof window !== 'undefined' && publicRoutes.includes(window.location.pathname);
  
  // Only render on mobile devices and not on public routes
  if (!isMobile || isPublicRoute) return null;

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    setSheetOpen(!sheetOpen);
  };

  const handleAction = (action: string) => {
    setSheetOpen(false);
    setIsOpen(false);
    
    // Open the appropriate dialog based on the action
    if (action === t("scan_asset")) {
      setShowAssetScanner(true);
    } else if (action === t("scan_food_item")) {
      setShowFoodScanner(true);
    } else if (action === t("create_ticket")) {
      setShowCreateTicket(true);
    } else if (action === t("register_vehicle")) {
      setShowRegisterVehicle(true);
    } else if (action === t("add_task")) {
      setShowAddTask(true);
    } else if (action === t("register_new_supply")) {
      setShowRegisterSupply(true);
    } else if (action === t("register_new_asset")) {
      setShowRegisterAsset(true);
    }
  };

  // Define colors for each category
  const assetColor = "#6366f1"; // Indigo
  const foodColor = "#3b82f6"; // Blue
  const otherColor = "#8b5cf6"; // Purple

  // Animation variants for the FAB with morphing effect
  const fabVariants = {
    initial: { opacity: 0, scale: 0, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0, y: 20 },
    hover: { 
      scale: 1.05, 
      boxShadow: isDark
        ? "0 8px 25px rgba(var(--primary-rgb), 0.7), 0 4px 10px rgba(0, 0, 0, 0.3)"
        : "0 8px 25px rgba(var(--primary-rgb), 0.5), 0 4px 10px rgba(0, 0, 0, 0.1)"
    },
    tap: { scale: 0.95 },
    // Morphing animation states
    closed: { 
      borderRadius: "1rem", // rounded-2xl
      rotate: 0
    },
    open: { 
      borderRadius: "50%", // circle
      rotate: isRtl ? -15 : 15,
      scale: 1.05
    }
  };

  // Animation variants for the icon inside FAB
  const iconVariants = {
    closed: { rotate: 0, scale: 1 },
    open: { rotate: 45, scale: 1.1 }
  };
  
  // Animation variants for the sheet content
  const sheetVariants = {
    hidden: { y: "100%", opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        damping: 25, 
        stiffness: 300,
        when: "beforeChildren",
        staggerChildren: 0.05
      }
    },
    exit: { 
      y: "100%", 
      opacity: 0,
      transition: { 
        type: "spring", 
        damping: 25, 
        stiffness: 300 
      }
    }
  };
  
  // Animation variants for sheet content items
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", damping: 20, stiffness: 300 }
    }
  };

  return (
    <>
      {/* Redesigned Floating Action Button with enhanced visuals */}
      <motion.button
        className={cn(
          "fixed z-50 flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-slate-900",
          isRtl ? "left-4" : "right-4",
          "bottom-24" // Position above the mobile nav bar
        )}
        style={{
          background: `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.85) 100%)`,
          boxShadow: isDark 
            ? "0 8px 20px rgba(var(--primary-rgb), 0.5), 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)" 
            : "0 8px 20px rgba(var(--primary-rgb), 0.3), 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.3)",
          backdropFilter: "blur(4px)",
          transform: isRtl ? "rotate(0deg)" : "rotate(0deg)", // Ensures proper orientation in both RTL and LTR
        }}
        variants={fabVariants}
        initial="initial"
        animate={[isOpen ? "open" : "closed", "animate"]}
        exit="exit"
        whileHover="hover"
        whileTap="tap"
        onClick={toggleMenu}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 20,
          borderRadius: { duration: 0.3, ease: "easeInOut" },
          rotate: { duration: 0.5, ease: [0.19, 1.0, 0.22, 1.0] } // Ease out expo for smooth morphing
        }}
        aria-label={isOpen ? t("close") : t("quick_actions")}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Inner glow effect */}
        <div 
          className="absolute inset-2 rounded-xl opacity-30"
          style={{
            background: isDark 
              ? "radial-gradient(circle at center, rgba(255, 255, 255, 0.15) 0%, transparent 70%)"
              : "radial-gradient(circle at center, rgba(255, 255, 255, 0.8) 0%, transparent 70%)"
          }}
        ></div>
        
        {/* Subtle border effect */}
        <div 
          className="absolute inset-0 rounded-2xl border border-white/20 dark:border-white/10"
          style={{
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.1)"
          }}
        ></div>
        
        {/* Animated background pulse */}
        <div 
          className="absolute inset-1 rounded-xl animate-pulse" 
          style={{ 
            animationDuration: '4s',
            background: isDark 
              ? "radial-gradient(circle at center, rgba(var(--primary-rgb), 0.4) 0%, transparent 70%)"
              : "radial-gradient(circle at center, rgba(var(--primary-rgb), 0.3) 0%, transparent 70%)"
          }}
        ></div>
        
        {/* Icon container with enhanced visual effects */}
        <motion.div
          variants={iconVariants}
          animate={isOpen ? "open" : "closed"}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="relative z-10 flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm"
          style={{
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)"
          }}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white drop-shadow-sm" />
          ) : (
            <Plus className="w-6 h-6 text-white drop-shadow-sm" />
          )}
        </motion.div>
        
        {/* Enhanced notification badge */}
        {assignmentCount > 0 && !isOpen && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className={cn(
              "absolute -top-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg",
              isRtl ? "-left-2" : "-right-2"
            )}
            style={{
              boxShadow: "0 2px 6px rgba(239, 68, 68, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)"
            }}
          >
            {assignmentCount}
          </motion.div>
        )}
      </motion.button>

      {/* Quick Actions Sheet with improved UI */}
      <AnimatePresence mode="wait">
        {sheetOpen && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetContent
                side="bottom"
                className="pb-safe rounded-t-3xl border-t-0 shadow-2xl dark:bg-slate-900 dark:border-slate-800"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,1) 100%)",
                  backdropFilter: "blur(10px)",
                  ...(theme === 'dark' && {
                    background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,1) 100%)",
                  })
                }}
                ref={setSheetRef}
              >
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-5 mt-1 opacity-80"></div>
                
                <SheetHeader className="text-left border-b pb-4 mb-6">
                  <SheetTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent flex items-center">
                    <motion.div
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    >
                      <ListTodo className="w-5 h-5 mr-2 text-indigo-500" />
                    </motion.div>
                    {t("quick_actions")}
                  </SheetTitle>
                  <SheetDescription className="text-slate-600 dark:text-slate-400">
                    {t("quick_actions_description")}
                  </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="actions" className="w-full" ref={setTabsRef}>
                  <TabsList className="grid grid-cols-2 mb-6 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl shadow-inner">
                    <TabsTrigger 
                      value="actions"
                      className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 transition-all data-[state=active]:shadow-md py-2.5"
                    >
                      <ListTodo className="w-4 h-4 mr-2" />
                      {t("actions")}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="assignments" 
                      className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 transition-all data-[state=active]:shadow-md py-2.5 relative"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      {t("assignments")}
                      {assignmentCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-1.5 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center shadow-md">
                          {assignmentCount}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="actions">
                    <div className="mt-2">
                      <div className="grid grid-cols-2 gap-4 px-1">
                        {(() => {
                          const { hasAccess, isAdmin, loading } = pageAccessData;
                          
                          // Define all quick actions with their properties
                          const allQuickActions = [
                            {
                              icon: <Scan className="w-6 h-6 text-white" />,
                              label: t("scan_asset"),
                              color: assetColor,
                              onClick: () => handleAction(t("scan_asset")),
                              description: t("track_enterprise_assets"),
                              badge: "New",
                              pagePath: "/assets",
                              delay: 0.1,
                            },
                            {
                              icon: <Package className="w-6 h-6 text-white" />,
                              label: t("register_new_asset"),
                              color: assetColor,
                              onClick: () => handleAction(t("register_new_asset")),
                              pagePath: "/assets",
                              delay: 0.15,
                            },
                            {
                              icon: <ShoppingBag className="w-6 h-6 text-white" />,
                              label: t("register_new_supply"),
                              color: foodColor,
                              onClick: () => handleAction(t("register_new_supply")),
                              description: t("manage_food_supplies"),
                              pagePath: "/food-supply",
                              delay: 0.2,
                            },
                            {
                              icon: <Utensils className="w-6 h-6 text-white" />,
                              label: t("scan_food_item"),
                              color: foodColor,
                              onClick: () => handleAction(t("scan_food_item")),
                              pagePath: "/food-supply",
                              delay: 0.25,
                            },
                            {
                              icon: <Car className="w-6 h-6 text-white" />,
                              label: t("register_vehicle"),
                              color: otherColor,
                              onClick: () => handleAction(t("register_vehicle")),
                              description: t("manage_vehicle_fleet"),
                              pagePath: "/vehicles",
                              delay: 0.3,
                            },
                            {
                              icon: <TicketIcon className="w-6 h-6 text-white" />,
                              label: t("create_ticket"),
                              color: otherColor,
                              onClick: () => handleAction(t("create_ticket")),
                              description: t("manage_support_tickets"),
                              pagePath: "/tickets",
                              delay: 0.35,
                            },
                            {
                              icon: <CalendarPlus className="w-6 h-6 text-white" />,
                              label: t("add_task"),
                              color: otherColor,
                              onClick: () => handleAction(t("add_task")),
                              pagePath: "/planner",
                              delay: 0.4,
                              className: "col-span-2",
                            },
                          ];
                          
                          // Show loading state while permissions are being checked
                          if (loading) {
                            return (
                              <div className="col-span-2 flex justify-center items-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              </div>
                            );
                          }
                          
                          // Filter actions based on user permissions
                          const filteredActions = allQuickActions.filter(action => 
                            !action.pagePath || isAdmin || hasAccess(action.pagePath)
                          );
                          
                          // Render the filtered actions
                          return filteredActions.map((action, index) => (
                            <motion.div
                              key={action.label}
                              variants={itemVariants}
                              initial="hidden"
                              animate="visible"
                              className={action.className}
                            >
                              <QuickAction
                                icon={action.icon}
                                label={action.label}
                                color={action.color}
                                onClick={action.onClick}
                                description={action.description}
                                badge={action.badge}
                                pagePath={action.pagePath}
                                pageAccessData={pageAccessData}
                              />
                            </motion.div>
                          ));
                        })()}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="assignments">
                    <div className="mt-2">
                      <AssignedItemsList onCountChange={fetchAssignmentCount} />
                    </div>
                  </TabsContent>
                </Tabs>
              </SheetContent>
          </Sheet>
        )}
      </AnimatePresence>

      {/* Asset Scanner Dialog */}
      <BarcodeScanner 
        open={showAssetScanner} 
        onOpenChange={setShowAssetScanner} 
      />

      {/* Food Scanner Dialog */}
      <BarcodeScannerFood 
        kitchenId="default" 
        open={showFoodScanner} 
        onOpenChange={setShowFoodScanner} 
      />

      {/* Create Ticket Dialog */}
      <CreateTicketDialog 
        open={showCreateTicket} 
        onOpenChange={setShowCreateTicket} 
      />

      {/* Register Vehicle Dialog */}
      <RegisterVehicleDialog 
        open={showRegisterVehicle} 
        onOpenChange={setShowRegisterVehicle} 
      />

      {/* Add Task Dialog */}
      <TaskDialog 
        open={showAddTask} 
        onOpenChange={setShowAddTask} 
      />

      {/* Register New Supply Dialog */}
      <Dialog open={showRegisterSupply} onOpenChange={setShowRegisterSupply}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("register_new_supply")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <RegisterFoodSupplyForm 
              onSuccess={() => {
                setShowRegisterSupply(false);
                toast({
                  title: t("success"),
                  description: t("food_supply_registered_successfully"),
                });
              }}
              onCancel={() => setShowRegisterSupply(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Register New Asset Dialog */}
      <Dialog open={showRegisterAsset} onOpenChange={setShowRegisterAsset}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("register_new_asset")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <RegisterAssetForm 
              onSuccess={(newAsset) => {
                setShowRegisterAsset(false);
                toast({
                  title: t("success"),
                  description: t("asset_registered_successfully"),
                });
              }}
              onCancel={() => setShowRegisterAsset(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}