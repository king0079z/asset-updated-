import React from 'react';
import { motion } from 'framer-motion';
import { 
  Package, Car, Utensils, Users, BarChart2, MapPin, Shield, Clock, 
  Calendar, Brain, FileText, Database, Truck, Activity, Workflow, 
  Zap, Settings, CheckCircle
} from 'lucide-react';

interface FloatingIconProps {
  icon: React.ReactNode;
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
  duration?: number;
  blurAmount?: number;
}

const FloatingIcon: React.FC<FloatingIconProps> = ({ 
  icon, x, y, size, delay, color, duration = 20, blurAmount = 0 
}) => {
  return (
    <motion.div
      className={`absolute ${color} drop-shadow-lg`}
      style={{ 
        width: size, 
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        filter: blurAmount ? `blur(${blurAmount}px)` : 'none',
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: [0, 0.7, 0.5],
        scale: [0, 1, 0.9],
        y: [0, -30, 0],
        x: [0, 15, 0],
        rotate: [0, 10, -5, 0]
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut"
      }}
    >
      {icon}
    </motion.div>
  );
};

const FloatingIcons: React.FC = () => {
  // Primary icons with normal visibility
  const primaryIcons = [
    { icon: <Package />, x: 10, y: 20, size: 24, delay: 0, color: "text-blue-500/30" },
    { icon: <Car />, x: 80, y: 15, size: 32, delay: 1, color: "text-purple-500/30" },
    { icon: <Utensils />, x: 20, y: 60, size: 28, delay: 2, color: "text-green-500/30" },
    { icon: <Users />, x: 70, y: 70, size: 30, delay: 3, color: "text-amber-500/30" },
    { icon: <BarChart2 />, x: 40, y: 30, size: 26, delay: 4, color: "text-cyan-500/30" },
    { icon: <MapPin />, x: 60, y: 40, size: 22, delay: 5, color: "text-red-500/30" },
    { icon: <Shield />, x: 30, y: 80, size: 28, delay: 6, color: "text-indigo-500/30" },
    { icon: <Clock />, x: 85, y: 50, size: 24, delay: 7, color: "text-orange-500/30" },
    { icon: <Calendar />, x: 15, y: 40, size: 26, delay: 8, color: "text-pink-500/30" },
    { icon: <Brain />, x: 75, y: 25, size: 30, delay: 9, color: "text-violet-500/30" },
  ];
  
  // Background icons with blur effect
  const backgroundIcons = [
    { icon: <FileText />, x: 5, y: 35, size: 40, delay: 2, color: "text-primary/10", duration: 30, blurAmount: 3 },
    { icon: <Database />, x: 90, y: 60, size: 36, delay: 5, color: "text-primary/10", duration: 35, blurAmount: 2 },
    { icon: <Truck />, x: 25, y: 75, size: 42, delay: 8, color: "text-primary/10", duration: 40, blurAmount: 4 },
    { icon: <Activity />, x: 65, y: 10, size: 38, delay: 11, color: "text-primary/10", duration: 38, blurAmount: 3 },
    { icon: <Workflow />, x: 45, y: 85, size: 44, delay: 14, color: "text-primary/10", duration: 42, blurAmount: 5 },
    { icon: <Zap />, x: 55, y: 5, size: 34, delay: 17, color: "text-primary/10", duration: 36, blurAmount: 2 },
    { icon: <Settings />, x: 10, y: 90, size: 40, delay: 20, color: "text-primary/10", duration: 34, blurAmount: 4 },
    { icon: <CheckCircle />, x: 85, y: 80, size: 36, delay: 23, color: "text-primary/10", duration: 32, blurAmount: 3 },
  ];
  
  // Small particle-like dots
  const particles = Array.from({ length: 20 }).map((_, index) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 6 + 2,
    delay: Math.random() * 10,
    duration: Math.random() * 20 + 10,
    color: `text-primary/${Math.random() * 0.2 + 0.1}`
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Background blurred icons */}
      {backgroundIcons.map((icon, index) => (
        <FloatingIcon
          key={`bg-${index}`}
          icon={icon.icon}
          x={icon.x}
          y={icon.y}
          size={icon.size}
          delay={icon.delay}
          color={icon.color}
          duration={icon.duration}
          blurAmount={icon.blurAmount}
        />
      ))}
      
      {/* Primary icons */}
      {primaryIcons.map((icon, index) => (
        <FloatingIcon
          key={`primary-${index}`}
          icon={icon.icon}
          x={icon.x}
          y={icon.y}
          size={icon.size}
          delay={icon.delay}
          color={icon.color}
        />
      ))}
      
      {/* Small particles */}
      {particles.map((particle, index) => (
        <motion.div
          key={`particle-${index}`}
          className={`absolute rounded-full ${particle.color}`}
          style={{ 
            width: particle.size, 
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [0, 0.8, 0],
            y: [0, -30, -60],
            x: [0, Math.random() * 20 - 10]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            repeatType: "loop"
          }}
        />
      ))}
    </div>
  );
};

export default FloatingIcons;