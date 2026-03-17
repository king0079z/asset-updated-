// @ts-nocheck
/**
 * Minimal full-screen layout for handheld app: no sidebar, touch-optimized header
 * with sync status and logout. Used on /handheld for HANDHELD role users.
 */
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Scan, Wifi, WifiOff, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandheldLayoutProps {
  title?: string;
  children: React.ReactNode;
  /** Optional right-side slot (e.g. sync refresh) */
  headerRight?: React.ReactNode;
}

export function HandheldLayout({ title = 'Asset Handheld', children, headerRight }: HandheldLayoutProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 safe-area-padding">
      {/* Fixed header */}
      <header className="flex-shrink-0 sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Scan className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">{title}</h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Synced</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                  <span>Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerRight}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content — flex-1 so bottom nav can sit at bottom */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
