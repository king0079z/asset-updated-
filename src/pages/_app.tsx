import type { AppProps } from 'next/app'
import { AuthProvider } from '@/contexts/AuthContext'
import { TranslationProvider } from '@/contexts/TranslationContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { PerformanceProvider } from '@/contexts/PerformanceContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import '../styles/globals.css';
import '../styles/print.css';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useEffect, useState, Suspense, lazy, useCallback } from 'react';
import { SubscriptionExpirationBar } from '@/components/SubscriptionExpirationBar';
import Head from 'next/head';
import { runWhenIdle, throttle } from '@/lib/performance';
import { setupGlobalErrorHandler } from '@/lib/globalErrorHandler';

// Lazy load non-critical components
const QuickActionsMenu = lazy(() => 
  import('@/components/QuickActionsMenu').then(mod => ({ 
    default: mod.QuickActionsMenu 
  }))
);

// Create a performance monitor component
const PerformanceMonitor = () => {
  useEffect(() => {
    // Only run in development mode
    if (process.env.NODE_ENV !== 'development') return;

    // Monitor language change performance
    const monitorLanguageChange = () => {
      const startTime = performance.now();
      
      // Log when language change completes
      const checkRender = () => {
        const endTime = performance.now();
        console.log(`Language change took ${endTime - startTime}ms to complete`);
      };
      
      // Check after a reasonable time
      setTimeout(checkRender, 500);
    };
    
    window.addEventListener('languagechange', monitorLanguageChange);
    
    return () => {
      window.removeEventListener('languagechange', monitorLanguageChange);
    };
  }, []);
  
  return null;
};

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false);
  const [isRTL, setIsRTL] = useState(false);

  // Throttled re-render function to prevent excessive re-renders
  const handleLanguageChange = useCallback(throttle(() => {
    // Force a controlled re-render of the application
    setMounted(false);
    
    // Get current language direction
    const currentDir = document.documentElement.dir;
    setIsRTL(currentDir === 'rtl');
    
    // Small delay to allow browser to process RTL changes
    setTimeout(() => {
      setMounted(true);
    }, 50);
  }, 300), []);

  useEffect(() => {
    // Set up global error handler
    setupGlobalErrorHandler();
    
    // Optimize theme and language initialization
    const initApp = () => {
      // Check for saved theme preference
      const savedTheme = localStorage.getItem('theme');
      
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // Use system preference as fallback
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
      // Initialize language direction based on saved language
      const savedLanguage = localStorage.getItem('language');
      const isRTL = savedLanguage === 'ar';
      setIsRTL(isRTL);
      
      if (isRTL) {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
      } else {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
      }
      
      // Add RTL-specific class if needed
      if (isRTL) {
        document.documentElement.classList.add('rtl-layout');
      } else {
        document.documentElement.classList.remove('rtl-layout');
      }
      
      setMounted(true);
    };

    // Run initialization immediately
    initApp();
    
    // Listen for language change events to handle re-rendering
    window.addEventListener('languagechange', handleLanguageChange);
    
    // Preload critical resources when browser is idle
    runWhenIdle(() => {
      // Preload Arabic fonts if needed
      const preloadArabicFonts = () => {
        // Add any Arabic-specific font preloads here
        const arabicFonts = [
          // Add Arabic font URLs here if needed
        ];
        
        arabicFonts.forEach(href => {
          if (!href) return;
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'font';
          link.href = href;
          link.crossOrigin = 'anonymous';
          document.head.appendChild(link);
        });
      };
      
      // Preload Arabic fonts if the user might use Arabic
      if (navigator.language.startsWith('ar') || localStorage.getItem('language') === 'ar') {
        preloadArabicFonts();
      }
    });
    
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, [handleLanguageChange]);

  // Prevent flash while theme and language load
  if (!mounted) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background text-foreground transition-colors duration-300 ${isRTL ? 'rtl-mode' : 'ltr-mode'}`}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* Performance optimization meta tags */}
        <meta name="theme-color" content="#000000" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Add RTL-specific meta if needed */}
        {isRTL && (
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        )}
      </Head>
      {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
      <PerformanceProvider>
        <ThemeProvider>
          <TranslationProvider>
            <AuthProvider>
              <OrganizationProvider>
                <TooltipProvider>
                  <ProtectedRoute>
                    <SubscriptionExpirationBar />
                    <Component {...pageProps} />
                    <Suspense fallback={null}>
                      <QuickActionsMenu />
                    </Suspense>
                  </ProtectedRoute>
                  <Toaster />
                </TooltipProvider>
              </OrganizationProvider>
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </PerformanceProvider>
    </div>
  )
}