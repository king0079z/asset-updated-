// @ts-nocheck
/**
 * World-class handheld layout: full-screen, touch-optimized header with
 * sync status and logout. Used on /handheld for HANDHELD role users.
 */
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Scan, Wifi, WifiOff, LogOut, RefreshCw } from 'lucide-react';

interface HandheldLayoutProps {
  title?: string;
  /** Current section / tab label shown under the title */
  subtitle?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  lastSyncTime?: number | null;
  onSyncNow?: () => void | Promise<void>;
}

export function HandheldLayout({ title = 'Field Assistant', subtitle, children, headerRight, lastSyncTime, onSyncNow }: HandheldLayoutProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const syncLabel = lastSyncTime != null
    ? `${Math.round((Date.now() - lastSyncTime) / 60000)}m ago`
    : null;

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex flex-col safe-area-padding relative overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Ambient mesh */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-90 dark:opacity-60"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 0% -20%, rgba(139, 92, 246, 0.22), transparent 50%),
            radial-gradient(ellipse 100% 60% at 100% 0%, rgba(59, 130, 246, 0.18), transparent 45%),
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(99, 102, 241, 0.12), transparent 50%),
            linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)
          `,
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 hidden dark:block bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" aria-hidden />

      {/* Accent bar */}
      <div className="h-1 flex-shrink-0 bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500" />

      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-700/70 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/25 ring-2 ring-white dark:ring-slate-800">
            <Scan className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold text-slate-900 dark:text-white truncate tracking-tight leading-tight">{title}</h1>
            {subtitle ? (
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 truncate mt-0.5">{subtitle}</p>
            ) : null}
            <div className="flex items-center gap-2 text-[11px] mt-0.5">
              <span className={isOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                {isOnline ? <Wifi className="h-3.5 w-3.5 inline mr-1 align-text-bottom" /> : <WifiOff className="h-3.5 w-3.5 inline mr-1 align-text-bottom" />}
                {isOnline ? (syncLabel ? `Synced ${syncLabel}` : 'Online') : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onSyncNow && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => onSyncNow()}
              aria-label="Sync now"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {headerRight}
          <div className="flex items-center rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-slate-50/80 dark:bg-slate-800/80 p-0.5">
            <ThemeToggle />
          </div>
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
