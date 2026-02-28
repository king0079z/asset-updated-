import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounce, memoize } from '@/lib/performance';

// Define available languages
export type Language = 'en' | 'ar';

type Translator = ((
  key: string,
  options?: string | Record<string, string | number>
) => string) & {
  language?: Language;
  dir?: 'ltr' | 'rtl';
};

// Define translation context type
type TranslationContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translator;
  dir: 'ltr' | 'rtl';
  isLoading: boolean;
};

// Create the context with default values
const TranslationContext = createContext<TranslationContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string, options?: string | Record<string, string | number>) =>
    typeof options === 'string' ? options : key,
  dir: 'ltr',
  isLoading: false
});

// Translation provider props
interface TranslationProviderProps {
  children: React.ReactNode;
}

// Translation cache to improve performance
const translationCache: Record<string, Record<string, string>> = {};
const formattedCache: Record<string, string> = {};

// Chunk size for processing large translation objects
const CHUNK_SIZE = 100;

// Create the provider component
export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  // Get initial language from localStorage or default to English
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRTL, setIsRTL] = useState(false);

  // Optimized language change function
  const setLanguage = useCallback((lang: Language) => {
    // Start loading state
    setIsLoading(true);
    
    // Update language state
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    
    // Update RTL state
    const isRTL = lang === 'ar';
    setIsRTL(isRTL);
    
    // Update document attributes
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    // Preserve scroll position
    const currentScrollPosition = window.scrollY;
    
    // Notify components about language change
    if (typeof window !== 'undefined') {
      // Use a custom event to notify components
      window.dispatchEvent(new Event('languagechange'));
      
      // Restore scroll position
      window.scrollTo(0, currentScrollPosition);
    }
  }, []);

  // Process translations in chunks to avoid blocking the main thread
  const processTranslationsInChunks = useCallback((translationsObj: Record<string, string>, callback: (processed: Record<string, string>) => void) => {
    const keys = Object.keys(translationsObj);
    const result: Record<string, string> = {};
    let index = 0;
    
    // Process translations in chunks
    const processChunk = () => {
      const endIndex = Math.min(index + CHUNK_SIZE, keys.length);
      
      for (let i = index; i < endIndex; i++) {
        const key = keys[i];
        result[key] = translationsObj[key];
      }
      
      index = endIndex;
      
      if (index < keys.length) {
        // Schedule next chunk with requestAnimationFrame for better performance
        requestAnimationFrame(processChunk);
      } else {
        // All chunks processed
        callback(result);
      }
    };
    
    // Start processing
    processChunk();
  }, []);

  // Load translations for the current language
  useEffect(() => {
    const loadTranslations = async () => {
      // Check if we already have this language cached
      if (translationCache[language]) {
        setTranslations(translationCache[language]);
        setIsLoading(false);
        return;
      }

      try {
        // Use a more reliable approach to import translations
        let finalTranslations: Record<string, string> = {};
        
        if (language === 'en') {
          // Import English translations directly to avoid dynamic imports
          const enTranslations = require('../translations/en.ts').default;
          finalTranslations = enTranslations;
        } else if (language === 'ar') {
          // Import Arabic translations directly to avoid dynamic imports
          const arTranslations = require('../translations/ar.ts').default;
          
          // If language is Arabic, check for custom translations in localStorage
          const customTranslations = localStorage.getItem('customArabicTranslations');
          if (customTranslations) {
            try {
              const parsedCustomTranslations = JSON.parse(customTranslations);
              // Merge the custom translations with the default ones
              finalTranslations = {
                ...arTranslations,
                ...parsedCustomTranslations
              };
            } catch (parseError) {
              console.error('Failed to parse custom translations:', parseError);
              finalTranslations = arTranslations;
            }
          } else {
            finalTranslations = arTranslations;
          }
        }
        
        // Cache the translations
        translationCache[language] = finalTranslations;
        
        // Process translations in chunks to avoid UI blocking
        processTranslationsInChunks(finalTranslations, (processed) => {
          setTranslations(processed);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Failed to load translations:', error);
        // Fallback to empty translations
        setTranslations({});
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [language, processTranslationsInChunks]);

  // Initialize language from localStorage on mount and preload translations
  useEffect(() => {
    // Preload translations in the background - using require instead of dynamic import
    const preloadTranslations = () => {
      try {
        // Load English translations first (usually smaller)
        if (!translationCache['en']) {
          const enModule = require('../translations/en.ts').default;
          translationCache['en'] = enModule;
        }
        
        // Then load Arabic translations (can be larger)
        if (!translationCache['ar']) {
          const arModule = require('../translations/ar.ts').default;
          translationCache['ar'] = arModule;
        }
      } catch (error) {
        console.error('Failed to preload translations:', error);
      }
    };
    
    // Get saved language
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ar')) {
      setLanguageState(savedLanguage);
      setIsRTL(savedLanguage === 'ar');
    } else {
      // Default to browser language if available and supported
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'ar') {
        setLanguageState('ar');
        setIsRTL(true);
      } else {
        setLanguageState('en');
        setIsRTL(false);
      }
    }
    
    // Start preloading translations
    preloadTranslations();
    
    // Set initial document direction
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, []);

  // Optimized translation function with memoization
  const getTranslation = useMemo(() => memoize((key: string): string => {
    // Check if we already have this translation formatted in cache
    const cacheKey = `${language}:${key}`;
    if (formattedCache[cacheKey]) {
      return formattedCache[cacheKey];
    }
    
    const translation = translations[key] || key;
    
    // Replace underscores with spaces
    const withSpaces = translation.replace(/_/g, ' ');
    
    // Capitalize the first letter of each word
    const formatted = withSpaces.replace(/\b\w/g, (char) => char.toUpperCase());
    
    // Cache the formatted translation
    formattedCache[cacheKey] = formatted;
    
    return formatted;
  }), [language, translations]);

  // Translation function that uses the memoized getTranslation
  const t = useCallback((
    key: string,
    options?: string | Record<string, string | number>
  ): string => {
    if (isLoading) {
      return typeof options === 'string' ? options : key;
    }

    const translated = getTranslation(key);
    let result =
      translated === key && typeof options === 'string'
        ? options
        : translated;

    if (options && typeof options === 'object') {
      for (const [tokenKey, tokenValue] of Object.entries(options)) {
        const safeValue = String(tokenValue);
        result = result
          .replace(new RegExp(`\\{\\{${tokenKey}\\}\\}`, 'g'), safeValue)
          .replace(new RegExp(`\\{${tokenKey}\\}`, 'g'), safeValue);
      }
    }

    return result;
  }, [isLoading, getTranslation]) as Translator;
  t.language = language;
  t.dir = isRTL ? 'rtl' : 'ltr';

  // Determine text direction based on language
  const dir = useMemo<'ltr' | 'rtl'>(() => 
    isRTL ? 'rtl' : 'ltr'
  , [isRTL]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t,
    dir,
    isLoading
  }), [language, setLanguage, t, dir, isLoading]);

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

// Custom hook to use the translation context
export const useTranslation = () => useContext(TranslationContext);