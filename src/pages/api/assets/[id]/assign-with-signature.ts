// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';
import { Resend } from 'resend';

// Increase body size limit to 10 MB to accommodate base64 PNG payloads
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'AssetXAI <noreply@assetxai.live>';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(user.id);
  const organizationId = roleData?.organizationId;

  const { id } = req.query;
  const assetId = Array.isArray(id) ? id[0] : id;

  const {
    assignedToName,
    assignedToEmail,
    assignedToId,
    ticketId,
    signatureDataUrl,  // Small: just the canvas signature
    pdfDataUrl,        // Large: the full A4 signed form
    signedAt,
  } = req.body;

  if (!assignedToName?.trim()) {
    return res.status(400).json({ error: 'assignedToName is required' });
  }
  if (!signatureDataUrl) {
    return res.status(400).json({ error: 'signatureDataUrl is required' });
  }
  if (!ticketId) {
    return res.status(400).json({ error: 'ticketId is required — a ticket must be linked to assignment' });
  }

  // Verify asset exists and is accessible
  const assetWhere: any = { id: assetId };
  if (organizationId) {
    assetWhere.OR = [{ organizationId }, { organizationId: null }];
  }
  const asset = await prisma.asset.findFirst({
    where: assetWhere,
    select: { id: true, name: true, type: true, assetId: true },
  });
  if (!asset) return res.status(404).json({ error: 'Asset not found or access denied' });

  try {
    let documentId: string | null = null;

    await prisma.$transaction(async (tx) => {
      // ── 1. Assign the asset ───────────────────────────────────────────────
      await tx.asset.update({
        where: { id: assetId },
        data: {
          assignedToName: assignedToName.trim(),
          assignedToEmail: assignedToEmail?.trim() || null,
          assignedToId: assignedToId || null,
          assignedAt: new Date(),
        },
      });

      // ── 2. Store signed form as AssetDocument ─────────────────────────────
      // pdfDataUrl is a base64 PNG data URL (client-rendered A4 form)
      if (pdfDataUrl) {
        const doc = await tx.assetDocument.create({
          data: {
            assetId,
            fileName: `Assignment-Agreement-${asset.assetId || assetId}-${Date.now()}.png`,
            fileUrl: pdfDataUrl,                         // store data URL in TEXT column
            fileType: 'image/png',
            fileSize: Math.round((pdfDataUrl.length * 3) / 4), // approx bytes from base64
            uploadedById: user.id,
          },
        });
        documentId = doc.id;
      }

      // ── 3. ASSIGNMENT_SIGNED history (signature preview + doc reference) ──
      await tx.assetHistory.create({
        data: {
          assetId,
          action: 'ASSIGNMENT_SIGNED',
          userId: user.id,
          details: {
            assignedToName: assignedToName.trim(),
            assignedToEmail: assignedToEmail?.trim() || null,
            assignedToId: assignedToId || null,
            signatureDataUrl,          // small — just the canvas stroke
            documentId,                // reference to AssetDocument with full PDF
            signedAt: signedAt || new Date().toISOString(),
            signedBy: user.email,
            ticketId: ticketId || null,
          },
        },
      });

      // ── 4. ASSIGNED history ───────────────────────────────────────────────
      await tx.assetHistory.create({
        data: {
          assetId,
          action: 'ASSIGNED',
          userId: user.id,
          details: {
            assignedToName: assignedToName.trim(),
            assignedToEmail: assignedToEmail?.trim() || null,
            assignedToId: assignedToId || null,
            assignedAt: new Date().toISOString(),
            assignedBy: user.email,
          },
        },
      });

      // ── 5. Close linked ticket ────────────────────────────────────────────
      if (ticketId) {
        const ticket = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, status: true },
        });
        if (ticket && ticket.status !== 'CLOSED') {
          await tx.ticket.update({
            where: { id: ticketId },
            data: { status: 'CLOSED', assetId },
          });
          // TicketHistory requires: ticketId, comment, userId — nothing else mandatory
          await tx.ticketHistory.create({
            data: {
              ticketId,
              comment: `Asset "${asset.name}" assigned to ${assignedToName.trim()} with digital signature. Ticket auto-closed on workflow completion.`,
              status: 'CLOSED',
              userId: user.id,
            },
          });
        }
      }
    });

    // ── 6. Confirmation email (non-blocking) ──────────────────────────────
    if (assignedToEmail?.trim()) {
      const attachments: any[] = [];
      if (pdfDataUrl?.startsWith('data:image/png;base64,')) {
        attachments.push({
          filename: `Assignment-Agreement-${asset.assetId || assetId}.png`,
          content: pdfDataUrl.replace('data:image/png;base64,', ''),
        });
      }
      resend.emails.send({
        from: FROM,
        to: [assignedToEmail.trim()],
        subject: `✓ Asset Assigned to You: ${asset.name}`,
        html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#4f46e5,#0284c7);padding:28px 32px;color:white">
    <h1 style="margin:0 0 6px;font-size:20px">Asset Successfully Assigned</h1>
    <p style="margin:0;opacity:.8;font-size:14px">Your digital signature has been recorded and the ticket is now closed.</p>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#374151;font-size:15px">Dear <strong>${assignedToName}</strong>,</p>
    <p style="color:#4b5563;font-size:14px">This confirms that the following asset has been officially assigned to you. Your digitally signed agreement is attached.</p>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="color:#6b7280;padding:6px 0;width:130px">Asset Name</td><td style="font-weight:700;color:#111827">${asset.name}</td></tr>
        <tr><td style="color:#6b7280;padding:6px 0">Asset Type</td><td style="color:#111827">${asset.type}</td></tr>
        <tr><td style="color:#6b7280;padding:6px 0">Asset ID</td><td style="font-family:monospace;color:#111827">${asset.assetId || assetId}</td></tr>
        <tr><td style="color:#6b7280;padding:6px 0">Assigned On</td><td style="color:#111827">${new Date().toLocaleString()}</td></tr>
        ${ticketId ? `<tr><td style="color:#6b7280;padding:6px 0">Linked Ticket</td><td style="font-family:monospace;color:#7c3aed">${ticketId}</td></tr>` : ''}
      </table>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;color:#15803d;font-size:13px">✓ Your signed agreement is attached as a PNG. The linked ticket has been automatically closed.</p>
    </div>
    <p style="color:#6b7280;font-size:13px">Contact your asset manager if you have any questions.</p>
  </div>
  <div style="background:#f1f5f9;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center">
    AssetXAI — Enterprise Asset Management Platform
  </div>
</div>`,
        attachments,
      }).catch((e) => console.error('[assign-with-signature] email error:', e));
    }

    return res.status(200).json({ success: true, id: assetId, documentId });
  } catch (err: any) {
    console.error('[assign-with-signature] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
