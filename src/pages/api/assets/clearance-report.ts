// @ts-nocheck
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, pdf, Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Helvetica",
  fonts: [],
});

const c = {
  red:     "#b91c1c",
  redDark: "#7f1d1d",
  redLight:"#fef2f2",
  redBorder:"#fca5a5",
  green:   "#15803d",
  greenBg: "#f0fdf4",
  greenBorder:"#86efac",
  blue:    "#1d4ed8",
  blueBg:  "#eff6ff",
  blueBorder:"#93c5fd",
  slate50: "#f8fafc",
  slate100:"#f1f5f9",
  slate200:"#e2e8f0",
  slate400:"#94a3b8",
  slate500:"#64748b",
  slate700:"#334155",
  slate900:"#0f172a",
  white:   "#ffffff",
  amber50: "#fffbeb",
  amber200:"#fde68a",
  amber800:"#92400e",
  purple:  "#7c3aed",
  indigo:  "#4f46e5",
};

const styles = StyleSheet.create({
  page: { backgroundColor: c.slate50, paddingBottom: 40 },

  // Header
  header: { backgroundColor: c.red, padding: "28 36 24 36" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBox: { width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  iconText: { fontSize: 22, color: c.white },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: c.white, marginBottom: 3 },
  headerSub: { fontSize: 9, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1 },
  badge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  badgeText: { color: c.white, fontSize: 10, fontWeight: "bold" },
  refText: { fontSize: 8, color: "rgba(255,255,255,0.45)", marginTop: 4, textAlign: "right" },

  // Meta row
  metaRow: { flexDirection: "row", backgroundColor: c.slate100, borderBottomWidth: 1, borderBottomColor: c.slate200, paddingHorizontal: 36, paddingVertical: 16, gap: 16 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 8, color: c.slate400, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, fontWeight: "bold" },
  metaValue: { fontSize: 13, fontWeight: "bold", color: c.slate900 },
  metaSub: { fontSize: 10, color: c.slate500, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: "row", paddingHorizontal: 36, paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: c.slate200, backgroundColor: c.white },
  statBox: { flex: 1, borderRadius: 12, padding: 14, borderWidth: 2, alignItems: "center" },
  statNum: { fontSize: 30, fontWeight: "bold", lineHeight: 1 },
  statLbl: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginTop: 5 },

  // Section
  section: { paddingHorizontal: 36, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, color: c.slate400, marginBottom: 10 },
  divider: { height: 1, backgroundColor: c.slate200, marginBottom: 10 },

  // Table
  tableHeader: { flexDirection: "row", backgroundColor: c.slate50, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.slate200 },
  tableHeaderCell: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, color: c.slate400 },
  tableRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tableRowAlt: { backgroundColor: c.slate50 },
  rowNum: { width: 28, fontSize: 10, color: "#cbd5e1", fontWeight: "bold" },
  colAsset: { flex: 2.5 },
  colAction: { flex: 1.5 },
  colReassign: { flex: 2 },
  assetName: { fontSize: 11, fontWeight: "bold", color: c.slate900 },
  assetType: { fontSize: 9, color: c.slate400, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.5, alignSelf: "flex-start" },
  pillText: { fontSize: 9, fontWeight: "bold" },
  reassignName: { fontSize: 11, fontWeight: "bold", color: c.slate900 },
  reassignEmail: { fontSize: 9, color: c.slate500, marginTop: 2 },
  dash: { fontSize: 11, color: "#cbd5e1" },

  // Notes
  notesBox: { backgroundColor: c.amber50, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.amber200, marginTop: 2 },
  notesText: { fontSize: 11, color: c.amber800, lineHeight: 1.6 },

  // Footer
  footer: { flexDirection: "row", paddingHorizontal: 36, paddingTop: 16, paddingBottom: 14, borderTopWidth: 2, borderTopColor: c.slate200, backgroundColor: c.slate50, gap: 24, alignItems: "flex-end" },
  officerBox: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, backgroundColor: c.indigo, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  avatarText: { color: c.white, fontSize: 12, fontWeight: "bold" },
  officerLabel: { fontSize: 9, color: c.slate400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  officerName: { fontSize: 12, fontWeight: "bold", color: c.slate900 },
  sigBlock: { flex: 1, alignItems: "center" },
  sigLine: { width: "100%", borderTopWidth: 1.5, borderTopColor: "#cbd5e1", paddingTop: 6, marginTop: 44 },
  sigText: { fontSize: 8, color: c.slate400, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center" },

  // Watermark
  watermark: { paddingVertical: 10, alignItems: "center" },
  watermarkText: { fontSize: 8, color: "#cbd5e1", letterSpacing: 1, textTransform: "uppercase" },
});

const actionColors: Record<string, { color: string; bg: string; border: string }> = {
  RETURN_TO_STOCK: { color: c.green,   bg: c.greenBg,  border: c.greenBorder },
  REASSIGN:        { color: c.blue,    bg: c.blueBg,   border: c.blueBorder  },
  DISPOSE:         { color: c.red,     bg: c.redLight,  border: c.redBorder   },
};
const actionLabels: Record<string, string> = {
  RETURN_TO_STOCK: "Returned to Stock",
  REASSIGN: "Reassigned",
  DISPOSE: "Disposed",
};
const reasonLabels: Record<string, string> = {
  TERMINATED: "Terminated", RESIGNED: "Resigned",
  TRANSFERRED: "Transferred", SUSPENDED: "Suspended", OTHER: "Other",
};

function ClearancePDF({ userName, userEmail, reason, notes, clearanceDate, actions, processedBy, generatedAt, refCode }: any) {
  const returned   = actions.filter((a: any) => a.action === "RETURN_TO_STOCK").length;
  const reassigned = actions.filter((a: any) => a.action === "REASSIGN").length;
  const disposed   = actions.filter((a: any) => a.action === "DISPOSE").length;

  return React.createElement(
    Document,
    { title: `Clearance Certificate — ${userName}`, author: processedBy },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },

      // ── Header ──
      React.createElement(
        View, { style: styles.header },
        React.createElement(
          View, { style: styles.headerRow },
          React.createElement(
            View, { style: styles.headerLeft },
            React.createElement(View, { style: styles.iconBox },
              React.createElement(Text, { style: styles.iconText }, "📋")
            ),
            React.createElement(
              View, null,
              React.createElement(Text, { style: styles.headerTitle }, "Asset Clearance Certificate"),
              React.createElement(Text, { style: styles.headerSub }, "Official Record — Asset Management System"),
            )
          ),
          React.createElement(
            View, { style: { alignItems: "flex-end" } },
            React.createElement(View, { style: styles.badge },
              React.createElement(Text, { style: styles.badgeText }, reasonLabels[reason] ?? reason)
            ),
            React.createElement(Text, { style: styles.refText }, `REF: ${refCode}`)
          )
        )
      ),

      // ── Meta ──
      React.createElement(
        View, { style: styles.metaRow },
        React.createElement(
          View, { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "Cleared Employee"),
          React.createElement(Text, { style: styles.metaValue }, userName),
          React.createElement(Text, { style: styles.metaSub }, userEmail),
        ),
        React.createElement(
          View, { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "Clearance Date"),
          React.createElement(Text, { style: styles.metaValue }, clearanceDate),
          React.createElement(Text, { style: styles.metaSub }, "Effective immediately"),
        ),
        React.createElement(
          View, { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "Processed By"),
          React.createElement(Text, { style: styles.metaValue }, processedBy),
          React.createElement(Text, { style: styles.metaSub }, `Generated ${generatedAt}`),
        ),
      ),

      // ── Stats ──
      React.createElement(
        View, { style: styles.statsRow },
        ...[
          { num: actions.length, lbl: "Total Assets",  cls: "total",  color: c.slate700, bg: c.slate50,   border: c.slate200  },
          { num: returned,       lbl: "Returned",       cls: "ret",    color: c.green,    bg: c.greenBg,   border: c.greenBorder},
          { num: reassigned,     lbl: "Reassigned",     cls: "reass",  color: c.blue,     bg: c.blueBg,    border: c.blueBorder },
          { num: disposed,       lbl: "Disposed",       cls: "disp",   color: c.red,      bg: c.redLight,   border: c.redBorder  },
        ].map(s =>
          React.createElement(
            View, { key: s.lbl, style: [styles.statBox, { backgroundColor: s.bg, borderColor: s.border }] },
            React.createElement(Text, { style: [styles.statNum, { color: s.color }] }, String(s.num)),
            React.createElement(Text, { style: [styles.statLbl, { color: s.color, opacity: 0.8 }] }, s.lbl),
          )
        )
      ),

      // ── Asset table ──
      React.createElement(
        View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Asset Disposition Summary"),
        React.createElement(View, { style: styles.divider }),

        React.createElement(
          View, { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 28 }] }, "#"),
          React.createElement(Text, { style: [styles.tableHeaderCell, { flex: 2.5 }] }, "Asset"),
          React.createElement(Text, { style: [styles.tableHeaderCell, { flex: 1.5 }] }, "Action"),
          React.createElement(Text, { style: [styles.tableHeaderCell, { flex: 2 }] }, "Reassigned To"),
        ),

        ...actions.map((a: any, i: number) => {
          const ac = actionColors[a.action] ?? { color: c.slate500, bg: c.slate50, border: c.slate200 };
          return React.createElement(
            View, { key: a.assetId, style: [styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}] },
            React.createElement(Text, { style: styles.rowNum }, String(i + 1)),
            React.createElement(
              View, { style: styles.colAsset },
              React.createElement(Text, { style: styles.assetName }, a.assetName ?? a.assetId),
              a.assetType ? React.createElement(Text, { style: styles.assetType }, a.assetType) : null,
            ),
            React.createElement(
              View, { style: styles.colAction },
              React.createElement(
                View, { style: [styles.pill, { backgroundColor: ac.bg, borderColor: ac.border }] },
                React.createElement(Text, { style: [styles.pillText, { color: ac.color }] }, actionLabels[a.action] ?? a.action),
              )
            ),
            React.createElement(
              View, { style: styles.colReassign },
              a.newUserName
                ? React.createElement(
                    View, null,
                    React.createElement(Text, { style: styles.reassignName }, a.newUserName),
                    a.newUserEmail ? React.createElement(Text, { style: styles.reassignEmail }, a.newUserEmail) : null,
                  )
                : React.createElement(Text, { style: styles.dash }, "—"),
            ),
          );
        }),
      ),

      // ── Notes ──
      notes ? React.createElement(
        View, { style: [styles.section, { paddingTop: 4 }] },
        React.createElement(Text, { style: styles.sectionTitle }, "Clearance Notes"),
        React.createElement(View, { style: styles.divider }),
        React.createElement(View, { style: styles.notesBox },
          React.createElement(Text, { style: styles.notesText }, notes)
        ),
      ) : null,

      // ── Footer ──
      React.createElement(
        View, { style: styles.footer },
        React.createElement(
          View, { style: styles.officerBox },
          React.createElement(View, { style: styles.avatar },
            React.createElement(Text, { style: styles.avatarText }, processedBy.slice(0, 2).toUpperCase())
          ),
          React.createElement(
            View, null,
            React.createElement(Text, { style: styles.officerLabel }, "Clearance Officer"),
            React.createElement(Text, { style: styles.officerName }, processedBy),
          )
        ),
        React.createElement(
          View, { style: styles.sigBlock },
          React.createElement(View, { style: styles.sigLine },
            React.createElement(Text, { style: styles.sigText }, "Department Manager Signature")
          )
        ),
        React.createElement(
          View, { style: styles.sigBlock },
          React.createElement(View, { style: styles.sigLine },
            React.createElement(Text, { style: styles.sigText }, "HR Director Signature")
          )
        ),
      ),

      // ── Watermark ──
      React.createElement(
        View, { style: styles.watermark },
        React.createElement(Text, { style: styles.watermarkText },
          `Asset Management System  •  Clearance Certificate  •  ${generatedAt}`
        )
      ),
    )
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const sessionUser = session?.user ?? null;
    if (authError || !sessionUser) return res.status(401).json({ error: "Unauthorized" });

    const {
      userId, userName, userEmail, reason, notes, clearanceDate, actions,
    } = req.body as {
      userId: string; userName: string; userEmail: string;
      reason: string; notes?: string; clearanceDate: string;
      actions: { assetId: string; assetName: string; assetType: string; action: string; newUserName?: string; newUserEmail?: string }[];
    };

    if (!userId || !reason || !clearanceDate || !Array.isArray(actions)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const processedBy = sessionUser.email ?? "System";
    const dateLabel = new Date(clearanceDate).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const generatedAt = new Date().toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const refCode = `CLR-${Date.now().toString(36).toUpperCase()}`;

    /* ── Generate PDF ───────────────────────────────────────────────────── */
    const pdfDoc = React.createElement(ClearancePDF, {
      userName, userEmail, reason, notes: notes ?? null,
      clearanceDate: dateLabel, actions, processedBy, generatedAt, refCode,
    });

    const pdfInstance = pdf(pdfDoc);
    const pdfBuffer = Buffer.from(await pdfInstance.toBuffer());

    /* ── Upload to Supabase Storage ─────────────────────────────────────── */
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

    const timestamp = Date.now();
    const fileName = `clearance_${userId.slice(0, 8)}_${timestamp}.pdf`;
    const storagePath = `clearance-reports/${fileName}`;

    const { data: uploadData, error: uploadError } = await storage
      .from(docsBucket)
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Clearance report upload error:", uploadError.message);
      return res.status(500).json({ error: "Failed to upload report", detail: uploadError.message });
    }

    const { data: { publicUrl } } = storage.from(docsBucket).getPublicUrl(uploadData.path);

    /* ── Create AssetDocument records for each affected asset ───────────── */
    const displayFileName = `Clearance_Certificate_${new Date(clearanceDate).toISOString().split("T")[0]}.pdf`;
    const docRecords = actions.map((a: any) => ({
      assetId: a.assetId,
      fileName: displayFileName,
      fileUrl: publicUrl,
      fileType: "application/pdf",
      fileSize: pdfBuffer.length,
      uploadedById: sessionUser.id,
    }));

    await prisma.assetDocument.createMany({ data: docRecords, skipDuplicates: true }).catch((e: any) => {
      console.error("AssetDocument createMany error:", e);
    });

    return res.status(200).json({ reportUrl: publicUrl, fileName: displayFileName });
  } catch (err) {
    console.error("clearance-report handler error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err instanceof Error ? err.message : String(err) });
  }
}
