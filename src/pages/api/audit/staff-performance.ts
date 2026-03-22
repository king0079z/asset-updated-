// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';
import PDFDocument from 'pdfkit';

/* ── helpers ── */
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDuration(ms?: number) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const hr = Math.floor(m / 60);
  if (hr > 0) return `${hr}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await requireAuth(req, res);
  if (!authResult) return;
  const { user } = authResult;

  const roleData = await getUserRoleData(user.id);
  const isAdmin = roleData?.isAdmin ?? false;

  const { userId, pdf } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Non-admins can only see their own stats
  if (!isAdmin && userId !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Fetch all reconciliation reports for this staff member
  const logs = await prisma.auditLog.findMany({
    where: { action: 'INVENTORY_REVIEW_SUBMITTED', userId },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });

  // Fetch the staff user
  let staffUser: any = null;
  try {
    staffUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true, createdAt: true },
    });
  } catch {}

  // ── Aggregate stats ────────────────────────────────────────────────────────
  let totalScans = logs.length;
  let totalScanned = 0;
  let totalInSystem = 0;
  let totalMissing = 0;
  let totalExtra = 0;
  let totalWrongLocation = 0;
  let totalSessionMs = 0;
  let alertCount = logs.filter(l => l.severity === 'WARNING' || l.severity === 'ERROR').length;

  // Per-location breakdown
  const locationMap: Record<string, { scans: number; missing: number; scanned: number; inSystem: number }> = {};
  // Missing items across all scans (top offenders)
  const missingItemFreq: Record<string, { name: string; barcode: string; count: number }> = {};
  // Trend over time (last 10 scans)
  const timeline: { date: string; missing: number; scanned: number; coverage: number }[] = [];

  for (const log of logs) {
    const d = (log.details as any) || {};
    const ms = d.totalScanned || 0;
    const sys = d.totalInSystem || 0;
    const miss = d.missingCount || 0;
    const extra = d.extraCount || 0;
    const wrong = d.wrongLocationCount || 0;
    const sesMs = d.sessionDurationMs || 0;

    totalScanned += ms;
    totalInSystem += sys;
    totalMissing += miss;
    totalExtra += extra;
    totalWrongLocation += wrong;
    totalSessionMs += sesMs;

    // Location breakdown
    const locKey = [d.floorNumber, d.roomNumber].filter(Boolean).join(' / ') || 'Unknown';
    if (!locationMap[locKey]) locationMap[locKey] = { scans: 0, missing: 0, scanned: 0, inSystem: 0 };
    locationMap[locKey].scans++;
    locationMap[locKey].missing += miss;
    locationMap[locKey].scanned += ms;
    locationMap[locKey].inSystem += sys;

    // Missing item frequency
    (d.missingItems || []).forEach((item: any) => {
      const key = item.barcode || item.name || 'unknown';
      if (!missingItemFreq[key]) missingItemFreq[key] = { name: item.name || '—', barcode: item.barcode || '—', count: 0 };
      missingItemFreq[key].count++;
    });

    // Timeline (last 10 scans)
    if (timeline.length < 10) {
      const cov = sys > 0 ? Math.round((ms / sys) * 100) : 0;
      timeline.push({ date: fmtDate(d.submittedAt || log.timestamp?.toISOString()), missing: miss, scanned: ms, coverage: cov });
    }
  }

  const avgCoverage = totalInSystem > 0 ? Math.round((totalScanned / totalInSystem) * 100) : 0;
  const avgMissingPerScan = totalScans > 0 ? +(totalMissing / totalScans).toFixed(1) : 0;
  const avgDurationMs = totalScans > 0 ? Math.round(totalSessionMs / totalScans) : 0;

  // Top locations by missing items
  const locationBreakdown = Object.entries(locationMap)
    .map(([loc, s]) => ({ location: loc, ...s, coveragePct: s.inSystem > 0 ? Math.round((s.scanned / s.inSystem) * 100) : 0 }))
    .sort((a, b) => b.missing - a.missing);

  // Top missing items
  const topMissingItems = Object.values(missingItemFreq)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // ── AI Insights ────────────────────────────────────────────────────────────
  const insights: string[] = [];

  if (totalScans === 0) {
    insights.push('No inventory scans recorded yet for this staff member.');
  } else {
    // Coverage insight
    if (avgCoverage >= 95) {
      insights.push(`Excellent scan coverage of ${avgCoverage}% — this staff member consistently locates the vast majority of registered assets.`);
    } else if (avgCoverage >= 80) {
      insights.push(`Good average scan coverage of ${avgCoverage}%. A moderate number of items are not being physically located during scans — consider verifying asset placement records.`);
    } else {
      insights.push(`Low average scan coverage of ${avgCoverage}%. Significant inventory discrepancies suggest either assets are misplaced, unregistered movements occurred, or scanning procedures need improvement.`);
    }

    // Missing rate
    if (avgMissingPerScan === 0) {
      insights.push('Outstanding — zero missing items recorded on average per scan session. Asset accountability is excellent.');
    } else if (avgMissingPerScan <= 2) {
      insights.push(`Low missing rate: ${avgMissingPerScan} items missing on average per scan. This is within acceptable operational range.`);
    } else if (avgMissingPerScan <= 8) {
      insights.push(`Moderate missing rate: ${avgMissingPerScan} items on average per scan session. Regular review of these locations is recommended.`);
    } else {
      insights.push(`High missing rate: ${avgMissingPerScan} items on average per scan session. Immediate investigation of recurring missing assets is strongly recommended.`);
    }

    // Hot locations
    const hotLoc = locationBreakdown.find(l => l.missing > 5);
    if (hotLoc) {
      insights.push(`Location "${hotLoc.location}" is a recurring hotspot with ${hotLoc.missing} total missing items across ${hotLoc.scans} scan session${hotLoc.scans !== 1 ? 's' : ''}. Priority attention is needed here.`);
    }

    // Repeated missing items
    const chronic = topMissingItems.filter(i => i.count >= 3);
    if (chronic.length > 0) {
      insights.push(`${chronic.length} asset${chronic.length > 1 ? 's have' : ' has'} gone missing in 3 or more separate scans (e.g. "${chronic[0].name}"). These should be escalated for investigation or written-off if unrecoverable.`);
    }

    // Alert rate
    const alertRate = totalScans > 0 ? Math.round((alertCount / totalScans) * 100) : 0;
    if (alertRate >= 70) {
      insights.push(`High alert rate: ${alertRate}% of scan sessions triggered missing-item warnings. A systemic review of asset storage practices is recommended.`);
    } else if (alertRate < 20 && totalScans > 3) {
      insights.push(`Very low alert rate of ${alertRate}% — this staff member consistently completes clean inventory sessions, indicating excellent asset stewardship.`);
    }

    // Wrong location
    if (totalWrongLocation > 10) {
      insights.push(`${totalWrongLocation} total "wrong location" events detected across all scans. Assets may be moved between rooms without system updates — review movement logging compliance.`);
    }

    // Session efficiency
    const avgMinutes = Math.round(avgDurationMs / 60000);
    if (avgMinutes > 0 && totalScanned > 0) {
      const itemsPerMin = (totalScanned / (totalSessionMs / 60000)).toFixed(1);
      insights.push(`Average scan throughput: ${itemsPerMin} assets/minute over an average session of ${fmtDuration(avgDurationMs)}.`);
    }
  }

  const performanceData = {
    staffUser: staffUser || { name: null, email: null, role: null },
    userId,
    totalScans,
    totalScanned,
    totalInSystem,
    totalMissing,
    totalExtra,
    totalWrongLocation,
    avgCoverage,
    avgMissingPerScan,
    avgDurationMs,
    alertCount,
    locationBreakdown,
    topMissingItems,
    timeline,
    insights,
  };

  // ── PDF mode ────────────────────────────────────────────────────────────────
  if (pdf === '1') {
    return generatePerformancePdf(res, performanceData);
  }

  return res.status(200).json(performanceData);
}

/* ── PDF Generation ── */
async function generatePerformancePdf(res: any, data: any) {
  const { staffUser, userId, totalScans, totalMissing, avgCoverage, avgMissingPerScan,
    alertCount, locationBreakdown, topMissingItems, timeline, insights } = data;

  const INDIGO = '#4338ca'; const PURPLE = '#7c3aed'; const SLATE9 = '#0f172a';
  const SLATE7 = '#334155'; const SLATE5 = '#64748b'; const SLATE3 = '#cbd5e1';
  const SLATE1 = '#f8fafc'; const WHITE = '#ffffff'; const RED = '#dc2626';
  const RED_LT = '#fef2f2'; const GREEN = '#16a34a'; const GREEN_LT = '#f0fdf4';
  const AMBER = '#d97706'; const AMBER_LT = '#fffbeb';

  type RGB = [number, number, number];
  const hex = (h: string): RGB => { const c = h.replace('#',''); return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]; };
  const fill = (doc: any, h: string) => doc.fillColor(hex(h));
  const stroke = (doc: any, h: string) => doc.strokeColor(hex(h));
  const rRect = (doc: any, x: number, y: number, w: number, h: number, r: number, fh: string, sh?: string) => {
    fill(doc, fh); if (sh) stroke(doc, sh); doc.roundedRect(x, y, w, h, r); if (sh) doc.fillAndStroke(); else doc.fill();
  };

  const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const PAGE_W = 595.28; const PAGE_H = 841.89; const M = 36; const CW = PAGE_W - M*2;
  const staffName = staffUser?.name || 'Staff Member';
  const staffEmail = staffUser?.email || '';

  // Hero
  rRect(doc, 0, 0, PAGE_W, 175, 0, INDIGO);
  fill(doc, PURPLE); doc.opacity(0.2).circle(PAGE_W - 40, 20, 110).fill().opacity(1);
  fill(doc, WHITE);
  doc.font('Helvetica-Bold').fontSize(22).text('STAFF INVENTORY PERFORMANCE REPORT', M, 38, { width: CW - 40 });
  doc.font('Helvetica').fontSize(9).fillColor(hex('#c7d2fe')).text(`${staffName}  ·  ${staffEmail}`, M, 70);
  doc.font('Helvetica').fontSize(8).fillColor(hex('#c7d2fe')).text(`Generated: ${new Date().toLocaleString()}  ·  User ID: ${userId}`, M, 84);

  // KPI chips
  const kpis = [
    { l: 'Total Scans', v: totalScans }, { l: 'Total Missing', v: totalMissing },
    { l: 'Avg Coverage', v: `${avgCoverage}%` }, { l: 'Avg Missing/Scan', v: avgMissingPerScan },
    { l: 'Alert Sessions', v: alertCount },
  ];
  const kW = (CW - 8) / 5;
  kpis.forEach((k, i) => {
    const x = M + i * (kW + 2);
    rRect(doc, x, 105, kW, 55, 8, '#ffffff18');
    fill(doc, WHITE); doc.font('Helvetica-Bold').fontSize(18).text(String(k.v), x+4, 116, { width: kW-8, align: 'center' });
    fill(doc, '#c7d2fe'); doc.font('Helvetica').fontSize(7.5).text(k.l, x+4, 138, { width: kW-8, align: 'center' });
  });

  let y = 192;

  // AI Insights section
  rRect(doc, M, y, CW, 24, 6, '#eef2ff');
  fill(doc, INDIGO); doc.font('Helvetica-Bold').fontSize(11).text('★  AI Performance Insights', M+10, y+7);
  y += 30;

  insights.forEach((ins: string, i: number) => {
    const bullet = `${i+1}. `;
    const h = Math.ceil(doc.heightOfString(bullet + ins, { width: CW - 24 })) + 10;
    rRect(doc, M, y, CW, h, 6, i % 2 === 0 ? SLATE1 : WHITE);
    fill(doc, SLATE7); doc.font('Helvetica').fontSize(9).text(bullet + ins, M+10, y+5, { width: CW - 20 });
    y += h + 4;
    if (y > PAGE_H - 80) {
      doc.addPage({ margin: 0, size: 'A4' });
      rRect(doc, 0, 0, PAGE_W, 24, 0, INDIGO); fill(doc, WHITE);
      doc.font('Helvetica-Bold').fontSize(9).text('STAFF PERFORMANCE REPORT  (continued)', M, 8);
      y = 40;
    }
  });

  y += 10;

  // Location breakdown table
  if (locationBreakdown.length > 0) {
    if (y > PAGE_H - 120) {
      doc.addPage({ margin: 0, size: 'A4' }); rRect(doc, 0, 0, PAGE_W, 24, 0, INDIGO); fill(doc, WHITE);
      doc.font('Helvetica-Bold').fontSize(9).text('STAFF PERFORMANCE REPORT  (continued)', M, 8); y = 40;
    }
    rRect(doc, M, y, CW, 22, 6, '#eef2ff'); fill(doc, INDIGO);
    doc.font('Helvetica-Bold').fontSize(10).text('Location Breakdown', M+10, y+6); y += 28;
    // header
    rRect(doc, M, y, CW, 16, 0, SLATE1);
    fill(doc, SLATE5); doc.font('Helvetica-Bold').fontSize(7.5);
    const lCols = [
      {l:'Location', x:M+4, w:140}, {l:'Scans', x:M+146, w:40}, {l:'Scanned', x:M+188, w:50},
      {l:'In System', x:M+240, w:55}, {l:'Missing', x:M+297, w:50}, {l:'Coverage', x:M+349, w:55},
    ];
    lCols.forEach(c => doc.text(c.l, c.x, y+4, { width: c.w }));
    y += 16;
    locationBreakdown.slice(0, 25).forEach((loc: any, i: number) => {
      rRect(doc, M, y, CW, 16, 0, i%2===0?WHITE:SLATE1);
      fill(doc, loc.missing > 5 ? RED : SLATE7); doc.font('Helvetica').fontSize(8);
      doc.text(loc.location, lCols[0].x, y+4, { width: lCols[0].w });
      fill(doc, SLATE7);
      doc.text(String(loc.scans), lCols[1].x, y+4, { width: lCols[1].w });
      doc.text(String(loc.scanned), lCols[2].x, y+4, { width: lCols[2].w });
      doc.text(String(loc.inSystem), lCols[3].x, y+4, { width: lCols[3].w });
      fill(doc, loc.missing > 0 ? RED : GREEN);
      doc.text(String(loc.missing), lCols[4].x, y+4, { width: lCols[4].w });
      const cov = loc.coveragePct;
      fill(doc, cov>=90?GREEN:cov>=70?AMBER:RED);
      doc.text(`${cov}%`, lCols[5].x, y+4, { width: lCols[5].w });
      y += 16;
      if (y > PAGE_H - 60) {
        doc.addPage({ margin: 0, size: 'A4' }); rRect(doc, 0, 0, PAGE_W, 24, 0, INDIGO); fill(doc, WHITE);
        doc.font('Helvetica-Bold').fontSize(9).text('STAFF PERFORMANCE REPORT  (continued)', M, 8); y = 40;
      }
    });
    y += 10;
  }

  // Top missing items
  if (topMissingItems.length > 0) {
    if (y > PAGE_H - 120) {
      doc.addPage({ margin: 0, size: 'A4' }); rRect(doc, 0, 0, PAGE_W, 24, 0, INDIGO); fill(doc, WHITE);
      doc.font('Helvetica-Bold').fontSize(9).text('STAFF PERFORMANCE REPORT  (continued)', M, 8); y = 40;
    }
    rRect(doc, M, y, CW, 22, 6, RED_LT); fill(doc, RED);
    doc.font('Helvetica-Bold').fontSize(10).text('Frequently Missing Assets', M+10, y+6); y += 28;
    rRect(doc, M, y, CW, 16, 0, SLATE1); fill(doc, SLATE5); doc.font('Helvetica-Bold').fontSize(7.5);
    doc.text('#', M+4, y+4, {width:20}).text('Asset Name', M+26, y+4, {width:180}).text('Barcode', M+208, y+4, {width:110}).text('Times Missing', M+320, y+4, {width:80});
    y += 16;
    topMissingItems.forEach((item: any, i: number) => {
      rRect(doc, M, y, CW, 16, 0, i%2===0?WHITE:SLATE1);
      fill(doc, SLATE7); doc.font('Helvetica').fontSize(8);
      doc.text(String(i+1), M+4, y+4, {width:20});
      doc.text(item.name, M+26, y+4, {width:180});
      doc.text(item.barcode, M+208, y+4, {width:110});
      fill(doc, item.count>=3?RED:AMBER);
      doc.font('Helvetica-Bold').fontSize(8).text(String(item.count), M+320, y+4, {width:80});
      y += 16;
    });
  }

  // Footer on each page
  const pgCount = (doc as any).bufferedPageRange().count;
  for (let i = 0; i < pgCount; i++) {
    doc.switchToPage(i);
    rRect(doc, 0, PAGE_H-24, PAGE_W, 24, 0, SLATE9);
    fill(doc, SLATE5); doc.font('Helvetica').fontSize(7.5).text(`Generated: ${new Date().toLocaleString()}`, M, PAGE_H-14);
    fill(doc, SLATE3); doc.font('Helvetica').fontSize(7.5).text(`Page ${i+1} of ${pgCount}`, PAGE_W-M-50, PAGE_H-14, {width:50,align:'right'});
    fill(doc, SLATE5); doc.font('Helvetica').fontSize(7).text('CONFIDENTIAL — Staff Inventory Performance Report', 0, PAGE_H-14, {width:PAGE_W,align:'center'});
  }

  doc.end();
  await new Promise<void>(resolve => doc.on('end', resolve));
  const buf = Buffer.concat(chunks);
  const safeName = (staffUser?.name || 'staff').replace(/[^a-z0-9]/gi,'_').toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="staff_performance_${safeName}.pdf"`);
  res.setHeader('Content-Length', buf.length);
  return res.status(200).send(buf);
}
