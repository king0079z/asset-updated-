import React, { useEffect, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import { Package, Utensils, Car, BarChart2, MapPin, Clock, Shield, Users, Activity, Truck, FileText, BarChart, CheckCircle, ArrowRight, ArrowLeft, Building, Database, Calendar, Brain, Zap, Lightbulb, Sparkles, Star, HelpCircle, ChevronRight, Layers, Settings, Workflow, MousePointerClick, ArrowUpRight, Globe, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionCard } from "@/components/MotionCard";
import FloatingIcons from "@/components/FloatingIcons";
import FeatureShowcase from "@/components/FeatureShowcase";
import FeatureComparison from "@/components/FeatureComparison";
import AnimatedStats from "@/components/AnimatedStats";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import FaqSection from "@/components/FaqSection";
import HowItWorks from "@/components/HowItWorks";
import EnhancedFeatureCard from "@/components/EnhancedFeatureCard";
import LoadingAnimation from "@/components/LoadingAnimation";
import MobileFeatureShowcase from "@/components/MobileFeatureShowcase";
import VendorEvaluationFeature from "@/components/VendorEvaluationFeature";
import { useTranslation } from "@/contexts/TranslationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const isSmallMobile = useMediaQuery('(max-width: 380px)');
  const [isLoading, setIsLoading] = useState(true);
  
  // Simulate loading state for demonstration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);
  
  const features = [
    {
      title: t('asset_management_title'),
      description: t('asset_management_description'),
      icon: <Package className="w-12 h-12" />,
      color: "from-blue-500/20 to-blue-600/20",
      delay: 0.2
    },
    {
      title: t('ticketing_system_title'),
      description: t('ticketing_system_description'),
      icon: <FileText className="w-12 h-12" />,
      color: "from-indigo-500/20 to-indigo-600/20",
      delay: 0.3
    },
    {
      title: t('task_planner_title'),
      description: t('task_planner_description'),
      icon: <Calendar className="w-12 h-12" />,
      color: "from-cyan-500/20 to-cyan-600/20",
      delay: 0.4
    },
    {
      title: t('ai_powered_insights_title'),
      description: t('ai_powered_insights_description'),
      icon: <Brain className="w-12 h-12" />,
      color: "from-violet-500/20 to-violet-600/20",
      delay: 0.5
    },
    {
      title: t('food_supply_management_title'),
      description: t('food_supply_management_description'),
      icon: <Utensils className="w-12 h-12" />,
      color: "from-green-500/20 to-green-600/20",
      delay: 0.6
    },
    {
      title: t('vehicle_fleet_management_title'),
      description: t('vehicle_fleet_management_description'),
      icon: <Car className="w-12 h-12" />,
      color: "from-purple-500/20 to-purple-600/20",
      delay: 0.7
    },
    {
      title: t('staff_activity_tracking_title'),
      description: t('staff_activity_tracking_description'),
      icon: <Users className="w-12 h-12" />,
      color: "from-amber-500/20 to-amber-600/20",
      delay: 0.8
    }
  ];

  const keyFeatures = [
    { name: t('barcode_integration'), icon: <Activity className="w-5 h-5 mr-2" /> },
    { name: t('gps_location_tracking'), icon: <MapPin className="w-5 h-5 mr-2" /> },
    { name: t('real_time_analytics'), icon: <BarChart2 className="w-5 h-5 mr-2" /> },
    { name: t('inventory_management'), icon: <Package className="w-5 h-5 mr-2" /> },
    { name: t('maintenance_scheduling'), icon: <Clock className="w-5 h-5 mr-2" /> },
    { name: t('usage_reports'), icon: <FileText className="w-5 h-5 mr-2" /> },
    { name: t('supply_chain_tracking'), icon: <Truck className="w-5 h-5 mr-2" /> },
    { name: t('compliance_monitoring'), icon: <Shield className="w-5 h-5 mr-2" /> }
  ];

  return (
    <>
      <Head>
        <title>Enterprise Asset Management System</title>
        <meta name="description" content="Complete enterprise asset and resource management solution" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {/* Loading Animation */}
      <LoadingAnimation duration={2500} />
      
      <div className="bg-background min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1">
          {/* Hero Section */}
          <section id="hero" className="relative overflow-hidden pt-20 pb-32 md:pt-28 md:pb-40">
            {/* Background Elements */}
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary-rgb)/10,transparent_50%)]"></div>
              <div className="absolute top-1/4 left-0 w-full h-full bg-[conic-gradient(from_180deg_at_50%_50%,var(--primary-rgb)/10_0deg,transparent_60deg,transparent_300deg,var(--primary-rgb)/10_360deg)]"></div>
              <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-70"></div>
              <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-70"></div>
            </div>
            
            {/* Animated Particles */}
            <FloatingIcons />
            
            <div className="container mx-auto px-4 sm:px-6 relative z-10">
              <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center">
                {/* Left Column - Text Content */}
                <div className="flex flex-col max-w-2xl mx-auto lg:mx-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-6"
                  >
                    <Badge id="enterprise_solution" className="mb-6 px-4 py-1.5 text-sm bg-primary/10 text-primary border-primary/20 rounded-full">
                      {t('enterprise_solution')}
                    </Badge>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/80 leading-tight tracking-tight">
                      {t('intelligent_asset_management_system')}
                    </h1>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                      {t('comprehensive_platform')}
                    </p>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex flex-col sm:flex-row flex-wrap gap-4 mb-10"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full sm:w-auto"
                    >
                      <Link href="/login" className="w-full sm:w-auto">
                        <Button size="lg" className="w-full sm:w-auto text-lg px-4 sm:px-8 py-4 sm:py-6 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300">
                          {t('get_started')} {t('language') === 'العربية' ? 
                            <ArrowLeft className="mr-2 h-5 w-5 rtl:rotate-180" /> : 
                            <ArrowRight className="ml-2 h-5 w-5" />}
                        </Button>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full sm:w-auto"
                    >
                      <Link href="/dashboard" className="w-full sm:w-auto">
                        <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-4 sm:px-8 py-4 sm:py-6 rounded-full border-primary/20 hover:bg-primary/5 transition-all duration-300">
                          {t('view_demo')} <ArrowUpRight className="mx-2 h-5 w-5" />
                        </Button>
                      </Link>
                    </motion.div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {keyFeatures.slice(0, 4).map((feature, index) => (
                      <motion.div 
                        key={index} 
                        className="flex items-center gap-2 group"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + (index * 0.1) }}
                        whileHover={{ x: 5 }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors duration-300">
                          {React.cloneElement(feature.icon, { className: 'w-4 h-4' })}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                          {feature.name}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
                
                {/* Right Column - Interactive Display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="relative max-w-xl mx-auto lg:mx-0"
                >
                  {/* Main Display Card */}
                  <div className="relative">
                    {/* Glow Effect */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-primary/20 rounded-2xl blur-xl opacity-70"></div>
                    
                    {/* Card Content */}
                    <div className="relative bg-card/80 backdrop-blur-sm rounded-2xl border border-primary/20 shadow-2xl overflow-hidden">
                      {/* Card Header */}
                      <div className="p-4 border-b border-primary/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <div className="text-xs text-muted-foreground">Enterprise Dashboard</div>
                        <div className="flex items-center gap-2">
                          <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      
                      {/* Card Body */}
                      <div className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {features.map((feature, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 + (index * 0.1), duration: 0.5 }}
                              whileHover={{ y: -5, scale: 1.03 }}
                              className="bg-background/80 backdrop-blur-sm p-4 rounded-xl border border-primary/10 flex flex-col items-center text-center hover:border-primary/30 hover:shadow-md transition-all duration-300"
                            >
                              <div className={`p-3 rounded-full bg-gradient-to-br ${feature.color} mb-3 shadow-inner`}>
                                <div className="text-primary">
                                  {React.cloneElement(feature.icon as React.ReactElement, { className: 'w-6 h-6' })}
                                </div>
                              </div>
                              <h3 className="text-sm font-medium">{feature.title.split(' ')[0]}</h3>
                            </motion.div>
                          ))}
                        </div>
                        
                        {/* Interactive Elements */}
                        <div className="mt-6 bg-background/50 rounded-xl p-4 border border-primary/10">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium flex items-center">
                              <Activity className="w-4 h-4 mr-2 text-primary" />
                              System Status
                            </h3>
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              All Systems Operational
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="h-2 bg-background rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-primary"
                                initial={{ width: "0%" }}
                                animate={{ width: "92%" }}
                                transition={{ delay: 1, duration: 1.5 }}
                              ></motion.div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Resources</span>
                              <span>92%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating Elements */}
                  <motion.div 
                    className="absolute -top-6 -right-6 bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 shadow-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ 
                      opacity: 1, 
                      y: [0, -5, 0],
                      rotate: [-1, 1, -1],
                      transition: {
                        y: {
                          repeat: Infinity,
                          duration: 3,
                          ease: "easeInOut"
                        },
                        rotate: {
                          repeat: Infinity,
                          duration: 4,
                          ease: "easeInOut"
                        },
                        opacity: { duration: 0.5, delay: 1 }
                      }
                    }}
                    whileHover={{ 
                      y: -10, 
                      rotate: 0,
                      scale: 1.05,
                      backgroundColor: "rgba(59, 130, 246, 0.2)",
                      boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.3)",
                      transition: { duration: 0.3 }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        <Shield className="w-5 h-5 text-blue-500" />
                      </motion.div>
                      <span className="text-xs font-medium">Enterprise Security</span>
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    className="absolute -bottom-6 -left-6 bg-amber-500/10 rounded-xl p-4 border border-amber-500/20 shadow-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ 
                      opacity: 1, 
                      y: [0, -5, 0],
                      rotate: [1, -1, 1],
                      transition: {
                        y: {
                          repeat: Infinity,
                          duration: 3.5,
                          ease: "easeInOut"
                        },
                        rotate: {
                          repeat: Infinity,
                          duration: 4.5,
                          ease: "easeInOut"
                        },
                        opacity: { duration: 0.5, delay: 1.2 }
                      }
                    }}
                    whileHover={{ 
                      y: -10, 
                      rotate: 0,
                      scale: 1.05,
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.3)",
                      transition: { duration: 0.3 }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.2 }}
                        transition={{ duration: 0.5 }}
                      >
                        <Brain className="w-5 h-5 text-amber-500" />
                      </motion.div>
                      <span className="text-xs font-medium">AI-Powered Insights</span>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
              
              {/* Scroll Indicator */}
              <motion.div 
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.5 }}
              >
                <span className="text-sm text-muted-foreground mb-2">Scroll to explore</span>
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* Main Features Section */}
          <section className="py-24 bg-background relative overflow-hidden">
            {/* Enhanced background decorative elements */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-80"></div>
            <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-primary/10 to-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-80"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-6xl max-h-6xl bg-[radial-gradient(circle,var(--primary-rgb)/3_0%,transparent_70%)] z-0"></div>
            
            {/* Animated particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-primary/30"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -Math.random() * 100 - 50],
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{
                    duration: 5 + Math.random() * 5,
                    repeat: Infinity,
                    delay: Math.random() * 5,
                  }}
                />
              ))}
            </div>
            
            <div className="container mx-auto px-4 relative z-10">
              <motion.div 
                className="text-center mb-20"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="inline-block"
                >
                  <Badge className="mb-5 px-4 py-1.5 text-sm bg-primary/10 text-primary border-primary/20 rounded-full shadow-sm">
                    {useTranslation().t('core_capabilities')}
                  </Badge>
                </motion.div>
                
                <motion.h2 
                  className="text-4xl md:text-5xl font-bold mb-5 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/80 leading-tight tracking-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  {useTranslation().t('powerful_management_tools')}
                </motion.h2>
                
                <motion.p 
                  className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {useTranslation().t('comprehensive_tools')}
                </motion.p>
              </motion.div>

              {/* Enhanced feature cards with improved layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {features.map((feature, index) => {
                  // Prepare badges for each feature
                  let badges = [];
                  
                  if (feature.title === t('asset_management_title')) {
                    badges = [t('barcode_integration'), t('gps_location_tracking'), t('asset_lifecycle_management')];
                  } else if (feature.title === t('ticketing_system_title')) {
                    badges = [t('priority_based_routing'), t('resolution_tracking'), t('asset_linking')];
                  } else if (feature.title === t('task_planner_title')) {
                    badges = [t('calendar_integration'), t('task_assignment'), t('progress_tracking')];
                  } else if (feature.title === t('ai_powered_insights_title')) {
                    badges = [t('anomaly_detection'), t('predictive_analytics'), t('cost_optimization')];
                  } else if (feature.title === t('food_supply_management_title')) {
                    badges = [t('inventory_monitoring'), t('consumption_analytics'), t('automated_reordering')];
                  } else if (feature.title === t('vehicle_fleet_management_title')) {
                    badges = [t('fleet_optimization'), t('maintenance_tracking'), t('usage_analytics')];
                  } else if (feature.title === t('staff_activity_tracking_title')) {
                    badges = [t('activity_logging'), t('performance_metrics'), t('compliance_reporting')];
                  }
                  
                  // Add badges to feature object
                  const enhancedFeature = {
                    ...feature,
                    badges
                  };
                  
                  // Import and use the EnhancedFeatureCard component
                  return (
                    <div key={feature.title} className="h-full">
                      <EnhancedFeatureCard 
                        feature={enhancedFeature}
                        index={index}
                        t={t}
                      />
                    </div>
                  );
                })}
              </div>
              
              {/* Enhanced CTA button */}
              <motion.div 
                className="mt-20 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <Link href="/dashboard">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="rounded-full border-primary/20 hover:bg-primary/5 hover:border-primary/30 px-8 py-6 text-lg shadow-sm hover:shadow-md transition-all duration-300 group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>Explore All Features</span> 
                    <motion.div
                      className="inline-block ml-3"
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatType: "loop" }}
                    >
                      <ArrowRight className="h-5 w-5 group-hover:text-primary transition-colors duration-300" />
                    </motion.div>
                  </Button>
                </Link>
              </motion.div>
            </div>
          </section>

          {/* Key Features Section */}
          <section className="py-16 bg-accent/5">
            <div className="container mx-auto px-4">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-3xl font-bold mb-4">{useTranslation().t('key_features')}</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {useTranslation().t('designed_to_streamline')}
                </p>
              </motion.div>

              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {keyFeatures.map((feature, index) => (
                  <motion.div
                    key={feature.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    whileHover={{ scale: 1.03, backgroundColor: "rgba(var(--primary-rgb), 0.1)" }}
                    className="bg-card rounded-lg p-4 shadow-sm border border-border flex items-center"
                  >
                    <div className="text-primary">{feature.icon}</div>
                    <span className="font-medium">{feature.name}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Interactive Feature Showcase */}
          <section className="py-16 bg-gradient-to-br from-background to-accent/5">
            <div className="container mx-auto px-4">
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-3xl font-bold mb-4">{t('interactive_feature_explorer')}</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t('discover_how')}
                </p>
              </motion.div>
              
              <FeatureShowcase />
            </div>
          </section>

          {/* Mobile Feature Showcase */}
          <MobileFeatureShowcase />

          {/* Stats Section */}
          <section className="py-16 bg-background">
            <div className="container mx-auto px-4">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-3xl font-bold mb-4">{t('our_impact_by_numbers')}</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t('trusted_by_enterprises')}
                </p>
              </motion.div>
              
              <AnimatedStats 
                stats={[
                  { 
                    icon: <Package />, 
                    value: 25000, 
                    label: t('assets_tracked'), 
                    color: "bg-blue-500", 
                  },
                  { 
                    icon: <Building />, 
                    value: 500, 
                    label: t('enterprise_clients'), 
                    color: "bg-purple-500", 
                  },
                  { 
                    icon: <Users />, 
                    value: 12000, 
                    label: t('active_users'), 
                    color: "bg-amber-500", 
                  },
                  { 
                    icon: <Database />, 
                    value: 99, 
                    suffix: "%", 
                    label: t('uptime_reliability'), 
                    color: "bg-green-500", 
                  }
                ]}
              />
            </div>
          </section>
          
          {/* Feature Comparison Section */}
          <section className="py-16 bg-background">
            <div className="container mx-auto px-4">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-3xl font-bold mb-4">{t('how_we_compare')}</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t('see_why')}
                </p>
              </motion.div>
              
              <FeatureComparison />
            </div>
          </section>

          {/* Ticketing & Planner Systems Section */}
          <section id="ticketing-task-planning" className="py-20 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,var(--indigo-500-rgb)/10,transparent)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_80%,var(--cyan-500-rgb)/10,transparent)]"></div>
            
            <div className="container mx-auto px-4 relative z-10">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <Badge className="mb-4 px-3 py-1 bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                  {useTranslation().t('core_systems')}
                </Badge>
                <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-cyan-500">
                  {useTranslation().t('ticketing_task_planning')}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  {useTranslation().t('streamline_support')}
                </p>
              </motion.div>
              
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Ticketing System */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative"
                >
                  <div className="relative bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 rounded-2xl p-1 shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                    <div className="relative bg-card rounded-xl overflow-hidden border border-indigo-500/20">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <div className="bg-indigo-500/10 p-2 rounded-full">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <line x1="10" y1="9" x2="8" y2="9"></line>
                              </svg>
                            </div>
                            <h3 className="font-semibold text-xl">{useTranslation().t('ticketing_system')}</h3>
                          </div>
                          <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                            {useTranslation().t('enterprise_grade')}
                          </Badge>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                          <div className="bg-background/50 p-4 rounded-lg border border-indigo-500/10">
                            <h4 className="font-medium mb-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 mr-2">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                <path d="m9 12 2 2 4-4"></path>
                              </svg>
                              {useTranslation().t('priority_based_ticket')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('categorize_tickets')}
                            </p>
                          </div>
                          
                          <div className="bg-background/50 p-4 rounded-lg border border-indigo-500/10">
                            <h4 className="font-medium mb-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 mr-2">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                <path d="m9 12 2 2 4-4"></path>
                              </svg>
                              {useTranslation().t('asset_association')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('link_tickets_directly')}
                            </p>
                          </div>
                          
                          <div className="bg-background/50 p-4 rounded-lg border border-indigo-500/10">
                            <h4 className="font-medium mb-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 mr-2">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                <path d="m9 12 2 2 4-4"></path>
                              </svg>
                              {useTranslation().t('comprehensive_history')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('track_complete_lifecycle')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10">
                            {useTranslation().t('explore_ticketing_system')}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                              <path d="M5 12h14"></path>
                              <path d="m12 5 7 7-7 7"></path>
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute -bottom-4 -left-4 bg-indigo-500/10 rounded-full p-3 border border-indigo-500/20 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                      <line x1="3" x2="21" y1="9" y2="9"></line>
                      <line x1="9" x2="9" y1="21" y2="9"></line>
                    </svg>
                  </div>
                </motion.div>
                
                {/* Task Planner System */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="relative"
                >
                  <div className="relative bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 rounded-2xl p-1 shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                    <div className="relative bg-card rounded-xl overflow-hidden border border-cyan-500/20">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <div className="bg-cyan-500/10 p-2 rounded-full">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
                                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                                <line x1="16" x2="16" y1="2" y2="6"></line>
                                <line x1="8" x2="8" y1="2" y2="6"></line>
                                <line x1="3" x2="21" y1="10" y2="10"></line>
                                <path d="m9 16 2 2 4-4"></path>
                              </svg>
                            </div>
                            <h3 className="font-semibold text-xl">{useTranslation().t('task_planner')}</h3>
                          </div>
                          <Badge className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20">
                            {useTranslation().t('kpi_tracking')}
                          </Badge>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                          <div className="bg-background/50 p-4 rounded-lg border border-cyan-500/10">
                            <h4 className="font-medium mb-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500 mr-2">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                <path d="m9 12 2 2 4-4"></path>
                              </svg>
                              {useTranslation().t('calendar_integration')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('visualize_tasks')}
                            </p>
                          </div>
                          
                          <div className="bg-background/50 p-4 rounded-lg border border-cyan-500/10">
                            <h4 className="font-medium mb-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500 mr-2">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                <path d="m9 12 2 2 4-4"></path>
                              </svg>
                              {useTranslation().t('task_assignment_tracking')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('assign_tasks_to_team')}
                            </p>
                          </div>
                          
                          <div className="bg-background/50 p-4 rounded-lg border border-cyan-500/10">
                            <h4 className="font-medium mb-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500 mr-2">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                <path d="m9 12 2 2 4-4"></path>
                              </svg>
                              {useTranslation().t('ai_powered_suggestions')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('receive_intelligent_task')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" className="text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10">
                            {useTranslation().t('explore_task_planner')}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                              <path d="M5 12h14"></path>
                              <path d="m12 5 7 7-7 7"></path>
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute -bottom-4 -right-4 bg-cyan-500/10 rounded-full p-3 border border-cyan-500/20 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Vendor Evaluation Feature Section */}
          <VendorEvaluationFeature />
          
          {/* AI Capabilities Section */}
          <section id="ai-powered-insights-analytics" className="py-20 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,var(--violet-500-rgb)/10,transparent)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_80%,var(--indigo-500-rgb)/10,transparent)]"></div>
            
            <div className="container mx-auto px-4 relative z-10">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <Badge className="mb-4 px-3 py-1 bg-violet-500/10 text-violet-500 border-violet-500/20">
                  {useTranslation().t('advanced_intelligence')}
                </Badge>
                <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-indigo-500">
                  {useTranslation().t('ai_powered_insights_analytics')}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  {useTranslation().t('leverage_machine_learning')}
                </p>
              </motion.div>
              
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-card border border-violet-500/20 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="bg-violet-500/10 p-3 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                          <path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"></path>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{useTranslation().t('anomaly_detection')}</h3>
                        <p className="text-muted-foreground">
                          {useTranslation().t('automatically_identify')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card border border-indigo-500/20 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="bg-indigo-500/10 p-3 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{useTranslation().t('predictive_analytics')}</h3>
                        <p className="text-muted-foreground">
                          {useTranslation().t('forecast_future_resource')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card border border-blue-500/20 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-500/10 p-3 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{useTranslation().t('smart_recommendations')}</h3>
                        <p className="text-muted-foreground">
                          {useTranslation().t('receive_ai_generated')}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="relative"
                >
                  <div className="relative bg-gradient-to-br from-violet-500/10 to-indigo-500/5 rounded-2xl p-1 shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                    <div className="relative bg-card rounded-xl overflow-hidden border border-violet-500/20">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="bg-violet-500/10 p-2 rounded-full">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
                              </svg>
                            </div>
                            <h3 className="font-semibold">{useTranslation().t('ai_insights_dashboard')}</h3>
                          </div>
                          <Badge className="bg-violet-500/10 text-violet-500 border-violet-500/20">
                            {useTranslation().t('live_data')}
                          </Badge>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="bg-background/50 p-4 rounded-lg border border-violet-500/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                  <path d="M12 9v4"></path>
                                  <path d="M12 17h.01"></path>
                                </svg>
                                <span className="font-medium">{useTranslation().t('critical_alert')}</span>
                              </div>
                              <Badge className="bg-rose-100 text-rose-700 border-rose-200">
                                {useTranslation().t('high_priority')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('vehicle_rental_costs')}
                            </p>
                          </div>
                          
                          <div className="bg-background/50 p-4 rounded-lg border border-violet-500/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                  <line x1="12" y1="9" x2="12" y2="13"></line>
                                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                <span className="font-medium">{useTranslation().t('consumption_anomaly')}</span>
                              </div>
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                {useTranslation().t('medium_priority')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('food_consumption_costs')}
                            </p>
                          </div>
                          
                          <div className="bg-background/50 p-4 rounded-lg border border-violet-500/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                                  <path d="m9 12 2 2 4-4"></path>
                                </svg>
                                <span className="font-medium">{useTranslation().t('optimization_opportunity')}</span>
                              </div>
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                {useTranslation().t('recommendation')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {useTranslation().t('based_on_current_trends')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                          <Button variant="ghost" size="sm" className="text-violet-500 hover:text-violet-600 hover:bg-violet-500/10">
                            {useTranslation().t('view_all_insights')}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                              <path d="M5 12h14"></path>
                              <path d="m12 5 7 7-7 7"></path>
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute -bottom-4 -right-4 bg-violet-500/10 rounded-full p-3 border border-violet-500/20 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                      <path d="M9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"></path>
                      <path d="M16 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"></path>
                      <path d="M9 12h6"></path>
                      <path d="M13 8h2"></path>
                      <path d="M13 16h2"></path>
                    </svg>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="py-16 bg-accent/5">
            <div className="container mx-auto px-4">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-3xl font-bold mb-4">{t('what_our_clients_say')}</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t('trusted_by_leading')}
                </p>
              </motion.div>
              
              <TestimonialCarousel />
            </div>
          </section>

          {/* How It Works Section */}
          <HowItWorks />

          {/* FAQ Section */}
          <FaqSection />

          {/* CTA Section */}
          <section className="py-20 bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="container mx-auto px-4">
              <motion.div 
                className="max-w-3xl mx-auto text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <Badge className="mb-4 px-3 py-1 bg-primary/10 text-primary border-primary/20">
                  {t('get_started_today')}
                </Badge>
                <h2 className="text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">{t('ready_to_streamline')}</h2>
                <p className="text-xl text-muted-foreground mb-8">
                  {t('join_hundreds')}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto"
                  >
                    <Link href="/signup" className="w-full sm:w-auto">
                      <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all">
                        {t('sign_up_now')} {t('language') === 'العربية' ? 
                          <ArrowLeft className="mr-2 h-5 w-5 rtl:rotate-180" /> : 
                          <ArrowRight className="ml-2 h-5 w-5" />}
                      </Button>
                    </Link>
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto"
                  >
                    <Link href="/login" className="w-full sm:w-auto">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 rounded-full border-primary/20 hover:bg-primary/5">
                        {t('log_in')}
                      </Button>
                    </Link>
                  </motion.div>
                </div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="mt-8 flex flex-wrap items-center justify-center gap-6"
                >
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">{useTranslation().t('enterprise_grade_security')}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">{useTranslation().t('support')}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">{useTranslation().t('free_trial')}</span>
                  </div>
                  <div className="flex items-center">
                    <Globe className="h-5 w-5 text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">{useTranslation().t('supports_arabic')}</span>
                  </div>
                  <div className="flex items-center">
                    <Sun className="h-5 w-5 text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">{useTranslation().t('dark_light_mode')}</span>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}