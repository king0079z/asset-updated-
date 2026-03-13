import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Utensils, 
  Car, 
  Users, 
  BarChart2, 
  Shield, 
  Brain, 
  Calendar, 
  TicketCheck,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from "@/contexts/TranslationContext";

interface Feature {
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  badgeKey?: string;
  category: 'management' | 'intelligence' | 'operations';
  highlightKeys?: string[];
}

const FeatureShowcase: React.FC = () => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'all' | 'management' | 'intelligence' | 'operations'>('all');
  
  const features: Feature[] = [
    {
      titleKey: "asset_tracking",
      descriptionKey: "track_all_enterprise_assets",
      icon: <Package className="w-10 h-10" />,
      color: "bg-blue-500/10 text-blue-500",
      gradient: "from-blue-500/20 to-blue-600/5",
      badgeKey: "popular",
      category: "management",
      highlightKeys: ["real_time_location_tracking", "maintenance_scheduling", "asset_lifecycle_management"]
    },
    {
      titleKey: "food_supply_management",
      descriptionKey: "monitor_inventory_levels",
      icon: <Utensils className="w-10 h-10" />,
      color: "bg-green-500/10 text-green-500",
      gradient: "from-green-500/20 to-green-600/5",
      category: "operations",
      highlightKeys: ["inventory_monitoring", "consumption_analytics", "automated_reordering"]
    },
    {
      titleKey: "vehicle_fleet_management",
      descriptionKey: "manage_vehicle_assignments",
      icon: <Car className="w-10 h-10" />,
      color: "bg-purple-500/10 text-purple-500",
      gradient: "from-purple-500/20 to-purple-600/5",
      category: "management",
      highlightKeys: ["fleet_optimization", "maintenance_tracking", "usage_analytics"]
    },
    {
      titleKey: "staff_activity_monitoring",
      descriptionKey: "track_staff_activities",
      icon: <Users className="w-10 h-10" />,
      color: "bg-amber-500/10 text-amber-500",
      gradient: "from-amber-500/20 to-amber-600/5",
      category: "operations",
      highlightKeys: ["activity_logging", "performance_metrics", "compliance_reporting"]
    },
    {
      titleKey: "analytics_dashboard",
      descriptionKey: "gain_insights",
      icon: <BarChart2 className="w-10 h-10" />,
      color: "bg-cyan-500/10 text-cyan-500",
      gradient: "from-cyan-500/20 to-cyan-600/5",
      category: "intelligence",
      highlightKeys: ["custom_reports", "data_visualization", "trend_analysis"]
    },
    {
      titleKey: "compliance_management",
      descriptionKey: "ensure_regulatory_compliance",
      icon: <Shield className="w-10 h-10" />,
      color: "bg-red-500/10 text-red-500",
      gradient: "from-red-500/20 to-red-600/5",
      category: "operations",
      highlightKeys: ["regulatory_tracking", "compliance_alerts", "audit_preparation"]
    },
    {
      titleKey: "ai_powered_insights",
      descriptionKey: "leverage_artificial_intelligence",
      icon: <Brain className="w-10 h-10" />,
      color: "bg-indigo-500/10 text-indigo-500",
      gradient: "from-indigo-500/20 to-indigo-600/5",
      badgeKey: "new",
      category: "intelligence",
      highlightKeys: ["predictive_analytics", "anomaly_detection", "cost_optimization"]
    },
    {
      titleKey: "task_planner",
      descriptionKey: "plan_assign_track_tasks",
      icon: <Calendar className="w-10 h-10" />,
      color: "bg-pink-500/10 text-pink-500",
      gradient: "from-pink-500/20 to-pink-600/5",
      category: "management",
      highlightKeys: ["task_assignment", "progress_tracking", "calendar_integration"]
    },
    {
      titleKey: "ticketing_system",
      descriptionKey: "create_assign_track_tickets",
      icon: <TicketCheck className="w-10 h-10" />,
      color: "bg-orange-500/10 text-orange-500",
      gradient: "from-orange-500/20 to-orange-600/5",
      category: "operations",
      highlightKeys: ["priority_based_routing", "resolution_tracking", "asset_linking"]
    }
  ];

  // Filter features based on active category
  const filteredFeatures = activeCategory === 'all' 
    ? features 
    : features.filter(feature => feature.category === activeCategory);

  // Animation variants for cards
  const cardVariants = {
    hover: {
      y: -5,
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      transition: {
        duration: 0.2
      }
    }
  };

  // Animation variants for feature list items
  const listItemVariants = {
    initial: { opacity: 0, x: -10 },
    animate: (index: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: index * 0.05,
        duration: 0.3
      }
    })
  };

  // Category labels and colors
  const categories = [
    { id: 'all', labelKey: 'all_features', color: 'bg-primary/10 text-primary' },
    { id: 'management', labelKey: 'management', color: 'bg-blue-500/10 text-blue-500' },
    { id: 'intelligence', labelKey: 'intelligence', color: 'bg-indigo-500/10 text-indigo-500' },
    { id: 'operations', labelKey: 'operations', color: 'bg-orange-500/10 text-orange-500' }
  ];

  return (
    <div className="py-20 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/0 via-background/80 to-background"></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-4">
        {/* Header section with higher z-index */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 relative z-50"
        >
          <Badge variant="outline" className="mb-4 px-3 py-1 text-sm border-primary/30 bg-primary/5">
            {t('enterprise_solutions')}
          </Badge>
          <h2 className="text-4xl font-bold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            {t('powerful_tools')}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t('comprehensive_suite')}
          </p>
        </motion.div>

        {/* Category Tabs with higher z-index */}
        <motion.div 
          className="mb-12 flex justify-center relative z-40"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs 
            defaultValue="all" 
            className="w-full max-w-3xl"
            onValueChange={(value) => setActiveCategory(value as any)}
          >
            <TabsList className="grid grid-cols-4 w-full">
              {categories.map(category => (
                <TabsTrigger 
                  key={category.id} 
                  value={category.id}
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  {t(category.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-center gap-12 relative z-30">
          {/* 3D Rotating Feature Display */}
          <div className="w-full lg:w-1/2 relative h-[500px] z-10">
            <div className="absolute inset-0 flex items-center justify-center perspective-[1200px]">
              {filteredFeatures.map((feature, index) => {
                const isActive = index === activeIndex;
                
                // Calculate position based on distance from active index
                const distance = ((index - activeIndex + filteredFeatures.length) % filteredFeatures.length);
                
                // Determine if card is to the left or right of active card
                const isLeft = distance > filteredFeatures.length / 2;
                const isRight = distance > 0 && distance < filteredFeatures.length / 2;
                
                // Calculate normalized offset (-0.5 to 0.5 range)
                const normalizedOffset = isLeft 
                  ? (distance - filteredFeatures.length) / filteredFeatures.length 
                  : distance / filteredFeatures.length;
                
                // Calculate z-index to prevent overlapping within the 3D card container
                // But keep all cards below the feature navigation section
                const zIndex = isActive 
                  ? 5 
                  : 5 - Math.abs(distance);
                
                return (
                  <motion.div
                    key={feature.titleKey}
                    className="absolute w-full max-w-md"
                    initial={false}
                    animate={{
                      // Position cards in a carousel-like arrangement
                      x: isActive 
                        ? 0 
                        : `${normalizedOffset * 120}%`,
                      // Scale down cards that are not active
                      scale: isActive 
                        ? 1 
                        : 0.85 - Math.abs(normalizedOffset) * 0.15,
                      // Reduce opacity for cards that are further away
                      opacity: isActive 
                        ? 1 
                        : 0.7 - Math.abs(normalizedOffset) * 0.4,
                      // Rotate cards to create 3D effect without causing overlap
                      rotateY: normalizedOffset * 30,
                      // Move cards back in z-space based on distance
                      z: isActive 
                        ? 0 
                        : -150 * Math.abs(normalizedOffset),
                      // Add slight vertical offset to create a more natural 3D arrangement
                      y: isActive 
                        ? 0 
                        : Math.abs(normalizedOffset) * 20,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 25,
                      mass: 1
                    }}
                    style={{ 
                      zIndex,
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden"
                    }}
                    whileHover={isActive ? "hover" : undefined}
                    variants={cardVariants}
                  >
                    <Card className={`overflow-hidden border border-primary/20 shadow-xl bg-gradient-to-br ${feature.gradient} backdrop-blur-sm`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full"></div>
                      <CardContent className="p-8 relative">
                        {feature.badgeKey && (
                          <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                            {t(feature.badgeKey)}
                          </Badge>
                        )}
                        <div className={`rounded-full p-4 inline-block mb-5 ${feature.color} shadow-inner`}>
                          {feature.icon}
                        </div>
                        <h3 className="text-2xl font-bold mb-3">{t(feature.titleKey)}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">{t(feature.descriptionKey)}</p>
                        
                        {feature.highlightKeys && isActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, staggerChildren: 0.1 }}
                            className="mt-4 space-y-2"
                          >
                            {feature.highlightKeys.map((highlightKey, idx) => (
                              <motion.div 
                                key={idx}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + (idx * 0.1) }}
                                className="flex items-center gap-2"
                              >
                                <Sparkles className="h-4 w-4 text-primary" />
                                <span className="text-xs">{t(highlightKey)}</span>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}
                        
                        {isActive && (
                          <motion.div 
                            className="mt-6 flex items-center text-sm text-primary"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            <span className="mr-2">{t('learn_more')}</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Card navigation dots */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 pb-4 z-5">
              {filteredFeatures.map((_, index) => (
                <motion.button
                  key={index}
                  className={`w-2 h-2 rounded-full ${index === activeIndex ? 'bg-primary' : 'bg-primary/30'}`}
                  onClick={() => setActiveIndex(index)}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                />
              ))}
            </div>
          </div>
          
          {/* Feature Navigation */}
          <div className="w-full lg:w-1/2 relative z-20">
            <motion.h2 
              className="text-3xl font-bold mb-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              {t('explore_our_features')}
            </motion.h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              {filteredFeatures.map((feature, index) => (
                <motion.div
                  key={feature.titleKey}
                  custom={index}
                  variants={listItemVariants}
                  initial="initial"
                  animate="animate"
                  className={`p-4 rounded-lg cursor-pointer flex items-center transition-all ${
                    activeIndex === index 
                      ? `bg-gradient-to-r ${feature.gradient} border border-primary/30 shadow-md` 
                      : 'hover:bg-primary/5'
                  }`}
                  onClick={() => setActiveIndex(index)}
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`rounded-full p-3 mr-4 ${feature.color} shadow-sm`}>
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-medium text-lg ${activeIndex === index ? 'text-primary' : ''}`}>
                        {t(feature.titleKey)}
                      </h3>
                      {activeIndex === index && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-primary"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </motion.div>
                      )}
                    </div>
                    {activeIndex === index && (
                      <motion.p 
                        className="text-sm text-muted-foreground mt-2"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {t(feature.descriptionKey)}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            
            <motion.div 
              className="mt-8 pt-6 border-t border-primary/10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('all_features_included')}
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                >
                  {t('request_demo')}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureShowcase;