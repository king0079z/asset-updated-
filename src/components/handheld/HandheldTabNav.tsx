'use client';

import React, { memo, useMemo } from 'react';
import {
  Scan,
  Layers,
  Crosshair,
  Briefcase,
  Package,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HandheldTabId } from './types';
import { RAPID_TAB_IDS } from './types';

const TAB_META: {
  id: HandheldTabId;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
}[] = [
  { id: 'scan', label: 'Scan', shortLabel: 'Scan', Icon: Scan },
  { id: 'inventory', label: 'Inventory', shortLabel: 'Inv', Icon: Layers },
  { id: 'locate', label: 'Locate', shortLabel: 'Locate', Icon: Crosshair },
  { id: 'work', label: 'Work', shortLabel: 'Work', Icon: Briefcase },
  { id: 'asset', label: 'Asset', shortLabel: 'Asset', Icon: Package },
  { id: 'more', label: 'More', shortLabel: 'More', Icon: MoreHorizontal },
];

export interface HandheldTabNavProps {
  tab: HandheldTabId;
  onChange: (id: HandheldTabId) => void;
  rapidMode: boolean;
}

function HandheldTabNavInner({ tab, onChange, rapidMode }: HandheldTabNavProps) {
  const visible = useMemo(
    () => (rapidMode ? TAB_META.filter((t) => RAPID_TAB_IDS.includes(t.id)) : TAB_META),
    [rapidMode]
  );

  return (
    <nav
      className="flex-shrink-0 fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      aria-label="Main navigation"
    >
      {/* Floating dock above safe area */}
      <div className="pointer-events-auto mx-3 mb-[max(0.35rem,env(safe-area-inset-bottom))] rounded-[1.35rem] border border-white/60 dark:border-slate-600/60 bg-white/85 dark:bg-slate-900/90 backdrop-blur-2xl shadow-[0_8px_40px_rgba(99,102,241,0.18),0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-stretch justify-between gap-0.5 px-1 py-1.5 min-h-[58px]">
          {visible.map(({ id, label, shortLabel, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 min-h-[52px] py-1 px-0.5 rounded-[1rem] transition-all duration-200 touch-manipulation select-none',
                  active
                    ? 'text-white'
                    : 'text-slate-500 dark:text-slate-400 active:scale-95 active:bg-slate-100/80 dark:active:bg-slate-800/80'
                )}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-[1rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 shadow-lg shadow-indigo-500/30"
                    aria-hidden
                  />
                )}
                <span className={cn('relative z-10 flex items-center justify-center', active && 'drop-shadow-sm')}>
                  <Icon className={cn('h-[22px] w-[22px]', active && 'stroke-[2.25px]')} strokeWidth={active ? 2.25 : 2} />
                </span>
                <span
                  className={cn(
                    'relative z-10 text-[10px] font-bold truncate w-full text-center leading-tight tracking-tight',
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
