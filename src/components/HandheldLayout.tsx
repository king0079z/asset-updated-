// @ts-nocheck
/**
 * World-class handheld layout: full-screen, touch-optimized header with
 * sync status and logout. Used on /handheld for HANDHELD role users.
 */
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Scan, Wifi, WifiOff, LogOut } from 'lucide-react';

interface HandheldLayoutProps {
  title?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function HandheldLayout({ title = 'Field Assistant', children, headerRight }: HandheldLayoutProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4f8] dark:bg-slate-900 safe-area-padding">
      {/* Accent bar */}
      <div className="h-1 flex-shrink-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600" />

      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3.5 bg-white dark:bg-slate-800/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-violet-500/20">
            <Scan className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold text-slate-900 dark:text-white truncate tracking-tight">{title}</h1>
            <div className="flex items-center gap-2 text-xs mt-0.5">
              <span className={isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                {isOnline ? <Wifi className="h-3.5 w-3.5 inline mr-1" /> : <WifiOff className="h-3.5 w-3.5 inline mr-1" />}
                {isOnline ? 'Synced' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerRight}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-2xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
