import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/contexts/TranslationContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface ThemeToggleProps {
  showLabel?: boolean;
}

export function ThemeToggle({ showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  // For bottom navigation bar with label
  if (showLabel) {
    return (
      <div className="flex flex-col items-center py-1.5 px-3 relative group">
        <div className="relative">
          <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors cursor-pointer" onClick={toggleTheme}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                ) : (
                  <Moon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <motion.div 
            className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-1 bg-primary rounded-full"
            initial={{ width: '4px', opacity: 0 }}
            whileHover={{ width: '16px', opacity: 1 }}
            transition={{ duration: 0.2 }}
          ></motion.div>
        </div>
        <span className="text-xs mt-1.5 font-medium text-foreground/80 group-hover:text-primary transition-colors">
          {theme === "dark" ? t('light') : t('dark')}
        </span>
      </div>
    );
  }
  
  // Regular theme toggle button
  return (
    <Button
      variant={isMobile ? "outline" : "ghost"}
      size={isMobile ? "sm" : "icon"}
      onClick={toggleTheme}
      className={`relative ${isMobile ? "h-9 px-3" : "h-9 w-9"} rounded-full transition-all duration-300 ${
        theme === "dark" 
          ? "hover:bg-amber-500/20 border-amber-500/30" 
          : "hover:bg-indigo-500/20 border-indigo-500/30"
      }`}
      title={theme === "dark" ? t('switch_to_light_mode') : t('switch_to_dark_mode')}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center gap-2"
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-4 w-4 text-amber-500" />
              {isMobile && <span className="text-sm text-amber-500">{t('light_mode')}</span>}
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-indigo-500" />
              {isMobile && <span className="text-sm text-indigo-500">{t('dark_mode')}</span>}
            </>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Background glow effect */}
      <div className={`absolute inset-0 rounded-full ${
        theme === "dark" 
          ? "bg-amber-500/10" 
          : "bg-indigo-500/10"
      } opacity-0 hover:opacity-100 transition-opacity duration-300`}></div>
    </Button>
  );
}