import { Button } from "@/components/ui/button";
import { useTranslation, Language } from "@/contexts/TranslationContext";
import { Globe, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";

interface LanguageSwitcherProps {
  showLabel?: boolean;
}

export function LanguageSwitcher({ showLabel = false }: LanguageSwitcherProps) {
  const { language, setLanguage, t, isLoading } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);
  const [isChanging, setIsChanging] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Update local state when language changes in context
  useEffect(() => {
    setCurrentLanguage(language);
    
    // Listen for language change events
    const handleLanguageChange = () => {
      setCurrentLanguage(language);
      setIsChanging(false);
    };
    
    window.addEventListener('languagechange', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, [language]);

  // Update loading state when isLoading changes
  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsChanging(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const languages: { code: Language; name: string; flag: string; nativeName: string }[] = [
    { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
    { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇦🇪" },
  ];

  // Get current language display info
  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

  // Handle language change with loading state
  const handleLanguageChange = useCallback((lang: Language) => {
    if (lang === language) return;
    
    setIsChanging(true);
    setDropdownOpen(false);
    
    // Small delay to allow dropdown to close before changing language
    setTimeout(() => {
      setLanguage(lang);
    }, 50);
  }, [language, setLanguage]);

  // For bottom navigation bar with label
  if (showLabel) {
    return (
      <div className="flex flex-col items-center py-1.5 px-3 relative group">
        <div className="relative">
          <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors" onClick={() => setDropdownOpen(true)}>
            {isChanging ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <Globe className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            )}
          </div>
          <motion.div 
            className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-1 bg-primary rounded-full"
            initial={{ width: '4px', opacity: 0 }}
            animate={{ 
              width: dropdownOpen ? '16px' : '4px',
              opacity: dropdownOpen ? 1 : 0
            }}
            whileHover={{ width: '16px', opacity: 1 }}
            transition={{ duration: 0.2 }}
          ></motion.div>
        </div>
        <span className="text-xs mt-1.5 font-medium text-foreground/80 group-hover:text-primary transition-colors">
          {t('language')}
        </span>
        
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger className="hidden">Hidden trigger</DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40 rounded-xl border-primary/20 shadow-lg">
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center justify-between py-2 px-3 cursor-pointer ${
                  language === lang.code 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "hover:bg-primary/5"
                }`}
                disabled={isChanging}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </div>
                
                {language === lang.code && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  >
                    <Check className="h-4 w-4 text-primary" />
                  </motion.div>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Regular language switcher dropdown
  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 rounded-full hover:bg-primary/10 relative flex items-center gap-1.5 px-2.5"
          title={t("language")}
          disabled={isChanging}
        >
          {isChanging ? (
            <Loader2 className="h-4 w-4 text-primary/80 animate-spin" />
          ) : (
            <Globe className="h-4 w-4 text-primary/80" />
          )}
          <span className="text-sm font-medium">{currentLang.nativeName}</span>
          
          {/* Background glow effect */}
          <div className="absolute inset-0 rounded-full bg-primary/10 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl border-primary/20 shadow-lg">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`flex items-center justify-between py-2 px-3 cursor-pointer ${
              language === lang.code 
                ? "bg-primary/10 text-primary font-medium" 
                : "hover:bg-primary/5"
            }`}
            disabled={isChanging}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{lang.flag}</span>
              <span>{lang.nativeName}</span>
            </div>
            
            {language === lang.code && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              >
                <Check className="h-4 w-4 text-primary" />
              </motion.div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}