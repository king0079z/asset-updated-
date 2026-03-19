'use client';

import React, { memo } from 'react';
import { Scan, Hash, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HandheldTabId } from './types';

/** Order: Work (left), Count (center), Scan (right) */
const THREE_TABS = [
  { id: 'work' as const, label: 'Work', shortLabel: 'Work', Icon: Briefcase },
  { id: 'inventory' as const, label: 'Count', shortLabel: 'Count', Icon: Hash },
  { id: 'scan' as const, label: 'Scan', shortLabel: 'Scan', Icon: Scan },
] as const;

export interface HandheldTabNavCounts {
  work: number;
  count: number;
  scan: number;
}

export interface HandheldTabNavProps {
  tab: HandheldTabId;
  onChange: (id: HandheldTabId) => void;
  /** Notification counts for each button (badge shown when > 0) */
  counts?: HandheldTabNavCounts;
}

function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  const display = value > 99 ? '99+' : String(value);
  return (
    <span
      className="absolute -top-0.5 -right-0.5 z-20 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-md ring-2 ring-white dark:ring-slate-900"
      aria-hidden
    >
      {display}
    </span>
  );
}

function HandheldTabNavInner({ tab, onChange, counts }: HandheldTabNavProps) {
  const c = counts ?? { work: 0, count: 0, scan: 0 };

  return (
    <nav
      className="flex-shrink-0 fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      aria-label="Main navigation"
    >
      <div className="pointer-events-auto mx-4 mb-[max(0.35rem,env(safe-area-inset-bottom))] rounded-[1.5rem] border border-slate-200/80 dark:border-slate-600/80 bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(99,102,241,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-stretch justify-center gap-0 min-h-[64px] px-2 py-2">
          {THREE_TABS.map(({ id, label, shortLabel, Icon }) => {
            const active = tab === id;
            const count = id === 'work' ? c.work : id === 'inventory' ? c.count : c.scan;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex flex-1 max-w-[140px] flex-col items-center justify-center gap-1 min-h-[56px] py-2 px-3 rounded-2xl transition-all duration-200 touch-manipulation select-none',
                  active
                    ? 'text-white'
                    : 'text-slate-500 dark:text-slate-400 active:scale-[0.97] active:bg-slate-100 dark:active:bg-slate-800/80'
                )}
                aria-current={active ? 'page' : undefined}
                aria-label={count > 0 ? `${label} (${count})` : label}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 shadow-lg shadow-indigo-500/25"
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex items-center justify-center w-10 h-10">
                  <Icon
                    className={cn('h-6 w-6', active && 'drop-shadow-sm')}
                    strokeWidth={active ? 2.25 : 2}
                  />
                  <Badge value={count} />
                </span>
                <span
                  className={cn(
                    'relative z-10 text-[11px] font-bold truncate w-full text-center leading-tight tracking-tight',
                    active ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export const HandheldTabNav = memo(HandheldTabNavInner);
