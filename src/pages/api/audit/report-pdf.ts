// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import PDFDocument from 'pdfkit';

/* ── Colours (all standard hex 6-char) ── */
const INDIGO    = '#4338ca';
const INDIGO_LT = '#eef2ff';
const INDIGO_D  = '#3730a3';
const SLATE9    = '#0f172a';
const SLATE7    = '#334155';
const SLATE5    = '#64748b';
const SLATE3    = '#cbd5e1';
const SLATE1    = '#f8fafc';
const WHITE     = '#ffffff';
const RED       = '#dc2626';
const RED_LT    = '#fef2f2';
const AMBER     = '#d97706';
const AMBER_LT  = '#fffbeb';
const GREEN     = '#16a34a';
const GREEN_LT  = '#f0fdf4';
const BLUE      = '#2563eb';
const BLUE_LT   = '#eff6ff';

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const c = h.replace('#', '').slice(0, 6);
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
};
const fill   = (doc: any, h: string) => doc.fillColor(hex(h));
const stroke = (doc: any, h: string) => doc.strokeColor(hex(h));

function rRect(doc: any, x: number, y: number, w: number, h: number, r: number, fh: string, sh?: string) {
  fill(doc, fh);
  if (sh) stroke(doc, sh);
  doc.roundedRect(x, y, w, h, Math.min(r, w/2, h/2));
  if (sh) doc.fillAndStroke(); else doc.fill();
}

function drawLine(doc: any, x1: number, y1: number, x2: number, y2: number, color: string, lw = 0.5) {
  stroke(doc, color);
  doc.lineWidth(lw).moveTo(x1, y1).lineTo(x2, y2).stroke();
}

function safeText(s?: any): string {
  if (!s && s !== 0) return '';
  // Strip anything outside printable ASCII
  return String(s).replace(/[^\x20-\x7E]/g, '');
}

function truncStr(doc: any, text: string, maxW: number): string {
  if (!text) return '';
  let t = safeText(text);
  while (t.length > 3 && doc.widthOfString(t) > maxW) t = t.slice(0, -4) + '...';
  return t;
}

function fmtDate(iso?: string) {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch { return String(iso); }
}
function fmtDur(ms?: number) {
  if (!ms) return 'N/A';
  const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60);
  if (h>0) return `${h}h ${m%60}m`; if (m>0) return `${m}m ${s%60}s`; return `${s}s`;
}

function addContinuationHeader(doc: any, pw: number, margin: number, logId: string) {
  rRect(doc, 0, 0, pw, 26, 0, INDIGO_D);
  fill(doc, WHITE);
  doc.font('Helvetica-Bold').fontSize(8).text('INVENTORY RECONCILIATION REPORT  (continued)', margin, 9, { width: pw - margin*2 });
  fill(doc, SLATE3);
  doc.font('Helvetica').fontSize(7).text(`Ref: ${safeText(logId)}`, pw - margin - 200, 10, { width: 200, align: 'right' });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authResult = await requireAuth(req, res);
  if (!authResult) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing report id' });

  let log: any;
  try {
    log = await prisma.auditLog.findUnique({ where: { id } });
  } catch (e: any) {
    console.error('[report-pdf] DB error:', e.message);
    return res.status(500).json({ error: 'Database error', detail: e.message });
  }

  if (!log || log.action !== 'INVENTORY_REVIEW_SUBMITTED') {
    return res.status(404).json({ error: 'Report not found' });
  }

  let submitter: any = null;
  if (log.userId) {
    try {
      // User model has no `name` column — select only fields that exist
      submitter = await prisma.user.findUnique({ where: { id: log.userId }, select: { email: true, role: true } });
    } catch (e) {
      console.warn('[report-pdf] user lookup failed:', (e as any)?.message);
    }
  }

  const details  = (log.details as any) || {};
  // Resolve best email from all available sources
  const resolvedEmail = submitter?.email || details.submittedByEmail || details.submittedByName || log.userEmail || null;
  const staffName  = safeText(resolvedEmail || 'Unknown Staff');
  const staffEmail = safeText(resolvedEmail || '');
  const staffRole  = safeText(submitter?.role || '');

  const missingItems: any[]  = details.missingItems        || [];
  const wrongItems: any[]    = details.wrongLocationItems   || [];
  const correctItems: any[]  = details.correctInRoomItems   || [];
  const extraItems: any[]    = details.extraItems           || [];

  const totalScanned = Number(details.totalScanned) || 0;
  const totalInSystem= Number(details.totalInSystem) || 0;
  const missingCount = Number(details.missingCount) || 0;
  const extraCount   = Number(details.extraCount) || 0;
  const wrongCount   = Number(details.wrongLocationCount) || 0;
  const coveragePct  = totalInSystem > 0 ? Math.round((totalScanned / totalInSystem) * 100) : 0;
  const locStr = safeText([
    details.floorNumber && `Floor ${details.floorNumber}`,
    details.roomNumber  && `Room ${details.roomNumber}`,
  ].filter(Boolean).join(', ') || 'All locations');

  // ── Build PDF ──────────────────────────────────────────────────────────────
  let doc: any;
  try {
    doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'PDF init failed', detail: e.message });
  }

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const PW = 595.28, PH = 841.89, M = 38, CW = PW - M * 2;

  try {
    // ── Hero band ────────────────────────────────────────────────────────────
    rRect(doc, 0, 0, PW, 185, 0, INDIGO);

    // Decorative rectangles (no opacity/emoji)
    rRect(doc, PW - 90, 0, 90, 185, 0, INDIGO_D);
    rRect(doc, 0, 155, PW, 30, 0, '#3730a3');

    // Title
    fill(doc, WHITE);
    doc.font('Helvetica-Bold').fontSize(22).text('INVENTORY RECONCILIATION REPORT', M, 32, { width: CW - 60, lineGap: 2 });

    // Ref line
    fill(doc, SLATE3);
    doc.font('Helvetica').fontSize(9).text(`Reference: ${safeText(log.id)}`, M, 62);

    // Staff badge row
    fill(doc, WHITE);
    doc.font('Helvetica-Bold').fontSize(11).text(`Staff: ${staffName}`, M, 82);
    if (staffEmail && staffEmail !== staffName) {
      fill(doc, SLATE3);
      doc.font('Helvetica').fontSize(9).text(staffEmail, M, 97);
    }
    if (staffRole) {
      rRect(doc, M, 112, doc.widthOfString(staffRole) + 16, 18, 6, '#4f46e5');
      fill(doc, WHITE);
      doc.font('Helvetica').fontSize(8).text(staffRole, M + 8, 116);
    }

    // Meta chips
    const chips = [
      { label: 'Date',     value: fmtDate(details.submittedAt || log.timestamp?.toISOString?.()) },
      { label: 'Location', value: locStr },
      { label: 'Duration', value: fmtDur(details.sessionDurationMs) },
    ];
    let cx = M;
    chips.forEach(chip => {
      const vw = Math.max(doc.widthOfString(safeText(chip.value)) + 20, 120);
      rRect(doc, cx, 136, vw, 40, 8, '#4f46e5');
      fill(doc, SLATE3);
      doc.font('Helvetica').fontSize(7.5).text(chip.label.toUpperCase(), cx + 8, 140, { width: vw - 16 });
      fill(doc, WHITE);
      doc.font('Helvetica-Bold').fontSize(10).text(safeText(chip.value), cx + 8, 151, { width: vw - 16 });
      cx += vw + 6;
    });

    // ── KPI tiles ────────────────────────────────────────────────────────────
    const kpiY = 197;
    const kpis = [
      { label: 'Scanned',       value: totalScanned,   fgHex: INDIGO,   bgHex: INDIGO_LT },
      { label: 'In System',     value: totalInSystem,  fgHex: SLATE7,   bgHex: SLATE1    },
      { label: 'Missing',       value: missingCount,   fgHex: missingCount>0?RED:GREEN,   bgHex: missingCount>0?RED_LT:GREEN_LT   },
      { label: 'Wrong Loc.',    value: wrongCount,     fgHex: wrongCount>0?AMBER:GREEN,   bgHex: wrongCount>0?AMBER_LT:GREEN_LT   },
      { label: 'Extra',         value: extraCount,     fgHex: BLUE,     bgHex: BLUE_LT   },
      { label: `Coverage`,      value: `${coveragePct}%`, fgHex: coveragePct>=90?GREEN:coveragePct>=70?AMBER:RED, bgHex: coveragePct>=90?GREEN_LT:coveragePct>=70?AMBER_LT:RED_LT },
    ];
    const kW = Math.floor((CW - 5) / 6);
    kpis.forEach((k, i) => {
      const kx = M + i * (kW + 1);
      rRect(doc, kx, kpiY, kW, 64, 8, k.bgHex, SLATE3);
      fill(doc, k.fgHex);
      doc.font('Helvetica-Bold').fontSize(20).text(safeText(String(k.value)), kx + 4, kpiY + 10, { width: kW - 8, align: 'center' });
      fill(doc, SLATE5);
      doc.font('Helvetica').fontSize(8).text(k.label, kx + 4, kpiY + 38, { width: kW - 8, align: 'center' });
    });

    // ── Coverage bar ─────────────────────────────────────────────────────────
    const barY = kpiY + 78;
    fill(doc, SLATE9);
    doc.font('Helvetica-Bold').fontSize(9).text('Scan Coverage', M, barY);
    const pcColor = coveragePct >= 90 ? GREEN : coveragePct >= 70 ? AMBER : RED;
    fill(doc, pcColor);
    doc.font('Helvetica-Bold').fontSize(9).text(`${coveragePct}%`, PW - M - 30, barY, { width: 30, align: 'right' });
    rRect(doc, M, barY + 14, CW, 8, 4, SLATE3);
    if (coveragePct > 0) {
      rRect(doc, M, barY + 14, (CW * Math.min(coveragePct, 100)) / 100, 8, 4, pcColor);
    }

    // Reason / Note
    let infoY = barY + 36;
    if (details.reasonCode || details.note) {
      const noteText = details.note ? safeText(details.note) : '';
      const noteH = noteText ? doc.heightOfString(`"${noteText}"`, { width: CW - 24 }) + 4 : 0;
      const boxH = 30 + noteH;
      rRect(doc, M, infoY, CW, boxH, 8, AMBER_LT, AMBER);
      fill(doc, AMBER);
      doc.font('Helvetica-Bold').fontSize(8.5);
      if (details.reasonCode) doc.text(`Reason: ${safeText(details.reasonCode)}`, M + 10, infoY + 8);
      if (noteText) {
        fill(doc, SLATE7);
        doc.font('Helvetica').fontSize(9).text(`"${noteText}"`, M + 10, infoY + (details.reasonCode ? 22 : 8), { width: CW - 20 });
      }
      infoY += boxH + 10;
    }

    // ── Asset table helper ────────────────────────────────────────────────────
    function drawTable(items: any[], title: string, tColor: string, tBg: string, startY: number) {
      let y = startY;

      if (y > PH - 100) {
        doc.addPage({ margin: 0, size: 'A4' });
        addContinuationHeader(doc, PW, M, log.id);
        y = 42;
      }

      // Section header
      rRect(doc, M, y, CW, 24, 6, tBg);
      fill(doc, tColor);
      doc.font('Helvetica-Bold').fontSize(10).text(title, M + 10, y + 7);
      fill(doc, tColor);
      doc.font('Helvetica').fontSize(8.5).text(`${items.length} item${items.length !== 1 ? 's' : ''}`, PW - M - 55, y + 8, { width: 50, align: 'right' });
      y += 30;

      if (items.length === 0) {
        fill(doc, SLATE5);
        doc.font('Helvetica').fontSize(9).text('No items in this category.', M + 10, y);
        return y + 20;
      }

      // Header row
      rRect(doc, M, y, CW, 17, 0, SLATE1);
      fill(doc, SLATE5);
      doc.font('Helvetica-Bold').fontSize(7.5);
      const cols = [
        { l:'#',           x:M+4,   w:18 },
        { l:'Asset Name',  x:M+24,  w:195 },
        { l:'Barcode',     x:M+221, w:115 },
        { l:'Floor',       x:M+338, w:44  },
        { l:'Room',        x:M+384, w:54  },
        { l:'Source',      x:M+440, w:60  },
      ];
      cols.forEach(c => doc.text(c.l, c.x, y + 5, { width: c.w }));
      drawLine(doc, M, y, M+CW, y, SLATE3);
      drawLine(doc, M, y+17, M+CW, y+17, SLATE3);
      y += 17;

      items.slice(0, 60).forEach((item: any, i: number) => {
        if (y > PH - 50) {
          doc.addPage({ margin: 0, size: 'A4' });
          addContinuationHeader(doc, PW, M, log.id);
          y = 42;
          // Re-draw table header
          rRect(doc, M, y, CW, 17, 0, SLATE1);
          fill(doc, SLATE5); doc.font('Helvetica-Bold').fontSize(7.5);
          cols.forEach(c => doc.text(c.l, c.x, y + 5, { width: c.w }));
          drawLine(doc, M, y+17, M+CW, y+17, SLATE3);
          y += 17;
        }
        rRect(doc, M, y, CW, 17, 0, i%2===0?WHITE:SLATE1);
        fill(doc, SLATE7);
        doc.font('Helvetica').fontSize(8);
        doc.text(String(i+1), cols[0].x, y+5, {width:cols[0].w});
        doc.text(truncStr(doc, safeText(item.name)||'—', cols[1].w), cols[1].x, y+5, {width:cols[1].w});
        doc.text(truncStr(doc, safeText(item.barcode)||'—', cols[2].w), cols[2].x, y+5, {width:cols[2].w, characterSpacing:0.2});
        doc.text(safeText(item.floorNumber)||'—', cols[3].x, y+5, {width:cols[3].w});
        doc.text(safeText(item.roomNumber)||'—',  cols[4].x, y+5, {width:cols[4].w});
        doc.text(safeText(item.source)||'—',      cols[5].x, y+5, {width:cols[5].w});
        drawLine(doc, M, y+17, M+CW, y+17, SLATE3, 0.3);
        y += 17;
      });

      if (items.length > 60) {
        fill(doc, SLATE5);
        doc.font('Helvetica').fontSize(8).text(`... and ${items.length - 60} more items`, M+10, y+4);
        y += 18;
      }
      return y + 12;
    }

    let curY = infoY + 8;

    curY = drawTable(missingItems, 'MISSING ASSETS',             RED,   RED_LT,   curY);
    curY = drawTable(correctItems, 'ASSETS CONFIRMED PRESENT',   GREEN, GREEN_LT, curY);
    if (wrongItems.length  > 0) curY = drawTable(wrongItems,  'WRONG LOCATION ASSETS',     AMBER, AMBER_LT, curY);
    if (extraItems.length  > 0) curY = drawTable(extraItems,  'EXTRA / UNREGISTERED',      BLUE,  BLUE_LT,  curY);

    // ── Footer on every page ─────────────────────────────────────────────────
    const pgCount = (doc as any).bufferedPageRange().count;
    for (let i = 0; i < pgCount; i++) {
      doc.switchToPage(i);
      rRect(doc, 0, PH - 26, PW, 26, 0, SLATE9);
      fill(doc, SLATE5);
      doc.font('Helvetica').fontSize(7.5).text(`Generated: ${new Date().toLocaleString()}`, M, PH - 16);
      fill(doc, SLATE3);
      doc.font('Helvetica').fontSize(7.5).text(`Page ${i+1} of ${pgCount}`, PW - M - 55, PH - 16, { width: 55, align: 'right' });
      fill(doc, SLATE5);
      doc.font('Helvetica').fontSize(7).text('CONFIDENTIAL - Inventory Audit Center', 0, PH - 16, { width: PW, align: 'center' });
    }

    doc.end();
    await new Promise<void>(resolve => doc.on('end', resolve));

    const buf = Buffer.concat(chunks);
    const safeName = staffName.replace(/[^a-z0-9]/gi,'_').toLowerCase();
    const dateStr  = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inventory_report_${safeName}_${dateStr}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    return res.status(200).send(buf);

  } catch (err: any) {
    console.error('[report-pdf] generation error:', err?.message ?? err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'PDF generation failed', detail: err?.message ?? String(err) });
    }
  }
}
