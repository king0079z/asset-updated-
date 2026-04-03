"use client";
import React, { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import {
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Info,
  Calendar, DollarSign, Zap, Clock, BarChart3, RefreshCw,
} from "lucide-react";
import {
  calculateDepreciation,
  USEFUL_LIFE_BY_TYPE,
  SALVAGE_RATE,
  type DepreciationResult,
  type DepreciationMethod,
} from "@/lib/depreciation";

interface AssetDepreciationPanelProps {
  asset: {
    id: string;
    name: string;
    type?: string | null;
    purchaseAmount?: number | null;
    purchaseDate?: string | Date | null;
    createdAt?: string | Date;
    status?: string;
  };
}

const METHOD_LABELS: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE:       "Straight-Line (SL)",
  DOUBLE_DECLINING:    "Double Declining Balance (DDB)",
  SUM_OF_YEARS_DIGITS: "Sum of Years' Digits (SYD)",
};

const METHOD_DESC: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE:       "Equal depreciation each year. Simple, predictable, ideal for most fixed assets.",
  DOUBLE_DECLINING:    "Accelerated — heavy depreciation early. Best for tech assets losing value fast.",
  SUM_OF_YEARS_DIGITS: "Accelerated — moderate front-loading. Balanced approach for mixed asset types.",
};

const CONDITION_CONFIG = {
  EXCELLENT: { color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-700", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", label: "Excellent" },
  GOOD:      { color: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-900/30",       border: "border-blue-200 dark:border-blue-700",       text: "text-blue-700 dark:text-blue-300",       dot: "bg-blue-500",    label: "Good" },
  FAIR:      { color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-900/30",     border: "border-amber-200 dark:border-amber-700",     text: "text-amber-700 dark:text-amber-300",     dot: "bg-amber-500",   label: "Fair" },
  POOR:      { color: "#f97316", bg: "bg-orange-50 dark:bg-orange-900/30",   border: "border-orange-200 dark:border-orange-700",   text: "text-orange-700 dark:text-orange-300",   dot: "bg-orange-500",  label: "Poor" },
  CRITICAL:  { color: "#ef4444", bg: "bg-red-50 dark:bg-red-900/30",         border: "border-red-200 dark:border-red-700",         text: "text-red-700 dark:text-red-300",         dot: "bg-red-500",     label: "Critical" },
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-bold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">QAR {fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function AssetDepreciationPanel({ asset }: AssetDepreciationPanelProps) {
  const [method, setMethod] = useState<DepreciationMethod>("STRAIGHT_LINE");
  const [activeChart, setActiveChart] = useState<"curve" | "bar">("curve");

  const { result, hasData } = useMemo(() => {
    const cost = asset.purchaseAmount;
    if (!cost || cost <= 0) return { result: null, hasData: false };

    const type = asset.type ?? "OTHER";
    const usefulLife = USEFUL_LIFE_BY_TYPE[type] ?? 7;
    const purchaseDate = asset.purchaseDate
      ? new Date(asset.purchaseDate)
      : asset.createdAt
        ? new Date(asset.createdAt as string)
        : null;

    if (!purchaseDate || isNaN(purchaseDate.getTime())) return { result: null, hasData: false };

    try {
      const r = calculateDepreciation({ cost, purchaseDate, usefulLifeYears: usefulLife, method });
      return { result: r, hasData: true };
    } catch {
      return { result: null, hasData: false };
    }
  }, [asset, method]);

  if (!hasData || !result) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
          <TrendingDown className="w-6 h-6 text-violet-500" />
        </div>
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">Depreciation Data Unavailable</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Set a purchase price and date to enable AI depreciation analysis.
          </p>
        </div>
      </div>
    );
  }

  const cond = CONDITION_CONFIG[result.condition];
  const depPct = Math.min(result.depreciationPercent, 100);
  const bvPct  = 100 - depPct;

  // Curve chart data
  const curveData = result.schedule.map((row) => ({
    year: `Y${row.year} (${row.calendarYear})`,
    "Book Value":        row.closingBookValue,
    "Depreciation":      row.depreciation,
    "Accumulated Dep.":  row.accumulatedDepreciation,
  }));

  // Comparison bar data (single data point with 3 methods)
  const compData = [
    {
      name: "Current Book Value",
      "Straight-Line":    result.comparison.sl.bookValue,
      "Dbl. Declining":   result.comparison.ddb.bookValue,
      "Sum-of-Yrs":       result.comparison.syd.bookValue,
    },
    {
      name: "Accumulated Depreciation",
      "Straight-Line":    result.comparison.sl.accumulatedDepreciation,
      "Dbl. Declining":   result.comparison.ddb.accumulatedDepreciation,
      "Sum-of-Yrs":       result.comparison.syd.accumulatedDepreciation,
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-5 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-yellow-300" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-200/80">AI Depreciation Analysis</span>
            </div>
            <h2 className="text-xl font-extrabold leading-tight">Asset Valuation Engine</h2>
            <p className="text-xs text-violet-200/70 mt-0.5">IAS 16 · IFRS Compliant · {METHOD_LABELS[method]}</p>
          </div>
          {/* Condition badge */}
          <div className="flex-shrink-0">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/20`}>
              <span className={`w-2.5 h-2.5 rounded-full ${cond.dot}`} />
              <span className="font-bold text-sm">{cond.label} Condition</span>
              <span className="text-xs text-white/60">Score: {result.conditionScore}</span>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: "Purchase Price",       val: `QAR ${fmt(result.cost)}`,                     sub: fmtDate(result.purchaseDate),                   icon: DollarSign, color: "text-emerald-300" },
            { label: "Current Book Value",   val: `QAR ${fmt(result.currentBookValue)}`,          sub: `${depPct.toFixed(1)}% depreciated`,             icon: TrendingDown, color: "text-rose-300" },
            { label: "Depreciation To Date", val: `QAR ${fmt(result.accumulatedDepreciation)}`,  sub: `QAR ${fmt(result.annualDepreciation)}/yr`,      icon: BarChart3, color: "text-amber-300" },
            { label: "Remaining Life",       val: `${result.remainingLife.toFixed(1)} yrs`,       sub: `Replace by ${fmtDate(result.recommendedReplacement)}`, icon: Clock, color: "text-blue-300" },
          ].map(({ label, val, sub, icon: Icon, color }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">{label}</span>
              </div>
              <p className="text-base font-black leading-none text-white">{val}</p>
              <p className="text-[10px] text-white/50 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Value decay bar ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Value Decay Progress</span>
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Age: {result.ageYears.toFixed(1)} / {result.usefulLifeYears} years
          </span>
        </div>
        <div className="relative h-5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.min(depPct, 100)}%`,
              background: `linear-gradient(90deg, ${depPct > 75 ? '#ef4444' : depPct > 50 ? '#f97316' : depPct > 25 ? '#f59e0b' : '#8b5cf6'}, ${depPct > 75 ? '#dc2626' : depPct > 50 ? '#ea580c' : depPct > 25 ? '#d97706' : '#7c3aed'})`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-screen">
            {depPct.toFixed(1)}% Depreciated
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
          <span>Purchase: QAR {fmt(result.cost)}</span>
          <span>Book Value: QAR {fmt(result.currentBookValue)}</span>
          <span>Salvage: QAR {fmt(result.salvageValue)}</span>
        </div>
      </div>

      {/* ── Method selector & AI insight ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(METHOD_LABELS) as DepreciationMethod[]).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`text-left rounded-xl p-3 border-2 transition-all ${
              method === m
                ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-violet-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {method === m
                ? <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                : <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              }
              <span className={`text-xs font-bold ${method === m ? "text-violet-700 dark:text-violet-300" : "text-slate-600 dark:text-slate-300"}`}>
                {METHOD_LABELS[m]}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{METHOD_DESC[m]}</p>
          </button>
        ))}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Depreciation Schedule</span>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-xs">
            {([["curve", "Curve"], ["bar", "Comparison"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setActiveChart(k)}
                className={`px-3 py-1.5 font-semibold transition-colors ${
                  activeChart === k
                    ? "bg-violet-600 text-white"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {activeChart === "curve" ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={curveData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradBV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gradDep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <ReferenceLine
                  x={`Y${result.ageYearsInt + 1} (${result.purchaseDate.getFullYear() + result.ageYearsInt})`}
                  stroke="#8b5cf6"
                  strokeDasharray="4 3"
                  label={{ value: "Today", position: "top", fontSize: 9, fill: "#8b5cf6" }}
                />
                <Area type="monotone" dataKey="Book Value"       stroke="#8b5cf6" fill="url(#gradBV)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Accumulated Dep." stroke="#f43f5e" fill="url(#gradDep)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={compData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Straight-Line"  fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dbl. Declining" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sum-of-Yrs"    fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Depreciation Schedule Table ───────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Annual Depreciation Schedule</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                {["Year", "Calendar Year", "Opening BV", "Depreciation", "Accumulated", "Closing BV", "% Dep."].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-bold text-[9px] uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.schedule.map((row, i) => {
                const isCurrent = row.year === result.ageYearsInt + 1;
                const isPast    = row.year <= result.ageYearsInt;
                return (
                  <tr
                    key={row.year}
                    className={`border-t border-slate-100 dark:border-slate-800 transition-colors ${
                      isCurrent
                        ? "bg-violet-50 dark:bg-violet-900/20"
                        : isPast
                          ? "bg-slate-50/50 dark:bg-slate-800/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">
                      {isCurrent && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />Y{row.year}</span>}
                      {!isCurrent && `Y${row.year}`}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{row.calendarYear}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">QAR {fmt(row.openingBookValue)}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold text-rose-600 dark:text-rose-400">QAR {fmt(row.depreciation)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">QAR {fmt(row.accumulatedDepreciation)}</td>
                    <td className="px-3 py-2 tabular-nums font-bold text-emerald-700 dark:text-emerald-400">QAR {fmt(row.closingBookValue)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(row.percentDepreciated, 100)}%`, background: row.percentDepreciated > 75 ? '#ef4444' : row.percentDepreciated > 50 ? '#f97316' : '#8b5cf6' }}
                          />
                        </div>
                        <span className="text-slate-600 dark:text-slate-300 tabular-nums">{row.percentDepreciated.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AI Insights & Recommendations ────────────────────────────── */}
      <div className={`rounded-xl border-2 p-4 ${cond.border} ${cond.bg}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cond.bg}`} style={{ border: `2px solid ${cond.color}` }}>
            {result.condition === "EXCELLENT" || result.condition === "GOOD"
              ? <CheckCircle2 className={`w-4 h-4 ${cond.text}`} />
              : <AlertTriangle className={`w-4 h-4 ${cond.text}`} />
            }
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-sm font-bold ${cond.text}`}>AI Valuation Insights — {cond.label} Condition</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${cond.border} ${cond.text}`}>
                Score {result.conditionScore}/100
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {[
                {
                  label: "Annual Depreciation Rate",
                  val: `${result.depreciationRate.toFixed(1)}% per year`,
                  sub: `QAR ${fmt(result.annualDepreciation)} this year`,
                },
                {
                  label: "Remaining Useful Life",
                  val: `${result.remainingLife.toFixed(1)} years`,
                  sub: `Replacement by ${fmtDate(result.recommendedReplacement)}`,
                },
                {
                  label: "Salvage / Residual Value",
                  val: `QAR ${fmt(result.salvageValue)}`,
                  sub: `${(SALVAGE_RATE * 100).toFixed(0)}% of original cost`,
                },
                {
                  label: "Replacement Budget (est.)",
                  val: `QAR ${fmt(result.replacementBudget)}`,
                  sub: "Inflation-adjusted at 3% p.a.",
                },
              ].map(({ label, val, sub }) => (
                <div key={label} className="bg-white/60 dark:bg-black/20 rounded-lg p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                  <p className={`text-sm font-bold ${cond.text}`}>{val}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
