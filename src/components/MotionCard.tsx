import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MotionCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'none';
  animateFrom?: 'bottom' | 'left' | 'right' | 'top';
  [x: string]: any;
}

export function MotionCard({ 
  children, 
  delay = 0, 
  className,
  hoverEffect = 'lift',
  animateFrom = 'bottom',
  ...props 
}: MotionCardProps) {
  // Define initial animation based on direction
  const initialAnimation = {
    bottom: { opacity: 0, y: 20 },
    top: { opacity: 0, y: -20 },
    left: { opacity: 0, x: -20 },
    right: { opacity: 0, x: 20 },
  };

  // Define hover effects
  const hoverEffects = {
    lift: { 
      y: -8,
      boxShadow: "0 15px 30px -5px rgba(0, 0, 0, 0.1), 0 10px 15px -5px rgba(0, 0, 0, 0.05)"
    },
    scale: { 
      scale: 1.02,
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)"
    },
    glow: { 
      boxShadow: "0 0 15px 2px rgba(59, 130, 246, 0.3)",
      borderColor: "rgba(59, 130, 246, 0.5)"
    },
    none: {}
  };

  return (
    <motion.div
      className={cn(
        "rounded-lg overflow-hidden transition-all duration-300",
        className
      )}
      initial={initialAnimation[animateFrom]}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 15,
        delay: delay,
      }}
      whileHover={hoverEffects[hoverEffect]}
      {...props}
    >
      {children}
    </motion.div>
  );
}