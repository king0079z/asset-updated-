import React from 'react';
import { MovementType, MOVEMENT_TYPE_FALLBACK } from '@/hooks/useMovementTypeDetection';
import { Progress } from '@/components/ui/progress';
import { Car, Footprints, User, HelpCircle, AlertTriangle, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';

interface MovementTypeIndicatorProps {
  showDetails?: boolean;
  movementType?: MovementType | string | null;
  confidence?: number;
  lastUpdated?: Date | null;
  isSupported?: boolean | null;
}

const TYPE_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  description: string;
  gradient: string;
  badgeClass: string;
  dotColor: string;
}> = {
  vehicle: {
    icon: Car,
    label: 'In Vehicle',
    description: 'Moving in a vehicle',
    gradient: 'from-emerald-500 to-teal-600',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-400',
  },
  walking: {
    icon: Footprints,
    label: 'Walking',
    description: 'Moving on foot',
    gradient: 'from-blue-500 to-indigo-600',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotColor: 'bg-blue-400',
  },
  stationary: {
    icon: User,
    label: 'Stationary',
    description: 'Not moving',
    gradient: 'from-slate-500 to-slate-600',
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Analyzing…',
    description: 'Collecting sensor data',
    gradient: 'from-amber-500 to-orange-500',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-400',
  },
};

export function MovementTypeIndicator({
  showDetails = false,
  movementType,
  confidence = 0,
  lastUpdated = null,
  isSupported = true,
}: MovementTypeIndicatorProps) {
  const safeType = movementType && String(movementType).trim() !== ''
    ? String(movementType).toLowerCase()
    : 'unknown';
  const safeConf = typeof confidence === 'number' && !isNaN(confidence) ? confidence : 0;

  /* ── not supported ── */
  if (isSupported === false) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Motion sensors not available on this device
      </div>
    );
  }

  /* ── no data yet ── */
  if (safeConf === 0 && safeType === 'unknown') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Waiting for sensor data…
      </div>
    );
  }

  const cfg = TYPE_CONFIG[safeType] ?? TYPE_CONFIG.unknown;
  const Icon = cfg.icon;
  const confPct = Math.round(safeConf * 100);

  /* ── compact badge ── */
  if (!showDetails) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cfg.badgeClass}`}>
        <Icon className="h-3.5 w-3.5" />
        {cfg.label}
        <span className="opacity-70">· {confPct}%</span>
      </div>
    );
  }

  /* ── detailed card ── */
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <motion.div
          key={safeType}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={`p-3 rounded-2xl bg-gradient-to-br ${cfg.gradient} shadow-lg shrink-0`}
        >
          <Icon className="h-7 w-7 text-white" />
        </motion.div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-extrabold">{cfg.label}</h3>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${cfg.badgeClass}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} animate-pulse`} />
              <Wifi className="h-2.5 w-2.5" />
              LIVE
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{cfg.description}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-bold">{confPct}%</span>
        </div>
        <Progress value={confPct} className="h-2 rounded-full" />
      </div>

      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
