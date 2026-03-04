// @ts-nocheck
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, pdf,
} from "@react-pdf/renderer";

/* ── Colour palette ───────────────────────────────────────────────────── */
const C = {
  red:         "#b91c1c",
  redDark:     "#7f1d1d",
  redLight:    "#fef2f2",
  redBorder:   "#fca5a5",
  green:       "#15803d",
  greenBg:     "#f0fdf4",
  greenBorder: "#86efac",
  blue:        "#1d4ed8",
  blueBg:      "#eff6ff",
  blueBorder:  "#bfdbfe",
  slate50:     "#f8fafc",
  slate100:    "#f1f5f9",
  slate200:    "#e2e8f0",
  slate400:    "#94a3b8",
  slate500:    "#64748b",
  slate700:    "#334155",
  slate900:    "#0f172a",
  white:       "#ffffff",
  amber50:     "#fffbeb",
  amber200:    "#fde68a",
  amber800:    "#92400e",
  indigo:      "#4338ca",
};

/* ── Styles ───────────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: "Helvetica" },

  /* header */
  header: { backgroundColor: C.red, padding: "28 36 24 36" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: C.white, marginBottom: 3 },
  headerSub: { fontSize: 9, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1.2 },
  badge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", alignSelf: "flex-start" },
  badgeText: { color: C.white, fontSize: 10, fontWeight: "bold" },
  refText: { fontSize: 8, color: "rgba(255,255,255,0.45)", marginTop: 5, textAlign: "right" },

  /* sub-header accent bar */
  accentBar: { height: 4, backgroundColor: C.redDark },

  /* meta row */
  metaRow: { flexDirection: "row", backgroundColor: C.slate100, borderBottomWidth: 1, borderBottomColor: C.slate200, paddingHorizontal: 36, paddingVertical: 16, gap: 16 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 8, color: C.slate400, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, fontWeight: "bold" },
  metaValue: { fontSize: 13, fontWeight: "bold", color: C.slate900 },
  metaSub: { fontSize: 10, color: C.slate500, marginTop: 2 },

  /* stats */
  statsRow: { flexDirection: "row", paddingHorizontal: 36, paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: C.slate200, backgroundColor: C.white },
  statBox: { flex: 1, borderRadius: 10, padding: 14, borderWidth: 2, alignItems: "center" },
  statNum: { fontSize: 28, fontWeight: "bold" },
  statLbl: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 5, opacity: 0.8 },

  /* section */
  section: { paddingHorizontal: 36, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, color: C.slate400, marginBottom: 8 },
  divider: { height: 1, backgroundColor: C.slate200, marginBottom: 10 },

  /* table */
  tableHeader: { flexDirection: "row", backgroundColor: C.slate50, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.slate200 },
  thCell: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, color: C.slate400 },
  tableRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.slate50 },
  tableRowAlt: { backgroundColor: C.slate50 },
  rowNum: { width: 24, fontSize: 10, color: "#cbd5e1", fontWeight: "bold" },
  colAsset:    { flex: 2.5 },
  colAction:   { flex: 1.8 },
  colReassign: { flex: 2 },
  assetName: { fontSize: 11, fontWeight: "bold", color: C.slate900 },
  assetType: { fontSize: 9, color: C.slate400, marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.5, alignSelf: "flex-start" },
  pillText: { fontSize: 9, fontWeight: "bold" },
  reassignName: { fontSize: 11, fontWeight: "bold", color: C.slate900 },
  reassignEmail: { fontSize: 9, color: C.slate500, marginTop: 2 },
  dash: { fontSize: 11, color: "#cbd5e1" },

  /* notes */
  notesBox: { backgroundColor: C.amber50, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.amber200 },
  notesText: { fontSize: 11, color: C.amber800, lineHeight: 1.6 },

  /* footer */
  footer: { flexDirection: "row", paddingHorizontal: 36, paddingTop: 16, paddingBottom: 16, borderTopWidth: 2, borderTopColor: C.slate200, backgroundColor: C.slate50, gap: 20, alignItems: "flex-end" },
  officerBlock: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatarBox: { width: 38, height: 38, backgroundColor: C.indigo, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.white, fontSize: 13, fontWeight: "bold" },
  officerLbl: { fontSize: 9, color: C.slate400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  officerName: { fontSize: 12, fontWeight: "bold", color: C.slate900 },
  sigBlock: { flex: 1, alignItems: "center" },
  sigLine: { width: "100%", borderTopWidth: 1.5, borderTopColor: "#cbd5e1", paddingTop: 6, marginTop: 44 },
  sigText: { fontSize: 8, color: C.slate400, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center" },

  /* watermark */
  watermark: { paddingVertical: 10, alignItems: "center" },
  watermarkTxt: { fontSize: 8, color: "#d1d5db", letterSpacing: 0.8, textTransform: "uppercase" },
});

/* ── Label maps ───────────────────────────────────────────────────────── */
const ACTION_LABELS: Record<string, string> = {
  RETURN_TO_STOCK: "Returned to Stock",
  REASSIGN: "Reassigned",
  DISPOSE: "Disposed",
};
const ACTION_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  RETURN_TO_STOCK: { color: C.green,  bg: C.greenBg,  border: C.greenBorder },
  REASSIGN:        { color: C.blue,   bg: C.blueBg,   border: C.blueBorder  },
  DISPOSE:         { color: C.red,    bg: C.redLight,  border: C.redBorder   },
};
const REASON_LABELS: Record<string, string> = {
  TERMINATED: "Terminated", RESIGNED: "Resigned",
  TRANSFERRED: "Transferred", SUSPENDED: "Suspended", OTHER: "Other",
};

/* ── PDF Document component ───────────────────────────────────────────── */
function ClearancePDF({ userName, userEmail, reason, notes, clearanceDateLabel, actions, processedBy, generatedAt, refCode }: any) {
  const returned   = actions.filter((a: any) => a.action === "RETURN_TO_STOCK").length;
  const reassigned = actions.filter((a: any) => a.action === "REASSIGN").length;
  const disposed   = actions.filter((a: any) => a.action === "DISPOSE").length;

  const el = React.createElement;

  return el(Document, { title: `Clearance Certificate - ${userName}`, author: processedBy },
    el(Page, { size: "A4", style: S.page },

      /* ── Header ── */
      el(View, { style: S.header },
        el(View, { style: S.headerRow },
          el(View, null,
            el(Text, { style: S.headerTitle }, "Asset Clearance Certificate"),
            el(Text, { style: S.headerSub }, "Official Record - Asset Management System"),
          ),
          el(View, { style: { alignItems: "flex-end" } },
            el(View, { style: S.badge }, el(Text, { style: S.badgeText }, REASON_LABELS[reason] ?? reason)),
            el(Text, { style: S.refText }, `REF: ${refCode}`),
          )
        )
      ),
      el(View, { style: S.accentBar }),

      /* ── Meta ── */
      el(View, { style: S.metaRow },
        el(View, { style: S.metaItem },
          el(Text, { style: S.metaLabel }, "Cleared Employee"),
          el(Text, { style: S.metaValue }, userName),
          el(Text, { style: S.metaSub }, userEmail),
        ),
        el(View, { style: S.metaItem },
          el(Text, { style: S.metaLabel }, "Clearance Date"),
          el(Text, { style: S.metaValue }, clearanceDateLabel),
          el(Text, { style: S.metaSub }, "Effective immediately"),
        ),
        el(View, { style: S.metaItem },
          el(Text, { style: S.metaLabel }, "Processed By"),
          el(Text, { style: S.metaValue }, processedBy),
          el(Text, { style: S.metaSub }, `Generated ${generatedAt}`),
        ),
      ),

      /* ── Stats ── */
      el(View, { style: S.statsRow },
        ...[
          { num: actions.length, lbl: "Total Assets",  color: C.slate700, bg: C.slate50,  border: C.slate200   },
          { num: returned,       lbl: "Returned",       color: C.green,   bg: C.greenBg,  border: C.greenBorder },
          { num: reassigned,     lbl: "Reassigned",     color: C.blue,    bg: C.blueBg,   border: C.blueBorder  },
          { num: disposed,       lbl: "Disposed",       color: C.red,     bg: C.redLight,  border: C.redBorder   },
        ].map(s => el(View, { key: s.lbl, style: [S.statBox, { backgroundColor: s.bg, borderColor: s.border }] },
          el(Text, { style: [S.statNum, { color: s.color }] }, String(s.num)),
          el(Text, { style: [S.statLbl, { color: s.color }] }, s.lbl),
        ))
      ),

      /* ── Asset table ── */
      el(View, { style: S.section },
        el(Text, { style: S.sectionTitle }, "Asset Disposition Summary"),
        el(View, { style: S.divider }),

        el(View, { style: S.tableHeader },
          el(Text, { style: [S.thCell, { width: 24 }] }, "#"),
          el(Text, { style: [S.thCell, S.colAsset] }, "Asset"),
          el(Text, { style: [S.thCell, S.colAction] }, "Action Taken"),
          el(Text, { style: [S.thCell, S.colReassign] }, "Reassigned To"),
        ),

        ...actions.map((a: any, i: number) => {
          const ac = ACTION_COLORS[a.action] ?? { color: C.slate500, bg: C.slate50, border: C.slate200 };
          return el(View, { key: `${a.assetId}-${i}`, style: [S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}] },
            el(Text, { style: S.rowNum }, String(i + 1)),
            el(View, { style: S.colAsset },
              el(Text, { style: S.assetName }, a.assetName ?? a.assetId),
              a.assetType ? el(Text, { style: S.assetType }, a.assetType) : null,
            ),
            el(View, { style: S.colAction },
              el(View, { style: [S.pill, { backgroundColor: ac.bg, borderColor: ac.border }] },
                el(Text, { style: [S.pillText, { color: ac.color }] }, ACTION_LABELS[a.action] ?? a.action),
              )
            ),
            el(View, { style: S.colReassign },
              a.newUserName
                ? el(View, null,
                    el(Text, { style: S.reassignName }, a.newUserName),
                    a.newUserEmail ? el(Text, { style: S.reassignEmail }, a.newUserEmail) : null,
                  )
                : el(Text, { style: S.dash }, "-"),
            ),
          );
        }),
      ),

      /* ── Notes ── */
      notes
        ? el(View, { style: [S.section, { paddingTop: 4 }] },
            el(Text, { style: S.sectionTitle }, "Clearance Notes"),
            el(View, { style: S.divider }),
            el(View, { style: S.notesBox },
              el(Text, { style: S.notesText }, notes)
            ),
          )
        : null,

      /* ── Footer ── */
      el(View, { style: S.footer },
        el(View, { style: S.officerBlock },
          el(View, { style: S.avatarBox },
            el(Text, { style: S.avatarText }, (processedBy || "?").slice(0, 2).toUpperCase()),
          ),
          el(View, null,
            el(Text, { style: S.officerLbl }, "Clearance Officer"),
            el(Text, { style: S.officerName }, processedBy),
          )
        ),
        el(View, { style: S.sigBlock },
          el(View, { style: S.sigLine },
            el(Text, { style: S.sigText }, "Department Manager Signature")
          )
        ),
        el(View, { style: S.sigBlock },
          el(View, { style: S.sigLine },
            el(Text, { style: S.sigText }, "HR Director Signature")
          )
        ),
      ),

      /* ── Watermark ── */
      el(View, { style: S.watermark },
        el(Text, { style: S.watermarkTxt },
          `Asset Management System  |  Clearance Certificate  |  ${generatedAt}`
        )
      ),
    )
  );
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
      const docElement = React.createElement(ClearancePDF, {
        userName: String(userName ?? ""),
        userEmail: String(userEmail ?? ""),
        reason: String(reason ?? ""),
        notes: notes ? String(notes) : null,
        clearanceDateLabel,
        actions,
        processedBy,
        generatedAt,
        refCode,
      });
      const pdfBlob = await pdf(docElement).toBuffer();
      pdfBuffer = Buffer.from(pdfBlob);
    } catch (pdfErr) {
      console.error("PDF generation error:", pdfErr);
      return res.status(500).json({
        error: "PDF generation failed",
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

    const timestamp = Date.now();
    const storagePath = `clearance-reports/clearance_${String(userId).slice(0, 8)}_${timestamp}.pdf`;

    const { data: uploadData, error: uploadError } = await storage
      .from(docsBucket)
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      return res.status(500).json({ error: "Failed to upload report", detail: uploadError.message });
    }

    const { data: { publicUrl } } = storage.from(docsBucket).getPublicUrl(uploadData.path);

    /* ── Create AssetDocument records ── */
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
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
