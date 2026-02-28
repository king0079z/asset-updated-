// @ts-nocheck
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface FeatureCardProps {
  feature: {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    delay: number;
    badges?: string[];
  };
  index: number;
  t: (key: string) => string;
}

const EnhancedFeatureCard: React.FC<FeatureCardProps> = ({ feature, index, t }) => {
  // Check if we're on mobile
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isSmallMobile = useMediaQuery('(max-width: 380px)');
  
  // Generate a unique pattern ID for each card
  const patternId = `pattern-${index}`;
  
  // Define badge colors based on feature color
  const getBadgeColor = () => {
    if (feature.color.includes('blue')) return 'blue';
    if (feature.color.includes('indigo')) return 'indigo';
    if (feature.color.includes('cyan')) return 'cyan';
    if (feature.color.includes('violet')) return 'violet';
    if (feature.color.includes('green')) return 'green';
    if (feature.color.includes('purple')) return 'purple';
    if (feature.color.includes('amber')) return 'amber';
    return 'primary';
  };
  
  const badgeColor = getBadgeColor();
  
  // Define the shimmer effect for the card border
  const shimmerGradient = `linear-gradient(to right, transparent 0%, ${badgeColor}-500/30 20%, ${badgeColor}-500/10 40%, transparent 100%)`;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: isMobile ? feature.delay * 0.5 : feature.delay }}
      className="h-full"
      whileHover={!isMobile ? { y: -8, transition: { duration: 0.3 } } : undefined}
      whileTap={{ scale: 0.98 }} // Add tap animation for mobile
    >
      <Card className="h-full border border-primary/10 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden relative group transition-all duration-300 hover:shadow-2xl hover:border-primary/30">
        {/* Enhanced animated gradient background */}
        <div 
          className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-30 group-hover:opacity-60 transition-all duration-500`}
          style={{
            backgroundSize: '200% 200%',
            animation: 'gradientAnimation 8s ease infinite'
          }}
        ></div>
        
        {/* Animated border effect */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: shimmerGradient,
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite linear'
          }}
        ></div>
        
        {/* Decorative pattern */}
        <div className="absolute right-0 top-0 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
          <svg viewBox="0 0 100 100" className="w-full h-full text-primary">
            <defs>
              <pattern id={patternId} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill={`url(#${patternId})`} />
          </svg>
        </div>
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-2 h-2 rounded-full bg-${badgeColor}-500/40`}
              initial={{ 
                x: Math.random() * 100 + '%', 
                y: Math.random() * 100 + '%',
                opacity: 0 
              }}
              animate={{ 
                y: [null, Math.random() * -50 - 20],
                opacity: [0, 0.8, 0]
              }}
              transition={{ 
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                repeatType: 'loop',
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>
        
        <CardHeader className="relative z-10 pt-8 px-4 sm:px-6">
          {/* Feature badge */}
          <div className="absolute top-4 right-4">
            <Badge 
              className={`bg-${badgeColor}-500/10 text-${badgeColor}-500 border-${badgeColor}-500/20 group-hover:bg-${badgeColor}-500/20 transition-colors duration-300 ${isSmallMobile ? 'text-xs' : ''}`}
            >
              <Sparkles className={`${isSmallMobile ? 'w-2 h-2' : 'w-3 h-3'} mr-1`} />
              {isSmallMobile ? '' : t('featured')}
            </Badge>
          </div>
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: isMobile ? (feature.delay * 0.5) + 0.1 : feature.delay + 0.2, duration: 0.5 }}
            className={`mb-6 text-${badgeColor}-500 bg-background/70 ${isSmallMobile ? 'p-3 w-14 h-14' : isMobile ? 'p-4 w-16 h-16' : 'p-5 w-20 h-20'} rounded-full flex items-center justify-center mx-auto shadow-md group-hover:shadow-lg group-hover:bg-background/90 transition-all duration-300`}
            whileHover={!isMobile ? { 
              rotate: [0, -10, 10, -5, 5, 0], 
              scale: 1.1,
              transition: { duration: 0.5 } 
            } : undefined}
          >
            {feature.icon}
          </motion.div>
          
          <CardTitle className={`${isSmallMobile ? 'text-lg' : isMobile ? 'text-xl' : 'text-2xl'} text-center group-hover:text-${badgeColor}-500 transition-colors duration-300`}>
            {feature.title}
          </CardTitle>
          
          <CardDescription className={`text-muted-foreground/90 text-center mt-3 ${isSmallMobile ? 'text-sm' : 'text-base'}`}>
            {isSmallMobile ? feature.description.split('.')[0] + '.' : feature.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="relative z-10 px-4 sm:px-6">
          {!isSmallMobile && (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {feature.badges?.slice(0, isMobile ? 2 : undefined).map((badge, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className={`bg-background/70 backdrop-blur-sm hover:bg-${badgeColor}-500/10 hover:text-${badgeColor}-500 hover:border-${badgeColor}-500/30 transition-all duration-300 cursor-pointer ${isMobile ? 'text-xs' : ''}`}
                >
                  {badge}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
        
        <CardFooter className={`${isSmallMobile ? 'pt-2' : 'pt-4'} pb-6 relative z-10 flex justify-center`}>
          <Link href="/login">
            <Button 
              variant="ghost" 
              size={isSmallMobile ? "sm" : "default"}
              className={`group-hover:bg-${badgeColor}-500/10 group-hover:text-${badgeColor}-500 transition-all duration-300 rounded-full hover:shadow-md`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSmallMobile ? t('more') : t('learn_more')} 
              <ArrowRight className={`ml-2 ${isSmallMobile ? 'h-3 w-3' : 'h-4 w-4'} group-hover:translate-x-2 transition-transform duration-300 text-${badgeColor}-500`} />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default EnhancedFeatureCard;