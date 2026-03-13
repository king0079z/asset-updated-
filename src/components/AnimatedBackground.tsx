import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
  children: React.ReactNode;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ children }) => {
  const interactiveRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const interBubble = interactiveRef.current;
    if (!interBubble) return;
    
    let curX = 0;
    let curY = 0;
    let tgX = 0;
    let tgY = 0;
    
    const move = () => {
      curX += (tgX - curX) / 20;
      curY += (tgY - curY) / 20;
      if (interBubble) {
        interBubble.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
      }
      requestAnimationFrame(move);
    };
    
    const handleMouseMove = (event: MouseEvent) => {
      tgX = event.clientX;
      tgY = event.clientY;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    move();
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* SVG Filter */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="absolute top-0 left-0 w-0 h-0"
      >
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" 
              result="goo" 
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background to-background/80 z-0" />
      
      {/* Animated Gradients Container */}
      <div 
        className="absolute inset-0 z-0"
        style={{ 
          filter: 'url(#goo) blur(40px)',
          opacity: 0.5
        }}
      >
        {/* Gradient 1 */}
        <motion.div
          className="absolute w-[80%] h-[80%] top-[10%] left-[10%] rounded-full bg-gradient-to-r from-primary/30 to-transparent"
          animate={{ 
            y: ['-50%', '50%', '-50%'],
          }}
          transition={{ 
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ 
            mixBlendMode: 'hard-light',
            opacity: 0.8
          }}
        />
        
        {/* Gradient 2 */}
        <motion.div
          className="absolute w-[80%] h-[80%] top-[10%] left-[10%] rounded-full bg-gradient-to-r from-blue-500/30 to-transparent"
          animate={{ 
            rotate: [0, 360],
            transformOrigin: 'calc(50% - 400px) 50%'
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{ 
            mixBlendMode: 'hard-light',
            opacity: 0.8
          }}
        />
        
        {/* Gradient 3 */}
        <motion.div
          className="absolute w-[80%] h-[80%] top-[calc(10%+200px)] left-[calc(10%-500px)] rounded-full bg-gradient-to-r from-purple-500/30 to-transparent"
          animate={{ 
            rotate: [0, 360],
            transformOrigin: 'calc(50% + 400px) 50%'
          }}
          transition={{ 
            duration: 40,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{ 
            mixBlendMode: 'hard-light',
            opacity: 0.8
          }}
        />
        
        {/* Gradient 4 */}
        <motion.div
          className="absolute w-[80%] h-[80%] top-[10%] left-[10%] rounded-full bg-gradient-to-r from-amber-500/30 to-transparent"
          animate={{ 
            x: ['-50%', '50%', '-50%'],
            y: ['-10%', '10%', '-10%']
          }}
          transition={{ 
            duration: 40,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ 
            mixBlendMode: 'hard-light',
            opacity: 0.7
          }}
        />
        
        {/* Gradient 5 */}
        <motion.div
          className="absolute w-[160%] h-[160%] top-[-30%] left-[-30%] rounded-full bg-gradient-to-r from-emerald-500/30 to-transparent"
          animate={{ 
            rotate: [0, 360],
            transformOrigin: 'calc(50% - 800px) calc(50% + 200px)'
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ 
            mixBlendMode: 'hard-light',
            opacity: 0.8
          }}
        />
        
        {/* Interactive Gradient */}
        <div 
          ref={interactiveRef}
          className="absolute w-full h-full top-[-50%] left-[-50%] rounded-full bg-gradient-to-r from-indigo-500/30 to-transparent"
          style={{ 
            mixBlendMode: 'hard-light',
            opacity: 0.7
          }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full min-h-screen">
        {children}
      </div>
    </div>
  );
};

export default AnimatedBackground;