// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';
import { Resend } from 'resend';

export const config = {
  api: { bodyParser: { sizeLimit: '12mb' } },
};

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'AssetXAI <noreply@assetxai.live>';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth ─────────────────────────────────────────────────────────────────
  let user: any = null;
  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
  } catch (e: any) {
    return res.status(500).json({ error: 'Auth error', detail: e.message });
  }
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // ── Inputs ───────────────────────────────────────────────────────────────
  let body: any = {};
  try {
    body = req.body || {};
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid request body', detail: e.message });
  }

  const {
    assignedToName,
    assignedToEmail,
    assignedToId,
    ticketId,
    signatureDataUrl,
    pdfDataUrl,
    signedAt,
  } = body;

  if (!assignedToName?.trim()) return res.status(400).json({ error: 'assignedToName is required' });
  if (!signatureDataUrl)        return res.status(400).json({ error: 'signatureDataUrl is required' });
  if (!ticketId)                return res.status(400).json({ error: 'ticketId is required' });

  const { id } = req.query;
  const assetId = Array.isArray(id) ? id[0] : String(id);

  // ── Fetch asset (outside transaction) ────────────────────────────────────
  let asset: any = null;
  try {
    const roleData = await getUserRoleData(user.id);
    const orgId = roleData?.organizationId;
    const where: any = { id: assetId };
    if (orgId) where.OR = [{ organizationId: orgId }, { organizationId: null }];
    asset = await prisma.asset.findFirst({
      where,
      select: { id: true, name: true, type: true, assetId: true },
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to look up asset', detail: e.message });
  }
  if (!asset) return res.status(404).json({ error: 'Asset not found or access denied' });

  // ── STEP 1: Core transaction — asset + history (NO large blobs) ───────────
  try {
    await prisma.$transaction(async (tx) => {
      // 1a. Assign asset
      await tx.asset.update({
        where: { id: assetId },
        data: {
          assignedToName: assignedToName.trim(),
          assignedToEmail: assignedToEmail?.trim() || null,
          assignedToId:    assignedToId   || null,
          assignedAt:      new Date(),
        },
      });

      // 1b. ASSIGNMENT_SIGNED history — store only the small canvas signature
      await tx.assetHistory.create({
        data: {
          assetId,
          action:  'ASSIGNMENT_SIGNED',
          userId:  user.id,
          details: {
            assignedToName:  assignedToName.trim(),
            assignedToEmail: assignedToEmail?.trim() || null,
            assignedToId:    assignedToId   || null,
            signatureDataUrl,          // small canvas PNG — always works
            documentId:      null,     // updated after doc is created
            signedAt:        signedAt || new Date().toISOString(),
            signedBy:        user.email,
            ticketId:        ticketId,
          },
        },
      });

      // 1c. ASSIGNED history
      await tx.assetHistory.create({
        data: {
          assetId,
          action:  'ASSIGNED',
          userId:  user.id,
          details: {
            assignedToName:  assignedToName.trim(),
            assignedToEmail: assignedToEmail?.trim() || null,
            assignedToId:    assignedToId   || null,
            assignedAt:      new Date().toISOString(),
            assignedBy:      user.email,
            isSigned:        true,
          },
        },
      });

      // 1d. Close ticket
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, status: true },
      });
      if (ticket && ticket.status !== 'CLOSED') {
        await tx.ticket.update({
          where: { id: ticketId },
          data:  { status: 'CLOSED', assetId },
        });
        await tx.ticketHistory.create({
          data: {
            ticketId,
            comment:  `Asset "${asset.name}" assigned to ${assignedToName.trim()} with digital signature. Workflow completed.`,
            status:   'CLOSED',
            userId:   user.id,
          },
        });
      }
    });
  } catch (e: any) {
    console.error('[assign-with-signature] transaction failed:', e);
    return res.status(500).json({ error: 'Assignment transaction failed', detail: e.message });
  }

  // ── STEP 2: Store PDF as AssetDocument (outside transaction, non-critical) ─
  let documentId: string | null = null;
  if (pdfDataUrl) {
    try {
      const doc = await prisma.assetDocument.create({
        data: {
          assetId,
          fileName:     `Assignment-Agreement-${asset.assetId || assetId}-${Date.now()}.jpg`,
          fileUrl:      pdfDataUrl,
          fileType:     pdfDataUrl?.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
          fileSize:     Math.round((pdfDataUrl.length * 3) / 4),
          uploadedById: user.id,
        },
      });
      documentId = doc.id;

      // Patch the ASSIGNMENT_SIGNED history row with the documentId so the UI can link it
      const histRow = await prisma.assetHistory.findFirst({
        where: { assetId, action: 'ASSIGNMENT_SIGNED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, details: true },
      });
      if (histRow) {
        await prisma.assetHistory.update({
          where: { id: histRow.id },
          data:  { details: { ...(histRow.details as any), documentId } },
        });
      }
    } catch (e: any) {
      // Non-critical — assignment already succeeded
      console.error('[assign-with-signature] doc storage failed (non-critical):', e.message);
    }
  }

  // ── STEP 3: Confirmation email (async, non-blocking) ─────────────────────
  if (assignedToEmail?.trim()) {
    resend.emails.send({
      from:    FROM,
      to:      [assignedToEmail.trim()],
      subject: `✓ Asset Assigned to You: ${asset.name}`,
      html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#4f46e5,#0284c7);padding:28px 32px;color:white">
    <h1 style="margin:0 0 6px;font-size:20px">Asset Successfully Assigned to You</h1>
    <p style="margin:0;opacity:.8;font-size:14px">Your digital signature has been recorded and the linked ticket has been closed.</p>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#374151;font-size:15px">Dear <strong>${assignedToName.trim()}</strong>,</p>
    <p style="color:#4b5563;font-size:14px">This email confirms that the following asset has been officially assigned to you following your digital signature.</p>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="color:#6b7280;padding:8px 0;width:140px;border-bottom:1px solid #f1f5f9">Asset</td><td style="font-weight:700;color:#111827;padding:8px 0;border-bottom:1px solid #f1f5f9">${asset.name}</td></tr>
        <tr><td style="color:#6b7280;padding:8px 0;border-bottom:1px solid #f1f5f9">Type</td><td style="color:#111827;padding:8px 0;border-bottom:1px solid #f1f5f9">${asset.type || '—'}</td></tr>
        <tr><td style="color:#6b7280;padding:8px 0;border-bottom:1px solid #f1f5f9">Asset ID</td><td style="font-family:monospace;color:#111827;padding:8px 0;border-bottom:1px solid #f1f5f9">${asset.assetId || assetId}</td></tr>
        <tr><td style="color:#6b7280;padding:8px 0;border-bottom:1px solid #f1f5f9">Assigned On</td><td style="color:#111827;padding:8px 0;border-bottom:1px solid #f1f5f9">${new Date().toLocaleString()}</td></tr>
        <tr><td style="color:#6b7280;padding:8px 0">Linked Ticket</td><td style="font-family:monospace;color:#7c3aed;padding:8px 0">${ticketId}</td></tr>
      </table>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;color:#15803d;font-size:13px">✓ Your signed agreement has been stored in the asset management system. The linked ticket has been automatically closed.</p>
    </div>
    <p style="color:#6b7280;font-size:13px">You can view your assigned assets and signed documents by logging in to the AssetXAI portal.</p>
  </div>
  <div style="background:#f1f5f9;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center">
    AssetXAI — Enterprise Asset Management Platform
  </div>
</div>`,
    }).catch((e) => console.error('[assign-with-signature] email error:', e.message));
  }

  return res.status(200).json({ success: true, assetId, documentId });
}
