/**
 * World-class Asset Depreciation Engine
 * Supports: Straight-Line (SL), Double Declining Balance (DDB),
 *            Sum-of-Years-Digits (SYD) — IAS 16 & IFRS-compliant
 */

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DOUBLE_DECLINING' | 'SUM_OF_YEARS_DIGITS';

export interface DepreciationInput {
  cost: number;           // Original purchase price
  salvageValue?: number;  // Residual value (default 10% of cost)
  purchaseDate: Date;     // Acquisition date
  usefulLifeYears: number; // Expected useful life
  method?: DepreciationMethod;
}

export interface YearlyDepreciation {
  year: number;
  calendarYear: number;
  openingBookValue: number;
  depreciation: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
  depreciationRate: number; // %
  percentDepreciated: number; // % of original cost
}

export interface DepreciationResult {
  method: DepreciationMethod;
  cost: number;
  salvageValue: number;
  usefulLifeYears: number;
  purchaseDate: Date;

  // Key current-period values
  ageYears: number;             // Fractional years since purchase
  ageYearsInt: number;          // Whole years elapsed
  currentBookValue: number;     // Today's book value
  accumulatedDepreciation: number; // Total depreciation so far
  annualDepreciation: number;   // Depreciation for current year
  depreciationRate: number;     // Annual rate %
  remainingLife: number;        // Years remaining

  // AI-enhanced insights
  depreciationPercent: number;  // % of cost depreciated so far
  recommendedReplacement: Date; // When to plan replacement
  replacementBudget: number;    // Suggested replacement provision
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  conditionScore: number;        // 0–100

  // Full schedule (year by year)
  schedule: YearlyDepreciation[];

  // Multi-method comparison
  comparison: {
    sl:  { bookValue: number; accumulatedDepreciation: number };
    ddb: { bookValue: number; accumulatedDepreciation: number };
    syd: { bookValue: number; accumulatedDepreciation: number };
  };
}

// ── Useful life defaults by asset type (years) ──────────────────────────────
export const USEFUL_LIFE_BY_TYPE: Record<string, number> = {
  FURNITURE:          10,
  EQUIPMENT:           7,
  ELECTRONICS:         5,
  IT:                  3,
  VEHICLE:             5,
  MEDICAL_EQUIPMENT:  10,
  CONSUMABLE_MEDICAL:  2,
  TOOL:                5,
  SPARE_PART:          5,
  OTHER:               7,
};

export const SALVAGE_RATE = 0.10; // 10% residual value

// ── Core calculation helpers ─────────────────────────────────────────────────

function calcStraightLine(
  cost: number, salvage: number, life: number, yearIdx: number
): { dep: number; rate: number } {
  const annual = (cost - salvage) / life;
  return { dep: annual, rate: (annual / cost) * 100 };
}

function calcDDB(
  openingBV: number, cost: number, salvage: number, life: number
): { dep: number; rate: number } {
  const rate = 2 / life;
  const dep = Math.min(openingBV * rate, openingBV - salvage);
  return { dep: Math.max(dep, 0), rate: rate * 100 };
}

function calcSYD(
  cost: number, salvage: number, life: number, yearIdx: number // yearIdx is 1-based
): { dep: number; rate: number } {
  const sumYears = (life * (life + 1)) / 2;
  const remaining = life - yearIdx + 1;
  const dep = ((cost - salvage) * remaining) / sumYears;
  return { dep: Math.max(dep, 0), rate: (dep / cost) * 100 };
}

// ── Full schedule builder ─────────────────────────────────────────────────────

function buildSchedule(
  method: DepreciationMethod,
  cost: number,
  salvage: number,
  life: number,
  purchaseYear: number
): YearlyDepreciation[] {
  const schedule: YearlyDepreciation[] = [];
  let openingBV = cost;
  let accumulated = 0;

  for (let i = 1; i <= life; i++) {
    let dep = 0;
    let rate = 0;

    if (method === 'STRAIGHT_LINE') {
      ({ dep, rate } = calcStraightLine(cost, salvage, life, i));
    } else if (method === 'DOUBLE_DECLINING') {
      ({ dep, rate } = calcDDB(openingBV, cost, salvage, life));
    } else {
      ({ dep, rate } = calcSYD(cost, salvage, life, i));
    }

    // Clamp to not go below salvage
    if (openingBV - dep < salvage) dep = Math.max(openingBV - salvage, 0);

    accumulated += dep;
    const closingBV = openingBV - dep;

    schedule.push({
      year: i,
      calendarYear: purchaseYear + i - 1,
      openingBookValue: Math.round(openingBV * 100) / 100,
      depreciation: Math.round(dep * 100) / 100,
      accumulatedDepreciation: Math.round(accumulated * 100) / 100,
      closingBookValue: Math.round(closingBV * 100) / 100,
      depreciationRate: Math.round(rate * 10) / 10,
      percentDepreciated: Math.round((accumulated / cost) * 1000) / 10,
    });

    openingBV = closingBV;
    if (openingBV <= salvage) break;
  }

  return schedule;
}

// ── Current book value (fractional year interpolation) ─────────────────────

function interpolateCurrentBV(
  schedule: YearlyDepreciation[],
  ageYears: number,
  cost: number
): { bookValue: number; accumulated: number } {
  if (ageYears <= 0) return { bookValue: cost, accumulated: 0 };
  if (ageYears >= schedule.length) {
    const last = schedule[schedule.length - 1];
    return { bookValue: last.closingBookValue, accumulated: last.accumulatedDepreciation };
  }

  const yearIdx = Math.floor(ageYears); // 0-based
  const fraction = ageYears - yearIdx;

  if (yearIdx === 0) {
    const opening = cost;
    const closing = schedule[0].closingBookValue;
    const bv = opening - fraction * (opening - closing);
    return { bookValue: bv, accumulated: cost - bv };
  }

  const prevRow = schedule[yearIdx - 1];
  const curRow  = schedule[yearIdx];
  if (!curRow) return { bookValue: prevRow.closingBookValue, accumulated: prevRow.accumulatedDepreciation };

  const bv = prevRow.closingBookValue - fraction * curRow.depreciation;
  return { bookValue: Math.max(bv, curRow.closingBookValue), accumulated: cost - Math.max(bv, curRow.closingBookValue) };
}

// ── Condition from book value ────────────────────────────────────────────────

function conditionFromBV(
  bookValue: number, cost: number, salvage: number
): { condition: DepreciationResult['condition']; score: number } {
  const range = cost - salvage;
  const pct = range > 0 ? ((bookValue - salvage) / range) * 100 : 0;
  if (pct >= 85) return { condition: 'EXCELLENT', score: Math.round(pct) };
  if (pct >= 65) return { condition: 'GOOD',      score: Math.round(pct) };
  if (pct >= 40) return { condition: 'FAIR',       score: Math.round(pct) };
  if (pct >= 20) return { condition: 'POOR',       score: Math.round(pct) };
  return               { condition: 'CRITICAL',    score: Math.round(pct) };
}

// ── Main exported function ───────────────────────────────────────────────────

export function calculateDepreciation(input: DepreciationInput): DepreciationResult {
  const {
    cost,
    purchaseDate,
    usefulLifeYears,
    method = 'STRAIGHT_LINE',
  } = input;

  const salvageValue = input.salvageValue ?? cost * SALVAGE_RATE;
  const now = new Date();
  const msPerYear = 365.25 * 24 * 3600 * 1000;
  const ageYears = Math.max((now.getTime() - purchaseDate.getTime()) / msPerYear, 0);
  const ageYearsInt = Math.floor(ageYears);
  const remainingLife = Math.max(usefulLifeYears - ageYears, 0);

  const schedule = buildSchedule(method, cost, salvageValue, usefulLifeYears, purchaseDate.getFullYear());

  const { bookValue: currentBookValue, accumulated: accumulatedDepreciation } =
    interpolateCurrentBV(schedule, ageYears, cost);

  const currentYearRow = schedule[Math.min(ageYearsInt, schedule.length - 1)];
  const annualDepreciation = currentYearRow?.depreciation ?? 0;
  const depreciationRate   = currentYearRow?.depreciationRate ?? 0;

  const depreciationPercent = cost > 0 ? (accumulatedDepreciation / cost) * 100 : 0;

  const { condition, score: conditionScore } = conditionFromBV(currentBookValue, cost, salvageValue);

  // Replacement recommended at end of useful life
  const recommendedReplacement = new Date(purchaseDate.getTime() + usefulLifeYears * msPerYear);
  // Replacement budget = current replacement cost estimate (inflation ~3% pa)
  const inflationFactor = Math.pow(1.03, ageYears);
  const replacementBudget = Math.round(cost * inflationFactor);

  // Multi-method comparison (current book value)
  const slSchedule  = buildSchedule('STRAIGHT_LINE',       cost, salvageValue, usefulLifeYears, purchaseDate.getFullYear());
  const ddbSchedule = buildSchedule('DOUBLE_DECLINING',    cost, salvageValue, usefulLifeYears, purchaseDate.getFullYear());
  const sydSchedule = buildSchedule('SUM_OF_YEARS_DIGITS', cost, salvageValue, usefulLifeYears, purchaseDate.getFullYear());

  const slBV  = interpolateCurrentBV(slSchedule,  ageYears, cost);
  const ddbBV = interpolateCurrentBV(ddbSchedule, ageYears, cost);
  const sydBV = interpolateCurrentBV(sydSchedule, ageYears, cost);

  return {
    method,
    cost,
    salvageValue: Math.round(salvageValue * 100) / 100,
    usefulLifeYears,
    purchaseDate,
    ageYears: Math.round(ageYears * 100) / 100,
    ageYearsInt,
    currentBookValue: Math.round(currentBookValue * 100) / 100,
    accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
    annualDepreciation: Math.round(annualDepreciation * 100) / 100,
    depreciationRate: Math.round(depreciationRate * 10) / 10,
    remainingLife: Math.round(remainingLife * 100) / 100,
    depreciationPercent: Math.round(depreciationPercent * 10) / 10,
    recommendedReplacement,
    replacementBudget,
    condition,
    conditionScore,
    schedule,
    comparison: {
      sl:  { bookValue: Math.round(slBV.bookValue  * 100) / 100, accumulatedDepreciation: Math.round(slBV.accumulated  * 100) / 100 },
      ddb: { bookValue: Math.round(ddbBV.bookValue * 100) / 100, accumulatedDepreciation: Math.round(ddbBV.accumulated * 100) / 100 },
      syd: { bookValue: Math.round(sydBV.bookValue * 100) / 100, accumulatedDepreciation: Math.round(sydBV.accumulated * 100) / 100 },
    },
  };
}

// ── Portfolio helper ─────────────────────────────────────────────────────────

export interface PortfolioDepreciation {
  totalCost: number;
  totalCurrentValue: number;
  totalAccumulatedDepreciation: number;
  overallDepreciationPercent: number;
  byType: Array<{
    type: string;
    count: number;
    totalCost: number;
    totalBookValue: number;
    totalDepreciation: number;
    depreciationPercent: number;
  }>;
  topDepreciated: Array<{
    id: string;
    name: string;
    cost: number;
    bookValue: number;
    depreciationPercent: number;
  }>;
}

export function calculatePortfolioDepreciation(assets: Array<{
  id: string;
  name: string;
  type?: string | null;
  purchaseAmount?: number | null;
  purchaseDate?: Date | string | null;
  createdAt: Date | string;
}>): PortfolioDepreciation {
  let totalCost = 0;
  let totalCurrentValue = 0;
  let totalAccumulatedDepreciation = 0;
  const byTypeMap: Record<string, { count: number; totalCost: number; totalBV: number; totalDep: number }> = {};
  const assetResults: Array<{ id: string; name: string; cost: number; bookValue: number; depreciationPercent: number }> = [];

  for (const a of assets) {
    const cost = a.purchaseAmount;
    if (!cost || cost <= 0) continue;

    const type = a.type ?? 'OTHER';
    const usefulLife = USEFUL_LIFE_BY_TYPE[type] ?? 7;
    const purchaseDate = a.purchaseDate
      ? new Date(a.purchaseDate)
      : new Date(a.createdAt);

    let result: DepreciationResult;
    try {
      result = calculateDepreciation({ cost, purchaseDate, usefulLifeYears: usefulLife });
    } catch { continue; }

    totalCost += cost;
    totalCurrentValue += result.currentBookValue;
    totalAccumulatedDepreciation += result.accumulatedDepreciation;

    if (!byTypeMap[type]) byTypeMap[type] = { count: 0, totalCost: 0, totalBV: 0, totalDep: 0 };
    byTypeMap[type].count++;
    byTypeMap[type].totalCost += cost;
    byTypeMap[type].totalBV  += result.currentBookValue;
    byTypeMap[type].totalDep += result.accumulatedDepreciation;

    assetResults.push({
      id: a.id,
      name: a.name,
      cost,
      bookValue: result.currentBookValue,
      depreciationPercent: result.depreciationPercent,
    });
  }

  const overallDepreciationPercent = totalCost > 0
    ? (totalAccumulatedDepreciation / totalCost) * 100
    : 0;

  const byType = Object.entries(byTypeMap).map(([type, v]) => ({
    type,
    count: v.count,
    totalCost: Math.round(v.totalCost),
    totalBookValue: Math.round(v.totalBV),
    totalDepreciation: Math.round(v.totalDep),
    depreciationPercent: v.totalCost > 0 ? Math.round((v.totalDep / v.totalCost) * 1000) / 10 : 0,
  })).sort((a, b) => b.totalDepreciation - a.totalDepreciation);

  const topDepreciated = [...assetResults]
    .sort((a, b) => b.depreciationPercent - a.depreciationPercent)
    .slice(0, 10);

  return {
    totalCost: Math.round(totalCost),
    totalCurrentValue: Math.round(totalCurrentValue),
    totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation),
    overallDepreciationPercent: Math.round(overallDepreciationPercent * 10) / 10,
    byType,
    topDepreciated,
  };
}
