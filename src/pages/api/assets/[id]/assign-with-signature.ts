// @ts-nocheck
/**
 * POST /api/assets/[id]/assign-with-signature
 *
 * Lightweight endpoint: receives only small text fields (no binary blobs).
 * The signed PDF is uploaded separately by the client via /api/assets/documents/upload.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

// Generous limit — signature JPEG can be 50–200 KB in base64
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  let user: any = null;
  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
  } catch (authErr: any) {
    console.error('[assign-with-signature] auth error:', authErr.message);
    return res.status(500).json({ error: 'Auth error', detail: authErr.message });
  }
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // ── Route param ──────────────────────────────────────────────────────────
  const { id } = req.query;
  const assetId = Array.isArray(id) ? id[0] : String(id ?? '');
  if (!assetId) return res.status(400).json({ error: 'Missing asset id' });

  // ── Body — small fields only ──────────────────────────────────────────────
  const body = req.body ?? {};
  const assignedToName: string  = body.assignedToName  ?? '';
  const assignedToEmail: string = body.assignedToEmail ?? '';
  const assignedToId: string | null = body.assignedToId || null;
  const ticketId: string        = body.ticketId        ?? '';
  const signatureDataUrl: string = body.signatureDataUrl ?? '';
  const signedAt: string        = body.signedAt || new Date().toISOString();

  if (!assignedToName.trim())
    return res.status(400).json({ error: 'assignedToName is required' });
  if (!signatureDataUrl)
    return res.status(400).json({ error: 'signatureDataUrl is required' });
  if (!ticketId)
    return res.status(400).json({ error: 'ticketId is required' });

  // ── Look up asset ─────────────────────────────────────────────────────────
  let orgId: string | null = null;
  try {
    const roleData = await getUserRoleData(user.id);
    orgId = roleData?.organizationId ?? null;
  } catch { /* proceed without org filter */ }

  let asset: any = null;
  try {
    const where: any = { id: assetId };
    if (orgId) where.OR = [{ organizationId: orgId }, { organizationId: null }];
    asset = await prisma.asset.findFirst({
      where,
      select: { id: true, name: true, type: true, assetId: true },
    });
  } catch (lookupErr: any) {
    console.error('[assign-with-signature] asset lookup error:', lookupErr.message);
    return res.status(500).json({ error: 'Asset lookup failed', detail: lookupErr.message });
  }
  if (!asset) return res.status(404).json({ error: 'Asset not found or access denied' });

  // ── Transaction — no blobs ────────────────────────────────────────────────
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Assign asset
      await tx.asset.update({
        where: { id: assetId },
        data: {
          assignedToName:  assignedToName.trim(),
          assignedToEmail: assignedToEmail.trim() || null,
          assignedToId:    assignedToId || null,
          assignedAt:      new Date(),
        },
      });

      // 2. ASSIGNMENT_SIGNED history — store small signature + metadata
      await tx.assetHistory.create({
        data: {
          assetId,
          action:  'ASSIGNMENT_SIGNED',
          userId:  user.id,
          details: {
            assignedToName:  assignedToName.trim(),
            assignedToEmail: assignedToEmail.trim() || null,
            assignedToId:    assignedToId || null,
            signatureDataUrl,
            documentId:      null,
            signedAt,
            signedBy:        user.email,
            ticketId,
          },
        },
      });

      // 3. ASSIGNED history
      await tx.assetHistory.create({
        data: {
          assetId,
          action:  'ASSIGNED',
          userId:  user.id,
          details: {
            assignedToName:  assignedToName.trim(),
            assignedToEmail: assignedToEmail.trim() || null,
            assignedToId:    assignedToId || null,
            assignedAt:      new Date().toISOString(),
            assignedBy:      user.email,
            isSigned:        true,
          },
        },
      });

      // 4. Close linked ticket (best-effort inside transaction)
      try {
        const ticket = await tx.ticket.findUnique({
          where:  { id: ticketId },
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
              comment: `Asset "${asset.name}" assigned to ${assignedToName.trim()} with digital signature. Ticket auto-closed.`,
              status:  'CLOSED',
              userId:  user.id,
            },
          });
        }
      } catch (ticketErr: any) {
        // Ticket close failing should NOT roll back the asset assignment
        console.warn('[assign-with-signature] ticket close warning:', ticketErr.message);
      }
    });
  } catch (err: any) {
    console.error('[assign-with-signature] transaction error:', err);
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }

  // ── Confirmation email (non-blocking, initialized lazily) ────────────────
  if (assignedToEmail.trim()) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(apiKey);
        const FROM = process.env.EMAIL_FROM || 'AssetXAI <noreply@assetxai.live>';
        resend.emails.send({
          from:    FROM,
          to:      [assignedToEmail.trim()],
          subject: `✓ Asset Assigned to You: ${asset.name}`,
          html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#4f46e5,#0284c7);padding:28px 32px;color:white">
    <h1 style="margin:0 0 6px;font-size:20px">Asset Assigned — Signature Confirmed</h1>
    <p style="margin:0;opacity:.8;font-size:14px">Your digital signature has been recorded and the linked ticket has been closed.</p>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#374151;font-size:15px">Dear <strong>${assignedToName.trim()}</strong>,</p>
    <p style="color:#4b5563;font-size:14px">The following asset has been officially assigned to you following your digital signature.</p>
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
      <p style="margin:0;color:#15803d;font-size:13px">✓ Your signed agreement is stored in the asset management system. You may request a copy at any time from your asset manager.</p>
    </div>
  </div>
  <div style="background:#f1f5f9;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center">AssetXAI — Enterprise Asset Management Platform</div>
</div>`,
        }).catch((e: any) => console.error('[assign-with-signature] email error:', e.message));
      }
    } catch (emailInitErr: any) {
      console.warn('[assign-with-signature] email init warning:', emailInitErr.message);
    }
  }

  return res.status(200).json({ success: true, assetId });
}
