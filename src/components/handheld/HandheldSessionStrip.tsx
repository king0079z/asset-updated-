'use client';

import React, { memo } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HandheldSessionStripProps {
  scans: number;
  tasks: number;
  className?: string;
  /** Optional line under title e.g. "Session · online" */
  hint?: string;
}

function HandheldSessionStripInner({ scans, tasks, className, hint }: HandheldSessionStripProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-violet-200/60 dark:border-violet-800/40',
        'bg-gradient-to-br from-white via-violet-50/80 to-indigo-50/60 dark:from-slate-800 dark:via-violet-950/40 dark:to-slate-900',
        'p-4 shadow-sm',
        className
      )}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-400/10 dark:bg-violet-500/10 blur-2xl pointer-events-none" />
      <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-indigo-400/10 dark:bg-indigo-500/10 blur-xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/10 dark:bg-violet-400/10">
            <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600/90 dark:text-violet-400/90">
              Live session
            </p>
            {hint && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{hint}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Active</span>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 px-3 py-2.5">
          <p className="text-2xl font-black tabular-nums text-violet-600 dark:text-violet-400 leading-none">{scans}</p>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Scans</p>
        </div>
        <div className="rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 px-3 py-2.5">
          <p className="text-2xl font-black tabular-nums text-indigo-600 dark:text-indigo-400 leading-none">{tasks}</p>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Tasks done</p>
        </div>
      </div>
    </div>
  );
}

export const HandheldSessionStrip = memo(HandheldSessionStripInner);
