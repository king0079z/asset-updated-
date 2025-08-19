import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/Logo';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTranslation } from '@/contexts/TranslationContext';
import { useRTLAnimation } from '@/hooks/useRTLAnimation';

interface LoadingAnimationProps {
  duration?: number;
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ duration = 2000 }) => {
  const [isVisible, setIsVisible] = useState(true);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isSmallMobile = useMediaQuery('(max-width: 380px)');
  const isExtraSmallMobile = useMediaQuery('(max-width: 320px)');
  const { t, dir } = useTranslation();
  const { getRTLValue } = useRTLAnimation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  // Determine appropriate sizing based on screen size
  const getLogoScale = () => {
    if (isExtraSmallMobile) return 'scale-90';
    if (isSmallMobile) return 'scale-100';
    if (isMobile) return 'scale-125';
    return 'scale-150';
  };

  const getProgressBarWidth = () => {
    if (isExtraSmallMobile) return 'w-32';
    if (isSmallMobile) return 'w-36';
    if (isMobile) return 'w-40';
    return 'w-48';
  };

  // Generate random positions for floating elements
  const generateRandomPositions = (count: number) => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 3,
    }));
  };

  const floatingElements = generateRandomPositions(20);
  const glowingOrbs = generateRandomPositions(5);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          dir={dir}
        >
          {/* Enhanced background gradient effect */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div 
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary-rgb)/10,transparent_70%)]"
              animate={{
                opacity: [0.5, 0.8, 0.5],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div 
              className="absolute top-1/4 left-0 w-full h-full bg-[conic-gradient(from_180deg_at_50%_50%,var(--primary-rgb)/8_0deg,transparent_60deg,transparent_300deg,var(--primary-rgb)/8_360deg)]"
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </div>

          {/* Animated particles with enhanced effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {floatingElements.map((particle, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-primary/40"
                style={{
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  top: `${particle.y}%`,
                  left: `${particle.x}%`,
                  filter: "blur(0.5px)",
                }}
                animate={{
                  y: [0, getRTLValue(-100, 100)],
                  x: [0, getRTLValue(50, -50) * Math.random()],
                  opacity: [0, 0.9, 0],
                  scale: [1, 1.5, 0.8],
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  delay: particle.delay,
                  ease: "easeInOut",
                }}
              />
            ))}
            
            {/* Larger glowing orbs */}
            {glowingOrbs.map((orb, i) => (
              <motion.div
                key={`orb-${i}`}
                className="absolute rounded-full"
                style={{
                  width: `${orb.size * 5}px`,
                  height: `${orb.size * 5}px`,
                  top: `${orb.y}%`,
                  left: `${orb.x}%`,
                  background: `radial-gradient(circle, rgba(var(--primary-rgb), 0.4) 0%, rgba(var(--primary-rgb), 0) 70%)`,
                  filter: "blur(8px)",
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.1, 0.3, 0.1],
                }}
                transition={{
                  duration: orb.duration,
                  repeat: Infinity,
                  delay: orb.delay,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Animated grid lines */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
            <motion.div 
              className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24px,var(--primary-rgb)/10_25px,var(--primary-rgb)/10_26px,transparent_27px),linear-gradient(90deg,transparent_24px,var(--primary-rgb)/10_25px,var(--primary-rgb)/10_26px,transparent_27px)]"
              style={{ backgroundSize: '50px 50px' }}
              animate={{
                y: [0, 50],
                x: [0, 50],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ 
              duration: 0.5,
              type: "spring",
              stiffness: 100
            }}
            className="flex flex-col items-center px-4 relative z-10"
          >
            {/* Logo with enhanced container */}
            <motion.div 
              className={`${getLogoScale()} mb-4 sm:mb-6 relative`}
              whileInView={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{ 
                repeat: Infinity, 
                repeatType: "reverse", 
                duration: 2 
              }}
            >
              {/* Glow effect behind logo */}
              <motion.div
                className="absolute -inset-4 rounded-full bg-primary/10 blur-xl -z-10"
                animate={{
                  opacity: [0.3, 0.7, 0.3],
                  scale: [0.9, 1.1, 0.9],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              <Logo />
            </motion.div>
            
            {/* Enhanced progress bar with animated effects */}
            <div className="relative">
              <motion.div 
                className={`h-2.5 bg-primary/10 rounded-full ${getProgressBarWidth()} mt-3 sm:mt-4 overflow-hidden backdrop-blur-sm border border-primary/20`}
                initial={{ width: isSmallMobile ? "36px" : isMobile ? "40px" : "48px" }}
                animate={{ width: isSmallMobile ? "9rem" : isMobile ? "10rem" : "12rem" }}
                transition={{ duration: 0.5 }}
              >
                <motion.div 
                  className="h-full bg-gradient-to-r from-primary/70 via-primary to-primary/80"
                  initial={{ width: "0%" }}
                  animate={{ 
                    width: "100%",
                    background: [
                      "linear-gradient(90deg, rgba(var(--primary-rgb), 0.7) 0%, rgba(var(--primary-rgb), 1) 50%, rgba(var(--primary-rgb), 0.8) 100%)",
                      "linear-gradient(90deg, rgba(var(--primary-rgb), 0.8) 0%, rgba(var(--primary-rgb), 0.7) 50%, rgba(var(--primary-rgb), 1) 100%)",
                      "linear-gradient(90deg, rgba(var(--primary-rgb), 1) 0%, rgba(var(--primary-rgb), 0.8) 50%, rgba(var(--primary-rgb), 0.7) 100%)",
                    ]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    ease: "easeInOut",
                    background: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  }}
                />
                
                {/* Animated shine effect */}
                <motion.div
                  className="absolute top-0 bottom-0 w-20 bg-white/30 skew-x-30 -translate-x-20"
                  animate={{ translateX: ["0%", "200%"] }}
                  transition={{
                    duration: 1.5,
                    ease: "easeInOut",
                    delay: 0.5,
                  }}
                />
              </motion.div>
              
              {/* Enhanced glow effect under progress bar */}
              <motion.div 
                className="absolute -inset-1 bg-primary/20 rounded-full blur-md -z-10"
                animate={{ 
                  opacity: [0.2, 0.6, 0.2],
                  scale: [0.95, 1.05, 0.95],
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>
            
            {/* Loading text with animated typing effect */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-sm text-muted-foreground mt-4 font-medium"
            >
              <motion.span
                animate={{
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {t('loading_your_experience')}
              </motion.span>
            </motion.p>
            
            {/* Enhanced loading dots animation */}
            <motion.div className="flex space-x-1.5 mt-1.5">
              {[0, 1, 2].map((dot) => (
                <motion.div
                  key={dot}
                  className="w-2 h-2 rounded-full bg-primary"
                  initial={{ opacity: 0.3 }}
                  animate={{ 
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.2, 0.8],
                    y: [0, -3, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: dot * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingAnimation;