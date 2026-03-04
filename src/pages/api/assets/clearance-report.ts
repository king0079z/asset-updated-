import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";

/**
 * POST /api/assets/clearance-report
 *
 * Generates an HTML clearance certificate, uploads it to Supabase Storage
 * under the "asset-documents" bucket, and creates an AssetDocument record
 * for every affected asset — so the report appears in each asset's
 * Documents tab and can be downloaded at any time.
 *
 * Returns { reportUrl } on success.
 */
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

    const reasonLabels: Record<string, string> = {
      TERMINATED: "Terminated", RESIGNED: "Resigned",
      TRANSFERRED: "Transferred", SUSPENDED: "Suspended", OTHER: "Other",
    };
    const actionLabels: Record<string, string> = {
      RETURN_TO_STOCK: "Returned to Stock",
      REASSIGN: "Reassigned",
      DISPOSE: "Disposed",
    };
    const actionColors: Record<string, string> = {
      RETURN_TO_STOCK: "#059669",
      REASSIGN: "#2563eb",
      DISPOSE: "#dc2626",
    };

    const returned   = actions.filter(a => a.action === "RETURN_TO_STOCK").length;
    const reassigned = actions.filter(a => a.action === "REASSIGN").length;
    const disposed   = actions.filter(a => a.action === "DISPOSE").length;

    /* ── Generate HTML certificate ─────────────────────────────────────── */
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Asset Clearance Certificate — ${escHtml(userName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; background: #f1f5f9; color: #1e293b; padding: 40px 24px; }
  .toolbar { max-width: 860px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .toolbar h2 { font-size: 13px; color: #64748b; font-weight: 500; }
  .btn-print { background: #b91c1c; color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .btn-print:hover { background: #991b1b; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12); }
  .header { background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 45%, #ef4444 100%); padding: 40px 44px 36px; position: relative; overflow: hidden; }
  .header::before { content: ''; position: absolute; top: -40px; right: -40px; width: 200px; height: 200px; background: rgba(255,255,255,0.06); border-radius: 50%; }
  .header::after { content: ''; position: absolute; bottom: -60px; left: 20px; width: 160px; height: 160px; background: rgba(255,255,255,0.04); border-radius: 50%; }
  .header-inner { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
  .logo-area { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 52px; height: 52px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.25); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
  .header h1 { color: #fff; font-size: 24px; font-weight: 800; line-height: 1.2; }
  .header .sub { color: rgba(255,255,255,0.65); font-size: 11px; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
  .header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  .badge { background: rgba(255,255,255,0.2); border: 1.5px solid rgba(255,255,255,0.3); color: #fff; font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 9999px; white-space: nowrap; }
  .cert-number { font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.08em; }
  .meta { padding: 20px 44px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .meta-item label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; display: block; margin-bottom: 4px; }
  .meta-item .value { font-size: 14px; font-weight: 700; color: #0f172a; }
  .meta-item .sub-value { font-size: 11px; color: #64748b; margin-top: 2px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 20px 44px; border-bottom: 1px solid #e2e8f0; }
  .stat { text-align: center; border-radius: 14px; padding: 18px 12px; border: 2px solid; }
  .stat.total   { background: #f8fafc; border-color: #e2e8f0; color: #475569; }
  .stat.ret     { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  .stat.reass   { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  .stat.disp    { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  .stat .num    { font-size: 36px; font-weight: 900; line-height: 1; }
  .stat .lbl    { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; opacity: 0.8; }
  .section { padding: 20px 44px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .section-title::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: #f8fafc; }
  th { padding: 10px 14px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; border-bottom: 2px solid #e2e8f0; }
  td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: #fafafa; }
  .asset-name { font-weight: 600; color: #0f172a; }
  .asset-type { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .action-pill { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 9999px; font-size: 10.5px; font-weight: 700; border: 1.5px solid; gap: 4px; }
  .reassign-to { font-size: 12px; color: #0f172a; font-weight: 600; }
  .reassign-email { font-size: 10px; color: #64748b; }
  .notes-box { background: linear-gradient(135deg, #fffbeb, #fef9c3); border: 1px solid #fde68a; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #78350f; line-height: 1.6; }
  .footer { padding: 24px 44px; border-top: 2px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; align-items: end; background: #fafafa; }
  .officer-block { display: flex; align-items: center; gap: 12px; }
  .officer-avatar { width: 40px; height: 40px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 800; flex-shrink: 0; }
  .sig-block { text-align: center; }
  .sig-line { margin-top: 44px; border-top: 1.5px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .watermark { text-align: center; padding: 16px; }
  .watermark span { font-size: 10px; color: #cbd5e1; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
  @media print {
    body { padding: 0; background: #fff; }
    .toolbar { display: none; }
    .page { box-shadow: none; border-radius: 0; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stat, .notes-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
<script>
  function printReport() { window.print(); }
</script>
</head>
<body>

  <!-- Print toolbar (hidden when printing) -->
  <div class="toolbar">
    <h2>Asset Clearance Certificate — ${escHtml(userName)}</h2>
    <button class="btn-print" onclick="printReport()">&#128438; Print / Save as PDF</button>
  </div>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-inner">
      <div class="logo-area">
        <div class="logo-icon">&#128196;</div>
        <div>
          <h1>Asset Clearance Certificate</h1>
          <p class="sub">Official Record &mdash; Asset Management System</p>
        </div>
      </div>
      <div class="header-right">
        <span class="badge">${escHtml(reasonLabels[reason] ?? reason)}</span>
        <div class="cert-number">REF: CLR-${Date.now().toString(36).toUpperCase()}</div>
      </div>
    </div>
  </div>

  <!-- Meta grid -->
  <div class="meta">
    <div class="meta-item">
      <label>Cleared Employee</label>
      <div class="value">${escHtml(userName)}</div>
      <div class="sub-value">${escHtml(userEmail)}</div>
    </div>
    <div class="meta-item">
      <label>Clearance Date</label>
      <div class="value">${escHtml(dateLabel)}</div>
      <div class="sub-value">Effective immediately</div>
    </div>
    <div class="meta-item">
      <label>Processed By</label>
      <div class="value">${escHtml(processedBy)}</div>
      <div class="sub-value">Generated ${escHtml(generatedAt)}</div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat total">
      <div class="num">${actions.length}</div>
      <div class="lbl">Total Assets</div>
    </div>
    <div class="stat ret">
      <div class="num">${returned}</div>
      <div class="lbl">Returned</div>
    </div>
    <div class="stat reass">
      <div class="num">${reassigned}</div>
      <div class="lbl">Reassigned</div>
    </div>
    <div class="stat disp">
      <div class="num">${disposed}</div>
      <div class="lbl">Disposed</div>
    </div>
  </div>

  <!-- Asset table -->
  <div class="section">
    <div class="section-title">Asset Disposition Summary</div>
    <table>
      <thead>
        <tr>
          <th style="width:36px;">#</th>
          <th>Asset</th>
          <th style="width:120px;">Action Taken</th>
          <th>Reassigned To</th>
        </tr>
      </thead>
      <tbody>
        ${actions.map((a, i) => `
        <tr>
          <td style="color:#cbd5e1;font-size:11px;font-weight:700;">${i + 1}</td>
          <td>
            <div class="asset-name">${escHtml(a.assetName ?? a.assetId)}</div>
            ${a.assetType ? `<div class="asset-type">${escHtml(a.assetType)}</div>` : ""}
          </td>
          <td>
            <span class="action-pill" style="color:${actionColors[a.action] ?? "#64748b"};border-color:${actionColors[a.action] ?? "#cbd5e1"};background:${actionColors[a.action] ? actionColors[a.action] + '12' : '#f8fafc'};">
              ${actionLabels[a.action] ?? a.action}
            </span>
          </td>
          <td>
            ${a.newUserName ? `<div class="reassign-to">${escHtml(a.newUserName)}</div>${a.newUserEmail ? `<div class="reassign-email">${escHtml(a.newUserEmail)}</div>` : ""}` : '<span style="color:#cbd5e1;">—</span>'}
          </td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  ${notes ? `
  <div class="section" style="padding-top:0;">
    <div class="section-title">Clearance Notes</div>
    <div class="notes-box">${escHtml(notes)}</div>
  </div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <div class="officer-block">
      <div class="officer-avatar">${escHtml(processedBy.slice(0, 2).toUpperCase())}</div>
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Clearance Officer</div>
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">${escHtml(processedBy)}</div>
      </div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Department Manager Signature</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">HR Director Signature</div>
    </div>
  </div>

  <div class="watermark">
    <span>Asset Management System &bull; Clearance Certificate &bull; ${escHtml(generatedAt)}</span>
  </div>

</div>
</body>
</html>`;

    /* ── Upload to Supabase Storage ─────────────────────────────────────── */
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim() || undefined;
    const docsBucket  = "asset-documents";

    const storage = serviceKey
      ? createAdminClient(supabaseUrl, serviceKey).storage
      : supabase.storage;

    if (serviceKey) {
      const { data: buckets } = await storage.listBuckets();
      const existing = buckets?.find((b) => b.name === docsBucket);
      if (!existing) {
        await storage.createBucket(docsBucket, { public: true, fileSizeLimit: 10 * 1024 * 1024 }).catch(() => {});
      } else if (!existing.public) {
        await storage.updateBucket(docsBucket, { public: true, fileSizeLimit: 10 * 1024 * 1024 }).catch(() => {});
      }
    }

    const timestamp = Date.now();
    const fileName = `clearance_${userId.slice(0, 8)}_${timestamp}.html`;
    /* Use the first asset's id as the "primary" path folder; we'll create
       document records for ALL affected assets pointing to the same file URL. */
    const storagePath = `clearance-reports/${fileName}`;

    const htmlBytes = Buffer.from(html, "utf-8");
    const { data: uploadData, error: uploadError } = await storage
      .from(docsBucket)
      .upload(storagePath, htmlBytes, { contentType: "text/html; charset=utf-8", upsert: true });

    if (uploadError) {
      console.error("Clearance report upload error:", uploadError.message);
      return res.status(500).json({ error: "Failed to upload report", detail: uploadError.message });
    }

    const { data: { publicUrl } } = storage.from(docsBucket).getPublicUrl(uploadData.path);

    /* ── Create AssetDocument records for each affected asset ───────────── */
    const docRecords = actions.map(a => ({
      assetId: a.assetId,
      fileName: `Clearance_Certificate_${new Date(clearanceDate).toISOString().split("T")[0]}.html`,
      fileUrl: publicUrl,
      fileType: "text/html",
      fileSize: htmlBytes.length,
      uploadedById: sessionUser.id,
    }));

    await prisma.assetDocument.createMany({ data: docRecords, skipDuplicates: true }).catch(e => {
      console.error("AssetDocument createMany error:", e);
    });

    return res.status(200).json({ reportUrl: publicUrl, fileName });
  } catch (err) {
    console.error("clearance-report handler error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err instanceof Error ? err.message : String(err) });
  }
}

function escHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
