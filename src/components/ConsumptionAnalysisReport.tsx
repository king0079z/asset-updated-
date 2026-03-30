import React from 'react';

type MonthlyConsumption = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
};

type CategoryForecast = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
  confidence: number;
};

interface ConsumptionAnalysisReportProps {
  monthlyData: MonthlyConsumption[];
  categoryForecasts: CategoryForecast[];
  currentDate: Date;
}

// ── Inline-style constants (safe for renderToString + iframe print) ────────────
const C = {
  violet:     '#7c3aed',
  violetLt:   '#ede9fe',
  emerald:    '#059669',
  emeraldLt:  '#d1fae5',
  indigo:     '#4f46e5',
  indigoLt:   '#e0e7ff',
  amber:      '#d97706',
  amberLt:    '#fef3c7',
  sky:        '#0284c7',
  skyLt:      '#e0f2fe',
  rose:       '#e11d48',
  roseLt:     '#ffe4e6',
  slate:      '#475569',
  slateLight: '#94a3b8',
  border:     '#e2e8f0',
  bg:         '#f8fafc',
  white:      '#ffffff',
  text:       '#0f172a',
  textMuted:  '#64748b',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR', maximumFractionDigits: 0 }).format(n);

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

const confColor = (c: number) =>
  c >= 0.80 ? C.emerald : c >= 0.65 ? C.sky : C.amber;

const confBg = (c: number) =>
  c >= 0.80 ? C.emeraldLt : c >= 0.65 ? C.skyLt : C.amberLt;

// ── Sub-components ─────────────────────────────────────────────────────────────
const Bar = ({ value, color, height = 8 }: { value: number; color: string; height?: number }) => (
  <div style={{ width: '100%', background: '#e2e8f0', borderRadius: 9999, height, overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(100, value)}%`, background: color, height: '100%', borderRadius: 9999 }} />
  </div>
);

const KpiCard = ({
  label, value, sub, accent, bg,
}: { label: string; value: string; sub: string; accent: string; bg: string }) => (
  <div style={{
    background: bg, border: `1px solid ${accent}30`, borderRadius: 12,
    padding: '14px 16px', flex: 1,
    borderTop: `3px solid ${accent}`,
  }}>
    <p style={{ fontSize: 11, color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
    <p style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '4px 0 2px' }}>{value}</p>
    <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{sub}</p>
  </div>
);

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${C.border}` }}>
    <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
    {subtitle && <p style={{ fontSize: 11, color: C.textMuted, margin: '3px 0 0' }}>{subtitle}</p>}
  </div>
);

const MonthRow = ({ month, isEven, isTotal }: { month: MonthlyConsumption; isEven: boolean; isTotal?: boolean }) => (
  <tr style={{ background: isTotal ? '#f1f5f9' : isEven ? C.bg : C.white }}>
    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: isTotal ? 700 : 500, color: C.text, borderBottom: `1px solid ${C.border}` }}>
      {isTotal ? 'TOTAL' : `${month.month} ${month.year}`}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: isTotal ? 700 : 400, color: C.emerald, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
      {fmt(month.foodConsumption)}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: isTotal ? 700 : 400, color: C.indigo, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
      {fmt(month.assetsPurchased)}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: isTotal ? 700 : 400, color: C.amber, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
      {fmt(month.vehicleRentalCosts)}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
      {fmt(month.total)}
    </td>
  </tr>
);

const ForecastRow = ({ forecast, isEven, isTotal }: { forecast: CategoryForecast; isEven: boolean; isTotal?: boolean }) => (
  <tr style={{ background: isTotal ? '#f1f5f9' : isEven ? C.bg : C.white }}>
    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: isTotal ? 700 : 500, color: C.text, borderBottom: `1px solid ${C.border}` }}>
      {isTotal ? 'TOTAL' : `${forecast.month} ${forecast.year}`}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, color: C.emerald, textAlign: 'right', fontWeight: isTotal ? 700 : 400, borderBottom: `1px solid ${C.border}` }}>
      {fmt(forecast.foodConsumption)}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, color: C.indigo, textAlign: 'right', fontWeight: isTotal ? 700 : 400, borderBottom: `1px solid ${C.border}` }}>
      {fmt(forecast.assetsPurchased)}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, color: C.amber, textAlign: 'right', fontWeight: isTotal ? 700 : 400, borderBottom: `1px solid ${C.border}` }}>
      {fmt(forecast.vehicleRentalCosts)}
    </td>
    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
      {fmt(forecast.total)}
    </td>
    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>
      {isTotal ? (
        <span style={{ fontSize: 11, color: C.textMuted }}>—</span>
      ) : (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 9999,
          background: confBg(forecast.confidence), color: confColor(forecast.confidence),
        }}>
          {Math.round(forecast.confidence * 100)}%
        </span>
      )}
    </td>
  </tr>
);

// ── Main Report Component ──────────────────────────────────────────────────────
export function ConsumptionAnalysisReport({
  monthlyData,
  categoryForecasts,
  currentDate,
}: ConsumptionAnalysisReportProps) {
  // Totals
  const ytdFood    = monthlyData.reduce((s, m) => s + m.foodConsumption, 0);
  const ytdAssets  = monthlyData.reduce((s, m) => s + m.assetsPurchased, 0);
  const ytdVehicle = monthlyData.reduce((s, m) => s + m.vehicleRentalCosts, 0);
  const ytdTotal   = ytdFood + ytdAssets + ytdVehicle;
  const avgMonthly = monthlyData.length ? ytdTotal / monthlyData.length : 0;
  const peakMonth  = [...monthlyData].sort((a, b) => b.total - a.total)[0];

  const fcFood    = categoryForecasts.reduce((s, f) => s + f.foodConsumption, 0);
  const fcAssets  = categoryForecasts.reduce((s, f) => s + f.assetsPurchased, 0);
  const fcVehicle = categoryForecasts.reduce((s, f) => s + f.vehicleRentalCosts, 0);
  const fcTotal   = fcFood + fcAssets + fcVehicle;
  const avgConf   = categoryForecasts.length
    ? categoryForecasts.reduce((s, f) => s + f.confidence, 0) / categoryForecasts.length : 0;

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const tableHead: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    color: C.white,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    padding: '10px 12px',
    textAlign: 'left' as const,
  };

  const categories = [
    { label: 'Food Consumption', ytd: ytdFood,    fc: fcFood,    color: C.emerald, bg: C.emeraldLt },
    { label: 'Assets Purchased', ytd: ytdAssets,  fc: fcAssets,  color: C.indigo,  bg: C.indigoLt  },
    { label: 'Vehicle Costs',    ytd: ytdVehicle, fc: fcVehicle, color: C.amber,   bg: C.amberLt   },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", color: C.text, background: C.white, maxWidth: 900, margin: '0 auto' }}>

      {/* ── Cover Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
        borderRadius: 16, padding: '36px 40px 32px', marginBottom: 28, color: C.white,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.7, margin: '0 0 8px' }}>
              Enterprise Analytics · Confidential
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Consumption Analysis
            </h1>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2, opacity: 0.7 }}>
              Report
            </h1>
          </div>
          <div style={{ textAlign: 'right', opacity: 0.85 }}>
            <p style={{ fontSize: 11, margin: '0 0 4px' }}>Generated</p>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>{formatDate(currentDate)}</p>
            <p style={{ fontSize: 11, margin: '0 0 4px' }}>Period covered</p>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
              {monthlyData.length > 0
                ? `${monthlyData[0].month} – ${monthlyData[monthlyData.length - 1].month} ${monthlyData[monthlyData.length - 1].year}`
                : 'N/A'}
            </p>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 20px' }}>
          {[
            { label: 'YTD Total Spend', value: fmt(ytdTotal) },
            { label: 'Monthly Average', value: fmt(avgMonthly) },
            { label: 'Peak Month', value: peakMonth ? peakMonth.month : '—' },
            { label: '6-Mo Forecast', value: fcTotal > 0 ? fmt(fcTotal) : '—' },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 12px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
              <p style={{ fontSize: 10, opacity: 0.7, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
              <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Executive KPI Cards ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <KpiCard label="YTD Total" value={fmt(ytdTotal)} sub={`${monthlyData.length} months of data`} accent={C.violet} bg={C.violetLt} />
        <KpiCard label="Monthly Average" value={fmt(avgMonthly)} sub="Based on all recorded months" accent={C.sky} bg={C.skyLt} />
        <KpiCard label="Peak Month" value={peakMonth ? peakMonth.month : '—'} sub={peakMonth ? fmt(peakMonth.total) : 'No data'} accent={C.rose} bg={C.roseLt} />
        <KpiCard label="6-Mo Forecast" value={fcTotal > 0 ? fmt(fcTotal) : '—'} sub={avgConf > 0 ? `${Math.round(avgConf * 100)}% avg. confidence` : 'No forecast data'} accent={C.emerald} bg={C.emeraldLt} />
      </div>

      {/* ── Category Distribution ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28, background: C.bg, borderRadius: 12, padding: '20px 24px', border: `1px solid ${C.border}` }}>
        <SectionTitle title="Category Distribution — Year to Date" subtitle="Spending breakdown across all expense categories" />
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {categories.map(c => (
            <div key={c.label} style={{ flex: 1, background: c.bg, borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${c.color}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{c.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 2px' }}>{fmt(c.ytd)}</p>
              <p style={{ fontSize: 11, color: C.textMuted, margin: '0 0 8px' }}>{pct(c.ytd, ytdTotal)}% of total</p>
              <Bar value={pct(c.ytd, ytdTotal)} color={c.color} height={6} />
            </div>
          ))}
        </div>

        {/* Stacked visual bar */}
        <div>
          <p style={{ fontSize: 10, color: C.textMuted, margin: '0 0 6px', fontWeight: 600 }}>SPENDING SPLIT</p>
          <div style={{ display: 'flex', height: 20, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
            {categories.map(c => (
              <div key={c.label} style={{ flex: pct(c.ytd, ytdTotal), background: c.color, minWidth: 4 }} title={`${c.label}: ${pct(c.ytd, ytdTotal)}%`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {categories.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                <span style={{ fontSize: 10, color: C.textMuted }}>{c.label} ({pct(c.ytd, ytdTotal)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monthly Breakdown Table ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionTitle
          title="Monthly Consumption Breakdown"
          subtitle={`Detailed month-by-month expense breakdown for ${monthlyData.length} recorded months`}
        />
        <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Month', 'Food Consumption', 'Assets Purchased', 'Vehicle Costs', 'Total'].map((h, i) => (
                  <th key={h} style={{ ...tableHead, textAlign: i > 0 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((month, i) => (
                <MonthRow key={`${month.month}-${month.year}`} month={month} isEven={i % 2 === 0} />
              ))}
              <MonthRow
                month={{ month: 'Total', year: 0, foodConsumption: ytdFood, assetsPurchased: ytdAssets, vehicleRentalCosts: ytdVehicle, total: ytdTotal }}
                isEven={false} isTotal
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Month Detail Cards ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionTitle title="Month-by-Month Analysis" subtitle="Individual spending profiles with category breakdowns" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {monthlyData.map((month) => {
            const isPeak = peakMonth && month.month === peakMonth.month && month.year === peakMonth.year;
            return (
              <div key={`${month.month}-${month.year}`} style={{
                border: isPeak ? `2px solid ${C.rose}` : `1px solid ${C.border}`,
                borderRadius: 10, padding: '14px 16px', background: C.white,
                pageBreakInside: 'avoid',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    {isPeak && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: C.rose, background: C.roseLt, padding: '2px 8px', borderRadius: 9999, marginBottom: 4, display: 'inline-block' }}>
                        PEAK MONTH
                      </span>
                    )}
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{month.month} {month.year}</p>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: C.violet, margin: 0 }}>{fmt(month.total)}</p>
                </div>
                {[
                  { label: 'Food', val: month.foodConsumption, color: C.emerald },
                  { label: 'Assets', val: month.assetsPurchased, color: C.indigo },
                  { label: 'Vehicles', val: month.vehicleRentalCosts, color: C.amber },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{row.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: row.color }}>{fmt(row.val)} <span style={{ color: C.textMuted, fontWeight: 400 }}>({pct(row.val, month.total)}%)</span></span>
                    </div>
                    <Bar value={pct(row.val, month.total)} color={row.color} height={5} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Forecast Table ───────────────────────────────────────────────────── */}
      {categoryForecasts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `2px solid ${C.border}` }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
                6-Month Forward Projection
              </h2>
              <p style={{ fontSize: 11, color: C.textMuted, margin: '3px 0 0' }}>
                AI-generated spending forecast for the next {categoryForecasts.length} months · Avg. confidence: {Math.round(avgConf * 100)}%
              </p>
            </div>
            <div style={{ background: C.violetLt, color: C.violet, fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 9999, whiteSpace: 'nowrap' as const }}>
              FORECAST REPORT
            </div>
          </div>

          {/* Forecast summary cards */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total 6-Month', value: fmt(fcTotal), color: C.violet, bg: C.violetLt },
              { label: 'Food (projected)', value: fmt(fcFood), color: C.emerald, bg: C.emeraldLt },
              { label: 'Assets (projected)', value: fmt(fcAssets), color: C.indigo, bg: C.indigoLt },
              { label: 'Vehicles (projected)', value: fmt(fcVehicle), color: C.amber, bg: C.amberLt },
            ].map(c => (
              <div key={c.label} style={{ flex: 1, background: c.bg, borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${c.color}` }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{c.label}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>{c.value}</p>
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Month', 'Food', 'Assets', 'Vehicles', 'Total Projected', 'Confidence'].map((h, i) => (
                    <th key={h} style={{ ...tableHead, textAlign: i === 0 || i === 5 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryForecasts.map((f, i) => (
                  <ForecastRow key={`${f.month}-${f.year}`} forecast={f} isEven={i % 2 === 0} />
                ))}
                <ForecastRow
                  forecast={{ month: 'Total', year: 0, foodConsumption: fcFood, assetsPurchased: fcAssets, vehicleRentalCosts: fcVehicle, total: fcTotal, confidence: 0 }}
                  isEven={false} isTotal
                />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Forecast Detail Cards ─────────────────────────────────────────────── */}
      {categoryForecasts.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionTitle title="Monthly Forecast Detail" subtitle="Category-level projections with confidence indicators" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {categoryForecasts.map((f, idx) => (
              <div key={`${f.month}-${f.year}`} style={{
                border: idx === 0 ? `2px solid ${C.violet}` : `1px solid ${C.border}`,
                borderRadius: 10, padding: '14px 16px', background: idx === 0 ? C.violetLt : C.white,
                pageBreakInside: 'avoid',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    {idx === 0 && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: C.violet, background: 'rgba(124,58,237,0.15)', padding: '2px 8px', borderRadius: 9999, marginBottom: 4, display: 'inline-block' }}>
                        NEXT MONTH
                      </span>
                    )}
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{f.month} {f.year}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: C.violet, margin: '0 0 2px' }}>{fmt(f.total)}</p>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                      background: confBg(f.confidence), color: confColor(f.confidence),
                    }}>
                      {Math.round(f.confidence * 100)}% CONFIDENCE
                    </span>
                  </div>
                </div>
                {[
                  { label: 'Food Consumption', val: f.foodConsumption, color: C.emerald },
                  { label: 'Assets Purchased', val: f.assetsPurchased, color: C.indigo },
                  { label: 'Vehicle Costs', val: f.vehicleRentalCosts, color: C.amber },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{row.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: row.color }}>{fmt(row.val)} <span style={{ color: C.textMuted, fontWeight: 400 }}>({pct(row.val, f.total)}%)</span></span>
                    </div>
                    <Bar value={pct(row.val, f.total)} color={row.color} height={5} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `2px solid ${C.border}`, paddingTop: 16, marginTop: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 600 }}>
            ASSET AI · Enterprise Consumption Analysis
          </p>
          <p style={{ fontSize: 10, color: C.slateLight, margin: '2px 0 0' }}>
            This report is confidential and intended solely for authorised recipients.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>Generated {formatDate(currentDate)}</p>
          <p style={{ fontSize: 10, color: C.slateLight, margin: '2px 0 0' }}>
            {monthlyData.length} months · {categoryForecasts.length} forecast months
          </p>
        </div>
      </div>
    </div>
  );
}
