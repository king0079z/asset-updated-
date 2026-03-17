import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, BarChart2, CheckCircle, Clock, Shield, Award, TrendingUp } from "lucide-react";

export default function VendorEvaluationFeature() {
  const { t } = useTranslation();
  
  return (
    <section id="vendor-evaluation" className="py-20 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,var(--amber-500-rgb)/10,transparent)]">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_0%_80%,var(--yellow-500-rgb)/10,transparent)]"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Badge className="mb-4 px-3 py-1.5 bg-amber-500/20 text-amber-500 border-amber-500/30 text-sm font-medium">
            {t('vendor_evaluation_badge') || "Vendor Evaluation"}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-yellow-500">
            {t('vendor_evaluation_title') || "Comprehensive Vendor Evaluation Feature"}
          </h2>
          <p className="text-muted-foreground max-w-3xl mx-auto text-lg md:text-xl">
            {t('vendor_evaluation_description') || "Evaluate vendor performance with advanced metrics and data-driven insights to optimize your supply chain."}
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Visual Representation */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-2xl p-1.5 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <div className="relative bg-card rounded-xl overflow-hidden border border-amber-500/30 shadow-md">
                <div className="p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-500/20 p-2.5 rounded-full">
                        <Award className="text-amber-500 h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-xl md:text-2xl">{t('vendor_performance_dashboard') || "Vendor Performance Dashboard"}</h3>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 px-3 py-1">
                      {t('data_driven') || "Data-Driven"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-6 mb-6">
                    <div className="bg-background/70 p-5 rounded-lg border border-amber-500/20 shadow-sm">
                      <h4 className="font-medium mb-4 flex items-center text-lg">
                        <Star className="text-amber-500 mr-2.5 h-5 w-5" />
                        {t('performance_metrics') || "Performance Metrics"}
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span>{t('reliability') || "Reliability"}</span>
                            <span className="font-semibold text-green-500">85%</span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-green-400 w-[85%] rounded-full"></div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span>{t('quality') || "Quality"}</span>
                            <span className="font-semibold text-green-500">92%</span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-green-400 w-[92%] rounded-full"></div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span>{t('response_time') || "Response Time"}</span>
                            <span className="font-semibold text-yellow-500">78%</span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 w-[78%] rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-background/70 p-5 rounded-lg border border-amber-500/20 shadow-sm">
                      <h4 className="font-medium mb-4 flex items-center text-lg">
                        <BarChart2 className="text-amber-500 mr-2.5 h-5 w-5" />
                        {t('asset_health_analysis') || "Asset Health Analysis"}
                      </h4>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="bg-muted/40 p-3 rounded-lg text-center shadow-sm hover:shadow-md transition-shadow duration-200">
                          <div className="text-2xl font-bold text-green-500 mb-1">94%</div>
                          <div className="text-xs text-muted-foreground">{t('active_assets') || "Active Assets"}</div>
                        </div>
                        <div className="bg-muted/40 p-3 rounded-lg text-center shadow-sm hover:shadow-md transition-shadow duration-200">
                          <div className="text-2xl font-bold text-yellow-500 mb-1">3%</div>
                          <div className="text-xs text-muted-foreground">{t('maintenance_rate') || "Maintenance Rate"}</div>
                        </div>
                        <div className="bg-muted/40 p-3 rounded-lg text-center shadow-sm hover:shadow-md transition-shadow duration-200">
                          <div className="text-2xl font-bold text-red-500 mb-1">2%</div>
                          <div className="text-xs text-muted-foreground">{t('disposal_rate') || "Disposal Rate"}</div>
                        </div>
                        <div className="bg-muted/40 p-3 rounded-lg text-center shadow-sm hover:shadow-md transition-shadow duration-200">
                          <div className="text-2xl font-bold text-blue-500 mb-1">87%</div>
                          <div className="text-xs text-muted-foreground">{t('health_score') || "Health Score"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating elements */}
            <motion.div 
              className="absolute -bottom-6 -left-6 bg-amber-500/20 rounded-full p-3.5 border border-amber-500/30 shadow-lg"
              animate={{ 
                y: [0, -5, 0],
                rotate: [-3, 3, -3],
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
                  }
                }
              }}
              whileHover={{ scale: 1.1 }}
            >
              <TrendingUp className="text-amber-500 h-6 w-6" />
            </motion.div>
            
            <motion.div 
              className="absolute -top-6 -right-6 bg-yellow-500/20 rounded-full p-3.5 border border-yellow-500/30 shadow-lg"
              animate={{ 
                y: [0, -5, 0],
                rotate: [3, -3, 3],
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
                  }
                }
              }}
              whileHover={{ scale: 1.1 }}
            >
              <Star className="text-yellow-500 h-6 w-6" />
            </motion.div>
          </motion.div>
          
          {/* Right Column - Features */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Feature cards with enhanced styling */}
            <motion.div 
              className="bg-card border border-amber-500/30 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group"
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-5">
                <div className="bg-amber-500/20 p-3.5 rounded-full group-hover:bg-amber-500/30 transition-colors duration-300">
                  <Star className="text-amber-500 h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-amber-500 transition-colors duration-300">
                    {t('performance_evaluation') || "Performance Evaluation"}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('performance_evaluation_description') || "Rate vendors on reliability, quality, and response time with our intuitive scoring system."}
                  </p>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-card border border-amber-500/30 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group"
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-5">
                <div className="bg-amber-500/20 p-3.5 rounded-full group-hover:bg-amber-500/30 transition-colors duration-300">
                  <BarChart2 className="text-amber-500 h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-amber-500 transition-colors duration-300">
                    {t('data_driven_insights') || "Data-Driven Insights"}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('data_driven_insights_description') || "Gain valuable insights from asset health metrics and historical performance data."}
                  </p>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-card border border-amber-500/30 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group"
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-5">
                <div className="bg-amber-500/20 p-3.5 rounded-full group-hover:bg-amber-500/30 transition-colors duration-300">
                  <CheckCircle className="text-amber-500 h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-amber-500 transition-colors duration-300">
                    {t('quality_assessment') || "Quality Assessment"}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('quality_assessment_description') || "Automatically evaluate vendor quality based on asset performance and maintenance history."}
                  </p>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-card border border-amber-500/30 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group"
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-5">
                <div className="bg-amber-500/20 p-3.5 rounded-full group-hover:bg-amber-500/30 transition-colors duration-300">
                  <Shield className="text-amber-500 h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-amber-500 transition-colors duration-300">
                    {t('risk_management') || "Risk Management"}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('risk_management_description') || "Identify high-risk vendors and mitigate supply chain vulnerabilities before they impact operations."}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Bottom summary section */}
        <motion.div 
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="max-w-3xl mx-auto bg-card border border-amber-500/30 rounded-xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-500 mb-2">85%</div>
                <div className="text-sm text-muted-foreground">Average Improvement in<br />Vendor Performance</div>
              </div>
              <div className="h-16 w-px bg-amber-500/20 hidden md:block"></div>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-500 mb-2">30%</div>
                <div className="text-sm text-muted-foreground">Reduction in<br />Supply Chain Risks</div>
              </div>
              <div className="h-16 w-px bg-amber-500/20 hidden md:block"></div>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-500 mb-2">40%</div>
                <div className="text-sm text-muted-foreground">Increase in<br />Operational Efficiency</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}