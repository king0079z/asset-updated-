// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';
import PDFDocument from 'pdfkit';

/* ── Palette ── */
const INDIGO    = '#4338ca';
const INDIGO_LT = '#eef2ff';
const PURPLE    = '#7c3aed';
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
function hex(h: string): RGB {
  const c = h.replace('#', '');
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}
function fill(doc: any, h: string) { doc.fillColor(hex(h)); }
function stroke(doc: any, h: string) { doc.strokeColor(hex(h)); }
function fillStroke(doc: any, fh: string, sh: string) { doc.fillColor(hex(fh)).strokeColor(hex(sh)); }

function rRect(doc: any, x: number, y: number, w: number, h: number, r: number, fh: string, sh?: string) {
  fill(doc, fh);
  if (sh) stroke(doc, sh);
  doc.roundedRect(x, y, w, h, r);
  if (sh) doc.fillAndStroke(); else doc.fill();
}

function drawLine(doc: any, x1: number, y1: number, x2: number, y2: number, color: string, width = 0.5) {
  stroke(doc, color);
  doc.lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke();
}

function truncate(doc: any, text: string, maxWidth: number) {
  if (!text) return '';
  let t = String(text);
  while (doc.widthOfString(t) > maxWidth && t.length > 3) t = t.slice(0, -4) + '…';
  return t;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authResult = await requireAuth(req, res);
  if (!authResult) return;
  const { user } = authResult;

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing report id' });

  // Fetch the audit log
  const log = await prisma.auditLog.findUnique({ where: { id } });
  if (!log || log.action !== 'INVENTORY_REVIEW_SUBMITTED') {
    return res.status(404).json({ error: 'Report not found' });
  }

  const details = (log.details as any) || {};

  // Fetch submitter
  let submitter: any = null;
  if (log.userId) {
    submitter = await prisma.user.findUnique({
      where: { id: log.userId },
      select: { name: true, email: true, role: true },
    });
  }
  const staffName = submitter?.name || details.submittedByName || 'Unknown Staff';
  const staffEmail = submitter?.email || details.submittedByEmail || '';
  const staffRole = submitter?.role || '';

  const missingItems: any[] = details.missingItems || [];
  const wrongLocationItems: any[] = details.wrongLocationItems || [];
  const correctItems: any[] = details.correctInRoomItems || [];
  const extraItems: any[] = details.extraItems || [];

  const totalScanned = details.totalScanned || 0;
  const totalInSystem = details.totalInSystem || 0;
  const missingCount = details.missingCount || 0;
  const extraCount = details.extraCount || 0;
  const wrongLocationCount = details.wrongLocationCount || 0;
  const coveragePct = totalInSystem > 0 ? Math.round((totalScanned / totalInSystem) * 100) : 0;
  const location = [
    details.floorNumber && `Floor ${details.floorNumber}`,
    details.roomNumber && `Room ${details.roomNumber}`,
  ].filter(Boolean).join(', ') || 'All locations';

  const reportDate = fmtDate(details.submittedAt || log.timestamp?.toISOString());
  const duration = fmtDuration(details.sessionDurationMs);

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 36;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // ── PAGE 1: Cover / Summary ──────────────────────────────────────────────
  // Hero gradient band
  rRect(doc, 0, 0, PAGE_W, 200, 0, INDIGO);
  // Decorative circle
  fill(doc, PURPLE);
  doc.opacity(0.25).circle(PAGE_W - 40, 30, 120).fill().opacity(1);
  fill(doc, INDIGO);
  doc.opacity(0.15).circle(60, 180, 80).fill().opacity(1);

  // Title
  fill(doc, WHITE);
  doc.font('Helvetica-Bold').fontSize(26).text('INVENTORY RECONCILIATION REPORT', MARGIN, 44, { width: CONTENT_W - 40 });
  doc.font('Helvetica').fontSize(11).fillColor(hex('#c7d2fe'))
    .text(`Audit Reference: ${log.id}`, MARGIN, 80, { width: CONTENT_W });

  // Date / location chips
  const chipY = 105;
  const chips = [
    { label: 'Date', value: reportDate },
    { label: 'Location', value: location },
    { label: 'Duration', value: duration },
  ];
  let chipX = MARGIN;
  chips.forEach(c => {
    const w = 150;
    rRect(doc, chipX, chipY, w, 44, 8, '#ffffff20');
    fill(doc, '#c7d2fe');
    doc.font('Helvetica').fontSize(8).text(c.label.toUpperCase(), chipX + 10, chipY + 8);
    fill(doc, WHITE);
    doc.font('Helvetica-Bold').fontSize(11).text(c.value, chipX + 10, chipY + 20, { width: w - 20 });
    chipX += w + 8;
  });

  // Staff badge
  rRect(doc, MARGIN, 162, 260, 28, 6, '#ffffff20');
  fill(doc, WHITE);
  doc.font('Helvetica-Bold').fontSize(10).text(`👤  ${staffName}`, MARGIN + 10, 170);
  if (staffEmail) {
    doc.font('Helvetica').fontSize(9).fillColor(hex('#c7d2fe')).text(staffEmail, MARGIN + 10 + doc.widthOfString(`👤  ${staffName}`) + 8, 171);
  }

  // ── KPI Row ──────────────────────────────────────────────────────────────
  const kpiY = 215;
  const kpis = [
    { label: 'Scanned', value: totalScanned, color: INDIGO, bg: INDIGO_LT },
    { label: 'In System', value: totalInSystem, color: SLATE7, bg: SLATE1 },
    { label: 'Missing', value: missingCount, color: missingCount > 0 ? RED : GREEN, bg: missingCount > 0 ? RED_LT : GREEN_LT },
    { label: 'Wrong Loc.', value: wrongLocationCount, color: wrongLocationCount > 0 ? AMBER : GREEN, bg: wrongLocationCount > 0 ? AMBER_LT : GREEN_LT },
    { label: 'Extra', value: extraCount, color: BLUE, bg: BLUE_LT },
    { label: 'Coverage', value: `${coveragePct}%`, color: coveragePct >= 90 ? GREEN : coveragePct >= 70 ? AMBER : RED, bg: coveragePct >= 90 ? GREEN_LT : coveragePct >= 70 ? AMBER_LT : RED_LT },
  ];
  const kpiW = (CONTENT_W - 10) / 6;
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (kpiW + 2);
    rRect(doc, x, kpiY, kpiW, 68, 8, k.bg, SLATE3);
    fill(doc, k.color);
    doc.font('Helvetica-Bold').fontSize(22).text(String(k.value), x + 4, kpiY + 12, { width: kpiW - 8, align: 'center' });
    fill(doc, SLATE5);
    doc.font('Helvetica').fontSize(8).text(k.label, x + 4, kpiY + 42, { width: kpiW - 8, align: 'center' });
  });

  // ── Coverage bar ──────────────────────────────────────────────────────────
  const barY = kpiY + 82;
  fill(doc, SLATE9);
  doc.font('Helvetica-Bold').fontSize(10).text('Scan Coverage', MARGIN, barY);
  const pctColor = coveragePct >= 90 ? GREEN : coveragePct >= 70 ? AMBER : RED;
  fill(doc, pctColor);
  doc.font('Helvetica-Bold').fontSize(10).text(`${coveragePct}%`, PAGE_W - MARGIN - 30, barY);
  rRect(doc, MARGIN, barY + 16, CONTENT_W, 10, 5, SLATE3);
  if (coveragePct > 0) {
    rRect(doc, MARGIN, barY + 16, (CONTENT_W * Math.min(100, coveragePct)) / 100, 10, 5, pctColor);
  }

  // Reason + Note
  let infoY = barY + 42;
  if (details.reasonCode || details.note) {
    rRect(doc, MARGIN, infoY, CONTENT_W, details.note ? 60 : 30, 8, AMBER_LT, AMBER);
    fill(doc, AMBER);
    doc.font('Helvetica-Bold').fontSize(9);
    if (details.reasonCode) doc.text(`Reason Code: ${details.reasonCode}`, MARGIN + 10, infoY + 8);
    if (details.note) {
      fill(doc, SLATE7);
      doc.font('Helvetica').fontSize(9).text(`"${details.note}"`, MARGIN + 10, infoY + (details.reasonCode ? 22 : 8), { width: CONTENT_W - 20 });
    }
    infoY += details.note ? 74 : 44;
  }

  // ── Asset table helper ────────────────────────────────────────────────────
  function drawAssetTable(
    items: any[],
    title: string,
    titleColor: string,
    titleBg: string,
    startY: number,
    maxRows = 20,
  ) {
    let y = startY;

    // Section header
    rRect(doc, MARGIN, y, CONTENT_W, 26, 6, titleBg);
    fill(doc, titleColor);
    doc.font('Helvetica-Bold').fontSize(11).text(title, MARGIN + 10, y + 7);
    fill(doc, titleColor);
    doc.font('Helvetica').fontSize(9).text(`(${items.length} item${items.length !== 1 ? 's' : ''})`, PAGE_W - MARGIN - 60, y + 8);
    y += 32;

    if (items.length === 0) {
      fill(doc, SLATE5);
      doc.font('Helvetica').fontSize(9).text('No items in this category.', MARGIN + 10, y);
      return y + 20;
    }

    // Table header
    rRect(doc, MARGIN, y, CONTENT_W, 18, 0, SLATE1);
    drawLine(doc, MARGIN, y, MARGIN + CONTENT_W, y, SLATE3);
    const cols = [
      { label: '#', x: MARGIN + 4, w: 20 },
      { label: 'Asset Name', x: MARGIN + 26, w: 200 },
      { label: 'Barcode', x: MARGIN + 228, w: 120 },
      { label: 'Floor', x: MARGIN + 350, w: 50 },
      { label: 'Room', x: MARGIN + 402, w: 60 },
      { label: 'Source', x: MARGIN + 464, w: 60 },
    ];
    fill(doc, SLATE5);
    doc.font('Helvetica-Bold').fontSize(8);
    cols.forEach(c => doc.text(c.label, c.x, y + 5, { width: c.w }));
    y += 18;

    const visible = items.slice(0, maxRows);
    visible.forEach((item: any, i: number) => {
      const rowBg = i % 2 === 0 ? WHITE : SLATE1;
      rRect(doc, MARGIN, y, CONTENT_W, 18, 0, rowBg);
      fill(doc, SLATE7);
      doc.font('Helvetica').fontSize(8);
      doc.text(String(i + 1), cols[0].x, y + 5, { width: cols[0].w });
      doc.text(truncate(doc, item.name || '—', cols[1].w), cols[1].x, y + 5, { width: cols[1].w });
      doc.text(truncate(doc, item.barcode || '—', cols[2].w), cols[2].x, y + 5, { width: cols[2].w, characterSpacing: 0.3 });
      doc.text(item.floorNumber || '—', cols[3].x, y + 5, { width: cols[3].w });
      doc.text(item.roomNumber || '—', cols[4].x, y + 5, { width: cols[4].w });
      doc.text(item.source || '—', cols[5].x, y + 5, { width: cols[5].w });
      drawLine(doc, MARGIN, y + 18, MARGIN + CONTENT_W, y + 18, SLATE3, 0.3);
      y += 18;

      // Page break
      if (y > PAGE_H - 60) {
        doc.addPage({ margin: 0, size: 'A4' });
        // Mini header on continuation pages
        rRect(doc, 0, 0, PAGE_W, 28, 0, INDIGO);
        fill(doc, WHITE);
        doc.font('Helvetica-Bold').fontSize(9).text('INVENTORY RECONCILIATION REPORT  (continued)', MARGIN, 9);
        fill(doc, '#c7d2fe');
        doc.font('Helvetica').fontSize(8).text(log.id, PAGE_W - MARGIN - 160, 10, { width: 160, align: 'right' });
        y = 44;
      }
    });

    if (items.length > maxRows) {
      fill(doc, SLATE5);
      doc.font('Helvetica').fontSize(8).text(`… and ${items.length - maxRows} more items (truncated for readability)`, MARGIN + 10, y + 4);
      y += 18;
    }

    return y + 10;
  }

  // ── Draw tables ───────────────────────────────────────────────────────────
  let currentY = infoY + 10;

  // Check if we need to start on a new page
  if (currentY > PAGE_H - 120) {
    doc.addPage({ margin: 0, size: 'A4' });
    rRect(doc, 0, 0, PAGE_W, 28, 0, INDIGO);
    fill(doc, WHITE);
    doc.font('Helvetica-Bold').fontSize(9).text('INVENTORY RECONCILIATION REPORT  (continued)', MARGIN, 9);
    currentY = 44;
  }

  currentY = drawAssetTable(missingItems, '⚠  Missing Assets', RED, RED_LT, currentY);
  if (currentY > PAGE_H - 100) {
    doc.addPage({ margin: 0, size: 'A4' });
    rRect(doc, 0, 0, PAGE_W, 28, 0, INDIGO);
    fill(doc, WHITE);
    doc.font('Helvetica-Bold').fontSize(9).text('INVENTORY RECONCILIATION REPORT  (continued)', MARGIN, 9);
    currentY = 44;
  }
  currentY = drawAssetTable(correctItems, '✓  Assets Confirmed Present', GREEN, GREEN_LT, currentY);

  if (wrongLocationItems.length > 0) {
    if (currentY > PAGE_H - 100) {
      doc.addPage({ margin: 0, size: 'A4' });
      rRect(doc, 0, 0, PAGE_W, 28, 0, INDIGO);
      fill(doc, WHITE);
      doc.font('Helvetica-Bold').fontSize(9).text('INVENTORY RECONCILIATION REPORT  (continued)', MARGIN, 9);
      currentY = 44;
    }
    currentY = drawAssetTable(wrongLocationItems, '⤳  Assets in Wrong Location', AMBER, AMBER_LT, currentY);
  }

  if (extraItems.length > 0) {
    if (currentY > PAGE_H - 100) {
      doc.addPage({ margin: 0, size: 'A4' });
      rRect(doc, 0, 0, PAGE_W, 28, 0, INDIGO);
      fill(doc, WHITE);
      doc.font('Helvetica-Bold').fontSize(9).text('INVENTORY RECONCILIATION REPORT  (continued)', MARGIN, 9);
      currentY = 44;
    }
    currentY = drawAssetTable(extraItems, 'ℹ  Extra / Unregistered Assets', BLUE, BLUE_LT, currentY);
  }

  // ── Footer on each page ───────────────────────────────────────────────────
  const pageCount = (doc as any).bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    rRect(doc, 0, PAGE_H - 28, PAGE_W, 28, 0, SLATE9);
    fill(doc, SLATE5);
    doc.font('Helvetica').fontSize(8)
      .text(`Generated: ${new Date().toLocaleString()}`, MARGIN, PAGE_H - 18);
    fill(doc, SLATE3);
    doc.font('Helvetica').fontSize(8)
      .text(`Page ${i + 1} of ${pageCount}`, PAGE_W - MARGIN - 60, PAGE_H - 18, { width: 60, align: 'right' });
    fill(doc, SLATE5);
    doc.font('Helvetica').fontSize(7)
      .text(`CONFIDENTIAL — Inventory Audit Center`, 0, PAGE_H - 18, { width: PAGE_W, align: 'center' });
  }

  doc.end();

  await new Promise<void>((resolve) => doc.on('end', resolve));

  const pdfBuffer = Buffer.concat(chunks);
  const safeName = (staffName || 'report').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="inventory_report_${safeName}_${dateStr}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.status(200).send(pdfBuffer);
}
