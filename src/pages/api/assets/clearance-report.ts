// @ts-nocheck
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import PDFDocument from "pdfkit";

/* ── Colours ── */
const RED      = "#b91c1c";
const RED_DARK = "#7f1d1d";
const GREEN    = "#15803d";
const BLUE     = "#1d4ed8";
const SLATE9   = "#0f172a";
const SLATE7   = "#334155";
const SLATE5   = "#64748b";
const SLATE4   = "#94a3b8";
const SLATE2   = "#e2e8f0";
const SLATE1   = "#f1f5f9";
const WHITE    = "#ffffff";
const AMBER8   = "#92400e";
const AMBER1   = "#fef9c3";
const INDIGO   = "#4338ca";

const ACTION_LABELS: Record<string, string> = {
  RETURN_TO_STOCK: "Returned to Stock",
  REASSIGN:        "Reassigned",
  DISPOSE:         "Disposed",
};
const ACTION_COLORS: Record<string, string> = {
  RETURN_TO_STOCK: GREEN,
  REASSIGN:        BLUE,
  DISPOSE:         RED,
};
const REASON_LABELS: Record<string, string> = {
  TERMINATED:  "Terminated",
  RESIGNED:    "Resigned",
  TRANSFERRED: "Transferred",
  SUSPENDED:   "Suspended",
  OTHER:       "Other",
};

/* ── helpers ── */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
function fillColor(doc: any, hex: string) { doc.fillColor(hexToRgb(hex)); }
function strokeColor(doc: any, hex: string) { doc.strokeColor(hexToRgb(hex)); }

/** Draw a filled rounded rectangle */
function roundRect(doc: any, x: number, y: number, w: number, h: number, r: number, fillHex: string, strokeHex?: string) {
  fillColor(doc, fillHex);
  if (strokeHex) strokeColor(doc, strokeHex);
  doc.roundedRect(x, y, w, h, r);
  if (strokeHex) {
    doc.fillAndStroke();
  } else {
    doc.fill();
  }
}

/** Draw a filled rectangle */
function rect(doc: any, x: number, y: number, w: number, h: number, fillHex: string) {
  fillColor(doc, fillHex);
  doc.rect(x, y, w, h).fill();
}

/** Truncate text to fit within maxWidth */
function truncate(doc: any, text: string, maxWidth: number): string {
  if (!text) return "";
  while (doc.widthOfString(text) > maxWidth && text.length > 3) {
    text = text.slice(0, -4) + "...";
  }
  return text;
}

/* ── PDF builder ── */
async function buildPdf(params: {
  userName: string; userEmail: string; reason: string;
  notes?: string | null; clearanceDateLabel: string;
  actions: any[]; processedBy: string; generatedAt: string; refCode: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { userName, userEmail, reason, notes, clearanceDateLabel, actions, processedBy, generatedAt, refCode } = params;

    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Clearance Certificate - ${userName}`, Author: processedBy } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;   // 595
    const M  = 36;               // side margin

    /* ────────── HEADER ────────── */
    // Red gradient background (simulate with a solid + slightly lighter band)
    rect(doc, 0, 0, PW, 110, RED);
    doc.opacity(0.25).rect(0, 0, PW, 110).fill(hexToRgb(WHITE) as any);
    doc.opacity(1);
    rect(doc, 0, 0, PW, 110, RED); // redraw solid

    // Left side: title
    fillColor(doc, WHITE);
    doc.font("Helvetica-Bold").fontSize(20).text("Asset Clearance Certificate", M, 28, { lineBreak: false });
    doc.font("Helvetica").fontSize(9).opacity(0.75).text("OFFICIAL RECORD - ASSET MANAGEMENT SYSTEM", M, 54, { lineBreak: false });
    doc.opacity(1);

    // Right side: badge
    const badgeText = REASON_LABELS[reason] ?? reason;
    const badgeW = doc.font("Helvetica-Bold").fontSize(10).widthOfString(badgeText) + 22;
    const badgeX = PW - M - badgeW;
    fillColor(doc, WHITE);
    doc.opacity(0.2);
    doc.roundedRect(badgeX, 26, badgeW, 22, 11).fill();
    doc.opacity(1);
    fillColor(doc, WHITE);
    doc.font("Helvetica-Bold").fontSize(10).text(badgeText, badgeX + 11, 32, { lineBreak: false });

    // Ref
    doc.opacity(0.5);
    fillColor(doc, WHITE);
    doc.font("Helvetica").fontSize(8).text(`REF: ${refCode}`, badgeX, 56, { width: badgeW, align: "right" });
    doc.opacity(1);

    // Accent bar
    rect(doc, 0, 110, PW, 4, RED_DARK);

    /* ────────── META ROW ────────── */
    rect(doc, 0, 114, PW, 60, SLATE1);
    // Divider line at bottom
    rect(doc, 0, 173, PW, 1, SLATE2);

    const metaCols = [
      { label: "CLEARED EMPLOYEE", val: userName,         sub: userEmail          },
      { label: "CLEARANCE DATE",   val: clearanceDateLabel, sub: "Effective immediately" },
      { label: "PROCESSED BY",     val: processedBy,      sub: `Generated ${generatedAt}` },
    ];
    const colW = (PW - M * 2) / 3;
    metaCols.forEach((col, i) => {
      const x = M + i * colW;
      fillColor(doc, SLATE4);
      doc.font("Helvetica-Bold").fontSize(7.5).text(col.label, x, 124, { lineBreak: false });
      fillColor(doc, SLATE9);
      doc.font("Helvetica-Bold").fontSize(12).text(truncate(doc, col.val, colW - 8), x, 136, { lineBreak: false });
      fillColor(doc, SLATE5);
      doc.font("Helvetica").fontSize(9).text(truncate(doc, col.sub, colW - 8), x, 152, { lineBreak: false });
    });

    /* ────────── STAT BOXES ────────── */
    const returned   = actions.filter((a: any) => a.action === "RETURN_TO_STOCK").length;
    const reassigned = actions.filter((a: any) => a.action === "REASSIGN").length;
    const disposed   = actions.filter((a: any) => a.action === "DISPOSE").length;

    const stats = [
      { num: actions.length, lbl: "TOTAL ASSETS",  numC: SLATE7, bg: "#f8fafc", border: SLATE2 },
      { num: returned,       lbl: "RETURNED",       numC: GREEN,  bg: "#f0fdf4", border: "#86efac" },
      { num: reassigned,     lbl: "REASSIGNED",     numC: BLUE,   bg: "#eff6ff", border: "#93c5fd" },
      { num: disposed,       lbl: "DISPOSED",       numC: RED,    bg: "#fef2f2", border: "#fca5a5" },
    ];

    const statsY = 182;
    const statW  = (PW - M * 2 - 9 * 3) / 4;
    stats.forEach((s, i) => {
      const x = M + i * (statW + 9);
      roundRect(doc, x, statsY, statW, 60, 8, s.bg, s.border);
      fillColor(doc, s.numC);
      doc.font("Helvetica-Bold").fontSize(28).text(String(s.num), x, statsY + 8, { width: statW, align: "center" });
      doc.font("Helvetica-Bold").fontSize(8).text(s.lbl, x, statsY + 42, { width: statW, align: "center" });
    });

    // Bottom border of stats
    rect(doc, 0, statsY + 68, PW, 1, SLATE2);

    /* ────────── TABLE ────────── */
    const tableY = statsY + 78;

    // Section title
    fillColor(doc, SLATE4);
    doc.font("Helvetica-Bold").fontSize(8).text("ASSET DISPOSITION SUMMARY", M, tableY, { lineBreak: false });
    rect(doc, M, tableY + 12, PW - M * 2, 1, SLATE2);

    // Column widths
    const numW  = 24;
    const actW  = 110;
    const reW   = 140;
    const assetW = PW - M * 2 - numW - actW - reW;

    // Table header
    const thY = tableY + 18;
    rect(doc, M, thY, PW - M * 2, 20, SLATE1);
    fillColor(doc, SLATE4);
    doc.font("Helvetica-Bold").fontSize(7.5);
    doc.text("#",             M + 4,                 thY + 6, { lineBreak: false });
    doc.text("ASSET",         M + numW + 4,           thY + 6, { lineBreak: false });
    doc.text("ACTION TAKEN",  M + numW + assetW + 4,  thY + 6, { lineBreak: false });
    doc.text("REASSIGNED TO", M + numW + assetW + actW + 4, thY + 6, { lineBreak: false });

    // Rows
    let rowY = thY + 22;
    actions.forEach((a: any, i: number) => {
      const rowH = 28;
      if (i % 2 === 1) rect(doc, M, rowY, PW - M * 2, rowH, SLATE1);

      const assetName = truncate(doc, a.assetName ?? a.assetId, assetW - 8);
      const assetType = a.assetType ? truncate(doc, a.assetType, assetW - 8) : null;

      // Row number
      fillColor(doc, "#cbd5e1");
      doc.font("Helvetica-Bold").fontSize(9).text(String(i + 1), M + 4, rowY + (assetType ? 6 : 10), { lineBreak: false });

      // Asset name + type
      fillColor(doc, SLATE9);
      doc.font("Helvetica-Bold").fontSize(10).text(assetName, M + numW + 4, rowY + 5, { lineBreak: false });
      if (assetType) {
        fillColor(doc, SLATE4);
        doc.font("Helvetica").fontSize(8).text(assetType, M + numW + 4, rowY + 17, { lineBreak: false });
      }

      // Action pill
      const pillColor = ACTION_COLORS[a.action] ?? SLATE5;
      const pillLabel = ACTION_LABELS[a.action] ?? a.action;
      const pillTxtW  = doc.font("Helvetica-Bold").fontSize(8.5).widthOfString(pillLabel);
      const pillW     = pillTxtW + 16;
      const pillX     = M + numW + assetW + 4;
      const pillY     = rowY + (assetType ? 4 : 8);
      fillColor(doc, pillColor);
      doc.opacity(0.12).roundedRect(pillX, pillY, pillW, 16, 8).fill();
      doc.opacity(1);
      fillColor(doc, pillColor);
      doc.font("Helvetica-Bold").fontSize(8.5).text(pillLabel, pillX + 8, pillY + 3, { lineBreak: false });

      // Reassigned to
      const reX = M + numW + assetW + actW + 4;
      if (a.newUserName) {
        fillColor(doc, SLATE9);
        doc.font("Helvetica-Bold").fontSize(10).text(truncate(doc, a.newUserName, reW - 8), reX, rowY + 5, { lineBreak: false });
        if (a.newUserEmail) {
          fillColor(doc, SLATE5);
          doc.font("Helvetica").fontSize(8).text(truncate(doc, a.newUserEmail, reW - 8), reX, rowY + 17, { lineBreak: false });
        }
      } else {
        fillColor(doc, "#cbd5e1");
        doc.font("Helvetica").fontSize(11).text("-", reX, rowY + 8, { lineBreak: false });
      }

      // Row bottom border
      rect(doc, M, rowY + rowH - 1, PW - M * 2, 1, "#f1f5f9");
      rowY += rowH;
    });

    /* ────────── NOTES ────────── */
    if (notes) {
      rowY += 10;
      fillColor(doc, SLATE4);
      doc.font("Helvetica-Bold").fontSize(8).text("CLEARANCE NOTES", M, rowY, { lineBreak: false });
      rect(doc, M, rowY + 12, PW - M * 2, 1, SLATE2);
      rowY += 18;

      const notesH = 40;
      fillColor(doc, AMBER1);
      doc.roundedRect(M, rowY, PW - M * 2, notesH, 6).fill();
      fillColor(doc, "#fde68a");
      doc.roundedRect(M, rowY, PW - M * 2, notesH, 6).stroke();
      fillColor(doc, AMBER8);
      doc.font("Helvetica").fontSize(10).text(notes, M + 12, rowY + 10, { width: PW - M * 2 - 24, lineBreak: false });

      rowY += notesH;
    }

    /* ────────── FOOTER ────────── */
    const footerY = Math.max(rowY + 20, 690);
    rect(doc, 0, footerY, PW, 1, SLATE2);
    rect(doc, 0, footerY + 1, PW, 72, SLATE1);

    // Officer avatar
    fillColor(doc, INDIGO);
    doc.circle(M + 19, footerY + 24, 19).fill();
    fillColor(doc, WHITE);
    const initials = (processedBy || "?").slice(0, 2).toUpperCase();
    doc.font("Helvetica-Bold").fontSize(12).text(initials, M + 7, footerY + 16, { lineBreak: false });

    // Officer info
    fillColor(doc, SLATE4);
    doc.font("Helvetica-Bold").fontSize(7.5).text("CLEARANCE OFFICER", M + 46, footerY + 10, { lineBreak: false });
    fillColor(doc, SLATE9);
    doc.font("Helvetica-Bold").fontSize(11).text(processedBy, M + 46, footerY + 22, { lineBreak: false });

    // Signature lines
    const sigW = 140;
    [
      { label: "Department Manager Signature", x: PW / 2 - sigW / 2 - 40 },
      { label: "HR Director Signature",        x: PW - M - sigW            },
    ].forEach(sig => {
      rect(doc, sig.x, footerY + 50, sigW, 1, "#cbd5e1");
      fillColor(doc, SLATE4);
      doc.font("Helvetica").fontSize(7.5).text(sig.label, sig.x, footerY + 56, { width: sigW, align: "center" });
    });

    /* ────────── WATERMARK ────────── */
    fillColor(doc, "#d1d5db");
    doc.font("Helvetica").fontSize(7.5).text(
      `Asset Management System  |  Clearance Certificate  |  ${generatedAt}`,
      M, footerY + 72, { width: PW - M * 2, align: "center" }
    );

    doc.end();
  });
}

/* ── API Handler ──────────────────────────────────────────────────────── */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const sessionUser = session?.user ?? null;
    if (authError || !sessionUser) return res.status(401).json({ error: "Unauthorized" });

    const { userId, userName, userEmail, reason, notes, clearanceDate, actions } = req.body;

    if (!userId || !reason || !clearanceDate || !Array.isArray(actions)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const processedBy = sessionUser.email ?? "System";
    const clearanceDateLabel = new Date(clearanceDate).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const generatedAt = new Date().toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const refCode = `CLR-${Date.now().toString(36).toUpperCase()}`;

    /* ── Generate PDF ── */
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildPdf({
        userName:          String(userName  ?? ""),
        userEmail:         String(userEmail ?? ""),
        reason:            String(reason    ?? ""),
        notes:             notes ? String(notes) : null,
        clearanceDateLabel,
        actions,
        processedBy,
        generatedAt,
        refCode,
      });
    } catch (pdfErr) {
      console.error("PDF generation error:", pdfErr);
      return res.status(500).json({
        error:  "PDF generation failed",
        detail: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
      });
    }

    /* ── Upload to Supabase ── */
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim() || undefined;
    const docsBucket  = "asset-documents";

    const storage = serviceKey
      ? createAdminClient(supabaseUrl, serviceKey).storage
      : supabase.storage;

    if (serviceKey) {
      const { data: buckets } = await storage.listBuckets();
      const existing = buckets?.find((b: any) => b.name === docsBucket);
      if (!existing) {
        await storage.createBucket(docsBucket, { public: true, fileSizeLimit: 10 * 1024 * 1024 }).catch(() => {});
      } else if (!existing.public) {
        await storage.updateBucket(docsBucket, { public: true, fileSizeLimit: 10 * 1024 * 1024 }).catch(() => {});
      }
    }

    const timestamp   = Date.now();
    const storagePath = `clearance-reports/clearance_${String(userId).slice(0, 8)}_${timestamp}.pdf`;

    const { data: uploadData, error: uploadError } = await storage
      .from(docsBucket)
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      return res.status(500).json({ error: "Failed to upload report", detail: uploadError.message });
    }

    const { data: { publicUrl } } = storage.from(docsBucket).getPublicUrl(uploadData.path);

    /* ── AssetDocument records ── */
    const displayFileName = `Clearance_Certificate_${new Date(clearanceDate).toISOString().split("T")[0]}.pdf`;
    const docRecords = actions.map((a: any) => ({
      assetId:       a.assetId,
      fileName:      displayFileName,
      fileUrl:       publicUrl,
      fileType:      "application/pdf",
      fileSize:      pdfBuffer.length,
      uploadedById:  sessionUser.id,
    }));

    await prisma.assetDocument.createMany({ data: docRecords, skipDuplicates: true }).catch((e: any) => {
      console.error("AssetDocument createMany error:", e);
    });

    return res.status(200).json({ reportUrl: publicUrl, fileName: displayFileName });

  } catch (err) {
    console.error("clearance-report handler error:", err);
    return res.status(500).json({
      error:  "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
