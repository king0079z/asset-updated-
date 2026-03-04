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
<title>Asset Clearance Certificate</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #b91c1c 0%, #dc2626 40%, #ef4444 100%); padding: 36px 40px; position: relative; }
  .header::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at top right, rgba(255,255,255,0.12), transparent 55%); }
  .header-inner { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
  .header h1 { color: #fff; font-size: 26px; font-weight: 800; line-height: 1.2; }
  .header .sub { color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
  .badge { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; white-space: nowrap; }
  .meta { padding: 24px 40px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .meta-item label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; display: block; margin-bottom: 4px; }
  .meta-item .value { font-size: 14px; font-weight: 700; color: #1e293b; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 24px 40px; border-bottom: 1px solid #e2e8f0; }
  .stat { text-align: center; border-radius: 12px; padding: 16px 12px; border: 2px solid; }
  .stat.total   { background: #f8fafc; border-color: #cbd5e1; }
  .stat.ret     { background: #f0fdf4; border-color: #86efac; color: #166534; }
  .stat.reass   { background: #eff6ff; border-color: #93c5fd; color: #1e40af; }
  .stat.disp    { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
  .stat .num    { font-size: 32px; font-weight: 800; line-height: 1; }
  .stat .lbl    { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 6px; }
  .section { padding: 24px 40px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .section-title::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f8fafc; padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .action-pill { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; border: 1.5px solid; }
  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #78350f; }
  .footer { padding: 20px 40px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .footer .officer { display: flex; align-items: center; gap: 10px; }
  .officer-avatar { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 800; flex-shrink: 0; }
  .sig-line { margin-top: 48px; border-top: 1.5px solid #cbd5e1; padding-top: 6px; font-size: 11px; color: #64748b; min-width: 200px; text-align: center; }
  @media print { body { padding: 0; background: #fff; } .page { box-shadow: none; border-radius: 0; } }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-inner">
      <div>
        <h1>Asset Clearance Certificate</h1>
        <p class="sub">Official Record — Asset Management System</p>
      </div>
      <span class="badge">${reasonLabels[reason] ?? reason}</span>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <label>Cleared Employee</label>
      <div class="value">${escHtml(userName)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">${escHtml(userEmail)}</div>
    </div>
    <div class="meta-item">
      <label>Clearance Date</label>
      <div class="value">${escHtml(dateLabel)}</div>
    </div>
    <div class="meta-item">
      <label>Clearance Officer</label>
      <div class="value">${escHtml(processedBy)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">Generated ${escHtml(generatedAt)}</div>
    </div>
  </div>

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

  <div class="section">
    <div class="section-title">Asset Disposition Summary</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Asset Name</th>
          <th>Type</th>
          <th>Action Taken</th>
          <th>Reassigned To</th>
        </tr>
      </thead>
      <tbody>
        ${actions.map((a, i) => `
        <tr>
          <td style="color:#94a3b8;font-size:11px;">${i + 1}</td>
          <td style="font-weight:600;">${escHtml(a.assetName ?? a.assetId)}</td>
          <td style="color:#64748b;">${escHtml(a.assetType ?? "")}</td>
          <td>
            <span class="action-pill" style="color:${actionColors[a.action] ?? "#64748b"};border-color:${actionColors[a.action] ?? "#cbd5e1"};">
              ${actionLabels[a.action] ?? a.action}
            </span>
          </td>
          <td style="color:#64748b;font-size:12px;">
            ${a.newUserName ? escHtml(a.newUserName) + (a.newUserEmail ? `<br/><span style="font-size:10px;">${escHtml(a.newUserEmail)}</span>` : "") : "—"}
          </td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  ${notes ? `
  <div class="section" style="padding-top:0;">
    <div class="section-title">Notes</div>
    <div class="notes-box">${escHtml(notes)}</div>
  </div>` : ""}

  <div class="footer">
    <div class="officer">
      <div class="officer-avatar">${processedBy.slice(0, 2).toUpperCase()}</div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;">Processed by</div>
        <div style="font-size:12px;color:#64748b;">${escHtml(processedBy)}</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div class="sig-line">Authorized Signature</div>
    </div>
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
