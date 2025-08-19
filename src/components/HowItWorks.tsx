import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Workflow, Scan, Database, BarChart2, ArrowRight, CheckCircle, Zap } from 'lucide-react';
import { useTranslation } from "@/contexts/TranslationContext";

interface Step {
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  benefitsKeys: string[];
}

const HowItWorks: React.FC = () => {
  const { t } = useTranslation();
  
  const steps: Step[] = [
    {
      titleKey: "track_assets",
      descriptionKey: "track_assets_description",
      icon: <Scan className="h-10 w-10" />,
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      gradient: "from-blue-500/20 to-blue-600/5",
      benefitsKeys: [
        "real_time_location_tracking",
        "maintenance_scheduling",
        "asset_lifecycle_management"
      ]
    },
    {
      titleKey: "manage_resources",
      descriptionKey: "manage_resources_description",
      icon: <Database className="h-10 w-10" />,
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      gradient: "from-purple-500/20 to-purple-600/5",
      benefitsKeys: [
        "inventory_monitoring",
        "consumption_analytics",
        "automated_reordering"
      ]
    },
    {
      titleKey: "analyze_data",
      descriptionKey: "analyze_data_description",
      icon: <BarChart2 className="h-10 w-10" />,
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      gradient: "from-amber-500/20 to-amber-600/5",
      benefitsKeys: [
        "ai_powered_insights",
        "anomaly_detection",
        "predictive_analytics"
      ]
    },
    {
      titleKey: "optimize_operations",
      descriptionKey: "optimize_operations_description",
      icon: <Workflow className="h-10 w-10" />,
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      gradient: "from-emerald-500/20 to-emerald-600/5",
      benefitsKeys: [
        "workflow_automation",
        "efficiency_enhancement",
        "cost_optimization"
      ]
    }
  ];

  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background z-0"></div>
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-70"></div>
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-70"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Badge className="mb-4 px-4 py-1.5 text-sm bg-primary/10 text-primary border-primary/20 rounded-full">
            {t('simple_process')}
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">{t('how_it_works')}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t('platform_simplifies')}
          </p>
        </motion.div>
        
        <div className="relative">
          {/* Connecting line with animated gradient */}
          <div className="absolute left-1/2 top-24 bottom-24 w-1 hidden md:block overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/30 via-purple-500/30 to-emerald-500/30"></div>
            <motion.div 
              className="absolute top-0 w-full bg-primary/40 h-1/4"
              initial={{ y: "-100%" }}
              animate={{ y: "400%" }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                repeatType: "loop",
                ease: "linear"
              }}
            ></motion.div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-16 md:gap-24">
            {steps.map((step, index) => (
              <motion.div
                key={step.titleKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2, duration: 0.8 }}
                className={`relative ${index % 2 === 1 ? 'md:mt-32' : ''}`}
                whileHover={{ y: -5 }}
              >
                {/* Step number indicator with pulse animation */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 hidden md:block">
                  <div className="relative">
                    <motion.div 
                      className="absolute -inset-2 rounded-full bg-primary/20 z-0"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        repeatType: "loop"
                      }}
                    ></motion.div>
                    <div className="w-10 h-10 rounded-full bg-background border-4 border-primary flex items-center justify-center font-bold text-primary z-10 relative shadow-lg">
                      {index + 1}
                    </div>
                  </div>
                </div>
                
                <Card className="border border-primary/10 shadow-xl overflow-hidden h-full bg-card/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                  <div className={`h-2 bg-gradient-to-r ${step.gradient}`}></div>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className={`p-4 rounded-full mb-6 ${step.color} shadow-inner`}>
                        {step.icon}
                      </div>
                      
                      <h3 className="text-xl font-bold mb-3">{t(step.titleKey)}</h3>
                      <p className="text-muted-foreground mb-6">{t(step.descriptionKey)}</p>
                      
                      {/* Benefits list */}
                      <div className="w-full space-y-2 mb-4">
                        {step.benefitsKeys.map((benefitKey, idx) => (
                          <motion.div 
                            key={idx}
                            className="flex items-center text-sm text-left"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + (idx * 0.1) }}
                          >
                            <CheckCircle className={`h-4 w-4 mr-2 ${step.color.split(' ')[1]}`} />
                            <span>{t(benefitKey)}</span>
                          </motion.div>
                        ))}
                      </div>
                      
                      {/* Mobile step indicator */}
                      <div className="md:hidden mt-4 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      
                      {/* Learn more button */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`mt-4 ${step.color.split(' ')[1]} hover:bg-${step.color.split(' ')[0].replace('bg-', '')}`}
                      >
                        {t('learn_more')} <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Decorative element */}
                <div className={`absolute ${index % 2 === 0 ? '-bottom-4 -right-4' : '-bottom-4 -left-4'} ${step.color} rounded-full p-2 border ${step.color.split(' ')[2]} shadow-lg hidden md:block`}>
                  <Zap className="w-5 h-5" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Bottom CTA */}
        <motion.div 
          className="mt-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          <div className="bg-card/50 backdrop-blur-sm border border-primary/10 rounded-xl p-8 max-w-3xl mx-auto shadow-lg">
            <h3 className="text-2xl font-bold mb-4">{t('ready_to_streamline_operations')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('get_started_transform')}
            </p>
            <Button className="rounded-full px-8 py-6 text-lg bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300">
              {t('start_free_trial')} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;