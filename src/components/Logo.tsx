import React from 'react';
import { motion } from 'framer-motion';
import { Package, Sparkles } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/TranslationContext';

const Logo: React.FC = () => {
  const { theme } = useTheme();
  const { dir } = useTranslation();
  const isRtl = dir === 'rtl';
  
  return (
    <motion.div 
      className={`flex items-center ${isRtl ? 'flex-row-reverse' : 'flex-row'} gap-2`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      dir={dir}
    >
      <div className="relative">
        <motion.div
          initial={{ rotate: -10, scale: 0.9 }}
          animate={{ 
            rotate: 0, 
            scale: 1,
            boxShadow: [
              "0 0 0 rgba(var(--primary-rgb), 0.3)",
              "0 0 20px rgba(var(--primary-rgb), 0.5)",
              "0 0 0 rgba(var(--primary-rgb), 0.3)"
            ]
          }}
          transition={{ 
            duration: 0.5,
            boxShadow: {
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut"
            }
          }}
          className="bg-gradient-to-br from-primary/30 to-primary/10 p-2.5 rounded-lg border border-primary/30 shadow-md relative z-10 backdrop-blur-sm"
        >
          <motion.div
            animate={{ 
              rotate: [0, 5, -5, 0],
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          >
            <Package className="h-7 w-7 text-primary" />
          </motion.div>
          
          {/* Inner glow effect */}
          <motion.div 
            className="absolute inset-0 rounded-lg bg-primary/5"
            animate={{ 
              opacity: [0.2, 0.5, 0.2] 
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          />
        </motion.div>
        
        {/* Multiple sparkle elements for enhanced effect - RTL aware positioning */}
        <motion.div 
          className={`absolute -top-1 ${isRtl ? '-right-1' : '-left-1'}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 1, 0], 
            scale: [0.8, 1.2, 0.8],
            rotate: [0, 15, 0]
          }}
          transition={{ 
            delay: 0.3, 
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1
          }}
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </motion.div>
        
        <motion.div 
          className={`absolute -bottom-1 ${isRtl ? '-left-1' : '-right-1'}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 1, 0], 
            scale: [0.8, 1.2, 0.8],
            rotate: [0, -15, 0]
          }}
          transition={{ 
            delay: 1.3, 
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1
          }}
        >
          <Sparkles className="h-3 w-3 text-primary" />
        </motion.div>
      </div>
      
      <div className={`flex flex-col ${isRtl ? 'items-end' : 'items-start'}`}>
        <motion.div 
          className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-${isRtl ? 'l' : 'r'} from-primary to-primary/80`}
          initial={{ y: -5, opacity: 0 }}
          animate={{ 
            y: 0, 
            opacity: 1,
            backgroundPosition: isRtl ? ["100% 50%", "0% 50%", "100% 50%"] : ["0% 50%", "100% 50%", "0% 50%"]
          }}
          transition={{ 
            delay: 0.1, 
            duration: 0.5,
            backgroundPosition: {
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
        >
          AssetTrack
        </motion.div>
        
        <motion.div 
          className="text-xs text-muted-foreground -mt-1"
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <motion.span
            animate={{ 
              opacity: [0.7, 1, 0.7] 
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          >
            Enterprise Solution
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Logo;