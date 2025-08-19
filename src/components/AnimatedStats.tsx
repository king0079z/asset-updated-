import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatItemProps {
  icon: React.ReactElement<LucideIcon>;
  value: number;
  suffix?: string;
  label: string;
  color: string;
  delay: number;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, suffix = '', label, color, delay }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000; // 2 seconds
      const increment = Math.ceil(value / (duration / 16)); // 60fps
      
      const timer = setInterval(() => {
        start += increment;
        if (start > value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(start);
        }
      }, 16);
      
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay }}
      className="h-full"
    >
      <Card className="h-full border border-primary/20 overflow-hidden">
        <div className={`h-2 ${color}`}></div>
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <motion.div 
            className="text-primary mb-4 p-3 rounded-full bg-primary/10"
            initial={{ scale: 0.8 }}
            animate={isInView ? { scale: 1 } : { scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, delay: delay + 0.2 }}
          >
            {React.cloneElement(icon, { className: 'w-8 h-8' })}
          </motion.div>
          
          <motion.div
            className="text-4xl font-bold mb-2 flex items-center justify-center h-12"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: delay + 0.3, duration: 0.5 }}
          >
            {count.toLocaleString()}{suffix}
          </motion.div>
          
          <p className="text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface AnimatedStatsProps {
  stats: Array<{
    icon: React.ReactElement<LucideIcon>;
    value: number;
    suffix?: string;
    label: string;
    color: string;
  }>;
}

const AnimatedStats: React.FC<AnimatedStatsProps> = ({ stats }) => {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <StatItem
          key={stat.label}
          icon={stat.icon}
          value={stat.value}
          suffix={stat.suffix}
          label={stat.label}
          color={stat.color}
          delay={index * 0.15}
        />
      ))}
    </div>
  );
};

export default AnimatedStats;