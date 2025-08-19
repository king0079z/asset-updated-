import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/contexts/TranslationContext";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { 
  Smartphone, 
  Menu, 
  BarChart2, 
  Zap, 
  Scan, 
  MapPin, 
  Clock, 
  CheckCircle,
  ArrowRight
} from "lucide-react";

// Memoized feature component to prevent unnecessary re-renders
const FeatureCard = React.memo(({ feature, index }: { 
  feature: { 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    color: string 
  }; 
  index: number 
}) => {
  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 + (index * 0.1), duration: 0.5 }}
      whileHover={{ x: 10 }}
      className="bg-card border border-primary/10 rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow"
      layout
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${feature.color.split(' ')[0]} ${feature.color.split(' ')[1]}`}>
          {feature.icon}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <Badge className={feature.color}>
              Mobile Feature
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

FeatureCard.displayName = 'FeatureCard';

// Memoized quick action button to prevent unnecessary re-renders
const QuickActionButton = React.memo(({ icon, label, index }: { 
  icon: React.ReactNode; 
  label: string; 
  index: number 
}) => {
  return (
    <motion.div 
      key={index}
      className="flex flex-col items-center p-2"
      whileHover={{ scale: 1.1 }}
      layout
    >
      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mb-1">
        {icon}
      </div>
      <span className="text-[10px]">{label}</span>
    </motion.div>
  );
});

QuickActionButton.displayName = 'QuickActionButton';

const MobileFeatureShowcase = () => {
  const { t } = useTranslation();

  // Mobile features to showcase - memoized to prevent unnecessary recalculations
  const mobileFeatures = useMemo(() => [
    {
      title: t('responsive_design'),
      description: t('fully_responsive_design') || "Fully responsive design that adapts to any screen size",
      icon: <Smartphone className="w-5 h-5" />,
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20"
    },
    {
      title: t('mobile_menu') || "Mobile Menu",
      description: t('intuitive_mobile_menu') || "Intuitive mobile menu with smooth animations",
      icon: <Menu className="w-5 h-5" />,
      color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
    },
    {
      title: t('touch_optimized') || "Touch Optimized",
      description: t('touch_friendly_controls') || "Touch-friendly controls and interactions",
      icon: <Zap className="w-5 h-5" />,
      color: "bg-violet-500/10 text-violet-500 border-violet-500/20"
    },
    {
      title: t('barcode_scanning') || "Barcode Scanning",
      description: t('scan_barcodes_mobile') || "Scan barcodes directly from your mobile device",
      icon: <Scan className="w-5 h-5" />,
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    },
    {
      title: t('location_tracking') || "Location Tracking",
      description: t('track_assets_on_the_go') || "Track assets and vehicles on the go",
      icon: <MapPin className="w-5 h-5" />,
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20"
    },
    {
      title: t('real_time_updates') || "Real-time Updates",
      description: t('receive_instant_notifications') || "Receive instant notifications and updates",
      icon: <Clock className="w-5 h-5" />,
      color: "bg-rose-500/10 text-rose-500 border-rose-500/20"
    }
  ], [t]);

  return (
    <section className="py-20 bg-gradient-to-br from-background to-accent/5 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary-rgb)/5,transparent_70%)]"></div>
      <div className="absolute top-1/4 left-0 w-full h-full bg-[conic-gradient(from_180deg_at_50%_50%,var(--primary-rgb)/5_0deg,transparent_60deg,transparent_300deg,var(--primary-rgb)/5_360deg)]"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Badge className="mb-4 px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {t('mobile_ready') || "Mobile Ready"}
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/80">
            {t('optimized_for_mobile') || "Optimized for Mobile Devices"}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t('manage_assets_anywhere') || "Manage your assets, track vehicles, and handle tickets from anywhere, on any device"}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Column - Mobile Device Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mx-auto"
          >
            <div className="relative max-w-[280px] mx-auto">
              {/* Phone Frame */}
              <div className="relative bg-gray-900 rounded-[3rem] p-2 shadow-2xl border-4 border-gray-800 z-0">
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-20 h-3 bg-gray-800 rounded-full"></div>
                
                {/* Screen Content */}
                <div className="relative bg-background rounded-[2.5rem] overflow-hidden h-[540px]">
                  {/* Mobile Header */}
                  <div className="bg-primary/10 backdrop-blur-sm p-4 border-b border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <Smartphone className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold text-sm">{t('asset_manager')}</span>
                      </div>
                      <Menu className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  
                  {/* Mobile Content */}
                  <div className="p-4">
                    <div className="mb-4">
                      <h3 className="text-sm font-medium mb-2">{t('dashboard')}</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <motion.div 
                          className="bg-card p-3 rounded-lg border border-primary/10 shadow-sm"
                          whileHover={{ y: -5 }}
                        >
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-1">
                              <BarChart2 className="w-4 h-4 text-blue-500" />
                            </div>
                            <span className="text-xs font-medium">{t('assets')}</span>
                            <span className="text-xs text-muted-foreground">24</span>
                          </div>
                        </motion.div>
                        <motion.div 
                          className="bg-card p-3 rounded-lg border border-primary/10 shadow-sm"
                          whileHover={{ y: -5 }}
                        >
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center mb-1">
                              <CheckCircle className="w-4 h-4 text-indigo-500" />
                            </div>
                            <span className="text-xs font-medium">{t('tasks')}</span>
                            <span className="text-xs text-muted-foreground">8</span>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <h3 className="text-sm font-medium mb-2">{t('recent_activity')}</h3>
                      <div className="space-y-2">
                        <motion.div 
                          className="bg-card p-3 rounded-lg border border-primary/10 shadow-sm"
                          whileHover={{ x: 5 }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                              <Scan className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <span className="text-xs font-medium">{t('asset_scanned')}</span>
                              <p className="text-xs text-muted-foreground">{t('laptop')} #1234</p>
                            </div>
                          </div>
                        </motion.div>
                        <motion.div 
                          className="bg-card p-3 rounded-lg border border-primary/10 shadow-sm"
                          whileHover={{ x: 5 }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                              <MapPin className="w-4 h-4 text-amber-500" />
                            </div>
                            <div>
                              <span className="text-xs font-medium">{t('location_updated')}</span>
                              <p className="text-xs text-muted-foreground">{t('vehicle')} #V-789</p>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                    
                    {/* Mobile Menu Preview */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-card rounded-xl border border-primary/20 shadow-lg overflow-hidden">
                        <div className="p-3 border-b border-primary/10">
                          <h3 className="text-xs font-medium">{t('quick_actions')}</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-1 p-2">
                          {useMemo(() => [
                            { icon: <Scan className="w-3 h-3" />, label: t('scan') },
                            { icon: <MapPin className="w-3 h-3" />, label: t('track') },
                            { icon: <CheckCircle className="w-3 h-3" />, label: t('tasks') },
                            { icon: <ArrowRight className="w-3 h-3" />, label: t('more') }
                          ], [t]).map((item, index) => (
                            <QuickActionButton 
                              key={index}
                              icon={item.icon}
                              label={item.label}
                              index={index}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <motion.div 
                className="absolute -top-6 -right-6 bg-blue-500/15 rounded-xl p-3 border border-blue-500/30 shadow-xl z-10 backdrop-blur-sm"
                initial={{ opacity: 0, y: 20, rotate: -2 }}
                animate={{ 
                  opacity: 1, 
                  rotate: 0,
                  y: [0, -4, 0] // Combined floating animation
                }}
                transition={{ 
                  y: {
                    duration: 3,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut"
                  },
                  opacity: { 
                    duration: 0.5, 
                    delay: 0.8 
                  },
                  rotate: {
                    type: "spring", 
                    stiffness: 100, 
                    damping: 10, 
                    delay: 0.8
                  }
                }}
                whileHover={{ 
                  y: -8, 
                  scale: 1.08, 
                  rotate: 2,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  transition: { 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 10 
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="bg-blue-500/20 p-1.5 rounded-full"
                    whileHover={{ 
                      scale: 1.2,
                      backgroundColor: "rgba(59, 130, 246, 0.3)" 
                    }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <Zap className="w-4 h-4 text-blue-500" />
                  </motion.div>
                  <span className="text-xs font-medium">{t('fast_responsive')}</span>
                </div>
              </motion.div>
              
              <motion.div 
                className="absolute -bottom-6 -left-6 bg-emerald-500/15 rounded-xl p-3 border border-emerald-500/30 shadow-xl z-10 backdrop-blur-sm"
                initial={{ opacity: 0, y: 20, rotate: 2 }}
                animate={{ 
                  opacity: 1, 
                  rotate: 0,
                  y: [0, -4, 0] // Combined floating animation
                }}
                transition={{ 
                  y: {
                    duration: 3,
                    delay: 0.5, // Offset from the first card for visual interest
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut"
                  },
                  opacity: { 
                    duration: 0.5, 
                    delay: 1 
                  },
                  rotate: {
                    type: "spring", 
                    stiffness: 100, 
                    damping: 10, 
                    delay: 1
                  }
                }}
                whileHover={{ 
                  y: -8, 
                  scale: 1.08, 
                  rotate: -2,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  transition: { 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 10 
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="bg-emerald-500/20 p-1.5 rounded-full"
                    whileHover={{ 
                      scale: 1.2,
                      backgroundColor: "rgba(16, 185, 129, 0.3)" 
                    }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <Scan className="w-4 h-4 text-emerald-500" />
                  </motion.div>
                  <span className="text-xs font-medium">{t('scan_anywhere')}</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
          
          {/* Right Column - Mobile Features */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            {mobileFeatures.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MobileFeatureShowcase;